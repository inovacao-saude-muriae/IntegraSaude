"use server";

import { requireAcessoModulo, requirePermissao } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { situacaoRegistro } from "@/components/cadastros/situacaoCadastro";

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
    // Leitura do catálogo da Junta: exige vínculo com o módulo.
    await requireAcessoModulo(MODULOS.JUNTA);
    const [servicos, especialidades] = await Promise.all([
      prisma.servico.findMany({ orderBy: { nome: "asc" } }),
      prisma.especialidade.findMany({
        include: { servico: true },
        orderBy: [{ servico: { nome: "asc" } }, { nome: "asc" }],
      }),
    ]);

    // Linhas de especialidades (id do registro de especialidade).
    // `especialidadeAtivo` é a situação INDIVIDUAL; `disponivel` combina com a
    // situação do serviço (categoria superior) — inativar o serviço não altera
    // o `ativo` das especialidades, apenas as deixa indisponíveis.
    const linhasEsp = especialidades.map((e) => {
      const situacao = situacaoRegistro({
        ativo: e.ativo,
        paiAtivo: e.servico?.ativo !== false,
      });
      return {
        id: e.id,
        tipo: "ESPECIALIDADE",
        especialidadeId: e.id,
        nome: e.nome,
        especialidadeAtivo: situacao.individualAtivo,
        servicoAtivo: situacao.paiAtivo,
        disponivel: situacao.operacional,
        indisponivelPorCategoria: situacao.motivo === "categoria",
        servicoId: e.servicoId,
        servicoNome: e.servico?.nome || "—",
      };
    });

    // Linha própria de cada SERVIÇO (a categoria), independentemente de ter
    // especialidades: é nela que fica a ação de inativar/reativar o serviço.
    const linhasServico = servicos
      .map((s) => ({
        id: `s-${s.id}`,
        tipo: "SERVICO",
        especialidadeId: null,
        nome: "",
        especialidadeAtivo: null,
        servicoId: s.id,
        servicoNome: s.nome,
        servicoAtivo: s.ativo !== false,
        disponivel: s.ativo !== false,
        indisponivelPorCategoria: false,
      }));

    // Ordem: por serviço e, dentro dele, a linha do serviço (categoria) primeiro
    // e as especialidades em seguida — a hierarquia fica visível na listagem.
    const ehCategoria = (l) => (l.tipo === "SERVICO" ? 0 : 1);
    const linhas = [...linhasServico, ...linhasEsp].sort((a, b) => {
      const cmp = a.servicoNome.localeCompare(b.servicoNome, "pt-BR");
      if (cmp !== 0) return cmp;
      const nivel = ehCategoria(a) - ehCategoria(b);
      if (nivel !== 0) return nivel;
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });

    return {
      servicos: servicos.map((s) => ({ id: s.id, nome: s.nome, ativo: s.ativo !== false })),
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

// ── INATIVAR / REATIVAR ──────────────────────────────────────────────────
// Nunca exclui: o registro continua legível em agendamentos e atendimentos
// já existentes. A permissão é NOMINAL (JUNTA/servicos:inativar), não herdada
// por quem só cadastra ou edita.

/** Inativa (ou reativa) um serviço da Junta. */
export async function alterarSituacaoServico(id, { ativo } = {}) {
  try {
    const user = await requirePermissao(MODULOS.JUNTA, "servicos", "inativar");
    const servicoId = Number(id);
    if (!Number.isSafeInteger(servicoId) || servicoId <= 0) {
      return { success: false, error: "Serviço inválido." };
    }
    if (typeof ativo !== "boolean") {
      return { success: false, error: "Informe a situação desejada." };
    }

    const atual = await prisma.servico.findUnique({ where: { id: servicoId } });
    if (!atual) return { success: false, error: "Serviço não encontrado." };
    if (atual.ativo === ativo) return { success: true, semAlteracoes: true };

    // A inativação NÃO toca no `ativo` das especialidades: elas apenas ficam
    // operacionalmente indisponíveis enquanto o serviço estiver inativo. Por
    // isso reativar o serviço devolve cada especialidade ao estado que tinha,
    // preservando as inativações individuais anteriores.
    await prisma.servico.update({ where: { id: servicoId }, data: { ativo } });

    const subordinados = await prisma.especialidade.count({ where: { servicoId } });

    await registrarAuditoria({
      user,
      acao: ativo ? "REATIVAR" : "DESATIVAR",
      modulo: "JUNTA",
      entidade: "Servico",
      entidadeId: String(servicoId),
      descricao: `Serviço '${atual.nome}' ${ativo ? "reativado" : "inativado"}`,
      detalhes: { nome: atual.nome, ativo, especialidadesAfetadas: subordinados },
    });

    revalidatePath("/junta-reguladora");
    revalidatePath("/gerenciamento/servicos-especialidades");
    return { success: true, subordinados };
  } catch (error) {
    console.error("Erro ao alterar situação do serviço:", error);
    return { success: false, error: error.message };
  }
}

/** Inativa (ou reativa) uma especialidade da Junta. */
export async function alterarSituacaoEspecialidade(id, { ativo } = {}) {
  try {
    const user = await requirePermissao(MODULOS.JUNTA, "servicos", "inativar");
    const espId = Number(id);
    if (!Number.isSafeInteger(espId) || espId <= 0) {
      return { success: false, error: "Especialidade inválida." };
    }
    if (typeof ativo !== "boolean") {
      return { success: false, error: "Informe a situação desejada." };
    }

    const atual = await prisma.especialidade.findUnique({ where: { id: espId } });
    if (!atual) return { success: false, error: "Especialidade não encontrada." };
    if (atual.ativo === ativo) return { success: true, semAlteracoes: true };

    await prisma.especialidade.update({ where: { id: espId }, data: { ativo } });

    await registrarAuditoria({
      user,
      acao: ativo ? "REATIVAR" : "DESATIVAR",
      modulo: "JUNTA",
      entidade: "Especialidade",
      entidadeId: String(espId),
      descricao: `Especialidade '${atual.nome}' ${ativo ? "reativada" : "inativada"}`,
      detalhes: { nome: atual.nome, servicoId: atual.servicoId, ativo },
    });

    revalidatePath("/junta-reguladora");
    revalidatePath("/gerenciamento/servicos-especialidades");
    return { success: true };
  } catch (error) {
    console.error("Erro ao alterar situação da especialidade:", error);
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
