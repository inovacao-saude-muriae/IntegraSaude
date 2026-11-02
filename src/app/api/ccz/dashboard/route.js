import { NextResponse } from "next/server";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    // Get data for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Procedures evolution over time
    const procedimentos = await prisma.cadastroProcedimento.findMany({
      where: {
        dataProcedimento: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        dataProcedimento: true,
        tipo: true,
      },
    });

    // Group by month and procedure type
    const evolutionMap = {};
    procedimentos.forEach((p) => {
      const date = new Date(p.dataProcedimento);
      const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (!evolutionMap[mes]) {
        evolutionMap[mes] = { mes, castracao: 0, vacinacao: 0, consulta: 0 };
      }
      
      const tipo = (p.tipo || "").toLowerCase();
      if (tipo.includes("castra")) evolutionMap[mes].castracao++;
      else if (tipo.includes("vacina")) evolutionMap[mes].vacinacao++;
      else if (tipo.includes("consulta")) evolutionMap[mes].consulta++;
    });

    const evolution = Object.values(evolutionMap).sort((a, b) => a.mes.localeCompare(b.mes));

    // Procedure types distribution
    const procedureTypeCounts = await prisma.cadastroProcedimento.groupBy({
      by: ["tipo"],
      _count: {
        id: true,
      },
      where: {
        dataProcedimento: {
          gte: sixMonthsAgo,
        },
      },
    });

    const procedureTypes = procedureTypeCounts.map((p) => ({
      tipo: p.tipo || "Outros",
      total: p._count.id,
    }));

    // Animals by species
    const speciesCounts = await prisma.animal.groupBy({
      by: ["especie"],
      _count: {
        id: true,
      },
    });

    const animals = speciesCounts.map((s) => ({
      especie: s.especie || "Outro",
      total: s._count.id,
    }));

    return NextResponse.json({
      success: true,
      data: {
        evolution,
        procedureTypes,
        animals,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard CCZ:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar dados do dashboard CCZ" },
      { status: 500 }
    );
  }
}
