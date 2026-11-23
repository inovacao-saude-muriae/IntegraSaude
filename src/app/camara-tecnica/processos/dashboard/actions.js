"use server";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD DE PROCESSOS JUDICIAIS — consultas AGREGADAS no backend
// ─────────────────────────────────────────────────────────────────────────
// Fontes: processos_judiciais (Procedimentos Cirúrgicos) e processos_bloqueios.
// NUNCA a Farmácia Judicial. Todos os números são calculados no PostgreSQL:
//
//  • Processos  → contados por ID DISTINTO e filtrados por `created_at`
//                 (data do cadastro do processo).
//  • Bloqueios  → somados sobre os PROCESSOS que passam pelos filtros, com
//                 contagem DISTINTA de bloqueios (evita duplicação por JOIN).
//  • Evolução   → processos por mês de `created_at`; bloqueios por mês de
//                 `data_bloqueio` (data efetiva do bloqueio). São duas séries
//                 com critérios de data DIFERENTES, por definição.
//  • Dinheiro   → `SUM(valor)` em NUMERIC(14,2), devolvido como STRING decimal
//                 (sem float). A formatação em R$ é feita no cliente.
//
// `processos_judiciais` não tem coluna de valor: o dashboard não expõe
// indicador de valor total dos processos (nada é inventado ou criado).
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

const FUNCIONALIDADE = "processo_judicial";
const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;
const STATUS_PROCESSO = { ATIVO: "ATIVO", INATIVO: "INATIVO" };

function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 500) console.error("[Dashboard Processos] erro:", erro);
  return { success: false, error: erro?.message || "Erro ao carregar o dashboard.", status };
}

// yyyy-mm-dd → Date no início/fim do dia LOCAL (America/Sao_Paulo).
function diaLocalParaUtc(valor, limite) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || "").trim());
  if (!m) return null;
  const base = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(
    base.getTime() - FUSO_OFFSET_MS + (limite === "fim" ? 24 * 60 * 60 * 1000 - 1 : 0),
  );
}

// Condições do conjunto de processos filtrado — usadas por TODAS as consultas
// para que cards, gráficos e indicadores falem do mesmo conjunto. A mesma lista
// é convertida em WHERE do Prisma e em SQL parametrizado (Prisma.sql).
function montarCondicoes({ dataInicio, dataFim, especialidade, procedimento, status, possuiBloqueio }) {
  const condicoes = [];
  const sql = [];

  const de = diaLocalParaUtc(dataInicio, "inicio");
  const ate = diaLocalParaUtc(dataFim, "fim");
  if (de || ate) {
    condicoes.push({ createdAt: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } });
    if (de) sql.push(Prisma.sql`p.created_at >= ${de}`);
    if (ate) sql.push(Prisma.sql`p.created_at <= ${ate}`);
  }

  // Especialidade/procedimento por NOME de espelho do processo: registros
  // antigos podem ter o id do catálogo nulo, mas o nome gravado no cadastro
  // permanece. O procedimento pode ser escolhido sem especialidade.
  const espNome = String(especialidade || "").trim();
  if (espNome) {
    condicoes.push({ especialidadeNome: espNome });
    sql.push(Prisma.sql`p.especialidade_nome = ${espNome}`);
  }

  const procNome = String(procedimento || "").trim();
  if (procNome) {
    condicoes.push({ procedimentoNome: procNome });
    sql.push(Prisma.sql`p.procedimento_nome = ${procNome}`);
  }

  const sit = String(status || "todos").toLowerCase();
  if (sit === "ativos") {
    condicoes.push({ OR: [{ status: STATUS_PROCESSO.ATIVO }, { status: null }] });
    sql.push(Prisma.sql`(p.status = 'ATIVO' OR p.status IS NULL)`);
  } else if (sit === "inativos") {
    condicoes.push({ status: STATUS_PROCESSO.INATIVO });
    sql.push(Prisma.sql`p.status = 'INATIVO'`);
  }

  const comBloqueio = String(possuiBloqueio || "todos").toLowerCase();
  if (comBloqueio === "sim") {
    condicoes.push({ bloqueios: { some: {} } });
    sql.push(Prisma.sql`EXISTS (SELECT 1 FROM public.processos_bloqueios b WHERE b.processo_id = p.id)`);
  } else if (comBloqueio === "nao") {
    condicoes.push({ bloqueios: { none: {} } });
    sql.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM public.processos_bloqueios b WHERE b.processo_id = p.id)`);
  }

  return {
    where: condicoes.length ? { AND: condicoes } : {},
    sql: sql.length ? Prisma.join(sql, " AND ") : Prisma.sql`1=1`,
  };
}

export async function obterDashboardProcessos(filtros = {}) {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");

    const { where, sql: condicoesSql } = montarCondicoes(filtros);

    // Subconsulta dos processos filtrados: os bloqueios são sempre contados e
    // somados a partir dela (nunca por JOIN direto, que multiplicaria linhas).
    const idsFiltrados = Prisma.sql`
      SELECT p.id, p.created_at, p.status, p.especialidade_nome, p.procedimento_nome
      FROM public.processos_judiciais p
      WHERE ${condicoesSql}`;

    const [
      totais,
      porStatus,
      bloqueios,
      porProcedimento,
      porEspecialidade,
      evolucaoProcessos,
      evolucaoBloqueios,
      bloqueiosPorProcedimento,
      maiorValorProcedimento,
    ] = await Promise.all([
      // 1-4. Totais (processos DISTINTOS; bloqueios apenas sinalizados).
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'ATIVO' OR status IS NULL)::int AS ativos,
          COUNT(*) FILTER (WHERE status = 'INATIVO')::int AS inativos,
          COUNT(*) FILTER (
            WHERE EXISTS (SELECT 1 FROM public.processos_bloqueios b WHERE b.processo_id = f.id)
          )::int AS com_bloqueio,
          COUNT(DISTINCT f.especialidade_nome)::int AS especialidades,
          COUNT(DISTINCT f.procedimento_nome)::int AS procedimentos
        FROM (${idsFiltrados}) f`),
      // Rosca: situação dos processos.
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(status, 'ATIVO') AS situacao, COUNT(*)::int AS quantidade
        FROM (${idsFiltrados}) f
        GROUP BY 1 ORDER BY 1`),
      // 6-7 + complementares financeiros (registros DISTINTOS de bloqueio).
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COUNT(b.id)::int AS total_bloqueios,
          COALESCE(SUM(b.valor), 0)::text AS valor_total,
          COUNT(DISTINCT b.processo_id)::int AS processos_com_bloqueio,
          COALESCE(AVG(b.valor), 0)::text AS valor_medio
        FROM (${idsFiltrados}) f
        LEFT JOIN public.processos_bloqueios b ON b.processo_id = f.id`),
      // Gráfico: processos por procedimento (nomes reais do catálogo).
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(procedimento_nome, 'Não informado') AS nome, COUNT(*)::int AS quantidade
        FROM (${idsFiltrados}) f
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      // Gráfico: processos por especialidade.
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(especialidade_nome, 'Não informada') AS nome, COUNT(*)::int AS quantidade
        FROM (${idsFiltrados}) f
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      // Evolução: processos por mês de CADASTRO (fuso local).
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(f.created_at - interval '3 hours', 'YYYY-MM') AS mes, COUNT(*)::int AS quantidade
        FROM (${idsFiltrados}) f
        GROUP BY 1 ORDER BY 1`),
      // Evolução: bloqueios por mês da DATA DO BLOQUEIO.
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(b.data_bloqueio, 'YYYY-MM') AS mes,
               COUNT(b.id)::int AS quantidade,
               COALESCE(SUM(b.valor), 0)::text AS valor
        FROM public.processos_bloqueios b
        WHERE b.processo_id IN (SELECT id FROM (${idsFiltrados}) x)
        GROUP BY 1 ORDER BY 1`),
      // Gráfico: valor acumulado de bloqueios por procedimento.
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(f.procedimento_nome, 'Não informado') AS nome,
               COALESCE(SUM(b.valor), 0)::text AS valor,
               COUNT(b.id)::int AS quantidade
        FROM (${idsFiltrados}) f
        JOIN public.processos_bloqueios b ON b.processo_id = f.id
        GROUP BY 1 ORDER BY SUM(b.valor) DESC LIMIT 10`),
      // Maior valor acumulado por procedimento (indicador complementar).
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(f.procedimento_nome, 'Não informado') AS nome,
               COALESCE(SUM(b.valor), 0)::text AS valor
        FROM (${idsFiltrados}) f
        JOIN public.processos_bloqueios b ON b.processo_id = f.id
        GROUP BY 1 ORDER BY SUM(b.valor) DESC LIMIT 1`),
    ]);

    const t = totais[0] || {};
    const bl = bloqueios[0] || {};
    const totalProcessos = Number(t.total || 0);
    const comBloqueio = Number(t.com_bloqueio || 0);
    const totalBloqueios = Number(bl.total_bloqueios || 0);

    // Pacientes distintos vinculados aos processos filtrados.
    const pacientes = await prisma.processoJudicial.findMany({
      where,
      select: { pessoaCpf: true },
      distinct: ["pessoaCpf"],
    });

    return {
      success: true,
      filtros: {
        dataInicio: filtros.dataInicio || "",
        dataFim: filtros.dataFim || "",
        especialidade: filtros.especialidade || "",
        procedimento: filtros.procedimento || "",
        status: filtros.status || "todos",
        possuiBloqueio: filtros.possuiBloqueio || "todos",
      },
      indicadores: {
        totalProcessos,
        ativos: Number(t.ativos || 0),
        inativos: Number(t.inativos || 0),
        processosComBloqueio: comBloqueio,
        percentualComBloqueio:
          totalProcessos > 0 ? Number(((comBloqueio / totalProcessos) * 100).toFixed(1)) : 0,
        valorTotalBloqueios: String(bl.valor_total ?? "0"),
        totalBloqueios,
        mediaBloqueiosPorProcesso:
          comBloqueio > 0 ? Number((totalBloqueios / comBloqueio).toFixed(2)) : 0,
        valorMedioPorBloqueio: totalBloqueios > 0 ? String(bl.valor_medio ?? "0") : "0",
        pacientesDistintos: pacientes.length,
        procedimentoMaisProcessos: porProcedimento[0]?.nome || null,
        procedimentoMaiorValorBloqueios: maiorValorProcedimento[0]?.nome || null,
      },
      porStatus: porStatus.map((r) => ({ nome: r.situacao, quantidade: Number(r.quantidade) })),
      porProcedimento: porProcedimento.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
      porEspecialidade: porEspecialidade.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
      evolucao: montarEvolucao(evolucaoProcessos, evolucaoBloqueios),
      bloqueiosPorProcedimento: bloqueiosPorProcedimento.map((r) => ({
        nome: r.nome,
        valor: String(r.valor),
        quantidade: Number(r.quantidade),
      })),
    };
  } catch (erro) {
    return responder(erro);
  }
}

// Une as duas séries (processos por mês de cadastro e bloqueios por mês da
// data do bloqueio) num eixo único de meses, sem buracos.
function montarEvolucao(processos, bloqueios) {
  const mapa = new Map();
  const obter = (mes) => {
    if (!mapa.has(mes)) mapa.set(mes, { mes, processos: 0, bloqueios: 0, valorBloqueios: "0" });
    return mapa.get(mes);
  };
  for (const r of processos) obter(r.mes).processos = Number(r.quantidade);
  for (const r of bloqueios) {
    const item = obter(r.mes);
    item.bloqueios = Number(r.quantidade);
    item.valorBloqueios = String(r.valor ?? "0");
  }
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

// Catálogo dos filtros (especialidades e procedimentos do catálogo PRÓPRIO de
// Processos). O procedimento traz a especialidade de origem para o filtro
// restringir a lista quando uma especialidade é escolhida.
export async function obterCatalogoDashboardProcessos() {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");
    const [especialidades, procedimentos, vinculos] = await Promise.all([
      prisma.processoEspecialidade.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      }),
      prisma.processoProcedimento.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      }),
      prisma.processoEspecialidadeProcedimento.findMany({
        select: { especialidadeId: true, procedimentoId: true },
      }),
    ]);
    return {
      success: true,
      especialidades,
      procedimentos,
      vinculos,
    };
  } catch (erro) {
    return responder(erro);
  }
}
