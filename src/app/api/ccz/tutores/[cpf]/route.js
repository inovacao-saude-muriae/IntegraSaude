import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/audit";

// GET /api/ccz/tutores/[cpf] - obter dados completos de um tutor
export async function GET(request, context) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const params = await context.params;
    const cpf = params.cpf;

    if (!cpf) {
      return NextResponse.json({ error: "CPF não informado" }, { status: 400 });
    }

    const tutor = await prisma.tutor.findUnique({
      where: { pessoaCpf: cpf },
      include: {
        pessoa: {
          include: {
            enderecos: {
              where: { enderecoAtual: true },
              take: 1,
            },
          },
        },
        animais: {
          orderBy: { dataCadastro: "desc" },
        },
      },
    });

    if (!tutor) {
      return NextResponse.json({ error: "Tutor não encontrado" }, { status: 404 });
    }

    const endereco = tutor.pessoa?.enderecos?.[0] || null;

    const dados = {
      cpf: tutor.pessoa?.cpf || "",
      nomeCompleto: tutor.pessoa?.nomeCompleto || "",
      sexo: tutor.pessoa?.sexo || "",
      dataNascimento: tutor.pessoa?.dataNascimento || null,
      nomeMae: tutor.pessoa?.nomeMae || "",
      telefone: tutor.pessoa?.telefone || "",
      cns: tutor.pessoa?.cns || "",
      // Endereço
      logradouro: endereco?.logradouro || "",
      numero: endereco?.numero || "",
      complemento: endereco?.complemento || "",
      bairro: endereco?.bairro || "",
      cidade: endereco?.cidade || "",
      uf: endereco?.uf || "",
      cep: endereco?.cep || "",
      // Dados do tutor
      rg: tutor.rg || "",
      profissao: tutor.profissao || "",
      telefoneSecundario: tutor.telefoneSecundario || "",
      pontoReferencia: tutor.pontoReferencia || "",
      observacoes: tutor.observacoes || "",
      // Animais vinculados
      animais: (tutor.animais || []).map((a) => ({
        id: a.id,
        nome: a.nome || "Sem nome",
        especie: a.especie || "",
        sexo: a.sexo === "F" ? "Fêmea" : "Macho",
        porte: a.porte || "",
        idade: a.idade || "",
        castrado: a.castrado || "Não",
        fotoUrl: a.fotoUrl || "",
      })),
    };

    return NextResponse.json(dados);
  } catch (error) {
    console.error("Erro ao obter tutor:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao carregar tutor" },
      { status: 500 }
    );
  }
}

// DELETE /api/ccz/tutores/[cpf] - excluir um tutor
export async function DELETE(request, context) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const params = await context.params;
    const cpf = params.cpf;

    if (!cpf) {
      return NextResponse.json({ error: "CPF não informado" }, { status: 400 });
    }

    // Verifica se o tutor possui animais vinculados
    const tutor = await prisma.tutor.findUnique({
      where: { pessoaCpf: cpf },
      include: {
        animais: true,
      },
    });

    if (!tutor) {
      return NextResponse.json({ error: "Tutor não encontrado" }, { status: 404 });
    }

    if (tutor.animais && tutor.animais.length > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir este tutor pois existem ${tutor.animais.length} animal(is) vinculado(s)` },
        { status: 400 }
      );
    }

    // Remove o tutor
    await prisma.tutor.delete({
      where: { pessoaCpf: cpf },
    });

    await registrarAuditoria({
      user,
      acao: "EXCLUIR",
      modulo: "CCZ",
      entidade: "Tutor",
      entidadeId: cpf,
      descricao: "Tutor excluído",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir tutor:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao excluir tutor" },
      { status: 500 }
    );
  }
}
