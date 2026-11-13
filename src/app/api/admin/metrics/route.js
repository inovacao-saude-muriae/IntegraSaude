import { NextResponse } from "next/server";
import { requireAdminDeAlgumModulo, registrarNegativaDePainel } from "@/lib/auth";
import {
  MODULOS,
  usuarioEhAdminModulo,
  usuarioTemPermissao,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════════════
// /api/admin/metrics — indicadores consolidados do Dashboard Gerencial
// ─────────────────────────────────────────────────────────────────────────
// REGRA DE ACESSO (Bloco 2): nível ADMIN em um módulo NÃO dá acesso aos dados
// dos outros módulos. Cada bloco da resposta é liberado por uma permissão
// própria:
//
//   • GESTOR            → vê todos os blocos (inclusive usuários e auditoria);
//   • REGULACAO/ADMIN   → bloco `regulacao`;
//   • FARMACIA/ADMIN    → bloco `farmacia`;
//   • JUNTA/ADMIN       → bloco `junta`;
//   • CCZ/ADMIN         → bloco `ccz`;
//   • PROCESSOS/ADMIN   → bloco `processos`.
//
// O bloco `pessoas` (total do cadastro único) acompanha qualquer bloco liberado.
// O que o usuário não pode ver vem como `null` — e a consulta nem é executada,
// então nenhum dado sai do banco para quem não tem permissão.
// Usuários/auditoria/atividade recente são exclusivos do GESTOR.
// ═══════════════════════════════════════════════════════════════════════════

// Converte valores BigInt (retornados por COUNT/SUM no Postgres) em Number.
function toNumber(value) {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

export async function GET() {
  try {
    // Barreira de entrada: sessão válida + ADMIN de algum módulo, OU quem tem
    // permissão de painel da Gestão Geral.
    // `opcional`: a barreira NÃO audita aqui — a negativa desta rota é
    // registrada UMA vez logo abaixo, com o recurso do painel, para que a
    // tentativa não fique sem rastro nem duplicada.
    let user;
    try {
      user = await requireAdminDeAlgumModulo({ opcional: true });
    } catch (erro) {
      if (erro?.status === 401 || erro?.status === 403) {
        await registrarNegativaDePainel();
      }
      throw erro;
    }

    // ── Escopo do usuário ────────────────────────────────────────────────
    // Cada bloco abre pela permissão do SEU módulo. Gestão Geral não abre nada
    // por si: para ver o bloco de um módulo é preciso o vínculo daquele módulo
    // (o gestor tem os 6 vínculos explícitos, então continua vendo tudo — mas
    // porque os vínculos existem, não porque é gestor).
    const pode = {
      regulacao: await usuarioEhAdminModulo(user, MODULOS.REGULACAO),
      farmacia: await usuarioEhAdminModulo(user, MODULOS.FARMACIA),
      junta: await usuarioEhAdminModulo(user, MODULOS.JUNTA),
      ccz: await usuarioEhAdminModulo(user, MODULOS.CCZ),
      processos: await usuarioEhAdminModulo(user, MODULOS.PROCESSOS),
      usuarios: await usuarioTemPermissao(user, MODULOS.GESTAO, "painel", "visualizar"),
    };

    const agora = new Date();
    const em30Dias = new Date();
    em30Dias.setDate(em30Dias.getDate() + 30);

    const vazio = Promise.resolve(null);

    // ── Consultas, uma por bloco (só executam quando autorizadas) ────────
    const [
      totalPessoas,
      pedidosPorStatus,
      pedidosPorRisco,
      pacientesFarmaciaPorStatus,
      medicamentosAtivos,
      estoque,
      lotesAVencer,
      totalPacientesJunta,
      totalAtendimentosJunta,
      totalAnimais,
      totalDenunciasAbertas,
      usuariosPorPerfil,
      totalUsuariosAtivos,
      valorAutorizadoAgg,
      liberadosSemRegulador,
      liberadosSemCompetencia,
      urgenciasNaFila,
      tempoMedioAgg,
      ultimosPedidos,
      ultimasDispensacoes,
    ] = await Promise.all([
      prisma.pessoa.count({ where: { ativo: true } }),

      // Regulação
      pode.regulacao
        ? prisma.pedidoExame.groupBy({ by: ["status"], _count: { _all: true } })
        : vazio,
      pode.regulacao
        ? prisma.pedidoExame.groupBy({
            by: ["classificacaoRisco"],
            _count: { _all: true },
          })
        : vazio,

      // Farmácia Judicial
      pode.farmacia
        ? prisma.pacienteFarmaciaJudicial.groupBy({
            by: ["status"],
            _count: { _all: true },
          })
        : vazio,
      pode.farmacia
        ? prisma.medicamento.count({ where: { ativo: true } })
        : vazio,
      pode.farmacia
        ? prisma.$queryRaw`
            SELECT COALESCE(SUM(lm.qtd_inicial - COALESCE(sub.total_entregue, 0)), 0)::integer AS total
            FROM public.farmacia_lotes_medicamentos lm
            LEFT JOIN (
              SELECT lote_medicamento_id, SUM(qtd_entregue) AS total_entregue
              FROM public.farmacia_dispensacoes_medicamentos
              GROUP BY lote_medicamento_id
            ) sub ON lm.id = sub.lote_medicamento_id
          `
        : vazio,
      pode.farmacia
        ? prisma.loteMedicamento.findMany({
            where: { dataValidade: { gte: agora, lte: em30Dias } },
            orderBy: { dataValidade: "asc" },
            take: 5,
            select: {
              id: true,
              numeroLote: true,
              dataValidade: true,
              medicamento: { select: { nome: true, dosagem: true } },
            },
          })
        : vazio,

      // Junta Reguladora
      pode.junta ? prisma.pacienteJunta.count() : vazio,
      pode.junta ? prisma.juntaAtendimento.count() : vazio,

      // CCZ
      pode.ccz ? prisma.animal.count() : vazio,
      pode.ccz ? prisma.denunciaCaoAgressivo.count() : vazio,

      // Usuários (permissão da Gestão Geral). A contagem é por MÓDULO × PERFIL
      // dos vínculos — `users.role` deixou de existir.
      pode.usuarios
        ? prisma.userAcesso.groupBy({
            by: ["modulo", "perfil"],
            where: { ativo: true },
            _count: { _all: true },
          })
        : vazio,
      pode.usuarios ? prisma.user.count({ where: { ativo: true } }) : vazio,

      // Auditoria da Regulação (bloco da Regulação)
      pode.regulacao
        ? prisma.$queryRaw`
            SELECT COALESCE(SUM(pr.valor), 0)::numeric AS total
            FROM public.regula_pedidos_exames pe
            JOIN public.regula_procedimentos pr ON pr.id = pe.procedimento_id
            WHERE pe.status = 'Liberado'
          `
        : vazio,
      pode.regulacao
        ? prisma.pedidoExame.count({
            where: { status: "Liberado", medicoResponsavelId: null },
          })
        : vazio,
      pode.regulacao
        ? prisma.pedidoExame.count({
            where: { status: "Liberado", competenciaCota: null },
          })
        : vazio,
      pode.regulacao
        ? prisma.pedidoExame.count({
            where: { status: "Aguardando", classificacaoRisco: "Vermelho" },
          })
        : vazio,
      pode.regulacao
        ? prisma.$queryRaw`
            SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (pe.data_liberacao - pe.data_solicitacao)) / 86400), 0)::numeric AS media
            FROM public.regula_pedidos_exames pe
            WHERE pe.status = 'Liberado'
              AND pe.data_liberacao IS NOT NULL
              AND pe.data_solicitacao IS NOT NULL
          `
        : vazio,

      // Atividade recente (só GESTOR)
      pode.usuarios
        ? prisma.pedidoExame.findMany({
            take: 6,
            orderBy: { dataSolicitacao: "desc" },
            select: {
              id: true,
              status: true,
              dataSolicitacao: true,
              pessoa: { select: { nomeCompleto: true } },
              procedimento: { select: { nome: true } },
            },
          })
        : vazio,
      pode.usuarios
        ? prisma.dispensacaoMedicamento.findMany({
            take: 6,
            orderBy: { dataDispensacao: "desc" },
            select: {
              id: true,
              qtdEntregue: true,
              dataDispensacao: true,
              lote: { select: { medicamento: { select: { nome: true } } } },
            },
          })
        : vazio,
    ]);

    // ── Regulação ────────────────────────────────────────────────────────
    let regulacao = null;
    if (pode.regulacao) {
      const status = { aguardando: 0, liberados: 0, outros: 0, total: 0 };
      (pedidosPorStatus || []).forEach((row) => {
        const qtd = toNumber(row._count._all);
        status.total += qtd;
        const st = (row.status || "").toLowerCase();
        if (st === "aguardando") status.aguardando += qtd;
        else if (st === "liberado") status.liberados += qtd;
        else status.outros += qtd;
      });

      const risco = (pedidosPorRisco || [])
        .map((row) => ({
          classificacao: row.classificacaoRisco || "Não classificado",
          total: toNumber(row._count._all),
        }))
        .sort((a, b) => b.total - a.total);

      regulacao = { ...status, risco };
    }

    // ── Farmácia Judicial ────────────────────────────────────────────────
    let farmacia = null;
    if (pode.farmacia) {
      const contagem = { ativos: 0, inativos: 0, obitos: 0, total: 0 };
      (pacientesFarmaciaPorStatus || []).forEach((row) => {
        const qtd = toNumber(row._count._all);
        contagem.total += qtd;
        const st = (row.status || "").toUpperCase();
        if (st === "ATIVO") contagem.ativos += qtd;
        else if (st === "INATIVO") contagem.inativos += qtd;
        else if (st === "ÓBITO" || st === "OBITO") contagem.obitos += qtd;
      });

      farmacia = {
        ...contagem,
        medicamentosAtivos,
        estoqueUnidades: toNumber(estoque?.[0]?.total),
        lotesAVencer: (lotesAVencer || []).map((lote) => ({
          id: lote.id,
          numeroLote: lote.numeroLote,
          medicamento: `${lote.medicamento?.nome || "Medicamento"} ${lote.medicamento?.dosagem || ""}`.trim(),
          dataValidade: lote.dataValidade,
        })),
      };
    }

    // ── Usuários / Acesso (só GESTOR) ────────────────────────────────────
    let usuarios = null;
    if (pode.usuarios) {
      const porPerfil = (usuariosPorPerfil || [])
        .map((row) => ({
          modulo: row.modulo,
          perfil: row.perfil,
          total: toNumber(row._count._all),
        }))
        .sort((a, b) => b.total - a.total);
      const totalUsuarios = porPerfil.reduce((s, u) => s + u.total, 0);
      usuarios = {
        total: totalUsuarios,
        ativos: toNumber(totalUsuariosAtivos),
        inativos: totalUsuarios - toNumber(totalUsuariosAtivos),
        porPerfil,
      };
    }

    // ── Auditoria — pontos de atenção (Regulação) ────────────────────────
    let auditoria = null;
    if (pode.regulacao) {
      const alertas = [
        { label: "Liberados sem médico regulador", valor: toNumber(liberadosSemRegulador) },
        { label: "Liberados sem competência de cota", valor: toNumber(liberadosSemCompetencia) },
        { label: "Urgências (Vermelho) na fila", valor: toNumber(urgenciasNaFila) },
      ];
      auditoria = {
        valorAutorizado: toNumber(valorAutorizadoAgg?.[0]?.total),
        tempoMedioEspera: Math.round(toNumber(tempoMedioAgg?.[0]?.media)),
        taxaLiberacao:
          regulacao && regulacao.total > 0
            ? (regulacao.liberados / regulacao.total) * 100
            : 0,
        alertas,
        totalAlertas: alertas.reduce((s, a) => s + a.valor, 0),
      };
    }

    // ── Atividade recente (só GESTOR) ────────────────────────────────────
    const atividadeRecente = pode.usuarios
      ? [
          ...(ultimosPedidos || []).map((p) => ({
            id: `pedido-${p.id}`,
            modulo: "Regulação",
            descricao: `${p.pessoa?.nomeCompleto || "Paciente"} — ${p.procedimento?.nome || "Procedimento"} (${p.status})`,
            data: p.dataSolicitacao,
          })),
          ...(ultimasDispensacoes || []).map((d) => ({
            id: `dispensacao-${d.id}`,
            modulo: "Farmácia Judicial",
            descricao: `${d.lote?.medicamento?.nome || "Medicamento"} — ${d.qtdEntregue} unidade(s) dispensada(s)`,
            data: d.dataDispensacao,
          })),
        ]
          .filter((item) => item.data)
          .sort((a, b) => new Date(b.data) - new Date(a.data))
          .slice(0, 8)
      : [];

    return NextResponse.json({
      geradoEm: agora.toISOString(),
      // Blocos não autorizados vão como null (nada é consultado para eles).
      pessoas: { total: totalPessoas },
      regulacao,
      farmacia,
      junta: pode.junta
        ? { pacientes: totalPacientesJunta, atendimentos: totalAtendimentosJunta }
        : null,
      ccz: pode.ccz
        ? { animais: totalAnimais, denuncias: totalDenunciasAbertas }
        : null,
      processos: pode.processos ? {} : null,
      usuarios,
      auditoria,
      atividadeRecente,
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
