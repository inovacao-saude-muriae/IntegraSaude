import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { exigenciaDeModulo } from "@/lib/mapaRotasModulos";
import { contextoDeModulos } from "@/lib/contextoProxy";

// ═══════════════════════════════════════════════════════════════════════════
// PROXY — PROTEÇÃO DE ENTRADA
// ─────────────────────────────────────────────────────────────────────────
// Next 16 renomeou a convenção `middleware.js` -> `proxy.js` (export `proxy`).
//
// Três camadas, uma fonte de verdade:
//
//   proxy    → sessão válida + vínculo com o módulo da rota   (aqui)
//   layouts  → a mesma regra, perto dos dados                 (AcessoNegadoModulo)
//   backend  → requirePermissao / temPermissaoPura            (lib/auth.js)
//
// O proxy NÃO tem lista própria de permissões: usa `lib/mapaRotasModulos`
// (rota → módulo, projeção da árvore de rotas) e `lib/contextoProxy`
// (módulos do usuário, lidos de `user_acessos` — a mesma fonte de
// `lib/permissions.js`). Revogar um vínculo ou desativar a conta vale já na
// requisição seguinte: nada de permissão "congelada" em JWT/cookie.
//
// O proxy NÃO substitui `requirePermissao`: quem decide se a pessoa pode
// EXCLUIR, EDITAR ou CANCELAR continua sendo o backend, por funcionalidade e
// permissão do catálogo.
//
// Rotas públicas passam direto. `/api` não é autorizada aqui (cada rota
// responde 401/403 sozinha), mas passa pela checagem de PRIMEIRO ACESSO.
//
// PRIMEIRO ACESSO (regra única, para todos os módulos):
//   users.primeiro_acesso = true  →  só /trocar-senha, /login, logout e as
//   rotas de sessão (/api/me). Qualquer outra página é redirecionada para
//   /trocar-senha, e qualquer outra API responde 403. A checagem vem do banco
//   (`contextoDeModulos`), nunca do JWT, e termina no instante em que a troca
//   é gravada.
// ═══════════════════════════════════════════════════════════════════════════

const ROTAS_PUBLICAS = ["/login", "/acesso-negado"];

// A única página liberada enquanto a troca de senha obrigatória está pendente.
// (A lista oficial fica em lib/auth — ROTAS_PRIMEIRO_ACESSO —, mas o proxy não
// importa lib/auth para não arrastar `next/headers`/Prisma para o bundle do
// proxy; a regra é a mesma e há teste cobrindo as duas.)
function ehRotaDeTrocaDeSenha(pathname) {
  const limpo = String(pathname || "").split("?")[0].split("#")[0];
  return limpo === "/trocar-senha" || limpo.startsWith("/trocar-senha/");
}

function ehPublica(pathname) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    ROTAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

function irParaLogin(request, pathname, extra = {}) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  for (const [k, v] of Object.entries(extra)) loginUrl.searchParams.set(k, v);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request) {
  const token = request.cookies.get("session_token")?.value;
  const { pathname } = request.nextUrl;

  // ── 1. Públicas: seguem sem intervenção ────────────────────────────────
  if (ehPublica(pathname)) return NextResponse.next();

  // A API não é autorizada pelo proxy: cada rota decide com as próprias
  // guardas (requirePermissao). O bloqueio do primeiro acesso na API é feito
  // por essas guardas (ver lib/auth), não aqui.
  if (pathname.startsWith("/api")) return NextResponse.next();

  // ── 2. Sem token → login (páginas) / 401 (API) ─────────────────────────
  // (O matcher não exclui /api; a liberação é feita aqui para que o proxy não
  // redirecione chamadas de API sem token para /login.)
  if (!token) return irParaLogin(request, pathname);

  // ── 3. Token válido → identidade propagada (nunca autorização) ─────────
  let payload;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    ({ payload } = await jwtVerify(token, secret));
  } catch (error) {
    console.error("[Proxy] Erro ao verificar token:", error.message);
    const response = irParaLogin(request, pathname, { error: "session_expired" });
    response.cookies.delete("session_token");
    return response;
  }

  const headers = new Headers(request.headers);
  headers.set("x-user-id", payload.userId);
  headers.set("x-user-name", payload.nome || "Usuário");

  // ── 4. Contexto do banco: conta ativa, vínculos e primeiro acesso ──────
  let contexto;
  try {
    contexto = await contextoDeModulos(payload.userId);
  } catch (error) {
    // Banco fora do ar: não libera nada por "otimismo" (fail-closed).
    console.error("[Proxy] Erro ao carregar vínculos:", error.message);
    return new NextResponse(
      "Não foi possível verificar o seu acesso agora. Tente novamente em instantes.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  // Conta desativada/sem usuário: sessão não vale mais.
  if (!contexto.ativo) {
    const response = irParaLogin(request, pathname, { error: "session_expired" });
    response.cookies.delete("session_token");
    return response;
  }

  // ── 5. PRIMEIRO ACESSO: só a troca de senha (e a sessão) é liberada ────
  // Regra única, válida para qualquer módulo e para qualquer URL digitada
  // à mão. Nunca redireciona /trocar-senha para ela mesma (sem loop).
  if (contexto.primeiroAcesso) {
    if (ehRotaDeTrocaDeSenha(pathname)) {
      return NextResponse.next({ request: { headers } });
    }
    const url = new URL("/trocar-senha", request.url);
    return NextResponse.redirect(url);
  }

  // ── 7. Rota sem módulo (dashboard, trocar-senha, raiz): só sessão ──────
  const { exigencia, mapeada } = exigenciaDeModulo(pathname);
  if (!exigencia) {
    // Rota não mapeada: o proxy não inventa regra. A proteção continua nos
    // layouts do módulo e nas guardas do backend.
    if (!mapeada) {
      console.warn(`[Proxy] Rota sem módulo no mapa: ${pathname}`);
    }
    return NextResponse.next({ request: { headers } });
  }

  // ── 8. Autorização de ENTRADA por módulo (fonte: user_acessos) ─────────

  const permitido = exigencia.modulos.some((m) => contexto.modulos.includes(m));
  if (!permitido) {
    // 403 real, sem dado nenhum no corpo, sem ciclo de redirect (a página de
    // acesso negado é pública e não passa por esta checagem).
    const url = new URL("/acesso-negado", request.url);
    url.searchParams.set("rota", pathname);
    url.searchParams.set("modulo", exigencia.modulos.join(" ou "));
    return NextResponse.rewrite(url, { status: 403 });
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|img).*)"],
};
