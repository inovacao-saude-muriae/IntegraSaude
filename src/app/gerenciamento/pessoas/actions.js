"use server";

import { prisma } from "@/lib/prisma";
import { requireAcessoPessoas, requirePermissao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { MODULOS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  soDigitos,
  validarCpf,
  normalizarPessoa,
  criarPessoaTx,
  gravarEnderecoTx,
} from "@/lib/pessoa";
import { normalizarCpfChave } from "@/lib/cpf";
import { atualizarPessoaComCpf, unificarPessoas } from "@/lib/unificacaoPessoa";

// Cadastro central de pessoas: GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN
// (guarda "pessoas", refinamento #5 / design §5).

// Formata a data (YYYY-MM-DD) usada pelos inputs type="date".
const dataParaInput = (data) => {
  if (!data) return "";
  return new Date(data).toISOString().slice(0, 10);
};

// Monta o objeto serializável de uma pessoa + endereço atual.
const serializarPessoa = (pessoa) => {
  const endereco = pessoa.enderecos?.[0] || null;
  return {
    // Vínculo de tutor no CCZ (quando existir): a exclusão na tela de Tutor
    // remove SÓ este vínculo, nunca a Pessoa central.
    ehTutor: Boolean(pessoa.tutor),
    cpf: pessoa.cpf,
    nomeCompleto: pessoa.nomeCompleto,
    sexo: pessoa.sexo || "Masculino",
    dataNascimento: dataParaInput(pessoa.dataNascimento),
    nomeMae: pessoa.nomeMae || "",
    telefone: pessoa.telefone || "",
    cns: pessoa.cns || "",
    ubsReferenciaId: pessoa.ubsReferenciaId || "",
    ubsReferenciaNome: pessoa.ubsReferencia?.nome || "",
    logradouro: endereco?.logradouro || "",
    numero: endereco?.numero || "",
    complemento: endereco?.complemento || "",
    bairro: endereco?.bairro || "",
    cidade: endereco?.cidade || "Muriaé",
    uf: endereco?.uf || "MG",
    cep: endereco?.cep || "",
  };
};

// Lista as UBS ativas para o dropdown "UBS de referência".
export async function listarUbs() {
  try {
    await requireAcessoPessoas();
    const ubs = await prisma.ubs.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, cnes: true },
    });
    return { success: true, data: ubs };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao listar UBS:", error);
    return { success: false, error: "Erro ao carregar as UBS." };
  }
}

// ── LISTAR / BUSCAR ────────────────────────────────────────────────────────
export async function listarPessoas(termo = "") {
  try {
    await requireAcessoPessoas();

    const termoLimpo = termo.trim();
    const termoDigitos = soDigitos(termoLimpo);

    // Cadastros absorvidos por unificação (ativo=false) nunca são listados.
    const where = termoLimpo
      ? {
          ativo: true,
          OR: [
            { nomeCompleto: { contains: termoLimpo, mode: "insensitive" } },
            ...(termoDigitos ? [{ cpf: { contains: termoDigitos } }] : []),
          ],
        }
      : { ativo: true };

    const pessoas = await prisma.pessoa.findMany({
      where,
      orderBy: { nomeCompleto: "asc" },
      take: 100,
      include: {
        enderecos: {
          where: { enderecoAtual: true },
          take: 1,
        },
        ubsReferencia: { select: { nome: true } },
        tutor: { select: { pessoaCpf: true } },
      },
    });

    return { success: true, data: pessoas.map(serializarPessoa) };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao listar pessoas:", error);
    return { success: false, error: "Erro ao carregar as pessoas." };
  }
}

// ── CRIAR ──────────────────────────────────────────────────────────────────
export async function criarPessoa(data) {
  try {
    const user = await requireAcessoPessoas();

    // Valida os dígitos verificadores do CPF antes de cadastrar.
    if (!validarCpf(data.cpf)) {
      return { success: false, error: "CPF inválido. Verifique os dígitos informados." };
    }

    const pessoaData = normalizarPessoa(data);

    const existente = await prisma.pessoa.findUnique({
      where: { cpf: pessoaData.cpf },
      select: { cpf: true, ativo: true },
    });
    if (existente) {
      return {
        success: false,
        error: existente.ativo
          ? "Já existe uma pessoa com este CPF."
          : "Este CPF pertence a um cadastro que foi unificado em outro.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await criarPessoaTx(tx, data);
      await gravarEnderecoTx(tx, pessoaData.cpf, data);
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: pessoaData.cpf,
      descricao: `Pessoa '${pessoaData.nomeCompleto || pessoaData.cpf}' cadastrada`,
    });

    revalidatePath("/gerenciamento/pessoas");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    if (error.code === "P2002") {
      return { success: false, error: "CPF ou CNS já cadastrado." };
    }
    console.error("Erro ao criar pessoa:", error);
    return { success: false, error: error.message || "Erro ao cadastrar pessoa." };
  }
}

// ── ATUALIZAR ────────────────────────────────────────────────────────────
export async function atualizarPessoa(cpfOriginal, data) {
  try {
    const user = await requireAcessoPessoas();

    // O CPF só muda quando o atual é provisório; conflito devolve objeto de
    // controle (status CPF_DUPLICADO_CONFLITO) SEM salvar nada.
    const res = await atualizarPessoaComCpf(prisma, cpfOriginal, data);
    if (!res.success) return res;

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: res.cpf,
      descricao: res.trocouCpf ? "CPF provisório substituído pelo oficial" : "Pessoa atualizada",
      detalhes: res.trocouCpf ? { cpfAnterior: res.cpfAnterior } : undefined,
    });

    revalidatePath("/gerenciamento/pessoas");
    return { success: true, cpf: res.cpf };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    if (error.code === "P2002") {
      return { success: false, error: "CPF ou CNS já cadastrado para outra pessoa." };
    }
    console.error("Erro ao atualizar pessoa:", error);
    return { success: false, error: error.message || "Erro ao atualizar pessoa." };
  }
}

// ── CONFIRMAR UNIFICAÇÃO ───────────────────────────────────────────────────
// pessoaAlvoCpf = cadastro oficial (principal); pessoaOrigemCpf = cadastro com
// CPF provisório que será absorvido (fica inativo, nada é apagado).
export async function confirmarUnificacaoPessoas({
  pessoaAlvoCpf,
  pessoaOrigemCpf,
  motivo,
  dadosFormulario,
} = {}) {
  try {
    const user = await requireAcessoPessoas();

    const res = await unificarPessoas(prisma, {
      pessoaAlvoCpf,
      pessoaOrigemCpf,
      motivo,
      dadosFormulario,
      usuarioCpf: user.cpf,
    });
    if (!res.success) return res;

    await registrarAuditoria({
      user,
      acao: "UNIFICAR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: normalizarCpfChave(pessoaAlvoCpf),
      descricao: `Pessoa '${res.origemNome}' unificada em '${res.alvo.nomeCompleto}'`,
      detalhes: {
        origemCpf: normalizarCpfChave(pessoaOrigemCpf),
        pedidosMovidos: res.pedidosMovidos,
      },
    });

    revalidatePath("/gerenciamento/pessoas");
    return {
      success: true,
      pessoa_alvo: { ...serializarPessoa(res.alvo), contagens: res.contagens },
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao unificar pessoas:", error);
    return { success: false, error: "Erro ao unificar cadastros. Nada foi alterado." };
  }
}

// ── DEPENDÊNCIAS DO CADASTRO CENTRAL ──────────────────────────────────────
// Varredura EXPLÍCITA de todos os vínculos que preservam a pessoa. A ordem
// espelha os módulos do sistema; módulo novo entra aqui na mesma entrega.
// A checagem no banco (FKs RESTRICT) é a segunda barreira — esta serve para
// responder com mensagem clara, sem revelar dados de outro módulo.
async function contarDependenciasPessoa(cpf) {
  const [
    pedidosRegulacao,
    pastasFarmacia,
    registrosJunta,
    vinculoTutor,
    processosJudiciais,
    animaisComoTutor,
    unificacoes,
    absorvidas,
  ] = await Promise.all([
    prisma.pedidoExame.count({ where: { pessoaCpf: cpf } }),
    prisma.pacienteFarmaciaJudicial.count({ where: { pessoaCpf: cpf } }),
    prisma.pacienteJunta.count({ where: { pessoaCpf: cpf } }),
    prisma.tutor.count({ where: { pessoaCpf: cpf } }),
    prisma.processoJudicial.count({ where: { pessoaCpf: cpf } }),
    prisma.animal.count({ where: { pessoaCpf: cpf } }),
    prisma.auditoriaUnificacao.count({ where: { pessoaPrincipalCpf: cpf } }),
    prisma.pessoa.count({ where: { unificadoEmCpf: cpf } }),
  ]);

  // Só rótulos de módulo: nunca o conteúdo de outro módulo.
  const vinculos = [];
  if (pedidosRegulacao > 0) vinculos.push("Regulação");
  if (pastasFarmacia > 0) vinculos.push("Câmara Técnica (Farmácia Judicial)");
  if (processosJudiciais > 0) vinculos.push("Câmara Técnica (Processos Judiciais)");
  if (registrosJunta > 0) vinculos.push("Junta Reguladora");
  if (vinculoTutor > 0 || animaisComoTutor > 0) vinculos.push("CCZ (tutor)");
  if (unificacoes > 0 || absorvidas > 0) vinculos.push("Unificação de cadastros");

  return {
    total:
      pedidosRegulacao +
      pastasFarmacia +
      registrosJunta +
      vinculoTutor +
      processosJudiciais +
      animaisComoTutor +
      unificacoes +
      absorvidas,
    vinculos,
  };
}

// Exclusão DEFINITIVA do cadastro central.
// Exige permissão própria (`pessoas:excluir` — não é concedida a
// administradores de módulo por padrão) e bloqueia quando há qualquer vínculo
// que precise ser preservado. Sem cascata: o histórico nunca é apagado junto.
export async function excluirPessoa(cpf, { motivo } = {}) {
  try {
    const user = await requirePermissao(MODULOS.GESTAO, "pessoas", "excluir");
    const cpfLimpo = normalizarCpfChave(cpf);

    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo },
      select: { cpf: true, nomeCompleto: true, ativo: true },
    });
    if (!pessoa) return { success: false, error: "Pessoa não encontrada." };

    const deps = await contarDependenciasPessoa(cpfLimpo);
    if (deps.total > 0) {
      // Registra a TENTATIVA bloqueada (rastreabilidade), sem dados de módulo.
      await registrarAuditoria({
        user,
        acao: "NEGAR",
        modulo: "GERENCIAMENTO",
        entidade: "Pessoa",
        entidadeId: cpfLimpo,
        descricao:
          "Exclusão de pessoa bloqueada: existem registros vinculados " +
          `(${deps.vinculos.join(", ")})`,
      });
      return {
        success: false,
        error:
          "Não é possível excluir esta pessoa, pois existem registros vinculados em " +
          "outros módulos do IntegraSaúde. Para preservar o histórico, a exclusão foi " +
          "bloqueada. Se o cadastro não deve mais ser usado, inative-o.",
        vinculos: deps.vinculos,
        status: 409,
      };
    }

    // Sem vínculos: remove a pessoa e seus próprios dados (endereço).
    await prisma.$transaction(async (tx) => {
      await tx.endereco.deleteMany({ where: { pessoaCpf: cpfLimpo } });
      await tx.pessoa.delete({ where: { cpf: cpfLimpo } });
    });

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: cpfLimpo,
      descricao: `Pessoa '${pessoa.nomeCompleto}' excluída definitivamente`,
      detalhes: { motivo: motivo ? String(motivo).slice(0, 500) : null },
    });

    revalidatePath("/gerenciamento/pessoas");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    // Rede de segurança: se algum vínculo escapar da checagem, o banco recusa.
    if (error.code === "P2003" || error.code === "P2014") {
      return {
        success: false,
        error:
          "Não é possível excluir esta pessoa, pois existem registros vinculados em " +
          "outros módulos do IntegraSaúde. Para preservar o histórico, a exclusão foi " +
          "bloqueada.",
        status: 409,
      };
    }
    console.error("Erro ao excluir pessoa:", error);
    return { success: false, error: "Erro ao excluir pessoa." };
  }
}
