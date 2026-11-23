"use server";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL DA JUNTA REGULADORA — agregações no PostgreSQL
// ─────────────────────────────────────────────────────────────────────────
// Fonte: public.junta_atendimentos (o "pedido" da Junta é o atendimento).
//   1 linha por pedido — nenhuma agregação usa JOIN multiplicador, então o
//   mesmo pedido nunca é contado duas vezes.
//
// DATAS (cada indicador usa a data que lhe pertence):
//   • Período de ENTRADA   → created_at (cadastro do pedido).
//   • Período de MOVIMENTAÇÃO/CONCLUSÃO → data_atendimento (data real da
//     movimentação registrada). Quando informado, restringe os pedidos que
//     possuem movimentação naquele intervalo (pendentes sem movimentação não
//     entram nesse recorte).
//   • Pendentes (estoque)  → status FALTA / FALTA_JUSTIFICADA, com espera
//     contada de created_at até hoje.
//   • Concluídos (fluxo)   → status PRESENCA, com tempo created_at →
//     data_atendimento.
//
// SITUAÇÕES reais (junta/actions.js SITUACOES_PEDIDO): PRESENCA, FALTA,
// FALTA_JUSTIFICADA. "Concluído" = PRESENCA.
//
// RESPONSÁVEL: junta_atendimentos.profissional_responsavel — quando o campo
// está vazio o pedido não é atribuído a ninguém (não usa o usuário do
// cadastro). Sem responsável preenchido o gráfico não é exibido.
//
// ESCOPO: usuário não-administrador só enxerga os serviços do seu vínculo
// (TODOS → todos; sem serviços → nada) — nunca irrestrito.
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS, usuarioEhAdminModulo } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;

const SITUACOES = {
  PRESENCA: "Presença",
  FALTA: "Falta",
  FALTA_JUSTIFICADA: "Falta justificada",
};

function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 401) {
    return { success: false, error: erro?.message || "Erro ao carregar o dashboard.", status };
  }
  console.error("[Dashboard Junta] erro:", erro);
  return { success: false, error: "Erro ao carregar o dashboard.", status: 500 };
}

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

// Serviços autorizados pelo escopo do usuário (null = todos).
async function idsServicosDoEscopo(user) {
  if (await usuarioEhAdminModulo(user, MODULOS.JUNTA)) return null;
  const ids = [];
  for (const a of user.acessos || []) {
    if (a.modulo !== MODULOS.JUNTA) continue;
    if (a.ativo === false) continue;
    if (a.escopo === "TODOS") {
      const todos = await prisma.servico.findMany({ select: { id: true } });
      return todos.map((s) => s.id);
    }
    for (const id of a.servicos || []) {
      const numero = Number(id);
      if (Number.isInteger(numero)) ids.push(numero);
    }
  }
  return [...new Set(ids)];
}

// Catálogo dos filtros (serviços e especialidades), respeitando o escopo.
export async function obterFiltrosDashboardJunta() {
  try {
    const user = await requireAcessoModulo(MODULOS.JUNTA);
    const permitidos = await idsServicosDoEscopo(user);
    const whereServico = permitidos === null ? {} : { id: { in: permitidos } };

    const [servicos, especialidades] = await Promise.all([
      prisma.servico.findMany({
        where: { ...whereServico, ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      }),
      prisma.especialidade.findMany({
        where: { ativo: true, servico: whereServico },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, servicoId: true },
      }),
    ]);

    return {
      success: true,
      servicos,
      especialidades,
      situacoes: Object.entries(SITUACOES).map(([valor, rotulo]) => ({ valor, rotulo })),
      // Sem histórico confiável de responsável não se oferece o filtro.
      responsaveis: await responsaveisDisponiveis(permitidos),
    };
  } catch (erro) {
    return responder(erro);
  }
}

// Responsáveis com pelo menos um pedido concluído registrado.
async function responsaveisDisponiveis(permitidos) {
  const filtro = permitidos === null ? Prisma.sql`1=1` : permitidos.length
    ? Prisma.sql`a.servico_id IN (${Prisma.join(permitidos)})`
    : Prisma.sql`1=0`;
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT btrim(a.profissional_responsavel) AS nome
    FROM public.junta_atendimentos a
    WHERE ${filtro}
      AND a.profissional_responsavel IS NOT NULL
      AND btrim(a.profissional_responsavel) <> ''
    ORDER BY 1`);
  return rows.map((r) => r.nome);
}

// Condições comuns: escopo + serviço + especialidade + entrada + situações.
function montarCondicoes(filtros, permitidos) {
  const sql = [];

  if (permitidos !== null) {
    sql.push(
      permitidos.length
        ? Prisma.sql`a.servico_id IN (${Prisma.join(permitidos)})`
        : Prisma.sql`1=0`,
    );
  }

  const servicoId = inteiro(filtros.servicoId);
  if (servicoId) sql.push(Prisma.sql`a.servico_id = ${servicoId}`);

  const especialidade = texto(filtros.especialidade);
  if (especialidade) sql.push(Prisma.sql`btrim(a.especialidade) = ${especialidade}`);

  const situacao = texto(filtros.situacao);
  if (situacao) sql.push(Prisma.sql`a.status = ${situacao}`);

  const deEntrada = diaLocalParaUtc(filtros.entradaInicio, "inicio");
  const ateEntrada = diaLocalParaUtc(filtros.entradaFim, "fim");
  if (deEntrada) sql.push(Prisma.sql`a.created_at >= ${deEntrada}`);
  if (ateEntrada) sql.push(Prisma.sql`a.created_at <= ${ateEntrada}`);

  const deMov = diaLocalParaUtc(filtros.movimentacaoInicio, "inicio");
  const ateMov = diaLocalParaUtc(filtros.movimentacaoFim, "fim");
  if (deMov) sql.push(Prisma.sql`a.data_atendimento >= ${deMov}`);
  if (ateMov) sql.push(Prisma.sql`a.data_atendimento <= ${ateMov}`);

  const responsavel = texto(filtros.responsavel);
  if (responsavel) sql.push(Prisma.sql`btrim(a.profissional_responsavel) = ${responsavel}`);

  return sql.length ? Prisma.join(sql, " AND ") : Prisma.sql`1=1`;
}

export async function obterDashboardJunta(filtros = {}) {
  try {
    const user = await requireAcessoModulo(MODULOS.JUNTA);
    const permitidos = await idsServicosDoEscopo(user);
    const where = montarCondicoes(filtros, permitidos);

    const universo = Prisma.sql`
      SELECT a.id, a.servico_id, a.especialidade, a.status, a.data_atendimento,
             a.created_at, btrim(a.profissional_responsavel) AS responsavel,
             a.paciente_junta_id, s.nome AS servico_nome
      FROM public.junta_atendimentos a
      LEFT JOIN public.junta_servicos s ON s.id = a.servico_id
      WHERE ${where}`;

    const [
      totais,
      porSituacao,
      porServico,
      porEspecialidade,
      evolucao,
      pendentesServico,
      esperaEspecialidade,
      envelhecimento,
      produtividade,
    ] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN ('FALTA','FALTA_JUSTIFICADA'))::int AS pendentes,
          COUNT(*) FILTER (WHERE status = 'PRESENCA')::int AS concluidos,
          COUNT(DISTINCT paciente_junta_id)::int AS pacientes
        FROM (${universo}) u`),
      prisma.$queryRaw(Prisma.sql`
        SELECT status, COUNT(*)::int AS quantidade
        FROM (${universo}) u GROUP BY 1 ORDER BY quantidade DESC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(servico_nome, 'Não informado') AS nome, COUNT(*)::int AS quantidade
        FROM (${universo}) u GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(NULLIF(btrim(especialidade), ''), 'Não informada') AS nome, COUNT(*)::int AS quantidade
        FROM (${universo}) u GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(created_at - interval '3 hours', 'YYYY-MM') AS mes,
               COUNT(*)::int AS entradas,
               COUNT(*) FILTER (WHERE status = 'PRESENCA')::int AS concluidos
        FROM (${universo}) u
        WHERE created_at IS NOT NULL
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(servico_nome, 'Não informado') AS nome, COUNT(*)::int AS quantidade
        FROM (${universo}) u
        WHERE status IN ('FALTA','FALTA_JUSTIFICADA')
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(NULLIF(btrim(especialidade), ''), 'Não informada') AS nome,
               ROUND(AVG(GREATEST(EXTRACT(EPOCH FROM (now() - created_at)) / 86400, 0)))::int AS dias,
               COUNT(*)::int AS quantidade
        FROM (${universo}) u
        WHERE status IN ('FALTA','FALTA_JUSTIFICADA') AND created_at IS NOT NULL
        GROUP BY 1 ORDER BY dias DESC, quantidade DESC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT faixa, COUNT(*)::int AS quantidade FROM (
          SELECT CASE
            WHEN EXTRACT(EPOCH FROM (now() - created_at)) / 86400 <= 30 THEN 'Até 30 dias'
            WHEN EXTRACT(EPOCH FROM (now() - created_at)) / 86400 <= 60 THEN '31 a 60 dias'
            WHEN EXTRACT(EPOCH FROM (now() - created_at)) / 86400 <= 90 THEN '61 a 90 dias'
            WHEN EXTRACT(EPOCH FROM (now() - created_at)) / 86400 <= 180 THEN '91 a 180 dias'
            ELSE 'Acima de 180 dias' END AS faixa
          FROM (${universo}) u
          WHERE status IN ('FALTA','FALTA_JUSTIFICADA') AND created_at IS NOT NULL
        ) t GROUP BY faixa`),
      // Concluídos por responsável (nunca pelo usuário do cadastro).
      prisma.$queryRaw(Prisma.sql`
        SELECT responsavel AS nome, COUNT(*)::int AS quantidade
        FROM (${universo}) u
        WHERE status = 'PRESENCA' AND responsavel IS NOT NULL AND responsavel <> ''
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
    ]);

    const t = totais[0] || {};
    const tempoConcluidos = await prisma.$queryRaw(Prisma.sql`
      SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (data_atendimento::timestamptz - created_at)) / 86400))::int, 0) AS media
      FROM (${universo}) u
      WHERE status = 'PRESENCA' AND data_atendimento IS NOT NULL AND created_at IS NOT NULL`);
    const tempoPendentes = await prisma.$queryRaw(Prisma.sql`
      SELECT COALESCE(ROUND(AVG(GREATEST(EXTRACT(EPOCH FROM (now() - created_at)) / 86400, 0)))::int, 0) AS media
      FROM (${universo}) u
      WHERE status IN ('FALTA','FALTA_JUSTIFICADA') AND created_at IS NOT NULL`);

    return {
      success: true,
      indicadores: {
        total: Number(t.total || 0),
        pendentes: Number(t.pendentes || 0),
        concluidos: Number(t.concluidos || 0),
        pacientes: Number(t.pacientes || 0),
        tempoMedioPendente: Number(tempoPendentes[0]?.media || 0),
        tempoMedioConcluido: Number(tempoConcluidos[0]?.media || 0),
      },
      porSituacao: porSituacao.map((r) => ({
        nome: SITUACOES[r.status] || r.status,
        quantidade: Number(r.quantidade),
      })),
      porServico: porServico.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
      porEspecialidade: porEspecialidade.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
      evolucao: evolucao.map((r) => ({
        mes: r.mes,
        entradas: Number(r.entradas || 0),
        concluidos: Number(r.concluidos || 0),
      })),
      pendentesServico: pendentesServico.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
      esperaEspecialidade: esperaEspecialidade.map((r) => ({
        nome: r.nome,
        dias: Number(r.dias || 0),
        quantidade: Number(r.quantidade || 0),
      })),
      envelhecimento: ordenarEnvelhecimento(envelhecimento),
      produtividade: produtividade.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
    };
  } catch (erro) {
    return responder(erro);
  }
}

const FAIXAS = ["Até 30 dias", "31 a 60 dias", "61 a 90 dias", "91 a 180 dias", "Acima de 180 dias"];
function ordenarEnvelhecimento(rows) {
  const mapa = new Map(rows.map((r) => [r.faixa, Number(r.quantidade || 0)]));
  return FAIXAS.map((faixa) => ({ nome: faixa, quantidade: mapa.get(faixa) || 0 }));
}
