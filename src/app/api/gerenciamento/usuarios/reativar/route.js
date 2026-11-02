import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function PUT(request) {
  try {
    const { cpf } = await request.json();

    if (!cpf) {
      return NextResponse.json(
        { error: 'CPF é obrigatório' },
        { status: 400 }
      );
    }

    // Verifica se o usuário existe
    const usuarioExistente = await prisma.user.findUnique({
      where: { cpf },
    });

    if (!usuarioExistente) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Reativa o usuário
    await prisma.user.update({
      where: { cpf },
      data: { ativo: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário reativado com sucesso',
    });
  } catch (error) {
    console.error('[API /reativar] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao reativar usuário' },
      { status: 500 }
    );
  }
}
