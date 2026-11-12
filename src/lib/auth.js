import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  MODULOS,
  usuarioEhGestor,
  usuarioTemAcessoModulo,
  usuarioEhAdminModulo,
  usuarioTemAcessoServicoJunta,
  usuarioEhAdminDeAlgumModulo,
  servicoJuntaDoNome,
} from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════════════════
// SESSÃO — VALIDAÇÃO CENTRALIZADA (fonte única)
// ─────────────────────────────────────────────────────────────────────────
// Toda leitura de sessão do sistema (Server Actions, Route Handlers e
// Componentes de Servidor) passa por `carregarSessao()`. Regras aplicadas:
//   1. o cookie `session_token` existe;
//   2. a sessão existe no banco (token corresponde a uma sessão registrada);
//   3. `expires_at` ainda não passou (expiração real, do banco);
//   4. o usuário dono da sessão está ATIVO.
// Qualquer falha → sessão inválida (fail-closed).
// Não há outro caminho de autenticação no sistema.
// ═══════════════════════════════════════════════════════════════════════════

export const SESSION_COOKIE = "session_token";

// Duração da sessão: 8 horas (política atual, mantida).
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// Opções padrão do cookie de sessão (usadas no login, na troca de senha e no
// logout, para que todos os fluxos emitam/limparem o cookie do mesmo jeito).
export function opcoesCookieSessao(expiresAt) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

// Sessão válida completa, ou null. NUNCA lança: é a primitiva usada tanto por
// guards (que convertem null em 401) quanto por rotas que precisam só checar.
// Inclui `user` com os vínculos (`acessos`) para as decisões de autorização.
export async function carregarSessao() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { acessos: true } } },
  });

  if (!session?.user || session.user.ativo === false) return null;
  if (!session.expiresAt || new Date(session.expiresAt) <= new Date()) return null;

  return { session, user: session.user, token };
}

// Igual a carregarSessao, mas lança {status:401} quando não há sessão válida.
// Mantida com o nome antigo para não alterar os call sites existentes.
async function carregarUsuarioSessao() {
  const ctx = await carregarSessao();
  if (!ctx) {
    throw Object.assign(new Error("Sessão inválida ou expirada."), { status: 401 });
  }
  return ctx.user;
}

// Versão que devolve o usuário (ou null), sem lançar — para rotas que preferem
// responder 401 manualmente em vez de capturar exceção.
export async function usuarioDaSessao() {
  const ctx = await carregarSessao();
  return ctx?.user ?? null;
}

// NOTA (RBAC Etapa 1 / FEAT-003): a antiga requireRole(roles) foi REMOVIDA após
// migrar todos os call sites para as guardas por vínculo abaixo. Buscas por
// "requireRole(" e "requireRole" em src/ deram zero ocorrências fora deste
// arquivo, então a remoção é segura (NFR-1/AC-12).

// ═══════════════════════════════════════════════════════════════════════════
// GUARDAS POR VÍNCULO (RBAC Etapa 1) — reusam src/lib/permissions.js.
// Cada guarda valida a sessão (401 se ausente/expirada), aplica a função de
// decisão e lança {status:403} ou retorna o user completo (com acessos).
// ═══════════════════════════════════════════════════════════════════════════

// Apenas autenticação (sem exigir módulo). Usada nas buscas do cadastro único
// (EMPI): todo usuário logado pode buscar pessoa, mas ninguém anônimo.
export async function requireUsuarioAutenticado() {
  return carregarUsuarioSessao();
}

export async function requireAcessoModulo(modulo) {
  const user = await carregarUsuarioSessao();
  if (!(await usuarioTemAcessoModulo(user, modulo))) {
    throw Object.assign(new Error("Acesso negado ao módulo."), { status: 403 });
  }
  return user;
}

export async function requireAdminModulo(modulo) {
  const user = await carregarUsuarioSessao();
  if (!(await usuarioEhAdminModulo(user, modulo))) {
    throw Object.assign(new Error("Acesso negado: requer administrador do módulo."), { status: 403 });
  }
  return user;
}

export async function requireGestor() {
  const user = await carregarUsuarioSessao();
  if (!(await usuarioEhGestor(user))) {
    throw Object.assign(new Error("Acesso negado: requer Gestor."), { status: 403 });
  }
  return user;
}

export async function requireAcessoServicoJunta(servicoJunta) {
  const user = await carregarUsuarioSessao();
  if (!(await usuarioTemAcessoServicoJunta(user, servicoJunta))) {
    throw Object.assign(new Error("Acesso negado ao serviço da Junta."), { status: 403 });
  }
  return user;
}

export async function requireAdminDeAlgumModulo() {
  const user = await carregarUsuarioSessao();
  if (!(await usuarioEhAdminDeAlgumModulo(user))) {
    throw Object.assign(new Error("Acesso negado: requer administrador de algum módulo."), { status: 403 });
  }
  return user;
}

// Guarda "pessoas" (refinamento #5): GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN.
// Reutilizável nos 3 call sites (layout de pessoas, pessoas/actions e as
// escritas de Pessoa da Regulação).
export async function requireAcessoPessoas() {
  const user = await carregarUsuarioSessao();
  const ok =
    (await usuarioEhGestor(user)) ||
    (await usuarioEhAdminModulo(user, MODULOS.REGULACAO)) ||
    (await usuarioEhAdminModulo(user, MODULOS.JUNTA));
  if (!ok) {
    throw Object.assign(new Error("Acesso negado ao cadastro de pessoas."), { status: 403 });
  }
  return user;
}

// LEITURA por serviço da Junta: nome mapeado → exige o sub-serviço; nome não
// mapeado (serviço não controlado) → exige só acesso ao módulo JUNTA (leituras
// não criam dados).
export async function requireLeituraServicoJuntaPorNome(servicoNome) {
  const enumServ = servicoJuntaDoNome(servicoNome);
  if (enumServ) return requireAcessoServicoJunta(enumServ);
  return requireAcessoModulo(MODULOS.JUNTA);
}

// ESCRITA por serviço da Junta: nome mapeado → exige o sub-serviço; nome não
// mapeado → exige requireAdminModulo(JUNTA): OPERADOR nunca cria/grava em
// serviço não controlado on-the-fly.
export async function requireEscritaServicoJuntaPorNome(servicoNome) {
  const enumServ = servicoJuntaDoNome(servicoNome);
  if (enumServ) return requireAcessoServicoJunta(enumServ);
  return requireAdminModulo(MODULOS.JUNTA);
}
