import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoPessoas } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

/**
 * GET /api/pessoas?q=searchTerm
 * Search pessoas by name or CPF for SWR caching
 */
export async function GET(req) {
  try {
    await requireAcessoPessoas();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const searchTerm = q.trim();
    const where = {
      ativo: true,
      OR: [
        { nomeCompleto: { contains: searchTerm, mode: "insensitive" } },
        { cpf: { contains: searchTerm } },
      ],
    };

    const pessoas = await prisma.pessoa.findMany({
      where,
      take: 20,
      orderBy: { nomeCompleto: "asc" },
      select: {
        cpf: true,
        nomeCompleto: true,
        dataNascimento: true,
        nomeMae: true,
        telefone: true,
        cns: true,
        sexo: true,
        ubsReferencia: {
          select: {
            id: true,
            nome: true,
            cnes: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: pessoas });
  } catch (error) {
    console.error("[GET /api/pessoas]", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar pessoas" },
      { status }
    );
  }
}

/**
 * POST /api/pessoas
 * Create a new pessoa record
 */
export async function POST(req) {
  try {
    const user = await requireAcessoPessoas();

    const body = await req.json();
    const {
      cpf,
      nomeCompleto,
      sexo,
      dataNascimento,
      nomeMae,
      telefone,
      cns,
      ubsReferenciaId,
      endereco,
    } = body;

    // Validate required fields
    if (!cpf || !nomeCompleto || !sexo || !dataNascimento || !nomeMae || !telefone) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios faltando" },
        { status: 400 }
      );
    }

    // Check if CPF already exists
    const existing = await prisma.pessoa.findUnique({ where: { cpf } });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: existing.ativo
            ? "CPF já cadastrado"
            : "CPF pertence a um cadastro que foi unificado em outro",
        },
        { status: 409 }
      );
    }

    // Create pessoa with optional endereco
    const data = {
      cpf,
      nomeCompleto,
      sexo,
      dataNascimento: new Date(dataNascimento),
      nomeMae,
      telefone,
      cns: cns || null,
      ubsReferenciaId: ubsReferenciaId || null,
    };

    if (endereco) {
      data.enderecos = {
        create: {
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          complemento: endereco.complemento || null,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          uf: endereco.uf,
          cep: endereco.cep || null,
          enderecoAtual: true,
        },
      };
    }

    const pessoa = await prisma.pessoa.create({
      data,
      include: {
        enderecos: true,
        ubsReferencia: true,
      },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "GERENCIAMENTO",
      entidade: "Pessoa",
      entidadeId: String(pessoa.cpf),
      descricao: `Pessoa '${pessoa.nomeCompleto}' cadastrada`,
    });

    return NextResponse.json({ success: true, data: pessoa });
  } catch (error) {
    console.error("[POST /api/pessoas]", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao criar pessoa" },
      { status }
    );
  }
}
