import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export async function GET() {
  try {
    await requireAcessoModulo(MODULOS.JUNTA);

    // Total de pacientes cadastrados
    const totalPacientes = await prisma.pacienteJunta.count();

    // Total de atendimentos realizados
    const totalAtendimentos = await prisma.juntaAtendimento.count();

    // Total de agendamentos futuros
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const totalAgendamentos = await prisma.agendamentoJunta.count({
      where: {
        data: { gte: hoje },
      },
    });

    // Pacientes por serviço
    const pacientesPorServicoRaw = await prisma.pacienteJuntaServico.groupBy({
      by: ["servicoId"],
      where: { ativo: true },
      _count: { pacienteJuntaId: true },
    });

    const servicoIds = pacientesPorServicoRaw.map(item => item.servicoId);
    const servicos = await prisma.servico.findMany({
      where: { id: { in: servicoIds } },
      select: { id: true, nome: true },
    });

    const pacientesPorServico = pacientesPorServicoRaw
      .map(item => {
        const servico = servicos.find(s => s.id === item.servicoId);
        return {
          servico: servico?.nome || "Desconhecido",
          total: item._count.pacienteJuntaId,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Atendimentos por serviço
    const atendimentosPorServicoRaw = await prisma.juntaAtendimento.groupBy({
      by: ["servicoId"],
      _count: { id: true },
    });

    const servicoIdsAtend = atendimentosPorServicoRaw.map(item => item.servicoId).filter(Boolean);
    const servicosAtend = await prisma.servico.findMany({
      where: { id: { in: servicoIdsAtend } },
      select: { id: true, nome: true },
    });

    const atendimentosPorServico = atendimentosPorServicoRaw
      .map(item => {
        const servico = servicosAtend.find(s => s.id === item.servicoId);
        return {
          servico: servico?.nome || "Não informado",
          total: item._count.id,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Atendimentos por mês (últimos 6 meses)
    const dataLimite = new Date();
    dataLimite.setMonth(dataLimite.getMonth() - 6);

    const atendimentos = await prisma.juntaAtendimento.findMany({
      where: {
        dataAtendimento: { gte: dataLimite },
      },
      select: { dataAtendimento: true },
    });

    const atendimentosPorMesMap = {};
    atendimentos.forEach(atend => {
      const data = new Date(atend.dataAtendimento);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      if (!atendimentosPorMesMap[chave]) {
        atendimentosPorMesMap[chave] = 0;
      }
      atendimentosPorMesMap[chave]++;
    });

    // Gerar últimos 6 meses mesmo se não houver dados
    const atendimentosPorMes = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      atendimentosPorMes.push({
        mes: `${MESES[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`,
        total: atendimentosPorMesMap[chave] || 0,
      });
    }

    // Próximos agendamentos (7 dias)
    const dataFim = new Date(hoje);
    dataFim.setDate(dataFim.getDate() + 7);

    const proximosAgendamentosRaw = await prisma.agendamentoJunta.findMany({
      where: {
        data: {
          gte: hoje,
          lte: dataFim,
        },
      },
      include: {
        pacienteJunta: {
          include: {
            pessoa: {
              select: { nomeCompleto: true },
            },
          },
        },
        servico: {
          select: { nome: true },
        },
      },
      orderBy: [
        { data: "asc" },
        { hora: "asc" },
      ],
      take: 10,
    });

    const proximosAgendamentos = proximosAgendamentosRaw.map(ag => {
      const data = new Date(ag.data);
      return {
        data: data.toLocaleDateString("pt-BR"),
        hora: ag.hora || "-",
        paciente: ag.pacienteJunta?.pessoa?.nomeCompleto || "Não informado",
        servico: ag.servico?.nome || "Não informado",
        status: ag.status || "Agendado",
      };
    });

    return NextResponse.json({
      totalPacientes,
      totalAtendimentos,
      totalAgendamentos,
      pacientesPorServico,
      atendimentosPorServico,
      atendimentosPorMes,
      proximosAgendamentos,
    });
  } catch (error) {
    if (error.message?.includes("Acesso negado")) {
      return NextResponse.json(
        { error: "Acesso negado ao módulo Junta Reguladora" },
        { status: 403 }
      );
    }
    console.error("Erro ao buscar dados do dashboard da Junta:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dados do dashboard" },
      { status: 500 }
    );
  }
}
