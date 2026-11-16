import { NextResponse } from "next/server";
import { requirePermissaoGestao } from "@/lib/auth";
import { servicosDoCatalogo } from "@/lib/acessoService";
import {
  MODULOS_CATALOGO,
  PERFIS,
  PERFIS_INFO,
  ESCOPOS,
  ESCOPOS_INFO,
  PERMISSOES_INFO,
  permissoesPadrao,
} from "@/lib/permissoesCatalogo";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/gerenciamento/permissoes/catalogo
// ─────────────────────────────────────────────────────────────────────────
// Entrega à tela de gerenciamento TUDO o que ela precisa para montar a
// configuração de um vínculo, vindo do catálogo central — a interface não
// redigita módulo, perfil, serviço nem permissão.
//
// Só Gestão Geral acessa (é a tela que concede acesso).
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    await requirePermissaoGestao("acessos", "visualizar");

    // Serviços por módulo: vêm do BANCO (junta_servicos), não do código.
    // `servicos` = existentes (inclui inativos, para o vínculo antigo seguir
    // identificável); `ativos` = os que podem receber atribuição nova.
    const catalogoServicos = {};
    for (const m of Object.values(MODULOS_CATALOGO)) {
      if (!m.escopoServico) continue;
      const { porId, ativos } = await servicosDoCatalogo(m.chave);
      catalogoServicos[m.chave] = {
        servicos: [...porId.values()].map((s) => ({
          id: String(s.id),
          nome: s.nome,
          ativo: s.ativo,
        })),
        ativos: ativos.map((v) => String(v)),
      };
    }

    const modulos = Object.values(MODULOS_CATALOGO).map((m) => ({
      chave: m.chave,
      nome: m.nome,
      // `escopoServico` continua dizendo SE o módulo tem escopo por serviço;
      // a lista concreta vem de `servicosDoModulo`.
      escopoServico: m.escopoServico ? Object.keys(m.escopoServico) : null,
      servicosDoModulo: catalogoServicos[m.chave] || null,
      administracao: !!m.administracao,
      funcionalidades: m.funcionalidades.map((f) => ({
        chave: f.chave,
        nome: f.nome,
        permissoes: f.permissoes.map((p) => ({
          chave: p,
          nome: PERMISSOES_INFO[p] || p,
        })),
      })),
      // Pacote padrão de cada perfil dentro deste módulo.
      pacotes: Object.values(PERFIS).reduce((acc, p) => {
        acc[p] = permissoesPadrao(m.chave, p);
        return acc;
      }, {}),
    }));

    return NextResponse.json({
      modulos,
      perfis: Object.values(PERFIS).map((p) => ({
        chave: p,
        nome: PERFIS_INFO[p]?.nome || p,
        descricao: PERFIS_INFO[p]?.descricao || null,
      })),
      escopos: Object.values(ESCOPOS).map((e) => ({
        chave: e,
        nome: ESCOPOS_INFO[e].nome,
        descricao: ESCOPOS_INFO[e].descricao,
      })),
    });
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao carregar catálogo de permissões:", error);
    return NextResponse.json(
      { error: "Erro ao carregar o catálogo de permissões." },
      { status: 500 },
    );
  }
}
