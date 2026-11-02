import { NextResponse } from "next/server";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.REGULACAO);

    const tiposExame = await prisma.tipoExame.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: tiposExame.map((t) => ({
        id: t.id,
        nome: t.nome,
      })),
    });
  } catch (error) {
    console.error("Erro ao buscar tipos de exame:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar tipos de exame" },
      { status: 500 }
    );
  }
}
