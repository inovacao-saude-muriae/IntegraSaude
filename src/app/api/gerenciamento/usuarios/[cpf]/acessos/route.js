import { NextResponse } from "next/server";
import { requireGestor } from "@/lib/auth";
import {
  AcessoErro,
  listarAcessosUsuario,
  salvarAcessosUsuario,
} from "@/lib/acessoService";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════════════
// /api/gerenciamento/usuarios/[cpf]/acessos
// ─────────────────────────────────────────────────────────────────────────
// GET  → configuração de acesso do usuário, RELIDA DO BANCO (é o que a tela
//        mostra depois de salvar — nunca estado local).
// PUT  → grava o estado final desejado: módulo que não vem na lista perde o
//        vínculo. Valida catálogo, escopo, poder de concessão, autoelevação,
//        audita e devolve o que ficou persistido.
//
// Só Gestão Geral. A autoridade é sempre do servidor: a tela pode ser burlada
// que a resposta continua sendo as mesmas regras.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request, context) {
  try {
    await requireGestor();
    const { cpf } = await context.params;
    const dados = await listarAcessosUsuario(cpf);
    return NextResponse.json({ success: true, ...dados });
  } catch (error) {
    if (error instanceof AcessoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao ler acessos do usuário:", error);
    return NextResponse.json({ error: "Erro ao ler os acessos do usuário." }, { status: 500 });
  }
}

export async function PUT(request, context) {
  try {
    const executor = await requireGestor();
    const { cpf } = await context.params;

    let corpo = {};
    try {
      corpo = await request.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    if (!Array.isArray(corpo?.vinculos)) {
      return NextResponse.json(
        { error: "Envie a lista completa de vínculos (módulo a módulo)." },
        { status: 400 },
      );
    }

    const resultado = await salvarAcessosUsuario({
      cpf,
      vinculos: corpo.vinculos,
      executor,
      motivo: corpo.motivo,
    });

    return NextResponse.json({ success: true, message: "Acessos salvos.", ...resultado });
  } catch (error) {
    if (error instanceof AcessoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao salvar acessos do usuário:", error);
    return NextResponse.json({ error: "Erro ao salvar os acessos do usuário." }, { status: 500 });
  }
}

// DELETE → remove o vínculo de UM módulo (atalho da tela: "sem acesso").
export async function DELETE(request, context) {
  try {
    const executor = await requireGestor();
    const { cpf } = await context.params;
    const { searchParams } = new URL(request.url);
    const modulo = searchParams.get("modulo");
    if (!modulo) {
      return NextResponse.json({ error: "Informe o módulo." }, { status: 400 });
    }

    const atuais = await prisma.userAcesso.findMany({
      where: { userCpf: String(cpf).replace(/\D/g, "") },
      select: { modulo: true },
    });
    const restantes = atuais.map((a) => a.modulo).filter((m) => m !== modulo);

    // Reaproveita a gravação completa: ela remove o que não veio.
    const existentes = await prisma.userAcesso.findMany({
      where: { userCpf: String(cpf).replace(/\D/g, ""), modulo: { in: restantes } },
      select: {
        modulo: true,
        perfil: true,
        escopo: true,
        servicos: true,
        permissoes: true,
        removidas: true,
        ativo: true,
      },
    });

    const resultado = await salvarAcessosUsuario({
      cpf,
      vinculos: existentes,
      executor,
      motivo: `Remoção do vínculo com ${modulo}`,
    });

    return NextResponse.json({ success: true, ...resultado });
  } catch (error) {
    if (error instanceof AcessoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao remover vínculo:", error);
    return NextResponse.json({ error: "Erro ao remover o vínculo." }, { status: 500 });
  }
}
