"use server";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL DA FARMÁCIA JUDICIAL — agregações no PostgreSQL
// ─────────────────────────────────────────────────────────────────────────
// Fontes (1 linha por registro, sem JOIN multiplicador):
//  • public.farmacia_pacientes        → processos (numero_processo, status)
//  • public.farmacia_tratamentos_pacientes → vínculo processo ↔ medicamento
//  • public.farmacia_dispensacoes_medicamentos → dispensações (qtd_entregue)
//  • public.farmacia_lotes_medicamentos → compras (qtd_inicial × valor_unitario)
//  • public.farmacia_ajustes_estoque  → ajustes de saldo (delta)
//
// SALDO CONSOLIDADO (mesma fórmula do módulo — calcularSaldoMedicamento):
//   Σ(qtd_inicial − dispensações do lote) + Σ(ajustes.delta)
// nunca por entrada de compra separada: é posição ATUAL do medicamento.
//
// CRITÉRIOS DE DATA (cada indicador usa a data que lhe pertence):
//  • Período do cadastro    → farmacia_pacientes.created_at (processos).
//  • Período da dispensação → farmacia_dispensacoes_medicamentos.data_dispensacao.
//  • Compras                → farmacia_lotes_medicamentos.data_entrada.
//  • Estoque (saldo, zerados, vencimento) → posição atual, sem filtro de data.
//
// SITUAÇÃO DO PROCESSO (Ativo/Inativo) é operacional e vem de
// farmacia_pacientes.status — nunca da situação cadastral da pessoa.
//
// VALOR DE ESTOQUE: valorização pelo valor unitário do lote (FEFO — validade
// mais próxima primeiro), somente dos lotes com saldo e não vencidos. Lotes
// sem valor unitário (> 0) não entram; nesse caso o indicador não é exibido.
//
// Não existe no banco valor de dispensação/custo efetivo: valores de compra
// NUNCA são apresentados como custo do dispensado.
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;
const FUNCIONALIDADE = "pacientes";

function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 401) {
    return { success: false, error: erro?.message || "Erro ao carregar o dashboard.", status };
  }
  console.error("[Dashboard Farmácia Judicial] erro:", erro);
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

// Condições do universo de PROCESSOS (cadastro + situação).
function filtrosProcessos(filtros = {}) {
  const cond = [];
  const sql = [];
  const de = diaLocalParaUtc(filtros.cadastroInicio, "inicio");
  const ate = diaLocalParaUtc(filtros.cadastroFim, "fim");
  if (de || ate) {
    cond.push({ createdAt: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } });
    if (de) sql.push(Prisma.sql`pc.created_at >= ${de}`);
    if (ate) sql.push(Prisma.sql`pc.created_at <= ${ate}`);
  }
  const situacao = texto(filtros.situacao).toUpperCase();
  if (situacao === "ATIVO" || situacao === "INATIVO") {
    cond.push({ status: situacao });
    sql.push(Prisma.sql`pc.status = ${situacao}`);
  }
  return { cond, sql };
}

// Condições de DISPENSAÇÃO (período + medicamento + processos do universo).
// O universo de processos entra por EXISTS, sem depender de alias externo.
function filtrosDispensacoes(filtros = {}, processosWhere) {
  const sql = [];
  const de = diaLocalParaUtc(filtros.dispensacaoInicio, "inicio");
  const ate = diaLocalParaUtc(filtros.dispensacaoFim, "fim");
  if (de) sql.push(Prisma.sql`d.data_dispensacao >= ${de}`);
  if (ate) sql.push(Prisma.sql`d.data_dispensacao <= ${ate}`);
  const medId = inteiro(filtros.medicamentoId);
  if (medId) sql.push(Prisma.sql`lm.medicamento_id = ${medId}`);
  if (processosWhere) {
    sql.push(Prisma.sql`EXISTS (
      SELECT 1 FROM public.farmacia_pacientes pc
      WHERE pc.numero_pasta = d.paciente_pasta AND ${processosWhere})`);
  }
  return sql.length ? Prisma.join(sql, " AND ") : Prisma.sql`1=1`;
}

// Subconsulta dos processos filtrados (reutilizada em todas as agregações).
function processosFiltradosSql(filtros = {}) {
  const { sql } = filtrosProcessos(filtros);
  return sql.length ? Prisma.join(sql, " AND ") : Prisma.sql`1=1`;
}

export async function obterFiltrosDashboardFarmacia() {
  try {
    await requirePermissao(MODULOS.FARMACIA, FUNCIONALIDADE, "visualizar");
    const medicamentos = await prisma.medicamento.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, dosagem: true, tipo: true },
    });
    return {
      success: true,
      medicamentos: medicamentos.map((m) => ({
        id: m.id,
        nome: `${m.nome}${m.dosagem ? ` — ${m.dosagem}` : ""}`,
      })),
      situacoes: [
        { valor: "ATIVO", nome: "Ativo" },
        { valor: "INATIVO", nome: "Inativo" },
      ],
    };
  } catch (erro) {
    return responder(erro);
  }
}

export async function obterDashboardFarmacia(filtros = {}) {
  try {
    await requirePermissao(MODULOS.FARMACIA, FUNCIONALIDADE, "visualizar");

    const procWhere = processosFiltradosSql(filtros);
    // Dispensação sem período/filtro de processo é consulta sobre TODAS as
    // dispensações; com filtros, restringe aos processos do universo.
    const temFiltroProcesso = procWhere !== Prisma.sql`1=1`;
    const dispWhere = filtrosDispensacoes(filtros, temFiltroProcesso ? procWhere : null);
    const medId = inteiro(filtros.medicamentoId);
    const medFiltroSql = medId ? Prisma.sql`AND m.id = ${medId}` : Prisma.sql``;

    // Subconsultas reutilizadas.
    const processos = Prisma.sql`
      SELECT pc.numero_pasta, pc.numero_processo, pc.status, pc.created_at
      FROM public.farmacia_pacientes pc
      WHERE ${procWhere}`;

    const dispensacoes = Prisma.sql`
      SELECT d.id, d.qtd_entregue, d.data_dispensacao, lm.medicamento_id,
             m.nome AS medicamento_nome, m.dosagem, m.tipo
      FROM public.farmacia_dispensacoes_medicamentos d
      JOIN public.farmacia_lotes_medicamentos lm ON lm.id = d.lote_medicamento_id
      JOIN public.farmacia_medicamentos m ON m.id = lm.medicamento_id
      WHERE ${dispWhere}`;

    // Saldo consolidado por medicamento (fórmula do módulo).
    const saldos = Prisma.sql`
      SELECT m.id, m.nome, m.dosagem, m.tipo, m.ativo,
             (
               COALESCE((
                 SELECT SUM(lm.qtd_inicial - COALESCE((
                   SELECT SUM(dm.qtd_entregue) FROM public.farmacia_dispensacoes_medicamentos dm
                   WHERE dm.lote_medicamento_id = lm.id), 0))
                 FROM public.farmacia_lotes_medicamentos lm WHERE lm.medicamento_id = m.id), 0)
               + COALESCE((SELECT SUM(a.delta) FROM public.farmacia_ajustes_estoque a
                           WHERE a.medicamento_id = m.id), 0)
             )::int AS saldo
      FROM public.farmacia_medicamentos m`;

    const [
      cards,
      porMedicamento,
      evolucao,
      vinculados,
      estoqueCards,
      saidas,
      proximosVencimento,
      financeiro,
      comprasMes,
      comprasMedicamento,
      valorEstoque,
      insightsBase,
    ] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT
          (SELECT COUNT(*)::int FROM (${processos}) p) AS total,
          (SELECT COUNT(*)::int FROM (${processos}) p WHERE p.status = 'ATIVO') AS ativos,
          (SELECT COUNT(*)::int FROM (${processos}) p WHERE p.status = 'INATIVO') AS inativos,
          (SELECT COUNT(*)::int FROM (${dispensacoes}) d) AS dispensacoes,
          (SELECT COALESCE(SUM(d.qtd_entregue), 0)::int FROM (${dispensacoes}) d) AS itens`),
      prisma.$queryRaw(Prisma.sql`
        SELECT d.medicamento_nome AS nome, d.dosagem, d.tipo,
               SUM(d.qtd_entregue)::int AS quantidade, COUNT(*)::int AS entregas
        FROM (${dispensacoes}) d
        GROUP BY 1, 2, 3 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(d.data_dispensacao - interval '3 hours', 'YYYY-MM') AS mes,
               COUNT(*)::int AS quantidade, SUM(d.qtd_entregue)::int AS itens
        FROM (${dispensacoes}) d
        WHERE d.data_dispensacao IS NOT NULL
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT m.nome AS nome, m.dosagem, COUNT(DISTINCT tp.paciente_pasta)::int AS quantidade
        FROM public.farmacia_tratamentos_pacientes tp
        JOIN public.farmacia_pacientes pc ON pc.numero_pasta = tp.paciente_pasta
        JOIN public.farmacia_medicamentos m ON m.id = tp.medicamento_id
        WHERE tp.ativo = true AND pc.status = 'ATIVO' AND ${procWhere}
          ${medFiltroSql}
        GROUP BY 1, 2 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS cadastrados,
               COUNT(*) FILTER (WHERE saldo <= 0)::int AS zerados,
               COALESCE(SUM(saldo) FILTER (WHERE saldo > 0), 0)::int AS unidades
        FROM (${saldos}) s`),
      prisma.$queryRaw(Prisma.sql`
        SELECT s.nome, s.dosagem,
               COALESCE((SELECT SUM(d.qtd_entregue)::int FROM (${dispensacoes}) d
                         WHERE d.medicamento_nome = s.nome AND d.dosagem = s.dosagem), 0) AS quantidade
        FROM (${saldos}) s
        ORDER BY quantidade DESC, s.nome ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT m.nome, m.dosagem, lm.numero_lote, lm.data_validade::text AS validade,
               (lm.qtd_inicial - COALESCE((
                  SELECT SUM(dm.qtd_entregue) FROM public.farmacia_dispensacoes_medicamentos dm
                  WHERE dm.lote_medicamento_id = lm.id), 0))::int AS saldo
        FROM public.farmacia_lotes_medicamentos lm
        JOIN public.farmacia_medicamentos m ON m.id = lm.medicamento_id
        WHERE lm.data_validade >= CURRENT_DATE
          AND (lm.qtd_inicial - COALESCE((
                SELECT SUM(dm.qtd_entregue) FROM public.farmacia_dispensacoes_medicamentos dm
                WHERE dm.lote_medicamento_id = lm.id), 0)) > 0
          AND lm.data_validade <= CURRENT_DATE + 90
        ORDER BY lm.data_validade ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(SUM(lm.qtd_inicial * lm.valor_unitario), 0)::text AS total,
               COUNT(*)::int AS lotes,
               COUNT(*) FILTER (WHERE lm.valor_unitario > 0)::int AS com_valor
        FROM public.farmacia_lotes_medicamentos lm`),
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(lm.data_entrada - interval '3 hours', 'YYYY-MM') AS mes,
               COALESCE(SUM(lm.qtd_inicial * lm.valor_unitario), 0)::text AS valor,
               COUNT(*)::int AS lotes
        FROM public.farmacia_lotes_medicamentos lm
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT m.nome, m.dosagem,
               COALESCE(SUM(lm.qtd_inicial * lm.valor_unitario), 0)::text AS valor,
               COUNT(*)::int AS lotes
        FROM public.farmacia_lotes_medicamentos lm
        JOIN public.farmacia_medicamentos m ON m.id = lm.medicamento_id
        GROUP BY 1, 2 ORDER BY SUM(lm.qtd_inicial * lm.valor_unitario) DESC LIMIT 10`),
      // Valorização do estoque disponível (FEFO, lotes não vencidos com saldo).
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(SUM(saldo_lote * lm.valor_unitario), 0)::text AS valor,
               COUNT(*)::int AS lotes
        FROM (
          SELECT lm.id, lm.valor_unitario,
                 (lm.qtd_inicial - COALESCE((
                    SELECT SUM(dm.qtd_entregue) FROM public.farmacia_dispensacoes_medicamentos dm
                    WHERE dm.lote_medicamento_id = lm.id), 0))::int AS saldo_lote
          FROM public.farmacia_lotes_medicamentos lm
          WHERE lm.data_validade >= CURRENT_DATE AND lm.valor_unitario > 0
        ) lm WHERE saldo_lote > 0`),
      // Base dos insights: processos ativos sem medicamento vinculado.
      prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS sem_vinculo
        FROM (${processos}) p
        WHERE p.status = 'ATIVO'
          AND NOT EXISTS (
            SELECT 1 FROM public.farmacia_tratamentos_pacientes tp
            WHERE tp.paciente_pasta = p.numero_pasta AND tp.ativo = true)`),
    ]);

    const c = cards[0] || {};
    const est = estoqueCards[0] || {};
    const fin = financeiro[0] || {};

    return {
      success: true,
      indicadores: {
        processos: Number(c.total || 0),
        ativos: Number(c.ativos || 0),
        inativos: Number(c.inativos || 0),
        dispensacoes: Number(c.dispensacoes || 0),
        itensDispensados: Number(c.itens || 0),
        valorCompras: String(fin.total ?? "0"),
        lotesComprados: Number(fin.lotes || 0),
        lotesComValor: Number(fin.com_valor || 0),
        valorEstoque: String(valorEstoque[0]?.valor ?? "0"),
        lotesValorizados: Number(valorEstoque[0]?.lotes || 0),
        medicamentosEstoque: Number(est.cadastrados || 0),
        medicamentosZerados: Number(est.zerados || 0),
        unidadesDisponiveis: Number(est.unidades || 0),
      },
      dispensacoes: {
        porMedicamento: porMedicamento.map((r) => ({
          nome: `${r.nome}${r.dosagem ? ` — ${r.dosagem}` : ""}`,
          tipo: r.tipo,
          quantidade: Number(r.quantidade || 0),
          entregas: Number(r.entregas || 0),
        })),
        evolucao: evolucao.map((r) => ({
          mes: r.mes,
          quantidade: Number(r.quantidade || 0),
          itens: Number(r.itens || 0),
        })),
      },
      vinculados: vinculados.map((r) => ({
        nome: `${r.nome}${r.dosagem ? ` — ${r.dosagem}` : ""}`,
        quantidade: Number(r.quantidade || 0),
      })),
      estoque: {
        saidas: saidas
          .map((r) => ({
            nome: `${r.nome}${r.dosagem ? ` — ${r.dosagem}` : ""}`,
            quantidade: Number(r.quantidade || 0),
          }))
          .filter((r) => r.quantidade > 0),
        vencimento: proximosVencimento.map((r) => ({
          nome: `${r.nome}${r.dosagem ? ` — ${r.dosagem}` : ""}`,
          lote: r.numero_lote,
          validade: r.validade,
          saldo: Number(r.saldo || 0),
        })),
      },
      financeiro: {
        comprasMes: comprasMes.map((r) => ({
          mes: r.mes,
          valor: String(r.valor),
          lotes: Number(r.lotes || 0),
        })),
        porMedicamento: comprasMedicamento.map((r) => ({
          nome: `${r.nome}${r.dosagem ? ` — ${r.dosagem}` : ""}`,
          valor: String(r.valor),
          lotes: Number(r.lotes || 0),
        })),
      },
      insights: montarInsights({
        indicadores: {
          processos: Number(c.total || 0),
          ativos: Number(c.ativos || 0),
          dispensacoes: Number(c.dispensacoes || 0),
          zerados: Number(est.zerados || 0),
          semVinculo: Number(insightsBase[0]?.sem_vinculo || 0),
        },
        vinculados,
        porMedicamento,
        comprasMedicamento,
        evolucao,
        saldos: estoqueCards,
      }),
    };
  } catch (erro) {
    return responder(erro);
  }
}

const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const rotuloMesLongo = (mes) => {
  const [ano, m] = String(mes || "").split("-");
  return `${MESES_LONGOS[Number(m) - 1] || m}/${ano}`;
};

// Insights determinísticos — frases curtas com números reais.
function montarInsights({ indicadores, vinculados, porMedicamento, comprasMedicamento, evolucao, saldos }) {
  const frases = [];
  const nf = (n) => Number(n || 0).toLocaleString("pt-BR");
  const brl = (v) =>
    `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const topVinculo = vinculados[0];
  if (topVinculo) {
    frases.push(
      `O medicamento ${topVinculo.nome} está vinculado a ${nf(topVinculo.quantidade)} ${topVinculo.quantidade === 1 ? "processo ativo" : "processos ativos"}.`,
    );
  }

  const topDisp = porMedicamento[0];
  if (topDisp) {
    frases.push(
      `O medicamento ${topDisp.nome} teve o maior volume dispensado: ${nf(topDisp.quantidade)} ${topDisp.quantidade === 1 ? "unidade" : "unidades"} em ${nf(topDisp.entregas)} ${topDisp.entregas === 1 ? "entrega" : "entregas"}.`,
    );
  }

  if (indicadores.zerados > 0) {
    frases.push(
      `${nf(indicadores.zerados)} ${indicadores.zerados === 1 ? "medicamento está com saldo zerado" : "medicamentos estão com saldo zerado"} no estoque consolidado.`,
    );
  }

  if (evolucao.length >= 2) {
    const atual = evolucao[evolucao.length - 1];
    const anterior = evolucao[evolucao.length - 2];
    if (anterior.quantidade > 0) {
      const variacao = Math.round(((atual.quantidade - anterior.quantidade) / anterior.quantidade) * 100);
      frases.push(
        `Dispensações em ${rotuloMesLongo(atual.mes)}: ${nf(atual.quantidade)}, ${variacao >= 0 ? `aumento de ${variacao}%` : `redução de ${Math.abs(variacao)}%`} sobre ${rotuloMesLongo(anterior.mes)} (${nf(anterior.quantidade)}).`,
      );
    } else {
      frases.push(
        `Dispensações em ${rotuloMesLongo(atual.mes)}: ${nf(atual.quantidade)}; em ${rotuloMesLongo(anterior.mes)} não houve dispensação.`,
      );
    }
  }

  const topCompra = comprasMedicamento[0];
  if (topCompra && Number(topCompra.valor) > 0) {
    frases.push(
      `O medicamento com maior valor de compras é ${topCompra.nome}: ${brl(topCompra.valor)} em ${nf(topCompra.lotes)} ${topCompra.lotes === 1 ? "lote" : "lotes"}.`,
    );
  }

  if (indicadores.semVinculo > 0) {
    frases.push(
      `${nf(indicadores.semVinculo)} ${indicadores.semVinculo === 1 ? "processo ativo não possui" : "processos ativos não possuem"} medicamento vinculado.`,
    );
  }

  return frases;
}
