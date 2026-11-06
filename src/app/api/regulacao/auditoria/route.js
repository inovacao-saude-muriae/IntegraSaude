import { NextResponse } from "next/server";
import { requireGestor } from "@/lib/auth";
import { consultarAuditoriaRegulacao } from "@/lib/auditoriaRegulacao";

// Relatório de auditoria da Regulação. SOMENTE GESTOR (401 sem sessão, 403 demais).
export async function GET(req) {
  try {
    const gestor = await requireGestor();
    const { searchParams } = new URL(req.url);
    const resultado = await consultarAuditoriaRegulacao(
      {
        de: searchParams.get("de") || "",
        ate: searchParams.get("ate") || "",
        usuario: searchParams.get("usuario") || "",
        acao: searchParams.get("acao") || "",
        entidade: searchParams.get("entidade") || "",
        q: searchParams.get("q") || "",
        page: searchParams.get("page"),
        pageSize: searchParams.get("pageSize"),
        exportar: searchParams.get("export") === "1",
      },
      { nome: gestor.nome },
    );
    return NextResponse.json(resultado, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if ([400, 401, 403].includes(error?.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao consultar auditoria da Regulação:", error);
    return NextResponse.json(
      { error: "Erro ao consultar auditoria" },
      { status: 500 },
    );
  }
}
