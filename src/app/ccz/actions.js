"use server";

import { prisma } from "@/lib/prisma";
import { requireAcessoModulo, requirePermissao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { MODULOS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { normalizarCpfChave } from "@/lib/cpf";
import { mensagemPessoaIndisponivel } from "@/lib/situacaoPessoa";
import { validarPessoaParaVinculo } from "@/lib/situacaoPessoaGuard";
import {
  soDigitos,
  validarCpf,
  upsertPessoaTx,
  gravarEnderecoTx,
} from "@/lib/pessoa";

// ═══════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS DO MÓDULO CCZ / ZOONOSES
// ─────────────────────────────────────────────────────────────────────────
// Todas as actions exigem vínculo com o módulo CCZ (requireAcessoModulo). O
// Tutor é uma Pessoa: salvar tutor grava em `pessoa` + `pessoa_endereco` via
// helpers tx-aware (@/lib/pessoa) e faz upsert em `ccz_tutores`, tudo na mesma
// transação. Retorno padrão: { success, error?, data? }.
// ═══════════════════════════════════════════════════════════════════════════

// Formata a data (YYYY-MM-DD) usada pelos inputs type="date".
const dataParaInput = (data) => {
  if (!data) return "";
  return new Date(data).toISOString().slice(0, 10);
};

// Monta o objeto serializável de uma pessoa + endereço atual (+ dados de tutor).
const serializarPessoa = (pessoa) => {
  const endereco = pessoa.enderecos?.[0] || null;
  const tutor = pessoa.tutor || null;
  return {
    cpf: pessoa.cpf,
    nomeCompleto: pessoa.nomeCompleto,
    situacao: pessoa.situacao || "ATIVO",
    ativo: pessoa.ativo !== false,
    sexo: pessoa.sexo || "Masculino",
    dataNascimento: dataParaInput(pessoa.dataNascimento),
    nomeMae: pessoa.nomeMae || "",
    telefone: pessoa.telefone || "",
    cns: pessoa.cns || "",
    logradouro: endereco?.logradouro || "",
    numero: endereco?.numero || "",
    complemento: endereco?.complemento || "",
    bairro: endereco?.bairro || "",
    cidade: endereco?.cidade || "Muriaé",
    uf: endereco?.uf || "MG",
    cep: endereco?.cep || "",
    // Dados complementares específicos do CCZ (preenche o form ao reabrir).
    jaEhTutor: Boolean(tutor),
    rg: tutor?.rg || "",
    tutorSexo: tutor?.sexo || "",
    profissao: tutor?.profissao || "",
    telefoneSecundario: tutor?.telefoneSecundario || "",
    pontoReferencia: tutor?.pontoReferencia || "",
    observacoes: tutor?.observacoes || "",
  };
};

// ── BUSCAR PESSOAS (autocomplete do campo "Nome completo" do Tutor) ─────────
export async function buscarPessoasCCZ(termo = "") {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const termoLimpo = String(termo || "").trim();
    const termoDigitos = soDigitos(termoLimpo);

    // Situação cadastral (fonte única): a busca mostra também as pessoas
    // FALECIDAS (pesquisa e consulta são permitidas); o vínculo novo é
    // bloqueado depois, com a mensagem única. Unificadas ficam fora.
    const where = termoLimpo
      ? {
          unificadoEmCpf: null,
          OR: [
            { nomeCompleto: { contains: termoLimpo, mode: "insensitive" } },
            ...(termoDigitos ? [{ cpf: { contains: termoDigitos } }] : []),
          ],
        }
      : { unificadoEmCpf: null };

    const pessoas = await prisma.pessoa.findMany({
      where,
      orderBy: { nomeCompleto: "asc" },
      take: 8,
      include: {
        enderecos: { where: { enderecoAtual: true }, take: 1 },
        tutor: true,
      },
    });

    return { success: true, data: pessoas.map(serializarPessoa) };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao buscar pessoas (CCZ):", error);
    return { success: false, error: "Erro ao buscar pessoas." };
  }
}

// ── LISTAR ANIMAIS DE UM TUTOR (bloco de vínculos no cadastro do tutor) ─────
export async function listarAnimaisDoTutor(pessoaCpf) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const cpf = normalizarCpfChave(pessoaCpf);
    if (!cpf) return { success: true, data: [] };

    const animais = await prisma.animal.findMany({
      where: { pessoaCpf: cpf },
      orderBy: { dataCadastro: "desc" },
    });

    const data = animais.map((a) => ({
      id: a.id,
      nome: a.nome || "",
      especie: a.especie || "",
      sexo: a.sexo === "F" ? "Fêmea" : "Macho",
      porte: a.porte || "",
      idade: a.idade || "",
      castrado: a.castrado || "Não",
    }));

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao listar animais do tutor (CCZ):", error);
    return { success: false, error: "Erro ao carregar os animais do tutor." };
  }
}

// ── LISTAR TUTORES COM SEUS ANIMAIS (aba Tutor > Lista) ─────────────────────
export async function listarTutoresComAnimais() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const tutores = await prisma.tutor.findMany({
      include: {
        pessoa: true,
        animais: { orderBy: { dataCadastro: "desc" } },
      },
      orderBy: { pessoa: { nomeCompleto: "asc" } },
    });

    const data = tutores.map((t) => ({
      pessoaCpf: t.pessoaCpf,
      nome: t.pessoa?.nomeCompleto || "",
      situacao: t.pessoa?.situacao || "ATIVO",
      cpf: t.pessoa?.cpf || "",
      cns: t.pessoa?.cns || "",
      telefone: t.pessoa?.telefone || "",
      animais: (t.animais || []).map((a) => ({
        id: a.id,
        nome: a.nome || "",
        especie: a.especie || "",
        sexo: a.sexo === "F" ? "Fêmea" : "Macho",
        porte: a.porte || "",
        idade: a.idade || "",
        castrado: a.castrado || "Não",
      })),
    }));

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao listar tutores com animais (CCZ):", error);
    return { success: false, error: "Erro ao carregar os tutores." };
  }
}

// ── OBTER UM ANIMAL (para carregar no formulário de edição) ─────────────────
export async function obterAnimal(id) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const animalId = String(id || "").trim();
    if (!animalId) return { success: false, error: "Id do animal não informado." };

    const a = await prisma.animal.findUnique({
      where: { id: animalId },
      include: { tutor: { include: { pessoa: true } } },
    });
    if (!a) return { success: false, error: "Animal não encontrado." };

    // "Doença crônica: ..." foi concatenada em observacoes ao salvar; aqui
    // separamos de volta para preencher o campo "qual doença" na edição.
    let qualDoenca = "";
    let observacoes = a.observacoes || "";
    const m = observacoes.match(/^Doença crônica:\s*(.*)(?:\n([\s\S]*))?$/);
    if (a.doencaCronica === "Sim" && m) {
      qualDoenca = (m[1] || "").trim();
      observacoes = (m[2] || "").trim();
    }

    const data = {
      fotoUrl: a.fotoUrl || "",
      id: a.id,
      nome: a.nome || "",
      especie: a.especie || "",
      sexo: a.sexo === "F" ? "Fêmea" : "Macho",
      porte: a.porte || "",
      idade: a.idade || "",
      possuiResponsavel: a.possuiResponsavel === "Sim" ? "Sim" : "Não",
      pessoaCpf: a.pessoaCpf || "",
      tutorNome: a.tutor?.pessoa?.nomeCompleto || "",
      castrado: a.castrado || "Não",
      doencaCronica: a.doencaCronica || "Não",
      qualDoenca,
      apetiteNormal: a.apetiteNormal || "Sim",
      sintomasVomitoDiarreia: a.sintomasVomitoDiarreia || "Não",
      emTratamento: a.emTratamento || "Não",
      qualTratamento: a.qualTratamento || "",
      observacoes,
      situacao: a.situacao || "",
      // Data de devolução (YYYY-MM-DD para o input type="date"); vazio se nula.
      dataDevolucao: a.dataDevolucao ? new Date(a.dataDevolucao).toISOString().slice(0, 10) : "",
    };

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter animal (CCZ):", error);
    return { success: false, error: "Erro ao carregar o animal." };
  }
}

// ── EXCLUIR ANIMAL ──────────────────────────────────────────────────────────
export async function excluirAnimal(id) {
  try {
    // Exclusão é permissão excepcional. Qualquer registro vinculado bloqueia:
    // o histórico do animal nunca é apagado (mesma regra dos demais módulos).
    const user = await requirePermissao(MODULOS.CCZ, "animais", "excluir");

    const animalId = String(id || "").trim();
    if (!animalId) return { success: false, error: "ID do animal não informado." };

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        procedimentos: { select: { id: true } },
        esporotricose: { select: { id: true } },
        leishmanioses: { select: { id: true } },
        denuncias: { select: { id: true } },
        termos: { select: { id: true } },
      },
    });

    if (!animal) return { success: false, error: "Animal não encontrado." };

    const registros = [
      { nome: "procedimento(s)", qtd: animal.procedimentos?.length || 0 },
      { nome: "registro(s) de esporotricose", qtd: animal.esporotricose?.length || 0 },
      { nome: "fiscalização(ões) de leishmaniose", qtd: animal.leishmanioses?.length || 0 },
      { nome: "denúncia(s)", qtd: animal.denuncias?.length || 0 },
      { nome: "termo(s) de internação", qtd: animal.termos?.length || 0 },
    ].filter((r) => r.qtd > 0);

    if (registros.length > 0) {
      const total = registros.reduce((soma, r) => soma + r.qtd, 0);
      const lista = registros.map((r) => `${r.qtd} ${r.nome}`).join(", ");
      return {
        success: false,
        error: `Não é possível excluir este animal: existem ${total} registro(s) vinculado(s) (${lista}). O histórico do animal é preservado.`,
      };
    }

    await prisma.animal.delete({ where: { id: animalId } });

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "CCZ",
      entidade: "Animal",
      entidadeId: animalId,
      descricao: `Animal '${animal.nome || animalId}' excluído`,
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    // FK RESTRICT de outro módulo: a exclusão continua bloqueada.
    if (error.code === "P2003") {
      return {
        success: false,
        error:
          "Não é possível excluir este animal: existem registros vinculados a ele. O histórico é preservado.",
      };
    }
    console.error("Erro ao excluir animal (CCZ):", error);
    return { success: false, error: "Erro ao excluir o animal." };
  }
}

// ── ARQUIVAR DENÚNCIA ──────────────────────────────────────────────────────
export async function arquivarDenuncia(id, motivo) {
  try {
    const user = await requirePermissao(MODULOS.CCZ, "denuncias", "editar");
    const denunciaId = String(id || "").trim();
    if (!denunciaId) return { success: false, error: "ID da denúncia não informado." };

    const motivoTexto = String(motivo || "").trim();
    if (motivoTexto.length < 5) {
      return {
        success: false,
        error: "Informe o motivo do arquivamento (mínimo 5 caracteres).",
      };
    }

    const denuncia = await prisma.denunciaCaoAgressivo.findUnique({
      where: { id: denunciaId },
      select: { id: true, situacao: true },
    });
    if (!denuncia) return { success: false, error: "Denúncia não encontrada." };
    if (denuncia.situacao === "Arquivada") {
      return { success: false, error: "Esta denúncia já está arquivada." };
    }

    await prisma.denunciaCaoAgressivo.update({
      where: { id: denunciaId },
      data: {
        situacao: "Arquivada",
        motivoArquivamento: motivoTexto,
        arquivadaEm: new Date(),
        arquivadaPor: user.nome || user.cpf,
      },
    });

    await registrarAuditoria({
      user,
      acao: "ARQUIVAR",
      modulo: "CCZ",
      entidade: "Denuncia",
      entidadeId: denunciaId,
      descricao: `Denúncia ${denunciaId} arquivada`,
      detalhes: { motivo: motivoTexto },
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao arquivar denúncia (CCZ):", error);
    return { success: false, error: "Erro ao arquivar a denúncia." };
  }
}

// ── ALTERAR SITUAÇÃO DA DENÚNCIA (Ativa / Inativa) ──────────────────────────
// Situação operacional da denúncia, independente do arquivamento.
// Ao inativar, a justificativa é obrigatória (15 a 500 caracteres); ela é
// preservada como histórico da última inativação após a reativação.
export async function alterarSituacaoDenuncia(id, situacao, justificativa = "") {
  try {
    const user = await requirePermissao(MODULOS.CCZ, "denuncias", "editar");

    const denunciaId = String(id || "").trim();
    if (!denunciaId) return { success: false, error: "ID da denúncia não informado." };

    const nova = String(situacao || "").trim();
    if (!["Ativa", "Inativa"].includes(nova)) {
      return { success: false, error: "Situação inválida. Use Ativa ou Inativa." };
    }

    const denuncia = await prisma.denunciaCaoAgressivo.findUnique({
      where: { id: denunciaId },
      select: { id: true, situacao: true },
    });
    if (!denuncia) return { success: false, error: "Denúncia não encontrada." };

    const atual = denuncia.situacao === "Inativa" ? "Inativa" : "Ativa";
    if (atual === nova) {
      return { success: false, error: `A denúncia já está ${nova.toLowerCase()}.` };
    }

    let textoJustificativa = null;
    if (nova === "Inativa") {
      textoJustificativa = String(justificativa || "").trim();
      if (textoJustificativa.length < 15) {
        return {
          success: false,
          error: "Informe a justificativa da inativação (mínimo 15 caracteres).",
        };
      }
      if (textoJustificativa.length > 500) {
        return {
          success: false,
          error: "A justificativa deve ter no máximo 500 caracteres.",
        };
      }
    }

    await prisma.denunciaCaoAgressivo.update({
      where: { id: denunciaId },
      data: {
        situacao: nova,
        // Reativar preserva a justificativa da última inativação.
        justificativaInativacao: nova === "Inativa" ? textoJustificativa : undefined,
      },
    });

    await registrarAuditoria({
      user,
      acao: nova === "Inativa" ? "DESATIVAR" : "REATIVAR",
      modulo: "CCZ",
      entidade: "Denuncia",
      entidadeId: denunciaId,
      descricao: `Denúncia ${denunciaId} ${nova === "Inativa" ? "inativada" : "reativada"}`,
      detalhes: { situacaoAnterior: atual, situacaoNova: nova },
    });

    revalidatePath("/ccz");
    return { success: true, data: { id: denunciaId, situacao: nova } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao alterar situação da denúncia (CCZ):", error);
    return { success: false, error: "Erro ao alterar a situação da denúncia." };
  }
}

// ── SALVAR TUTOR (Pessoa + Endereço + ccz_tutores) ──────────────────────────
export async function salvarTutor(dados) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    if (!validarCpf(dados.cpf)) {
      return { success: false, error: "CPF inválido. Verifique os dígitos informados." };
    }
    if (!dados.nomeCompleto?.trim()) {
      return { success: false, error: "Nome completo é obrigatório." };
    }
    if (!dados.dataNascimento) {
      return { success: false, error: "Data de nascimento é obrigatória." };
    }
    if (!soDigitos(dados.telefone)) {
      return { success: false, error: "Telefone é obrigatório." };
    }

    const cpf = soDigitos(dados.cpf);

    // A Pessoa é a MESMA do Cadastro de Pacientes (fonte única). Em cadastro
    // novo, um CPF que já existe é reaproveitado — nunca duplicado.
    const pessoaExistente = await prisma.pessoa.findUnique({
      where: { cpf },
      select: { cpf: true, nomeCompleto: true, situacao: true, unificadoEmCpf: true },
    });
    if (pessoaExistente?.unificadoEmCpf) {
      return {
        success: false,
        error: `Este CPF pertence a um cadastro unificado em ${pessoaExistente.nomeCompleto}. Selecione o cadastro principal pela busca.`,
      };
    }
    if (pessoaExistente && !dados.jaEhTutor) {
      // Regra central de novo vínculo (mesma função dos demais módulos).
      const aptoTutor = await validarPessoaParaVinculo(pessoaExistente.cpf);
      if (!aptoTutor.ok) return { success: false, error: aptoTutor.error };
    }
    const pessoaJaExiste = Boolean(pessoaExistente);

    // O formulário do tutor é EXATAMENTE o do paciente (Pessoa central): os
    // campos complementares de `ccz_tutores` deixaram de ser editados. Os dados
    // já gravados permanecem na tabela (nada é apagado); só não são tocados.
    // Situação cadastral: gravada apenas na CRIAÇÃO da pessoa (alterá-la exige
    // confirmação e justificativa, em alterarSituacaoPessoa).
    const dadosPessoa = { ...dados };
    delete dadosPessoa.situacao;

    await prisma.$transaction(async (tx) => {
      await upsertPessoaTx(tx, pessoaJaExiste ? dadosPessoa : dados);
      await gravarEnderecoTx(tx, cpf, dados);
      // Vínculo de tutor: cria só a chave quando ainda não existir; em update
      // não há campo do formulário a gravar (preserva o que já estava lá).
      await tx.tutor.upsert({
        where: { pessoaCpf: cpf },
        update: {},
        create: { pessoaCpf: cpf },
      });
    });

    await registrarAuditoria({
      user,
      acao: pessoaJaExiste ? "EDITAR" : "CRIAR",
      modulo: "CCZ",
      entidade: "Tutor",
      entidadeId: cpf,
      descricao: `Tutor '${String(dados.nomeCompleto).trim()}' ${pessoaJaExiste ? "atualizado" : "cadastrado"}`,
    });

    revalidatePath("/ccz");
    return { success: true, data: { pessoaCpf: cpf } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    if (error.code === "P2002") {
      return { success: false, error: "CPF ou CNS já cadastrado." };
    }
    if (error.code === "P2003") {
      return { success: false, error: "Registro vinculado inválido." };
    }
    console.error("Erro ao salvar tutor (CCZ):", error);
    return { success: false, error: error.message || "Erro ao salvar tutor." };
  }
}

// ── LISTAR TUTORES (seletor de tutor do Animal) ─────────────────────────────
export async function listarTutores() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const tutores = await prisma.tutor.findMany({
      include: { pessoa: true },
      orderBy: { pessoa: { nomeCompleto: "asc" } },
    });

    const data = tutores.map((t) => ({
      pessoaCpf: t.pessoaCpf,
      nome: t.pessoa?.nomeCompleto || "",
      telefone: t.pessoa?.telefone || "",
      rg: t.rg || "",
    }));

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao listar tutores (CCZ):", error);
    return { success: false, error: "Erro ao carregar os tutores." };
  }
}

// ── EXCLUIR O VÍNCULO DE TUTOR ─────────────────────────────────────────────
// Exclui APENAS o registro em `ccz_tutores`. A Pessoa central (cadastro único)
// NUNCA é excluída por aqui, e não há cascata: com animais vinculados a operação
// é recusada e o caminho é desvincular/transferir antes.
// Permissão: ccz_tutores:excluir (Administrador do CCZ).
export async function excluirTutor(pessoaCpf) {
  try {
    const user = await requirePermissao(MODULOS.CCZ, "tutores", "excluir");
    const cpf = normalizarCpfChave(pessoaCpf);

    const tutor = await prisma.tutor.findUnique({
      where: { pessoaCpf: cpf },
      include: {
        pessoa: { select: { nomeCompleto: true } },
        _count: { select: { animais: true } },
      },
    });
    if (!tutor) {
      return { success: false, error: "Tutor não encontrado." };
    }

    const animais = tutor._count?.animais || 0;
    if (animais > 0) {
      return {
        success: false,
        error:
          `Este tutor possui ${animais} animal(is) vinculado(s). ` +
          "Transfira ou desvincule os animais antes de excluir o vínculo de tutor.",
        animais,
      };
    }

    // Sem dependências: remove só o vínculo de tutor.
    await prisma.tutor.delete({ where: { pessoaCpf: cpf } });

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "CCZ",
      entidade: "Tutor",
      entidadeId: cpf,
      descricao: `Vínculo de tutor de '${tutor.pessoa?.nomeCompleto || cpf}' excluído (cadastro de pessoa preservado)`,
    });

    revalidatePath("/gerenciamento/tutores");
    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    if (error.code === "P2003" || error.code === "P2014") {
      return {
        success: false,
        error: "Este tutor possui registros vinculados. Nada foi excluído.",
      };
    }
    console.error("Erro ao excluir tutor (CCZ):", error);
    return { success: false, error: "Erro ao excluir o tutor." };
  }
}

// ── FICHA COMPLETA DO ANIMAL (dados + tutor + histórico de procedimentos) ───
export async function obterFichaAnimal(id) {
  try {
    const usuario = await requireAcessoModulo(MODULOS.CCZ);

    const animalId = String(id || "").trim();
    if (!animalId) return { success: false, error: "Id do animal não informado." };

    const a = await prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        tutor: { include: { pessoa: true } },
        procedimentos: { orderBy: { dataProcedimento: "desc" } },
      },
    });
    if (!a) return { success: false, error: "Animal não encontrado." };

    // "Doença crônica: ..." foi concatenada em observacoes ao salvar; separa de volta.
    let qualDoenca = "";
    let observacoes = a.observacoes || "";
    const m = observacoes.match(/^Doença crônica:\s*(.*)(?:\n([\s\S]*))?$/);
    if (a.doencaCronica === "Sim" && m) {
      qualDoenca = (m[1] || "").trim();
      observacoes = (m[2] || "").trim();
    }

    const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

    const tutorPessoa = a.tutor?.pessoa || null;

    const data = {
      id: a.id,
      fotoUrl: a.fotoUrl || "",
      nome: a.nome || "",
      especie: a.especie || "",
      sexo: a.sexo === "F" ? "Fêmea" : "Macho",
      porte: a.porte || "",
      idade: a.idade || "",
      castrado: a.castrado || "Não",
      doencaCronica: a.doencaCronica || "Não",
      qualDoenca,
      apetiteNormal: a.apetiteNormal || "Sim",
      sintomasVomitoDiarreia: a.sintomasVomitoDiarreia || "Não",
      emTratamento: a.emTratamento || "Não",
      qualTratamento: a.qualTratamento || "",
      observacoes,
      possuiResponsavel: a.possuiResponsavel || "Não",
      racaPelagem: a.racaPelagem || "",
      possuiIdentificacao: a.possuiIdentificacao || "Não",
      situacao: a.situacao || "",
      dataCadastro: a.dataCadastro ? a.dataCadastro.toISOString() : null,
      tutor: tutorPessoa
        ? {
            cpf: tutorPessoa.cpf,
            nome: tutorPessoa.nomeCompleto || "",
            telefone: tutorPessoa.telefone || "",
          }
        : null,
      procedimentos: (a.procedimentos || []).map((p) => ({
        id: p.id,
        tipo: p.tipo,
        dataProcedimento: ymd(p.dataProcedimento),
        veterinario: p.veterinario || "",
        status: p.status || "Agendado",
        descricao: p.descricao || "",
        medicacaoPrescrita: p.medicacaoPrescrita || "",
        dataRetorno: ymd(p.dataRetorno),
      })),
    };

    // Auditoria: ficha do animal reúne dados clínicos e do tutor (LGPD).
    await registrarAuditoria({
      user: usuario,
      acao: "OUTRO",
      modulo: "CCZ",
      entidade: "Animal",
      entidadeId: animalId,
      descricao: "Acesso à ficha do animal",
    });

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter ficha do animal (CCZ):", error);
    return { success: false, error: "Erro ao carregar a ficha do animal." };
  }
}

// ── BUSCAR ANIMAIS (autocomplete do seletor de animal em Procedimentos) ─────
export async function buscarAnimaisCCZ(termo = "") {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const termoLimpo = String(termo || "").trim();

    const where = termoLimpo
      ? {
          OR: [
            { nome: { contains: termoLimpo, mode: "insensitive" } },
            { id: { contains: termoLimpo, mode: "insensitive" } },
            { especie: { contains: termoLimpo, mode: "insensitive" } },
          ],
        }
      : {};

    const animais = await prisma.animal.findMany({
      where,
      orderBy: { dataCadastro: "desc" },
      take: 8,
      include: { tutor: { include: { pessoa: true } } },
    });

    const data = animais.map((a) => ({
      id: a.id,
      nome: a.nome || "",
      especie: a.especie || "",
      sexo: a.sexo === "F" ? "Fêmea" : "Macho",
      porte: a.porte || "",
      tutorNome: a.tutor?.pessoa?.nomeCompleto || "",
      pessoaCpf: a.tutor?.pessoaCpf || "",
    }));

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao buscar animais (CCZ):", error);
    return { success: false, error: "Erro ao buscar animais." };
  }
}

// ── SALVAR ANIMAL (ccz_animais) ─────────────────────────────────────────────
export async function salvarAnimal(dados) {
  try {
    // Cadastro/edição de animal exige a permissão efetiva do catálogo
    // (CCZ › Animais). Na criação é "criar"; na edição, "editar".
    // Vínculo com o módulo continua necessário, mas não basta.
    const editandoDados = dados?.editando === true;
    const user = await requirePermissao(
      MODULOS.CCZ,
      "animais",
      editandoDados ? "editar" : "criar",
    );

    // Id do animal: digitado pelo usuário (NÃO há geração automática). É PK
    // obrigatória e não pode ficar em branco. Normaliza (maiúsculas, até 50).
    const idInformado = dados.id ? String(dados.id).trim() : "";
    if (!idInformado) {
      return { success: false, error: "O ID do animal é obrigatório." };
    }
    const id = idInformado.toUpperCase().slice(0, 50);

    // Flag de edição enviada pelo cliente. Na criação, o id não pode repetir;
    // na edição o id é a PK existente e não deve disparar o erro de duplicidade.
    const editando = editandoDados;

    if (!editando) {
      const existente = await prisma.animal.findUnique({
        where: { id },
        select: { id: true },
      });
      if (existente) {
        return { success: false, error: "Já existe um animal com este ID." };
      }
    }

    if (!dados.especie) {
      return { success: false, error: "Espécie é obrigatória." };
    }
    if (!dados.porte) {
      return { success: false, error: "Porte é obrigatório." };
    }
    if (!dados.sexo) {
      return { success: false, error: "Sexo é obrigatório." };
    }

    // Sexo persistido como 1 caractere ("M"/"F"), coluna @db.Char(1).
    const sexo = String(dados.sexo).trim().toUpperCase().startsWith("F") ? "F" : "M";

    const possuiResponsavel = dados.possuiResponsavel === "Sim" ? "Sim" : "Não";
    const pessoaCpf =
      possuiResponsavel === "Sim" && dados.pessoaCpf
        ? normalizarCpfChave(dados.pessoaCpf)
        : null;

    // Situação cadastral (fonte única): pessoa falecida não recebe NOVO animal.
    // Na edição o vínculo existente é preservado (histórico), por isso a
    // verificação só acontece na criação e quando o tutor foi alterado.
    if (pessoaCpf) {
      const tutorAtual = editando
        ? (
            await prisma.animal.findUnique({
              where: { id },
              select: { pessoaCpf: true },
            })
          )?.pessoaCpf
        : null;
      const vinculoNovo = !editando || normalizarCpfChave(tutorAtual || "") !== pessoaCpf;
      if (vinculoNovo) {
        // Regra central de novo vínculo (mesma função dos demais módulos).
        const aptoTutor = await validarPessoaParaVinculo(pessoaCpf, {
          mensagemPessoa: "Tutor não encontrado no cadastro único.",
        });
        if (!aptoTutor.ok) return { success: false, error: aptoTutor.error };
      }
    }

    // "Qual doença" não tem coluna própria: concatena em observacoes.
    let observacoes = dados.observacoes ? String(dados.observacoes).trim() : "";
    if (dados.doencaCronica === "Sim" && dados.qualDoenca?.trim()) {
      const prefixo = `Doença crônica: ${dados.qualDoenca.trim()}`;
      observacoes = observacoes ? `${prefixo}\n${observacoes}` : prefixo;
    }

    const dadosAnimal = {
      pessoaCpf,
      fotoUrl: dados.fotoUrl || null,
      nome: dados.nome ? String(dados.nome).slice(0, 100) : null,
      especie: String(dados.especie).slice(0, 50),
      sexo,
      porte: String(dados.porte).slice(0, 20),
      idade: dados.idade ? String(dados.idade).slice(0, 50) : null,
      racaPelagem: dados.racaPelagem?.trim()
        ? String(dados.racaPelagem).trim().slice(0, 100)
        : null,
      possuiIdentificacao: dados.possuiIdentificacao === "Sim" ? "Sim" : "Não",
      castrado: dados.castrado === "Sim" ? "Sim" : "Não",
      doencaCronica: dados.doencaCronica === "Sim" ? "Sim" : "Não",
      sintomasVomitoDiarreia: dados.sintomasVomitoDiarreia === "Sim" ? "Sim" : "Não",
      apetiteNormal: dados.apetiteNormal === "Não" ? "Não" : "Sim",
      emTratamento: dados.emTratamento === "Sim" ? "Sim" : "Não",
      qualTratamento:
        dados.emTratamento === "Sim" && dados.qualTratamento?.trim()
          ? String(dados.qualTratamento).slice(0, 150)
          : null,
      observacoes: observacoes || null,
      possuiResponsavel,
      // Situação do animal: "" (não informado), "Adotado", "Devolvido" ou
      // "CCZ" (permanece sob custódia do CCZ). Default "" quando não informado.
      situacao: ["Adotado", "Devolvido", "CCZ"].includes(dados.situacao)
        ? dados.situacao
        : "",
      // Data da situação (mesma coluna dataDevolucao): faz sentido para
      // "Devolvido" (data da devolução) e "Adotado" (data da adoção). O campo
      // é OPCIONAL mesmo nesses casos (não trava cadastros antigos). Para
      // "CCZ"/"", grava null (limpa qualquer valor anterior).
      dataDevolucao:
        (dados.situacao === "Devolvido" || dados.situacao === "Adotado") &&
        dados.dataDevolucao
          ? new Date(dados.dataDevolucao)
          : null,
      enderecoRecolhimento: null,
    };

    await prisma.$transaction(async (tx) => {
      // Se o animal tem tutor, garante que a pessoa esteja registrada como
      // tutora (ccz_tutores). Assim o vínculo Pessoa → Tutor → Animal fica
      // íntegro e o relatório do paciente consegue listar os animais dela.
      if (pessoaCpf) {
        // Tutor é uma Pessoa do cadastro único: só pessoa ATIVA pode ser
        // vinculada a um NOVO animal. Vínculos existentes não são tocados.
        const pessoa = await tx.pessoa.findUnique({
          where: { cpf: pessoaCpf },
          select: { cpf: true, situacao: true, unificadoEmCpf: true },
        });
        if (!pessoa || pessoa.unificadoEmCpf) {
          throw Object.assign(new Error("Pessoa (tutor) não encontrada no cadastro."), {
            codigoApp: "TUTOR_INEXISTENTE",
          });
        }
        // Mesma decisão central de `validarPessoaParaVinculo` (releitura do
        // banco dentro da transação, sem duplicar a regra).
        const indisponivel = mensagemPessoaIndisponivel(pessoa.situacao);
        if (indisponivel) {
          throw Object.assign(new Error(indisponivel), { codigoApp: "TUTOR_INDISPONIVEL" });
        }
        await tx.tutor.upsert({
          where: { pessoaCpf },
          update: {},
          create: { pessoaCpf },
        });
      }

      await tx.animal.upsert({
        where: { id },
        update: dadosAnimal,
        create: { id, ...dadosAnimal },
      });
    });

    await registrarAuditoria({
      user,
      acao: editando ? "EDITAR" : "CRIAR",
      modulo: "CCZ",
      entidade: "Animal",
      entidadeId: id,
      descricao: `Animal '${dadosAnimal.nome || id}' ${editando ? "atualizado" : "cadastrado"}`,
      detalhes: { situacao: dadosAnimal.situacao },
    });

    revalidatePath("/ccz");
    return { success: true, data: { id } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    if (error.codigoApp === "TUTOR_INEXISTENTE") {
      return { success: false, error: error.message };
    }
    if (error.code === "P2002") {
      return { success: false, error: "Já existe um animal com este ID." };
    }
    if (error.code === "P2003") {
      return { success: false, error: "Tutor selecionado inválido ou inexistente." };
    }
    console.error("Erro ao salvar animal (CCZ):", error);
    return { success: false, error: error.message || "Erro ao salvar animal." };
  }
}

// ── LISTAR ANIMAIS (opcional) ───────────────────────────────────────────────
// Filtro de situação (server-side), critério ÚNICO por vez. Chaves aceitas:
//   ""            → Todos (sem cláusula extra)
//   "ADOTADO"     → animais com situacao === "Adotado"
//   "DEVOLVIDO"   → animais com situacao === "Devolvido"
//   "COM_TUTOR"   → animais com tutor vinculado (pessoaCpf != null)
//   "SEM_TUTOR"   → animais sem tutor (pessoaCpf == null)
//   "INCINERADO"  → animais com algum caso de esporotricose incinerado === "Sim"
// A cláusula do filtro é combinada (AND) com a busca textual quando houver.
const WHERE_FILTRO_SITUACAO = {
  ADOTADO: { situacao: "Adotado" },
  DEVOLVIDO: { situacao: "Devolvido" },
  COM_TUTOR: { pessoaCpf: { not: null } },
  SEM_TUTOR: { pessoaCpf: null },
  INCINERADO: { esporotricose: { some: { incinerado: "Sim" } } },
};

export async function listarAnimais({
  termo = "",
  filtroSituacao = "",
  incluirArquivados = false,
} = {}) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const termoLimpo = String(termo || "").trim();
    const termoDigitos = soDigitos(termoLimpo);
    const filtro = String(filtroSituacao || "").trim().toUpperCase();

    // Cláusulas combinadas por AND: busca textual + filtro de situação.
    const condicoes = [];

    if (termoLimpo) {
      condicoes.push({
        OR: [
          { nome: { contains: termoLimpo, mode: "insensitive" } },
          { id: { contains: termoLimpo, mode: "insensitive" } },
          { especie: { contains: termoLimpo, mode: "insensitive" } },
          { tutor: { pessoa: { nomeCompleto: { contains: termoLimpo, mode: "insensitive" } } } },
          ...(termoDigitos ? [{ pessoaCpf: { contains: termoDigitos } }] : []),
        ],
      });
    }

    if (WHERE_FILTRO_SITUACAO[filtro]) {
      condicoes.push(WHERE_FILTRO_SITUACAO[filtro]);
    }

    // Arquivado é a saída padrão do CCZ no lugar da exclusão: o registro sai da
    // lista de trabalho, mas continua no banco. Só aparece quando pedido.
    if (!incluirArquivados) {
      condicoes.push({ OR: [{ situacao: null }, { situacao: { not: "Arquivado" } }] });
    }

    const where = condicoes.length ? { AND: condicoes } : {};

    const animais = await prisma.animal.findMany({
      where,
      include: { 
        tutor: { include: { pessoa: true } },
        esporotricose: { 
          select: { id: true, encerrado: true, incinerado: true }
        },
      },
      orderBy: { dataCadastro: "desc" },
    });

    const data = animais.map((a) => ({
      id: a.id,
      nome: a.nome || "",
      especie: a.especie,
      sexo: a.sexo === "F" ? "Fêmea" : "Macho",
      porte: a.porte,
      idade: a.idade || "",
      castrado: a.castrado || "Não",
      doencaCronica: a.doencaCronica || "Não",
      sintomasVomitoDiarreia: a.sintomasVomitoDiarreia || "Não",
      apetiteNormal: a.apetiteNormal || "Sim",
      emTratamento: a.emTratamento || "Não",
      qualTratamento: a.qualTratamento || "",
      observacoes: a.observacoes || "",
      possuiResponsavel: a.possuiResponsavel || "Não",
      situacao: a.situacao || "",
      dataDevolucao: a.dataDevolucao ? new Date(a.dataDevolucao).toISOString().slice(0, 10) : "",
      fotoUrl: a.fotoUrl || "",
      pessoaCpf: a.pessoaCpf || "",
      tutorNome: a.tutor?.pessoa?.nomeCompleto || "",
      dataCadastro: a.dataCadastro ? a.dataCadastro.toISOString() : null,
      temEsporotricose: a.esporotricose && a.esporotricose.length > 0,
      // Status de esporotricose do animal. Regra para múltiplos casos:
      // "Em andamento" se existir ao menos um caso não encerrado; se todos os
      // casos estiverem encerrados, "Encerrado".
      esporotricoseEncerrada:
        a.esporotricose && a.esporotricose.length > 0
          ? a.esporotricose.every((e) => e.encerrado)
          : false,
      // Estado de incineração do animal considerando todos os casos de
      // esporotricose. Regra para múltiplos casos: "Sim" (Incinerado) se
      // QUALQUER caso tiver incinerado === "Sim"; senão "Não" (Não incinerado)
      // se QUALQUER caso tiver incinerado === "Não"; caso contrário "" (não
      // informado), que não gera badge no card.
      esporotricoseIncinerado:
        a.esporotricose && a.esporotricose.some((e) => e.incinerado === "Sim")
          ? "Sim"
          : a.esporotricose && a.esporotricose.some((e) => e.incinerado === "Não")
          ? "Não"
          : "",
    }));

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao listar animais (CCZ):", error);
    return { success: false, error: "Erro ao carregar os animais." };
  }
}

// ── OBTER HISTÓRICO COMPLETO DO ANIMAL ──────────────────────────────────────
// ── FICHA COMPLETA DO ANIMAL (prontuário: identificação, tutor, histórico) ──
// Reúne cadastro central, Pessoa do tutor e todo o histórico operacional do
// animal em uma lista cronológica única. Cada item carrega o id da origem, de
// modo que o detalhe é sempre o registro original (nada é reescrito aqui).
const ISO_DIA = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const dataBR = (d) => {
  const iso = ISO_DIA(d);
  return iso ? iso.split("-").reverse().join("/") : "";
};

export async function obterFichaCompleta(animalId) {
  try {
    const usuario = await requireAcessoModulo(MODULOS.CCZ);

    const id = String(animalId || "").trim();
    if (!id) return { success: false, error: "Id do animal não informado." };

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        tutor: {
          include: {
            pessoa: {
              include: {
                enderecos: { take: 1, orderBy: { id: "desc" } },
              },
            },
          },
        },
        procedimentos: { orderBy: { dataProcedimento: "desc" } },
        esporotricose: {
          include: {
            visitas: { include: { relatorio: true }, orderBy: { data: "asc" } },
          },
          orderBy: { dataVisita: "desc" },
        },
        leishmanioses: { orderBy: { dataFiscalizacao: "desc" } },
        denuncias: { orderBy: { dataDenuncia: "desc" } },
      },
    });

    if (!animal) return { success: false, error: "Animal não encontrado." };

    // "Doença crônica: ..." foi concatenada em observacoes ao salvar; separa de volta.
    let qualDoenca = "";
    let observacoes = animal.observacoes || "";
    const m = observacoes.match(/^Doença crônica:\s*(.*)(?:\n([\s\S]*))?$/);
    if (animal.doencaCronica === "Sim" && m) {
      qualDoenca = (m[1] || "").trim();
      observacoes = (m[2] || "").trim();
    }

    const pessoa = animal.tutor?.pessoa || null;
    const endereco = pessoa?.enderecos?.[0] || null;
    const enderecoTexto = endereco
      ? [
          [endereco.logradouro, endereco.numero].filter(Boolean).join(", "),
          endereco.complemento,
          endereco.bairro,
          [endereco.cidade, endereco.uf].filter(Boolean).join("/"),
        ]
          .filter(Boolean)
          .join(" — ")
      : "";

    const historico = [];

    for (const p of animal.procedimentos || []) {
      historico.push({
        chave: `PROCEDIMENTO:${p.id}`,
        origem: "PROCEDIMENTO",
        origemId: p.id,
        data: ISO_DIA(p.dataProcedimento),
        tipo: "Procedimento",
        titulo: p.tipo || "Procedimento",
        subtitulo: p.status || "",
        resumo: p.descricao || "",
        detalhes: [
          { rotulo: "Tipo de procedimento", valor: p.tipo || "" },
          { rotulo: "Data", valor: dataBR(p.dataProcedimento) },
          { rotulo: "Status", valor: p.status || "" },
          { rotulo: "Veterinário responsável", valor: p.veterinario || "" },
          { rotulo: "Medicação prescrita", valor: p.medicacaoPrescrita || "" },
          { rotulo: "Data de retorno", valor: dataBR(p.dataRetorno) },
          { rotulo: "Descrição", valor: p.descricao || "", largo: true },
        ],
      });
    }

    for (const e of animal.esporotricose || []) {
      historico.push({
        chave: `ESPOROTRICOSE:${e.id}`,
        origem: "ESPOROTRICOSE",
        origemId: e.id,
        data: ISO_DIA(e.dataVisita),
        tipo: "Esporotricose",
        titulo: "Fiscalização de esporotricose",
        subtitulo: e.encerrado ? "Encerrado" : "Em andamento",
        resumo: e.conclusaoTecnica || e.descricaoLesoes || "",
        detalhes: [
          { rotulo: "Data da visita", valor: dataBR(e.dataVisita) },
          { rotulo: "Fiscal responsável", valor: e.fiscalResponsavel || "" },
          { rotulo: "Conclusão", valor: e.encerrado ? "Encerrado" : "Em andamento" },
          { rotulo: "Apresenta lesões", valor: e.apresentaLesoes || "" },
          { rotulo: "Descrição das lesões", valor: e.descricaoLesoes || "" },
          { rotulo: "Em tratamento veterinário", valor: e.emTratamentoVeterinario || "" },
          { rotulo: "Tratamento descrito", valor: e.descricaoTratamentoVet || "" },
          { rotulo: "Isolamento domiciliar", valor: e.isolamentoDomiciliar || "" },
          { rotulo: "Observações do isolamento", valor: e.observacoesIsolamento || "" },
          { rotulo: "Acesso à rua", valor: e.acessoRua || "" },
          { rotulo: "Uso de EPI", valor: e.usoEpi || "" },
          { rotulo: "Quais EPIs", valor: e.quaisEpis || "" },
          { rotulo: "Higienização do ambiente", valor: e.higienizacaoAmbiente || "" },
          { rotulo: "Condições gerais do ambiente", valor: e.condicoesGeraisAmbiente || "" },
          { rotulo: "Outros animais na residência", valor: e.outrosAnimaisResidencia || "" },
          { rotulo: "Descrição dos outros animais", valor: e.outrosAnimaisDescricao || "" },
          { rotulo: "Pessoas com lesões", valor: e.pessoasComLesoes || "" },
          { rotulo: "Descrição das lesões em pessoas", valor: e.pessoasLesoesDescricao || "" },
          { rotulo: "Conclusão técnica", valor: e.conclusaoTecnica || "", largo: true },
          { rotulo: "Acompanhamento pelo CCZ", valor: e.encAcompanhamentoCcz ? "Sim" : "Não" },
          { rotulo: "Notificação ao tutor", valor: e.encNotificacaoTutor ? "Sim" : "Não" },
          { rotulo: "Encaminhamento ao Ministério Público", valor: e.encMinisterioPublico ? "Sim" : "Não" },
          { rotulo: "Outras medidas", valor: e.outrasMedidasDescricao || (e.encOutrasMedidas ? "Sim" : "Não") },
          { rotulo: "Data de encerramento", valor: dataBR(e.dataEncerramento) },
          { rotulo: "Encerrado por", valor: e.encerradoPor || "" },
          { rotulo: "Incinerado", valor: e.incinerado ? "Sim" : "Não" },
          { rotulo: "Data da incineração", valor: dataBR(e.dataIncineracao) },
        ],
      });
      for (const v of e.visitas || []) {
        historico.push({
          chave: `ESPORO_VISITA:${v.id}`,
          origem: "ESPORO_VISITA",
          origemId: v.id,
          data: ISO_DIA(v.data),
          tipo: "Esporotricose",
          titulo: v.relatorio ? "Visita de acompanhamento" : "Visita",
          subtitulo: e.id,
          resumo: v.relatorio?.observacoesGerais || v.observacao || "",
          detalhes: v.relatorio
            ? [
                { rotulo: "Data da visita", valor: dataBR(v.data) },
                { rotulo: "Data do relatório", valor: dataBR(v.relatorio.dataRelatorio) },
                { rotulo: "Profissional responsável", valor: v.relatorio.profissionalResponsavel || "" },
                { rotulo: "Apresenta lesões", valor: v.relatorio.apresentaLesoes || "" },
                { rotulo: "Descrição das lesões", valor: v.relatorio.descricaoLesoes || "" },
                { rotulo: "Evolução do quadro", valor: v.relatorio.evolucaoQuadro || "" },
                { rotulo: "Em tratamento", valor: v.relatorio.emTratamento || "" },
                { rotulo: "Medicamentos em uso", valor: v.relatorio.medicamentosAtuais || "" },
                { rotulo: "Adesão ao tratamento", valor: v.relatorio.adesaoTratamento || "" },
                { rotulo: "Isolamento adequado", valor: v.relatorio.isolamentoAdequado || "" },
                { rotulo: "Uso de EPI adequado", valor: v.relatorio.usoEpiAdequado || "" },
                { rotulo: "Higienização adequada", valor: v.relatorio.higienizacaoAdequada || "" },
                { rotulo: "Orientações repassadas", valor: v.relatorio.orientacoesRepassadas || "", largo: true },
                { rotulo: "Observações gerais", valor: v.relatorio.observacoesGerais || "", largo: true },
                { rotulo: "Necessita nova visita", valor: v.relatorio.necessidadeNovaVisita || "" },
                { rotulo: "Data da próxima visita", valor: dataBR(v.relatorio.dataProximaVisita) },
                { rotulo: "Encaminhamento veterinário", valor: v.relatorio.encVeterinario ? "Sim" : "Não" },
                { rotulo: "Notificação", valor: v.relatorio.encNotificacao ? "Sim" : "Não" },
                { rotulo: "Outros encaminhamentos", valor: v.relatorio.descricaoEncaminhamentos || "" },
              ]
            : [
                { rotulo: "Data da visita", valor: dataBR(v.data) },
                { rotulo: "Observação", valor: v.observacao || "", largo: true },
              ],
        });
      }
    }

    for (const l of animal.leishmanioses || []) {
      historico.push({
        chave: `LEISHMANIOSE:${l.id}`,
        origem: "LEISHMANIOSE",
        origemId: l.id,
        data: ISO_DIA(l.dataFiscalizacao),
        tipo: "Leishmaniose",
        titulo: "Fiscalização de leishmaniose",
        subtitulo: l.situacaoGeral || "",
        resumo: l.condicoesObs || l.riscoDescricao || "",
        detalhes: [
          { rotulo: "Data da fiscalização", valor: dataBR(l.dataFiscalizacao) },
          { rotulo: "Responsável", valor: [l.responsavelNome, l.responsavelCargo].filter(Boolean).join(" — ") },
          { rotulo: "Animal (na data)", valor: [l.animalNome, l.animalEspecie, l.animalSexo, l.animalIdade].filter(Boolean).join(" · ") },
          { rotulo: "Raça / pelagem (na data)", valor: l.animalRacaPelagem || "" },
          { rotulo: "Identificação (na data)", valor: l.animalIdentificacao || "" },
          { rotulo: "Tutor (na data)", valor: l.tutorNome || "" },
          { rotulo: "Apresenta lesões", valor: l.apresentaLesoes || "" },
          { rotulo: "Quais lesões", valor: l.quaisLesoes || "" },
          { rotulo: "Em tratamento", valor: l.emTratamento || "" },
          { rotulo: "Início do tratamento", valor: dataBR(l.tratamentoInicio) },
          { rotulo: "Profissional de referência", valor: l.profissionalRef || "" },
          { rotulo: "Medicamentos", valor: l.medicamentos || "" },
          { rotulo: "Posologia correta", valor: l.posologiaCorreta || "" },
          { rotulo: "Interrupção do tratamento", valor: l.interrupcao || "" },
          { rotulo: "Motivo da interrupção", valor: l.interrupcaoMotivo || "" },
          { rotulo: "Retorno veterinário", valor: l.retornoVeterinario || "" },
          { rotulo: "Data do retorno", valor: dataBR(l.retornoData) },
          { rotulo: "Coleira repelente", valor: l.coleiraRepelente || "" },
          { rotulo: "Troca da coleira", valor: l.coleiraTroca || "" },
          { rotulo: "Produtos de higiene", valor: l.produtosHigiene || "" },
          { rotulo: "Frequência da higiene", valor: l.frequenciaHigiene || "" },
          { rotulo: "Acesso a área rural", valor: l.acessoAreaRural || "" },
          { rotulo: "Deslocamento para outro município", valor: l.deslocamento || "" },
          { rotulo: "Quando", valor: l.deslocamentoQuando || "" },
          { rotulo: "Outros animais", valor: l.outrosAnimais || "" },
          { rotulo: "Descrição dos outros animais", valor: l.outrosAnimaisDesc || "" },
          { rotulo: "Outros animais com lesões", valor: l.outrosComLesoes || "" },
          { rotulo: "Pessoas com lesões", valor: l.pessoasComLesoes || "" },
          { rotulo: "Pessoas orientadas", valor: l.pessoasOrientadas || "" },
          { rotulo: "Condições sanitárias", valor: l.condicoesSanitarias || "" },
          { rotulo: "Observações do ambiente", valor: l.condicoesObs || "", largo: true },
          { rotulo: "Risco de disseminação", valor: l.riscoDisseminacao || "" },
          { rotulo: "Risco à saúde pública", valor: l.riscoSaudePublica || "" },
          { rotulo: "Descrição dos riscos", valor: l.riscoDescricao || "", largo: true },
          { rotulo: "Comprometimento do tutor", valor: l.comprometimento || "" },
          { rotulo: "Conduta do tutor", valor: l.condutaTutor || "" },
          { rotulo: "Situação geral", valor: l.situacaoGeral || "" },
          { rotulo: "Acompanhamento pelo CCZ", valor: l.encAcompanhamento ? "Sim" : "Não" },
          { rotulo: "Notificação ao tutor", valor: l.encNotificacao ? "Sim" : "Não" },
          { rotulo: "Outras medidas", valor: l.encOutrasDescricao || (l.encOutrasMedidas ? "Sim" : "Não") },
        ],
      });
    }

    for (const d of animal.denuncias || []) {
      const local = [d.logradouro, d.numero, d.bairro].filter(Boolean).join(", ");
      historico.push({
        chave: `DENUNCIA:${d.id}`,
        origem: "DENUNCIA",
        origemId: d.id,
        data: ISO_DIA(d.dataDenuncia),
        tipo: "Denúncia",
        titulo: "Denúncia",
        subtitulo: d.status || "",
        resumo: local || d.descricaoCao || "",
        detalhes: [
          { rotulo: "Data da denúncia", valor: dataBR(d.dataDenuncia) },
          { rotulo: "Status", valor: d.status || "" },
          { rotulo: "Localização", valor: local },
          { rotulo: "Tipo", valor: d.tipo || "" },
          { rotulo: "Descrição do animal", valor: d.descricaoCao || "" },
          { rotulo: "Relato", valor: d.relato || "", largo: true },
          { rotulo: "Causou risco", valor: d.causouRisco || "" },
        ],
      });
    }

    historico.push({
      chave: `CADASTRO:${animal.id}`,
      origem: "CADASTRO",
      origemId: animal.id,
      data: ISO_DIA(animal.dataCadastro),
      tipo: "Cadastro",
      titulo: "Cadastro do animal no CCZ",
      subtitulo: "",
      resumo: "Registro inicial criado no módulo CCZ",
      detalhes: [
        { rotulo: "ID CCZ", valor: animal.id },
        { rotulo: "Nome", valor: animal.nome || "" },
        { rotulo: "Espécie", valor: animal.especie || "" },
        { rotulo: "Sexo", valor: animal.sexo === "F" ? "Fêmea" : "Macho" },
        { rotulo: "Porte", valor: animal.porte || "" },
        { rotulo: "Idade no cadastro", valor: animal.idade || "" },
        { rotulo: "Data do cadastro", valor: dataBR(animal.dataCadastro) },
        { rotulo: "Tutor no cadastro", valor: pessoa?.nomeCompleto || "Sem tutor" },
      ],
    });

    // Mais recente primeiro; registros sem data vão para o fim.
    historico.sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));

    const data = {
      animal: {
        id: animal.id,
        nome: animal.nome || "",
        especie: animal.especie || "",
        sexo: animal.sexo === "F" ? "Fêmea" : "Macho",
        porte: animal.porte || "",
        idade: animal.idade || "",
        racaPelagem: animal.racaPelagem || "",
        possuiIdentificacao: animal.possuiIdentificacao || "Não",
        castrado: animal.castrado || "Não",
        doencaCronica: animal.doencaCronica || "Não",
        qualDoenca,
        apetiteNormal: animal.apetiteNormal || "Sim",
        sintomasVomitoDiarreia: animal.sintomasVomitoDiarreia || "Não",
        emTratamento: animal.emTratamento || "Não",
        qualTratamento: animal.qualTratamento || "",
        observacoes,
        possuiResponsavel: animal.possuiResponsavel || "Não",
        fotoUrl: animal.fotoUrl || "",
        situacao: animal.situacao || "",
        dataCadastro: animal.dataCadastro ? animal.dataCadastro.toISOString() : null,
      },
      tutor: pessoa
        ? {
            cpf: pessoa.cpf || "",
            nome: pessoa.nomeCompleto || "",
            telefone: pessoa.telefone || "",
            cns: pessoa.cns || "",
            endereco: enderecoTexto,
          }
        : null,
      historico,
    };

    await registrarAuditoria({
      user: usuario,
      acao: "OUTRO",
      modulo: "CCZ",
      entidade: "Animal",
      entidadeId: id,
      descricao: "Acesso à ficha completa do animal",
    });

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter ficha completa do animal (CCZ):", error);
    return { success: false, error: "Erro ao carregar a ficha do animal." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCEDIMENTOS DO ANIMAL (ccz_procedimentos)
// ─────────────────────────────────────────────────────────────────────────
// Tipos válidos (dropdown). Status: Agendado | Realizado | Cancelado.
// O "retorno Sim/Não" é só da UI: quando "Não", dataRetorno fica null.
// ═══════════════════════════════════════════════════════════════════════════

const TIPOS_PROCEDIMENTO = [
  "Castração",
  "Vacinação",
  "Vermifugação",
  "Cirurgia",
  "Consulta",
  "Exame",
  "Internação",
  "Eutanásia",
];
const STATUS_PROCEDIMENTO = ["Agendado", "Realizado", "Cancelado"];

// Converte 'YYYY-MM-DD' em Date UTC (coluna @db.Date), sem desvio de fuso.
const ymdParaDateUTC = (ymd) => {
  const [a, m, d] = String(ymd || "").split("-").map(Number);
  if (!a || !m || !d) return null;
  return new Date(Date.UTC(a, m - 1, d));
};
const dateParaYMD = (data) => (data ? new Date(data).toISOString().slice(0, 10) : "");

// ── SALVAR PROCEDIMENTO (cria ou atualiza) ──────────────────────────────────
export async function salvarProcedimento(dados) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const animalId = String(dados.animalId || "").trim();
    if (!animalId) return { success: false, error: "Selecione o animal." };

    const tipo = String(dados.tipo || "").trim();
    if (!TIPOS_PROCEDIMENTO.includes(tipo)) {
      return { success: false, error: "Selecione um tipo de procedimento válido." };
    }

    const dataProcedimento = ymdParaDateUTC(dados.dataProcedimento);
    if (!dataProcedimento) {
      return { success: false, error: "Informe a data do procedimento." };
    }

    const status = STATUS_PROCEDIMENTO.includes(dados.status) ? dados.status : "Agendado";

    // Retorno: só grava a data quando "Sim" e a data foi informada.
    const temRetorno = dados.temRetorno === "Sim";
    const dataRetorno = temRetorno ? ymdParaDateUTC(dados.dataRetorno) : null;
    if (temRetorno && !dataRetorno) {
      return { success: false, error: "Informe a data de retorno." };
    }

    // Id: usa o informado (edição) ou gera um novo.
    const idInformado = dados.id ? String(dados.id).trim() : "";
    const id = (idInformado || `PRO-${Date.now().toString(36)}`).toUpperCase().slice(0, 50);

    // O animal precisa existir.
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true },
    });
    if (!animal) return { success: false, error: "Animal não encontrado." };

    const dadosProc = {
      animalId,
      tipo,
      dataProcedimento,
      // Sem veterinário informado, registra o usuário autenticado responsável.
      veterinario: String(dados.veterinario || user?.nome || "").slice(0, 150) || null,
      status,
      descricao: dados.descricao ? String(dados.descricao) : null,
      medicacaoPrescrita: dados.medicacaoPrescrita ? String(dados.medicacaoPrescrita) : null,
      dataRetorno,
    };

    await prisma.cadastroProcedimento.upsert({
      where: { id },
      update: dadosProc,
      create: { id, ...dadosProc },
    });

    await registrarAuditoria({
      user,
      acao: idInformado ? "EDITAR" : "CRIAR",
      modulo: "CCZ",
      entidade: "Procedimento",
      entidadeId: id,
      descricao: `Procedimento '${tipo}' ${idInformado ? "atualizado" : "cadastrado"} (animal ${animalId})`,
      detalhes: { tipo, status },
    });

    revalidatePath("/ccz");
    return { success: true, data: { id } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    if (error.code === "P2003") {
      return { success: false, error: "Animal selecionado inválido ou inexistente." };
    }
    console.error("Erro ao salvar procedimento (CCZ):", error);
    return { success: false, error: error.message || "Erro ao salvar procedimento." };
  }
}

// ── LISTAR PROCEDIMENTOS (aba Procedimentos > Lista) ────────────────────────
export async function listarProcedimentos() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const procedimentos = await prisma.cadastroProcedimento.findMany({
      include: { animal: { include: { tutor: { include: { pessoa: true } } } } },
      orderBy: { dataProcedimento: "desc" },
    });

    const data = procedimentos.map((p) => ({
      id: p.id,
      animalId: p.animalId,
      animalNome: p.animal?.nome || "",
      tutorNome: p.animal?.tutor?.pessoa?.nomeCompleto || "",
      tipo: p.tipo,
      dataProcedimento: dateParaYMD(p.dataProcedimento),
      veterinario: p.veterinario || "",
      status: p.status || "Agendado",
      descricao: p.descricao || "",
      medicacaoPrescrita: p.medicacaoPrescrita || "",
      dataRetorno: dateParaYMD(p.dataRetorno),
    }));

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao listar procedimentos (CCZ):", error);
    return { success: false, error: "Erro ao carregar os procedimentos." };
  }
}

// ── OBTER UM PROCEDIMENTO (para edição) ─────────────────────────────────────
export async function obterProcedimento(id) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const procId = String(id || "").trim();
    if (!procId) return { success: false, error: "Id do procedimento não informado." };

    const p = await prisma.cadastroProcedimento.findUnique({
      where: { id: procId },
      include: { 
        animal: { 
          include: { 
            tutor: { 
              include: { 
                pessoa: {
                  include: {
                    enderecos: {
                      where: { enderecoAtual: true },
                      take: 1
                    }
                  }
                }
              } 
            } 
          } 
        } 
      },
    });
    if (!p) return { success: false, error: "Procedimento não encontrado." };

    const dataRetorno = dateParaYMD(p.dataRetorno);
    
    const tutorPessoa = p.animal?.tutor?.pessoa || null;
    const enderecoPrincipal = tutorPessoa?.enderecos?.[0] || null;

    // Formatar endereço completo
    let enderecoFormatado = "";
    if (enderecoPrincipal) {
      const partes = [];
      if (enderecoPrincipal.logradouro) partes.push(enderecoPrincipal.logradouro);
      if (enderecoPrincipal.numero) partes.push(`nº ${enderecoPrincipal.numero}`);
      if (enderecoPrincipal.complemento) partes.push(enderecoPrincipal.complemento);
      if (enderecoPrincipal.bairro) partes.push(enderecoPrincipal.bairro);
      if (enderecoPrincipal.cidade) partes.push(enderecoPrincipal.cidade);
      if (enderecoPrincipal.uf) partes.push(enderecoPrincipal.uf);
      if (enderecoPrincipal.cep) partes.push(`CEP ${enderecoPrincipal.cep}`);
      enderecoFormatado = partes.join(", ");
    }

    const data = {
      id: p.id,
      animalId: p.animalId,
      animalNome: p.animal?.nome || "",
      animalEspecie: p.animal?.especie || "",
      animalSexo: p.animal?.sexo === "F" ? "Fêmea" : p.animal?.sexo === "M" ? "Macho" : "",
      animalPorte: p.animal?.porte || "",
      animalIdade: p.animal?.idade || "",
      animalRaca: p.animal?.raca || "",
      animalLabel: `${p.animal?.nome?.trim() || "Sem nome"} (${p.animalId})`,
      tutorNome: tutorPessoa?.nomeCompleto || "",
      tutorTelefone: tutorPessoa?.telefone || "",
      tipo: p.tipo,
      dataProcedimento: dateParaYMD(p.dataProcedimento),
      veterinario: p.veterinario || "",
      status: p.status || "Agendado",
      descricao: p.descricao || "",
      medicacaoPrescrita: p.medicacaoPrescrita || "",
      temRetorno: dataRetorno ? "Sim" : "Não",
      dataRetorno,
      // Adicionar objetos completos para geração de termos
      animal: p.animal ? {
        id: p.animal.id,
        nome: p.animal.nome,
        especie: p.animal.especie,
        raca: p.animal.raca,
        sexo: p.animal.sexo === "F" ? "Fêmea" : p.animal.sexo === "M" ? "Macho" : "",
        porte: p.animal.porte || "",
        idade: p.animal.idade || "",
        racaPelagem: p.animal.racaPelagem || "",
        possuiIdentificacao: p.animal.possuiIdentificacao || "",
        situacao: p.animal.situacao || "",
      } : null,
      tutor: tutorPessoa ? {
        nome: tutorPessoa.nomeCompleto,
        cpf: tutorPessoa.cpf,
        telefone: tutorPessoa.telefone,
        endereco: enderecoFormatado,
      } : null,
    };

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter procedimento (CCZ):", error);
    return { success: false, error: "Erro ao carregar o procedimento." };
  }
}

// ── EXCLUIR PROCEDIMENTO ────────────────────────────────────────────────────
export async function excluirProcedimento(id) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const procId = String(id || "").trim();
    if (!procId) return { success: false, error: "ID do procedimento não informado." };

    // Verifica se o procedimento existe
    const procedimento = await prisma.cadastroProcedimento.findUnique({
      where: { id: procId },
    });

    if (!procedimento) {
      return { success: false, error: "Procedimento não encontrado." };
    }

    // Remove o procedimento
    await prisma.cadastroProcedimento.delete({
      where: { id: procId },
    });

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "CCZ",
      entidade: "Procedimento",
      entidadeId: procId,
      descricao: `Procedimento '${procedimento.tipo}' excluído (animal ${procedimento.animalId})`,
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao excluir procedimento (CCZ):", error);
    return { success: false, error: "Erro ao excluir o procedimento." };
  }
}

// ── AGENDA DO CCZ (derivada dos procedimentos) ──────────────────────────────
// Monta os eventos do mês a partir dos procedimentos:
//  • status "Agendado"  → evento na data do procedimento;
//  • dataRetorno != null → evento de retorno nessa data.
// Não há tabela de agenda separada: a agenda reflete sempre os procedimentos.
export async function getAgendaProcedimentos(ano, mes) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const y = Number(ano);
    const m = Number(mes); // 1-12
    if (!y || !m) return { success: true, data: [] };

    // Janela do mês em UTC (coluna @db.Date). Inclui procedimentos cuja data
    // OU data de retorno caia dentro do mês.
    const inicio = new Date(Date.UTC(y, m - 1, 1));
    const fim = new Date(Date.UTC(y, m, 1)); // 1º dia do mês seguinte

    const procedimentos = await prisma.cadastroProcedimento.findMany({
      where: {
        OR: [
          { dataProcedimento: { gte: inicio, lt: fim } },
          { dataRetorno: { gte: inicio, lt: fim } },
        ],
      },
      include: { animal: { include: { tutor: { include: { pessoa: true } } } } },
      orderBy: { dataProcedimento: "asc" },
    });

    const dentroDoMes = (data) => {
      if (!data) return false;
      const t = new Date(data).getTime();
      return t >= inicio.getTime() && t < fim.getTime();
    };

    const eventos = [];
    for (const p of procedimentos) {
      const animalNome = p.animal?.nome || "";
      const tutorNome = p.animal?.tutor?.pessoa?.nomeCompleto || "";

      // Evento do procedimento (só quando AGENDADO) na data do procedimento.
      if (p.status === "Agendado" && dentroDoMes(p.dataProcedimento)) {
        eventos.push({
          procedimentoId: p.id,
          tipoEvento: "PROCEDIMENTO",
          data: dateParaYMD(p.dataProcedimento),
          tipo: p.tipo,
          status: p.status,
          animalId: p.animalId,
          animalNome,
          tutorNome,
          veterinario: p.veterinario || "",
        });
      }

      // Evento de RETORNO na data de retorno (independe do status).
      if (dentroDoMes(p.dataRetorno)) {
        eventos.push({
          procedimentoId: p.id,
          tipoEvento: "RETORNO",
          data: dateParaYMD(p.dataRetorno),
          tipo: p.tipo,
          status: p.status,
          animalId: p.animalId,
          animalNome,
          tutorNome,
          veterinario: p.veterinario || "",
        });
      }
    }

    // Visitas de acompanhamento da esporotricose caindo dentro do mês. Esses
    // eventos não têm procedimento (procedimentoId null) e, por isso, não
    // abrem nada na agenda (o botão "Abrir" é guardado por procedimentoId).
    // Incluímos o relatório para verificar se já foi preenchido.
    const visitasEsporo = await prisma.esporotricoseVisita.findMany({
      where: { data: { gte: inicio, lt: fim } },
      include: {
        esporotricose: {
          include: { animal: { include: { tutor: { include: { pessoa: true } } } } },
        },
        relatorio: { select: { id: true } }, // Apenas ID para verificar existência
      },
      orderBy: { data: "asc" },
    });

    for (const v of visitasEsporo) {
      const animal = v.esporotricose?.animal || null;
      const animalNome = animal?.nome || "";
      const tutorNome = animal?.tutor?.pessoa?.nomeCompleto || "";
      const temRelatorio = Boolean(v.relatorio); // Verifica se já tem relatório
      
      eventos.push({
        procedimentoId: null,
        visitaId: v.id, // ID da visita para abrir o relatório
        tipoEvento: "ESPORO_VISITA",
        data: dateParaYMD(v.data),
        animalId: animal?.id || "",
        animalNome,
        tutorNome,
        observacao: v.observacao || "",
        label: `Esporotricose — acompanhamento (${animalNome || "Sem nome"})`,
        temRelatorio, // Nova propriedade
      });
    }

    return { success: true, data: eventos };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao carregar a agenda (CCZ):", error);
    return { success: false, error: "Erro ao carregar a agenda." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMO DE INTERNAÇÃO (ccz_termos_internacao) — um termo por internação
// ═══════════════════════════════════════════════════════════════════════════

// Carrega os dados necessários do termo de uma internação: dados do animal,
// do tutor (se houver) e o termo já salvo (se existir). Pré-preenche o
// responsável com o tutor quando ainda não há termo.
export async function obterDadosTermoInternacao(procedimentoId) {
  try {
    const usuario = await requireAcessoModulo(MODULOS.CCZ);

    const procId = String(procedimentoId || "").trim();
    if (!procId) return { success: false, error: "Procedimento não informado." };

    const proc = await prisma.cadastroProcedimento.findUnique({
      where: { id: procId },
      include: {
        animal: { include: { tutor: { include: { pessoa: true } } } },
        termo: true,
      },
    });
    if (!proc) return { success: false, error: "Procedimento não encontrado." };
    if (proc.tipo !== "Internação") {
      return { success: false, error: "Este procedimento não é uma internação." };
    }

    const a = proc.animal;
    const tutorPessoa = a?.tutor?.pessoa || null;
    const termo = proc.termo;

    // "Doença crônica: ..." concatenada em observacoes — separa de volta.
    let qualDoenca = "";
    let observacoes = a?.observacoes || "";
    const m = observacoes.match(/^Doença crônica:\s*(.*)(?:\n([\s\S]*))?$/);
    if (a?.doencaCronica === "Sim" && m) {
      qualDoenca = (m[1] || "").trim();
      observacoes = (m[2] || "").trim();
    }

    const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
    const hoje = new Date().toISOString().slice(0, 10);

    return {
      success: true,
      data: {
        procedimentoId: proc.id,
        animal: {
          id: a?.id || "",
          fotoUrl: a?.fotoUrl || "",
          nome: a?.nome || "",
          especie: a?.especie || "",
          sexo: a?.sexo === "F" ? "Fêmea" : "Macho",
          porte: a?.porte || "",
          idade: a?.idade || "",
          castrado: a?.castrado || "Não",
          doencaCronica: a?.doencaCronica || "Não",
          qualDoenca,
          observacoes,
        },
        temTutor: Boolean(tutorPessoa),
        tutorNome: tutorPessoa?.nomeCompleto || "",
        tutor: tutorPessoa
          ? {
              cpf: tutorPessoa.cpf,
              nome: tutorPessoa.nomeCompleto || "",
              telefone: tutorPessoa.telefone || "",
            }
          : null,
        procedimento: {
          tipo: proc.tipo,
          dataProcedimento: ymd(proc.dataProcedimento),
          veterinario: proc.veterinario || "",
          status: proc.status || "Agendado",
        },
        // Termo salvo (ou valores iniciais).
        termo: termo
          ? {
              id: termo.id,
              responsavelNome: termo.responsavelNome,
              responsavelCpf: termo.responsavelCpf || "",
              seraAdotado: termo.seraAdotado || "Não",
              dataTermo: ymd(termo.dataTermo),
              cidade: termo.cidade || "Muriaé",
            }
          : {
              id: null,
              // Pré-preenche com o tutor, quando houver.
              responsavelNome: tutorPessoa?.nomeCompleto || "",
              responsavelCpf: tutorPessoa?.cpf || "",
              seraAdotado: "Não",
              dataTermo: hoje,
              cidade: "Muriaé",
            },
      },
    };
    // Auditoria: o termo traz dados do tutor e do procedimento (dados pessoais).
    await registrarAuditoria({
      user: usuario,
      acao: "OUTRO",
      modulo: "CCZ",
      entidade: "TermoInternacao",
      entidadeId: procId,
      descricao: "Acesso aos dados do termo de internação",
    });

  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter dados do termo (CCZ):", error);
    return { success: false, error: "Erro ao carregar o termo de internação." };
  }
}

// Salva (cria ou atualiza) o termo de internação de um procedimento.
export async function salvarTermoInternacao(dados) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const procId = String(dados.procedimentoId || "").trim();
    if (!procId) return { success: false, error: "Procedimento não informado." };

    const proc = await prisma.cadastroProcedimento.findUnique({
      where: { id: procId },
      select: { id: true, animalId: true, tipo: true },
    });
    if (!proc) return { success: false, error: "Procedimento não encontrado." };
    if (proc.tipo !== "Internação") {
      return { success: false, error: "Este procedimento não é uma internação." };
    }

    const responsavelNome = String(dados.responsavelNome || "").trim();
    if (!responsavelNome) {
      return { success: false, error: "Informe o nome do responsável/depositante." };
    }

    const dataTermo = ymdParaDateUTC(dados.dataTermo);
    if (!dataTermo) return { success: false, error: "Informe a data do termo." };

    const dadosTermo = {
      animalId: proc.animalId,
      responsavelNome: responsavelNome.slice(0, 150),
      responsavelCpf: dados.responsavelCpf
        ? soDigitos(dados.responsavelCpf).slice(0, 14)
        : null,
      seraAdotado: dados.seraAdotado === "Sim" ? "Sim" : "Não",
      dataTermo,
      cidade: dados.cidade ? String(dados.cidade).slice(0, 100) : "Muriaé",
    };

    await prisma.termoInternacao.upsert({
      where: { procedimentoId: procId },
      update: dadosTermo,
      create: { procedimentoId: procId, ...dadosTermo },
    });

    await registrarAuditoria({
      user,
      acao: "SALVAR",
      modulo: "CCZ",
      entidade: "TermoInternacao",
      entidadeId: procId,
      descricao: `Termo de internação salvo (animal ${proc.animalId})`,
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao salvar termo de internação (CCZ):", error);
    return { success: false, error: error.message || "Erro ao salvar o termo." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ESPOROTRICOSE (ccz_esporotricose + ccz_esporotricose_visitas)
// ─────────────────────────────────────────────────────────────────────────
// Vistoria/notificação de esporotricose vinculada a um animal. Campos Sim/Não
// são persistidos como string ("Sim"/"Não", default "Não"); os encaminhamentos
// (enc*) como boolean. Os blocos "tutor-only" só fazem sentido quando o animal
// tem tutor, mas o salvamento aceita o que vier do form. As visitas de
// acompanhamento são salvas apenas quando o encaminhamento de acompanhamento
// periódico pelo CCZ está marcado (padrão replace-vínculos: delete + create).
// Retorno padrão: { success, error?, data? }.
// ═══════════════════════════════════════════════════════════════════════════

// Normaliza um Sim/Não vindo do form (default "Não").
const simNao = (v) => (v === "Sim" ? "Sim" : "Não");

// ── SALVAR ESPOROTRICOSE (cria ou atualiza) ─────────────────────────────────
export async function salvarEsporotricose(dados) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const animalId = String(dados.animalId || "").trim();
    if (!animalId) return { success: false, error: "Selecione o animal." };

    const dataVisita = ymdParaDateUTC(dados.dataVisita);
    if (!dataVisita) return { success: false, error: "Informe a data da visita." };

    // Id: usa o informado (edição) ou gera um novo.
    const idInformado = dados.id ? String(dados.id).trim() : "";
    const id = (idInformado || `ESP-${Date.now().toString(36)}`).toUpperCase().slice(0, 50);

    // O animal precisa existir.
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true },
    });
    if (!animal) return { success: false, error: "Animal não encontrado." };

    const encAcompanhamentoCcz = Boolean(dados.encAcompanhamentoCcz);

    const dadosEsporo = {
      animalId,
      dataVisita,
      fiscalResponsavel: dados.fiscalResponsavel
        ? String(dados.fiscalResponsavel).slice(0, 150)
        : null,
      apresentaLesoes: simNao(dados.apresentaLesoes),
      descricaoLesoes:
        dados.apresentaLesoes === "Sim" && dados.descricaoLesoes
          ? String(dados.descricaoLesoes)
          : null,
      emTratamentoVeterinario: simNao(dados.emTratamentoVeterinario),
      descricaoTratamentoVet:
        dados.emTratamentoVeterinario === "Sim" && dados.descricaoTratamentoVet
          ? String(dados.descricaoTratamentoVet)
          : null,
      medicamentosPrescritos: dados.medicamentosPrescritos
        ? String(dados.medicamentosPrescritos)
        : null,
      interrupcaoTratamento: simNao(dados.interrupcaoTratamento),
      retornoVeterinario: simNao(dados.retornoVeterinario),
      isolamentoDomiciliar: simNao(dados.isolamentoDomiciliar),
      observacoesIsolamento:
        dados.isolamentoDomiciliar === "Sim" && dados.observacoesIsolamento
          ? String(dados.observacoesIsolamento)
          : null,
      acessoRua: simNao(dados.acessoRua),
      usoEpi: simNao(dados.usoEpi),
      quaisEpis:
        dados.usoEpi === "Sim" && dados.quaisEpis
          ? String(dados.quaisEpis).slice(0, 150)
          : null,
      higienizacaoAmbiente: dados.higienizacaoAmbiente
        ? String(dados.higienizacaoAmbiente)
        : null,
      outrosAnimaisResidencia: simNao(dados.outrosAnimaisResidencia),
      outrosAnimaisDescricao:
        dados.outrosAnimaisResidencia === "Sim" && dados.outrosAnimaisDescricao
          ? String(dados.outrosAnimaisDescricao)
          : null,
      pessoasComLesoes: simNao(dados.pessoasComLesoes),
      pessoasLesoesDescricao: dados.pessoasLesoesDescricao
        ? String(dados.pessoasLesoesDescricao)
        : null,
      cienteTratamentoContinuo: simNao(dados.cienteTratamentoContinuo),
      cienteContencao: simNao(dados.cienteContencao),
      cienteEpi: simNao(dados.cienteEpi),
      cienteResiduos: simNao(dados.cienteResiduos),
      condicoesGeraisAmbiente: dados.condicoesGeraisAmbiente
        ? String(dados.condicoesGeraisAmbiente)
        : null,
      conclusaoTecnica: dados.conclusaoTecnica ? String(dados.conclusaoTecnica) : null,
      encAcompanhamentoCcz,
      encNotificacaoTutor: Boolean(dados.encNotificacaoTutor),
      encMinisterioPublico: Boolean(dados.encMinisterioPublico),
      encOutrasMedidas: Boolean(dados.encOutrasMedidas),
      outrasMedidasDescricao: dados.outrasMedidasDescricao
        ? String(dados.outrasMedidasDescricao)
        : null,
    };

    // Visitas válidas (apenas as que têm data). Só persistidas quando o
    // acompanhamento periódico pelo CCZ está marcado.
    const visitasValidas = encAcompanhamentoCcz
      ? (Array.isArray(dados.visitas) ? dados.visitas : [])
          .map((v) => ({ data: ymdParaDateUTC(v.data), observacao: v.observacao || null }))
          .filter((v) => v.data)
      : [];

    await prisma.$transaction(async (tx) => {
      // Upsert do registro principal
      await tx.esporotricose.upsert({
        where: { id },
        update: dadosEsporo,
        create: { id, ...dadosEsporo },
      });

      // Replace-vínculos: limpa e recria as visitas de acompanhamento.
      await tx.esporotricoseVisita.deleteMany({ where: { esporotricoseId: id } });
      if (visitasValidas.length > 0) {
        await tx.esporotricoseVisita.createMany({
          data: visitasValidas.map((v) => ({
            esporotricoseId: id,
            data: v.data,
            observacao: v.observacao,
          })),
        });
      }
    });

    await registrarAuditoria({
      user,
      acao: idInformado ? "EDITAR" : "CRIAR",
      modulo: "CCZ",
      entidade: "Esporotricose",
      entidadeId: id,
      descricao: `Registro de esporotricose ${idInformado ? "atualizado" : "cadastrado"} (animal ${animalId})`,
    });

    // Revalida MÚLTIPLAS rotas para garantir atualização
    revalidatePath("/ccz");
    revalidatePath("/ccz", "layout"); // Revalida layout também
    
    return { success: true, data: { id } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    if (error.code === "P2003") {
      return { success: false, error: "Animal selecionado inválido ou inexistente." };
    }
    console.error("Erro ao salvar esporotricose (CCZ):", error);
    return { success: false, error: error.message || "Erro ao salvar a esporotricose." };
  }
}

// ── LISTAR ESPOROTRICOSE (aba Esporotricose > Lista) ────────────────────────
export async function listarEsporotricose() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const registros = await prisma.esporotricose.findMany({
      include: {
        animal: { include: { tutor: { include: { pessoa: true } } } },
        _count: { select: { visitas: true } },
      },
      orderBy: { dataVisita: "desc" },
    });

    const data = registros.map((r) => ({
      id: r.id,
      animalId: r.animalId || "",
      animalNome: r.animal?.nome || "",
      animalFotoUrl: r.animal?.fotoUrl || "",
      tutorNome: r.animal?.tutor?.pessoa?.nomeCompleto || "",
      dataVisita: dateParaYMD(r.dataVisita),
      apresentaLesoes: r.apresentaLesoes || "Não",
      visitasCount: r._count?.visitas || 0,
      encerrado: Boolean(r.encerrado),
    }));

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao listar esporotricose (CCZ):", error);
    return { success: false, error: "Erro ao carregar os registros de esporotricose." };
  }
}

// ── OBTER UM REGISTRO DE ESPOROTRICOSE (edição / PDF / termo) ───────────────
// Conversão de dia local (UTC-3) para o intervalo UTC usado nos filtros de
// data das consultas do CCZ (animais e esporotricose).
const ESPORO_PAGINA_TAMANHO = 100;
const ESPORO_FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;

function esporoDiaParaUtc(valor, limite) {
  const t = String(valor || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - ESPORO_FUSO_OFFSET_MS + (limite === "fim" ? 86400000 - 1 : 0));
}

// ── CONSULTAR ANIMAIS (filtros + paginação no backend) ──────────────────────
// Padrão da Consulta de Leishmaniose/Esporotricose: busca suspensa (nome/ID do
// animal, espécie, nome/CPF do tutor), período do cadastro, espécie, situação
// do animal e bairro do tutor. 100 por página, do mais recente ao mais antigo.
const ANIMAL_PAGINA_TAMANHO = 100;

export async function consultarAnimais(filtros = {}) {
  try {
    await requirePermissao(MODULOS.CCZ, "animais", "visualizar");

    // Busca textual em SQL raw: o LIKE do Postgres trata "-" e "/" dos IDs
    // (ANM-MW0VGH4F, 161/26) como texto comum; o operador `contains` do Prisma
    // gera um padrão que casa registros indevidos com esses caracteres.
    const termo = String(filtros.busca || "").trim();
    const termoDigitos = soDigitos(termo);
    const AND = [];

    if (termo) {
      AND.push(Prisma.sql`(
        a.nome ILIKE '%' || ${termo} || '%'
        OR a.id ILIKE '%' || ${termo} || '%'
        OR a.especie ILIKE '%' || ${termo} || '%'
        OR EXISTS (SELECT 1 FROM public.pessoa p
                    WHERE p.cpf = a.pessoa_cpf
                      AND p.nome_completo ILIKE '%' || ${termo} || '%')
        ${termoDigitos ? Prisma.sql`OR a.pessoa_cpf LIKE '%' || ${termoDigitos} || '%'` : Prisma.empty}
      )`);
    }

    const de = esporoDiaParaUtc(filtros.periodoInicio, "inicio");
    const ate = esporoDiaParaUtc(filtros.periodoFim, "fim");
    if (de) AND.push(Prisma.sql`a.data_cadastro >= ${de}`);
    if (ate) AND.push(Prisma.sql`a.data_cadastro <= ${ate}`);

    const especie = String(filtros.especie || "").trim();
    if (especie) AND.push(Prisma.sql`btrim(a.especie) = ${especie}`);

    // Situação do animal. "SEM_TUTOR" é derivada (não é coluna).
    const situacao = String(filtros.situacao || "").trim();
    if (situacao === "SEM_TUTOR") AND.push(Prisma.sql`a.pessoa_cpf IS NULL`);
    else if (situacao) AND.push(Prisma.sql`a.situacao = ${situacao}`);

    // Sexo e Porte: colunas gravadas como texto ("M"/"F", "Pequeno"...).
    const sexo = String(filtros.sexo || "").trim();
    if (sexo) AND.push(Prisma.sql`btrim(a.sexo) = ${sexo}`);

    const porte = String(filtros.porte || "").trim();
    if (porte) AND.push(Prisma.sql`btrim(a.porte) = ${porte}`);

    const bairroFiltro = String(filtros.bairro || "").trim();
    if (bairroFiltro) {
      AND.push(Prisma.sql`EXISTS (
        SELECT 1 FROM public.pessoa_endereco pe
         WHERE pe.pessoa_cpf = a.pessoa_cpf
           AND pe.endereco_atual IS TRUE
           AND lower(btrim(pe.bairro)) = lower(${bairroFiltro}))`);
    }

    const where = AND.length
      ? Prisma.sql`WHERE ${Prisma.join(AND, " AND ")}`
      : Prisma.empty;

    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const offset = (pagina - 1) * ANIMAL_PAGINA_TAMANHO;

    const [totalRows, animais] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS total FROM public.ccz_animais a ${where}`),
      prisma.$queryRaw(Prisma.sql`
        SELECT a.id, a.nome, a.especie, a.sexo, a.situacao, a.data_cadastro,
               a.porte, a.idade, a.raca_pelagem, a.possui_identificacao,
               a.castrado, a.foto_url,
               p.nome_completo AS tutor_nome,
               (SELECT btrim(pe.bairro) FROM public.pessoa_endereco pe
                 WHERE pe.pessoa_cpf = a.pessoa_cpf AND pe.endereco_atual IS TRUE
                 LIMIT 1) AS bairro
          FROM public.ccz_animais a
          LEFT JOIN public.pessoa p ON p.cpf = a.pessoa_cpf
          ${where}
         ORDER BY a.data_cadastro DESC NULLS LAST, a.id
         LIMIT ${ANIMAL_PAGINA_TAMANHO} OFFSET ${offset}`),
    ]);

    const total = totalRows[0]?.total || 0;

    return {
      success: true,
      data: animais.map((a) => ({
        id: a.id,
        nome: a.nome || "",
        especie: a.especie || "",
        sexo: a.sexo === "F" ? "Fêmea" : "Macho",
        porte: a.porte || "",
        idade: a.idade || "",
        racaPelagem: a.raca_pelagem || "",
        possuiIdentificacao: a.possui_identificacao || "Não",
        castrado: a.castrado || "Não",
        fotoUrl: a.foto_url || "",
        tutorNome: a.tutor_nome || "",
        bairro: a.bairro || "",
        situacao: a.situacao || "",
        dataCadastro: a.data_cadastro ? new Date(a.data_cadastro).toISOString() : null,
      })),
      total,
      pagina,
      totalPaginas: Math.max(1, Math.ceil(total / ANIMAL_PAGINA_TAMANHO)),
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao consultar animais (CCZ):", error);
    return { success: false, error: "Erro ao consultar os animais." };
  }
}

// Opções dos filtros: espécies cadastradas e bairros dos tutores.
export async function obterFiltrosAnimais() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);
    const [especies, bairros] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(especie) AS valor FROM public.ccz_animais
        WHERE btrim(COALESCE(especie, '')) <> '' ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(pe.bairro) AS valor
          FROM public.ccz_animais a
          JOIN public.pessoa_endereco pe ON pe.pessoa_cpf = a.pessoa_cpf
         WHERE pe.endereco_atual IS TRUE AND btrim(COALESCE(pe.bairro, '')) <> ''
         ORDER BY 1`),
    ]);
    return {
      success: true,
      especies: especies.map((e) => e.valor),
      bairros: bairros.map((b) => b.valor),
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter filtros de animais (CCZ):", error);
    return { success: false, error: "Erro ao carregar as opções de filtro." };
  }
}

// ── CONSULTAR ESPOROTRICOSE (filtros + paginação no backend) ────────────────
// Padrão da Consulta de Leishmaniose: busca suspensa (nome/ID do animal,
// nome/CPF do tutor), período da visita, conclusão (Encerrado/Em andamento) e
// bairro do tutor (pessoa_endereco.endereco_atual). 100 por página, do mais
// recente para o mais antigo.
export async function listarEsporotricoseConsulta(filtros = {}) {
  try {
    await requirePermissao(MODULOS.CCZ, "zoonoses", "visualizar");

    const condicoes = [];
    const termo = String(filtros.busca || "").trim();
    if (termo) {
      const digitos = termo.replace(/\D/g, "");
      condicoes.push(Prisma.sql`(
        a.nome ILIKE ${"%" + termo + "%"} OR
        e.animal_id ILIKE ${"%" + termo + "%"} OR
        p.nome_completo ILIKE ${"%" + termo + "%"} OR
        replace(replace(replace(COALESCE(p.cpf, ''), '.', ''), '-', ''), ' ', '') ILIKE ${"%" + digitos + "%"})`);
    }
    const de = esporoDiaParaUtc(filtros.periodoInicio, "inicio");
    const ate = esporoDiaParaUtc(filtros.periodoFim, "fim");
    if (de) condicoes.push(Prisma.sql`e."dataVisita" >= ${de}`);
    if (ate) condicoes.push(Prisma.sql`e."dataVisita" <= ${ate}`);

    const conclusao = String(filtros.conclusao || "").trim().toUpperCase();
    if (conclusao === "ENCERRADO") condicoes.push(Prisma.sql`e.encerrado IS TRUE`);
    if (conclusao === "EM_ANDAMENTO") condicoes.push(Prisma.sql`e.encerrado IS NOT TRUE`);

    const bairro = String(filtros.bairro || "").trim();
    if (bairro) {
      condicoes.push(Prisma.sql`EXISTS (
        SELECT 1 FROM public.pessoa_endereco pe
         WHERE pe.pessoa_cpf = p.cpf
           AND pe.endereco_atual IS TRUE
           AND lower(btrim(COALESCE(pe.bairro, ''))) = lower(${bairro}))`);
    }

    const where = condicoes.length ? Prisma.join(condicoes, " AND ") : Prisma.sql`1=1`;
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const offset = (pagina - 1) * ESPORO_PAGINA_TAMANHO;
    const base = Prisma.sql`
      FROM public.ccz_esporotricose e
      LEFT JOIN public.ccz_animais a ON a.id = e.animal_id
      LEFT JOIN public.ccz_tutores t ON t.pessoa_cpf = a.pessoa_cpf
      LEFT JOIN public.pessoa p ON p.cpf = COALESCE(t.pessoa_cpf, a.pessoa_cpf)
      WHERE ${where}`;

    const [linhas, total] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT e.id, e."dataVisita", e.animal_id, e.encerrado, a.nome AS animal_nome, p.nome_completo AS tutor_nome
        ${base}
        ORDER BY e."dataVisita" DESC, e.created_at DESC
        LIMIT ${ESPORO_PAGINA_TAMANHO} OFFSET ${offset}`),
      prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS total ${base}`),
    ]);

    const totalNum = Number(total?.[0]?.total || 0);
    return {
      success: true,
      data: linhas.map((l) => ({
        id: l.id,
        dataVisita: l.dataVisita instanceof Date
          ? l.dataVisita.toISOString().slice(0, 10)
          : String(l.dataVisita).slice(0, 10),
        animalId: l.animal_id || "",
        animalNome: l.animal_nome || "",
        tutorNome: l.tutor_nome || "",
        encerrado: Boolean(l.encerrado),
      })),
      total: totalNum,
      pagina,
      totalPaginas: Math.max(1, Math.ceil(totalNum / ESPORO_PAGINA_TAMANHO)),
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao consultar esporotricose (CCZ):", error);
    return { success: false, error: "Erro ao consultar os registros de esporotricose." };
  }
}

// Opções dos filtros (bairros existentes no cadastro central dos tutores).
export async function obterFiltrosEsporotricose() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);
    const bairros = await prisma.$queryRaw(Prisma.sql`
      SELECT DISTINCT btrim(pe.bairro) AS valor
        FROM public.ccz_esporotricose e
        JOIN public.ccz_animais a ON a.id = e.animal_id
        LEFT JOIN public.ccz_tutores t ON t.pessoa_cpf = a.pessoa_cpf
        JOIN public.pessoa_endereco pe ON pe.pessoa_cpf = COALESCE(t.pessoa_cpf, a.pessoa_cpf)
       WHERE pe.endereco_atual IS TRUE AND btrim(COALESCE(pe.bairro, '')) <> ''
       ORDER BY 1`);
    return { success: true, bairros: bairros.map((b) => b.valor) };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter filtros de esporotricose (CCZ):", error);
    return { success: false, error: "Erro ao carregar as opções de filtro." };
  }
}

// ── PROCEDIMENTOS: CONSULTA PAGINADA NO BACKEND ─────────────────────────────
// Mesmo padrão de Esporotricose/Leishmaniose: filtros combinados por AND,
// 100 por página, mais recente primeiro. O termo é comparado com ILIKE para
// não casar registros indevidos quando o ID tem "-" ou "/" (mesmo motivo de
// consultarAnimais).
const PROCEDIMENTO_PAGINA_TAMANHO = 100;

export async function listarProcedimentosConsulta(filtros = {}) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const condicoes = [];
    const termo = String(filtros.busca || "").trim();
    if (termo) {
      const digitos = termo.replace(/\D/g, "");
      // p = ccz_procedimentos, a = ccz_animais, pp = pessoa (tutor)
      const partes = [
        Prisma.sql`a.nome ILIKE ${"%" + termo + "%"}`,
        Prisma.sql`p.id ILIKE ${"%" + termo + "%"}`,
        Prisma.sql`p.animal_id ILIKE ${"%" + termo + "%"}`,
        Prisma.sql`pp.nome_completo ILIKE ${"%" + termo + "%"}`,
      ];
      if (digitos) {
        partes.push(Prisma.sql`replace(replace(replace(COALESCE(pp.cpf, ''), '.', ''), '-', ''), ' ', '') ILIKE ${"%" + digitos + "%"}`);
      }
      condicoes.push(Prisma.sql`(${Prisma.join(partes, " OR ")})`);
    }

    const tipo = String(filtros.tipo || "").trim();
    if (tipo) condicoes.push(Prisma.sql`btrim(COALESCE(p.tipo, '')) = ${tipo}`);

    const responsavel = String(filtros.responsavel || "").trim();
    if (responsavel) condicoes.push(Prisma.sql`btrim(COALESCE(p.veterinario, '')) = ${responsavel}`);

    const status = String(filtros.status || "").trim();
    if (status) condicoes.push(Prisma.sql`btrim(COALESCE(p.status, '')) = ${status}`);

    const de = esporoDiaParaUtc(filtros.periodoInicio, "inicio");
    const ate = esporoDiaParaUtc(filtros.periodoFim, "fim");
    // data_procedimento é DATE: comparar com a data local (YYYY-MM-DD), sem fuso.
    const diaInicio = String(filtros.periodoInicio || "").trim();
    const diaFim = String(filtros.periodoFim || "").trim();
    if (de && /^\d{4}-\d{2}-\d{2}$/.test(diaInicio)) {
      condicoes.push(Prisma.sql`p.data_procedimento >= ${diaInicio}::date`);
    }
    if (ate && /^\d{4}-\d{2}-\d{2}$/.test(diaFim)) {
      condicoes.push(Prisma.sql`p.data_procedimento <= ${diaFim}::date`);
    }

    const where = condicoes.length ? Prisma.join(condicoes, " AND ") : Prisma.sql`1=1`;
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const offset = (pagina - 1) * PROCEDIMENTO_PAGINA_TAMANHO;
    const base = Prisma.sql`
      FROM public.ccz_procedimentos p
      LEFT JOIN public.ccz_animais a ON a.id = p.animal_id
      LEFT JOIN public.pessoa pp ON pp.cpf = a.pessoa_cpf
      WHERE ${where}`;

    const [linhas, total] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT p.id, p.data_procedimento, p.animal_id, p.tipo, p.status, p.veterinario,
               a.nome AS animal_nome, pp.nome_completo AS tutor_nome
        ${base}
        ORDER BY p.data_procedimento DESC NULLS LAST, p.created_at DESC, p.id
        LIMIT ${PROCEDIMENTO_PAGINA_TAMANHO} OFFSET ${offset}`),
      prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS total ${base}`),
    ]);

    const totalNum = Number(total?.[0]?.total || 0);
    return {
      success: true,
      data: linhas.map((l) => ({
        id: l.id,
        dataProcedimento: l.data_procedimento instanceof Date
          ? l.data_procedimento.toISOString().slice(0, 10)
          : String(l.data_procedimento || "").slice(0, 10),
        animalId: l.animal_id || "",
        animalNome: l.animal_nome || "",
        tutorNome: l.tutor_nome || "",
        tipo: l.tipo || "",
        status: l.status || "",
        veterinario: l.veterinario || "",
      })),
      total: totalNum,
      pagina,
      totalPaginas: Math.max(1, Math.ceil(totalNum / PROCEDIMENTO_PAGINA_TAMANHO)),
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao consultar procedimentos (CCZ):", error);
    return { success: false, error: "Erro ao consultar os procedimentos." };
  }
}

// Opções dos filtros — vêm dos valores REALMENTE gravados no cadastro.
export async function obterFiltrosProcedimentos() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);
    const [tipos, responsaveis, situacoes] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(tipo) AS valor FROM public.ccz_procedimentos
         WHERE btrim(COALESCE(tipo, '')) <> '' ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(veterinario) AS valor FROM public.ccz_procedimentos
         WHERE btrim(COALESCE(veterinario, '')) <> '' ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(status) AS valor FROM public.ccz_procedimentos
         WHERE btrim(COALESCE(status, '')) <> '' ORDER BY 1`),
    ]);
    return {
      success: true,
      tipos: tipos.map((t) => t.valor),
      responsaveis: responsaveis.map((t) => t.valor),
      situacoes: situacoes.map((t) => t.valor),
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter filtros de procedimentos (CCZ):", error);
    return { success: false, error: "Erro ao carregar as opções de filtro." };
  }
}

// ── DENÚNCIAS (CCZ) ──────────────────────────────────────────────────────
// Consulta paginada no backend (100 por página), no padrão das demais telas do
// CCZ. Uma linha = uma denúncia; o tipo (agressivo/doente) é filtro, não tela.
const DENUNCIA_PAGINA_TAMANHO = 100;
const DENUNCIA_FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;

// Data (YMD) → Date UTC do início do dia local (UTC-3).
function denunciaDiaParaUtc(dia, modo) {
  const valor = String(dia || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [a, m, d] = valor.split("-").map(Number);
  const base = Date.UTC(a, m - 1, d);
  if (Number.isNaN(base)) return null;
  return modo === "fim"
    ? new Date(base + 24 * 60 * 60 * 1000 - 1 + DENUNCIA_FUSO_OFFSET_MS)
    : new Date(base + DENUNCIA_FUSO_OFFSET_MS);
}

export async function listarDenunciasConsulta(filtros = {}) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const condicoes = [];

    // Busca unificada: ID, nome/ID do animal, descrição, relato, logradouro e
    // bairro. d = ccz_denuncias, a = ccz_animais.
    const termo = String(filtros.busca || "").trim();
    if (termo) {
      condicoes.push(Prisma.sql`(
        d.id ILIKE ${"%" + termo + "%"}
        OR a.nome ILIKE ${"%" + termo + "%"}
        OR d.animal_id ILIKE ${"%" + termo + "%"}
        OR d.descricao_cao ILIKE ${"%" + termo + "%"}
        OR d.relato ILIKE ${"%" + termo + "%"}
        OR d.logradouro ILIKE ${"%" + termo + "%"}
        OR d.bairro ILIKE ${"%" + termo + "%"}
      )`);
    }

    const bairro = String(filtros.bairro || "").trim();
    if (bairro) condicoes.push(Prisma.sql`btrim(COALESCE(d.bairro, '')) = ${bairro}`);

    const situacao = String(filtros.situacao || "").trim();
    if (situacao) condicoes.push(Prisma.sql`btrim(COALESCE(d.situacao, '')) = ${situacao}`);

    const risco = String(filtros.causouRisco || "").trim();
    if (risco) condicoes.push(Prisma.sql`btrim(COALESCE(d.causou_risco, '')) = ${risco}`);

    // "dataDenuncia" é o nome real da coluna (camelCase): exige aspas.
    const de = denunciaDiaParaUtc(filtros.periodoInicio, "inicio");
    if (de) condicoes.push(Prisma.sql`d."dataDenuncia" >= ${de}`);
    const ate = denunciaDiaParaUtc(filtros.periodoFim, "fim");
    if (ate) condicoes.push(Prisma.sql`d."dataDenuncia" <= ${ate}`);

    const where = condicoes.length ? Prisma.join(condicoes, " AND ") : Prisma.sql`1=1`;
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const offset = (pagina - 1) * DENUNCIA_PAGINA_TAMANHO;

    const base = Prisma.sql`
      FROM public.ccz_denuncias d
      LEFT JOIN public.ccz_animais a ON a.id = d.animal_id
      WHERE ${where}`;

    const [linhas, total] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT d.id, d."dataDenuncia" AS data_denuncia, d.tipo, d.situacao,
               d.bairro, d.logradouro, d.numero, d.causou_risco,
               d.animal_id, a.nome AS animal_nome
        ${base}
        ORDER BY d."dataDenuncia" DESC NULLS LAST, d.id
        LIMIT ${DENUNCIA_PAGINA_TAMANHO} OFFSET ${offset}`),
      prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS total ${base}`),
    ]);

    const totalNum = Number(total?.[0]?.total || 0);
    return {
      success: true,
      data: linhas.map((l) => ({
        id: l.id,
        dataDenuncia: l.data_denuncia instanceof Date
          ? l.data_denuncia.toISOString().slice(0, 10)
          : String(l.data_denuncia || "").slice(0, 10),
        tipo: l.tipo || "",
        situacao: l.situacao || "",
        bairro: l.bairro || "",
        logradouro: l.logradouro || "",
        numero: l.numero || "",
        causouRisco: l.causou_risco || "",
        animalId: l.animal_id || "",
        animalNome: l.animal_nome || "",
      })),
      total: totalNum,
      pagina,
      totalPaginas: Math.max(1, Math.ceil(totalNum / DENUNCIA_PAGINA_TAMANHO)),
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao consultar denúncias (CCZ):", error);
    return { success: false, error: "Erro ao consultar as denúncias." };
  }
}

// Opções dos filtros — vêm dos valores REALMENTE gravados no cadastro.
export async function obterFiltrosDenuncias() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);
    const [bairros, situacoes, riscos] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(bairro) AS valor FROM public.ccz_denuncias
         WHERE btrim(COALESCE(bairro, '')) <> '' ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(situacao) AS valor FROM public.ccz_denuncias
         WHERE btrim(COALESCE(situacao, '')) <> '' ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT btrim(causou_risco) AS valor FROM public.ccz_denuncias
         WHERE btrim(COALESCE(causou_risco, '')) <> '' ORDER BY 1`),
    ]);
    return {
      success: true,
      bairros: bairros.map((t) => t.valor),
      situacoes: situacoes.map((t) => t.valor),
      riscos: riscos.map((t) => t.valor),
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter filtros de denúncias (CCZ):", error);
    return { success: false, error: "Erro ao carregar as opções de filtro." };
  }
}

export async function obterEsporotricose(id) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const regId = String(id || "").trim();
    if (!regId) return { success: false, error: "Id não informado." };

    const r = await prisma.esporotricose.findUnique({
      where: { id: regId },
      include: {
        animal: { 
          include: { 
            tutor: { 
              include: { 
                pessoa: {
                  include: {
                    enderecos: {
                      where: { enderecoAtual: true },
                      take: 1
                    }
                  }
                }
              } 
            } 
          } 
        },
        visitas: { 
          orderBy: { data: "asc" },
          include: {
            relatorio: true  // Incluir relatório de cada visita
          }
        },
      },
    });
    if (!r) return { success: false, error: "Registro de esporotricose não encontrado." };

    const a = r.animal || null;
    const tutorPessoa = a?.tutor?.pessoa || null;
    const enderecoPrincipal = tutorPessoa?.enderecos?.[0] || null;

    // Formatar endereço completo
    let enderecoFormatado = "";
    if (enderecoPrincipal) {
      const partes = [];
      if (enderecoPrincipal.logradouro) partes.push(enderecoPrincipal.logradouro);
      if (enderecoPrincipal.numero) partes.push(`nº ${enderecoPrincipal.numero}`);
      if (enderecoPrincipal.complemento) partes.push(enderecoPrincipal.complemento);
      if (enderecoPrincipal.bairro) partes.push(enderecoPrincipal.bairro);
      if (enderecoPrincipal.cidade) partes.push(enderecoPrincipal.cidade);
      if (enderecoPrincipal.uf) partes.push(enderecoPrincipal.uf);
      if (enderecoPrincipal.cep) partes.push(`CEP ${enderecoPrincipal.cep}`);
      enderecoFormatado = partes.join(", ");
    }

    const data = {
      id: r.id,
      animalId: r.animalId || "",
      animalLabel: `${a?.nome?.trim() || "Sem nome"} (${r.animalId || ""})`,
      // Dados do animal (para o relatório/termo).
      animal: {
        id: a?.id || "",
        fotoUrl: a?.fotoUrl || "",
        nome: a?.nome || "",
        especie: a?.especie || "",
        sexo: a?.sexo === "F" ? "Fêmea" : "Macho",
        porte: a?.porte || "",
        idade: a?.idade || "",
        racaPelagem: a?.racaPelagem || "",
        possuiIdentificacao: a?.possuiIdentificacao || "Não",
        situacao: a?.situacao || "",
      },
      temTutor: Boolean(tutorPessoa),
      tutorNome: tutorPessoa?.nomeCompleto || "",
      endereco: enderecoFormatado || "",
      tutor: tutorPessoa
        ? {
            nome: tutorPessoa.nomeCompleto || "",
            cpf: tutorPessoa.cpf || "",
            telefone: tutorPessoa.telefone || "",
            endereco: enderecoFormatado || "",
          }
        : null,
      // Campos do formulário.
      dataVisita: dateParaYMD(r.dataVisita),
      fiscalResponsavel: r.fiscalResponsavel || "",
      apresentaLesoes: r.apresentaLesoes || "Não",
      descricaoLesoes: r.descricaoLesoes || "",
      emTratamentoVeterinario: r.emTratamentoVeterinario || "Não",
      descricaoTratamentoVet: r.descricaoTratamentoVet || "",
      medicamentosPrescritos: r.medicamentosPrescritos || "",
      interrupcaoTratamento: r.interrupcaoTratamento || "Não",
      retornoVeterinario: r.retornoVeterinario || "Não",
      isolamentoDomiciliar: r.isolamentoDomiciliar || "Não",
      observacoesIsolamento: r.observacoesIsolamento || "",
      acessoRua: r.acessoRua || "Não",
      usoEpi: r.usoEpi || "Não",
      quaisEpis: r.quaisEpis || "",
      higienizacaoAmbiente: r.higienizacaoAmbiente || "",
      outrosAnimaisResidencia: r.outrosAnimaisResidencia || "Não",
      outrosAnimaisDescricao: r.outrosAnimaisDescricao || "",
      pessoasComLesoes: r.pessoasComLesoes || "Não",
      pessoasLesoesDescricao: r.pessoasLesoesDescricao || "",
      cienteTratamentoContinuo: r.cienteTratamentoContinuo || "Não",
      cienteContencao: r.cienteContencao || "Não",
      cienteEpi: r.cienteEpi || "Não",
      cienteResiduos: r.cienteResiduos || "Não",
      condicoesGeraisAmbiente: r.condicoesGeraisAmbiente || "",
      conclusaoTecnica: r.conclusaoTecnica || "",
      encAcompanhamentoCcz: Boolean(r.encAcompanhamentoCcz),
      encNotificacaoTutor: Boolean(r.encNotificacaoTutor),
      encMinisterioPublico: Boolean(r.encMinisterioPublico),
      encOutrasMedidas: Boolean(r.encOutrasMedidas),
      outrasMedidasDescricao: r.outrasMedidasDescricao || "",
      encerrado: Boolean(r.encerrado),
      dataEncerramento: r.dataEncerramento ? r.dataEncerramento.toISOString() : null,
      encerradoPor: r.encerradoPor || "",
      incinerado: r.incinerado || "",
      dataIncineracao: r.dataIncineracao ? r.dataIncineracao.toISOString() : null,
      visitas: (r.visitas || []).map((v) => ({
        data: dateParaYMD(v.data),
        observacao: v.observacao || "",
        temRelatorio: Boolean(v.relatorio),
        relatorio: v.relatorio ? {
          profissionalResponsavel: v.relatorio.profissionalResponsavel,
          dataRelatorio: v.relatorio.dataRelatorio?.toISOString(),
          apresentaLesoes: v.relatorio.apresentaLesoes,
          descricaoLesoes: v.relatorio.descricaoLesoes,
          evolucaoQuadro: v.relatorio.evolucaoQuadro,
          emTratamento: v.relatorio.emTratamento,
          medicamentosAtuais: v.relatorio.medicamentosAtuais,
          adesaoTratamento: v.relatorio.adesaoTratamento,
          isolamentoAdequado: v.relatorio.isolamentoAdequado,
          usoEpiAdequado: v.relatorio.usoEpiAdequado,
          higienizacaoAdequada: v.relatorio.higienizacaoAdequada,
          orientacoesRepassadas: v.relatorio.orientacoesRepassadas,
          observacoesGerais: v.relatorio.observacoesGerais,
          necessidadeNovaVisita: v.relatorio.necessidadeNovaVisita,
          dataProximaVisita: dateParaYMD(v.relatorio.dataProximaVisita),
          encVeterinario: v.relatorio.encVeterinario,
          encNotificacao: v.relatorio.encNotificacao,
          encOutros: v.relatorio.encOutros,
          descricaoEncaminhamentos: v.relatorio.descricaoEncaminhamentos,
        } : null,
      })),
    };

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter esporotricose (CCZ):", error);
    return { success: false, error: "Erro ao carregar o registro de esporotricose." };
  }
}

// ── EDITAR A CONCLUSÃO DA ESPOROTRICOSE ─────────────────────────────────────
// A conclusão ("Encerrado" / "Em andamento") é o campo `encerrado` já existente
// no banco — nenhuma opção nova é criada. A edição atualiza o próprio registro
// (não cria nova fiscalização), preserva os demais campos e registra usuário,
// data e hora na auditoria.
export async function editarConclusaoEsporotricose(id, conclusao) {
  try {
    const user = await requirePermissao(MODULOS.CCZ, "zoonoses", "editar");

    const regId = String(id || "").trim();
    if (!regId) return { success: false, error: "ID não informado." };

    const valor = String(conclusao || "").trim().toUpperCase();
    if (!["ENCERRADO", "EM_ANDAMENTO"].includes(valor)) {
      return { success: false, error: "Conclusão inválida." };
    }
    const encerrado = valor === "ENCERRADO";

    const registro = await prisma.esporotricose.findUnique({
      where: { id: regId },
      select: { id: true, encerrado: true },
    });
    if (!registro) {
      return { success: false, error: "Registro de esporotricose não encontrado." };
    }
    if (Boolean(registro.encerrado) === encerrado) {
      return {
        success: false,
        error: `O registro já está como "${encerrado ? "Encerrado" : "Em andamento"}".`,
      };
    }

    await prisma.esporotricose.update({
      where: { id: regId },
      data: encerrado
        ? {
            encerrado: true,
            dataEncerramento: new Date(),
            encerradoPor: user?.nome ? String(user.nome).slice(0, 150) : null,
          }
        : { encerrado: false, dataEncerramento: null, encerradoPor: null },
    });

    await registrarAuditoria({
      user,
      acao: encerrado ? "ENCERRAR" : "REABRIR",
      modulo: "CCZ",
      entidade: "Esporotricose",
      entidadeId: regId,
      descricao: `Conclusão do registro ${regId} alterada para "${encerrado ? "Encerrado" : "Em andamento"}"`,
      detalhes: { conclusaoAnterior: registro.encerrado ? "ENCERRADO" : "EM_ANDAMENTO", conclusaoNova: valor },
    });

    revalidatePath("/ccz");
    return { success: true, data: { id: regId, encerrado } };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao editar conclusão da esporotricose (CCZ):", error);
    return { success: false, error: "Erro ao alterar a conclusão do registro." };
  }
}

// ── EXCLUIR REGISTRO DE ESPOROTRICOSE ────────────────────────────────────────
export async function excluirEsporotricose(id) {
  "use server";
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const regId = String(id || "").trim();
    if (!regId) return { success: false, error: "ID não informado." };

    // Verifica se o registro existe
    const registro = await prisma.esporotricose.findUnique({
      where: { id: regId },
    });

    if (!registro) {
      return { success: false, error: "Registro de esporotricose não encontrado." };
    }

    // Remove o registro (as visitas e relatórios devem ser removidos em cascata pelo schema)
    await prisma.esporotricose.delete({
      where: { id: regId },
    });

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "CCZ",
      entidade: "Esporotricose",
      entidadeId: regId,
      descricao: `Registro de esporotricose excluído (animal ${registro.animalId})`,
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao excluir esporotricose (CCZ):", error);
    return { success: false, error: "Erro ao excluir o registro de esporotricose." };
  }
}

// ── ENCERRAR CASO DE ESPOROTRICOSE ──────────────────────────────────────────
// Marca o caso como encerrado, registrando data e o responsável (nome do
// usuário logado). Não permite encerrar um caso já encerrado.
export async function encerrarEsporotricose(id) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const regId = String(id || "").trim();
    if (!regId) return { success: false, error: "ID não informado." };

    const registro = await prisma.esporotricose.findUnique({
      where: { id: regId },
      select: { id: true, encerrado: true },
    });

    if (!registro) {
      return { success: false, error: "Registro de esporotricose não encontrado." };
    }
    if (registro.encerrado) {
      return { success: false, error: "Este caso já está encerrado." };
    }

    await prisma.esporotricose.update({
      where: { id: regId },
      data: {
        encerrado: true,
        dataEncerramento: new Date(),
        encerradoPor: user?.nome ? String(user.nome).slice(0, 150) : null,
      },
    });

    await registrarAuditoria({
      user,
      acao: "ENCERRAR",
      modulo: "CCZ",
      entidade: "Esporotricose",
      entidadeId: regId,
      descricao: "Caso de esporotricose encerrado",
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao encerrar esporotricose (CCZ):", error);
    return { success: false, error: "Erro ao encerrar o caso de esporotricose." };
  }
}

// ── REABRIR CASO DE ESPOROTRICOSE ───────────────────────────────────────────
// Reverte o encerramento de um caso: volta o status para "Em andamento",
// limpando a data e o responsável pelo encerramento. Não altera a incineração.
export async function reabrirEsporotricose(id) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const regId = String(id || "").trim();
    if (!regId) return { success: false, error: "ID não informado." };

    const registro = await prisma.esporotricose.findUnique({
      where: { id: regId },
      select: { id: true, encerrado: true },
    });

    if (!registro) {
      return { success: false, error: "Registro de esporotricose não encontrado." };
    }
    if (!registro.encerrado) {
      return { success: false, error: "Este caso não está encerrado." };
    }

    await prisma.esporotricose.update({
      where: { id: regId },
      data: {
        encerrado: false,
        dataEncerramento: null,
        encerradoPor: null,
      },
    });

    await registrarAuditoria({
      user,
      acao: "REABRIR",
      modulo: "CCZ",
      entidade: "Esporotricose",
      entidadeId: regId,
      descricao: "Caso de esporotricose reaberto",
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao reabrir esporotricose (CCZ):", error);
    return { success: false, error: "Erro ao reabrir o caso de esporotricose." };
  }
}

// ── REGISTRAR INCINERAÇÃO DO ANIMAL (ESPOROTRICOSE) ─────────────────────────
// Registra se o animal do caso foi incinerado. Independente do encerramento:
// pode ser alterado a qualquer momento. Valores aceitos: "Sim", "Não" ou ""
// (não informado). Ao marcar "Sim", grava a data da incineração; caso
// contrário, limpa a data.
export async function registrarIncineracaoEsporotricose(id, valor) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const regId = String(id || "").trim();
    if (!regId) return { success: false, error: "ID não informado." };

    const permitidos = ["", "Sim", "Não"];
    const novoValor = permitidos.includes(valor) ? valor : "";

    const registro = await prisma.esporotricose.findUnique({
      where: { id: regId },
      select: { id: true },
    });

    if (!registro) {
      return { success: false, error: "Registro de esporotricose não encontrado." };
    }

    await prisma.esporotricose.update({
      where: { id: regId },
      data: {
        incinerado: novoValor,
        dataIncineracao: novoValor === "Sim" ? new Date() : null,
      },
    });

    await registrarAuditoria({
      user,
      acao: "OUTRO",
      modulo: "CCZ",
      entidade: "Esporotricose",
      entidadeId: regId,
      descricao: "Incineração registrada",
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao registrar incineração (CCZ):", error);
    return { success: false, error: "Erro ao registrar a incineração do animal." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RELATÓRIOS DE VISITA DE ESPOROTRICOSE
// ─────────────────────────────────────────────────────────────────────────
// Actions para gerenciar os relatórios de acompanhamento das visitas de
// esporotricose. Cada visita pode ter um relatório detalhado preenchido pelo
// profissional responsável durante ou após a visita.
// ═══════════════════════════════════════════════════════════════════════════

// ── SALVAR RELATÓRIO DE VISITA ──────────────────────────────────────────────
export async function salvarRelatorioVisita(dados) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const visitaId = String(dados.visitaId || "").trim();
    if (!visitaId) return { success: false, error: "ID da visita não informado." };

    // Verificar se a visita existe
    const visita = await prisma.esporotricoseVisita.findUnique({
      where: { id: visitaId },
      select: { id: true },
    });
    if (!visita) return { success: false, error: "Visita não encontrada." };

    const profissional = String(dados.profissionalResponsavel || "").trim();
    if (!profissional) {
      return { success: false, error: "Informe o profissional responsável." };
    }

    const dataProximaVisita = dados.dataProximaVisita
      ? ymdParaDateUTC(dados.dataProximaVisita)
      : null;

    const dadosRelatorio = {
      visitaId,
      profissionalResponsavel: profissional.slice(0, 150),
      // Condição clínica
      apresentaLesoes: simNao(dados.apresentaLesoes),
      descricaoLesoes:
        dados.apresentaLesoes === "Sim" && dados.descricaoLesoes
          ? String(dados.descricaoLesoes)
          : null,
      evolucaoQuadro: dados.evolucaoQuadro
        ? String(dados.evolucaoQuadro).slice(0, 50)
        : "Estável",
      // Tratamento
      emTratamento: simNao(dados.emTratamento),
      medicamentosAtuais:
        dados.emTratamento === "Sim" && dados.medicamentosAtuais
          ? String(dados.medicamentosAtuais)
          : null,
      adesaoTratamento: dados.adesaoTratamento
        ? String(dados.adesaoTratamento).slice(0, 50)
        : "Boa",
      // Manejo
      isolamentoAdequado: dados.isolamentoAdequado
        ? String(dados.isolamentoAdequado).slice(0, 10)
        : "Sim",
      usoEpiAdequado: dados.usoEpiAdequado
        ? String(dados.usoEpiAdequado).slice(0, 10)
        : "Sim",
      higienizacaoAdequada: dados.higienizacaoAdequada
        ? String(dados.higienizacaoAdequada).slice(0, 10)
        : "Sim",
      // Orientações
      orientacoesRepassadas: dados.orientacoesRepassadas
        ? String(dados.orientacoesRepassadas)
        : null,
      // Avaliação
      observacoesGerais: dados.observacoesGerais
        ? String(dados.observacoesGerais)
        : null,
      necessidadeNovaVisita: simNao(dados.necessidadeNovaVisita),
      dataProximaVisita,
      // Encaminhamentos
      encVeterinario: Boolean(dados.encVeterinario),
      encNotificacao: Boolean(dados.encNotificacao),
      encOutros: Boolean(dados.encOutros),
      descricaoEncaminhamentos:
        (dados.encVeterinario || dados.encNotificacao || dados.encOutros) &&
        dados.descricaoEncaminhamentos
          ? String(dados.descricaoEncaminhamentos)
          : null,
    };

    await prisma.esporotricoseRelatorio.upsert({
      where: { visitaId },
      update: dadosRelatorio,
      create: dadosRelatorio,
    });

    // Se marcou necessidade de nova visita E informou a data, cria automaticamente
    let proximaVisitaAgendada = null;
    if (dados.necessidadeNovaVisita === "Sim" && dataProximaVisita) {
      // Buscar o ID da esporotricose dessa visita
      const visitaAtual = await prisma.esporotricoseVisita.findUnique({
        where: { id: visitaId },
        select: { esporotricoseId: true },
      });

      if (visitaAtual) {
        // Verificar se já existe uma visita nessa data para esse registro
        const visitaExistente = await prisma.esporotricoseVisita.findFirst({
          where: {
            esporotricoseId: visitaAtual.esporotricoseId,
            data: dataProximaVisita,
          },
        });

        // Se não existe, cria a nova visita
        if (!visitaExistente) {
          await prisma.esporotricoseVisita.create({
            data: {
              esporotricoseId: visitaAtual.esporotricoseId,
              data: dataProximaVisita,
              observacao: "",
            },
          });
          proximaVisitaAgendada = dateParaYMD(dataProximaVisita);
        }
      }
    }

    await registrarAuditoria({
      user,
      acao: "SALVAR",
      modulo: "CCZ",
      entidade: "RelatorioVisita",
      entidadeId: visitaId,
      descricao: "Relatório de visita de esporotricose salvo",
    });

    revalidatePath("/ccz");
    revalidatePath("/ccz", "layout");

    return { 
      success: true,
      proximaVisitaAgendada, // Retorna a data se foi agendada
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao salvar relatório de visita (CCZ):", error);
    return {
      success: false,
      error: error.message || "Erro ao salvar o relatório de visita.",
    };
  }
}

// ── OBTER RELATÓRIO DE VISITA ───────────────────────────────────────────────
export async function obterRelatorioVisita(visitaId) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const idVisita = String(visitaId || "").trim();
    if (!idVisita) return { success: false, error: "ID da visita não informado." };

    const relatorio = await prisma.esporotricoseRelatorio.findUnique({
      where: { visitaId: idVisita },
    });

    if (!relatorio) {
      // Não existe relatório ainda
      return { success: true, data: null };
    }

    const data = {
      visitaId: relatorio.visitaId,
      profissionalResponsavel: relatorio.profissionalResponsavel || "",
      // Condição clínica
      apresentaLesoes: relatorio.apresentaLesoes || "Não",
      descricaoLesoes: relatorio.descricaoLesoes || "",
      evolucaoQuadro: relatorio.evolucaoQuadro || "Estável",
      // Tratamento
      emTratamento: relatorio.emTratamento || "Sim",
      medicamentosAtuais: relatorio.medicamentosAtuais || "",
      adesaoTratamento: relatorio.adesaoTratamento || "Boa",
      // Manejo
      isolamentoAdequado: relatorio.isolamentoAdequado || "Sim",
      usoEpiAdequado: relatorio.usoEpiAdequado || "Sim",
      higienizacaoAdequada: relatorio.higienizacaoAdequada || "Sim",
      // Orientações
      orientacoesRepassadas: relatorio.orientacoesRepassadas || "",
      // Avaliação
      observacoesGerais: relatorio.observacoesGerais || "",
      necessidadeNovaVisita: relatorio.necessidadeNovaVisita || "Sim",
      dataProximaVisita: dateParaYMD(relatorio.dataProximaVisita),
      // Encaminhamentos
      encVeterinario: Boolean(relatorio.encVeterinario),
      encNotificacao: Boolean(relatorio.encNotificacao),
      encOutros: Boolean(relatorio.encOutros),
      descricaoEncaminhamentos: relatorio.descricaoEncaminhamentos || "",
    };

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter relatório de visita (CCZ):", error);
    return {
      success: false,
      error: "Erro ao carregar o relatório de visita.",
    };
  }
}

// ── SALVAR DENÚNCIA ──────────────────────────────────────────────────────────
export async function salvarDenuncia(dados) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    // Gerar próximo ID no formato DEN-XX
    const denuncias = await prisma.denunciaCaoAgressivo.findMany({
      where: {
        id: {
          startsWith: "DEN-"
        }
      },
      orderBy: { id: 'desc' },
      select: { id: true }
    });

    // Filtra apenas IDs no formato DEN-[número] e extrai o maior número
    let novoNumero = 1;
    for (const denuncia of denuncias) {
      const match = denuncia.id.match(/^DEN-(\d+)$/);
      if (match) {
        const numero = parseInt(match[1]);
        if (numero >= novoNumero) {
          novoNumero = numero + 1;
        }
      }
    }

    const novoId = `DEN-${String(novoNumero).padStart(2, '0')}`;

    const denuncia = await prisma.denunciaCaoAgressivo.create({
      data: {
        id: novoId,
        animalId: dados.animalId || null,
        cep: dados.cep ? soDigitos(dados.cep) : null,
        logradouro: dados.logradouro || null,
        numero: dados.numero || null,
        complemento: dados.complemento || null,
        bairro: dados.bairro || null,
        cidade: dados.cidade || "Muriaé",
        uf: dados.uf || "MG",
        pontoReferencia: dados.pontoReferencia || null,
        descricaoCao: dados.descricaoCao,
        causouRisco: dados.causouRisco,
        relato: dados.relato,
        tipo: dados.tipo || "AGRESSIVO",
      },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "CCZ",
      entidade: "Denuncia",
      entidadeId: novoId,
      descricao: `Denúncia ${novoId} registrada`,
      detalhes: { tipo: denuncia.tipo },
    });

    revalidatePath("/ccz");
    return { sucesso: true, data: denuncia };
  } catch (error) {
    console.error("Erro ao salvar denúncia:", error);
    return { sucesso: false, erro: error.message };
  }
}

// ── LISTAR DENÚNCIAS ─────────────────────────────────────────────────────────
export async function listarDenuncias(tipo) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    // Filtro por tipo ("AGRESSIVO" | "DOENTE"). Sem parâmetro (callers antigos),
    // retorna todas as denúncias.
    const denuncias = await prisma.denunciaCaoAgressivo.findMany({
      where: tipo ? { tipo } : undefined,
      include: {
        animal: true,
      },
      orderBy: { dataDenuncia: "desc" },
    });

    return { sucesso: true, data: denuncias };
  } catch (error) {
    console.error("Erro ao listar denúncias:", error);
    return { sucesso: false, erro: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGREGAÇÕES DO DASHBOARD (filtro de ANO GLOBAL)
// ─────────────────────────────────────────────────────────────────────────
// O dashboard tem um único filtro de ano (fora dos gráficos) que afeta KPIs,
// "Procedimentos por Tipo" e os dois gráficos mensais. O parâmetro `ano`:
//   • number (ex.: 2026)  → filtra aquele ano;
//   • "todos" ou null     → sem filtro de data (total geral; nos gráficos
//                           mensais, soma de todos os anos por mês do calendário);
//   • undefined           → ano atual (comportamento anterior).
//
// REGRA DE DATA DE CADA INDICADOR (uma regra por indicador, documentada):
//   • Tutores            → Tutor.createdAt (created_at)
//   • Animais / com tutor / sem tutor → Animal.dataCadastro
//   • Procedimentos e "por Tipo"      → CadastroProcedimento.dataProcedimento
//   • Esporotricose      → Esporotricose.dataVisita
//   • Denúncias          → DenunciaCaoAgressivo.dataDenuncia
//   • Gráfico "entraram" → COALESCE(dataDevolucao, dataCadastro) p/ Adotado e
//                          Devolvido; dataCadastro para CCZ/sem situação
//   • Gráfico "devolvidos (sem tutor)" → dataDevolucao (situacao Devolvido,
//                          pessoaCpf nulo)
// Registros com data nula ficam fora quando há filtro de ano.
// ═══════════════════════════════════════════════════════════════════════════

const MESES_LABEL = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// Monta o esqueleto de 12 meses zerados para o gráfico empilhado.
const esqueletoMeses = () =>
  MESES_LABEL.map((mes) => ({ mes, comTutor: 0, semTutor: 0 }));

// Resolve o parâmetro de ano: retorna null (sem filtro) ou o número do ano.
const resolverAno = (ano) => {
  if (ano === null || ano === "todos") return null;
  return Number(ano) || new Date().getFullYear();
};

// Janela [1º de janeiro, 1º de janeiro do ano seguinte) em UTC; null = sem filtro.
const janelaAno = (ano) => {
  const y = resolverAno(ano);
  if (y === null) return null;
  return {
    inicio: new Date(Date.UTC(y, 0, 1)),
    fim: new Date(Date.UTC(y + 1, 0, 1)),
  };
};

// Filtro Prisma { gte, lt } para um campo de data (undefined = sem filtro).
const filtroData = (janela) =>
  janela ? { gte: janela.inicio, lt: janela.fim } : undefined;

// ── KPIs + PROCEDIMENTOS POR TIPO (filtrados pelo ano global) ───────────────
// Usa count/groupBy no servidor (sem carregar listas).
export async function estatisticasDashboardCCZ(ano) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const janela = janelaAno(ano);
    const f = filtroData(janela);
    const whereAnimal = f ? { dataCadastro: f } : {};

    const [
      tutores,
      animais,
      animaisComTutor,
      animaisSemTutor,
      procedimentos,
      esporotricose,
      denuncias,
      porTipo,
    ] = await Promise.all([
      prisma.tutor.count({ where: f ? { createdAt: f } : {} }),
      prisma.animal.count({ where: whereAnimal }),
      prisma.animal.count({ where: { ...whereAnimal, pessoaCpf: { not: null } } }),
      prisma.animal.count({ where: { ...whereAnimal, pessoaCpf: null } }),
      prisma.cadastroProcedimento.count({ where: f ? { dataProcedimento: f } : {} }),
      prisma.esporotricose.count({ where: f ? { dataVisita: f } : {} }),
      prisma.denunciaCaoAgressivo.count({ where: f ? { dataDenuncia: f } : {} }),
      prisma.cadastroProcedimento.groupBy({
        by: ["tipo"],
        where: f ? { dataProcedimento: f } : {},
        _count: { _all: true },
      }),
    ]);

    const procedimentosPorTipo = porTipo
      .map((g) => ({ tipo: g.tipo || "Não especificado", count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    return {
      success: true,
      data: {
        tutores,
        animais,
        animaisComTutor,
        animaisSemTutor,
        procedimentos,
        esporotricose,
        denuncias,
        procedimentosPorTipo,
      },
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao calcular estatísticas do dashboard (CCZ):", error);
    return { success: false, error: "Erro ao carregar as estatísticas." };
  }
}

// ── ANIMAIS QUE ENTRARAM POR MÊS (empilhado com/sem tutor) ──────────────────
// Data de referência: COALESCE(dataDevolucao, dataCadastro) para Adotado e
// Devolvido; dataCadastro para CCZ/"" . A janela do ano é aplicada em JS sobre
// a data efetiva (a consulta traz quem tem qualquer das datas no ano).
// Retorno: { success, data: [{ mes, comTutor, semTutor }] (12 itens) }.
export async function estatisticaAnimaisEntradaPorMes(ano) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const janela = janelaAno(ano);
    const f = filtroData(janela);

    const animais = await prisma.animal.findMany({
      where: f
        ? { OR: [{ dataCadastro: f }, { dataDevolucao: f }] }
        : undefined,
      select: {
        dataCadastro: true,
        dataDevolucao: true,
        situacao: true,
        pessoaCpf: true,
      },
    });

    const dentroDoAno = (d) =>
      !!d &&
      (!janela ||
        (d.getTime() >= janela.inicio.getTime() && d.getTime() < janela.fim.getTime()));

    const dados = esqueletoMeses();
    for (const a of animais) {
      const usaDataSituacao =
        (a.situacao === "Adotado" || a.situacao === "Devolvido") &&
        a.dataDevolucao;
      const dataRef = usaDataSituacao
        ? new Date(a.dataDevolucao)
        : a.dataCadastro
        ? new Date(a.dataCadastro)
        : null;

      if (!dentroDoAno(dataRef)) continue;

      const mes = dataRef.getUTCMonth(); // 0-11
      if (a.pessoaCpf) dados[mes].comTutor += 1;
      else dados[mes].semTutor += 1;
    }

    return { success: true, data: dados };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao agregar animais por mês (CCZ):", error);
    return { success: false, error: "Erro ao carregar as entradas por mês." };
  }
}

// ── ANIMAIS DEVOLVIDOS POR MÊS — APENAS SEM TUTOR ───────────────────────────
// situacao = "Devolvido" AND pessoaCpf IS NULL, por mês de dataDevolucao.
// Retorno: { success, data: [{ mes, semTutor }] (12 itens) }.
export async function estatisticaAnimaisDevolvidosPorMes(ano) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const f = filtroData(janelaAno(ano));

    const animais = await prisma.animal.findMany({
      where: {
        situacao: "Devolvido",
        pessoaCpf: null,
        dataDevolucao: f ?? { not: null },
      },
      select: { dataDevolucao: true },
    });

    const dados = MESES_LABEL.map((mes) => ({ mes, semTutor: 0 }));
    for (const a of animais) {
      if (!a.dataDevolucao) continue;
      dados[new Date(a.dataDevolucao).getUTCMonth()].semTutor += 1;
    }

    return { success: true, data: dados };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao agregar animais devolvidos por mês (CCZ):", error);
    return { success: false, error: "Erro ao carregar as devoluções por mês." };
  }
}
