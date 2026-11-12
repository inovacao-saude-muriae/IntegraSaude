import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { carregarSessao } from "@/lib/auth";

// ═══════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA DE VERDADE DE AUTORIZAÇÃO (RBAC Etapa 1)
// ─────────────────────────────────────────────────────────────────────────
// Toda decisão de acesso nasce aqui. Client Components NÃO importam este módulo
// (regra da DAL do Next): recebem flags já calculadas via props/context.
// Princípio transversal: fail-closed — qualquer dúvida resulta em negar.
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Constantes de domínio (espelham os enums Prisma de FEAT-001) ─────────

export const MODULOS = {
  REGULACAO: "REGULACAO",
  FARMACIA: "FARMACIA",
  PROCESSOS: "PROCESSOS",
  JUNTA: "JUNTA",
  CCZ: "CCZ",
};

export const NIVEIS = { ADMIN: "ADMIN", OPERADOR: "OPERADOR" };

export const SERVICOS_JUNTA = {
  CAEE: "CAEE",
  APAE: "APAE",
  AMBULATORIO: "AMBULATORIO",
  ESPECIALIDADES: "ESPECIALIDADES",
};

// ── 2. Carregamento dos vínculos (consulta ao banco, memoizada por render) ──

// Carrega {user, acessos} a partir da sessão (cookie). Memoizado por render de
// Server Component via React.cache: várias checagens na mesma renderização = 1
// query. Em API routes/actions (que não são renderizações de componente) NÃO
// se deve contar com a dedupe entre funções — cada guarda roda a query 1x.
// IMPORTANTE: usa include SEM select restritivo, para manter nome/role/cargo
// no `user` retornado (actions existentes consomem user.nome etc.).
// A validação da sessão em si é delegada a `carregarSessao()` (lib/auth.js),
// fonte única: cookie → sessão no banco → expiração real → usuário ativo.
// Aqui só memoizamos por renderização para evitar N queries na mesma árvore.
export const carregarContextoAcesso = cache(async () => {
  const ctx = await carregarSessao();
  if (!ctx) return null;
  return { user: ctx.user, acessos: ctx.user.acessos };
});

// Variante por CPF explícito. Memoizada por render.
export const carregarAcessosPorCpf = cache(async (cpf) => {
  return prisma.userAcesso.findMany({ where: { userCpf: cpf } });
});

// ── 3. Normalização interna do argumento userOuCpf ─────────────────────────
// Aceita: string CPF | { cpf, role, acessos? }.
// Resolve para { role, acessos } carregando do banco o que faltar.

async function resolverContexto(userOuCpf) {
  if (userOuCpf == null) return null;

  // String CPF → carrega acessos (role desconhecido a partir do CPF puro;
  // GESTOR deriva de role, então sem role não há atalho de GESTOR).
  if (typeof userOuCpf === "string") {
    const acessos = await carregarAcessosPorCpf(userOuCpf);
    return { role: undefined, acessos: acessos || [] };
  }

  // Objeto user: usa role; carrega acessos se não vieram embutidos.
  const role = userOuCpf.role;
  let acessos = userOuCpf.acessos;
  if (!Array.isArray(acessos)) {
    acessos = userOuCpf.cpf ? await carregarAcessosPorCpf(userOuCpf.cpf) : [];
  }
  return { role, acessos: acessos || [] };
}

// ── 4. Funções de decisão PURAS (recebem {role, acessos}) ───────────────────
// Isoladas para teste; GESTOR curto-circuita tudo; valor desconhecido → false.

function ehGestorPuro(ctx) {
  return ctx?.role === "GESTOR";
}

function temAcessoModuloPuro(ctx, modulo) {
  if (ehGestorPuro(ctx)) return true;
  if (!ctx || !modulo) return false;
  return ctx.acessos.some((a) => a.modulo === modulo);
}

function ehAdminModuloPuro(ctx, modulo) {
  if (ehGestorPuro(ctx)) return true;
  if (!ctx || !modulo) return false;
  return ctx.acessos.some((a) => a.modulo === modulo && a.nivel === NIVEIS.ADMIN);
}

function temAcessoServicoJuntaPuro(ctx, servicoJunta) {
  if (ehGestorPuro(ctx)) return true;
  if (!ctx || !servicoJunta) return false;
  // JUNTA/ADMIN vê todos os sub-serviços.
  if (ctx.acessos.some((a) => a.modulo === MODULOS.JUNTA && a.nivel === NIVEIS.ADMIN)) {
    return true;
  }
  // JUNTA/OPERADOR: só se houver vínculo com esse sub-serviço.
  return ctx.acessos.some(
    (a) =>
      a.modulo === MODULOS.JUNTA &&
      a.nivel === NIVEIS.OPERADOR &&
      a.servicoJunta === servicoJunta,
  );
}

function ehAdminDeAlgumModuloPuro(ctx) {
  if (ehGestorPuro(ctx)) return true;
  if (!ctx) return false;
  return ctx.acessos.some((a) => a.nivel === NIVEIS.ADMIN);
}

// ── 5. Funções de decisão públicas (async; normalizam o argumento) ──────────

// true sse role === "GESTOR". Não consulta UserAcesso.
export async function usuarioEhGestor(userOuCpf) {
  if (typeof userOuCpf === "object" && userOuCpf !== null) {
    return ehGestorPuro(userOuCpf);
  }
  const ctx = await resolverContexto(userOuCpf);
  return ehGestorPuro(ctx);
}

// GESTOR → true. Senão: existe vínculo com esse `modulo` (qualquer nivel/serviço).
export async function usuarioTemAcessoModulo(userOuCpf, modulo) {
  const ctx = await resolverContexto(userOuCpf);
  return temAcessoModuloPuro(ctx, modulo);
}

// GESTOR → true. Senão: existe vínculo {modulo, nivel: ADMIN}.
export async function usuarioEhAdminModulo(userOuCpf, modulo) {
  const ctx = await resolverContexto(userOuCpf);
  return ehAdminModuloPuro(ctx, modulo);
}

// GESTOR → true. JUNTA/ADMIN → true p/ qualquer serviço.
// JUNTA/OPERADOR → true sse existir vínculo {JUNTA, OPERADOR, servicoJunta}.
export async function usuarioTemAcessoServicoJunta(userOuCpf, servicoJunta) {
  const ctx = await resolverContexto(userOuCpf);
  return temAcessoServicoJuntaPuro(ctx, servicoJunta);
}

// GESTOR → true. Senão: existe algum vínculo {*, nivel: ADMIN}.
export async function usuarioEhAdminDeAlgumModulo(userOuCpf) {
  const ctx = await resolverContexto(userOuCpf);
  return ehAdminDeAlgumModuloPuro(ctx);
}

// Export das funções puras (sem I/O) para teste com `node --test`, se desejado.
export const _puras = {
  ehGestorPuro,
  temAcessoModuloPuro,
  ehAdminModuloPuro,
  temAcessoServicoJuntaPuro,
  ehAdminDeAlgumModuloPuro,
};

// ── 6. Pontes Servico (banco) ↔ ServicoJunta (enum) ─────────────────────────

// Converte o código de subTab da UI da Junta para o enum ServicoJunta.
// Só os 4 sub-serviços controlados têm entrada; os demais retornam null
// (= não controlado por sub-serviço nesta etapa).
export const SUBTAB_PARA_SERVICO_JUNTA = {
  CAEE: SERVICOS_JUNTA.CAEE,
  APAE: SERVICOS_JUNTA.APAE,
  AMBULATORIO: SERVICOS_JUNTA.AMBULATORIO,
  ESPECIALIDADES: SERVICOS_JUNTA.ESPECIALIDADES,
};

export function servicoJuntaDoSubTab(subTab) {
  return SUBTAB_PARA_SERVICO_JUNTA[String(subTab || "").toUpperCase()] || null;
}

// Normaliza para lookup robusto a acento/caixa:
// "Ambulatório" -> "ambulatorio", "  CAEE " -> "caee".
export function normalizarNomeServico(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .trim()
    .toLowerCase();
}

// Mapa nome-de-serviço (sem acento, lower) -> enum. Cobre os nomes que o
// MAPA_SERVICOS da página da Junta produz para os 4 controlados.
const NOME_SERVICO_PARA_ENUM = {
  caee: SERVICOS_JUNTA.CAEE,
  apae: SERVICOS_JUNTA.APAE,
  ambulatorio: SERVICOS_JUNTA.AMBULATORIO,
  "centro de especialidades": SERVICOS_JUNTA.ESPECIALIDADES,
};

export function servicoJuntaDoNome(nome) {
  return NOME_SERVICO_PARA_ENUM[normalizarNomeServico(nome)] || null;
}

// Mapa inverso enum -> nome canônico de MAPA_SERVICOS (para filtrar queries
// por `Servico.nome` a partir dos vínculos do usuário).
export const SERVICO_JUNTA_PARA_NOME = {
  [SERVICOS_JUNTA.CAEE]: "CAEE",
  [SERVICOS_JUNTA.APAE]: "APAE",
  [SERVICOS_JUNTA.AMBULATORIO]: "Ambulatório",
  [SERVICOS_JUNTA.ESPECIALIDADES]: "Centro de Especialidades",
};
