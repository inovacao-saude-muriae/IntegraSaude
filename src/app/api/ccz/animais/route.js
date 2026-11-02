import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";

/**
 * GET /api/ccz/animais?q=searchTerm
 * Search animals by name or ID for SWR caching
 */
export async function GET(req) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    const where = {};
    if (q && q.trim().length > 0) {
      where.OR = [
        { nome: { contains: q.trim(), mode: "insensitive" } },
        { id: { contains: q.trim(), mode: "insensitive" } },
      ];
    }

    const animais = await prisma.animal.findMany({
      where,
      take: 20,
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        especie: true,
        sexo: true,
        porte: true,
        idade: true,
        fotoUrl: true,
        possuiResponsavel: true,
        tutor: {
          select: {
            pessoa: {
              select: {
                cpf: true,
                nomeCompleto: true,
                telefone: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: animais });
  } catch (error) {
    console.error("[GET /api/ccz/animais]", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar animais" },
      { status }
    );
  }
}
