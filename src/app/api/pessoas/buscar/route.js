import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoPessoas } from "@/lib/auth";

/**
 * GET /api/pessoas/buscar?termo=searchTerm
 * Search pessoas by name or CPF (alternative endpoint for legacy code)
 */
export async function GET(req) {
  try {
    await requireAcessoPessoas();

    const { searchParams } = new URL(req.url);
    const termo = searchParams.get("termo");

    if (!termo || termo.trim().length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const searchTerm = termo.trim();
    const where = {
      OR: [
        { nomeCompleto: { contains: searchTerm, mode: "insensitive" } },
        { cpf: { contains: searchTerm } },
      ],
    };

    const pessoas = await prisma.pessoa.findMany({
      where,
      take: 20,
      orderBy: { nomeCompleto: "asc" },
      select: {
        cpf: true,
        nomeCompleto: true,
        dataNascimento: true,
        nomeMae: true,
        telefone: true,
        cns: true,
        sexo: true,
        ubsReferencia: {
          select: {
            id: true,
            nome: true,
            cnes: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, results: pessoas });
  } catch (error) {
    console.error("[GET /api/pessoas/buscar]", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar pessoas" },
      { status }
    );
  }
}
