import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { carregarContextoAcesso } from "@/lib/permissions";

export async function GET() {
  try {
    const ctx = await carregarContextoAcesso();
    if (!ctx) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    const ubs = await prisma.uBS.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
      },
    });

    return NextResponse.json(ubs);
  } catch (error) {
    console.error("Erro ao buscar UBS:", error);
    
    return NextResponse.json(
      { error: "Erro ao buscar UBS" },
      { status: 500 }
    );
  }
}
