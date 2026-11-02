import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";

export async function GET() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const zoonoses = await prisma.cadastroZoonoses.findMany({
      include: {
        animal: true,
      },
      orderBy: { dataIdentificacao: "desc" },
    });

    return NextResponse.json(zoonoses);
  } catch (error) {
    console.error("Erro ao buscar zoonoses:", error);
    return NextResponse.json(
      { error: "Erro ao buscar zoonoses" },
      { status: 500 }
    );
  }
}
