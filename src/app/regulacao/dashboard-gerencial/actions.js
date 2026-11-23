"use server";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL DA REGULAÇÃO — agregações no PostgreSQL
// ─────────────────────────────────────────────────────────────────────────
// Fonte única: public.regula_pedidos_exames (pedido = 1 linha; nada é
// duplicado por JOIN — históricos e bloqueios não entram na contagem).
//
// CRITÉRIOS DE DATA (para não excluir pedidos pendentes):
//  • Período de ENTRADA   → pedido.data_solicitacao. Define o universo.
//  • Período de LIBERAÇÃO → pedido.data_liberacao, aplicado SOMENTE quando a
//    consulta pede pedidos liberados (filtro de status = Liberado).
//  • Fila (estoque)       → pedidos Aguardando/Devolvido HOJE, com o tempo de
//    espera contado até a data atual (não usa data de liberação).
//  • Liberados (fluxo)    → tempo de espera = entrada → liberação.
//
// STATUS reais: Aguardando, Liberado, Cancelado, Devolvido.
//  • "Concluídas" = Liberado (não existe status de execução/pagamento).
//  • Cancelado e Devolvido NUNCA contam como liberado.
//
// FINANCEIRO: valor do pedido = procedimento.valor (NUMERIC(12,2)), devolvido
// como STRING decimal (sem float). Não existem valores executados/pagos nem
// valor por liberação no banco: esses indicadores não são calculados.
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;

function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 401) {
    return { success: false, error: erro?.message || "Erro ao carregar o dashboard.", status };
  }
  console.error("[Dashboard Gerencial Regulação] erro:", erro);
  return { success: false, error: "Erro ao carregar o dashboard.", status: 500 };
}

// yyyy-mm-dd → Date no início/fim do dia LOCAL (America/Sao_Paulo).
function diaLocalParaUtc(valor, limite) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || "").trim());
  if (!m) return null;
  const base = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() - FUSO_OFFSET_MS + (limite === "fim" ? 86400000 - 1 : 0));
}

const texto = (v) => String(v ?? "").trim();
const inteiro = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Condições comuns (catálogo + período de entrada). Devolve as duas formas:
// `where` (Prisma) e `sql` (Prisma.sql) para as agregações em SQL.
function condicoesComuns(filtros = {}) {
  const cond = [];
  const sql = [];

  const tipoId = inteiro(filtros.tipoExameId);
  if (tipoId) {
    cond.push({ procedimento: { tipoExameId: tipoId } });
    sql.push(Prisma.sql`pr.tipo_exame_id = ${tipoId}`);
  }
  const procId = inteiro(filtros.procedimentoId);
  if (procId) {
    cond.push({ procedimentoId: procId });
    sql.push(Prisma.sql`p.procedimento_id = ${procId}`);
  }
  const cota = texto(filtros.cota);
  if (cota) {
    cond.push({ tipoCota: cota });
    sql.push(Prisma.sql`p.tipo_cota = ${cota}`);
  }
  const deEntrada = diaLocalParaUtc(filtros.entradaInicio, "inicio");
  const ateEntrada = diaLocalParaUtc(filtros.entradaFim, "fim");
  if (deEntrada || ateEntrada) {
    cond.push({
      dataSolicitacao: { ...(deEntrada ? { gte: deEntrada } : {}), ...(ateEntrada ? { lte: ateEntrada } : {}) },
    });
    if (deEntrada) sql.push(Prisma.sql`p.data_solicitacao >= ${deEntrada}`);
    if (ateEntrada) sql.push(Prisma.sql`p.data_solicitacao <= ${ateEntrada}`);
  }
  return { cond, sql };
}

// Universo da consulta (inclui status e período de liberação quando informados).
function montarFiltros(filtros = {}) {
  const { cond, sql } = condicoesComuns(filtros);

  const status = texto(filtros.status);
  if (status) {
    cond.push({ status });
    sql.push(Prisma.sql`p.status = ${status}`);
  }
  const deLib = diaLocalParaUtc(filtros.liberacaoInicio, "inicio");
  const ateLib = diaLocalParaUtc(filtros.liberacaoFim, "fim");
  if (deLib || ateLib) {
    cond.push({
      dataLiberacao: { ...(deLib ? { gte: deLib } : {}), ...(ateLib ? { lte: ateLib } : {}) },
    });
    if (deLib) sql.push(Prisma.sql`p.data_liberacao >= ${deLib}`);
    if (ateLib) sql.push(Prisma.sql`p.data_liberacao <= ${ateLib}`);
  }
  return {
    where: cond.length ? { AND: cond } : {},
    sql: sql.length ? Prisma.join(sql, " AND ") : Prisma.sql`1=1`,
  };
}

// Fila: pendentes (Aguardando/Devolvido) com os filtros de catálogo e entrada.
function montarFiltrosFila(filtros = {}) {
  const { cond, sql } = condicoesComuns(filtros);
  cond.push({ status: { in: ["Aguardando", "Devolvido"] } });
  sql.push(Prisma.sql`p.status IN ('Aguardando','Devolvido')`);
  return {
    where: { AND: cond },
    sql: sql.length ? Prisma.join(sql, " AND ") : Prisma.sql`1=1`,
  };
}

// Catálogo dos filtros: tipos de exame, procedimentos, cotas e status reais.
export async function obterFiltrosDashboardRegulacao() {
  try {
    await requireAcessoModulo(MODULOS.REGULACAO);
    const [tipos, procedimentos, cotas, status] = await Promise.all([
      prisma.tipoExame.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.procedimento.findMany({
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, tipoExameId: true },
      }),
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT p.tipo_cota AS cota
        FROM public.regula_pedidos_exames p
        WHERE p.tipo_cota IS NOT NULL AND btrim(p.tipo_cota) <> ''
        ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT p.status FROM public.regula_pedidos_exames p ORDER BY 1`),
    ]);
    return {
      success: true,
      tiposExame: tipos,
      procedimentos,
      cotas: cotas.map((c) => c.cota),
      status: status.map((s) => s.status).filter(Boolean),
    };
  } catch (erro) {
    return responder(erro);
  }
}

export async function obterDashboardGerencial(filtros = {}) {
  try {
    await requireAcessoModulo(MODULOS.REGULACAO);

    const base = montarFiltros(filtros);
    const fila = montarFiltrosFila(filtros);

    // Universo filtrado: 1 linha por pedido, sem JOIN multiplicador.
    const universo = Prisma.sql`
      SELECT p.id, p.status, p.pessoa_cpf, p.data_solicitacao, p.data_liberacao,
             p.medico_responsavel_id, p.tipo_cota, p.classificacao_risco,
             p.procedimento_id, pr.nome AS procedimento_nome, pr.tipo_exame_id,
             te.nome AS tipo_exame_nome, pr.valor AS valor
      FROM public.regula_pedidos_exames p
      JOIN public.regula_procedimentos pr ON pr.id = p.procedimento_id
      LEFT JOIN public.regula_tipo_exame te ON te.id = pr.tipo_exame_id
      WHERE ${base.sql}`;

    // Fila atual (pendentes).
    const filaSql = Prisma.sql`
      SELECT p.id, p.classificacao_risco, p.procedimento_id, p.tipo_cota,
             p.data_solicitacao, p.medico_responsavel_id, p.pessoa_cpf,
             pr.nome AS procedimento_nome, pr.tipo_exame_id, pr.valor AS valor,
             te.nome AS tipo_exame_nome
      FROM public.regula_pedidos_exames p
      JOIN public.regula_procedimentos pr ON pr.id = p.procedimento_id
      LEFT JOIN public.regula_tipo_exame te ON te.id = pr.tipo_exame_id
      WHERE ${fila.sql}`;

    const [
      totais,
      porStatus,
      temposLiberados,
      temposPendentes,
      evolucao,
      filaRisco,
      filaTipoExame,
      filaProcedimento,
      filaTempoProcedimento,
      crescimentoProcedimento,
      envelhecimento,
      produtividade,
      financeiro,
      financeiroTipo,
      financeiroProcedimento,
      financeiroCota,
      evolucaoValores,
      cotasTeto,
    ] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN ('Aguardando','Devolvido'))::int AS pendentes,
          COUNT(*) FILTER (WHERE status = 'Liberado')::int AS liberados,
          COUNT(*) FILTER (WHERE status = 'Cancelado')::int AS cancelados,
          COUNT(DISTINCT pessoa_cpf)::int AS pacientes
        FROM (${universo}) u`),
      prisma.$queryRaw(Prisma.sql`
        SELECT status AS nome, COUNT(*)::int AS quantidade
        FROM (${universo}) u GROUP BY 1 ORDER BY quantidade DESC`),
      // Tempo de espera efetivo dos LIBERADOS (entrada → liberação), em dias.
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (data_liberacao - data_solicitacao)) / 86400))::int, 0) AS media,
          COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (data_liberacao - data_solicitacao)) / 86400), 0)::numeric(10,1) AS mediana
        FROM (${universo}) u
        WHERE status = 'Liberado' AND data_liberacao IS NOT NULL AND data_solicitacao IS NOT NULL`),
      // Tempo de espera dos PENDENTES (entrada → hoje).
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COALESCE(MAX(GREATEST(EXTRACT(EPOCH FROM (now() - data_solicitacao)) / 86400, 0)), 0)::numeric(10,1) AS maior,
          COALESCE(ROUND(AVG(GREATEST(EXTRACT(EPOCH FROM (now() - data_solicitacao)) / 86400, 0)))::int, 0) AS media
        FROM (${universo}) u
        WHERE status IN ('Aguardando','Devolvido') AND data_solicitacao IS NOT NULL`),
      // Evolução mensal das entradas (cadastro) e liberações do mês.
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(u.data_solicitacao - interval '3 hours', 'YYYY-MM') AS mes,
               COUNT(*)::int AS entradas,
               COUNT(*) FILTER (WHERE u.status = 'Liberado')::int AS liberados
        FROM (${universo}) u
        WHERE u.data_solicitacao IS NOT NULL
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(NULLIF(btrim(classificacao_risco), ''), 'Não informada') AS nome,
               COUNT(*)::int AS quantidade
        FROM (${filaSql}) f GROUP BY 1 ORDER BY quantidade DESC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(tipo_exame_nome, 'Não informado') AS nome, COUNT(*)::int AS quantidade
        FROM (${filaSql}) f GROUP BY 1 ORDER BY quantidade DESC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT procedimento_nome AS nome, COUNT(*)::int AS quantidade
        FROM (${filaSql}) f GROUP BY 1 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT procedimento_nome AS nome,
               ROUND(AVG(GREATEST(EXTRACT(EPOCH FROM (now() - data_solicitacao)) / 86400, 0)))::int AS dias,
               COUNT(*)::int AS quantidade
        FROM (${filaSql}) f
        WHERE data_solicitacao IS NOT NULL
        GROUP BY 1
        ORDER BY dias DESC, quantidade DESC LIMIT 10`),
      // Crescimento da demanda POR PROCEDIMENTO: último mês vs média anterior.
      prisma.$queryRaw(Prisma.sql`
        WITH por_mes AS (
          SELECT procedimento_nome AS nome,
                 to_char(data_solicitacao - interval '3 hours', 'YYYY-MM') AS mes,
                 COUNT(*)::int AS qtd
          FROM (${universo}) u WHERE data_solicitacao IS NOT NULL
          GROUP BY 1, 2
        ), ultimo AS (SELECT MAX(mes) AS mes FROM por_mes)
        SELECT nome,
               SUM(qtd) FILTER (WHERE mes = (SELECT mes FROM ultimo))::int AS atual,
               ROUND(AVG(qtd) FILTER (WHERE mes <> (SELECT mes FROM ultimo)))::int AS media,
               COUNT(*) FILTER (WHERE mes <> (SELECT mes FROM ultimo))::int AS meses
        FROM por_mes
        GROUP BY nome
        HAVING SUM(qtd) FILTER (WHERE mes = (SELECT mes FROM ultimo)) IS NOT NULL
           AND ROUND(AVG(qtd) FILTER (WHERE mes <> (SELECT mes FROM ultimo))) > 0
        ORDER BY (SUM(qtd) FILTER (WHERE mes = (SELECT mes FROM ultimo))
                  - ROUND(AVG(qtd) FILTER (WHERE mes <> (SELECT mes FROM ultimo)))) DESC
        LIMIT 5`),
      prisma.$queryRaw(Prisma.sql`
        SELECT faixa, COUNT(*)::int AS quantidade FROM (
          SELECT CASE
            WHEN EXTRACT(EPOCH FROM (now() - data_solicitacao)) / 86400 <= 30 THEN 'Até 30 dias'
            WHEN EXTRACT(EPOCH FROM (now() - data_solicitacao)) / 86400 <= 60 THEN '31 a 60 dias'
            WHEN EXTRACT(EPOCH FROM (now() - data_solicitacao)) / 86400 <= 90 THEN '61 a 90 dias'
            WHEN EXTRACT(EPOCH FROM (now() - data_solicitacao)) / 86400 <= 180 THEN '91 a 180 dias'
            ELSE 'Acima de 180 dias' END AS faixa
          FROM (${filaSql}) f WHERE data_solicitacao IS NOT NULL
        ) t GROUP BY faixa`),
      // Produtividade: liberações por regulador (1 pedido = 1 liberação).
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(m.nome, '— Não informado —') AS nome, COUNT(*)::int AS quantidade
        FROM (${universo}) u
        LEFT JOIN public.regula_medicos m ON m.id = u.medico_responsavel_id
        WHERE u.status = 'Liberado'
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COALESCE(SUM(valor), 0)::text AS total_solicitado,
          COALESCE(SUM(valor) FILTER (WHERE status = 'Liberado'), 0)::text AS total_liberado,
          COALESCE(SUM(valor) FILTER (WHERE status IN ('Aguardando','Devolvido')), 0)::text AS total_pendente
        FROM (${universo}) u`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(tipo_exame_nome, 'Não informado') AS nome,
               COALESCE(SUM(valor), 0)::text AS solicitado,
               COALESCE(SUM(valor) FILTER (WHERE status = 'Liberado'), 0)::text AS liberado
        FROM (${universo}) u GROUP BY 1 ORDER BY SUM(valor) DESC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT procedimento_nome AS nome,
               COALESCE(SUM(valor), 0)::text AS solicitado,
               COALESCE(SUM(valor) FILTER (WHERE status = 'Liberado'), 0)::text AS liberado,
               COUNT(*)::int AS quantidade
        FROM (${universo}) u GROUP BY 1 ORDER BY SUM(valor) DESC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(NULLIF(btrim(tipo_cota), ''), 'Sem cota') AS nome,
               COALESCE(SUM(valor), 0)::text AS solicitado,
               COALESCE(SUM(valor) FILTER (WHERE status = 'Liberado'), 0)::text AS liberado,
               COUNT(*)::int AS quantidade
        FROM (${universo}) u GROUP BY 1 ORDER BY SUM(valor) DESC`),
      // Evolução mensal dos valores autorizados (por data de liberação).
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(data_liberacao - interval '3 hours', 'YYYY-MM') AS mes,
               COALESCE(SUM(valor), 0)::text AS valor
        FROM (${universo}) u
        WHERE status = 'Liberado' AND data_liberacao IS NOT NULL
        GROUP BY 1 ORDER BY 1`),
      // Tetos de cota: utilização e saldo (limite financeiro por competência).
      prisma.$queryRaw(Prisma.sql`
        SELECT c.tipo_cota AS nome, c.mes, c.ano, c.valor_teto::text AS teto,
               COALESCE((
                 SELECT SUM(pr.valor)
                 FROM public.regula_pedidos_exames p
                 JOIN public.regula_procedimentos pr ON pr.id = p.procedimento_id
                 WHERE p.status = 'Liberado'
                   AND upper(btrim(p.tipo_cota)) = upper(btrim(c.tipo_cota))
                   AND COALESCE(p.competencia_cota, to_char(p.data_liberacao, 'YYYY-MM')) = (c.ano || '-' || c.mes)
               ), 0)::text AS utilizado
        FROM public.regula_cotas_financeiras c
        ORDER BY c.ano DESC, c.mes DESC, c.tipo_cota ASC
        LIMIT 24`),
    ]);

    const t = totais[0] || {};
    const tl = temposLiberados[0] || {};
    const tp = temposPendentes[0] || {};
    const fin = financeiro[0] || {};

    const indicadores = {
      total: Number(t.total || 0),
      pendentes: Number(t.pendentes || 0),
      liberados: Number(t.liberados || 0),
      concluidos: Number(t.liberados || 0),
      cancelados: Number(t.cancelados || 0),
      pacientes: Number(t.pacientes || 0),
      tempoMedioLiberado: Number(tl.media || 0),
      tempoMedianoLiberado: Number(tl.mediana || 0),
      maiorEsperaPendente: Number(tp.maior || 0),
      tempoMedioPendente: Number(tp.media || 0),
      valorSolicitado: String(fin.total_solicitado ?? "0"),
      valorLiberado: String(fin.total_liberado ?? "0"),
      valorPendente: String(fin.total_pendente ?? "0"),
    };

    const evolucaoUnificada = unificarEvolucao(evolucao, evolucaoValores);

    return {
      success: true,
      indicadores,
      porStatus: porStatus.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
      evolucao: evolucaoUnificada,
      fila: {
        risco: filaRisco.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        tipoExame: filaTipoExame.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        procedimento: filaProcedimento.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        tempoProcedimento: filaTempoProcedimento.map((r) => ({
          nome: r.nome,
          dias: Number(r.dias || 0),
          quantidade: Number(r.quantidade || 0),
        })),
        crescimentoProcedimento: crescimentoProcedimento.map((r) => ({
          nome: r.nome,
          atual: Number(r.atual || 0),
          media: Number(r.media || 0),
          meses: Number(r.meses || 0),
        })),
        envelhecimento: ordenarEnvelhecimento(envelhecimento),
      },
      produtividade: produtividade.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
      financeiro: {
        porTipoExame: financeiroTipo.map((r) => ({
          nome: r.nome,
          solicitado: String(r.solicitado),
          liberado: String(r.liberado),
        })),
        porProcedimento: financeiroProcedimento.map((r) => ({
          nome: r.nome,
          solicitado: String(r.solicitado),
          liberado: String(r.liberado),
          quantidade: Number(r.quantidade),
        })),
        porCota: financeiroCota.map((r) => ({
          nome: r.nome,
          solicitado: String(r.solicitado),
          liberado: String(r.liberado),
          quantidade: Number(r.quantidade),
        })),
        cotasTeto: cotasTeto.map((r) => ({
          nome: r.nome,
          competencia: `${r.mes}/${r.ano}`,
          competenciaLonga: rotuloMesLongo(`${r.ano}-${r.mes}`),
          teto: String(r.teto),
          utilizado: String(r.utilizado),
        })),
      },
    };
  } catch (erro) {
    return responder(erro);
  }
}

// Une entradas/liberações (por mês de cadastro) com valores autorizados
// (por mês de liberação) num eixo único de meses.
function unificarEvolucao(entradas, valores) {
  const mapa = new Map();
  const obter = (mes) => {
    if (!mapa.has(mes)) mapa.set(mes, { mes, entradas: 0, liberados: 0, valorLiberado: "0" });
    return mapa.get(mes);
  };
  for (const r of entradas) {
    const item = obter(r.mes);
    item.entradas = Number(r.entradas || 0);
    item.liberados = Number(r.liberados || 0);
  }
  for (const r of valores) {
    obter(r.mes).valorLiberado = String(r.valor ?? "0");
  }
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

const FAIXAS = ["Até 30 dias", "31 a 60 dias", "61 a 90 dias", "91 a 180 dias", "Acima de 180 dias"];
function ordenarEnvelhecimento(rows) {
  const mapa = new Map(rows.map((r) => [r.faixa, Number(r.quantidade || 0)]));
  return FAIXAS.map((faixa) => ({ nome: faixa, quantidade: mapa.get(faixa) || 0 }));
}
