import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapearRoleParaAcessos } from '@/lib/roleAcessos';
import { requireGestor } from '@/lib/auth';
import { ROLES_VALIDAS, GestorGuardError, validarAlteracaoGestor } from '@/lib/gestorGuard';
import { registrarAuditoria } from '@/lib/audit';
import bcrypt from 'bcryptjs';


export async function POST(request) {
  try {
    const gestor = await requireGestor();
    const body = await request.json();
    const { cpf, nomeCompleto, role, cargo } = body;

    const cpfLimpo = cpf?.replace(/\D/g, '');

    if (!cpfLimpo || cpfLimpo.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido. Forneça 11 dígitos.' }, { status: 400 });
    }

    if (!ROLES_VALIDAS.includes(role)) {
      return NextResponse.json({ error: 'Role informada é inválida.' }, { status: 400 });
    }

    // Senha padrão para todos os novos usuários
    const SENHA_PADRAO = 'Integr@123';
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

    // Mapeia a role para os vínculos de acesso
    const acessos = mapearRoleParaAcessos(role);

    // Somente leitura, usada apenas para distinguir criação/edição/reativação na auditoria.
    const existenteAntes = await prisma.user.findUnique({
      where: { cpf: cpfLimpo },
      select: { ativo: true },
    });

    // Usa transaction para criar usuário + vínculos atomicamente
    const user = await prisma.$transaction(async (tx) => {
      // Autoproteção do Gestor: o upsert pode alterar o role de um usuário existente
      // (inclusive rebaixar o próprio gestor ou o último gestor ativo).
      await validarAlteracaoGestor(tx, {
        executorCpf: gestor.cpf,
        alvoCpf: cpfLimpo,
        novoRole: role,
        alvoObrigatorio: false,
      });

      // Cria/atualiza o usuário
      const user = await tx.user.upsert({
        where: { cpf: cpfLimpo },
        update: {
          nome: nomeCompleto,
          senhaHash,
          role,
          cargo,
          ativo: true,
          primeiroAcesso: true,
        },
        create: {
          cpf: cpfLimpo,
          nome: nomeCompleto || 'Operador do Sistema',
          senhaHash,
          role,
          cargo,
          ativo: true,
          primeiroAcesso: true,
        },
      });

      // Remove vínculos antigos
      await tx.userAcesso.deleteMany({
        where: { userCpf: cpfLimpo },
      });

      // Cria os novos vínculos (se houver)
      if (acessos.length > 0) {
        await tx.userAcesso.createMany({
          data: acessos.map(acesso => ({
            userCpf: cpfLimpo,
            ...acesso,
          })),
        });
      }

      return user;
    });

    await registrarAuditoria({
      user: gestor,
      acao: !existenteAntes ? 'CRIAR' : existenteAntes.ativo === false ? 'REATIVAR' : 'EDITAR',
      modulo: 'GERENCIAMENTO',
      entidade: 'Usuario',
      entidadeId: user.cpf,
      descricao: !existenteAntes
        ? `Usuário '${user.nome}' criado`
        : `Usuário '${user.nome}' existente atualizado (perfil, acessos e credencial inicial redefinidos)`,
      detalhes: {
        role: user.role,
        cargo: cargo || null,
        acessos: acessos
          .map((a) => `${a.modulo}:${a.nivel}${a.servicoJunta ? `:${a.servicoJunta}` : ''}`)
          .join(', '),
      },
    });

    return NextResponse.json(
      {
        message: 'Usuário do sistema criado com sucesso!',
        usuario: {
          id: user.cpf,
          cpf: user.cpf,
          nome: user.nome,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof GestorGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Erro ao cadastrar usuário:', error);
    return NextResponse.json({ error: 'Erro interno ao salvar usuário.' }, { status: 500 });
  }
}