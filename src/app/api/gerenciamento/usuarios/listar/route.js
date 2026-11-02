import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function GET() {
  try {
    const usuarios = await prisma.user.findMany({
      select: {
        cpf: true,
        username: true,
        nome: true,
        cargo: true,
        role: true,
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
    console.error('[API /gerenciamento/usuarios/listar] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao listar usuários' },
      { status: 500 }
    );
  }
}
