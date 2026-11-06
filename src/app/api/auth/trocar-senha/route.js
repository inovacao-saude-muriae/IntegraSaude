import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";

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

    // Busca sessão
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Sessão inválida" },
        { status: 401 }
      );
    }

    // Verifica senha atual
    const senhaCorreta = await bcrypt.compare(senhaAtual, session.user.senhaHash);

    if (!senhaCorreta) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 401 }
      );
    }

    // Gera hash da nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualiza senha e marca primeiroAcesso como false
    await prisma.user.update({
      where: { cpf: session.user.cpf },
      data: {
        senhaHash: novaSenhaHash,
        primeiroAcesso: false,
        updatedAt: new Date(),
      },
    });

    // Gera NOVO JWT com primeiroAcesso: false
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    
    const novoToken = await new SignJWT({
      userId: session.user.cpf,
      role: session.user.role,
      nome: session.user.nome,
      cargo: session.user.cargo,
      primeiroAcesso: false, // ← ATUALIZA para false
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(secret);

    // Atualiza a sessão no banco com o novo token
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: novoToken,
        expiresAt,
      },
    });

    // Atualiza o cookie com o novo token
    cookieStore.set("session_token", novoToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    await registrarAuditoria({
      user: session.user,
      acao: "EDITAR",
      modulo: "AUTH",
      entidade: "Senha",
      entidadeId: session.user.cpf,
      descricao: "Senha alterada",
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