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


// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO EM LINHAS (mesmo modelo de Exames e Procedimentos / Serviços e
// Especialidades): cada linha é um par Especialidade + Procedimento. Uma
// especialidade sem nenhum procedimento aparece como uma linha própria.
// A tela de Gerenciamento consome estas funções; o vínculo continua N:N.
// ═══════════════════════════════════════════════════════════════════════════

// Cria (ou reaproveita) uma especialidade pelo nome. Usado pelo cadastro
// direto no campo "+ Nova especialidade...".
async function garantirEspecialidade(user, nomeBruto) {
  const { nome, chave } = prepararNome(nomeBruto, "o nome da especialidade");
  const existente = await prisma.processoEspecialidade.findFirst({
    where: { OR: [{ nomeChave: chave }, { nome: { equals: nome, mode: "insensitive" } }] },
    select: { id: true, nome: true, ativo: true },
  });
  if (existente) {
    if (!existente.ativo) {
      throw falha(
        `Já existe a especialidade "${existente.nome}" (inativa). Reative-a em vez de duplicar.`,
        409,
      );
    }
    return existente;
  }
  const criada = await prisma.processoEspecialidade.create({
    data: { nome, nomeChave: chave },
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
  return criada;
}

// Cria (ou reaproveita) um procedimento pelo nome e garante o vínculo com a
// especialidade. Um procedimento existente NUNCA é duplicado: ele é apenas
// vinculado à especialidade escolhida.
async function garantirProcedimento(user, nomeBruto, especialidadeId) {
  const { nome, chave } = prepararNome(nomeBruto, "o nome do procedimento");
  let procedimento = await prisma.processoProcedimento.findFirst({
    where: { OR: [{ nomeChave: chave }, { nome: { equals: nome, mode: "insensitive" } }] },
    select: { id: true, nome: true, ativo: true },
  });
  let criado = false;
  if (!procedimento) {
    procedimento = await prisma.processoProcedimento.create({
      data: { nome, nomeChave: chave },
    });
    criado = true;
  } else if (!procedimento.ativo) {
    throw falha(
      `Já existe o procedimento "${procedimento.nome}" (inativo). Reative-o em vez de duplicar.`,
      409,
    );
  }
  if (criado) {
    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoProcedimento",
      entidadeId: String(procedimento.id),
      descricao: `Procedimento "${procedimento.nome}" cadastrado (catálogo de Processos)`,
      detalhes: { nome: procedimento.nome },
    });
  }
  if (especialidadeId) {
    await prisma.processoEspecialidadeProcedimento.createMany({
      data: [{ especialidadeId, procedimentoId: procedimento.id }],
      skipDuplicates: true,
    });
  }
  return procedimento;
}

/**
 * Lista para a tela de cadastro: as linhas (Especialidade + Procedimento), as
 * especialidades e os procedimentos para os campos de seleção.
 * Leitura exige apenas visualizar o catálogo de Processos.
 */
export async function getCatalogoProcessosData() {
  try {
    await requirePermissao(MODULOS.PROCESSOS, "catalogo_especialidades", "visualizar");

    const [especialidades, procedimentos, vinculos] = await Promise.all([
      prisma.processoEspecialidade.findMany({ orderBy: { nome: "asc" } }),
      prisma.processoProcedimento.findMany({ orderBy: { nome: "asc" } }),
      prisma.processoEspecialidadeProcedimento.findMany({
        select: { especialidadeId: true, procedimentoId: true },
      }),
    ]);

    const porEsp = new Map();
    for (const v of vinculos) {
      if (!porEsp.has(v.especialidadeId)) porEsp.set(v.especialidadeId, []);
      porEsp.get(v.especialidadeId).push(v.procedimentoId);
    }
    const procPorId = new Map(procedimentos.map((p) => [p.id, p]));
    const espPorId = new Map(especialidades.map((e) => [e.id, e]));

    const linhas = [];
    for (const e of especialidades) {
      const ids = (porEsp.get(e.id) || []).slice().sort((a, b) => {
        const pa = procPorId.get(a);
        const pb = procPorId.get(b);
        return (pa?.nome || "").localeCompare(pb?.nome || "", "pt-BR");
      });
      if (ids.length === 0) {
        linhas.push({
          id: `e-${e.id}`,
          tipo: "ESPECIALIDADE",
          especialidadeId: e.id,
          especialidadeNome: e.nome,
          especialidadeAtivo: e.ativo !== false,
          procedimentoId: null,
          procedimentoNome: "",
          procedimentoAtivo: null,
        });
        continue;
      }
      for (const procId of ids) {
        const p = procPorId.get(procId);
        if (!p) continue;
        linhas.push({
          id: `${e.id}-${p.id}`,
          tipo: "VINCULO",
          especialidadeId: e.id,
          especialidadeNome: e.nome,
          especialidadeAtivo: e.ativo !== false,
          procedimentoId: p.id,
          procedimentoNome: p.nome,
          procedimentoAtivo: p.ativo !== false,
        });
      }
    }
    // Especialidade inativa sem vínculo já está acima; procedimentos sem
    // nenhuma especialidade não aparecem na tabela (não há par a exibir).

    return {
      success: true,
      especialidades: especialidades.map((e) => ({
        id: e.id,
        nome: e.nome,
        ativo: e.ativo !== false,
      })),
      procedimentos: procedimentos.map((p) => {
        const espIds = [...porEsp.entries()]
          .filter(([, ids]) => ids.includes(p.id))
          .map(([espId]) => espId);
        return {
          id: p.id,
          nome: p.nome,
          ativo: p.ativo !== false,
          especialidadeIds: espIds,
          especialidadeNomes: espIds.map((id) => espPorId.get(id)?.nome).filter(Boolean),
        };
      }),
      linhas,
    };
  } catch (erro) {
    return { ...responder(erro), especialidades: [], procedimentos: [], linhas: [] };
  }
}

/**
 * Gravação única da tela: cria ou atualiza o par Especialidade + Procedimento.
 * - especialidadeId presente  → usa a existente;
 * - especialidadeNome presente → cria/reaproveita pelo nome ("+ Nova especialidade");
 * - procedimentoNome vazio     → a linha é só a especialidade (sem vínculo);
 * - procedimentoId presente    → usa o existente (e garante o vínculo);
 * - procedimentoNome novo      → cria/reaproveita e vincula.
 * Nada é duplicado: nomes repetidos reaproveitam o registro existente.
 */
export async function salvarRegistroCatalogo(payload = {}) {
  try {
    const user = await requirePermissao(
      MODULOS.PROCESSOS,
      "catalogo_especialidades",
      "criar",
    );

    const edicao = payload.linha || null;
    const especialidadeNome = (payload.especialidadeNome || "").trim();
    const idEmEdicao = edicao
      ? inteiroPositivo(edicao.especialidadeId ?? edicao.especialidade_id)
      : null;
    const procedimentoNome = (payload.procedimentoNome || "").trim();
    const especialidadeIdInformada = inteiroPositivo(payload.especialidadeId);
    const procedimentoIdInformado = inteiroPositivo(payload.procedimentoId);

    if (!especialidadeIdInformada && !especialidadeNome && !idEmEdicao) {
      throw falha("Selecione ou informe a especialidade.");
    }

    // 1) Especialidade alvo
    // Na edição, quem manda é o registro que está sendo editado: um nome novo
    // renomeia a especialidade dele; um nome igual ao de outra especialidade é
    // recusado (nunca cria nem aponta para a outra).
    let especialidade = null;
    if (edicao) {
      if (idEmEdicao) {
        especialidade = await prisma.processoEspecialidade.findUnique({
          where: { id: idEmEdicao },
        });
        if (!especialidade) throw falha("Especialidade não encontrada no catálogo.", 404);
        const nomeNovo = especialidadeNome || especialidade.nome;
        const { nome, chave } = prepararNome(nomeNovo, "o nome da especialidade");
        const conflito = await prisma.processoEspecialidade.findFirst({
          where: {
            id: { not: idEmEdicao },
            OR: [{ nomeChave: chave }, { nome: { equals: nome, mode: "insensitive" } }],
          },
          select: { nome: true },
        });
        if (conflito) throw falha(`Já existe a especialidade "${conflito.nome}".`, 409);
        if (especialidade.nome !== nome || especialidade.nomeChave !== chave) {
          especialidade = await prisma.processoEspecialidade.update({
            where: { id: idEmEdicao },
            data: { nome, nomeChave: chave },
          });
          await registrarAuditoria({
            user,
            acao: "EDITAR",
            modulo: MODULO_AUDITORIA,
            entidade: "ProcessoEspecialidade",
            entidadeId: String(idEmEdicao),
            descricao: `Especialidade renomeada para "${nome}" (catálogo de Processos)`,
            detalhes: { nome },
          });
        }
      }
    }

    if (especialidade) {
      // já resolvido acima (edição)
    } else if (especialidadeIdInformada) {
      especialidade = await prisma.processoEspecialidade.findUnique({
        where: { id: especialidadeIdInformada },
      });
      if (!especialidade) throw falha("Especialidade não encontrada no catálogo.", 404);
      if (!especialidade.ativo) throw falha("A especialidade está inativa.", 409);
    } else {
      especialidade = await garantirEspecialidade(user, especialidadeNome);
    }

    // 2) Procedimento (opcional)
    let procedimento = null;
    if (!procedimentoIdInformado && !procedimentoNome && payload.procedimentoNovo) {
      throw falha("Informe o nome do novo procedimento.");
    }
    if (procedimentoIdInformado) {
      procedimento = await prisma.processoProcedimento.findUnique({
        where: { id: procedimentoIdInformado },
      });
      if (!procedimento) throw falha("Procedimento não encontrado no catálogo.", 404);
      if (!procedimento.ativo) throw falha("O procedimento está inativo.", 409);
    } else if (procedimentoNome) {
      // Reaproveita o procedimento existente; se não houver, cria agora.
      // `garantirProcedimento` já faz as duas coisas (e audita a criação).
      const { nome: nomeProc, chave: chaveProc } = prepararNome(
        procedimentoNome,
        "o nome do procedimento",
      );
      const existente = await prisma.processoProcedimento.findFirst({
        where: {
          OR: [{ nomeChave: chaveProc }, { nome: { equals: nomeProc, mode: "insensitive" } }],
        },
      });
      if (existente) {
        if (!existente.ativo) {
          throw falha(
            `Já existe o procedimento "${existente.nome}" (inativo). Reative-o em vez de duplicar.`,
            409,
          );
        }
        procedimento = existente;
      } else {
        procedimento = await prisma.processoProcedimento.create({
          data: { nome: nomeProc, nomeChave: chaveProc },
        });
        await registrarAuditoria({
          user,
          acao: "CRIAR",
          modulo: MODULO_AUDITORIA,
          entidade: "ProcessoProcedimento",
          entidadeId: String(procedimento.id),
          descricao: `Procedimento "${procedimento.nome}" cadastrado (catálogo de Processos)`,
          detalhes: { nome: procedimento.nome },
        });
      }
    }

    // 3) Vínculo N:N (idempotente — nunca duplica)
    if (procedimento) {
      const jaVinculado = await prisma.processoEspecialidadeProcedimento.findFirst({
        where: {
          especialidadeId: especialidade.id,
          procedimentoId: procedimento.id,
        },
      });
      if (jaVinculado && !edicao) {
        throw falha(
          `O procedimento "${procedimento.nome}" já está vinculado à especialidade "${especialidade.nome}".`,
          409,
        );
      }
      if (!jaVinculado) {
        await prisma.processoEspecialidadeProcedimento.create({
          data: { especialidadeId: especialidade.id, procedimentoId: procedimento.id },
        });
        await registrarAuditoria({
          user,
          acao: "CRIAR",
          modulo: MODULO_AUDITORIA,
          entidade: "ProcessoEspecialidadeProcedimento",
          entidadeId: String(especialidade.id),
          descricao: `Vínculo criado: "${especialidade.nome}" — "${procedimento.nome}"`,
          detalhes: {
            especialidade: especialidade.nome,
            procedimento: procedimento.nome,
          },
        });
      }
    }

    revalidatePath(ROTA);
    return {
      success: true,
      data: {
        especialidadeId: especialidade.id,
        especialidadeNome: especialidade.nome,
        procedimentoId: procedimento?.id ?? null,
        procedimentoNome: procedimento?.nome ?? "",
      },
    };
  } catch (erro) {
    return responder(erro);
  }
}

// ── Inativar / Reativar ────────────────────────────────────────────────────

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
      acao: ativo ? "REATIVAR" : "DESATIVAR",
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
      acao: ativo ? "REATIVAR" : "DESATIVAR",
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
