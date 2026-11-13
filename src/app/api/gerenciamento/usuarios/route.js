import { NextResponse } from "next/server";
import { requirePermissaoGestao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detalharPermissoes, MODULOS_CATALOGO, PERFIS } from "@/lib/permissoesCatalogo";
import { AcessoErro, salvarAcessosUsuario } from "@/lib/acessoService";

// ═══════════════════════════════════════════════════════════════════════════
// /api/gerenciamento/usuarios
// ─────────────────────────────────────────────────────────────────────────
// GET  → lista as contas com o RESUMO de acessos por módulo (para a lista da
//        tela de gerenciamento).
// POST → cria conta nova. O acesso inicial vem da própria tela (vínculos por
//        módulo), nunca de um perfil único: `users.role` foi removido do banco.
//        A conta nasce SEM vínculos e a tela de acessos define tudo.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    await requirePermissaoGestao("usuarios", "visualizar");
    const usuarios = await prisma.user.findMany({
      select: {
        cpf: true,
        nome: true,
        cargo: true,
        ativo: true,
        primeiroAcesso: true,
        ultimoAcesso: true,
        createdAt: true,
        acessos: {
          select: {
            modulo: true,
            perfil: true,
            escopo: true,
            servicos: true,
            permissoes: true,
            removidas: true,
            ativo: true,
          },
          orderBy: { modulo: "asc" },
        },
      },
      orderBy: { nome: "asc" },
    });

    const data = usuarios.map((u) => ({
      ...u,
      modulos: u.acessos.map((a) => ({
        modulo: a.modulo,
        nome: MODULOS_CATALOGO[a.modulo]?.nome || a.modulo,
        perfil: a.perfil,
        escopo: a.escopo,
        servicos: a.servicos,
        ativo: a.ativo,
        totalEfetivas: detalharPermissoes(a.modulo, a.perfil, a.permissoes, a.removidas)
          .efetivas.length,
      })),
      ativos: u.acessos.filter((a) => a.ativo !== false).map((a) => a.modulo),
      acessos: undefined,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao listar usuários:", error);
    return NextResponse.json({ error: "Erro ao listar usuários." }, { status: 500 });
  }
}

// Cria a conta (sem vínculos) ou atualiza nome/cargo de uma existente.
// Os acessos são gravados depois, pela rota /[cpf]/acessos — assim cada passo
// tem uma responsabilidade e a tela mostra o que foi persistido.
export async function POST(request) {
  try {
    // Criar/editar conta exige permissão de escrita — não basta visualizar.
    const gestor = await requirePermissaoGestao("usuarios", "criar");
    let corpo = {};
    try {
      corpo = await request.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const cpfLimpo = String(corpo.cpf || "").replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      return NextResponse.json({ error: "CPF inválido. Forneça 11 dígitos." }, { status: 400 });
    }
    const nome = String(corpo.nomeCompleto || "").trim();
    if (nome.length < 3) {
      return NextResponse.json({ error: "Informe o nome completo." }, { status: 400 });
    }

    const existente = await prisma.user.findUnique({
      where: { cpf: cpfLimpo },
      select: { cpf: true, nome: true, ativo: true },
    });

    const { registrarAuditoria } = await import("@/lib/audit");
    const bcrypt = (await import("bcryptjs")).default;

    if (existente) {
      // Atualização de dados cadastrais — não redefine senha nem zera acesso.
      const user = await prisma.user.update({
        where: { cpf: cpfLimpo },
        data: { nome, cargo: corpo.cargo || null },
        select: { cpf: true, nome: true, cargo: true },
      });
      await registrarAuditoria({
        user: gestor,
        acao: "EDITAR",
        modulo: "GESTAO",
        entidade: "Usuario",
        entidadeId: cpfLimpo,
        descricao: `Dados do usuário '${user.nome}' atualizados`,
        detalhes: { nomeAnterior: existente.nome, cargo: user.cargo },
      });
      return NextResponse.json({ success: true, usuario: user, criado: false });
    }

    // Criação: senha inicial padrão, troca obrigatória no primeiro acesso.
    const SENHA_PADRAO = "Integr@123";
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
    const user = await prisma.user.create({
      data: {
        cpf: cpfLimpo,
        nome,
        cargo: corpo.cargo || null,
        senhaHash,
        ativo: true,
        primeiroAcesso: true,
        // Rótulo de compatibilidade até a remoção dos perfis legados.
      },
      select: { cpf: true, nome: true, cargo: true },
    });

    await registrarAuditoria({
      user: gestor,
      acao: "CRIAR",
      modulo: "GESTAO",
      entidade: "Usuario",
      entidadeId: cpfLimpo,
      descricao: `Usuário '${user.nome}' criado`,
      detalhes: { cargo: user.cargo, primeiroAcesso: true },
    });

    return NextResponse.json({ success: true, usuario: user, criado: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AcessoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao cadastrar usuário:", error);
    return NextResponse.json({ error: "Erro ao salvar usuário." }, { status: 500 });
  }
}

// Nomes dos perfis para a tela (evita duplicar rótulo no cliente).
export async function OPTIONS() {
  return NextResponse.json({ perfis: Object.values(PERFIS) });
}
