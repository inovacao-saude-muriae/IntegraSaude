import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  MODULOS,
  usuarioTemAcessoModulo,
  usuarioEhAdminModulo,
  usuarioTemAcessoServicoJunta,
  usuarioEhAdminDeAlgumModulo,
  usuarioTemPermissao,
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
    await registrarAcessoNegado(user, {
      recurso: `Modulo:${modulo}`,
      descricao: `Acesso negado ao módulo ${modulo}`,
    });
    throw Object.assign(new Error("Acesso negado ao módulo."), { status: 403 });
  }
  return user;
}

export async function requireAdminModulo(modulo) {
  const user = await carregarUsuarioSessao();
  if (!(await usuarioEhAdminModulo(user, modulo))) {
    await registrarAcessoNegado(user, {
      recurso: `Admin:${modulo}`,
      descricao: `Acesso negado: requer administrador do módulo ${modulo}`,
    });
    throw Object.assign(new Error("Acesso negado: requer administrador do módulo."), { status: 403 });
  }
  return user;
}

/**
 * Guarda da administração de segurança (antigo `requireGestor`).
 *
 * NÃO é mais "tem a role GESTOR": exige uma PERMISSÃO do módulo GESTAO —
 * exatamente como qualquer outro módulo. Assim, Gestão Geral deixa de ser
 * privilégio implícito: um vínculo de Gestão Geral só abre o que o perfil e as
 * permissões daquele vínculo permitem, e um vínculo removido fecha na hora.
 *
 * `funcionalidade` e `permissao` são do catálogo (`lib/permissoesCatalogo`).
 * O nome antigo é mantido como apelido para não quebrar as chamadas existentes
 * enquanto as rotas migram uma a uma — todas passam a exigir permissão.
 */
export async function requirePermissaoGestao(
  funcionalidade = "acessos",
  permissao = "editar",
) {
  return requirePermissao(MODULOS.GESTAO, funcionalidade, permissao);
}

/** @deprecated use requirePermissaoGestao(funcionalidade, permissao). */
export const requireGestor = requirePermissaoGestao;

// ── GUARDA POR FUNCIONALIDADE E PERMISSÃO (arquitetura definitiva) ─────────
// Substitui as guardas por módulo/nível nas operações que precisam de controle
// fino. Exemplo:
//
//   await requirePermissao(MODULOS.REGULACAO, "novo_pedido", "excluir");
//   await requirePermissao(MODULOS.JUNTA, "agendas", "editar", SERVICOS_JUNTA.CAEE);
//
// `servico` é obrigatório nos módulos com escopo por serviço (Junta hoje); sem
// ele, a permissão só é concedida se o vínculo alcançar TODOS os serviços.
export async function requirePermissao(modulo, funcionalidade, permissao, servico) {
  const user = await carregarUsuarioSessao();
  const ok = await usuarioTemPermissao(user, modulo, funcionalidade, permissao, servico);
  if (!ok) {
    await registrarAcessoNegado(user, {
      recurso: `Permissao:${modulo}:${funcionalidade}:${permissao}${
        servico ? `:${servico}` : ""
      }`,
      descricao: `Acesso negado: requer a permissão ${permissao} em ${funcionalidade} (${modulo})`,
    });
    throw Object.assign(
      new Error("Acesso negado: você não tem permissão para esta operação."),
      { status: 403 },
    );
  }
  return user;
}

// Variante que só responde sim/não, para uso em componentes de servidor e
// montagem de menu (não lança, não audita).
export async function podeExecutar(modulo, funcionalidade, permissao, servico) {
  const user = await carregarUsuarioSessao();
  if (!user) return false;
  return usuarioTemPermissao(user, modulo, funcionalidade, permissao, servico);
}

export async function requireAcessoServicoJunta(servicoJunta) {
  const user = await carregarUsuarioSessao();
  if (!(await usuarioTemAcessoServicoJunta(user, servicoJunta))) {
    await registrarAcessoNegado(user, {
      recurso: `Junta:${servicoJunta}`,
      descricao: `Acesso negado ao serviço da Junta ${servicoJunta}`,
    });
    throw Object.assign(new Error("Acesso negado ao serviço da Junta."), { status: 403 });
  }
  return user;
}

/**
 * Registra a negativa de uma rota de painel quando a barreira foi chamada com
 * `opcional: true`. Exportada para que a ROTA decida o momento de registrar —
 * assim a tentativa tem um único registro, com o recurso certo.
 */
export async function registrarNegativaDePainel() {
  const user = await carregarUsuarioSessao();
  await registrarAcessoNegado(user, {
    recurso: "Permissao:GESTAO:painel:visualizar",
    descricao:
      "Acesso negado: requer administrador de algum módulo ou a permissão " +
      "visualizar em painel (GESTAO)",
  });
}

/**
 * Barreira das rotas de painel/consolidado (métricas, relatórios gerais).
 *
 * Entra quem é ADMINISTRADOR de algum módulo OU quem tem permissão de painel da
 * Gestão Geral; a rota decide depois, bloco a bloco, pelo módulo de cada um.
 *
 * `opcional`: quando a rota já vai aplicar uma guarda mais específica em
 * seguida (ex.: `requirePermissaoGestao("auditoria","visualizar")`), esta
 * barreira NÃO audita a negativa — quem audita é a guarda específica. Assim uma
 * única tentativa indevida gera um único registro `NEGAR`.
 */
export async function requireAdminDeAlgumModulo({ opcional = false } = {}) {
  const user = await carregarUsuarioSessao();
  const ok =
    (await usuarioEhAdminDeAlgumModulo(user)) ||
    (await usuarioTemPermissao(user, MODULOS.GESTAO, "painel", "visualizar"));
  if (!ok) {
    if (!opcional) {
      await registrarAcessoNegado(user, {
        recurso: "AdminDeAlgumModulo",
        descricao: "Acesso negado: requer administrador de algum módulo",
      });
    }
    throw Object.assign(new Error("Acesso negado: requer administrador de algum módulo."), { status: 403 });
  }
  return user;
}

// Guarda "pessoas" (refinamento #5): GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN.
// Reutilizável nos 3 call sites (layout de pessoas, pessoas/actions e as
// escritas de Pessoa da Regulação).
export async function requireAcessoPessoas() {
  const user = await carregarUsuarioSessao();
  // Gestão Geral entra por permissão explícita do módulo GESTAO, não por
  // "ser gestor": quem administra pessoas na Gestão Geral tem a funcionalidade
  // `pessoas` do catálogo.
  const ok =
    (await usuarioTemPermissao(user, MODULOS.GESTAO, "pessoas", "editar")) ||
    (await usuarioEhAdminModulo(user, MODULOS.REGULACAO)) ||
    (await usuarioEhAdminModulo(user, MODULOS.JUNTA));
  if (!ok) {
    await registrarAcessoNegado(user, {
      recurso: "Pessoas",
      descricao: "Acesso negado ao cadastro de pessoas",
    });
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

// ═══════════════════════════════════════════════════════════════════════════
// AUDITORIA DE ACESSO NEGADO
// ─────────────────────────────────────────────────────────────────────────
// Toda guarda que barra uma operação registra o evento (usuário, ação tentada,
// módulo). Best-effort: nunca altera a resposta ao cliente e nunca lança.
// Não grava conteúdo do registro — só a identificação da operação negada.
// ═══════════════════════════════════════════════════════════════════════════
// ── Auditoria NEGAR: UMA tentativa = UM registro ───────────────────────────
// Uma mesma requisição pode passar por duas guardas que negam (ex.: a barreira
// "admin de algum módulo" e depois a permissão específica da rota, ou uma
// action que chama duas guardas). Antes isso gerava 2-3 registros para a MESMA
// tentativa. Agora a guarda que nega registra `recurso`, e a gravação:
//
//   1. consolida dentro do processo, por chave (usuário + módulo + operação +
//      recurso + janela de 5 s), marcando `consolidada: true` quando a mesma
//      tentativa passa por mais de uma guarda;
//   2. relê o banco antes de gravar (outro processo/rota pode ter gravado a
//      mesma tentativa há instantes) e, nesse caso, só consolida a anterior;
//   3. nunca apaga um registro legítimo de uma tentativa DISTINTA: a janela é
//      curta e a chave inclui o recurso negado.
const JANELA_NEGAR_MS = 5000;
const negacoesEmVoo = new Map(); // chave → { id, em }

function chaveNegacao(user, recurso) {
  return `${user.cpf}|AUTH|NEGAR|${recurso || "Autorizacao"}`;
}

async function registrarAcessoNegado(user, { recurso, descricao } = {}) {
  try {
    if (!user?.cpf) return;
    const { registrarAuditoria } = await import("@/lib/audit");
    const { prisma } = await import("@/lib/prisma");

    const entidade = recurso || "Autorizacao";
    const chave = chaveNegacao(user, entidade);
    const agora = Date.now();
    const emVoo = negacoesEmVoo.get(chave);
    if (emVoo && agora - emVoo.em < JANELA_NEGAR_MS) return; // mesma tentativa
    negacoesEmVoo.set(chave, { em: agora });

    // Já gravado por outra guarda/processo nesta janela? Consolida e sai.
    const recente = await prisma.auditLog.findFirst({
      where: {
        userCpf: user.cpf,
        acao: "NEGAR",
        entidade,
        createdAt: { gte: new Date(agora - JANELA_NEGAR_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recente) {
      await prisma.auditLog.update({
        where: { id: recente.id },
        data: {
          detalhes: {
            ...(recente.detalhes || {}),
            tentativas: Number(recente.detalhes?.tentativas || 1) + 1,
            consolidada: true,
          },
        },
      });
      return;
    }

    await registrarAuditoria({
      user,
      acao: "NEGAR",
      modulo: "AUTH",
      entidade,
      entidadeId: user.cpf,
      descricao: descricao || "Tentativa de acesso não autorizado",
    });
  } catch {
    // silencioso por design
  } finally {
    // limpeza oportunista: a janela é curta, o mapa não pode crescer sem limite
    for (const [k, v] of negacoesEmVoo) {
      if (Date.now() - v.em > JANELA_NEGAR_MS * 12) negacoesEmVoo.delete(k);
    }
  }
}
