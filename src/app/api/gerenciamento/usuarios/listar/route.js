import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermissaoGestao } from '@/lib/auth';

export async function GET() {
  try {
    await requirePermissaoGestao("usuarios", "visualizar");
    const usuarios = await prisma.user.findMany({
      select: {
        cpf: true,
        username: true,
        nome: true,
        cargo: true,
        ativo: true,
        createdAt: true,
        ultimoAcesso: true,
      },
      orderBy: [
        { ativo: 'desc' },
        { nome: 'asc' },
      ],
    });

    return NextResponse.json({ usuarios });
  } catch (error) {
    if ([401, 403].includes(error?.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API /gerenciamento/usuarios/listar] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao listar usuários' },
      { status: 500 }
    );
  }
}
