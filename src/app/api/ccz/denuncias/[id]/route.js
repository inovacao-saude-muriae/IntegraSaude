import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";

export async function GET(request, context) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const params = await context.params;
    const { id } = params;

    const denuncia = await prisma.denunciaCaoAgressivo.findUnique({
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

    if (!denuncia) {
      return NextResponse.json(
        { error: "Denúncia não encontrada" },
        { status: 404 }
      );
    }

    const formatarData = (data) => {
      if (!data) return null;
      return new Date(data).toISOString().split("T")[0];
    };

    const a = denuncia.animal || null;
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
      id: denuncia.id,
      dataDenuncia: formatarData(denuncia.dataDenuncia),
      animalId: denuncia.animalId,
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
      cep: denuncia.cep,
      logradouro: denuncia.logradouro,
      numero: denuncia.numero,
      complemento: denuncia.complemento,
      bairro: denuncia.bairro,
      cidade: denuncia.cidade,
      uf: denuncia.uf,
      pontoReferencia: denuncia.pontoReferencia,
      descricaoCao: denuncia.descricaoCao,
      relato: denuncia.relato,
      causouRisco: denuncia.causouRisco,
    };

    return NextResponse.json(dados);
  } catch (error) {
    console.error("Erro ao buscar denúncia:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar denúncia" },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const params = await context.params;
    const { id } = params;
    const dados = await request.json();

    delete dados.id;

    const denuncia = await prisma.denunciaCaoAgressivo.update({
      where: { id },
      data: dados,
      include: {
        animal: true,
      },
    });

    return NextResponse.json(denuncia);
  } catch (error) {
    console.error("Erro ao atualizar denúncia:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar denúncia" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const params = await context.params;
    const { id } = params;

    const denuncia = await prisma.denunciaCaoAgressivo.findUnique({
      where: { id },
    });

    if (!denuncia) {
      return NextResponse.json(
        { error: "Denúncia não encontrada" },
        { status: 404 }
      );
    }

    await prisma.denunciaCaoAgressivo.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true,
      message: "Denúncia excluída com sucesso" 
    });
  } catch (error) {
    console.error("Erro ao excluir denúncia:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao excluir denúncia" },
      { status: 500 }
    );
  }
}
