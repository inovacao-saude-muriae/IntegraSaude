import { NextResponse } from "next/server";
import { requireAcessoModulo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MODULOS } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/audit";

export async function POST(req) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const { animalId, tipo, data, observacao } = await req.json();

    if (!animalId || !tipo || !data) {
      return NextResponse.json(
        { success: false, error: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Verify animal exists
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, nome: true },
    });

    if (!animal) {
      return NextResponse.json(
        { success: false, error: "Animal não encontrado" },
        { status: 404 }
      );
    }

    // Generate unique ID for the procedure
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    const procedimentoId = `P-${timestamp}-${random}`.toUpperCase();

    // Create procedure record
    const procedimento = await prisma.cadastroProcedimento.create({
      data: {
        id: procedimentoId,
        animalId,
        tipo,
        dataProcedimento: new Date(data),
        status: "Agendado",
        descricao: observacao || null,
      },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "CCZ",
      entidade: "Procedimento",
      entidadeId: procedimento.id,
      descricao: `Procedimento '${procedimento.tipo}' agendado (animal ${procedimento.animalId})`,
      detalhes: { tipo: procedimento.tipo },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: procedimento.id,
        animalId: procedimento.animalId,
        tipo: procedimento.tipo,
        data: procedimento.dataProcedimento.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar agendamento" },
      { status: 500 }
    );
  }
}
