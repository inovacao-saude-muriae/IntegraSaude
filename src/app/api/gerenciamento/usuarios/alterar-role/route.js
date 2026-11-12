import { NextResponse } from 'next/server';
import { registrarAuditoria } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { mapearRoleParaAcessos } from '@/lib/roleAcessos';
import { requireGestor } from '@/lib/auth';
import { ROLES_VALIDAS, GestorGuardError, validarAlteracaoGestor } from '@/lib/gestorGuard';

// Os vínculos padrão do perfil vêm de lib/roleAcessos (fonte única).
export async function PUT(request) {
  try {
    const gestor = await requireGestor();
    const { cpf, novoRole, novoCargo } = await request.json();

    if (!cpf || !novoRole) {
      return NextResponse.json(
        { error: 'CPF e novo perfil são obrigatórios' },
        { status: 400 }
      );
    }

    if (!ROLES_VALIDAS.includes(novoRole)) {
      return NextResponse.json({ error: 'Perfil informado é inválido.' }, { status: 400 });
    }

    const novosAcessos = mapearRoleParaAcessos(novoRole);

    // Guarda + update do usuário + troca de acessos na MESMA transação (atômico).
    const usuarioExistente = await prisma.$transaction(async (tx) => {
      const alvo = await validarAlteracaoGestor(tx, {
        executorCpf: gestor.cpf,
        alvoCpf: cpf,
        novoRole,
      });

      await tx.user.update({
        where: { cpf },
        data: {
          role: novoRole,
          cargo: novoCargo,
        },
      });

      await tx.userAcesso.deleteMany({
        where: { userCpf: cpf },
      });

      if (novosAcessos.length > 0) {
        await tx.userAcesso.createMany({
          data: novosAcessos.map((acesso) => ({
            userCpf: cpf,
            ...acesso,
          })),
        });
      }

      return alvo;
    });
    // Usuario autenticado (gestor) que executou a acao fica registrado na auditoria.
    await registrarAuditoria({
      user: gestor,
      acao: 'EDITAR',
      modulo: 'GERENCIAMENTO',
      entidade: 'Usuario',
      entidadeId: String(cpf),
      descricao: `Perfil/acessos do usuário '${usuarioExistente.nome}' alterados`,
      detalhes: {
        roleAnterior: usuarioExistente.role,
        roleNovo: novoRole,
        acessos: novosAcessos
          .map((a) => `${a.modulo}:${a.nivel}${a.servicoJunta ? `:${a.servicoJunta}` : ''}`)
          .join(', '),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Nível de acesso alterado com sucesso',
    });
  } catch (error) {
    if (error instanceof GestorGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if ([401, 403].includes(error?.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API /alterar-role] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao alterar nível de acesso' },
      { status: 500 }
    );
  }
}
