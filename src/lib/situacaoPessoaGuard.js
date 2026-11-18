// Guard de negócio compartilhado: a situação cadastral da pessoa central.
//
// Não é uma regra nova por módulo — é a MESMA regra lida do banco
// (pessoa.situacao) por todos: Regulação, Junta Reguladora, Farmácia Judicial,
// Processos e CCZ. A decisão fica em @/lib/situacaoPessoa.
//
// Uso nos módulos: `await exigirPessoaAptaParaVinculo(cpf)`. A verificação é
// sempre refeita no BACKEND, no momento de salvar, com leitura do banco — vale
// para requisição direta à server action/API e para a situação alterada
// enquanto o formulário estava aberto.

import { prisma } from "@/lib/prisma";
import { mensagemPessoaIndisponivel } from "@/lib/situacaoPessoa";

/**
 * Devolve a pessoa com a situação cadastral.
 * @param {string} cpf
 * @param {object} [select] campos extras a trazer
 */
export async function situacaoCadastralDaPessoa(cpf, select = {}) {
  return prisma.pessoa.findUnique({
    where: { cpf: String(cpf || "").replace(/\D/g, "") },
    select: { cpf: true, nomeCompleto: true, situacao: true, ...select },
  });
}

/**
 * A pessoa pode receber um NOVO registro assistencial?
 * Não apaga nem altera nada: devolve a mensagem padronizada quando não pode.
 * Consulta de histórico nunca passa por aqui.
 * @returns {{ok: true, pessoa: object} | {ok: false, error: string}}
 */
export async function verificarPessoaParaNovoRegistro(cpf) {
  const pessoa = await situacaoCadastralDaPessoa(cpf);
  if (!pessoa) return { ok: false, error: "Pessoa não encontrada no cadastro único." };
  const erro = mensagemPessoaIndisponivel(pessoa.situacao);
  if (erro) return { ok: false, error: erro };
  return { ok: true, pessoa };
}

/**
 * FUNÇÃO ÚNICA de validação de novo vínculo, usada por todos os módulos.
 *
 * Verifica, no backend e no momento de salvar:
 *   1. a pessoa existe no cadastro único;
 *   2. não foi unificada em outro registro;
 *   3. a situação cadastral permite novo vínculo (Ativo).
 *
 * Não exclui nem altera nada: o histórico e os vínculos anteriores permanecem.
 *
 * @param {string} cpf
 * @param {object} [opcoes]
 * @param {string} [opcoes.mensagemPessoa] mensagem quando o CPF não existe
 * @param {string} [opcoes.mensagemUnificado] mensagem para cadastro unificado
 * @returns {Promise<{ok: true, pessoa: object} | {ok: false, error: string}>}
 */
export async function validarPessoaParaVinculo(cpf, {
  mensagemPessoa = "Pessoa não encontrada no cadastro único.",
  mensagemUnificado = "Este cadastro foi unificado em outro. Selecione o cadastro principal.",
} = {}) {
  const pessoa = await situacaoCadastralDaPessoa(cpf, { unificadoEmCpf: true });
  if (!pessoa) return { ok: false, error: mensagemPessoa };
  if (pessoa.unificadoEmCpf) return { ok: false, error: mensagemUnificado };
  const erro = mensagemPessoaIndisponivel(pessoa.situacao);
  if (erro) return { ok: false, error: erro };
  return { ok: true, pessoa };
}

/**
 * Igual a `validarPessoaParaVinculo`, mas LANÇA Error com a mensagem única.
 * Para as actions que sinalizam falha por exceção.
 */
export async function exigirPessoaAptaParaVinculo(cpf, opcoes) {
  const r = await validarPessoaParaVinculo(cpf, opcoes);
  if (!r.ok) throw new Error(r.error);
  return r.pessoa;
}
