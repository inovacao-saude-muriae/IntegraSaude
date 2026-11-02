import { NextResponse } from "next/server";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.REGULACAO);

    // Get data for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Evolution chart data (pedidos over time)
    const pedidos = await prisma.pedidoExame.findMany({
      where: {
        dataSolicitacao: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        dataSolicitacao: true,
        status: true,
      },
    });

    // Group by month
    const evolutionMap = {};
    pedidos.forEach((p) => {
      const date = new Date(p.dataSolicitacao);
      const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (!evolutionMap[mes]) {
        evolutionMap[mes] = { mes, total: 0, liberados: 0, aguardando: 0 };
      }
      
      evolutionMap[mes].total++;
      if (p.status === "Liberado") evolutionMap[mes].liberados++;
      if (p.status === "Aguardando") evolutionMap[mes].aguardando++;
    });

    const evolution = Object.values(evolutionMap).sort((a, b) => a.mes.localeCompare(b.mes));

    // Risk classification chart data
    const riskCounts = await prisma.pedidoExame.groupBy({
      by: ["classificacaoRisco"],
      _count: {
        id: true,
      },
      where: {
        dataSolicitacao: {
          gte: sixMonthsAgo,
        },
      },
    });

    const risk = riskCounts.map((r) => ({
      classificacao: r.classificacaoRisco || "Verde",
      total: r._count.id,
    }));

    // Status distribution chart data
    const statusCounts = await prisma.pedidoExame.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
      where: {
        dataSolicitacao: {
          gte: sixMonthsAgo,
        },
      },
    });

    const status = statusCounts.map((s) => ({
      status: s.status,
      total: s._count.id,
    }));

    return NextResponse.json({
      success: true,
      data: {
        evolution,
        risk,
        status,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar dados do dashboard" },
      { status: 500 }
    );
  }
}
