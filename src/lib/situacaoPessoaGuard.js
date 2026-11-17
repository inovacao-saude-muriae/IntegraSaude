// Guard de negócio compartilhado: a situação cadastral da pessoa central.
//
// Não é uma regra nova por módulo — é a MESMA regra lida do banco
// (pessoa.situacao) por todos: Regulação, Junta Reguladora, Farmácia Judicial,
// Processos e CCZ. A decisão fica em @/lib/situacaoPessoa.

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
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export async function verificarPessoaParaNovoRegistro(cpf) {
  const pessoa = await situacaoCadastralDaPessoa(cpf);
  if (!pessoa) return { ok: false, error: "Pessoa não encontrada no cadastro único." };
  const erro = mensagemPessoaIndisponivel(pessoa.situacao);
  if (erro) return { ok: false, error: erro };
  return { ok: true, pessoa };
}
