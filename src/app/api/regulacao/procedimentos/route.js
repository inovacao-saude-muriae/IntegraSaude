import { NextResponse } from "next/server";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.REGULACAO);

    const { searchParams } = new URL(req.url);
    const tipoExameId = searchParams.get("tipoExameId");

    const where = tipoExameId ? { tipoExameId: parseInt(tipoExameId) } : {};

    const procedimentos = await prisma.procedimento.findMany({
      where,
      include: { tipoExame: true },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: procedimentos.map((p) => ({
        id: p.id,
        nome: p.nome,
        valor: Number(p.valor),
        tipoExameId: p.tipoExameId,
        tipoExameNome: p.tipoExame.nome,
      })),
    });
  } catch (error) {
    console.error("Erro ao buscar procedimentos:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar procedimentos" },
      { status: 500 }
    );
  }
}
