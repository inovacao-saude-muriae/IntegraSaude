// Situação cadastral da Pessoa central (EMPI) — REGRA ÚNICA do sistema.
//
// Função pura, sem imports e sem "use client": é usada pelas server actions
// (que decidem o que pode ser gravado) e pelos componentes de cliente (que só
// exibem). Este arquivo NÃO pode importar nada de cliente.
//
// ═══════════════════════════════════════════════════════════════════════════
// Fonte única
// ---------------------------------------------------------------------------
// `pessoa.situacao` é o único campo de situação cadastral. Todos os módulos
// (Regulação, Junta Reguladora, Farmácia Judicial, Processos, CCZ) leem e
// gravam o MESMO registro: alterar em um módulo reflete em todos.
//
// `pessoa.ativo` continua existindo como ESPELHO TÉCNICO de
// `situacao = 'ATIVO'`, mantido por trigger no banco, para não quebrar as
// consultas e vínculos existentes. Ele nunca é decidido pela aplicação.
//
// Não confundir com:
//   • situação da CONTA de usuário (users.ativo / user_acessos.ativo);
//   • situação do VÍNCULO de tutor (ccz_tutores);
//   • cadastro absorvido por UNIFICAÇÃO (unificado_em_cpf preenchido).
// ═══════════════════════════════════════════════════════════════════════════

export const SITUACOES_PESSOA = {
  ATIVO: "ATIVO",
  FALECIDO: "FALECIDO",
};

/** Lista canônica (as duas situações existentes), na ordem dos formulários. */
export const SITUACOES_PESSOA_LISTA = [
  SITUACOES_PESSOA.ATIVO,
  SITUACOES_PESSOA.FALECIDO,
];

/** Rótulos de exibição (interface em português). */
export const SITUACAO_PESSOA_ROTULO = {
  ATIVO: "Ativo",
  FALECIDO: "Falecido",
};

/** Classe visual da etiqueta: verde / vermelho. */
export const SITUACAO_PESSOA_CLASSE = {
  ATIVO: "cadStatusAtivo",
  FALECIDO: "cadStatusFalecido",
};

/** Opções para os filtros de listagem: Todos, Ativos e Falecidos. */
export const FILTROS_SITUACAO_PESSOA = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "falecidos", rotulo: "Falecidos" },
];

/**
 * Mensagem ÚNICA exibida quando se tenta vincular uma pessoa falecida a um
 * novo registro operacional (Regulação, Farmácia, Processos, Junta, CCZ).
 */
export const MENSAGEM_PESSOA_FALECIDA =
  "Pessoa com situação cadastral Falecido. Não é possível realizar novos vínculos.";

export const MIN_JUSTIFICATIVA_SITUACAO = 15;
export const MAX_JUSTIFICATIVA_SITUACAO = 500;

/**
 * Normaliza para um dos dois valores; entrada desconhecida vira ATIVO.
 * `INATIVO` é valor LEGADO: não é oferecido em nenhum formulário nem filtro,
 * mas continua reconhecido na leitura para que o registro seja corrigido por
 * usuário autorizado (nunca migrado automaticamente).
 */
export function normalizarSituacaoPessoa(valor) {
  const v = String(valor ?? "").trim().toUpperCase();
  if (v === SITUACOES_PESSOA.FALECIDO) return SITUACOES_PESSOA.FALECIDO;
  return SITUACOES_PESSOA.ATIVO;
}

/** Situação legada (Inativo): só para identificação/relatório, nunca para gravar. */
export const SITUACAO_PESSOA_LEGADA = "INATIVO";

/** O valor gravado é a situação legada "Inativo"? */
export function situacaoLegada(valor) {
  return String(valor ?? "").trim().toUpperCase() === SITUACAO_PESSOA_LEGADA;
}

export function rotuloSituacaoPessoa(valor) {
  if (situacaoLegada(valor)) return "Inativo (situação legada)";
  return SITUACAO_PESSOA_ROTULO[normalizarSituacaoPessoa(valor)];
}

/** Classe CSS da etiqueta de situação (verde / vermelho). */
export function classeSituacaoPessoa(valor) {
  if (situacaoLegada(valor)) return "cadStatusInativo";
  return SITUACAO_PESSOA_CLASSE[normalizarSituacaoPessoa(valor)];
}

/** A pessoa pode ser usada em NOVOS registros assistenciais? */
export function pessoaAptaAssistencia(situacao) {
  return normalizarSituacaoPessoa(situacao) === SITUACOES_PESSOA.ATIVO;
}

/** A pessoa pode ser selecionada em buscas e cadastros (tutores, pacientes)? */
export function pessoaSelecionavel(situacao) {
  return normalizarSituacaoPessoa(situacao) === SITUACOES_PESSOA.ATIVO;
}

/**
 * Mensagem única para os módulos quando a pessoa não pode receber novo
 * registro assistencial. `null` quando está tudo certo.
 * A mensagem NÃO impede consulta ao histórico — só novos registros.
 */
export function mensagemPessoaIndisponivel(situacao) {
  const s = normalizarSituacaoPessoa(situacao);
  if (s === SITUACOES_PESSOA.FALECIDO) return MENSAGEM_PESSOA_FALECIDA;
  return null;
}

/**
 * Filtro de listagem → cláusula Prisma sobre `situacao`.
 * "todos" não restringe; qualquer outro valor filtra exatamente a situação.
 */
export function whereSituacaoPessoa(filtro) {
  const f = String(filtro ?? "todos").toLowerCase();
  // "Ativos" = pode receber novos vínculos. A situação legada Inativo não é
  // oferecida, mas seus registros continuam aparecendo em "Todos".
  if (f === "ativos") return { NOT: { situacao: SITUACOES_PESSOA.FALECIDO } };
  if (f === "falecidos") return { situacao: SITUACOES_PESSOA.FALECIDO };
  return {};
}

/** Situação a gravar quando o formulário envia um valor (padrão ATIVO). */
export function situacaoDoFormulario(valor) {
  return normalizarSituacaoPessoa(valor);
}
