import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whereSituacaoPessoa } from "@/lib/situacaoPessoa";
import { usuarioDaSessao, requireAcessoPessoas } from "@/lib/auth";
import { MODULOS, usuarioTemPermissao } from "@/lib/permissions";

/**
 * GET /api/pessoas/buscar?termo=searchTerm
 * Search pessoas by name or CPF (alternative endpoint for legacy code)
 */
export async function GET(req) {
  try {
    // Quem opera Processos (Câmara Técnica) também busca o paciente no
    // cadastro único: a tela de Processos Cirúrgicos usa este endpoint.
    const sessao = await usuarioDaSessao();
    const podePorProcessos =
      sessao &&
      (await usuarioTemPermissao(
        sessao,
        MODULOS.PROCESSOS,
        "processo_judicial",
        "visualizar",
      ));
    if (!podePorProcessos) await requireAcessoPessoas();

    const { searchParams } = new URL(req.url);
    const termo = searchParams.get("termo");

    if (!termo || termo.trim().length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const searchTerm = termo.trim();
    // CPF é procurado pelos dígitos (o cadastro único guarda só números), para
    // que a busca aceite "910.000.009-40" e "91000000940".
    const digitos = searchTerm.replace(/\D/g, "");
    // Busca de pessoas para NOVOS registros: só situação ATIVA e não unificadas.
    const where = {
      ...whereSituacaoPessoa("ativos"),
      unificadoEmCpf: null,
      OR: [
        { nomeCompleto: { contains: searchTerm, mode: "insensitive" } },
        ...(digitos.length >= 3 ? [{ cpf: { contains: digitos } }] : []),
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
        numeroPasta: true,
        ubsReferencia: {
          select: {
            id: true,
            nome: true,
            cnes: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, results: pessoas });
  } catch (error) {
    console.error("[GET /api/pessoas/buscar]", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar pessoas" },
      { status }
    );
  }
}
