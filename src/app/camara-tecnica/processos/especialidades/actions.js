"use server";

// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE ESPECIALIDADES E PROCEDIMENTOS DA ÁREA PROCESSOS
// ─────────────────────────────────────────────────────────────────────────
// Cadastro PRÓPRIO da Câmara Técnica → Processos. Não toca em
// `junta_especialidades` nem em `regula_procedimentos`: a Junta Reguladora
// mantém os seus serviços e especialidades, e nenhum dos dois lados enxerga o
// catálogo do outro.
//
// Permissões (catálogo centralizado, módulo PROCESSOS):
//   catalogo_especialidades: visualizar | criar | editar | inativar
//   catalogo_procedimentos:  visualizar | criar | editar | inativar | vincular
//
// Regras:
//  - nome único por catálogo, comparado por chave normalizada (sem acento,
//    minúsculas, espaços colapsados);
//  - inativação em vez de exclusão: registros históricos continuam legíveis;
//  - procedimento só é aceito em um processo se estiver ATIVO e VINCULADO à
//    especialidade escolhida (validado no backend, não só na tela);
//  - toda alteração é auditada.
// ═══════════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/audit";
import {
  chaveDoNome,
  limparNome,
  TAMANHO_MAXIMO_NOME,
} from "@/lib/catalogoProcessos";

const MODULO_AUDITORIA = "PROCESSOS";
const ROTA = "/camara-tecnica/processos/especialidades";

function falha(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 500) console.error("[CatalogoProcessos] erro:", erro);
  return {
    success: false,
    error: erro?.message || "Erro ao processar a solicitação.",
    status,
  };
}

function inteiroPositivo(valor) {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Nome válido → { nome, chave } ou erro.
function prepararNome(valor, campo) {
  const nome = limparNome(valor);
  if (!nome) throw falha(`Informe ${campo}.`);
  if (nome.length > TAMANHO_MAXIMO_NOME) {
    throw falha(`${campo} deve ter no máximo ${TAMANHO_MAXIMO_NOME} caracteres.`);
  }
  return { nome, chave: chaveDoNome(nome) };
}

// ── Leitura ────────────────────────────────────────────────────────────────

/**
 * Catálogo completo para a tela de gestão: especialidades (com seus
 * procedimentos vinculados) e procedimentos soltos (para vincular).
 */
export async function listarCatalogoProcessos({ incluirInativos = true } = {}) {
  try {
    await requirePermissao(MODULOS.PROCESSOS, "catalogo_especialidades", "visualizar");

    const filtroAtivo = incluirInativos ? {} : { ativo: true };

    const [especialidades, procedimentos] = await Promise.all([
      prisma.processoEspecialidade.findMany({
        where: filtroAtivo,
        orderBy: { nome: "asc" },
        include: {
          procedimentos: {
            orderBy: { procedimento: { nome: "asc" } },
            include: {
              procedimento: {
                select: { id: true, nome: true, ativo: true },
              },
            },
          },
          _count: { select: { processos: true } },
        },
      }),
      prisma.processoProcedimento.findMany({
        where: filtroAtivo,
        orderBy: { nome: "asc" },
        include: {
          especialidades: { select: { especialidadeId: true } },
          _count: { select: { processos: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        especialidades: especialidades.map((e) => ({
          id: e.id,
          nome: e.nome,
          ativo: e.ativo,
          usos: e._count?.processos ?? 0,
          procedimentos: (e.procedimentos || []).map((v) => ({
            id: v.procedimento.id,
            nome: v.procedimento.nome,
            ativo: v.procedimento.ativo,
          })),
        })),
        procedimentos: procedimentos.map((p) => ({
          id: p.id,
          nome: p.nome,
          ativo: p.ativo,
          usos: p._count?.processos ?? 0,
          especialidades: (p.especialidades || []).map((v) => v.especialidadeId),
        })),
      },
    };
  } catch (erro) {
    return responder(erro);
  }
}

/**
 * Catálogo ATIVO para os formulários de Processos Judiciais: só o que pode ser
 * escolhido em um cadastro novo. Itens inativos continuam aparecendo nos
 * processos antigos pelo nome gravado no próprio processo.
 */
export async function obterCatalogoParaFormulario() {
  try {
    await requirePermissao(MODULOS.PROCESSOS, "processo_judicial", "visualizar");

    const especialidades = await prisma.processoEspecialidade.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        procedimentos: {
          where: { procedimento: { ativo: true } },
          select: {
            procedimento: { select: { id: true, nome: true, ativo: true } },
          },
        },
      },
    });

    return {
      success: true,
      especialidades: especialidades.map((e) => ({
        id: e.id,
        nome: e.nome,
        procedimentos: (e.procedimentos || [])
          .map((v) => v.procedimento)
          .filter((p) => p && p.ativo)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      })),
    };
  } catch (erro) {
    return responder(erro);
  }
}

// ── Especialidades ─────────────────────────────────────────────────────────

export async function criarEspecialidadeProcesso({ nome } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.PROCESSOS,
      "catalogo_especialidades",
      "criar",
    );
    const { nome: nomeLimpo, chave } = prepararNome(nome, "o nome da especialidade");

    const repetida = await prisma.processoEspecialidade.findFirst({
      where: { OR: [{ nomeChave: chave }, { nome: { equals: nomeLimpo, mode: "insensitive" } }] },
      select: { id: true, nome: true, ativo: true },
    });
    if (repetida) {
      throw falha(
        repetida.ativo
          ? `Já existe a especialidade "${repetida.nome}".`
          : `Já existe a especialidade "${repetida.nome}" (inativa). Reative-a em vez de duplicar.`,
        409,
      );
    }

    const criada = await prisma.processoEspecialidade.create({
      data: { nome: nomeLimpo, nomeChave: chave },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoEspecialidade",
      entidadeId: String(criada.id),
      descricao: `Especialidade "${criada.nome}" cadastrada (catálogo de Processos)`,
      detalhes: { nome: criada.nome },
    });

    revalidatePath(ROTA);
    return { success: true, data: { id: criada.id, nome: criada.nome, ativo: criada.ativo } };
  } catch (erro) {
    return responder(erro);
  }
}

export async function editarEspecialidadeProcesso(id, { nome } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.PROCESSOS,
      "catalogo_especialidades",
      "editar",
    );
    const espId = inteiroPositivo(id);
    if (!espId) throw falha("Especialidade inválida.");

    const atual = await prisma.processoEspecialidade.findUnique({ where: { id: espId } });
    if (!atual) throw falha("Especialidade não encontrada.", 404);

    const { nome: nomeLimpo, chave } = prepararNome(nome, "o nome da especialidade");

    const repetida = await prisma.processoEspecialidade.findFirst({
      where: { nomeChave: chave, id: { not: espId } },
      select: { id: true, nome: true },
    });
    if (repetida) throw falha(`Já existe a especialidade "${repetida.nome}".`, 409);

    if (nomeLimpo === atual.nome) {
      return { success: true, data: { id: atual.id, nome: atual.nome }, semAlteracoes: true };
    }

    const atualizada = await prisma.processoEspecialidade.update({
      where: { id: espId },
      data: { nome: nomeLimpo, nomeChave: chave },
    });

    // O nome gravado nos processos já existentes é histórico: não é reescrito.
    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoEspecialidade",
      entidadeId: String(espId),
      descricao: `Especialidade alterada: "${atual.nome}" → "${atualizada.nome}"`,
      detalhes: { nomeAnterior: atual.nome, nomeNovo: atualizada.nome },
    });

    revalidatePath(ROTA);
    return { success: true, data: { id: atualizada.id, nome: atualizada.nome } };
  } catch (erro) {
    return responder(erro);
  }
}

/** Inativa (ou reativa) — nunca exclui, para não quebrar histórico. */
export async function alterarSituacaoEspecialidadeProcesso(id, { ativo } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.PROCESSOS,
      "catalogo_especialidades",
      "inativar",
    );
    const espId = inteiroPositivo(id);
    if (!espId) throw falha("Especialidade inválida.");
    if (typeof ativo !== "boolean") throw falha("Informe a situação desejada.");

    const atual = await prisma.processoEspecialidade.findUnique({ where: { id: espId } });
    if (!atual) throw falha("Especialidade não encontrada.", 404);
    if (atual.ativo === ativo) {
      return { success: true, data: { id: atual.id, ativo: atual.ativo }, semAlteracoes: true };
    }

    const atualizada = await prisma.processoEspecialidade.update({
      where: { id: espId },
      data: { ativo },
    });

    await registrarAuditoria({
      user,
      acao: ativo ? "REATIVAR" : "INATIVAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoEspecialidade",
      entidadeId: String(espId),
      descricao: `Especialidade "${atual.nome}" ${ativo ? "reativada" : "inativada"}`,
      detalhes: { nome: atual.nome, ativo },
    });

    revalidatePath(ROTA);
    return { success: true, data: { id: atualizada.id, ativo: atualizada.ativo } };
  } catch (erro) {
    return responder(erro);
  }
}

// ── Procedimentos ──────────────────────────────────────────────────────────

export async function criarProcedimentoProcesso({ nome, especialidadeIds = [] } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.PROCESSOS,
      "catalogo_procedimentos",
      "criar",
    );
    const { nome: nomeLimpo, chave } = prepararNome(nome, "o nome do procedimento");

    const repetido = await prisma.processoProcedimento.findFirst({
      where: { OR: [{ nomeChave: chave }, { nome: { equals: nomeLimpo, mode: "insensitive" } }] },
      select: { id: true, nome: true, ativo: true },
    });
    if (repetido) {
      throw falha(
        repetido.ativo
          ? `Já existe o procedimento "${repetido.nome}".`
          : `Já existe o procedimento "${repetido.nome}" (inativo). Reative-o em vez de duplicar.`,
        409,
      );
    }

    const ids = [...new Set((especialidadeIds || []).map(inteiroPositivo).filter(Boolean))];
    if (ids.length) {
      const existentes = await prisma.processoEspecialidade.count({ where: { id: { in: ids } } });
      if (existentes !== ids.length) throw falha("Especialidade informada não existe no catálogo.");
    }

    const criado = await prisma.processoProcedimento.create({
      data: {
        nome: nomeLimpo,
        nomeChave: chave,
        especialidades: ids.length
          ? { create: ids.map((especialidadeId) => ({ especialidadeId })) }
          : undefined,
      },
      include: { especialidades: { select: { especialidadeId: true } } },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoProcedimento",
      entidadeId: String(criado.id),
      descricao: `Procedimento "${criado.nome}" cadastrado (catálogo de Processos)`,
      detalhes: {
        nome: criado.nome,
        especialidades: ids.length,
      },
    });

    revalidatePath(ROTA);
    return {
      success: true,
      data: {
        id: criado.id,
        nome: criado.nome,
        ativo: criado.ativo,
        especialidades: ids,
      },
    };
  } catch (erro) {
    return responder(erro);
  }
}

export async function editarProcedimentoProcesso(id, { nome } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.PROCESSOS,
      "catalogo_procedimentos",
      "editar",
    );
    const procId = inteiroPositivo(id);
    if (!procId) throw falha("Procedimento inválido.");

    const atual = await prisma.processoProcedimento.findUnique({ where: { id: procId } });
    if (!atual) throw falha("Procedimento não encontrado.", 404);

    const { nome: nomeLimpo, chave } = prepararNome(nome, "o nome do procedimento");

    const repetido = await prisma.processoProcedimento.findFirst({
      where: { nomeChave: chave, id: { not: procId } },
      select: { id: true, nome: true },
    });
    if (repetido) throw falha(`Já existe o procedimento "${repetido.nome}".`, 409);

    if (nomeLimpo === atual.nome) {
      return { success: true, data: { id: atual.id, nome: atual.nome }, semAlteracoes: true };
    }

    const atualizado = await prisma.processoProcedimento.update({
      where: { id: procId },
      data: { nome: nomeLimpo, nomeChave: chave },
    });

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoProcedimento",
      entidadeId: String(procId),
      descricao: `Procedimento alterado: "${atual.nome}" → "${atualizado.nome}"`,
      detalhes: { nomeAnterior: atual.nome, nomeNovo: atualizado.nome },
    });

    revalidatePath(ROTA);
    return { success: true, data: { id: atualizado.id, nome: atualizado.nome } };
  } catch (erro) {
    return responder(erro);
  }
}

export async function alterarSituacaoProcedimentoProcesso(id, { ativo } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.PROCESSOS,
      "catalogo_procedimentos",
      "inativar",
    );
    const procId = inteiroPositivo(id);
    if (!procId) throw falha("Procedimento inválido.");
    if (typeof ativo !== "boolean") throw falha("Informe a situação desejada.");

    const atual = await prisma.processoProcedimento.findUnique({ where: { id: procId } });
    if (!atual) throw falha("Procedimento não encontrado.", 404);
    if (atual.ativo === ativo) {
      return { success: true, data: { id: atual.id, ativo: atual.ativo }, semAlteracoes: true };
    }

    const atualizado = await prisma.processoProcedimento.update({
      where: { id: procId },
      data: { ativo },
    });

    await registrarAuditoria({
      user,
      acao: ativo ? "REATIVAR" : "INATIVAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoProcedimento",
      entidadeId: String(procId),
      descricao: `Procedimento "${atual.nome}" ${ativo ? "reativado" : "inativado"}`,
      detalhes: { nome: atual.nome, ativo },
    });

    revalidatePath(ROTA);
    return { success: true, data: { id: atualizado.id, ativo: atualizado.ativo } };
  } catch (erro) {
    return responder(erro);
  }
}

// ── Vínculos especialidade ↔ procedimento ──────────────────────────────────

/**
 * Define os procedimentos de uma especialidade (substitui o conjunto).
 * Usado pela tela de gestão: "adicionar um ou vários procedimentos".
 */
export async function definirProcedimentosDaEspecialidade(id, { procedimentoIds = [] } = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.PROCESSOS,
      "catalogo_procedimentos",
      "vincular",
    );
    const espId = inteiroPositivo(id);
    if (!espId) throw falha("Especialidade inválida.");

    const especialidade = await prisma.processoEspecialidade.findUnique({
      where: { id: espId },
      select: { id: true, nome: true },
    });
    if (!especialidade) throw falha("Especialidade não encontrada.", 404);

    const ids = [...new Set((procedimentoIds || []).map(inteiroPositivo).filter(Boolean))];
    if (ids.length) {
      const existentes = await prisma.processoProcedimento.count({ where: { id: { in: ids } } });
      if (existentes !== ids.length) throw falha("Procedimento informado não existe no catálogo.");
    }

    const antes = await prisma.processoEspecialidadeProcedimento.findMany({
      where: { especialidadeId: espId },
      select: { procedimentoId: true },
    });
    const antesIds = antes.map((v) => v.procedimentoId);

    await prisma.$transaction([
      prisma.processoEspecialidadeProcedimento.deleteMany({
        where: { especialidadeId: espId, procedimentoId: { notIn: ids.length ? ids : [-1] } },
      }),
      ...(ids.length
        ? [
            prisma.processoEspecialidadeProcedimento.createMany({
              data: ids.map((procedimentoId) => ({ especialidadeId: espId, procedimentoId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    const adicionados = ids.filter((i) => !antesIds.includes(i));
    const removidos = antesIds.filter((i) => !ids.includes(i));

    if (adicionados.length || removidos.length) {
      await registrarAuditoria({
        user,
        acao: "EDITAR",
        modulo: MODULO_AUDITORIA,
        entidade: "ProcessoEspecialidadeProcedimento",
        entidadeId: String(espId),
        descricao: `Vínculos de "${especialidade.nome}" atualizados`,
        detalhes: {
          especialidade: especialidade.nome,
          vinculados: adicionados.length,
          desvinculados: removidos.length,
        },
      });
    }

    revalidatePath(ROTA);
    return { success: true, data: { especialidadeId: espId, procedimentoIds: ids } };
  } catch (erro) {
    return responder(erro);
  }
}
