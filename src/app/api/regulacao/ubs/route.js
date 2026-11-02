import { NextResponse } from "next/server";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.REGULACAO);

    const ubsList = await prisma.ubs.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        cnes: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: ubsList.map((u) => ({
        id: u.id,
        nome: u.nome,
        cnes: u.cnes,
      })),
    });
  } catch (error) {
    console.error("Erro ao buscar UBS:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar UBS" },
      { status: 500 }
    );
  }
}
