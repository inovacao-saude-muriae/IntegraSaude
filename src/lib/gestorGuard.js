import { Role } from '@prisma/client';

// Roles válidas (enum Role do Prisma) - fonte única para validação de entrada.
export const ROLES_VALIDAS = Object.values(Role);

export const MSG_AUTO_DESATIVAR = 'Você não pode desativar a sua própria conta.';
export const MSG_AUTO_ROLE = 'Você não pode alterar o seu próprio perfil de acesso.';
export const MSG_ULTIMO_GESTOR =
  'Não é possível: este é o último usuário Gestor ativo. Crie ou promova outro Gestor antes.';

// Erro de regra de negócio com status HTTP (409 recusa, 404 não encontrado).
export class GestorGuardError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = 'GestorGuardError';
    this.status = status;
  }
}

/**
 * Autoproteção do Gestor. DEVE ser chamada DENTRO de `prisma.$transaction`
 * (recebe o `tx`) ANTES da escrita que altera `role` e/ou `ativo`, na mesma transação.
 *
 * Trava (SELECT ... FOR UPDATE) as linhas de todos os Gestores ativos, serializando
 * operações concorrentes: a segunda transação espera a primeira confirmar e então
 * reavalia (READ COMMITTED) apenas os gestores que continuam ativos. Assim dois
 * gestores rebaixando um ao outro nunca zeram o sistema.
 *
 * Regras (lançam GestorGuardError e nada é escrito):
 *  1. Ninguém desativa a si mesmo nem muda o próprio role para != GESTOR.
 *  2. Nunca desativar/rebaixar o último GESTOR ativo (mesmo por outro executor).
 *
 * @param tx transação do Prisma
 * @param {{executorCpf: string, alvoCpf: string, novoRole?: string, desativar?: boolean,
 *          alvoObrigatorio?: boolean}} opts
 * @returns usuário alvo (estado atual, já sob trava) ou null se não existir e não obrigatório
 */
export async function validarAlteracaoGestor(
  tx,
  { executorCpf, alvoCpf, novoRole, desativar = false, alvoObrigatorio = true }
) {
  const gestoresAtivos = await tx.$queryRaw`
    SELECT cpf FROM users WHERE role = 'GESTOR' AND ativo = true FOR UPDATE
  `;

  const alvo = await tx.user.findUnique({ where: { cpf: alvoCpf } });
  if (!alvo) {
    if (alvoObrigatorio) throw new GestorGuardError('Usuário não encontrado', 404);
    return null;
  }

  const rebaixa = novoRole !== undefined && novoRole !== 'GESTOR';
  const ehProprio = alvo.cpf === executorCpf;

  if (ehProprio && desativar) throw new GestorGuardError(MSG_AUTO_DESATIVAR);
  if (ehProprio && rebaixa) throw new GestorGuardError(MSG_AUTO_ROLE);

  const alvoEhGestorAtivo = alvo.role === 'GESTOR' && alvo.ativo === true;
  if (alvoEhGestorAtivo && (desativar || rebaixa) && gestoresAtivos.length <= 1) {
    throw new GestorGuardError(MSG_ULTIMO_GESTOR);
  }

  return alvo;
}
