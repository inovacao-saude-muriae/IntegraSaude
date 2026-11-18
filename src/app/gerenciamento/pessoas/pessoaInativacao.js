"use server";

import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { MODULOS } from "@/lib/permissions";
import { PERMISSOES } from "@/lib/permissoesCatalogo";
import { revalidatePath } from "next/cache";
import { normalizarCpfChave } from "@/lib/cpf";
import {
  SITUACOES_PESSOA,
  MIN_JUSTIFICATIVA_SITUACAO,
  MAX_JUSTIFICATIVA_SITUACAO,
  normalizarSituacaoPessoa,
  rotuloSituacaoPessoa,
} from "@/lib/situacaoPessoa";

// ── SITUAÇÃO CADASTRAL DA PESSOA CENTRAL (EMPI) ────────────────────────────
// Fonte única compartilhada por Regulação, Junta Reguladora, Farmácia Judicial,
// Processos e CCZ. A regra (valores, rótulos, mensagens e filtros) está em
// @/lib/situacaoPessoa — aqui fica só a escrita e a auditoria.
//
// Permissões próprias do catálogo central, nenhuma herdada por administrador
// de módulo:
//   GESTAO · pessoas · editar    → ATIVO → FALECIDO (e correção de legado)
//   GESTAO · pessoas · reativar  → FALECIDO → ATIVO
//   GESTAO · pessoas · editar    → registrar/corrigir FALECIDO
//
// Nada é apagado: pedidos, prontuários, processos, registros da Farmácia e os
// vínculos do CCZ (inclusive animais) permanecem intactos.

function lerJustificativa(valor, acao) {
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ");
  if (texto.length < MIN_JUSTIFICATIVA_SITUACAO) {
    return {
      erro: `Informe a justificativa da ${acao} (mínimo de ${MIN_JUSTIFICATIVA_SITUACAO} caracteres).`,
    };
  }
  return { texto: texto.slice(0, MAX_JUSTIFICATIVA_SITUACAO) };
}

// Permissão exigida para ir da situação atual para a nova.
function permissaoDaTransicao(anterior, nova) {
  // Duas situações: ATIVO ↔ FALECIDO. Reativar exige `reativar`; registrar ou
  // corrigir o falecimento exige `editar`.
  if (nova === SITUACOES_PESSOA.ATIVO) return PERMISSOES.REATIVAR;
  return PERMISSOES.EDITAR;
}

// Quem ainda pode entrar no sistema com este CPF. Tirar o cadastro de ATIVO não
// pode bloquear o acesso de um usuário administrativo sem decisão explícita.
async function contarUsuariosAtivos(cpf) {
  const [usuarios, acessos] = await Promise.all([
    prisma.user.count({ where: { cpf, ativo: true } }),
    prisma.userAcesso.count({ where: { userCpf: cpf, ativo: true } }),
  ]);
  return { usuarios, acessos };
}

// ── ALTERAR SITUAÇÃO CADASTRAL ─────────────────────────────────────────────
export async function alterarSituacaoPessoa(cpf, { situacao, justificativa } = {}) {
  try {
    const cpfLimpo = normalizarCpfChave(cpf);
    const nova = normalizarSituacaoPessoa(situacao);

    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo },
      select: {
        cpf: true,
        nomeCompleto: true,
        situacao: true,
        unificadoEmCpf: true,
      },
    });
    if (!pessoa) return { success: false, error: "Pessoa não encontrada." };
    if (pessoa.unificadoEmCpf) {
      return {
        success: false,
        error:
          "Este cadastro foi unificado em outro registro. A situação é controlada pela unificação e não pode ser alterada aqui.",
      };
    }

    // Situação gravada (pode ser a legada "Inativo", corrigível aqui).
    const anterior = String(pessoa.situacao || "").trim().toUpperCase();
    if (anterior === nova) {
      return {
        success: false,
        error: `Esta pessoa já está com a situação ${rotuloSituacaoPessoa(nova)}.`,
      };
    }

    // Autorização calculada pela TRANSIÇÃO, antes de qualquer escrita.
    const permissao = permissaoDaTransicao(anterior, nova);
    const user = await requirePermissao(MODULOS.GESTAO, "pessoas", permissao);

    const acao = `para ${rotuloSituacaoPessoa(nova).toLowerCase()}`;
    const just = lerJustificativa(justificativa, acao);
    if (just.erro) return { success: false, error: just.erro };

    // Proteção de acesso: usuário administrativo ativo não perde a situação por aqui.
    if (nova !== SITUACOES_PESSOA.ATIVO) {
      const uso = await contarUsuariosAtivos(cpfLimpo);
      if (uso.usuarios > 0) {
        await registrarAuditoria({
          user,
          acao: "NEGAR",
          modulo: "GERENCIAMENTO",
          entidade: "Pessoa",
          entidadeId: cpfLimpo,
          descricao: `Alteração para ${rotuloSituacaoPessoa(nova)} bloqueada: a pessoa possui usuário ativo no sistema`,
          detalhes: {
            situacaoAnterior: anterior,
            novaSituacao: nova,
            resultado: "NEGADO",
            justificativa: just.texto,
          },
        });
        return {
          success: false,
          status: 409,
          error:
            "Não é possível alterar a situação: este CPF está vinculado a um usuário ativo do " +
            "IntegraSaúde. Ajuste o acesso do usuário antes de alterar o cadastro.",
        };
      }
    }

    // `ativo` é espelho técnico: o trigger do banco o recalcula a partir de
    // `situacao`. A aplicação grava apenas a situação.
    await prisma.pessoa.update({
      where: { cpf: cpfLimpo },
      data: { situacao: nova },
    });

    await registrarAuditoria({
      user,
      acao: nova === SITUACOES_PESSOA.ATIVO ? "REATIVAR" : "DESATIVAR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: cpfLimpo,
      descricao: `Pessoa '${pessoa.nomeCompleto}': situação alterada de ${rotuloSituacaoPessoa(
        anterior,
      )} para ${rotuloSituacaoPessoa(nova)}. Justificativa: ${just.texto}`,
      detalhes: {
        situacaoAnterior: anterior,
        novaSituacao: nova,
        resultado: "SUCESSO",
        justificativa: just.texto,
      },
    });

    revalidatePath("/gerenciamento/pessoas");
    revalidatePath("/gerenciamento/tutores");
    revalidatePath("/ccz");
    revalidatePath("/regulacao");
    revalidatePath("/junta-reguladora");
    return { success: true, data: { cpf: cpfLimpo, situacao: nova } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao alterar a situação da pessoa:", error);
    return { success: false, error: "Erro ao alterar a situação da pessoa." };
  }
}

// ── CONSULTA DE HISTÓRICO (pessoa inativa/falecida continua consultável) ───
// Retorna a SITUAÇÃO e as contagens por módulo (rótulos), para a tela mostrar
// por que o cadastro está indisponível sem expor dados de outros módulos.
export async function consultarSituacaoPessoa(cpf) {
  try {
    await requirePermissao(MODULOS.GESTAO, "pessoas", PERMISSOES.VISUALIZAR);
    const cpfLimpo = normalizarCpfChave(cpf);
    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo },
      select: {
        cpf: true,
        nomeCompleto: true,
        situacao: true,
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
        situacao: normalizarSituacaoPessoa(pessoa.situacao),
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
