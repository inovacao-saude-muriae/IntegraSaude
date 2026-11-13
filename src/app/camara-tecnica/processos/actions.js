"use server";

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSOS JUDICIAIS — server actions (Câmara Técnica > Processos)
// ─────────────────────────────────────────────────────────────────────────
// Toda operação passa por `requirePermissao(MODULOS.PROCESSOS, "processo_judicial",
// <permissao>)`. As permissões são INDEPENDENTES no catálogo:
//
//   visualizar → consulta e detalhe
//   criar      → novo processo
//   editar     → alterar processo existente
//   excluir    → exclusão definitiva (excepcional, com confirmação e sem
//                dependências)
//
// A tabela central `Pessoa` não é alterada por este módulo: o processo aponta
// para o CPF já cadastrado (cadastro único/EMPI).
// ═══════════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermissao } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/audit";

const FUNCIONALIDADE = "processo_judicial";
const MODULO_AUDITORIA = "PROCESSOS";
const ROTA = "/camara-tecnica/processos";

// ── Helpers ────────────────────────────────────────────────────────────────

function falha(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

// O client recebe sempre { success, error } — nunca um throw que vire 500.
function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 500) console.error("[Processos] erro:", erro);
  return { success: false, error: erro?.message || "Erro ao processar a solicitação.", status };
}

function texto(valor, max) {
  const t = typeof valor === "string" ? valor.trim() : "";
  return t.length > max ? t.slice(0, max) : t;
}

function exigirTexto(valor, campo, max) {
  const t = texto(valor, max);
  if (!t) throw falha(`Informe ${campo}.`);
  return t;
}

function inteiroPositivo(valor) {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Carrega especialidade/procedimento do CATÁLOGO PRÓPRIO da área Processos e
// valida o vínculo entre eles. Nada de junta_especialidades/regula_procedimentos:
// esses são cadastros operacionais de outros módulos.
//
// Regras validadas aqui (o backend é a autoridade, a tela é só conveniência):
//   • a especialidade precisa existir e estar ATIVA em cadastro novo;
//   • o procedimento precisa existir, estar ATIVO e estar VINCULADO à
//     especialidade escolhida;
//   • em EDIÇÃO, o item já gravado no processo continua aceito mesmo que tenha
//     sido inativado depois (preserva o histórico), mas não pode ser trocado
//     por outro inativo.
async function resolverCatalogos(especialidadeId, procedimentoId, { edicao = false } = {}) {
  let especialidade = null;
  let procedimento = null;

  if (especialidadeId) {
    especialidade = await prisma.processoEspecialidade.findUnique({
      where: { id: especialidadeId },
      select: { id: true, nome: true, ativo: true },
    });
    if (!especialidade) throw falha("Especialidade não encontrada no catálogo de Processos.");
    if (!especialidade.ativo) {
      throw falha("Especialidade inativa. Selecione outra para novos cadastros.");
    }
  }

  if (procedimentoId) {
    procedimento = await prisma.processoProcedimento.findUnique({
      where: { id: procedimentoId },
      select: { id: true, nome: true, ativo: true },
    });
    if (!procedimento) throw falha("Procedimento não encontrado no catálogo de Processos.");
    if (!procedimento.ativo) {
      throw falha("Procedimento inativo. Selecione outro para novos cadastros.");
    }
    if (!especialidade) {
      throw falha("Selecione a especialidade antes do procedimento.");
    }
    const vinculo = await prisma.processoEspecialidadeProcedimento.findUnique({
      where: {
        especialidadeId_procedimentoId: {
          especialidadeId: especialidade.id,
          procedimentoId: procedimento.id,
        },
      },
      select: { id: true },
    });
    if (!vinculo) {
      throw falha(
        `O procedimento "${procedimento.nome}" não está vinculado à especialidade ` +
          `"${especialidade.nome}". Selecione um procedimento da lista da especialidade.`,
      );
    }
  }

  return { especialidade, procedimento };
}

async function exigirPessoa(cpfBruto) {
  const cpf = String(cpfBruto || "").replace(/\D/g, "");
  if (cpf.length !== 11) throw falha("Informe o CPF do paciente.");
  const pessoa = await prisma.pessoa.findUnique({
    where: { cpf },
    select: { cpf: true, nomeCompleto: true, ativo: true },
  });
  if (!pessoa) throw falha("Paciente não encontrado no cadastro único.");
  if (pessoa.ativo === false) {
    throw falha("Este cadastro foi unificado em outro. Selecione o cadastro atual.");
  }
  return pessoa;
}

async function exigirProcesso(id) {
  const processoId = inteiroPositivo(id);
  if (!processoId) throw falha("Processo inválido.");
  const processo = await prisma.processoJudicial.findUnique({
    where: { id: processoId },
    include: {
      pessoa: { select: { cpf: true, nomeCompleto: true } },
      especialidade: { select: { id: true, nome: true, ativo: true } },
      procedimento: { select: { id: true, nome: true, ativo: true } },
    },
  });
  if (!processo) throw falha("Processo não encontrado.", 404);
  return processo;
}

function serializar(p) {
  return {
    id: p.id,
    numeroProcesso: p.numeroProcesso,
    numeroPasta: p.numeroPasta,
    status: p.status,
    pacienteCpf: p.pessoaCpf,
    pacienteNome: p.pessoa?.nomeCompleto || "",
    especialidadeId: p.especialidadeId,
    especialidadeNome: p.especialidade?.nome || p.especialidadeNome || "",
    especialidadeInativa: Boolean(p.especialidadeId && p.especialidade && p.especialidade.ativo === false),
    procedimentoId: p.procedimentoId,
    procedimentoNome: p.procedimento?.nome || p.procedimentoNome || "",
    procedimentoInativo: Boolean(p.procedimentoId && p.procedimento && p.procedimento.ativo === false),
    criadoPor: p.criadoPor,
    atualizadoPor: p.atualizadoPor,
    dataCadastro: p.createdAt ? p.createdAt.toISOString() : null,
    atualizadoEm: p.updatedAt ? p.updatedAt.toISOString() : null,
  };
}

// ── 1. Lista / catálogos ───────────────────────────────────────────────────

export async function listarProcessos({ termo = "" } = {}) {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");

    const busca = texto(termo, 100);
    const where = busca
      ? {
          OR: [
            { numeroProcesso: { contains: busca, mode: "insensitive" } },
            { numeroPasta: { contains: busca, mode: "insensitive" } },
            { pessoa: { nomeCompleto: { contains: busca, mode: "insensitive" } } },
            { pessoaCpf: { contains: busca.replace(/\D/g, "") } },
          ],
        }
      : {};

    const processos = await prisma.processoJudicial.findMany({
      where,
      include: {
        pessoa: { select: { nomeCompleto: true } },
        especialidade: { select: { nome: true, ativo: true } },
        procedimento: { select: { nome: true, ativo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return { success: true, data: processos.map(serializar) };
  } catch (erro) {
    return responder(erro);
  }
}

export async function obterProcesso(id) {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");
    return { success: true, data: serializar(await exigirProcesso(id)) };
  } catch (erro) {
    return responder(erro);
  }
}

// ── 2. Criar ───────────────────────────────────────────────────────────────

export async function criarProcesso(dados) {
  try {
    const user = await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "criar");

    const pessoa = await exigirPessoa(dados?.pacienteCpf);
    const numeroProcesso = exigirTexto(dados?.numeroProcesso, "o número do processo", 100);
    const numeroPasta = exigirTexto(dados?.numeroPasta, "o número da pasta", 50);
    const { especialidade, procedimento } = await resolverCatalogos(
      inteiroPositivo(dados?.especialidadeId),
      inteiroPositivo(dados?.procedimentoId),
      { edicao: true },
    );

    const repetido = await prisma.processoJudicial.findUnique({
      where: { numeroProcesso },
      select: { id: true },
    });
    if (repetido) throw falha("Já existe um processo com este número.", 409);

    const criado = await prisma.processoJudicial.create({
      data: {
        pessoaCpf: pessoa.cpf,
        numeroProcesso,
        numeroPasta,
        especialidadeId: especialidade?.id ?? null,
        procedimentoId: procedimento?.id ?? null,
        especialidadeNome: especialidade?.nome ?? null,
        procedimentoNome: procedimento?.nome ?? null,
        criadoPor: user.cpf,
        atualizadoPor: user.cpf,
      },
      include: { pessoa: { select: { nomeCompleto: true } } },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoJudicial",
      entidadeId: String(criado.id),
      descricao: `Processo ${numeroProcesso} cadastrado para ${pessoa.nomeCompleto}`,
      detalhes: {
        numeroProcesso,
        numeroPasta,
        pacienteCpf: pessoa.cpf,
        especialidade: especialidade?.nome || null,
        procedimento: procedimento?.nome || null,
      },
    });

    revalidatePath(ROTA);
    return { success: true, data: serializar(criado) };
  } catch (erro) {
    return responder(erro);
  }
}

// ── 3. Editar ──────────────────────────────────────────────────────────────

export async function editarProcesso(id, dados) {
  try {
    const user = await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "editar");

    const atual = await exigirProcesso(id);
    const pessoa = await exigirPessoa(dados?.pacienteCpf);
    const numeroProcesso = exigirTexto(dados?.numeroProcesso, "o número do processo", 100);
    const numeroPasta = exigirTexto(dados?.numeroPasta, "o número da pasta", 50);
    const { especialidade, procedimento } = await resolverCatalogos(
      inteiroPositivo(dados?.especialidadeId),
      inteiroPositivo(dados?.procedimentoId),
    );

    if (numeroProcesso !== atual.numeroProcesso) {
      const repetido = await prisma.processoJudicial.findUnique({
        where: { numeroProcesso },
        select: { id: true },
      });
      if (repetido && repetido.id !== atual.id) {
        throw falha("Já existe outro processo com este número.", 409);
      }
    }

    // Troca de paciente: só com confirmação explícita — muda o titular.
    const trocouPaciente = pessoa.cpf !== atual.pessoaCpf;
    if (trocouPaciente && dados?.confirmarTrocaPaciente !== true) {
      throw falha(
        "A troca do paciente vinculado precisa ser confirmada explicitamente.",
        409,
      );
    }

    const alteracoes = {};
    const registrar = (campo, de, para) => {
      if ((de ?? null) !== (para ?? null)) alteracoes[campo] = { de, para };
    };
    registrar("numeroProcesso", atual.numeroProcesso, numeroProcesso);
    registrar("numeroPasta", atual.numeroPasta, numeroPasta);
    registrar("paciente", atual.pessoa?.nomeCompleto, pessoa.nomeCompleto);
    registrar(
      "especialidade",
      atual.especialidadeNome || atual.especialidade?.nome || null,
      especialidade?.nome ?? null,
    );
    registrar(
      "procedimento",
      atual.procedimentoNome || atual.procedimento?.nome || null,
      procedimento?.nome ?? null,
    );

    if (Object.keys(alteracoes).length === 0) {
      return { success: true, data: serializar(atual), semAlteracoes: true };
    }

    // Atualiza SOMENTE o processo selecionado, pelo id.
    const atualizado = await prisma.processoJudicial.update({
      where: { id: atual.id },
      data: {
        pessoaCpf: pessoa.cpf,
        numeroProcesso,
        numeroPasta,
        especialidadeId: especialidade?.id ?? null,
        procedimentoId: procedimento?.id ?? null,
        especialidadeNome: especialidade?.nome ?? null,
        procedimentoNome: procedimento?.nome ?? null,
        atualizadoPor: user.cpf,
      },
      include: { pessoa: { select: { nomeCompleto: true } } },
    });

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoJudicial",
      entidadeId: String(atual.id),
      descricao: `Processo ${numeroProcesso} alterado`,
      // `detalhes` aceita apenas primitivos: o diff vai achatado, campo a campo.
      detalhes: {
        numeroProcesso,
        pacienteCpf: pessoa.cpf,
        trocouPaciente,
        camposAlterados: Object.keys(alteracoes).join(", "),
        ...Object.fromEntries(
          Object.entries(alteracoes).map(([campo, { de, para }]) => [
            campo,
            `${de ?? "—"} → ${para ?? "—"}`,
          ]),
        ),
      },
    });

    revalidatePath(ROTA);
    return { success: true, data: serializar(atualizado), trocouPaciente };
  } catch (erro) {
    return responder(erro);
  }
}

// ── 4. Excluir ─────────────────────────────────────────────────────────────

// Dependências conhecidas do processo. Documentos e movimentações ainda não
// existem como tabela; quando existirem, entram nesta lista — e o bloqueio
// passa a valer automaticamente.
async function dependenciasDoProcesso(id) {
  return { documentos: 0, movimentacoes: 0, total: 0, _id: id };
}

export async function verificarDependenciasProcesso(id) {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");
    const processo = await exigirProcesso(id);
    const deps = await dependenciasDoProcesso(processo.id);
    return {
      success: true,
      data: {
        ...serializar(processo),
        dependencias: {
          documentos: deps.documentos,
          movimentacoes: deps.movimentacoes,
          total: deps.total,
        },
        podeExcluir: deps.total === 0,
      },
    };
  } catch (erro) {
    return responder(erro);
  }
}

export async function excluirProcesso(id, { confirmado = false } = {}) {
  try {
    const user = await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "excluir");
    const processo = await exigirProcesso(id);

    if (confirmado !== true) {
      throw falha("A exclusão precisa ser confirmada.", 409);
    }

    const deps = await dependenciasDoProcesso(processo.id);
    if (deps.total > 0) {
      // Nunca cascata: com vínculos, a operação para aqui.
      throw falha(
        `Este processo possui ${deps.total} registro(s) vinculado(s) ` +
          `(${deps.documentos} documento(s), ${deps.movimentacoes} movimentação(ões)) ` +
          "e não pode ser excluído. Arquite/encere esses registros primeiro.",
        409,
      );
    }

    await prisma.processoJudicial.delete({ where: { id: processo.id } });

    // Auditoria preserva o mínimo para rastreabilidade mesmo sem o registro.
    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoJudicial",
      entidadeId: String(processo.id),
      descricao: `Processo ${processo.numeroProcesso} excluído`,
      detalhes: {
        numeroProcesso: processo.numeroProcesso,
        numeroPasta: processo.numeroPasta,
        pacienteCpf: processo.pessoaCpf,
        pacienteNome: processo.pessoa?.nomeCompleto || null,
        especialidade: processo.especialidadeNome || processo.especialidade?.nome || null,
        procedimento: processo.procedimentoNome || processo.procedimento?.nome || null,
      },
    });

    revalidatePath(ROTA);
    return { success: true };
  } catch (erro) {
    return responder(erro);
  }
}
