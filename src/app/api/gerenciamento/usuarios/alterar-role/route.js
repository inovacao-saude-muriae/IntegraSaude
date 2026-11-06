import { NextResponse } from 'next/server';
import { registrarAuditoria } from '@/lib/audit';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mapear Role para acessos nos módulos
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

export async function PUT(request) {
  try {
    const { cpf, novoRole, novoCargo } = await request.json();

    if (!cpf || !novoRole) {
      return NextResponse.json(
        { error: 'CPF e novo perfil são obrigatórios' },
        { status: 400 }
      );
    }

    // Verifica se o usuário existe
    const usuarioExistente = await prisma.user.findUnique({
      where: { cpf },
      include: { acessos: true },
    });

    if (!usuarioExistente) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Atualiza o role e o cargo do usuário
    await prisma.user.update({
      where: { cpf },
      data: {
        role: novoRole,
        cargo: novoCargo,
      },
    });

    // Remove os acessos antigos
    await prisma.userAcesso.deleteMany({
      where: { userCpf: cpf },
    });

    // Cria os novos acessos baseados no novo role
    const novosAcessos = mapearRoleParaAcessos(novoRole);
    if (novosAcessos.length > 0) {
      await prisma.userAcesso.createMany({
        data: novosAcessos.map((acesso) => ({
          userCpf: cpf,
          ...acesso,
        })),
      });
    }

    // Usuário que executa a ação é resolvido pela sessão (a rota não tem guarda própria).
    await registrarAuditoria({
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
    console.error('[API /alterar-role] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao alterar nível de acesso' },
      { status: 500 }
    );
  }
}
