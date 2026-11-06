"use server";

import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// Serviços-e-Especialidades passam a pertencer à Junta (FR-3.3). Mudança
// intencional de REGULACAO_ADMIN -> JUNTA/ADMIN (design §4.4).

// Garante que exista um Serviço com o nome informado (cria se necessário)
// ou usa o servicoId passado. Retorna o id do serviço.
async function resolverServicoId({ servicoId, servicoNome }) {
  if (servicoId) return Number(servicoId);

  const nome = (servicoNome || "").trim();
  if (!nome) throw new Error("Informe o serviço.");

  const existente = await prisma.servico.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
  });
  if (existente) return existente.id;

  const novo = await prisma.servico.create({ data: { nome } });
  return novo.id;
}

// ── LEITURA ────────────────────────────────────────────────────────────────

// Lista unificada: cada linha é um par Serviço + Especialidade.
// Serviços sem nenhuma especialidade aparecem como uma linha (especialidade vazia).
export async function getServicosData() {
  try {
    const [servicos, especialidades] = await Promise.all([
      prisma.servico.findMany({ orderBy: { nome: "asc" } }),
      prisma.especialidade.findMany({
        include: { servico: true },
        orderBy: [{ servico: { nome: "asc" } }, { nome: "asc" }],
      }),
    ]);

    const servicosComEsp = new Set(especialidades.map((e) => e.servicoId));

    // Linhas de especialidades (id do registro de especialidade)
    const linhasEsp = especialidades.map((e) => ({
      id: e.id,
      tipo: "ESPECIALIDADE",
      especialidadeId: e.id,
      nome: e.nome,
      servicoId: e.servicoId,
      servicoNome: e.servico?.nome || "—",
    }));

    // Linhas de serviços sem especialidade
    const linhasServicoSozinho = servicos
      .filter((s) => !servicosComEsp.has(s.id))
      .map((s) => ({
        id: `s-${s.id}`,
        tipo: "SERVICO",
        especialidadeId: null,
        nome: "",
        servicoId: s.id,
        servicoNome: s.nome,
      }));

    const linhas = [...linhasEsp, ...linhasServicoSozinho].sort((a, b) => {
      const cmp = a.servicoNome.localeCompare(b.servicoNome, "pt-BR");
      if (cmp !== 0) return cmp;
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });

    return {
      servicos: servicos.map((s) => ({ id: s.id, nome: s.nome })),
      linhas,
    };
  } catch (error) {
    console.error("Erro ao carregar serviços/especialidades:", error);
    return { servicos: [], linhas: [] };
  }
}

// ── GRAVAÇÃO UNIFICADA ───────────────────────────────────────────────────

// Cria um registro. Serviço obrigatório (por id ou nome novo); especialidade opcional.
export async function createRegistro(data) {
  try {
    const user = await requireAcessoModulo(MODULOS.JUNTA);
    const servicoId = await resolverServicoId(data);

    const especialidadeNome = (data.especialidadeNome || "").trim();
    let especialidadeCriada = null;
    if (especialidadeNome) {
      especialidadeCriada = await prisma.especialidade.create({
        data: { nome: especialidadeNome, servicoId },
      });
    }

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "JUNTA",
      entidade: especialidadeCriada ? "Especialidade" : "Servico",
      entidadeId: String(especialidadeCriada ? especialidadeCriada.id : servicoId),
      descricao: especialidadeCriada
        ? `Especialidade '${especialidadeNome}' cadastrada`
        : `Serviço #${servicoId} cadastrado`,
    });

    revalidatePath("/junta-reguladora");
    return { success: true };
  } catch (error) {
    console.error("Erro ao cadastrar registro:", error);
    return { success: false, error: error.message };
  }
}

// Atualiza uma linha. Se ela tinha especialidade, atualiza a especialidade
// (nome + serviço). Se era serviço sozinho, apenas renomeia/reatribui serviço
// e, se informada especialidade, cria a especialidade nesse serviço.
export async function updateRegistro(linha, data) {
  try {
    const user = await requireAcessoModulo(MODULOS.JUNTA);
    const servicoId = await resolverServicoId(data);
    const especialidadeNome = (data.especialidadeNome || "").trim();

    if (linha.especialidadeId) {
      if (especialidadeNome) {
        await prisma.especialidade.update({
          where: { id: Number(linha.especialidadeId) },
          data: { nome: especialidadeNome, servicoId },
        });
      } else {
        // Especialidade removida na edição: apaga o registro de especialidade.
        await prisma.especialidade.delete({
          where: { id: Number(linha.especialidadeId) },
        });
      }
    } else if (especialidadeNome) {
      // Linha era só serviço e agora recebeu uma especialidade.
      await prisma.especialidade.create({
        data: { nome: especialidadeNome, servicoId },
      });
    }

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: "JUNTA",
      entidade: linha.especialidadeId ? "Especialidade" : "Servico",
      entidadeId: String(linha.especialidadeId || servicoId),
      descricao: linha.especialidadeId
        ? `Especialidade #${linha.especialidadeId} atualizada`
        : `Serviço #${servicoId} atualizado`,
    });

    revalidatePath("/junta-reguladora");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar registro:", error);
    return { success: false, error: error.message };
  }
}

// Exclui uma linha. Especialidade -> apaga a especialidade.
// Serviço sozinho -> apaga o serviço.
export async function deleteRegistro(linha) {
  try {
    const user = await requireAcessoModulo(MODULOS.JUNTA);

    if (linha.especialidadeId) {
      await prisma.especialidade.delete({
        where: { id: Number(linha.especialidadeId) },
      });
    } else {
      await prisma.servico.delete({ where: { id: Number(linha.servicoId) } });
    }

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "JUNTA",
      entidade: linha.especialidadeId ? "Especialidade" : "Servico",
      entidadeId: String(linha.especialidadeId || linha.servicoId),
      descricao: linha.especialidadeId
        ? `Especialidade #${linha.especialidadeId} excluída`
        : `Serviço #${linha.servicoId} excluído`,
    });

    revalidatePath("/junta-reguladora");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir registro:", error);
    if (error.code === "P2003") {
      return {
        success: false,
        error: "Não é possível excluir: há especialidades vinculadas a este serviço.",
      };
    }
    return { success: false, error: error.message };
  }
}
