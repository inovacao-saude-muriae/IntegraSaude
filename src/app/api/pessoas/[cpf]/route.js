import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoPessoas } from "@/lib/auth";

/**
 * GET /api/pessoas/[cpf]
 * Get a single pessoa by CPF
 */
export async function GET(req, { params }) {
  try {
    await requireAcessoPessoas();

    const { cpf } = await params;

    if (!cpf) {
      return NextResponse.json(
        { success: false, error: "CPF é obrigatório" },
        { status: 400 }
      );
    }

    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf },
      include: {
        enderecos: {
          where: { enderecoAtual: true },
          take: 1,
        },
        ubsReferencia: {
          select: {
            id: true,
            nome: true,
            cnes: true,
          },
        },
      },
    });

    // Cadastro absorvido por unificação não é usado em novos registros.
    if (!pessoa || !pessoa.ativo) {
      return NextResponse.json(
        { success: false, error: "Pessoa não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: pessoa });
  } catch (error) {
    console.error("[GET /api/pessoas/[cpf]]", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar pessoa" },
      { status }
    );
  }
}
