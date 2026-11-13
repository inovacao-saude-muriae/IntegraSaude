"use server";

import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { MODULOS } from "@/lib/permissions";
import { normalizarCpfChave } from "@/lib/cpf";

// Inativar uma pessoa NÃO exclui nada: usa o campo `ativo` (EMPI) que já
// existe e tira o cadastro das listas de uso, preservando todo o histórico.
// É a alternativa recomendada quando a exclusão definitiva é bloqueada.
export async function inativarPessoa(cpf) {
  try {
    const user = await requirePermissao(MODULOS.GESTAO, "pessoas", "editar");
    const cpfLimpo = normalizarCpfChave(cpf);

    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo },
      select: { nomeCompleto: true, ativo: true, unificadoEmCpf: true },
    });
    if (!pessoa) return { success: false, error: "Pessoa não encontrada." };
    if (pessoa.unificadoEmCpf) {
      return {
        success: false,
        error: "Este cadastro foi unificado em outro registro e não pode ser inativado.",
      };
    }
    if (!pessoa.ativo) return { success: true, data: { cpf: cpfLimpo, ativo: false } };

    await prisma.pessoa.update({ where: { cpf: cpfLimpo }, data: { ativo: false } });

    await registrarAuditoria({
      user,
      acao: "INATIVAR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: cpfLimpo,
      descricao: `Pessoa '${pessoa.nomeCompleto}' inativada`,
    });

    return { success: true, data: { cpf: cpfLimpo, ativo: false } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao inativar pessoa:", error);
    return { success: false, error: "Erro ao inativar a pessoa." };
  }
}
