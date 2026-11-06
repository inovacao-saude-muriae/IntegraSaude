import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/audit";

const formatarData = (data) => {
  if (!data) return null;
  return new Date(data).toISOString().slice(0, 10);
};

// GET /api/ccz/animais/[id] - obter dados completos de um animal
export async function GET(request, context) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const { params } = context;
    const id = decodeURIComponent(params.id);

    console.log("=== GET /api/ccz/animais/[id] ===");
    console.log("params.id (raw):", params.id);
    console.log("id (decoded):", id);

    if (!id) {
      return NextResponse.json({ error: "ID não informado" }, { status: 400 });
    }

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        tutor: {
          include: {
            pessoa: true,
          },
        },
      },
    });

    console.log("Animal encontrado:", animal ? "SIM" : "NÃO");
    console.log("Animal ID no banco:", animal?.id);

    if (!animal) {
      return NextResponse.json({ error: "Animal não encontrado" }, { status: 404 });
    }

    const dados = {
      id: animal.id,
      nome: animal.nome || "",
      especie: animal.especie || "",
      sexo: animal.sexo === "F" ? "Fêmea" : "Macho",
      porte: animal.porte || "",
      idade: animal.idade || "",
      castrado: animal.castrado || "Não",
      fotoUrl: animal.fotoUrl || "",
      doencaCronica: animal.doencaCronica || "Não",
      apetiteNormal: animal.apetiteNormal || "Normal",
      sintomasVomitoDiarreia: animal.sintomasVomitoDiarreia || "Não",
      emTratamento: animal.emTratamento || "Não",
      qualTratamento: animal.qualTratamento || "",
      observacoes: animal.observacoes || "",
      dataCadastro: formatarData(animal.dataCadastro),
      // Dados do tutor
      tutor: animal.tutor ? {
        cpf: animal.tutor.pessoa?.cpf || "",
        nome: animal.tutor.pessoa?.nomeCompleto || "",
        telefone: animal.tutor.pessoa?.telefone || "",
      } : null,
    };

    return NextResponse.json(dados);
  } catch (error) {
    console.error("Erro ao obter animal:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao carregar animal" },
      { status: 500 }
    );
  }
}

// DELETE /api/ccz/animais/[id] - excluir um animal
export async function DELETE(request, context) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const { params } = context;
    const id = decodeURIComponent(params.id);

    if (!id) {
      return NextResponse.json({ error: "ID não informado" }, { status: 400 });
    }

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        procedimentos: true,
        esporotricoses: true,
      },
    });

    if (!animal) {
      return NextResponse.json({ error: "Animal não encontrado" }, { status: 404 });
    }

    // Verifica se há registros vinculados
    const temRegistros = 
      (animal.procedimentos && animal.procedimentos.length > 0) ||
      (animal.esporotricoses && animal.esporotricoses.length > 0);

    if (temRegistros) {
      const totalRegistros = 
        (animal.procedimentos?.length || 0) +
        (animal.esporotricoses?.length || 0);
      
      return NextResponse.json(
        { error: `Não é possível excluir este animal pois existem ${totalRegistros} registro(s) vinculado(s) (procedimentos ou esporotricose)` },
        { status: 400 }
      );
    }

    // Remove o animal
    await prisma.animal.delete({
      where: { id },
    });

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "CCZ",
      entidade: "Animal",
      entidadeId: id,
      descricao: `Animal '${animal.nome || id}' excluído`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir animal:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao excluir animal" },
      { status: 500 }
    );
  }
}
