import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { requireGestor } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const ROLES_VALIDAS = Object.values(Role);

// Mapeia role para os vínculos de acesso (UserAcesso)
function mapearRoleParaAcessos(role) {
  switch (role) {
    case 'GESTOR':
      return []; // GESTOR não precisa de vínculos, acessa tudo via role

    case 'REGULACAO_ADMIN':
      return [{ modulo: 'REGULACAO', nivel: 'ADMIN', servicoJunta: null }];
    case 'REGULACAO_COMUM':
      return [{ modulo: 'REGULACAO', nivel: 'OPERADOR', servicoJunta: null }];

    case 'FARMACIA_ADMIN':
      return [{ modulo: 'FARMACIA', nivel: 'ADMIN', servicoJunta: null }];
    
    case 'PROCESSO_ADMIN':
      return [{ modulo: 'PROCESSOS', nivel: 'ADMIN', servicoJunta: null }];

    case 'JUNTA_ADMIN':
      return [{ modulo: 'JUNTA', nivel: 'ADMIN', servicoJunta: null }];
    case 'JUNTA_CAEE':
      return [{ modulo: 'JUNTA', nivel: 'OPERADOR', servicoJunta: 'CAEE' }];
    case 'JUNTA_EDUCACAO':
      return [{ modulo: 'JUNTA', nivel: 'OPERADOR', servicoJunta: 'APAE' }];
    case 'JUNTA_SAUDE':
      return [{ modulo: 'JUNTA', nivel: 'OPERADOR', servicoJunta: 'AMBULATORIO' }];
    case 'JUNTA_ASSISTENCIA':
      return [{ modulo: 'JUNTA', nivel: 'OPERADOR', servicoJunta: 'ESPECIALIDADES' }];

    case 'CCZ_ADMIN':
      return [{ modulo: 'CCZ', nivel: 'ADMIN', servicoJunta: null }];
    case 'CCZ_COMUM':
      return [{ modulo: 'CCZ', nivel: 'OPERADOR', servicoJunta: null }];

    default:
      return [];
  }
}

export async function POST(request) {
  try {
    await requireGestor();
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

    // Usa transaction para criar usuário + vínculos atomicamente
    const user = await prisma.$transaction(async (tx) => {
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
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Erro ao cadastrar usuário:', error);
    return NextResponse.json({ error: 'Erro interno ao salvar usuário.' }, { status: 500 });
  }
}