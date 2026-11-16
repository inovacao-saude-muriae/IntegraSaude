import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermissaoGestao } from "@/lib/auth";
import { GestorGuardError, validarAlteracaoGestor } from "@/lib/gestorGuard";
import { MODULOS, PERMISSOES } from "@/lib/permissoesCatalogo";

// ═══════════════════════════════════════════════════════════════════════════
// /api/gerenciamento/usuarios/redefinir-senha
// ─────────────────────────────────────────────────────────────────────────
// Gera uma senha temporária ALEATÓRIA (nunca fixa, nunca compartilhada), grava
// só o hash, marca `users.primeiro_acesso = true` e revoga TODAS as sessões do
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

// Sem caracteres ambíguos (0/O, 1/l/I) para não errar ao digitar/repassar.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const ESPECIAIS = "!@#$%&*";

/**
 * Senha temporária com 14 caracteres, atendendo à política já usada na troca
 * de senha (8+, maiúscula, minúscula, número, especial) e sempre com pelo
 * menos dois dígitos e dois símbolos. `crypto.getRandomValues` é a fonte.
 */
export function gerarSenhaTemporaria(tamanho = 14) {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  const corpo = [];
  for (let i = 0; i < tamanho - 3; i += 1) {
    corpo.push(ALFABETO[bytes[i] % ALFABETO.length]);
  }

  const extra = new Uint8Array(8);
  crypto.getRandomValues(extra);
  const escolha = (arr, i) => arr[extra[i] % arr.length];

  const partes = [
    escolha("ABCDEFGHJKLMNPQRSTUVWXYZ", 0), // maiúscula
    escolha("abcdefghijkmnopqrstuvwxyz", 1), // minúscula
    escolha("23456789", 2), // número
    escolha("23456789", 3), // segundo número
    escolha(ESPECIAIS, 4), // especial
    ...corpo,
  ];

  // Embaralha (Fisher-Yates) para o prefixo não ficar previsível.
  const ordem = new Uint8Array(partes.length);
  crypto.getRandomValues(ordem);
  for (let i = partes.length - 1; i > 0; i -= 1) {
    const j = ordem[i] % (i + 1);
    [partes[i], partes[j]] = [partes[j], partes[i]];
  }
  return partes.join("");
}

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
