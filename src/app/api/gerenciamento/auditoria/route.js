import { NextResponse } from "next/server";
import { requirePermissaoGestao } from "@/lib/auth";
import { consultarAuditoriaUsuario } from "@/lib/auditoriaRelatorio";

export async function GET(req) {
  try {
    await requirePermissaoGestao("auditoria", "visualizar");
    const { searchParams } = new URL(req.url);
    const resultado = await consultarAuditoriaUsuario({
      cpf: searchParams.get("cpf"),
      modulo: searchParams.get("modulo") || "",
      dataInicio: searchParams.get("dataInicio") || "",
      dataFim: searchParams.get("dataFim") || "",
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });
    return NextResponse.json(resultado);
  } catch (error) {
    if ([400, 401, 403, 404].includes(error?.status)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao consultar auditoria do usuário:", error);
    return NextResponse.json(
      { error: "Erro ao consultar auditoria" },
      { status: 500 },
    );
  }
}
