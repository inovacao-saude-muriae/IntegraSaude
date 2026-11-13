import "server-only";
// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTO DO PROXY — projeção MÍNIMA do contexto de autorização
// ─────────────────────────────────────────────────────────────────────────
// O proxy roda no runtime do servidor (Node) e pode consultar o banco. Mas ele
// NÃO deve fazer a autorização: isso continua em `lib/permissions.js`
// (`temPermissaoPura`, `requirePermissao`).
//
// O que este módulo faz é só uma PROJEÇÃO: quais módulos o usuário tem, agora,
// segundo o vínculo gravado no banco. É a MESMA fonte (`user_acessos`) e a
// MESMA regra de "vínculo vale" de `permissions.js` — nada é decidido a partir
// de JWT/cookie, então revogação e desativação valem na requisição seguinte.
//
// Custo: 1 query indexada por `cpf` (índice `idx_user_acesso_cpf`), só em
// navegação de página — nunca em `/api` (o proxy libera a API antes daqui).
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { MODULOS } from "@/lib/permissoesCatalogo";

/**
 * @param {string} cpf
 * @returns {Promise<{ativo: boolean, modulos: string[], primeiroAcesso: boolean}>}
 */
export async function contextoDeModulos(cpf) {
  if (!cpf) return { ativo: false, modulos: [], primeiroAcesso: false };

  const user = await prisma.user.findUnique({
    where: { cpf },
    select: { ativo: true, primeiroAcesso: true },
  });
  // Conta desativada perde tudo na hora, mesmo com token ainda válido.
  if (!user || user.ativo !== true) {
    return { ativo: false, modulos: [], primeiroAcesso: false };
  }

  // Troca de senha pendente: o proxy manda para /trocar-senha em vez de
  // autorizar a rota. Vem da coluna `users.primeiro_acesso` (fonte única),
  // nunca do JWT — assim a liberação vale já na requisição seguinte.
  const primeiroAcesso = user.primeiroAcesso === true;

  const vinculos = await prisma.userAcesso.findMany({
    where: { userCpf: cpf, ativo: true },
    select: { modulo: true, perfil: true },
  });

  // Mesma regra de `vinculosAtivos` + perfil conhecido: vínculo sem perfil não
  // abre nada (fail-closed). Gestão Geral é um módulo como qualquer outro —
  // não abre nenhum módulo operacional por si.
  const modulos = new Set();
  for (const v of vinculos) {
    if (!v.perfil) continue;
    if (!Object.values(MODULOS).includes(v.modulo)) continue;
    modulos.add(v.modulo);
  }

  return { ativo: true, modulos: [...modulos], primeiroAcesso };
}
