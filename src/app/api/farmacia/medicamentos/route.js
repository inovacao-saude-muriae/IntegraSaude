import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";

/**
 * GET /api/farmacia/medicamentos
 * Returns all active medications for SWR caching
 */
export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.FARMACIA);

    const medicamentos = await prisma.medicamento.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        tipo: true,
        dosagem: true,
        ativo: true,
      },
    });

    return NextResponse.json({ success: true, data: medicamentos });
  } catch (error) {
    console.error("[GET /api/farmacia/medicamentos]", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar medicamentos" },
      { status }
    );
  }
}
