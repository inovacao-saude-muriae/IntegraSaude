import { NextResponse } from "next/server";
import { requireGestor } from "@/lib/auth";
import { buscarUsuarios } from "@/lib/auditoriaRelatorio";

export async function GET(req) {
  try {
    await requireGestor();
    const { searchParams } = new URL(req.url);
    const usuarios = await buscarUsuarios(searchParams.get("q"));
    return NextResponse.json({ usuarios });
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao buscar usuários para auditoria:", error);
    return NextResponse.json(
      { error: "Erro ao buscar usuários" },
      { status: 500 },
    );
  }
}
