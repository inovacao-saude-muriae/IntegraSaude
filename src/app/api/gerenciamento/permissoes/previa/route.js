import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGestor } from '@/lib/auth';
import { mapearRoleParaAcessos } from '@/lib/roleAcessos';
import {
  SERVICOS_JUNTA,
  MODULOS_CATALOGO,
  PERFIS,
  PERMISSOES,
  permissoesPadrao,
} from '@/lib/permissoesCatalogo';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/gerenciamento/permissoes/previa
// ─────────────────────────────────────────────────────────────────────────
// Devolve a PROPOSTA de conversão do modelo atual para o modelo por módulo
// (módulo → perfil → serviço → funcionalidade → permissão), para cada usuário.
//
// Somente leitura: não grava nada, não cria tabela, não altera vínculo.
// Serve para a gestão revisar a conversão antes de qualquer autorização.
//
// Restrito ao GESTOR: a prévia expõe a configuração de acesso de todos os
// usuários, o que é dado administrativo.
// ═══════════════════════════════════════════════════════════════════════════

// ── Converte o perfil atual (enum Role) em uma entrada do modelo novo ──────
function converterRole(role) {
  const vinculos = [];

  for (const acesso of mapearRoleParaAcessos(role)) {
    const modulo = MODULOS_CATALOGO[acesso.modulo];
    if (!modulo) continue;

    // Nível atual ADMIN/OPERADOR → perfil novo correspondente.
    // JUNTA/OPERADOR com sub-serviço é o único caso em que o perfil novo é
    // Operador com serviços restritos; sem sub-serviço, cai em Supervisor.
    let perfil;
    if (acesso.nivel === 'ADMIN') perfil = PERFIS.ADMINISTRADOR;
    else if (acesso.servicoJunta) perfil = PERFIS.OPERADOR;
    else perfil = PERFIS.SUPERVISOR;

    const servicos =
      acesso.servicoJunta && SERVICOS_JUNTA[acesso.servicoJunta]
        ? [acesso.servicoJunta]
        : null;

    vinculos.push({
      modulo: acesso.modulo,
      moduloNome: modulo.nome,
      perfil,
      servicos,
      funcionalidades: modulo.funcionalidades.map((f) => f.chave),
      permissoes: permissoesPadrao(modulo.chave, perfil),
    });
  }

  return vinculos;
}

// Perfil legado "GESTOR" não vira vínculo de módulo: continua sendo o perfil
// global de administração (ver seção "Gestão Geral" do desenho).
function ehGestorGlobal(role) {
  return role === 'GESTOR';
}

export async function GET() {
  try {
    await requireGestor();

    const usuarios = await prisma.user.findMany({
      select: {
        cpf: true,
        nome: true,
        role: true,
        ativo: true,
        cargo: true,
        acessos: {
          select: { modulo: true, nivel: true, servicoJunta: true },
        },
      },
      orderBy: { nome: 'asc' },
    });

    const previa = usuarios.map((u) => {
      const atual = {
        role: u.role,
        vinculos: (u.acessos || []).map((a) => ({
          modulo: a.modulo,
          nivel: a.nivel,
          servicoJunta: a.servicoJunta || null,
        })),
      };

      const proposta = converterRole(u.role);
      const gestorGlobal = ehGestorGlobal(u.role);

      // Divergências que exigem decisão da gestão antes da migração.
      const alertas = [];
      if (!gestorGlobal) {
        const doRole = new Set(
          mapearRoleParaAcessos(u.role).map((a) => a.modulo),
        );
        const gravados = new Set((u.acessos || []).map((a) => a.modulo));
        const soGravados = [...gravados].filter((m) => !doRole.has(m));
        const soRole = [...doRole].filter((m) => !gravados.has(m));
        if (soGravados.length) {
          alertas.push(
            `Vínculo gravado sem correspondência no perfil: ${soGravados.join(', ')}`,
          );
        }
        if (soRole.length) {
          alertas.push(
            `Perfil concede módulo sem vínculo gravado: ${soRole.join(', ')}`,
          );
        }
      }

      return {
        cpf: u.cpf,
        nome: u.nome,
        cargo: u.cargo || null,
        ativo: u.ativo,
        gestorGlobal,
        atual,
        proposta,
        alertas,
      };
    });

    return NextResponse.json({
      ok: true,
      somenteLeitura: true,
      geradoEm: new Date().toISOString(),
      resumo: {
        usuarios: previa.length,
        comAlerta: previa.filter((p) => p.alertas.length > 0).length,
        gestoresGlobais: previa.filter((p) => p.gestorGlobal).length,
      },
      previa,
    });
  } catch (error) {
    const status = error?.status || 500;
    if (status !== 500) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status },
      );
    }
    console.error('Erro ao gerar prévia de permissões:', error);
    return NextResponse.json(
      { ok: false, error: 'Erro ao gerar a prévia de permissões.' },
      { status: 500 },
    );
  }
}

// Exportado para reuso nos testes de conversão.
export const _conversao = { converterRole, ehGestorGlobal, PERMISSOES };
