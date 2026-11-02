import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";

export async function GET(request, context) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const params = await context.params;
    const { id } = params;

    console.log("Buscando zoonose com ID:", id);

    const zoonose = await prisma.cadastroZoonoses.findUnique({
      where: { id },
      include: {
        animal: {
          include: {
            tutor: {
              include: {
                pessoa: {
                  include: {
                    enderecos: {
                      where: { enderecoAtual: true },
                      take: 1
                    }
                  }
                }
              }
            }
          }
        },
      },
    });

    if (!zoonose) {
      console.log("Zoonose não encontrada:", id);
      return NextResponse.json(
        { error: "Zoonose não encontrada" },
        { status: 404 }
      );
    }

    console.log("Zoonose encontrada:", zoonose.id);

    const formatarData = (data) => {
      if (!data) return null;
      return new Date(data).toISOString().split("T")[0];
    };

    const a = zoonose.animal || null;
    const tutorPessoa = a?.tutor?.pessoa || null;
    const enderecoPrincipal = tutorPessoa?.enderecos?.[0] || null;

    // Formatar endereço completo
    let enderecoFormatado = "";
    if (enderecoPrincipal) {
      const partes = [];
      if (enderecoPrincipal.logradouro) partes.push(enderecoPrincipal.logradouro);
      if (enderecoPrincipal.numero) partes.push(`nº ${enderecoPrincipal.numero}`);
      if (enderecoPrincipal.bairro) partes.push(enderecoPrincipal.bairro);
      if (enderecoPrincipal.cidade) partes.push(enderecoPrincipal.cidade);
      if (enderecoPrincipal.uf) partes.push(enderecoPrincipal.uf);
      enderecoFormatado = partes.join(", ");
    }

    const dados = {
      id: zoonose.id,
      animalId: zoonose.animalId,
      tutorNome: tutorPessoa?.nomeCompleto || "",
      animal: a ? {
        id: a.id,
        nome: a.nome,
        especie: a.especie,
        fotoUrl: a.fotoUrl,
      } : null,
      tutor: tutorPessoa ? {
        nome: tutorPessoa.nomeCompleto || "",
        cpf: tutorPessoa.cpf || "",
        telefone: tutorPessoa.telefone || "",
        endereco: enderecoFormatado || "",
      } : null,
      doenca: zoonose.doenca,
      dataIdentificacao: formatarData(zoonose.dataIdentificacao),
      grauRisco: zoonose.grauRisco,
      riscoVida: zoonose.riscoVida,
      formasContaminacao: zoonose.formasContaminacao,
      periodoMonitoramento: zoonose.periodoMonitoramento,
      dataAgendamento: formatarData(zoonose.dataAgendamento),
      responsavelMonitoramento: zoonose.responsavelMonitoramento,
      observacao: zoonose.observacao,
    };

    return NextResponse.json(dados);
  } catch (error) {
    console.error("Erro ao buscar zoonose:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar zoonose" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const params = await context.params;
    const { id } = params;

    console.log("Excluindo zoonose com ID:", id);

    const zoonose = await prisma.cadastroZoonoses.findUnique({
      where: { id },
    });

    if (!zoonose) {
      return NextResponse.json(
        { error: "Zoonose não encontrada" },
        { status: 404 }
      );
    }

    await prisma.cadastroZoonoses.delete({
      where: { id },
    });

    console.log("Zoonose excluída com sucesso:", id);

    return NextResponse.json({ 
      success: true,
      message: "Zoonose excluída com sucesso" 
    });
  } catch (error) {
    console.error("Erro ao excluir zoonose:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao excluir zoonose" },
      { status: 500 }
    );
  }
}
