import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermissaoGestao } from "@/lib/auth";
import { GestorGuardError, validarAlteracaoGestor } from "@/lib/gestorGuard";
import { MODULOS, PERMISSOES } from "@/lib/permissoesCatalogo";
import { gerarSenhaTemporaria } from "@/lib/senhaTemporaria";

// ═══════════════════════════════════════════════════════════════════════════
// /api/gerenciamento/usuarios/redefinir-senha
// ─────────────────────────────────────────────────────────────────────────
// Usa o gerador ÚNICO de senha temporária (`lib/senhaTemporaria`, o mesmo do
// cadastro de conta): senha aleatória, nunca fixa nem compartilhada. Grava só o
// hash, marca `users.primeiro_acesso = true` e revoga TODAS as sessões do
// usuário — tudo na MESMA transação.
//
// O que esta rota NÃO faz: não toca em `user_acessos` (perfis, módulos,
// serviços, escopos, permissões concedidas/removidas) nem em `ativo` (situação
// cadastral), e não altera os dados de `pessoa`. Só senha + sessões + a marca
// de troca obrigatória.
//
// A senha temporária é devolvida UMA vez, na resposta, para o administrador
// entregar ao usuário. Ela nunca vai para auditoria, log ou banco em texto.
// ═══════════════════════════════════════════════════════════════════════════

export async function PUT(request) {
  let gestor;
  try {
    // Permissão PRÓPRIA: `usuarios:resetar_senha` na Gestão Geral.
    gestor = await requirePermissaoGestao("usuarios", PERMISSOES.RESETAR_SENHA);
  } catch (error) {
    if ([401, 403].includes(error?.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  try {
    const corpo = await request.json().catch(() => ({}));
    const cpf = String(corpo?.cpf || "").trim();

    if (!cpf) {
      return NextResponse.json({ error: "CPF é obrigatório" }, { status: 400 });
    }

    if (cpf === gestor.cpf) {
      return NextResponse.json(
        {
          error:
            "Para a sua própria conta, use a tela de alteração de senha. " +
            "A redefinição administrativa é para a conta de outra pessoa.",
        },
        { status: 409 },
      );
    }

    const senhaTemporaria = gerarSenhaTemporaria();
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

    const resultado = await prisma.$transaction(async (tx) => {
      // Mesma guarda das outras operações administrativas (trava os vínculos
      // da Gestão Geral e valida o alvo sob a trava).
      const alvo = await validarAlteracaoGestor(tx, {
        executorCpf: gestor.cpf,
        alvoCpf: cpf,
      });

      if (!alvo.ativo) {
        throw new GestorGuardError(
          "Este usuário está desativado. Reative a conta antes de redefinir a senha.",
        );
      }

      // Só senha + marca de troca obrigatória.
      await tx.user.update({
        where: { cpf },
        data: {
          senhaHash,
          primeiroAcesso: true,
          updatedAt: new Date(),
        },
      });

      // Todas as sessões anteriores deixam de valer.
      const revogadas = await tx.session.deleteMany({ where: { userId: cpf } });

      return { alvo, revogadas: revogadas.count };
    });

    await registrarAuditoria({
      user: gestor,
      acao: "EDITAR",
      modulo: MODULOS.GESTAO,
      entidade: "Senha",
      entidadeId: cpf,
      descricao: `Senha de '${resultado.alvo.nome}' redefinida; troca obrigatória no próximo acesso; ${resultado.revogadas} sessão(ões) revogada(s)`,
      detalhes: {
        operacao: "redefinir_senha",
        resultado: "sucesso",
        usuarioAfetado: resultado.alvo.nome,
        primeiroAcesso: true,
        sessoesRevogadas: resultado.revogadas,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Senha redefinida com sucesso.",
      // Entregue uma única vez ao administrador; não é gravada em lugar nenhum.
      senhaTemporaria,
      sessoesRevogadas: resultado.revogadas,
      usuario: { cpf: resultado.alvo.cpf, nome: resultado.alvo.nome },
    }, {
      // Resposta com credencial nunca pode ser cacheada.
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof GestorGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if ([401, 403].includes(error?.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[API /redefinir-senha] Erro:", error?.message || error);
    return NextResponse.json(
      { error: "Erro ao redefinir a senha. Nada foi alterado." },
      { status: 500 },
    );
  }
}
