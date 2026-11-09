import { NextResponse } from 'next/server';
import { registrarAuditoria } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { requireGestor } from '@/lib/auth';

export async function PUT(request) {
  try {
    const gestor = await requireGestor();
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

    // Usuario autenticado (gestor) que executou a acao fica registrado na auditoria.
    await registrarAuditoria({
      user: gestor,
      acao: 'REATIVAR',
      modulo: 'GERENCIAMENTO',
      entidade: 'Usuario',
      entidadeId: String(cpf),
      descricao: `Usuário '${usuarioExistente.nome}' reativado`,
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário reativado com sucesso',
    });
  } catch (error) {
    if ([401, 403].includes(error?.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API /reativar] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao reativar usuário' },
      { status: 500 }
    );
  }
}
