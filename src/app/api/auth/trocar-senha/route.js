import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import {
  carregarSessao,
  opcoesCookieSessao,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
} from "@/lib/auth";

// Valida senha forte
function validarSenhaForte(senha) {
  const requisitos = [];
  
  if (senha.length < 8) {
    requisitos.push('A senha deve ter no mínimo 8 caracteres');
  }
  
  if (!/[A-Z]/.test(senha)) {
    requisitos.push('Deve conter pelo menos uma letra maiúscula');
  }
  
  if (!/[a-z]/.test(senha)) {
    requisitos.push('Deve conter pelo menos uma letra minúscula');
  }
  
  if (!/[0-9]/.test(senha)) {
    requisitos.push('Deve conter pelo menos um número');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)) {
    requisitos.push('Deve conter pelo menos um caractere especial');
  }
  
  return requisitos;
}

export async function POST(request) {
  try {
    const { senhaAtual, novaSenha } = await request.json();

    // Valida dados
    if (!senhaAtual || !novaSenha) {
      return NextResponse.json(
        { error: "Senha atual e nova senha são obrigatórias" },
        { status: 400 }
      );
    }

    // Valida força da nova senha
    const errosValidacao = validarSenhaForte(novaSenha);
    if (errosValidacao.length > 0) {
      return NextResponse.json(
        { error: errosValidacao.join('. ') },
        { status: 400 }
      );
    }

    // Verifica se a nova senha é diferente da atual
    if (senhaAtual === novaSenha) {
      return NextResponse.json(
        { error: "A nova senha deve ser diferente da senha atual" },
        { status: 400 }
      );
    }

    // Sessão validada pela fonte única (lib/auth): cookie presente, sessão
    // registrada no banco, NÃO expirada (expires_at) e usuário ativo.
    // Sessão expirada/revogada nunca troca senha.
    const ctx = await carregarSessao();
    if (!ctx) {
      return NextResponse.json(
        { error: "Sessão inválida ou expirada. Faça login novamente." },
        { status: 401 }
      );
    }
    const { session, user } = ctx;
    const cookieStore = await cookies();

    // Verifica senha atual
    const senhaCorreta = await bcrypt.compare(senhaAtual, user.senhaHash);

    if (!senhaCorreta) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 401 }
      );
    }

    // Gera hash da nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    // Gera NOVO JWT com primeiroAcesso: false
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const novoToken = await new SignJWT({
      userId: user.cpf,
      nome: user.nome,
      cargo: user.cargo,
      primeiroAcesso: false,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(secret);

    // Transação: troca a senha, REVOGA as demais sessões do usuário (inclusive
    // as de outros dispositivos, que deixam de valer porque o token some do
    // banco) e mantém viva apenas esta sessão, já com o novo token.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { cpf: user.cpf },
        data: {
          senhaHash: novaSenhaHash,
          primeiroAcesso: false,
          updatedAt: new Date(),
        },
      });

      const revogadas = await tx.session.deleteMany({
        where: { userId: user.cpf, id: { not: session.id } },
      });

      await tx.session.update({
        where: { id: session.id },
        data: { token: novoToken, expiresAt },
      });

      return revogadas.count;
    });

    // Atualiza o cookie com o novo token
    cookieStore.set(SESSION_COOKIE, novoToken, opcoesCookieSessao(expiresAt));

    await registrarAuditoria({
      user,
      acao: "EDITAR",
      modulo: "AUTH",
      entidade: "Senha",
      entidadeId: user.cpf,
      descricao: "Senha alterada; demais sessões revogadas",
    });

    return NextResponse.json(
      { message: "Senha alterada com sucesso" },
      { status: 200 }
    );

  } catch (error) {
    console.error("Erro ao trocar senha:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}