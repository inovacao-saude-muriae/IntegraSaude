"use server";

import { requireAdminModulo, requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// Tipos de exame / procedimentos pertencem à Regulação (design §4.4).

// Garante que exista um Tipo de Exame com o nome informado (cria se necessário)
// ou usa o tipoExameId passado. Retorna o id.
async function resolverTipoExameId({ tipoExameId, tipoExameNome }) {
  if (tipoExameId) return Number(tipoExameId);

  const nome = (tipoExameNome || "").trim();
  if (!nome) throw new Error("Informe o tipo de exame.");

  const existente = await prisma.tipoExame.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
  });
  if (existente) return existente.id;

  const novo = await prisma.tipoExame.create({ data: { nome } });
  return novo.id;
}

function parseValor(valor) {
  const n = parseFloat(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ── LEITURA ────────────────────────────────────────────────────────────────

// Lista unificada: cada linha é um par Tipo de Exame + Procedimento.
// Tipos de exame sem nenhum procedimento aparecem como uma linha (procedimento vazio).
export async function getProcedimentosData() {
  try {
    // Leitura do catálogo da Regulação: exige vínculo com o módulo.
    await requireAcessoModulo(MODULOS.REGULACAO);
    const [tiposExame, procedimentos] = await Promise.all([
      prisma.tipoExame.findMany({ orderBy: { nome: "asc" } }),
      prisma.procedimento.findMany({
        include: { tipoExame: true },
        orderBy: [{ tipoExame: { nome: "asc" } }, { nome: "asc" }],
      }),
    ]);

    const tiposComProc = new Set(procedimentos.map((p) => p.tipoExameId));

    const linhasProc = procedimentos.map((p) => ({
      id: p.id,
      tipo: "PROCEDIMENTO",
      procedimentoId: p.id,
      nome: p.nome,
      valor: Number(p.valor),
      tipoExameId: p.tipoExameId,
      tipoExameNome: p.tipoExame?.nome || "—",
    }));

    const linhasTipoSozinho = tiposExame
      .filter((t) => !tiposComProc.has(t.id))
      .map((t) => ({
        id: `t-${t.id}`,
        tipo: "TIPO_EXAME",
        procedimentoId: null,
        nome: "",
        valor: null,
        tipoExameId: t.id,
        tipoExameNome: t.nome,
      }));

    const linhas = [...linhasProc, ...linhasTipoSozinho].sort((a, b) => {
      const cmp = a.tipoExameNome.localeCompare(b.tipoExameNome, "pt-BR");
      if (cmp !== 0) return cmp;
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });

    return {
      tiposExame: tiposExame.map((t) => ({ id: t.id, nome: t.nome })),
      linhas,
    };
  } catch (error) {
    console.error("Erro ao carregar tipos de exame/procedimentos:", error);
    return { tiposExame: [], linhas: [] };
  }
}

// ── GRAVAÇÃO UNIFICADA ───────────────────────────────────────────────────

// Cria um registro. Tipo de exame obrigatório (id ou nome novo); procedimento opcional.
export async function createRegistro(data) {
  try {
    const user = await requireAdminModulo(MODULOS.REGULACAO);
    const tipoExameId = await resolverTipoExameId(data);

    const procedimentoNome = (data.procedimentoNome || "").trim();
    let procedimentoCriado = null;
    if (procedimentoNome) {
      procedimentoCriado = await prisma.procedimento.create({
        data: { nome: procedimentoNome, valor: parseValor(data.valor), tipoExameId },
      });
    }

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "REGULACAO",
      entidade: procedimentoCriado ? "Procedimento" : "TipoExame",
      entidadeId: String(procedimentoCriado ? procedimentoCriado.id : tipoExameId),
      descricao: procedimentoCriado
        ? `Procedimento '${procedimentoNome}' cadastrado`
        : `Tipo de exame #${tipoExameId} cadastrado`,
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao cadastrar registro:", error);
    return { success: false, error: error.message };
  }
}

export async function updateRegistro(linha, data) {
  try {
    const user = await requireAdminModulo(MODULOS.REGULACAO);
    const tipoExameId = await resolverTipoExameId(data);
    const procedimentoNome = (data.procedimentoNome || "").trim();

    if (linha.procedimentoId) {
      if (procedimentoNome) {
        await prisma.procedimento.update({
          where: { id: Number(linha.procedimentoId) },
          data: { nome: procedimentoNome, valor: parseValor(data.valor), tipoExameId },
        });
      } else {
        // Procedimento removido na edição: apaga o registro de procedimento.
        await prisma.procedimento.delete({
          where: { id: Number(linha.procedimentoId) },
        });
      }
    } else if (procedimentoNome) {
      // Linha era só tipo de exame e agora recebeu um procedimento.
      await prisma.procedimento.create({
        data: { nome: procedimentoNome, valor: parseValor(data.valor), tipoExameId },
      });
    }

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: "REGULACAO",
      entidade: linha.procedimentoId ? "Procedimento" : "TipoExame",
      entidadeId: String(linha.procedimentoId || tipoExameId),
      descricao: linha.procedimentoId
        ? `Procedimento #${linha.procedimentoId} atualizado`
        : `Tipo de exame #${tipoExameId} atualizado`,
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar registro:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteRegistro(linha) {
  try {
    const user = await requireAdminModulo(MODULOS.REGULACAO);

    if (linha.procedimentoId) {
      await prisma.procedimento.delete({
        where: { id: Number(linha.procedimentoId) },
      });
    } else {
      await prisma.tipoExame.delete({ where: { id: Number(linha.tipoExameId) } });
    }

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "REGULACAO",
      entidade: linha.procedimentoId ? "Procedimento" : "TipoExame",
      entidadeId: String(linha.procedimentoId || linha.tipoExameId),
      descricao: linha.procedimentoId
        ? `Procedimento #${linha.procedimentoId} excluído`
        : `Tipo de exame #${linha.tipoExameId} excluído`,
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir registro:", error);
    if (error.code === "P2003") {
      return {
        success: false,
        error:
          "Não é possível excluir: há procedimentos ou pedidos de exame vinculados a este item.",
      };
    }
    return { success: false, error: error.message };
  }
}
