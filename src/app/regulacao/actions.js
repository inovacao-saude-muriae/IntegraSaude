"use server";

import {
  requireAdminModulo,
  requireAcessoModulo,
  requireAcessoPessoas,
} from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  criarPessoaTx,
  atualizarPessoaTx,
  gravarEnderecoTx,
} from "@/lib/pessoa";

// Função auxiliar com fuso horário seguro para formatar DATE em DD/MM/YYYY
function formatDateToBR(dateObjOrString) {
  if (!dateObjOrString) return "-";

  try {
    if (typeof dateObjOrString === "string") {
      const cleanStr = dateObjOrString.split("T")[0];
      const parts = cleanStr.split("-");
      if (parts.length === 3) {
        return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
      }
      return cleanStr;
    }

    if (dateObjOrString instanceof Date && !isNaN(dateObjOrString.getTime())) {
      const day = String(dateObjOrString.getUTCDate()).padStart(2, "0");
      const month = String(dateObjOrString.getUTCMonth() + 1).padStart(2, "0");
      const year = dateObjOrString.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (err) {
    console.error("Erro ao formatar data:", err);
  }

  return "-";
}

// Converte string de data em Date válida, aceitando ISO (YYYY-MM-DD) ou BR
// (DD/MM/YYYY). Retorna null se vazia/inválida (evita `new Date("Invalid Date")`).
function parseDataSegura(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  if (!s || s === "-") return null;

  // BR: DD/MM/YYYY -> YYYY-MM-DD
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : s;

  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Monta a competência "YYYY-MM" a partir de mês/ano (com fallback na data de liberação).
function montarCompetenciaCota({
  quotaCompetenceYear,
  quotaCompetenceMonth,
  releaseDate,
  releaseDateRaw,
}) {
  const ano = String(quotaCompetenceYear || "").slice(0, 4);
  const mes = String(quotaCompetenceMonth || "").padStart(2, "0").slice(0, 2);
  if (ano && mes && ano.length === 4 && mes !== "00") return `${ano}-${mes}`;
  // Fallback: deriva da data de liberação, se válida.
  const d = parseDataSegura(releaseDateRaw || releaseDate);
  if (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  return null;
}

// 1. Buscar todos os pedidos relacionando as tabelas pessoa, procedimento, ubs e medicos
export async function getPedidosExames() {
  try {
    const data = await prisma.pedidoExame.findMany({
      include: {
        pessoa: true,
        procedimento: {
          include: { tipoExame: true },
        },
        ubs: true,
        medicoSolicitante: true,
        medicoResponsavel: true,
      },
      orderBy: { dataSolicitacao: "desc" },
    });

    return data.map((item) => {
      const dataLiberacaoStr = item.dataLiberacao
        ? item.dataLiberacao.toISOString().split("T")[0]
        : null;
      const dataSolicitacaoRaw = item.dataSolicitacao
        ? item.dataSolicitacao.toISOString().split("T")[0]
        : "";

      const examName = item.procedimento?.tipoExame?.nome || "EXA";
      const prefix = examName.trim().substring(0, 3).toUpperCase();
      const customCode = `${prefix}${item.id}`;

      return {
        id: customCode,
        dbId: item.id,
        examType: item.procedimento?.tipoExame?.nome || "",
        examTypeId: item.procedimento?.tipoExameId || null,
        procedure: item.procedimento?.nome || "",
        procedureId: item.procedimentoId,
        estimatedCost: item.procedimento ? Number(item.procedimento.valor) : 0,
        patientName: item.pessoa?.nomeCompleto || "",
        motherName: item.pessoa?.nomeMae || "",
        birthDate: item.pessoa?.dataNascimento
          ? formatDateToBR(item.pessoa.dataNascimento)
          : "",
        cpf: item.pessoaCpf,
        susCard: item.cnsPaciente || "",

        requestDate: formatDateToBR(dataSolicitacaoRaw),
        requestDateRaw: dataSolicitacaoRaw,

        classification: item.classificacaoRisco || "Verde",
        localRealizacao: item.localRealizacao || "",
        // Competência que debita o financeiro: usa competenciaCota ("YYYY-MM")
        // se existir; senão, cai no fallback antigo (mês/ano da data de liberação).
        competence: item.competenciaCota
          ? `${item.competenciaCota.slice(5, 7)}/${item.competenciaCota.slice(0, 4)}`
          : dataLiberacaoStr
            ? `${dataLiberacaoStr.slice(5, 7)}/${dataLiberacaoStr.slice(0, 4)}`
            : "",
        quotaCompetenceMonth: item.competenciaCota
          ? item.competenciaCota.slice(5, 7)
          : dataLiberacaoStr
            ? dataLiberacaoStr.slice(5, 7)
            : "",
        quotaCompetenceYear: item.competenciaCota
          ? item.competenciaCota.slice(0, 4)
          : dataLiberacaoStr
            ? dataLiberacaoStr.slice(0, 4)
            : "",
        requestDoctor: item.medicoSolicitante?.nome || "",
        requestDoctorId: item.medicoSolicitanteId || "",
        requestUbs: item.ubs?.nome || "",
        requestUbsId: item.ubsResponsavelId || "",
        justification: item.observacao || "",
        status: item.status,
        communicationDate: item.dataComunicacao
          ? item.dataComunicacao.toISOString().split("T")[0]
          : "",
        communicationStatus: item.statusComunicacao || "",
        quota: item.tipoCota || "",
        generalObservation: item.observacao || "",
        regulatorDoctor: item.medicoResponsavel?.nome || null,
        regulatorDoctorId: item.medicoResponsavelId || "",
        releaseDate: formatDateToBR(dataLiberacaoStr),
        releaseDateRaw: dataLiberacaoStr,
        billingDate: "",
      };
    });
  } catch (error) {
    console.error("Erro ao buscar pedidos no banco:", error);
    return [];
  }
}

// 2. Buscar Dados Auxiliares
export async function getAuxiliaryData() {
  try {
    const [tiposExame, procedimentos, medicos, ubsList, pessoas] =
      await Promise.all([
        prisma.tipoExame.findMany({ orderBy: { nome: "asc" } }),
        prisma.procedimento.findMany({
          include: { tipoExame: true },
          orderBy: { nome: "asc" },
        }),
        prisma.medico.findMany({
          where: { ativo: true },
          orderBy: { nome: "asc" },
        }),
        prisma.ubs.findMany({
          where: { ativo: true },
          orderBy: { nome: "asc" },
        }),
        prisma.pessoa.findMany({
          include: {
            enderecos: { where: { enderecoAtual: true } },
            ubsReferencia: true,
          },
          orderBy: { nomeCompleto: "asc" },
          // Removido: take: 100 (limitava a lista)
        }),
      ]);

    return {
      tiposExame: tiposExame.map((t) => ({ id: t.id, nome: t.nome })),
      procedimentos: procedimentos.map((p) => ({
        id: p.id,
        nome: p.nome,
        valor: Number(p.valor),
        tipoExameId: p.tipoExameId,
        tipoExameNome: p.tipoExame.nome,
      })),
      medicos: medicos.map((m) => ({
        id: m.id,
        nome: m.nome,
        crm: m.crm,
        ufCrm: m.ufCrm,
        especialidade: m.especialidade,
        tipo: m.tipo || "Solicitante",
      })),
      ubsList: ubsList.map((u) => ({ id: u.id, nome: u.nome, cnes: u.cnes })),
      pessoas: pessoas.map((p) => {
        const endereco = p.enderecos && p.enderecos[0];
        return {
          cpf: p.cpf,
          cns: p.cns || "",
          nomeCompleto: p.nomeCompleto,
          nomeMae: p.nomeMae,
          sexo: p.sexo || "",
          telefone: p.telefone,
          dataNascimento: formatDateToBR(p.dataNascimento),
          ubsReferenciaId: p.ubsReferenciaId || "",
          ubsReferencia: p.ubsReferencia?.nome || "",
          logradouro: endereco?.logradouro || "",
          numero: endereco?.numero || "",
          complemento: endereco?.complemento || "",
          bairro: endereco?.bairro || "",
          cidade: endereco?.cidade || "",
          uf: endereco?.uf || "",
          cep: endereco?.cep || "",
        };
      }),
    };
  } catch (error) {
    console.error("Erro ao carregar dados auxiliares:", error);
    return {
      tiposExame: [],
      procedimentos: [],
      medicos: [],
      ubsList: [],
      pessoas: [],
    };
  }
}

// 3. Buscar uma pessoa específica por CPF ou Nome (Suporta CPF limpo ou formatado)
export async function searchPessoa(term) {
  try {
    if (!term) return null;
    const cleanTerm = term.replace(/\D/g, "");

    const pessoa = await prisma.pessoa.findFirst({
      where: {
        OR: [
          { cpf: term },
          ...(cleanTerm ? [{ cpf: cleanTerm }] : []),
          { nomeCompleto: { contains: term, mode: "insensitive" } },
        ],
      },
    });

    if (!pessoa) return null;

    return {
      ...pessoa,
      dataNascimento: formatDateToBR(pessoa.dataNascimento),
    };
  } catch (error) {
    console.error("Erro ao buscar pessoa:", error);
    return null;
  }
}

// 4. Autocomplete de Pessoas (Suporta CPF limpo ou formatado)
export async function searchPessoasAutocomplete(term) {
  if (!term || term.trim().length < 2) return [];

  try {
    const cleanTerm = term.replace(/\D/g, "");

    const pessoas = await prisma.pessoa.findMany({
      where: {
        OR: [
          { cpf: { contains: term } },
          ...(cleanTerm ? [{ cpf: { contains: cleanTerm } }] : []),
          { nomeCompleto: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 10,
    });

    return pessoas.map((p) => ({
      cpf: p.cpf,
      cns: p.cns || "",
      nomeCompleto: p.nomeCompleto,
      nomeMae: p.nomeMae,
      dataNascimento: formatDateToBR(p.dataNascimento),
    }));
  } catch (error) {
    console.error("Erro no autocomplete de pessoa:", error);
    return [];
  }
}

// 5. Salvar Novo Pedido
export async function createPedidoExame(data) {
  try {
    const newRecord = await prisma.pedidoExame.create({
      data: {
        pessoaCpf: data.cpf,
        cnsPaciente: data.susCard || null,
        procedimentoId: Number(data.procedureId),
        medicoSolicitanteId: data.medicoSolicitanteId
          ? Number(data.medicoSolicitanteId)
          : null,
        ubsResponsavelId: data.ubsResponsavelId
          ? Number(data.ubsResponsavelId)
          : null,
        classificacaoRisco: data.classification,
        localRealizacao: data.localRealizacao || null,
        observacao: data.justification,
        status: "Aguardando",
      },
    });

    revalidatePath("/regulacao");
    return { success: true, data: newRecord };
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return { success: false, error: error.message };
  }
}

// 6. Atualizar Comunicação (data e/ou status)
// `extra` pode conter { statusComunicacao }. Quando não informado, mantém a
// lógica antiga de marcar ENVIADO/PENDENTE conforme a data.
export async function updateCommunicationDate(idStr, dateStr, extra = {}) {
  try {
    const numericId = Number(String(idStr).replace(/\D/g, ""));

    const data = {
      dataComunicacao: dateStr ? new Date(dateStr) : null,
    };

    if (extra && typeof extra.statusComunicacao === "string") {
      data.statusComunicacao = extra.statusComunicacao || null;
    } else {
      data.statusComunicacao = dateStr ? "ENVIADO" : "PENDENTE";
    }

    await prisma.pedidoExame.update({
      where: { id: numericId },
      data,
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar comunicação:", error);
    return { success: false };
  }
}

// 7. Liberar Paciente
export async function releasePaciente(idStr, releaseData) {
  try {
    const numericId = Number(String(idStr).replace(/\D/g, ""));
    await prisma.pedidoExame.update({
      where: { id: numericId },
      data: {
        status: "Liberado",
        tipoCota: releaseData.quota,
        dataLiberacao: new Date(releaseData.releaseDate),
        competenciaCota: montarCompetenciaCota(releaseData),
        observacao: releaseData.generalObservation,
        dataComunicacao: parseDataSegura(releaseData.communicationDate),
        statusComunicacao: releaseData.communicationStatus || null,
        medicoResponsavelId: releaseData.regulatorDoctorId
          ? Number(releaseData.regulatorDoctorId)
          : null,
      },
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao liberar paciente:", error);
    return { success: false };
  }
}

// 8. Cadastrar Nova Pessoa / Paciente
export async function createPessoa(data) {
  try {
    await requireAcessoPessoas();
    const result = await prisma.$transaction(async (tx) => {
      // criarPessoaTx grava todos os campos obrigatórios (inclui sexo e cns).
      const pessoa = await criarPessoaTx(tx, data);
      await gravarEnderecoTx(tx, pessoa.cpf, data);
      return pessoa;
    });

    revalidatePath("/regulacao");
    return { success: true, data: result };
  } catch (error) {
    console.error("Erro ao cadastrar pessoa:", error);
    return { success: false, error: error.message };
  }
}

// 9. Cadastrar Novo Médico
export async function createMedico(data) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    const medico = await prisma.medico.create({
      data: {
        nome: data.nome,
        crm: data.crm,
        ufCrm: data.ufCrm.toUpperCase(),
        especialidade: data.especialidade,
        tipo: data.tipo || "Solicitante",
      },
    });

    revalidatePath("/regulacao");
    return { success: true, data: medico };
  } catch (error) {
    console.error("Erro ao cadastrar médico:", error);
    return { success: false, error: error.message };
  }
}

// 10. Cadastrar Nova UBS
export async function createUbs(data) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    const ubs = await prisma.ubs.create({
      data: {
        nome: data.nome,
        cnes: data.cnes,
      },
    });

    revalidatePath("/regulacao");
    return { success: true, data: ubs };
  } catch (error) {
    console.error("Erro ao cadastrar UBS:", error);
    return { success: false, error: error.message };
  }
}

// 11. Cadastrar Novo Procedimento
export async function createProcedimento(data) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    const procedimento = await prisma.procedimento.create({
      data: {
        nome: data.nome,
        valor: parseFloat(data.valor),
        tipoExameId: Number(data.tipoExameId),
      },
    });

    revalidatePath("/regulacao");
    return { success: true, data: procedimento };
  } catch (error) {
    console.error("Erro ao cadastrar procedimento:", error);
    return { success: false, error: error.message };
  }
}

// 12. Atualizar Procedimento
export async function updateProcedimento(id, data) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    const procedimento = await prisma.procedimento.update({
      where: { id: Number(id) },
      data: {
        nome: data.nome,
        valor: parseFloat(data.valor),
        tipoExameId: Number(data.tipoExameId),
      },
    });

    revalidatePath("/regulacao");
    return { success: true, data: procedimento };
  } catch (error) {
    console.error("Erro ao atualizar procedimento:", error);
    return { success: false, error: error.message };
  }
}

// 12b. Excluir Procedimento
export async function deleteProcedimento(id) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    await prisma.procedimento.delete({ where: { id: Number(id) } });
    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir procedimento:", error);
    // P2003: procedimento vinculado a pedidos de exame.
    if (error.code === "P2003") {
      return {
        success: false,
        error: "Não é possível excluir: há pedidos de exame usando este procedimento.",
      };
    }
    return { success: false, error: error.message };
  }
}

// 13. Buscar Tetos de Cotas Financeiras
export async function getCotasFinanceiras() {
  try {
    // Leitura: OPERADOR também visualiza (Financeiro somente-leitura, FR-8).
    await requireAcessoModulo(MODULOS.REGULACAO);
    const data = await prisma.cotaFinanceira.findMany();
    return data.map((c) => ({
      id: c.id,
      tipoCota: c.tipoCota,
      mes: c.mes,
      ano: c.ano,
      valorTeto: Number(c.valorTeto),
    }));
  } catch (error) {
    console.error("Erro ao buscar cotas financeiras:", error);
    return [];
  }
}

// 13. Salvar Teto de Cota
export async function saveCotaFinanceira({ tipoCota, mes, ano, valorTeto }) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);

    // Normaliza a competência (mês com 2 dígitos, ano com 4).
    const mesStr = String(mes ?? "").padStart(2, "0").slice(0, 2);
    const anoStr = String(ano ?? "").slice(0, 4);

    // Aceita número (1000.5) ou string ("1.000,50"/"1000,50"/"1000.5").
    let valorNum;
    if (typeof valorTeto === "number") {
      valorNum = valorTeto;
    } else {
      const normalizado = String(valorTeto ?? "")
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      valorNum = parseFloat(normalizado);
    }

    if (!Number.isFinite(valorNum) || valorNum < 0) {
      return { success: false, error: "Informe um valor de teto válido." };
    }
    if (!tipoCota || !mesStr || !anoStr) {
      return { success: false, error: "Competência (mês/ano) ou tipo de cota inválidos." };
    }

    const record = await prisma.cotaFinanceira.upsert({
      where: {
        tipoCota_mes_ano: { tipoCota, mes: mesStr, ano: anoStr },
      },
      update: {
        valorTeto: valorNum,
      },
      create: {
        tipoCota,
        mes: mesStr,
        ano: anoStr,
        valorTeto: valorNum,
      },
    });

    revalidatePath("/regulacao");
    // Serializa para tipos simples (Decimal/Date não podem ir para o client).
    return {
      success: true,
      data: {
        id: record.id,
        tipoCota: record.tipoCota,
        mes: record.mes,
        ano: record.ano,
        valorTeto: Number(record.valorTeto),
        createdAt: record.createdAt ? record.createdAt.toISOString() : null,
      },
    };
  } catch (error) {
    console.error("Erro ao salvar teto de cota:", error);
    return { success: false, error: error.message };
  }
}

// 13c. Buscar Planejamento Mensal por Cidade (de um ano)
export async function getPlanejamentoCidades(ano) {
  try {
    // Leitura: OPERADOR também visualiza (Financeiro somente-leitura, FR-8).
    await requireAcessoModulo(MODULOS.REGULACAO);
    const anoStr = String(ano ?? "").slice(0, 4);
    const registros = await prisma.planejamentoCidade.findMany({
      where: { ano: anoStr },
    });
    return registros.map((r) => ({
      cidade: r.cidade,
      ano: r.ano,
      mes: r.mes,
      valor: Number(r.valor),
      updatedBy: r.updatedBy || null,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    }));
  } catch (error) {
    console.error("Erro ao buscar planejamento por cidade:", error);
    return [];
  }
}

// 13d. Salvar uma célula do Planejamento (cidade + ano + mês)
export async function savePlanejamentoCidade({ cidade, ano, mes, valor }) {
  try {
    const user = await requireAdminModulo(MODULOS.REGULACAO);

    const cidadeStr = String(cidade ?? "").trim();
    const anoStr = String(ano ?? "").slice(0, 4);
    const mesStr = String(mes ?? "").padStart(2, "0").slice(0, 2);

    let valorNum;
    if (typeof valor === "number") {
      valorNum = valor;
    } else {
      const normalizado = String(valor ?? "")
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      valorNum = parseFloat(normalizado);
    }
    if (!Number.isFinite(valorNum) || valorNum < 0) valorNum = 0;

    if (!cidadeStr || !anoStr || !mesStr) {
      return { success: false, error: "Cidade ou competência inválidas." };
    }

    const record = await prisma.planejamentoCidade.upsert({
      where: {
        cidade_ano_mes: { cidade: cidadeStr, ano: anoStr, mes: mesStr },
      },
      update: { valor: valorNum, updatedBy: user?.nome || null },
      create: {
        cidade: cidadeStr,
        ano: anoStr,
        mes: mesStr,
        valor: valorNum,
        updatedBy: user?.nome || null,
      },
    });

    revalidatePath("/regulacao");
    return {
      success: true,
      data: {
        cidade: record.cidade,
        ano: record.ano,
        mes: record.mes,
        valor: Number(record.valor),
        updatedBy: record.updatedBy || null,
        updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null,
      },
    };
  } catch (error) {
    console.error("Erro ao salvar planejamento por cidade:", error);
    return { success: false, error: error.message };
  }
}

// 14. Atualizar Data de Faturamento
export async function updateBillingDate(idStr, dateStr) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    const numericId = Number(String(idStr).replace(/\D/g, ""));
    await prisma.pedidoExame.update({
      where: { id: numericId },
      data: {
        dataComunicacao: dateStr ? new Date(dateStr) : null,
      },
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar data de faturamento:", error);
    return { success: false };
  }
}

// 15. Atualizar Pedido
export async function updatePedidoExame(idStr, updateData) {
  try {
    const numericId = Number(String(idStr).replace(/\D/g, ""));
    const isRevertingToWaiting = updateData.status === "Aguardando";

    const payload = {
      status: updateData.status,
      classificacaoRisco: updateData.classification,
      localRealizacao: updateData.localRealizacao ?? null,
      cnsPaciente: updateData.susCard || null,
      observacao:
        updateData.justification || updateData.generalObservation || null,
      medicoSolicitanteId: updateData.requestDoctorId
        ? Number(updateData.requestDoctorId)
        : null,
      ubsResponsavelId: updateData.requestUbsId
        ? Number(updateData.requestUbsId)
        : null,
    };

    if (updateData.procedureId) {
      payload.procedimentoId = Number(updateData.procedureId);
    }

    // Data de comunicação (quando editada na tela de autorização).
    if (updateData.communicationDate !== undefined) {
      payload.dataComunicacao = parseDataSegura(updateData.communicationDate);
    }
    // Status de comunicação (quando editado na tela de autorização).
    if (updateData.communicationStatus !== undefined) {
      payload.statusComunicacao = updateData.communicationStatus || null;
    }

    if (isRevertingToWaiting) {
      payload.tipoCota = null;
      payload.dataLiberacao = null;
      payload.competenciaCota = null;
      payload.medicoResponsavelId = null;
    } else {
      payload.tipoCota = updateData.quota || null;
      // Prefere a data ISO (releaseDateRaw); aceita BR como fallback.
      payload.dataLiberacao = parseDataSegura(
        updateData.releaseDateRaw || updateData.releaseDate,
      );
      payload.competenciaCota = montarCompetenciaCota(updateData);
      payload.medicoResponsavelId = updateData.regulatorDoctorId
        ? Number(updateData.regulatorDoctorId)
        : null;
    }

    await prisma.pedidoExame.update({
      where: { id: numericId },
      data: payload,
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar pedido:", error);
    return { success: false, error: error.message };
  }
}

// 16. Excluir Pedido
export async function deletePedidoExame(idStr) {
  try {
    const numericId = Number(String(idStr).replace(/\D/g, ""));
    await prisma.pedidoExame.delete({
      where: { id: numericId },
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir pedido:", error);
    return { success: false, error: error.message };
  }
}

// 17. Atualizar Médico
export async function updateMedico(id, data) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    const medico = await prisma.medico.update({
      where: { id: Number(id) },
      data: {
        nome: data.nome,
        crm: data.crm,
        ufCrm: data.ufCrm.toUpperCase(),
        especialidade: data.especialidade,
        tipo: data.tipo || "Solicitante",
      },
    });

    revalidatePath("/regulacao");
    return { success: true, data: medico };
  } catch (error) {
    console.error("Erro ao atualizar médico:", error);
    return { success: false, error: error.message };
  }
}

// 18. Excluir Médico
export async function deleteMedico(id) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    await prisma.medico.update({
      where: { id: Number(id) },
      data: { ativo: false },
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir médico:", error);
    return { success: false, error: error.message };
  }
}

// 19. Atualizar Pessoa / Paciente
export async function updatePessoa(cpf, data) {
  try {
    await requireAcessoPessoas();
    const result = await prisma.$transaction(async (tx) => {
      const pessoa = await atualizarPessoaTx(tx, cpf, data);
      await gravarEnderecoTx(tx, cpf, data);
      return pessoa;
    });

    revalidatePath("/regulacao");
    return { success: true, data: result };
  } catch (error) {
    console.error("Erro ao atualizar pessoa:", error);
    return { success: false, error: error.message };
  }
}

// 20. Excluir Pessoa / Paciente
export async function deletePessoa(cpf) {
  try {
    await requireAcessoPessoas();
    await prisma.$transaction(async (tx) => {
      await tx.endereco.deleteMany({ where: { pessoaCpf: cpf } });
      await tx.pessoa.delete({ where: { cpf } });
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir pessoa:", error);
    return { success: false, error: error.message };
  }
}

// 21. Atualizar UBS
export async function updateUbs(id, data) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    const ubs = await prisma.ubs.update({
      where: { id: Number(id) },
      data: {
        nome: data.nome,
        cnes: data.cnes,
      },
    });

    revalidatePath("/regulacao");
    return { success: true, data: ubs };
  } catch (error) {
    console.error("Erro ao atualizar UBS:", error);
    return { success: false, error: error.message };
  }
}

// 22. Excluir UBS
export async function deleteUbs(id) {
  try {
    await requireAdminModulo(MODULOS.REGULACAO);
    await prisma.ubs.update({
      where: { id: Number(id) },
      data: { ativo: false },
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir UBS:", error);
    return { success: false, error: error.message };
  }
}