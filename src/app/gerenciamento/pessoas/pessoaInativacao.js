"use server";

import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { MODULOS } from "@/lib/permissions";
import { PERMISSOES } from "@/lib/permissoesCatalogo";
import { revalidatePath } from "next/cache";
import { normalizarCpfChave } from "@/lib/cpf";

// ── SITUAÇÃO CADASTRAL DA PESSOA CENTRAL (EMPI) ────────────────────────────
// Inativar/reativar NÃO apaga nada: usa o campo `pessoa.ativo` que já existe e
// preserva todos os vínculos (Regulação, Câmara Técnica, Junta, CCZ, animais).
// A exclusão definitiva é outra operação (excluirPessoa, em actions.js).
//
// Permissões próprias e separadas, do catálogo central:
//   GESTAO · pessoas · inativar
//   GESTAO · pessoas · reativar
// Nenhum administrador de módulo recebe essas permissões por herança.

const MIN_JUSTIFICATIVA = 15;
const MAX_JUSTIFICATIVA = 500;

function lerJustificativa(valor) {
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ");
  if (texto.length < MIN_JUSTIFICATIVA) {
    return {
      erro: `Informe a justificativa da inativação (mínimo de ${MIN_JUSTIFICATIVA} caracteres).`,
    };
  }
  return { texto: texto.slice(0, MAX_JUSTIFICATIVA) };
}

// Quem ainda pode entrar no sistema com este CPF. Inativar o cadastro central
// NÃO pode bloquear o acesso de um usuário administrativo sem decisão explícita.
async function contarUsuariosAtivos(cpf) {
  const [usuarios, acessos] = await Promise.all([
    prisma.user.count({ where: { cpf, ativo: true } }),
    prisma.userAcesso.count({ where: { userCpf: cpf, ativo: true } }),
  ]);
  return { usuarios, acessos };
}

// ── INATIVAR ───────────────────────────────────────────────────────────────
export async function inativarPessoa(cpf, { justificativa } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.GESTAO,
      "pessoas",
      PERMISSOES.INATIVAR,
    );
    const cpfLimpo = normalizarCpfChave(cpf);

    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo },
      select: { cpf: true, nomeCompleto: true, ativo: true, unificadoEmCpf: true },
    });
    if (!pessoa) return { success: false, error: "Pessoa não encontrada." };
    if (pessoa.unificadoEmCpf) {
      return {
        success: false,
        error:
          "Este cadastro foi unificado em outro registro. A situação é controlada pela unificação e não pode ser alterada aqui.",
      };
    }
    if (!pessoa.ativo) {
      return { success: false, error: "Esta pessoa já está inativa." };
    }

    const just = lerJustificativa(justificativa);
    if (just.erro) return { success: false, error: just.erro };

    // Proteção de acesso: usuário administrativo ativo não é inativado por aqui.
    const uso = await contarUsuariosAtivos(cpfLimpo);
    if (uso.usuarios > 0) {
      await registrarAuditoria({
        user,
        acao: "NEGAR",
        modulo: "GERENCIAMENTO",
        entidade: "Pessoa",
        entidadeId: cpfLimpo,
        descricao: "Inativação bloqueada: a pessoa possui usuário ativo no sistema",
      });
      return {
        success: false,
        status: 409,
        error:
          "Não é possível inativar: este CPF está vinculado a um usuário ativo do " +
          "IntegraSaúde. Ajuste o acesso do usuário antes de inativar o cadastro.",
      };
    }

    await prisma.pessoa.update({
      where: { cpf: cpfLimpo },
      data: { ativo: false },
    });

    await registrarAuditoria({
      user,
      acao: "DESATIVAR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: cpfLimpo,
      descricao: `Pessoa '${pessoa.nomeCompleto}' inativada. Justificativa: ${just.texto}`,
      detalhes: {
        situacaoAnterior: "ATIVA",
        novaSituacao: "INATIVA",
        resultado: "SUCESSO",
        justificativa: just.texto,
      },
    });

    revalidatePath("/gerenciamento/pessoas");
    revalidatePath("/gerenciamento/tutores");
    return {
      success: true,
      data: { cpf: cpfLimpo, ativo: false },
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao inativar pessoa:", error);
    return { success: false, error: "Erro ao inativar a pessoa." };
  }
}

// ── REATIVAR ───────────────────────────────────────────────────────────────
// Reativa o MESMO registro (nunca cria outro) e preserva os vínculos.
export async function reativarPessoa(cpf, { justificativa } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.GESTAO,
      "pessoas",
      PERMISSOES.REATIVAR,
    );
    const cpfLimpo = normalizarCpfChave(cpf);

    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo },
      select: { cpf: true, nomeCompleto: true, ativo: true, unificadoEmCpf: true },
    });
    if (!pessoa) return { success: false, error: "Pessoa não encontrada." };
    if (pessoa.unificadoEmCpf) {
      return {
        success: false,
        error:
          "Este cadastro foi absorvido por uma unificação e não pode ser reativado.",
      };
    }
    if (pessoa.ativo) {
      return { success: false, error: "Esta pessoa já está ativa." };
    }

    const just = lerJustificativa(justificativa);
    if (just.erro) return { success: false, error: just.erro.replace("inativação", "reativação") };

    // Reativação é sempre do MESMO registro: o CPF é a chave primária, então
    // não há como gerar duplicidade. Confirmamos para deixar explícito.
    const totalComCpf = await prisma.pessoa.count({ where: { cpf: cpfLimpo } });
    if (totalComCpf !== 1) {
      return {
        success: false,
        error: "Situação inesperada do cadastro. Nenhuma alteração foi feita.",
      };
    }

    await prisma.pessoa.update({
      where: { cpf: cpfLimpo },
      data: { ativo: true },
    });

    await registrarAuditoria({
      user,
      acao: "REATIVAR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: cpfLimpo,
      descricao: `Pessoa '${pessoa.nomeCompleto}' reativada. Justificativa: ${just.texto}`,
      detalhes: {
        situacaoAnterior: "INATIVA",
        novaSituacao: "ATIVA",
        resultado: "SUCESSO",
        justificativa: just.texto,
      },
    });

    revalidatePath("/gerenciamento/pessoas");
    revalidatePath("/gerenciamento/tutores");
    return { success: true, data: { cpf: cpfLimpo, ativo: true } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao reativar pessoa:", error);
    return { success: false, error: "Erro ao reativar a pessoa." };
  }
}

// ── CONSULTA DE HISTÓRICO (pessoa inativa continua consultável) ────────────
// Retorna apenas a SITUAÇÃO e as contagens por módulo (rótulos), para a tela
// mostrar por que o cadastro está inativo sem expor dados de outros módulos.
export async function consultarSituacaoPessoa(cpf) {
  try {
    await requirePermissao(MODULOS.GESTAO, "pessoas", PERMISSOES.VISUALIZAR);
    const cpfLimpo = normalizarCpfChave(cpf);
    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo },
      select: {
        cpf: true,
        nomeCompleto: true,
        ativo: true,
        unificadoEmCpf: true,
        _count: {
          select: {
            pedidos: true,
            processosJudiciais: true,
            enderecos: true,
          },
        },
      },
    });
    if (!pessoa) return { success: false, error: "Pessoa não encontrada." };

    const [farmacia, junta, tutor] = await Promise.all([
      prisma.pacienteFarmaciaJudicial.count({ where: { pessoaCpf: cpfLimpo } }),
      prisma.pacienteJunta.count({ where: { pessoaCpf: cpfLimpo } }),
      prisma.tutor.count({ where: { pessoaCpf: cpfLimpo } }),
    ]);

    const ultima = await prisma.auditLog.findFirst({
      where: {
        entidade: "Pessoa",
        entidadeId: cpfLimpo,
        acao: { in: ["DESATIVAR", "REATIVAR"] },
      },
      orderBy: { id: "desc" },
      select: { acao: true, userNome: true, createdAt: true },
    });

    return {
      success: true,
      data: {
        cpf: pessoa.cpf,
        nomeCompleto: pessoa.nomeCompleto,
        ativo: pessoa.ativo,
        unificado: Boolean(pessoa.unificadoEmCpf),
        vinculos: {
          regulacao: pessoa._count.pedidos,
          farmacia,
          processos: pessoa._count.processosJudiciais,
          junta,
          ccz: tutor,
        },
        ultimaAlteracaoSituacao: ultima
          ? {
              acao: ultima.acao,
              usuario: ultima.userNome,
              em: ultima.createdAt,
            }
          : null,
      },
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao consultar situação da pessoa:", error);
    return { success: false, error: "Erro ao consultar a situação da pessoa." };
  }
}
