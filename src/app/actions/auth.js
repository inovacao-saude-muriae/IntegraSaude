"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { SignJWT } from "jose";
import { registrarAuditoria } from "@/lib/audit";
import {
  carregarSessao,
  opcoesCookieSessao,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
} from "@/lib/auth";

// Sistema de rate limiting in-memory
const loginAttempts = new Map();

// Limpa tentativas antigas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  for (const [key, data] of loginAttempts.entries()) {
    if (data.firstAttempt < fiveMinutesAgo && !data.blocked) {
      loginAttempts.delete(key);
    }
    if (data.blocked && data.blockUntil < now) {
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

async function getClientIP() {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const realIP = headersList.get("x-real-ip");
  
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIP) return realIP;
  return "127.0.0.1";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const oneMinute = 60 * 1000;
  
  const data = loginAttempts.get(ip) || {
    count: 0,
    firstAttempt: now,
    blocked: false,
    blockUntil: 0,
    failedAttempts: 0,
  };
  
  // Verifica bloqueio
  if (data.blocked && data.blockUntil > now) {
    const minutesRemaining = Math.ceil((data.blockUntil - now) / 60000);
    return {
      allowed: false,
      reason: `Muitas tentativas falhas. Tente novamente em ${minutesRemaining} minuto${minutesRemaining > 1 ? 's' : ''}.`,
    };
  } else if (data.blocked && data.blockUntil <= now) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  
  // Verifica janela de tempo
  if (now - data.firstAttempt > oneMinute) {
    data.count = 0;
    data.firstAttempt = now;
  }
  
  // Limite: 5 tentativas por minuto
  if (data.count >= 5) {
    const secondsRemaining = Math.ceil((data.firstAttempt + oneMinute - now) / 1000);
    return {
      allowed: false,
      reason: `Muitas tentativas. Aguarde ${secondsRemaining} segundo${secondsRemaining > 1 ? 's' : ''} antes de tentar novamente.`,
    };
  }
  
  return { allowed: true };
}

function recordAttempt(ip, success) {
  const now = Date.now();
  
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  
  const data = loginAttempts.get(ip) || {
    count: 0,
    firstAttempt: now,
    blocked: false,
    blockUntil: 0,
    failedAttempts: 0,
  };
  
  data.count += 1;
  data.failedAttempts = (data.failedAttempts || 0) + 1;
  
  // Bloqueia após 10 tentativas consecutivas (30 minutos)
  if (data.failedAttempts >= 10) {
    data.blocked = true;
    data.blockUntil = now + 30 * 60 * 1000;
  }
  
  loginAttempts.set(ip, data);
}

export async function loginAction(formData) {
  const ip = await getClientIP();
  
  // Verifica rate limit
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return { error: rateCheck.reason };
  }
  
  try {
    const loginInput = formData.get("cpf")?.trim(); // Pode ser CPF ou username
    const senha = formData.get("senha");

    if (!loginInput) {
      return { error: "Informe seu CPF ou nome de usuário." };
    }

    if (!senha) {
      return { error: "Informe a sua senha de acesso." };
    }

    // Verifica se é um CPF (somente números) ou username
    const cpfLimpo = loginInput.replace(/\D/g, "");
    const isCpf = cpfLimpo.length === 11 && /^\d+$/.test(cpfLimpo);

    // 1. Busca o usuário por CPF ou username
    let user;
    if (isCpf) {
      user = await prisma.user.findUnique({
        where: { cpf: cpfLimpo },
      });
    } else {
      // Busca por username
      user = await prisma.user.findUnique({
        where: { username: loginInput },
      });
    }

    if (!user || !user.ativo) {
      recordAttempt(ip, false);
      return { error: "Usuário não encontrado ou inativo no sistema." };
    }

    // 2. Valida o hash da senha
    const senhaValida = await bcrypt.compare(senha, user.senhaHash);
    if (!senhaValida) {
      recordAttempt(ip, false);
      return { error: "Senha incorreta. Tente novamente." };
    }

    // Login bem-sucedido - limpa rate limit
    recordAttempt(ip, true);

    // 3. Gera JWT assinado com informações do usuário
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS); // 8 horas de sessão
    
    const token = await new SignJWT({
      userId: user.cpf,
      role: user.role,
      nome: user.nome,
      cargo: user.cargo,
      primeiroAcesso: user.primeiroAcesso,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(secret);

    // 4. Salva a sessão no banco
    await prisma.session.create({
      data: {
        userId: user.cpf,
        token,
        expiresAt,
      },
    });

    // 5. Atualiza o registro do último acesso
    await prisma.user.update({
      where: { cpf: user.cpf },
      data: { ultimoAcesso: new Date() },
    });

    // 6. Salva o Cookie HTTP-Only com o JWT
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, opcoesCookieSessao(expiresAt));

    await registrarAuditoria({
      user,
      acao: "LOGIN",
      modulo: "AUTH",
      entidade: "Sessão",
      entidadeId: user.cpf,
      descricao: "Login realizado",
      ip,
    });

    return { success: true, role: user.role };
  } catch (error) {
    console.error("Erro na ação de login:", error);
    recordAttempt(ip, false);
    return { error: "Erro interno ao tentar realizar login." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT — encerramento REAL da sessão
// ─────────────────────────────────────────────────────────────────────────
// Antes, o botão "Sair" só apagava uma chave do localStorage e navegava para
// /login: o cookie e a linha em user_sessions continuavam válidos (o token
// seguia reutilizável por até 8h). Agora:
//   1. a sessão é apagada do banco (token deixa de existir → não reutilizável);
//   2. o cookie é removido da resposta;
//   3. o encerramento é registrado na auditoria.
// Idempotente: sem sessão válida, apenas limpa o cookie e sai.
// ═══════════════════════════════════════════════════════════════════════════
export async function logoutAction() {
  try {
    const ctx = await carregarSessao();

    if (ctx) {
      await prisma.session.delete({ where: { id: ctx.session.id } }).catch(() => {});
      await registrarAuditoria({
        user: ctx.user,
        acao: "ENCERRAR",
        modulo: "AUTH",
        entidade: "Sessão",
        entidadeId: ctx.user.cpf,
        descricao: "Logout: sessão encerrada",
      });
    }

    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);

    return { success: true };
  } catch (error) {
    console.error("Erro no logout:", error);
    // Mesmo em erro, remove o cookie: nunca deixa o usuário "preso" logado.
    try {
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE);
    } catch {}
    return { success: false };
  }
}
