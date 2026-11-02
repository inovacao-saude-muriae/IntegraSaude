import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";

/**
 * GET /api/junta-reguladora/servicos
 * Returns all active Junta Reguladora services for SWR caching
 */
export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.JUNTA);

    const servicos = await prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        descricao: true,
        ativo: true,
      },
    });

    return NextResponse.json({ success: true, data: servicos });
  } catch (error) {
    console.error("[GET /api/junta-reguladora/servicos]", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar serviços" },
      { status }
    );
  }
}
