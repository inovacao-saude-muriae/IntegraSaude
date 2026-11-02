/**
 * Sistema de Rate Limiting para proteger rotas sensíveis
 * - Login: 5 tentativas por minuto por IP
 * - Bloqueio após 10 tentativas consecutivas falhas
 */

// Armazena tentativas por IP: { ip: { count, firstAttempt, blocked, blockUntil } }
const attempts = new Map();

// Limpa tentativas antigas periodicamente (a cada 5 minutos)
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  for (const [ip, data] of attempts.entries()) {
    // Remove IPs que não tentam há mais de 5 minutos e não estão bloqueados
    if (data.firstAttempt < fiveMinutesAgo && !data.blocked) {
      attempts.delete(ip);
    }
    
    // Remove bloqueios expirados
    if (data.blocked && data.blockUntil < now) {
      attempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Extrai IP real do request (considera proxies)
 */
function getClientIP(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // Fallback para development (localhost)
  return "127.0.0.1";
}

/**
 * Verifica se um IP está bloqueado
 * @param {Request} request - Request object do Next.js
 * @returns {Object} - { allowed: boolean, remaining: number, resetIn: number, reason: string }
 */
export function checkRateLimit(request) {
  const ip = getClientIP(request);
  const now = Date.now();
  const oneMinute = 60 * 1000;
  
  const ipData = attempts.get(ip) || {
    count: 0,
    firstAttempt: now,
    blocked: false,
    blockUntil: 0,
  };
  
  // Verifica se IP está bloqueado
  if (ipData.blocked) {
    if (ipData.blockUntil > now) {
      const resetIn = Math.ceil((ipData.blockUntil - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        reason: `IP bloqueado por ${resetIn} segundos devido a múltiplas tentativas falhas`,
      };
    } else {
      // Bloqueio expirou, reseta
      attempts.delete(ip);
      ipData.count = 0;
      ipData.firstAttempt = now;
      ipData.blocked = false;
    }
  }
  
  // Verifica janela de tempo (1 minuto)
  if (now - ipData.firstAttempt > oneMinute) {
    // Janela expirou, reseta contador
    ipData.count = 0;
    ipData.firstAttempt = now;
  }
  
  // Limite: 5 tentativas por minuto
  if (ipData.count >= 5) {
    const resetIn = Math.ceil((ipData.firstAttempt + oneMinute - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      reason: `Limite de 5 tentativas por minuto excedido. Tente novamente em ${resetIn} segundos`,
    };
  }
  
  return {
    allowed: true,
    remaining: 5 - ipData.count,
    resetIn: Math.ceil((ipData.firstAttempt + oneMinute - now) / 1000),
    reason: null,
  };
}

/**
 * Registra uma tentativa de login (sucesso ou falha)
 * @param {Request} request - Request object do Next.js
 * @param {boolean} success - Se o login foi bem-sucedido
 */
export function recordAttempt(request, success) {
  const ip = getClientIP(request);
  const now = Date.now();
  
  const ipData = attempts.get(ip) || {
    count: 0,
    firstAttempt: now,
    blocked: false,
    blockUntil: 0,
    failedAttempts: 0,
  };
  
  if (success) {
    // Login bem-sucedido: limpa contador
    attempts.delete(ip);
  } else {
    // Login falhou: incrementa contadores
    ipData.count += 1;
    ipData.failedAttempts = (ipData.failedAttempts || 0) + 1;
    
    // Bloqueia após 10 tentativas consecutivas falhas (30 minutos)
    if (ipData.failedAttempts >= 10) {
      ipData.blocked = true;
      ipData.blockUntil = now + 30 * 60 * 1000; // 30 minutos
    }
    
    attempts.set(ip, ipData);
  }
}

/**
 * Limpa rate limit para um IP específico (para testes ou desbloqueio manual)
 * @param {string} ip - IP a ser limpo
 */
export function clearRateLimit(ip) {
  attempts.delete(ip);
}
