import { NextResponse } from "next/server";
import { carregarSessao } from "@/lib/auth";
import { obterContextoEfetivo, MODULOS } from "@/lib/permissions";
import { MODULOS_CATALOGO, PERFIS_INFO } from "@/lib/permissoesCatalogo";

// ═══════════════════════════════════════════════════════════════════════════
// /api/me — contexto efetivo de acesso do usuário autenticado
// ─────────────────────────────────────────────────────────────────────────
// A sessão vem da fonte única (lib/auth): cookie presente, sessão registrada no
// banco, não expirada e usuário ativo.
//
// Devolve o que o usuário PODE fazer, já decidido no servidor:
//   • módulos com vínculo ativo, com perfis, escopo e serviços;
//   • permissões efetivas por módulo (formato "funcionalidade:permissao");
//   • a lista plana de permissões, para checagens rápidas na interface.
//
// A Sidebar e as telas NÃO recalculam nada: só consomem isto. Vínculo inativo,
// perfil desconhecido ou escopo contraditório ficam de fora (fail-closed).
// `role`/`isGestor` continuam sendo servidos apenas para compatibilidade com
// componentes antigos — nada mais decide acesso por eles, e saem junto com os
// 12 perfis legados.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const ctx = await carregarSessao();
    if (!ctx) {
      return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });
    }

    const user = ctx.user;
    const efetivo = await obterContextoEfetivo(user);

    const modulos = Object.values(efetivo.modulos).map((m) => ({
      modulo: m.modulo,
      nome: MODULOS_CATALOGO[m.modulo]?.nome || m.modulo,
      perfis: m.perfis,
      perfisNome: m.perfis.map((p) => PERFIS_INFO[p]?.nome || p),
      escopo: m.escopo,
      servicos: m.servicos,
      permissoes: m.permissoes,
    }));

    return NextResponse.json(
      {
        user: {
          id: user.cpf, // CPF como identificador (compatibilidade com o frontend)
          nomeCompleto: user.nome,
          cpf: user.cpf,
          cargo: user.cargo || null,
          primeiroAcesso: user.primeiroAcesso ?? false,

          // ── Contexto efetivo (fonte da UI) ──
          modulos,
          permissoes: efetivo.permissoes,
          // Atalho booleano para "pode ser concedido/acessado": Gestão Geral.
          gestaoGeral: modulos.some((m) => m.modulo === MODULOS.GESTAO),

          // ── Compatibilidade (sai com os perfis legados) ──
          // role: valor legado, mantido só enquanto houver componente lendo.
          role: user.role,
          // isGestor: passou a significar "tem o vínculo de Gestão Geral" e
          // NÃO libera módulo nenhum por si (a Sidebar checa `modulos`).
          isGestor: modulos.some((m) => m.modulo === MODULOS.GESTAO),
          acessos: (user.acessos || []).map((a) => ({
            modulo: a.modulo,
            nivel: a.nivel,
            servicoJunta: a.servicoJunta,
          })),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erro na rota /api/me:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
