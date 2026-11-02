"use server";

import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
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

    const where = termoLimpo
      ? {
          OR: [
            { nomeCompleto: { contains: termoLimpo, mode: "insensitive" } },
            ...(termoDigitos ? [{ cpf: { contains: termoDigitos } }] : []),
          ],
        }
      : {};

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

    const cpf = soDigitos(pessoaCpf);
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
    await requireAcessoModulo(MODULOS.CCZ);

    const animalId = String(id || "").trim();
    if (!animalId) return { success: false, error: "ID do animal não informado." };

    // Verifica se o animal existe e se possui registros vinculados
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        procedimentos: true,
        esporotricose: true,
        zoonoses: true,
      },
    });

    if (!animal) {
      return { success: false, error: "Animal não encontrado." };
    }

    // Verifica se há registros vinculados
    const temRegistros = 
      (animal.procedimentos && animal.procedimentos.length > 0) ||
      (animal.esporotricose && animal.esporotricose.length > 0) ||
      (animal.zoonoses && animal.zoonoses.length > 0);

    if (temRegistros) {
      const totalRegistros = 
        (animal.procedimentos?.length || 0) +
        (animal.esporotricose?.length || 0) +
        (animal.zoonoses?.length || 0);
      
      return {
        success: false,
        error: `Não é possível excluir este animal pois existem ${totalRegistros} registro(s) vinculado(s) (procedimentos, esporotricose ou zoonoses)`,
      };
    }

    // Remove o animal
    await prisma.animal.delete({
      where: { id: animalId },
    });

    revalidatePath("/ccz");
    return { success: true };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao excluir animal (CCZ):", error);
    return { success: false, error: "Erro ao excluir o animal." };
  }
}

// ── SALVAR TUTOR (Pessoa + Endereço + ccz_tutores) ──────────────────────────
export async function salvarTutor(dados) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

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
    
    // Verifica se já existe pessoa com este CPF (apenas em modo novo cadastro)
    if (!dados.jaEhTutor) {
      const pessoaExistente = await prisma.pessoa.findUnique({
        where: { cpf },
        select: { cpf: true, nomeCompleto: true },
      });
      
      if (pessoaExistente) {
        return { 
          success: false, 
          error: `CPF já cadastrado no sistema para: ${pessoaExistente.nomeCompleto}. Use a busca para selecionar esta pessoa.` 
        };
      }
    }

    const dadosTutor = {
      rg: dados.rg ? String(dados.rg).slice(0, 20) : null,
      sexo: dados.tutorSexo ? String(dados.tutorSexo).slice(0, 20) : null,
      profissao: dados.profissao ? String(dados.profissao).slice(0, 100) : null,
      telefoneSecundario: dados.telefoneSecundario
        ? soDigitos(dados.telefoneSecundario).slice(0, 20)
        : null,
      pontoReferencia: dados.pontoReferencia
        ? String(dados.pontoReferencia).slice(0, 150)
        : null,
      observacoes: dados.observacoes ? String(dados.observacoes) : null,
    };

    await prisma.$transaction(async (tx) => {
      await upsertPessoaTx(tx, dados);
      await gravarEnderecoTx(tx, cpf, dados);
      await tx.tutor.upsert({
        where: { pessoaCpf: cpf },
        update: dadosTutor,
        create: { pessoaCpf: cpf, ...dadosTutor },
      });
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

// ── FICHA COMPLETA DO ANIMAL (dados + tutor + histórico de procedimentos) ───
export async function obterFichaAnimal(id) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

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
    await requireAcessoModulo(MODULOS.CCZ);

    // Id: usa o informado ou gera um (ANM-<timestamp base36>), limitado a 50.
    const idInformado = dados.id ? String(dados.id).trim() : "";
    const id = (idInformado || `ANM-${Date.now().toString(36)}`)
      .toUpperCase()
      .slice(0, 50);

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
        ? soDigitos(dados.pessoaCpf)
        : null;

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
      enderecoRecolhimento: null,
    };

    await prisma.$transaction(async (tx) => {
      // Se o animal tem tutor, garante que a pessoa esteja registrada como
      // tutora (ccz_tutores). Assim o vínculo Pessoa → Tutor → Animal fica
      // íntegro e o relatório do paciente consegue listar os animais dela.
      if (pessoaCpf) {
        const pessoa = await tx.pessoa.findUnique({
          where: { cpf: pessoaCpf },
          select: { cpf: true },
        });
        if (!pessoa) {
          throw Object.assign(new Error("Pessoa (tutor) não encontrada no cadastro."), {
            codigoApp: "TUTOR_INEXISTENTE",
          });
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
      return { success: false, error: "Já existe um animal com este Id." };
    }
    if (error.code === "P2003") {
      return { success: false, error: "Tutor selecionado inválido ou inexistente." };
    }
    console.error("Erro ao salvar animal (CCZ):", error);
    return { success: false, error: error.message || "Erro ao salvar animal." };
  }
}

// ── LISTAR ANIMAIS (opcional) ───────────────────────────────────────────────
export async function listarAnimais() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const animais = await prisma.animal.findMany({
      include: { 
        tutor: { include: { pessoa: true } },
        esporotricose: { 
          select: { id: true },
          take: 1  // Apenas verificar se existe
        },
        zoonoses: {
          select: { id: true },
          take: 1  // Apenas verificar se existe
        }
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
      fotoUrl: a.fotoUrl || "",
      pessoaCpf: a.pessoaCpf || "",
      tutorNome: a.tutor?.pessoa?.nomeCompleto || "",
      dataCadastro: a.dataCadastro ? a.dataCadastro.toISOString() : null,
      temEsporotricose: a.esporotricose && a.esporotricose.length > 0,
      temZoonoses: a.zoonoses && a.zoonoses.length > 0,  // Nova propriedade
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
export async function obterHistoricoCompleto(animalId) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
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
        procedimentos: {
          orderBy: { dataProcedimento: "desc" },
        },
        esporotricose: {
          include: {
            visitas: {
              include: {
                relatorio: true,
              },
              orderBy: { data: "asc" },
            },
          },
          orderBy: { dataVisita: "desc" },
        },
        zoonoses: {
          orderBy: { dataIdentificacao: "desc" },
        },
        denuncias: {
          orderBy: { dataDenuncia: "desc" },
        },
      },
    });

    if (!animal) {
      return { success: false, error: "Animal não encontrado." };
    }

    // Serializar dados do animal
    const endereco = animal.tutor?.pessoa?.enderecos?.[0];
    
    // "Doença crônica: ..." foi concatenada em observacoes ao salvar; separar de volta
    let qualDoenca = "";
    let observacoes = animal.observacoes || "";
    const m = observacoes.match(/^Doença crônica:\s*(.*)(?:\n([\s\S]*))?$/);
    if (animal.doencaCronica === "Sim" && m) {
      qualDoenca = (m[1] || "").trim();
      observacoes = (m[2] || "").trim();
    }
    
    const data = {
      // Dados cadastrais
      animal: {
        id: animal.id,
        nome: animal.nome || "",
        especie: animal.especie || "",
        sexo: animal.sexo === "F" ? "Fêmea" : "Macho",
        porte: animal.porte || "",
        idade: animal.idade || "",
        castrado: animal.castrado || "Não",
        doencaCronica: animal.doencaCronica || "Não",
        qualDoenca,
        sintomasVomitoDiarreia: animal.sintomasVomitoDiarreia || "Não",
        apetiteNormal: animal.apetiteNormal || "Sim",
        emTratamento: animal.emTratamento || "Não",
        qualTratamento: animal.qualTratamento || "",
        observacoes,
        possuiResponsavel: animal.possuiResponsavel || "Não",
        fotoUrl: animal.fotoUrl || "",
        dataCadastro: animal.dataCadastro ? animal.dataCadastro.toISOString() : null,
      },
      
      // Dados do tutor
      tutor: animal.tutor ? {
        cpf: animal.tutor.pessoa?.cpf || "",
        nome: animal.tutor.pessoa?.nomeCompleto || "",
        telefone: animal.tutor.pessoa?.telefone || "",
        cns: animal.tutor.pessoa?.cns || "",
        endereco: endereco ? {
          logradouro: endereco.logradouro || "",
          numero: endereco.numero || "",
          complemento: endereco.complemento || "",
          bairro: endereco.bairro || "",
          cidade: endereco.cidade || "",
          uf: endereco.uf || "",
          cep: endereco.cep || "",
        } : null,
      } : null,
      
      // Histórico de procedimentos (inclui vacinações, castrações, etc.)
      procedimentos: (animal.procedimentos || []).map(p => ({
        id: p.id,
        dataProcedimento: p.dataProcedimento ? p.dataProcedimento.toISOString() : null,
        tipo: p.tipo || "",
        descricao: p.descricao || "",
        veterinario: p.veterinario || "",
        status: p.status || "",
        medicacaoPrescrita: p.medicacaoPrescrita || "",
      })),
      
      // Histórico de zoonoses
      zoonoses: (animal.zoonoses || []).map(z => ({
        id: z.id,
        dataIdentificacao: z.dataIdentificacao ? z.dataIdentificacao.toISOString() : null,
        doenca: z.doenca || "",
        grauRisco: z.grauRisco || "",
        riscoVida: z.riscoVida || "Não",
        observacao: z.observacao || "",
      })),
      
      // Histórico de denúncias
      denuncias: (animal.denuncias || []).map(d => {
        // Formatar endereço das denúncias
        const partes = [];
        if (d.logradouro) partes.push(d.logradouro);
        if (d.numero) partes.push(`nº ${d.numero}`);
        if (d.bairro) partes.push(d.bairro);
        if (d.cidade) partes.push(d.cidade);
        if (d.uf) partes.push(d.uf);
        const localizacao = partes.length > 0 ? partes.join(", ") : "-";
        
        return {
          id: d.id,
          dataDenuncia: d.dataDenuncia ? d.dataDenuncia.toISOString() : null,
          localizacao,
          descricao: d.descricaoCao || "",
          relato: d.relato || "",
          causouRisco: d.causouRisco || "Não",
        };
      }),
      
      // Histórico de esporotricose
      esporotricose: (animal.esporotricose || []).map(e => ({
        id: e.id,
        dataVisita: e.dataVisita ? e.dataVisita.toISOString() : null,
        numeroProtocolo: e.numeroProtocolo || "",
        fiscalResponsavel: e.fiscalResponsavel || "",
        apresentaLesoes: e.apresentaLesoes || "Não",
        descricaoLesoes: e.descricaoLesoes || "",
        emTratamentoVeterinario: e.emTratamentoVeterinario || "Não",
        descricaoTratamentoVet: e.descricaoTratamentoVet || "",
        conclusaoTecnica: e.conclusaoTecnica || "",
        visitas: (e.visitas || []).map(v => ({
          id: v.id,
          data: v.data ? v.data.toISOString() : null,
          observacao: v.observacao || "",
          temRelatorio: Boolean(v.relatorio),
          relatorio: v.relatorio ? {
            id: v.relatorio.id,
            dataRelatorio: v.relatorio.dataRelatorio ? v.relatorio.dataRelatorio.toISOString() : null,
            profissionalResponsavel: v.relatorio.profissionalResponsavel || "",
            // Condição clínica
            apresentaLesoes: v.relatorio.apresentaLesoes || "Não",
            descricaoLesoes: v.relatorio.descricaoLesoes || "",
            evolucaoQuadro: v.relatorio.evolucaoQuadro || "",
            // Tratamento
            emTratamento: v.relatorio.emTratamento || "Sim",
            medicamentosAtuais: v.relatorio.medicamentosAtuais || "",
            adesaoTratamento: v.relatorio.adesaoTratamento || "",
            // Manejo
            isolamentoAdequado: v.relatorio.isolamentoAdequado || "Sim",
            usoEpiAdequado: v.relatorio.usoEpiAdequado || "Sim",
            higienizacaoAdequada: v.relatorio.higienizacaoAdequada || "Sim",
            // Orientações
            orientacoesRepassadas: v.relatorio.orientacoesRepassadas || "",
            // Avaliação
            observacoesGerais: v.relatorio.observacoesGerais || "",
            necessidadeNovaVisita: v.relatorio.necessidadeNovaVisita || "Sim",
            dataProximaVisita: v.relatorio.dataProximaVisita ? v.relatorio.dataProximaVisita.toISOString() : null,
            // Encaminhamentos
            encVeterinario: v.relatorio.encVeterinario || false,
            encNotificacao: v.relatorio.encNotificacao || false,
            encOutros: v.relatorio.encOutros || false,
            descricaoEncaminhamentos: v.relatorio.descricaoEncaminhamentos || "",
          } : null,
        })),
      })),
    };

    return { success: true, data };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { success: false, error: error.message };
    }
    console.error("Erro ao obter histórico completo do animal:", error);
    return { success: false, error: "Erro ao carregar histórico do animal." };
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
    await requireAcessoModulo(MODULOS.CCZ);

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
      veterinario: dados.veterinario ? String(dados.veterinario).slice(0, 150) : null,
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
      if (enderecoPrincipal.bairro) partes.push(enderecoPrincipal.bairro);
      if (enderecoPrincipal.cidade) partes.push(enderecoPrincipal.cidade);
      if (enderecoPrincipal.uf) partes.push(enderecoPrincipal.uf);
      enderecoFormatado = partes.join(", ");
    }

    const data = {
      id: p.id,
      animalId: p.animalId,
      animalNome: p.animal?.nome || "",
      animalEspecie: p.animal?.especie || "",
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
    await requireAcessoModulo(MODULOS.CCZ);

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
    await requireAcessoModulo(MODULOS.CCZ);

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
    await requireAcessoModulo(MODULOS.CCZ);

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
    await requireAcessoModulo(MODULOS.CCZ);

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
      numeroProtocolo: dados.numeroProtocolo
        ? String(dados.numeroProtocolo).slice(0, 50)
        : null,
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
      numeroProtocolo: r.numeroProtocolo || "",
      dataVisita: dateParaYMD(r.dataVisita),
      apresentaLesoes: r.apresentaLesoes || "Não",
      visitasCount: r._count?.visitas || 0,
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
      if (enderecoPrincipal.bairro) partes.push(enderecoPrincipal.bairro);
      if (enderecoPrincipal.cidade) partes.push(enderecoPrincipal.cidade);
      if (enderecoPrincipal.uf) partes.push(enderecoPrincipal.uf);
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
      numeroProtocolo: r.numeroProtocolo || "",
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

// ── EXCLUIR REGISTRO DE ESPOROTRICOSE ────────────────────────────────────────
export async function excluirEsporotricose(id) {
  "use server";
  try {
    await requireAcessoModulo(MODULOS.CCZ);

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
    await requireAcessoModulo(MODULOS.CCZ);

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

// ── SALVAR ZOONOSE ───────────────────────────────────────────────────────────
export async function salvarZoonose(dados) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const dataZoonose = {
      animalId: String(dados.animalId),
      doenca: dados.doenca,
      dataIdentificacao: new Date(dados.dataIdentificacao),
      grauRisco: dados.grauRisco,
      riscoVida: dados.riscoVida,
      formasContaminacao: dados.formasContaminacao,
      periodoMonitoramento: dados.solicitacaoAcompanhamento,
      dataAgendamento: dados.dataAgendamento ? new Date(dados.dataAgendamento) : null,
      responsavelMonitoramento: dados.responsavelMonitoramento,
      observacao: dados.observacao || null,
    };

    let zoonose;
    
    if (dados.id) {
      // Atualizar registro existente
      zoonose = await prisma.cadastroZoonoses.update({
        where: { id: dados.id },
        data: dataZoonose,
      });
    } else {
      // Criar novo registro
      const id = `ZOO-${Date.now().toString(36)}`.toUpperCase().slice(0, 50);
      zoonose = await prisma.cadastroZoonoses.create({
        data: {
          id,
          ...dataZoonose,
        },
      });
    }

    revalidatePath("/ccz");
    return { sucesso: true, data: zoonose };
  } catch (error) {
    console.error("Erro ao salvar zoonose:", error);
    return { sucesso: false, erro: error.message };
  }
}

// ── LISTAR ZOONOSES ──────────────────────────────────────────────────────────
export async function listarZoonoses() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const zoonoses = await prisma.cadastroZoonoses.findMany({
      include: {
        animal: true,
      },
      orderBy: { dataIdentificacao: "desc" },
    });

    return { sucesso: true, data: zoonoses };
  } catch (error) {
    console.error("Erro ao listar zoonoses:", error);
    return { sucesso: false, erro: error.message };
  }
}

// ── OBTER UMA ZOONOSE (para edição) ─────────────────────────────────────────
export async function obterZoonose(id) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const zoonose = await prisma.cadastroZoonoses.findUnique({
      where: { id },
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
      },
    });

    if (!zoonose) {
      return { success: false, error: "Zoonose não encontrada." };
    }

    const a = zoonose.animal || null;
    const tutorPessoa = a?.tutor?.pessoa || null;
    const enderecoPrincipal = tutorPessoa?.enderecos?.[0] || null;

    // Formatar endereço completo
    let enderecoFormatado = "";
    if (enderecoPrincipal) {
      const partes = [];
      if (enderecoPrincipal.logradouro) partes.push(enderecoPrincipal.logradouro);
      if (enderecoPrincipal.numero) partes.push(`nº ${enderecoPrincipal.numero}`);
      if (enderecoPrincipal.bairro) partes.push(enderecoPrincipal.bairro);
      if (enderecoPrincipal.cidade) partes.push(enderecoPrincipal.cidade);
      if (enderecoPrincipal.uf) partes.push(enderecoPrincipal.uf);
      enderecoFormatado = partes.join(", ");
    }

    const data = {
      id: zoonose.id,
      animalId: zoonose.animalId,
      animalNome: zoonose.animal?.nome || "",
      tutorNome: tutorPessoa?.nomeCompleto || "", // Adicionar tutorNome
      animal: a ? {
        id: a.id,
        nome: a.nome || "",
        especie: a.especie || "",
      } : null,
      tutor: tutorPessoa ? {
        nome: tutorPessoa.nomeCompleto || "",
        cpf: tutorPessoa.cpf || "",
        telefone: tutorPessoa.telefone || "",
        endereco: enderecoFormatado || "",
      } : null,
      doenca: zoonose.doenca,
      dataIdentificacao: dateParaYMD(zoonose.dataIdentificacao),
      grauRisco: zoonose.grauRisco,
      riscoVida: zoonose.riscoVida,
      formasContaminacao: zoonose.formasContaminacao || "",
      solicitacaoAcompanhamento: zoonose.periodoMonitoramento,
      dataAgendamento: dateParaYMD(zoonose.dataAgendamento),
      responsavelMonitoramento: zoonose.responsavelMonitoramento || "",
      observacao: zoonose.observacao || "",
    };

    return { success: true, data };
  } catch (error) {
    console.error("Erro ao obter zoonose:", error);
    return { success: false, error: error.message };
  }
}

// ── SALVAR DENÚNCIA ──────────────────────────────────────────────────────────
export async function salvarDenuncia(dados) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

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
      },
    });

    revalidatePath("/ccz");
    return { sucesso: true, data: denuncia };
  } catch (error) {
    console.error("Erro ao salvar denúncia:", error);
    return { sucesso: false, erro: error.message };
  }
}

// ── LISTAR DENÚNCIAS ─────────────────────────────────────────────────────────
export async function listarDenuncias() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const denuncias = await prisma.denunciaCaoAgressivo.findMany({
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
