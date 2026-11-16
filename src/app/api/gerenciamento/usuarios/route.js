import { NextResponse } from "next/server";
import { requirePermissaoGestao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detalharPermissoes, MODULOS_CATALOGO, PERFIS } from "@/lib/permissoesCatalogo";
import { AcessoErro, salvarAcessosUsuario } from "@/lib/acessoService";
import { gerarSenhaTemporaria } from "@/lib/senhaTemporaria";

// ═══════════════════════════════════════════════════════════════════════════
// /api/gerenciamento/usuarios
// ─────────────────────────────────────────────────────────────────────────
// GET  → lista as contas com o RESUMO de acessos por módulo (para a lista da
//        tela de gerenciamento).
// POST → cria conta nova. O acesso inicial vem da própria tela (vínculos por
//        módulo), nunca de um perfil único: `users.role` foi removido do banco.
//        Os vínculos podem vir JUNTO no corpo (`vinculos`): nesse caso a conta e
//        os acessos são gravados na mesma operação — se a gravação dos acessos
//        falhar, a conta é desfeita e a resposta é de erro (nada de sucesso
//        falso). Sem `vinculos`, a conta nasce sem acessos configurados.
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

// Cria a conta (com ou sem vínculos) ou atualiza nome/cargo de uma existente.
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

    // Vínculos opcionais, enviados junto com o cadastro. São validados ANTES de
    // criar a conta (catálogo, escopo, poder de concessão): erro aqui não deixa
    // conta órfã no banco.
    const vinculos = Array.isArray(corpo.vinculos) ? corpo.vinculos : [];
    if (vinculos.length > 0) {
      await validarVinculosParaCadastro({ vinculos, executor: gestor });
    }

    // Criação: senha temporária INDIVIDUAL e aleatória, do gerador único do
    // sistema (`lib/senhaTemporaria`, o mesmo do "Resetar senha"). Só o hash é
    // gravado; a senha em texto volta UMA vez nesta resposta, para o
    // administrador entregar ao usuário. Não há senha padrão compartilhada.
    const senhaTemporaria = gerarSenhaTemporaria();
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
    const user = await prisma.user.create({
      data: {
        cpf: cpfLimpo,
        nome,
        cargo: corpo.cargo || null,
        senhaHash,
        ativo: true,
        primeiroAcesso: true,
      },
      select: { cpf: true, nome: true, cargo: true },
    });

    // Gravação dos vínculos na sequência. Se falhar, a conta é desfeita para
    // não existir usuário pela metade — e a resposta é de erro.
    let resultadoAcessos = null;
    if (vinculos.length > 0) {
      try {
        resultadoAcessos = await salvarAcessosUsuario({
          cpf: cpfLimpo,
          vinculos,
          executor: gestor,
          motivo: "Cadastro de usuário com acessos",
        });
      } catch (erroAcessos) {
        await prisma.user.delete({ where: { cpf: cpfLimpo } }).catch(() => {});
        const status = erroAcessos instanceof AcessoErro ? erroAcessos.status : 500;
        const texto =
          erroAcessos instanceof AcessoErro
            ? erroAcessos.message
            : "Não foi possível gravar os acessos. A conta não foi criada.";
        if (!(erroAcessos instanceof AcessoErro)) {
          console.error("Erro ao gravar acessos no cadastro:", erroAcessos);
        }
        return NextResponse.json({ error: texto }, { status });
      }
    }

    await registrarAuditoria({
      user: gestor,
      acao: "CRIAR",
      modulo: "GESTAO",
      entidade: "Usuario",
      entidadeId: cpfLimpo,
      descricao: `Usuário '${user.nome}' criado`,
      // Nunca a senha nem o hash: só o fato de que a credencial foi definida.
      detalhes: {
        cargo: user.cargo,
        primeiroAcesso: true,
        senhaTemporaria: "gerada",
        modulos: vinculos.map((v) => v.modulo),
      },
    });

    return NextResponse.json(
      {
        success: true,
        usuario: user,
        criado: true,
        // Exibida uma única vez, na confirmação do cadastro.
        senhaTemporaria,
        primeiroAcesso: true,
        // Quantos módulos ficaram realmente gravados (relido do banco).
        totalModulos: (resultadoAcessos?.vinculos || []).length,
        vinculos: resultadoAcessos?.vinculos || [],
      },
      { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
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

// Valida os vínculos enviados no cadastro ANTES de criar a conta, com as
// mesmas regras da gravação (catálogo, escopo, poder de concessão).
async function validarVinculosParaCadastro({ vinculos, executor }) {
  const { validarVinculo, exigirPoderDeConcessao } = await import("@/lib/acessoService");
  const { obterContextoEfetivo } = await import("@/lib/permissions");
  const efetivoExecutor = await obterContextoEfetivo({ cpf: executor.cpf });
  const vistos = new Set();
  for (const bruto of vinculos) {
    const v = validarVinculo(bruto);
    if (vistos.has(v.modulo)) {
      throw new AcessoErro(`Módulo repetido na configuração: ${v.modulo}.`);
    }
    vistos.add(v.modulo);
    exigirPoderDeConcessao(efetivoExecutor, v);
  }
}

// Nomes dos perfis para a tela (evita duplicar rótulo no cliente).
export async function OPTIONS() {
  return NextResponse.json({ perfis: Object.values(PERFIS) });
}
