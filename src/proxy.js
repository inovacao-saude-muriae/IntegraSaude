import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ═══════════════════════════════════════════════════════════════════════════
// PROXY — SÓ AUTENTICAÇÃO (RBAC Etapa 1)
// ─────────────────────────────────────────────────────────────────────────
// Next 16 renomeou a convenção `middleware.js` -> `proxy.js` (export `proxy`).
// O proxy pode ser deployado em CDN e NÃO deve depender de módulos/globais
// compartilhados: por isso faz APENAS jwtVerify com `jose` (edge-compatible),
// SEM Prisma. A AUTORIZAÇÃO de módulo foi movida para os layout.js de cada
// módulo (Server Components, perto da fonte de dados), conforme o guia do Next:
// "o proxy não deve ser a única linha de defesa".
// ═══════════════════════════════════════════════════════════════════════════

export async function proxy(request) {
  const token = request.cookies.get("session_token")?.value;
  const { pathname } = request.nextUrl;

  // ─────────────────────────────────────────────────────────────────────────
  // ROTAS PÚBLICAS (sem autenticação) — early-return PRESERVADO do middleware.
  // O matcher NÃO exclui /api; a liberação é feita aqui no corpo. Remover este
  // bloco faria o proxy redirecionar chamadas /api sem token para /login.
  // ─────────────────────────────────────────────────────────────────────────
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/acesso-negado"
  ) {
    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEM TOKEN → login (preservando o destino em ?redirect=).
  // ─────────────────────────────────────────────────────────────────────────
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOKEN VÁLIDO → segue; inválido/expirado → login + limpa cookie.
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Identidade propagada por headers (consumo opcional; a autorização NÃO
    // depende deles — ela acontece nos layouts/actions com acesso ao Prisma).
    const requestHeaders = new Headers(request.headers);
    // Só identidade. Não existe mais `x-user-role`: o JWT não carrega perfil
    // (users.role removido) e a autorização é decidida por vínculo de módulo
    // nas guardas do servidor — nunca por header.
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-name", payload.nome || "Usuário");

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (error) {
    console.error("[Proxy] Erro ao verificar token:", error.message);

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    loginUrl.searchParams.set("error", "session_expired");

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("session_token");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|img).*)"],
};
