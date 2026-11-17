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
  INATIVO: "INATIVO",
  FALECIDO: "FALECIDO",
};

/** Lista canônica, na ordem em que aparece nos filtros. */
export const SITUACOES_PESSOA_LISTA = [
  SITUACOES_PESSOA.ATIVO,
  SITUACOES_PESSOA.INATIVO,
  SITUACOES_PESSOA.FALECIDO,
];

/** Rótulos de exibição (interface em português). */
export const SITUACAO_PESSOA_ROTULO = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  FALECIDO: "Falecido",
};

/** Classe visual da etiqueta: verde / cinza / vermelho. */
export const SITUACAO_PESSOA_CLASSE = {
  ATIVO: "cadStatusAtivo",
  INATIVO: "cadStatusInativo",
  FALECIDO: "cadStatusFalecido",
};

/** Opções para os filtros de listagem: Todos, Ativos, Inativos e Falecidos. */
export const FILTROS_SITUACAO_PESSOA = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "inativos", rotulo: "Inativos" },
  { valor: "falecidos", rotulo: "Falecidos" },
];

export const MIN_JUSTIFICATIVA_SITUACAO = 15;
export const MAX_JUSTIFICATIVA_SITUACAO = 500;

/** Normaliza para um dos três valores; entrada desconhecida vira ATIVO. */
export function normalizarSituacaoPessoa(valor) {
  const v = String(valor ?? "").trim().toUpperCase();
  return SITUACOES_PESSOA_LISTA.includes(v) ? v : SITUACOES_PESSOA.ATIVO;
}

export function rotuloSituacaoPessoa(valor) {
  return SITUACAO_PESSOA_ROTULO[normalizarSituacaoPessoa(valor)];
}

/** Classe CSS da etiqueta de situação (verde / cinza / vermelho). */
export function classeSituacaoPessoa(valor) {
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
  if (s === SITUACOES_PESSOA.FALECIDO) {
    return "Esta pessoa consta como falecida: não é possível criar novos registros assistenciais. O histórico permanece consultável.";
  }
  if (s === SITUACOES_PESSOA.INATIVO) {
    return "Esta pessoa está com a situação cadastral Inativa: não é possível criar novos registros assistenciais. O histórico permanece consultável.";
  }
  return null;
}

/**
 * Filtro de listagem → cláusula Prisma sobre `situacao`.
 * "todos" não restringe; qualquer outro valor filtra exatamente a situação.
 */
export function whereSituacaoPessoa(filtro) {
  const f = String(filtro ?? "todos").toLowerCase();
  if (f === "ativos") return { situacao: SITUACOES_PESSOA.ATIVO };
  if (f === "inativos") return { situacao: SITUACOES_PESSOA.INATIVO };
  if (f === "falecidos") return { situacao: SITUACOES_PESSOA.FALECIDO };
  return {};
}

/** Situação a gravar quando o formulário envia um valor (padrão ATIVO). */
export function situacaoDoFormulario(valor) {
  return normalizarSituacaoPessoa(valor);
}
