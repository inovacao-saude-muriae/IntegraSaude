import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

// FILTRO DE ANO (query string ?ano=):
//   • ?ano=2026       -> filtra aquele ano (janela UTC [1º jan, 1º jan seguinte), como no CCZ);
//   • ?ano=todos      -> sem filtro de data (gráfico mensal soma por mês do calendário);
//   • sem parâmetro   -> comportamento anterior (totais gerais; gráfico dos últimos 6 meses).
//
// REGRA DE DATA DE CADA INDICADOR:
//   • Total de Pacientes        -> PacienteJunta.createdAt
//   • Atendimentos Realizados   -> JuntaAtendimento.dataAtendimento
//   • Agendamentos Ativos       -> AgendamentoJunta.data, apenas futuros (data >= hoje)
//                                  dentro do ano
//   • Pacientes por Serviço     -> PacienteJunta.createdAt do paciente vinculado
//   • Atendimentos por Serviço  -> JuntaAtendimento.dataAtendimento
//   • Atendimentos Mensais      -> dataAtendimento, 12 meses do ano (ou últimos 6 meses sem ano)
//   • Serviços Ativos           -> POSIÇÃO ATUAL (não filtra por ano)
//   • Próximos Agendamentos     -> POSIÇÃO ATUAL (próximos 7 dias, não filtra por ano)
export async function GET(request) {
  try {
    await requireAcessoModulo(MODULOS.JUNTA);

    const anoParam = new URL(request.url).searchParams.get("ano");
    const filtrarAno = anoParam !== null && anoParam !== "";
    const ano =
      filtrarAno && anoParam !== "todos"
        ? Number(anoParam) || new Date().getFullYear()
        : null;
    const janela =
      ano !== null
        ? { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) }
        : undefined;

    // Total de pacientes cadastrados
    const totalPacientes = await prisma.pacienteJunta.count({
      where: janela ? { createdAt: janela } : {},
    });

    // Total de atendimentos realizados
    const whereAtend = janela ? { dataAtendimento: janela } : {};
    const totalAtendimentos = await prisma.juntaAtendimento.count({ where: whereAtend });

    // Total de agendamentos futuros (dentro do ano, quando filtrado)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const totalAgendamentos = await prisma.agendamentoJunta.count({
      where: {
        data: janela
          ? { gte: hoje > janela.gte ? hoje : janela.gte, lt: janela.lt }
          : { gte: hoje },
      },
    });

    // Serviços ativos: posição atual (serviços com pacientes vinculados ativos)
    const servicosAtivosRaw = await prisma.pacienteJuntaServico.groupBy({
      by: ["servicoId"],
      where: { ativo: true },
    });
    const totalServicosAtivos = servicosAtivosRaw.length;

    // Pacientes por serviço
    const pacientesPorServicoRaw = await prisma.pacienteJuntaServico.groupBy({
      by: ["servicoId"],
      where: {
        ativo: true,
        ...(janela ? { pacientePacienteJunta: { createdAt: janela } } : {}),
      },
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
      where: whereAtend,
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

    // Atendimentos por mês: com ?ano, 12 meses (do ano, ou de todos os anos
    // somados por mês do calendário); sem parâmetro, últimos 6 meses (legado).
    let atendimentosPorMes = [];

    if (filtrarAno) {
      const atendimentosAno = await prisma.juntaAtendimento.findMany({
        where: whereAtend,
        select: { dataAtendimento: true },
      });
      const porMes = Array.from({ length: 12 }, () => 0);
      atendimentosAno.forEach(atend => {
        porMes[new Date(atend.dataAtendimento).getUTCMonth()]++;
      });
      atendimentosPorMes = MESES.map((mes, i) => ({ mes, total: porMes[i] }));
    } else {
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
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        atendimentosPorMes.push({
          mes: `${MESES[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`,
          total: atendimentosPorMesMap[chave] || 0,
        });
      }
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
      totalServicosAtivos,
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
