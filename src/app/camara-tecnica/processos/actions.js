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
import { mensagemPessoaIndisponivel } from "@/lib/situacaoPessoa";
import { requirePermissao } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/audit";

const FUNCIONALIDADE = "processo_judicial";
const MODULO_AUDITORIA = "PROCESSOS";
const ROTA = "/camara-tecnica/processos";
const ROTA_BLOQUEIO = "/camara-tecnica/processos/bloqueio";
// Consulta: 100 registros por página (mesmo padrão da Farmácia Judicial).
const CONSULTA_PAGINA_TAMANHO = 100;

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

// Situação do PROCESSO: operacional, independente da Situação Cadastral da
// pessoa. Somente ATIVO/INATIVO; valores legados são lidos sem conversão.
const JUSTIFICATIVA_MIN = 15;
const JUSTIFICATIVA_MAX = 500;

const STATUS_PROCESSO = {
  ATIVO: "ATIVO",
  INATIVO: "INATIVO",
};

const STATUS_PROCESSO_ROTULO = { ATIVO: "Ativo", INATIVO: "Inativo" };

// Justificativa obrigatória na TRANSIÇÃO para Inativo (e na edição de um
// processo que já está inativo sem texto registrado).
function exigirJustificativaInativacao(valor) {
  if (typeof valor === "string" && valor.trim().length > JUSTIFICATIVA_MAX) {
    throw falha(
      `A Justificativa da Inativação deve ter no máximo ${JUSTIFICATIVA_MAX} caracteres.`,
    );
  }
  const t = texto(valor, JUSTIFICATIVA_MAX);
  if (t.length < JUSTIFICATIVA_MIN) {
    throw falha(
      "Informe a Justificativa da Inativação (mínimo de 15 caracteres).",
    );
  }
  return t;
}

function normalizarStatusProcesso(valor) {
  return String(valor || "").trim().toUpperCase() === STATUS_PROCESSO.INATIVO
    ? STATUS_PROCESSO.INATIVO
    : STATUS_PROCESSO.ATIVO;
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

async function exigirPessoa(cpfBruto, { permitirIndisponivel = false } = {}) {
  const cpf = String(cpfBruto || "").replace(/\D/g, "");
  if (cpf.length !== 11) throw falha("Informe o CPF do paciente.");
  const pessoa = await prisma.pessoa.findUnique({
    where: { cpf },
    select: {
      cpf: true,
      nomeCompleto: true,
      situacao: true,
      unificadoEmCpf: true,
      numeroPasta: true,
    },
  });
  if (!pessoa) throw falha("Paciente não encontrado no cadastro único.");
  if (pessoa.unificadoEmCpf) {
    throw falha("Este cadastro foi unificado em outro. Selecione o cadastro atual.");
  }
  // Situação cadastral (fonte única): a regra é a MESMA função usada por todos
  // os módulos, aplicada aqui no momento de salvar. No bloqueio o ato é
  // administrativo sobre um processo existente: `permitirIndisponivel` mantém
  // apenas o histórico consultável (o cadastro unificado continua impedido).
  if (!permitirIndisponivel) {
    const erro = mensagemPessoaIndisponivel(pessoa.situacao);
    if (erro) throw falha(erro);
  }
  return pessoa;
}

// ── Número de pasta: o dado é do PACIENTE ────────────────────────────────
// A pasta pertence à pessoa (cadastro único), não ao processo: vários
// processos do mesmo paciente compartilham a mesma pasta. A coluna vive em
// `pessoa.numero_pasta` (única) e `processos_judiciais.numero_pasta` guarda o
// espelho do momento do cadastro.
async function resolverNumeroPasta(numeroPastaInformado, pessoa) {
  const informado = texto(numeroPastaInformado, 50);

  if (pessoa.numeroPasta) {
    // Já tem pasta: o campo vem bloqueado na tela. Se o cliente mandar outro
    // número, é conflito — a pasta do paciente só muda por decisão própria.
    if (informado && informado !== pessoa.numeroPasta) {
      throw falha(
        `O paciente já possui a pasta ${pessoa.numeroPasta}. O número da pasta ` +
          "pertence ao paciente e não pode ser alterado pelo processo.",
        409,
      );
    }
    return pessoa.numeroPasta;
  }

  if (!informado) throw falha("Informe o número da pasta.");

  const ocupada = await prisma.pessoa.findFirst({
    where: { numeroPasta: informado, NOT: { cpf: pessoa.cpf } },
    select: { cpf: true },
  });
  if (ocupada) {
    throw falha(
      `A pasta ${informado} já está vinculada a outro paciente. ` +
        "Cada número de pasta pertence a um único paciente.",
      409,
    );
  }

  // Grava a pasta no PACIENTE (fonte única), não no processo.
  await prisma.pessoa.update({
    where: { cpf: pessoa.cpf },
    data: { numeroPasta: informado },
  });
  return informado;
}

async function exigirProcesso(id) {
  const processoId = inteiroPositivo(id);
  if (!processoId) throw falha("Processo inválido.");
  const processo = await prisma.processoJudicial.findUnique({
    where: { id: processoId },
    include: {
      pessoa: { select: { cpf: true, nomeCompleto: true, numeroPasta: true } },
      especialidade: { select: { id: true, nome: true, ativo: true } },
      procedimento: { select: { id: true, nome: true, ativo: true } },
      _count: { select: { bloqueios: true } },
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
    statusRotulo: STATUS_PROCESSO_ROTULO[p.status] || p.status || "—",
    justificativaInativacao: p.justificativaInativacao || "",
    pacienteCpf: p.pessoaCpf,
    pacienteNome: p.pessoa?.nomeCompleto || "",
    telefone: p.pessoa?.telefone || "",
    // Situação cadastral da pessoa central (fonte única): só exibição.
    pacienteSituacao: p.pessoa?.situacao || "",
    // A pasta vigente é a do PACIENTE; o espelho do processo fica como
    // fallback para processos antigos gravados antes desta regra.
    numeroPastaPaciente: p.pessoa?.numeroPasta || p.numeroPasta || "",
    totalBloqueios: p._count?.bloqueios ?? 0,
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

// Filtros da CONSULTA (backend). Cada campo é opcional e todos se combinam
// com AND; `todos` só é usado pelo botão "Consultar todos".
export async function listarProcessos({
  todos = false,
  busca = "",
  dataInicio = "",
  dataFim = "",
  especialidadeId = null,
  procedimentoId = null,
  status = "todos",
  pagina = 1,
} = {}) {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");

    // Campo único "Buscar Registro": o conteúdo é procurado no nome, no CPF
    // (com ou sem máscara), no número do processo e no número da pasta.
    const termo = texto(busca, 100);
    const digitos = termo.replace(/\D/g, "");
    const espId = inteiroPositivo(especialidadeId);
    const procId = inteiroPositivo(procedimentoId);

    const and = [];
    if (termo) {
      and.push({
        OR: [
          { pessoa: { nomeCompleto: { contains: termo, mode: "insensitive" } } },
          ...(digitos.length >= 3 ? [{ pessoaCpf: { contains: digitos } }] : []),
          { numeroProcesso: { contains: termo, mode: "insensitive" } },
          { numeroPasta: { contains: termo, mode: "insensitive" } },
          { pessoa: { numeroPasta: { contains: termo, mode: "insensitive" } } },
        ],
      });
    }
    // Situação do PROCESSO (Todos | Ativos | Inativos): derivada do status.
    // "Ativos" inclui apenas ATIVO; "Inativos" apenas INATIVO.
    const statusFiltro = String(status || "todos").toLowerCase();
    if (statusFiltro === "ativos") {
      and.push({ OR: [{ status: STATUS_PROCESSO.ATIVO }, { status: null }] });
    } else if (statusFiltro === "inativos") {
      and.push({ status: STATUS_PROCESSO.INATIVO });
    }

    if (espId) and.push({ especialidadeId: espId });
    // Procedimento é independente da especialidade nos filtros de consulta.
    if (procId) and.push({ procedimentoId: procId });

    // Período de cadastro (data/hora do servidor, gravada em created_at).
    // O dia é o local (America/Sao_Paulo, UTC-3), não o UTC.
    const de = diaLocalParaUtc(dataInicio, "inicio");
    const ate = diaLocalParaUtc(dataFim, "fim");
    if (de || ate) {
      and.push({
        createdAt: {
          ...(de ? { gte: de } : {}),
          ...(ate ? { lte: ate } : {}),
        },
      });
    }

    // Sem nenhum filtro a consulta devolve TODOS os processos (o estado
    // inicial da tela é controlado no cliente; nada é carregado na abertura).

    const where = and.length ? { AND: and } : {};

    // Paginação e filtragem no BACKEND (100 registros por página).
    const pag = Math.max(1, inteiroPositivo(pagina) || 1);
    const [totalRegistros, processos] = await Promise.all([
      prisma.processoJudicial.count({ where }),
      prisma.processoJudicial.findMany({
        where,
        include: {
          pessoa: {
            select: {
              nomeCompleto: true,
              numeroPasta: true,
              situacao: true,
              telefone: true,
            },
          },
          especialidade: { select: { nome: true, ativo: true } },
          procedimento: { select: { nome: true, ativo: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (pag - 1) * CONSULTA_PAGINA_TAMANHO,
        take: CONSULTA_PAGINA_TAMANHO,
      }),
    ]);

    const data = processos.map(serializar);
    return {
      success: true,
      data,
      total: totalRegistros,
      pagina: pag,
      totalPaginas: Math.max(1, Math.ceil(totalRegistros / CONSULTA_PAGINA_TAMANHO)),
      porPagina: CONSULTA_PAGINA_TAMANHO,
      semConsulta: false,
    };
  } catch (erro) {
    return responder(erro);
  }
}

// Busca suspensa "Buscar Registro": um PROCESSO por linha, com o nome do
// paciente, o número da pasta e o número do processo (mesmo componente da
// Farmácia Judicial). Nunca carrega tudo: exige ao menos 1 caractere.
export async function buscarProcessosJudiciais(termo = "") {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");
    const t = texto(termo, 100);
    if (t.length < 1) return [];

    const digitos = t.replace(/\D/g, "");
    const processos = await prisma.processoJudicial.findMany({
      where: {
        OR: [
          { pessoa: { nomeCompleto: { contains: t, mode: "insensitive" } } },
          ...(digitos.length >= 3 ? [{ pessoaCpf: { contains: digitos } }] : []),
          { numeroProcesso: { contains: t, mode: "insensitive" } },
          { numeroPasta: { contains: t, mode: "insensitive" } },
          { pessoa: { numeroPasta: { contains: t, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        numeroProcesso: true,
        numeroPasta: true,
        pessoaCpf: true,
        pessoa: { select: { nomeCompleto: true, numeroPasta: true } },
      },
      orderBy: [{ pessoa: { nomeCompleto: "asc" } }, { createdAt: "desc" }],
      take: 30,
    });

    return processos.map((p) => ({
      id: p.id,
      numeroProcesso: p.numeroProcesso,
      // A pasta vigente é a do PACIENTE (espelho do processo como fallback).
      numeroPasta: p.pessoa?.numeroPasta || p.numeroPasta || "",
      patientName: p.pessoa?.nomeCompleto || "",
      cpf: p.pessoaCpf,
    }));
  } catch (erro) {
    console.error("[Processos] erro na busca suspensa:", erro);
    return [];
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

    // Situação cadastral (fonte única) antes de qualquer outro campo: pessoa
    // falecida recebe a mensagem única de bloqueio de novos vínculos.
    const pessoa = await exigirPessoa(dados?.pacienteCpf ?? dados?.cpf ?? dados?.pessoaCpf);
    const numeroProcesso = exigirTexto(dados?.numeroProcesso, "o número do processo", 100);
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

    // A pasta é do PACIENTE: reaproveitada se já existir, cadastrada se não.
    const numeroPasta = await resolverNumeroPasta(dados?.numeroPasta, pessoa);

    // Todo processo NOVO nasce ATIVO (ignora Inativo recebido). A inativação
    // só existe pela edição, em Consultar Processos, e exige justificativa.
    const status = STATUS_PROCESSO.ATIVO;
    const justificativaDb = null;

    const criado = await prisma.processoJudicial.create({
      data: {
        pessoaCpf: pessoa.cpf,
        numeroProcesso,
        numeroPasta,
        especialidadeId: especialidade?.id ?? null,
        procedimentoId: procedimento?.id ?? null,
        especialidadeNome: especialidade?.nome ?? null,
        procedimentoNome: procedimento?.nome ?? null,
        status,
        justificativaInativacao: justificativaDb,
        criadoPor: user.cpf,
        atualizadoPor: user.cpf,
      },
      include: { pessoa: { select: { nomeCompleto: true, numeroPasta: true, situacao: true } } },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoJudicial",
      entidadeId: String(criado.id),
      descricao:
        `Processo ${numeroProcesso} cadastrado para ${pessoa.nomeCompleto}` +
        (status === STATUS_PROCESSO.INATIVO
          ? " — situação Inativo com justificativa registrada"
          : ""),
      detalhes: {
        numeroProcesso,
        numeroPasta,
        pacienteCpf: pessoa.cpf,
        especialidade: especialidade?.nome || null,
        procedimento: procedimento?.nome || null,
        situacaoProcesso: STATUS_PROCESSO_ROTULO[status],
        motivoRegistrado: Boolean(justificativaDb),
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
    const numeroPasta = await resolverNumeroPasta(dados?.numeroPasta, pessoa);
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

    // Situação do PROCESSO: independente da Situação Cadastral da pessoa.
    const statusAtual = normalizarStatusProcesso(atual.status);
    const status = normalizarStatusProcesso(dados?.status);
    const justificativaBruta = dados?.justificativaInativacao;
    // Reativar PRESERVA a justificativa anterior (histórico). Só uma
    // inativação nova grava texto novo.
    const inativandoAgora = status === STATUS_PROCESSO.INATIVO && statusAtual !== STATUS_PROCESSO.INATIVO;
    const jaInativoSemJustificativa =
      status === STATUS_PROCESSO.INATIVO && !atual.justificativaInativacao;
    let justificativaDb = atual.justificativaInativacao || null;
    if (inativandoAgora || jaInativoSemJustificativa) {
      justificativaDb = exigirJustificativaInativacao(justificativaBruta);
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
    registrar("status", statusAtual, status);

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
        status,
        justificativaInativacao: justificativaDb,
        atualizadoPor: user.cpf,
      },
      include: { pessoa: { select: { nomeCompleto: true, numeroPasta: true, situacao: true } } },
    });

    // Transição de situação tem ação própria na auditoria; o restante é edição.
    const acaoAuditoria =
      statusAtual !== status
        ? status === STATUS_PROCESSO.INATIVO
          ? "DESATIVAR"
          : "REATIVAR"
        : "EDITAR";

    await registrarAuditoria({
      user,
      acao: acaoAuditoria,
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoJudicial",
      entidadeId: String(atual.id),
      descricao:
        statusAtual !== status
          ? `Situação do processo ${numeroProcesso}: ${STATUS_PROCESSO_ROTULO[statusAtual]} → ${STATUS_PROCESSO_ROTULO[status]}` +
            (status === STATUS_PROCESSO.INATIVO
              ? " — justificativa da inativação registrada"
              : "")
          : `Processo ${numeroProcesso} alterado`,
      // `detalhes` aceita apenas primitivos: o diff vai achatado, campo a campo.
      detalhes: {
        numeroProcesso,
        pacienteCpf: pessoa.cpf,
        trocouPaciente,
        camposAlterados: Object.keys(alteracoes).join(", "),
        situacaoProcesso: STATUS_PROCESSO_ROTULO[status],
        motivoRegistrado: Boolean(justificativaDb),
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
  const bloqueios = await prisma.processoBloqueio.count({ where: { processoId: id } });
  return { documentos: 0, movimentacoes: 0, bloqueios, total: bloqueios };
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
          bloqueios: deps.bloqueios,
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
          `(${deps.documentos} documento(s), ${deps.movimentacoes} movimentação(ões), ` +
          `${deps.bloqueios} bloqueio(s)) ` +
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

// ═══════════════════════════════════════════════════════════════════════════
// 5. BLOQUEIOS JUDICIAIS (Processos Cirúrgicos › Realizar Bloqueio)
// ─────────────────────────────────────────────────────────────────────────
// O bloqueio pertence ao PROCESSO (processos_bloqueios.processo_id), nunca só
// ao paciente: um paciente com vários processos tem bloqueios independentes.
// Permissões: ver = `processo_judicial:visualizar`; registrar = `:criar`.
// Valor em Decimal(14,2) — exato para operação financeira.
// ═══════════════════════════════════════════════════════════════════════════

function serializarBloqueio(b) {
  return {
    id: b.id,
    processoId: b.processoId,
    dataBloqueio: b.dataBloqueio ? b.dataBloqueio.toISOString().slice(0, 10) : null,
    // String para não perder centavos na serialização do RSC.
    valor: b.valor ? String(b.valor) : "0.00",
    observacao: b.observacao || "",
    criadoPor: b.criadoPor || null,
    criadoEm: b.createdAt ? b.createdAt.toISOString() : null,
    processo: b.processo
      ? {
          id: b.processo.id,
          numeroProcesso: b.processo.numeroProcesso,
          numeroPasta: b.processo.pessoa?.numeroPasta || b.processo.numeroPasta,
          pacienteCpf: b.processo.pessoaCpf,
          pacienteNome: b.processo.pessoa?.nomeCompleto || "",
          especialidadeNome:
            b.processo.especialidade?.nome || b.processo.especialidadeNome || "",
          procedimentoNome:
            b.processo.procedimento?.nome || b.processo.procedimentoNome || "",
          // Dados completos do paciente/processo para a visualização.
          pacienteCns: b.processo.pessoa?.cns || "",
          pacienteSexo: b.processo.pessoa?.sexo || "",
          pacienteNomeMae: b.processo.pessoa?.nomeMae || "",
          pacienteTelefone: b.processo.pessoa?.telefone || "",
          pacienteNascimento: b.processo.pessoa?.dataNascimento
            ? b.processo.pessoa.dataNascimento.toISOString().slice(0, 10)
            : null,
          status: b.processo.status || null,
          dataCadastro: b.processo.createdAt
            ? b.processo.createdAt.toISOString()
            : null,
        }
      : null,
  };
}

// Busca processos por paciente (nome/CPF) ou número do processo — alimenta a
// seleção do bloqueio. Devolve os processos do paciente para que a tela possa
// carregar automaticamente quando houver apenas um.
export async function buscarProcessosParaBloqueio(termo = "") {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");

    const busca = texto(termo, 100);
    const digitos = busca.replace(/\D/g, "");
    const where = busca
      ? {
          OR: [
            { numeroProcesso: { contains: busca, mode: "insensitive" } },
            { numeroPasta: { contains: busca, mode: "insensitive" } },
            { pessoa: { nomeCompleto: { contains: busca, mode: "insensitive" } } },
            ...(digitos ? [{ pessoaCpf: { contains: digitos } }] : []),
          ],
        }
      : {};

    const processos = await prisma.processoJudicial.findMany({
      where,
      include: {
        pessoa: { select: { cpf: true, nomeCompleto: true, numeroPasta: true } },
        especialidade: { select: { nome: true, ativo: true } },
        procedimento: { select: { nome: true, ativo: true } },
        _count: { select: { bloqueios: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return { success: true, data: processos.map(serializar) };
  } catch (erro) {
    return responder(erro);
  }
}

export async function listarBloqueios({
  todos = false,
  processoId = null,
  busca = "",
  termo = "",
  especialidadeId = null,
  procedimentoId = null,
  dataInicio = "",
  dataFim = "",
  pagina = 1,
} = {}) {
  try {
    await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "visualizar");

    const filtro = inteiroPositivo(processoId);
    // Campo único "Buscar Registro" (o mesmo vale para `termo`, mantido para
    // a busca interna dentro do formulário de bloqueio).
    const procura = texto(busca, 100) || texto(termo, 100);
    const digitos = procura.replace(/\D/g, "");
    const espId = inteiroPositivo(especialidadeId);
    const procId = inteiroPositivo(procedimentoId);

    const and = [];
    if (procura) {
      and.push({
        processo: {
          OR: [
            { pessoa: { nomeCompleto: { contains: procura, mode: "insensitive" } } },
            ...(digitos.length >= 3 ? [{ pessoaCpf: { contains: digitos } }] : []),
            { numeroProcesso: { contains: procura, mode: "insensitive" } },
            { numeroPasta: { contains: procura, mode: "insensitive" } },
            { pessoa: { numeroPasta: { contains: procura, mode: "insensitive" } } },
          ],
        },
      });
    }
    if (espId) and.push({ processo: { especialidadeId: espId } });
    // Procedimento é independente da especialidade nos filtros de consulta.
    if (procId) and.push({ processo: { procedimentoId: procId } });

    // Período sobre a data do bloqueio (Data CI).
    const inicio = dataDoFormularioOpcional(dataInicio);
    const fim = dataDoFormularioOpcional(dataFim);
    if (inicio || fim) {
      and.push({
        dataBloqueio: {
          ...(inicio ? { gte: inicio } : {}),
          ...(fim ? { lte: fim } : {}),
        },
      });
    }

    // Sem nenhum filtro a consulta devolve TODOS os bloqueios (o estado
    // inicial da tela é controlado no cliente).
    const where = {
      ...(filtro ? { processoId: filtro } : {}),
      ...(and.length ? { AND: and } : {}),
    };

    // Paginação no backend (100 por página) + total e somatório dos filtrados.
    const total = await prisma.processoBloqueio.count({ where });
    const totalPaginas = Math.max(1, Math.ceil(total / CONSULTA_PAGINA_TAMANHO));
    const paginaAtual = Math.min(Math.max(1, inteiroPositivo(pagina) || 1), totalPaginas);

    const bloqueios = await prisma.processoBloqueio.findMany({
      where,
      include: {
        processo: {
          select: {
            id: true,
            numeroProcesso: true,
            numeroPasta: true,
            pessoaCpf: true,
            especialidadeNome: true,
            procedimentoNome: true,
            status: true,
            createdAt: true,
            pessoa: {
              select: {
                nomeCompleto: true,
                numeroPasta: true,
                cns: true,
                sexo: true,
                nomeMae: true,
                telefone: true,
                dataNascimento: true,
              },
            },
            especialidade: { select: { nome: true } },
            procedimento: { select: { nome: true } },
          },
        },
      },
      orderBy: [{ dataBloqueio: "desc" }, { id: "desc" }],
      skip: (paginaAtual - 1) * CONSULTA_PAGINA_TAMANHO,
      take: CONSULTA_PAGINA_TAMANHO,
    });

    const data = bloqueios.map(serializarBloqueio);
    // Valor total de TODOS os bloqueios filtrados (não só da página), em
    // decimal exato: o somatório é feito no banco.
    const soma = await prisma.processoBloqueio.aggregate({
      where,
      _sum: { valor: true },
    });
    const valorTotal = Number(soma._sum?.valor || 0).toFixed(2);

    return {
      success: true,
      data,
      total,
      pagina: paginaAtual,
      totalPaginas,
      porPagina: CONSULTA_PAGINA_TAMANHO,
      valorTotal,
      semConsulta: false,
    };
  } catch (erro) {
    return responder(erro);
  }
}

export async function criarBloqueio(dados) {
  try {
    const user = await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "criar");

    const processo = await exigirProcesso(dados?.processoId);
    // A pessoa pode ter sido inativada depois do processo: o bloqueio é ato
    // administrativo sobre o processo existente e continua permitido.
    await exigirPessoa(processo.pessoaCpf, { permitirIndisponivel: true });

    const dataBloqueio = dataDoFormulario(dados?.dataBloqueio);
    const valor = valorMonetario(dados?.valor);
    const observacao = texto(dados?.observacao, 255) || null;

    const criado = await prisma.processoBloqueio.create({
      data: {
        processoId: processo.id,
        dataBloqueio,
        valor,
        observacao,
        criadoPor: user.cpf,
      },
      include: {
        processo: {
          select: {
            id: true,
            numeroProcesso: true,
            numeroPasta: true,
            pessoaCpf: true,
            especialidadeNome: true,
            procedimentoNome: true,
            pessoa: { select: { nomeCompleto: true, numeroPasta: true } },
            especialidade: { select: { nome: true } },
            procedimento: { select: { nome: true } },
          },
        },
      },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoBloqueio",
      entidadeId: String(criado.id),
      descricao: `Bloqueio de R$ ${valor} registrado no processo ${processo.numeroProcesso}`,
      detalhes: {
        processoId: processo.id,
        numeroProcesso: processo.numeroProcesso,
        numeroPasta: criado.processo.pessoa?.numeroPasta || processo.numeroPasta,
        pacienteCpf: processo.pessoaCpf,
        pacienteNome: processo.pessoa?.nomeCompleto || null,
        dataBloqueio: criado.dataBloqueio.toISOString().slice(0, 10),
        valor,
        observacao,
      },
    });

    revalidatePath(ROTA_BLOQUEIO);
    revalidatePath(ROTA);
    return { success: true, data: serializarBloqueio(criado) };
  } catch (erro) {
    return responder(erro);
  }
}

// ── Edição e exclusão do bloqueio ─────────────────────────────────────────
// O bloqueio pertence ao PROCESSO: aqui só data, valor e observação mudam.
const INCLUDE_BLOQUEIO = {
  processo: {
    select: {
      id: true,
      numeroProcesso: true,
      numeroPasta: true,
      pessoaCpf: true,
      especialidadeNome: true,
      procedimentoNome: true,
      pessoa: { select: { nomeCompleto: true, numeroPasta: true } },
      especialidade: { select: { nome: true } },
      procedimento: { select: { nome: true } },
    },
  },
};

// Valida e converte o valor monetário (aceita "1.234,56" ou número).
function valorMonetario(bruto) {
  if (bruto === null || bruto === undefined || bruto === "") {
    throw falha("Informe o valor do bloqueio.");
  }
  const normalizado =
    typeof bruto === "number"
      ? bruto
      : Number(
          String(bruto)
            .replace(/\s/g, "")
            .replace(/^R\$/i, "")
            .replace(/\./g, "")
            .replace(",", "."),
        );
  if (!Number.isFinite(normalizado) || normalizado <= 0) {
    throw falha("O valor do bloqueio deve ser maior que zero.");
  }
  if (normalizado > 99999999999.99) throw falha("Valor do bloqueio acima do limite permitido.");
  // Duas casas: o banco é NUMERIC(14,2).
  const centavos = Math.round(normalizado * 100) / 100;
  if (centavos <= 0) throw falha("O valor do bloqueio deve ser maior que zero.");
  return centavos.toFixed(2);
}

function dataDoFormulario(bruto) {
  const valor = String(bruto || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  const ano = iso ? iso[1] : br ? br[3] : null;
  const mes = iso ? iso[2] : br ? br[2] : null;
  const dia = iso ? iso[3] : br ? br[1] : null;
  if (!ano || !mes || !dia) throw falha("Informe a data do bloqueio.");
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00.000Z`);
  if (
    Number.isNaN(data.getTime()) ||
    data.getUTCFullYear() !== Number(ano) ||
    data.getUTCMonth() + 1 !== Number(mes) ||
    data.getUTCDate() !== Number(dia)
  ) {
    throw falha("Data do bloqueio inválida.");
  }
  return data;
}

// Data opcional (período de consulta): vazio = sem limite; inválida = erro.
function dataDoFormularioOpcional(valor) {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (!t) return null;
  return dataDoFormulario(t);
}

// Dia informado no filtro → instante UTC. O fuso do sistema é UTC-3:
// início = 00:00 local; fim = 23:59:59.999 local (dia final inclusivo).
const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;

function diaLocalParaUtc(valor, limite) {
  const dia = dataDoFormularioOpcional(valor);
  if (!dia) return null;
  return new Date(
    dia.getTime() - FUSO_OFFSET_MS + (limite === "fim" ? 24 * 60 * 60 * 1000 - 1 : 0),
  );
}

async function exigirBloqueio(id) {
  const bloqueioId = inteiroPositivo(id);
  if (!bloqueioId) throw falha("Bloqueio inválido.");
  const bloqueio = await prisma.processoBloqueio.findUnique({
    where: { id: bloqueioId },
    include: INCLUDE_BLOQUEIO,
  });
  if (!bloqueio) throw falha("Bloqueio não encontrado.", 404);
  return bloqueio;
}

export async function editarBloqueio(id, dados) {
  try {
    const user = await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "editar");
    const atual = await exigirBloqueio(id);

    const dataBloqueio = dataDoFormulario(dados?.dataBloqueio);
    const valor = valorMonetario(dados?.valor);
    const observacao = texto(dados?.observacao, 255) || null;

    const atualizado = await prisma.processoBloqueio.update({
      where: { id: atual.id },
      data: { dataBloqueio, valor, observacao },
      include: INCLUDE_BLOQUEIO,
    });

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoBloqueio",
      entidadeId: String(atual.id),
      descricao: `Bloqueio do processo ${atual.processo.numeroProcesso} alterado`,
      detalhes: {
        processoId: atual.processoId,
        numeroProcesso: atual.processo.numeroProcesso,
        antes: {
          dataBloqueio: atual.dataBloqueio.toISOString().slice(0, 10),
          valor: String(atual.valor),
          observacao: atual.observacao,
        },
        depois: {
          dataBloqueio: atualizado.dataBloqueio.toISOString().slice(0, 10),
          valor: String(atualizado.valor),
          observacao: atualizado.observacao,
        },
      },
    });

    revalidatePath(ROTA_BLOQUEIO);
    revalidatePath(ROTA);
    return { success: true, data: serializarBloqueio(atualizado) };
  } catch (erro) {
    return responder(erro);
  }
}

export async function excluirBloqueio(id, { confirmado = false } = {}) {
  try {
    const user = await requirePermissao(MODULOS.PROCESSOS, FUNCIONALIDADE, "excluir");
    if (!confirmado) throw falha("Confirme a exclusão do bloqueio.");
    const atual = await exigirBloqueio(id);

    await prisma.processoBloqueio.delete({ where: { id: atual.id } });

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: MODULO_AUDITORIA,
      entidade: "ProcessoBloqueio",
      entidadeId: String(atual.id),
      descricao: `Bloqueio do processo ${atual.processo.numeroProcesso} excluído`,
      detalhes: {
        processoId: atual.processoId,
        numeroProcesso: atual.processo.numeroProcesso,
        numeroPasta: atual.processo.pessoa?.numeroPasta || atual.processo.numeroPasta,
        pacienteCpf: atual.processo.pessoaCpf,
        dataBloqueio: atual.dataBloqueio.toISOString().slice(0, 10),
        valor: String(atual.valor),
        observacao: atual.observacao,
      },
    });

    revalidatePath(ROTA_BLOQUEIO);
    revalidatePath(ROTA);
    return { success: true, data: { id: atual.id } };
  } catch (erro) {
    return responder(erro);
  }
}
