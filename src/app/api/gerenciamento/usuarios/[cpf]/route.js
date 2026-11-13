import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermissaoGestao } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    await requirePermissaoGestao("usuarios", "visualizar");
    
    const { cpf: cpfParam } = await params;
    const cpf = cpfParam?.replace(/\D/g, '');

    if (!cpf || cpf.length !== 11) {
      return NextResponse.json(
        { error: 'CPF inválido' },
        { status: 400 }
      );
    }

    const usuario = await prisma.user.findUnique({
      where: { cpf },
      select: {
        cpf: true,
        nome: true,
        cargo: true,
        ativo: true,
        primeiroAcesso: true,
        createdAt: true,
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { usuario },
      { status: 200 }
    );
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
