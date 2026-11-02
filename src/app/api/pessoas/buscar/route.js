import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { carregarContextoAcesso } from "@/lib/permissions";

const soDigitos = (v) => (v ? v.replace(/\D/g, "") : "");

export async function GET(request) {
  try {
    const ctx = await carregarContextoAcesso();
    if (!ctx) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const termo = searchParams.get("termo") || "";

    if (!termo.trim()) {
      return NextResponse.json([]);
    }

    const termoLimpo = termo.trim();
    const termoDigitos = soDigitos(termoLimpo);

    const where = {
      OR: [
        { nomeCompleto: { contains: termoLimpo, mode: "insensitive" } },
        ...(termoDigitos ? [{ cpf: { contains: termoDigitos } }] : []),
      ],
    };

    const pessoas = await prisma.pessoa.findMany({
      where,
      orderBy: { nomeCompleto: "asc" },
      take: 10,
      select: {
        cpf: true,
        nomeCompleto: true,
        dataNascimento: true,
        telefone: true,
        sexo: true,
        nomeMae: true,
        cns: true,
        ubsReferenciaId: true,
      },
    });

    return NextResponse.json(pessoas);
  } catch (error) {
    console.error("Erro ao buscar pessoas:", error);
    
    return NextResponse.json(
      { error: "Erro ao buscar pessoas" },
      { status: 500 }
    );
  }
}
