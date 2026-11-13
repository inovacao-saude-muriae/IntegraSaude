import { NextResponse } from 'next/server';
import { registrarAuditoria } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { requirePermissaoGestao } from '@/lib/auth';
import { GestorGuardError, validarAlteracaoGestor } from '@/lib/gestorGuard';

export async function PUT(request) {
  try {
    const gestor = await requirePermissaoGestao("usuarios", "editar");
    const { cpf } = await request.json();

    if (!cpf) {
      return NextResponse.json(
        { error: 'CPF é obrigatório' },
        { status: 400 }
      );
    }

    // Guarda (não deixar o sistema sem administrador de acessos) + desativação +
    // limpeza de sessões na MESMA transação.
    const usuarioExistente = await prisma.$transaction(async (tx) => {
      const alvo = await validarAlteracaoGestor(tx, {
        executorCpf: gestor.cpf,
        alvoCpf: cpf,
        desativar: true,
      });

      await tx.user.update({
        where: { cpf },
        data: { ativo: false },
      });

      // Remove todas as sessões ativas do usuário
      await tx.session.deleteMany({
        where: { userId: cpf },
      });

      return alvo;
    });
    // Usuario autenticado (gestor) que executou a acao fica registrado na auditoria.
    await registrarAuditoria({
      user: gestor,
      acao: 'DESATIVAR',
      modulo: 'GERENCIAMENTO',
      entidade: 'Usuario',
      entidadeId: String(cpf),
      descricao: `Usuário '${usuarioExistente.nome}' desativado`,
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário desativado com sucesso',
    });
  } catch (error) {
    if (error instanceof GestorGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if ([401, 403].includes(error?.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API /desativar] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao desativar usuário' },
      { status: 500 }
    );
  }
}
