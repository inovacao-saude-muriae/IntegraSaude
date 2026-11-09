import { NextResponse } from "next/server";
import { requireAdminDeAlgumModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Refinamento #6 (RBAC Etapa 1): o antigo array ROLES_GERENCIAIS continha
// apenas papéis admin (GESTOR, REGULACAO_ADMIN, JUNTA_ADMIN, FARMACIA_ADMIN,
// PROCESSO_ADMIN, CCZ_ADMIN — sem REGULACAO_COMUM). Verificado antes da troca:
// requireAdminDeAlgumModulo() (GESTOR ∨ admin de qualquer módulo) preserva
// exatamente o acesso atual, sem ampliar nem reduzir.

// Converte valores BigInt (retornados por COUNT/SUM no Postgres) em Number.
function toNumber(value) {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

export async function GET() {
  try {
    await requireAdminDeAlgumModulo();

    const agora = new Date();
    const em30Dias = new Date();
    em30Dias.setDate(em30Dias.getDate() + 30);

    const [
      totalPessoas,
      // Regulação
      pedidosPorStatus,
      pedidosPorRisco,
      // Farmácia Judicial
      pacientesFarmaciaPorStatus,
      medicamentosAtivos,
      estoque,
      lotesAVencer,
      // Junta Reguladora
      totalPacientesJunta,
      totalAtendimentosJunta,
      // Usuários / acesso
      usuariosPorPerfil,
      totalUsuariosAtivos,
      // Auditoria — Regulação
      valorAutorizadoAgg,
      liberadosSemRegulador,
      liberadosSemCompetencia,
      urgenciasNaFila,
      tempoMedioAgg,
      // Atividade recente
      ultimosPedidos,
      ultimasDispensacoes,
    ] = await Promise.all([
      prisma.pessoa.count({ where: { ativo: true } }),

      prisma.pedidoExame.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.pedidoExame.groupBy({
        by: ["classificacaoRisco"],
        _count: { _all: true },
      }),

      prisma.pacienteFarmaciaJudicial.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.medicamento.count({ where: { ativo: true } }),
      // Estoque = soma das entradas - soma das dispensações.
      prisma.$queryRaw`
        SELECT COALESCE(SUM(lm.qtd_inicial - COALESCE(sub.total_entregue, 0)), 0)::integer AS total
        FROM public.farmacia_lotes_medicamentos lm
        LEFT JOIN (
          SELECT lote_medicamento_id, SUM(qtd_entregue) AS total_entregue
          FROM public.farmacia_dispensacoes_medicamentos
          GROUP BY lote_medicamento_id
        ) sub ON lm.id = sub.lote_medicamento_id
      `,
      prisma.loteMedicamento.findMany({
        where: { dataValidade: { gte: agora, lte: em30Dias } },
        orderBy: { dataValidade: "asc" },
        take: 5,
        select: {
          id: true,
          numeroLote: true,
          dataValidade: true,
          medicamento: { select: { nome: true, dosagem: true } },
        },
      }),

      prisma.pacienteJunta.count(),
      prisma.juntaAtendimento.count(),

      // Usuários por perfil e ativos
      prisma.user.groupBy({
        by: ["role"],
        _count: { _all: true },
      }),
      prisma.user.count({ where: { ativo: true } }),

      // Auditoria — Regulação
      // Valor total autorizado (soma do valor do procedimento dos liberados).
      prisma.$queryRaw`
        SELECT COALESCE(SUM(pr.valor), 0)::numeric AS total
        FROM public.regula_pedidos_exames pe
        JOIN public.regula_procedimentos pr ON pr.id = pe.procedimento_id
        WHERE pe.status = 'Liberado'
      `,
      prisma.pedidoExame.count({
        where: { status: "Liberado", medicoResponsavelId: null },
      }),
      prisma.pedidoExame.count({
        where: { status: "Liberado", competenciaCota: null },
      }),
      prisma.pedidoExame.count({
        where: { status: "Aguardando", classificacaoRisco: "Vermelho" },
      }),
      // Tempo médio de espera (dias) entre solicitação e liberação dos liberados.
      prisma.$queryRaw`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (pe.data_liberacao - pe.data_solicitacao)) / 86400), 0)::numeric AS media
        FROM public.regula_pedidos_exames pe
        WHERE pe.status = 'Liberado'
          AND pe.data_liberacao IS NOT NULL
          AND pe.data_solicitacao IS NOT NULL
      `,

      prisma.pedidoExame.findMany({
        take: 6,
        orderBy: { dataSolicitacao: "desc" },
        select: {
          id: true,
          status: true,
          dataSolicitacao: true,
          pessoa: { select: { nomeCompleto: true } },
          procedimento: { select: { nome: true } },
        },
      }),
      prisma.dispensacaoMedicamento.findMany({
        take: 6,
        orderBy: { dataDispensacao: "desc" },
        select: {
          id: true,
          qtdEntregue: true,
          dataDispensacao: true,
          lote: { select: { medicamento: { select: { nome: true } } } },
        },
      }),
    ]);

    // ── Regulação ────────────────────────────────────────────────────────
    const regulacaoStatus = { aguardando: 0, liberados: 0, outros: 0, total: 0 };
    pedidosPorStatus.forEach((row) => {
      const qtd = toNumber(row._count._all);
      regulacaoStatus.total += qtd;
      const st = (row.status || "").toLowerCase();
      if (st === "aguardando") regulacaoStatus.aguardando += qtd;
      else if (st === "liberado") regulacaoStatus.liberados += qtd;
      else regulacaoStatus.outros += qtd;
    });

    const risco = pedidosPorRisco
      .map((row) => ({
        classificacao: row.classificacaoRisco || "Não classificado",
        total: toNumber(row._count._all),
      }))
      .sort((a, b) => b.total - a.total);

    // ── Farmácia Judicial ────────────────────────────────────────────────
    const farmacia = { ativos: 0, inativos: 0, obitos: 0, total: 0 };
    pacientesFarmaciaPorStatus.forEach((row) => {
      const qtd = toNumber(row._count._all);
      farmacia.total += qtd;
      const st = (row.status || "").toUpperCase();
      if (st === "ATIVO") farmacia.ativos += qtd;
      else if (st === "INATIVO") farmacia.inativos += qtd;
      else if (st === "ÓBITO" || st === "OBITO") farmacia.obitos += qtd;
    });

    // ── Usuários / Acesso ─────────────────────────────────────────────────
    const usuariosPerfil = usuariosPorPerfil
      .map((row) => ({ role: row.role, total: toNumber(row._count._all) }))
      .sort((a, b) => b.total - a.total);
    const totalUsuarios = usuariosPerfil.reduce((s, u) => s + u.total, 0);

    // ── Auditoria — pontos de atenção ─────────────────────────────────────
    const valorAutorizado = toNumber(valorAutorizadoAgg?.[0]?.total);
    const alertasAuditoria = [
      { label: "Liberados sem médico regulador", valor: toNumber(liberadosSemRegulador) },
      { label: "Liberados sem competência de cota", valor: toNumber(liberadosSemCompetencia) },
      { label: "Urgências (Vermelho) na fila", valor: toNumber(urgenciasNaFila) },
    ];

    return NextResponse.json({
      geradoEm: agora.toISOString(),
      pessoas: { total: totalPessoas },
      regulacao: {
        ...regulacaoStatus,
        risco,
      },
      farmacia: {
        ...farmacia,
        medicamentosAtivos,
        estoqueUnidades: toNumber(estoque?.[0]?.total),
        lotesAVencer: lotesAVencer.map((lote) => ({
          id: lote.id,
          numeroLote: lote.numeroLote,
          medicamento: `${lote.medicamento?.nome || "Medicamento"} ${lote.medicamento?.dosagem || ""}`.trim(),
          dataValidade: lote.dataValidade,
        })),
      },
      junta: {
        pacientes: totalPacientesJunta,
        atendimentos: totalAtendimentosJunta,
      },
      usuarios: {
        total: totalUsuarios,
        ativos: toNumber(totalUsuariosAtivos),
        inativos: totalUsuarios - toNumber(totalUsuariosAtivos),
        porPerfil: usuariosPerfil,
      },
      auditoria: {
        valorAutorizado,
        tempoMedioEspera: Math.round(toNumber(tempoMedioAgg?.[0]?.media)),
        taxaLiberacao: regulacaoStatus.total > 0
          ? (regulacaoStatus.liberados / regulacaoStatus.total) * 100
          : 0,
        alertas: alertasAuditoria,
        totalAlertas: alertasAuditoria.reduce((s, a) => s + a.valor, 0),
      },
      atividadeRecente: [
        ...ultimosPedidos.map((p) => ({
          id: `pedido-${p.id}`,
          modulo: "Regulação",
          descricao: `${p.pessoa?.nomeCompleto || "Paciente"} — ${p.procedimento?.nome || "Procedimento"} (${p.status})`,
          data: p.dataSolicitacao,
        })),
        ...ultimasDispensacoes.map((d) => ({
          id: `dispensacao-${d.id}`,
          modulo: "Farmácia Judicial",
          descricao: `${d.lote?.medicamento?.nome || "Medicamento"} — ${d.qtdEntregue} unidade(s) dispensada(s)`,
          data: d.dataDispensacao,
        })),
      ]
        .filter((item) => item.data)
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 8),
    });
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao carregar métricas gerenciais:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar métricas." },
      { status: 500 },
    );
  }
}
