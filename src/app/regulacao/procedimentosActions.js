"use server";

import { requireAdminModulo, requireAcessoModulo, requirePermissao } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { situacaoRegistro } from "@/components/cadastros/situacaoCadastro";

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

    const tipoAtivoPorId = new Map(tiposExame.map((t) => [t.id, t.ativo !== false]));

    // Procedimentos: a disponibilidade é a combinação do próprio `ativo` com a
    // situação do Tipo de Exame (categoria superior). O `ativo` do procedimento
    // nunca é alterado pela inativação do tipo, então reativar o tipo devolve a
    // cada procedimento o estado que ele tinha.
    const linhasProc = procedimentos.map((p) => {
      const tipoExameAtivo = tipoAtivoPorId.get(p.tipoExameId) !== false;
      const situacao = situacaoRegistro({ ativo: p.ativo, paiAtivo: tipoExameAtivo });
      return {
        id: p.id,
        tipo: "PROCEDIMENTO",
        procedimentoId: p.id,
        nome: p.nome,
        valor: Number(p.valor),
        ativo: situacao.individualAtivo,
        tipoExameAtivo: situacao.paiAtivo,
        disponivel: situacao.operacional,
        indisponivelPorCategoria: situacao.motivo === "categoria",
        tipoExameId: p.tipoExameId,
        tipoExameNome: p.tipoExame?.nome || "—",
      };
    });

    // Todo tipo de exame tem sua PRÓPRIA linha (a categoria), mesmo quando tem
    // procedimentos: é nela que fica a ação de inativar/reativar a categoria.
    // A linha com `nome` vazio é a da categoria; as demais são os procedimentos.
    const linhasCategoria = tiposExame
      .map((t) => {
        const tipoExameAtivo = t.ativo !== false;
        return {
          id: `t-${t.id}`,
          tipo: "TIPO_EXAME",
          procedimentoId: null,
          nome: "",
          valor: null,
          ativo: tipoExameAtivo,
          tipoExameAtivo,
          // A linha da categoria é a própria situação dela.
          disponivel: tipoExameAtivo,
          indisponivelPorCategoria: false,
          tipoExameId: t.id,
          tipoExameNome: t.nome,
        };
      });

    // Ordem: por Tipo de Exame e, dentro do tipo, a linha da categoria primeiro
    // e os procedimentos em seguida — a hierarquia fica visível na listagem.
    const ehCategoria = (l) => (l.tipo === "TIPO_EXAME" ? 0 : 1);
    const linhas = [...linhasCategoria, ...linhasProc].sort((a, b) => {
      const cmp = a.tipoExameNome.localeCompare(b.tipoExameNome, "pt-BR");
      if (cmp !== 0) return cmp;
      const nivel = ehCategoria(a) - ehCategoria(b);
      if (nivel !== 0) return nivel;
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });

    return {
      tiposExame: tiposExame.map((t) => ({
        id: t.id,
        nome: t.nome,
        ativo: t.ativo !== false,
      })),
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

// ── INATIVAR / REATIVAR ──────────────────────────────────────────────────
/**
 * Inativa/reativa o TIPO DE EXAME (categoria superior da Regulação).
 *
 * Não toca no `ativo` dos procedimentos: eles apenas ficam operacionalmente
 * indisponíveis enquanto o tipo estiver inativo. Reativar o tipo devolve cada
 * procedimento ao estado que ele tinha — inclusive os que já estavam inativos
 * individualmente.
 */
export async function alterarSituacaoTipoExame(id, { ativo } = {}) {
  try {
    const user = await requirePermissao(MODULOS.REGULACAO, "procedimentos", "inativar");
    const tipoId = Number(id);
    if (!Number.isSafeInteger(tipoId) || tipoId <= 0) {
      return { success: false, error: "Tipo de exame inválido." };
    }
    if (typeof ativo !== "boolean") {
      return { success: false, error: "Informe a situação desejada." };
    }

    const atual = await prisma.tipoExame.findUnique({ where: { id: tipoId } });
    if (!atual) return { success: false, error: "Tipo de exame não encontrado." };
    if ((atual.ativo !== false) === ativo) return { success: true, semAlteracoes: true };

    await prisma.tipoExame.update({ where: { id: tipoId }, data: { ativo } });

    const subordinados = await prisma.procedimento.count({
      where: { tipoExameId: tipoId },
    });

    await registrarAuditoria({
      user,
      acao: ativo ? "REATIVAR" : "DESATIVAR",
      modulo: "REGULACAO",
      entidade: "TipoExame",
      entidadeId: String(tipoId),
      descricao: `Tipo de exame '${atual.nome}' ${ativo ? "reativado" : "inativado"}`,
      detalhes: {
        nome: atual.nome,
        ativo,
        // A inativação da categoria não muda a situação individual dos filhos.
        procedimentosAfetados: subordinados,
      },
    });

    revalidatePath("/regulacao");
    return { success: true, subordinados };
  } catch (error) {
    console.error("Erro ao alterar situação do tipo de exame:", error);
    return { success: false, error: error.message };
  }
}

// Procedimento inativo deixa de ser oferecido em novos pedidos de exame, mas
// continua legível nos pedidos já criados. Nada é apagado. Permissão NOMINAL
// (REGULACAO/procedimentos:inativar), validada aqui — não só na tela.
export async function alterarSituacaoProcedimento(id, { ativo } = {}) {
  try {
    const user = await requirePermissao(MODULOS.REGULACAO, "procedimentos", "inativar");
    const procId = Number(id);
    if (!Number.isSafeInteger(procId) || procId <= 0) {
      return { success: false, error: "Procedimento inválido." };
    }
    if (typeof ativo !== "boolean") {
      return { success: false, error: "Informe a situação desejada." };
    }

    const atual = await prisma.procedimento.findUnique({ where: { id: procId } });
    if (!atual) return { success: false, error: "Procedimento não encontrado." };
    if (atual.ativo === ativo) return { success: true, semAlteracoes: true };

    await prisma.procedimento.update({ where: { id: procId }, data: { ativo } });

    await registrarAuditoria({
      user,
      acao: ativo ? "REATIVAR" : "DESATIVAR",
      modulo: "REGULACAO",
      entidade: "Procedimento",
      entidadeId: String(procId),
      descricao: `Procedimento '${atual.nome}' ${ativo ? "reativado" : "inativado"}`,
      detalhes: { nome: atual.nome, tipoExameId: atual.tipoExameId, ativo },
    });

    revalidatePath("/regulacao");
    return { success: true };
  } catch (error) {
    console.error("Erro ao alterar situação do procedimento:", error);
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
