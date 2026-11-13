/**
 * Autoproteção administrativa — SEM `users.role`.
 *
 * Antes esta guarda existia para proteger o perfil legado `GESTOR`
 * (não desativar a si mesmo, não deixar o sistema sem gestor). Com a
 * arquitetura definitiva a pergunta certa é outra: **não deixar o sistema sem
 * ninguém capaz de administrar acessos**. Quem pode isso é quem tem a permissão
 * `acessos:editar` do módulo GESTAO — a mesma que esta rota exige.
 *
 * Regras (lançam GestorGuardError e nada é escrito):
 *  1. Ninguém desativa a si mesmo.
 *  2. Nunca desativar o último administrador de acessos ativo.
 */
import { permissoesEfetivas } from "@/lib/permissoesCatalogo";

export const MSG_AUTO_DESATIVAR = "Você não pode desativar a sua própria conta.";
export const MSG_ULTIMO_ADMIN =
  "Não é possível: este é o último usuário ativo capaz de administrar acessos. " +
  "Conceda essa permissão a outra pessoa antes.";

// Erro de regra de negócio com status HTTP (409 recusa, 404 não encontrado).
export class GestorGuardError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = "GestorGuardError";
    this.status = status;
  }
}

// O vínculo GESTAO do usuário permite editar acessos?
function adminDeAcessos(acessos) {
  const doModulo = (acessos || []).filter(
    (a) => a.modulo === "GESTAO" && a.ativo !== false,
  );
  return doModulo.some((a) =>
    permissoesEfetivas(a.modulo, a.perfil, a.permissoes, a.removidas).includes(
      "acessos:editar",
    ),
  );
}

/**
 * DEVE ser chamada DENTRO de `prisma.$transaction` (recebe o `tx`), na mesma
 * transação da escrita. Trava (`FOR UPDATE`) as linhas de `user_acessos` do
 * módulo GESTAO para serializar operações concorrentes: a segunda transação
 * espera a primeira confirmar e reavalia quem continua administrando.
 *
 * @param tx transação do Prisma
 * @param {{executorCpf: string, alvoCpf: string, desativar?: boolean,
 *          alvoObrigatorio?: boolean}} opts
 * @returns usuário alvo (estado atual, já sob trava) ou null
 */
export async function validarAlteracaoGestor(
  tx,
  { executorCpf, alvoCpf, desativar = false, alvoObrigatorio = true },
) {
  // Trava dos vínculos administrativos (serializa desativações concorrentes).
  const vinculos = await tx.$queryRaw`
    SELECT a.id, a.user_cpf, a.perfil, a.permissoes, a.removidas, a.ativo, u.ativo AS user_ativo
      FROM user_acessos a
      JOIN users u ON u.cpf = a.user_cpf
     WHERE a.modulo = 'GESTAO' AND a.ativo = true
     FOR UPDATE OF a
  `;

  const alvo = await tx.user.findUnique({ where: { cpf: alvoCpf } });
  if (!alvo) {
    if (alvoObrigatorio) throw new GestorGuardError("Usuário não encontrado", 404);
    return null;
  }

  if (alvo.cpf === executorCpf && desativar) {
    throw new GestorGuardError(MSG_AUTO_DESATIVAR);
  }

  // Quantos administradores de acessos continuariam ativos depois da operação?
  const alvoAdmin = adminDeAcessos(
    vinculos.filter((v) => v.user_cpf === alvoCpf),
  );
  const outrosAdmins = new Set(
    vinculos
      .filter((v) => v.user_cpf !== alvoCpf && v.user_ativo === true)
      .filter((v) => adminDeAcessos([{ ...v, modulo: "GESTAO", ativo: v.ativo }]))
      .map((v) => v.user_cpf),
  );

  if (alvoAdmin && desativar && outrosAdmins.size === 0) {
    throw new GestorGuardError(MSG_ULTIMO_ADMIN);
  }

  return alvo;
}
