import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUsuarioAutenticado } from "@/lib/auth";

// Lista de UBS para selects (dados de referência, sem dado clínico).
// Exige sessão válida pela fonte única (lib/auth); não é pública.
export async function GET() {
  try {
    try {
      await requireUsuarioAutenticado();
    } catch (e) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: e?.status === 401 ? 401 : 403 }
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
