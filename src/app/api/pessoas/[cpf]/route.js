import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request, { params }) {
  try {
    const { cpf } = await params;
    const cpfLimpo = cpf?.replace(/\D/g, "");

    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo },
      select: {
        cpf: true,
        nomeCompleto: true,
        telefone: true,
      },
    });

    if (!pessoa) {
      return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ pessoa });
  } catch (error) {
    console.error("Erro ao buscar CPF:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}