import { NextResponse } from "next/server";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.REGULACAO);

    const medicos = await prisma.medico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        crm: true,
        ufCrm: true,
        especialidade: true,
        tipo: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: medicos.map((m) => ({
        id: m.id,
        nome: m.nome,
        crm: m.crm,
        ufCrm: m.ufCrm,
        especialidade: m.especialidade,
        tipo: m.tipo || "Solicitante",
      })),
    });
  } catch (error) {
    console.error("Erro ao buscar médicos:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar médicos" },
      { status: 500 }
    );
  }
}
