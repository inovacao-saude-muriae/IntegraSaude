/**
 * Valida se todas as variáveis de ambiente obrigatórias estão definidas
 * @throws {Error} Se alguma variável obrigatória estiver faltando
 */
export function validateEnv() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
  ];


  // Verificar variáveis obrigatórias
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `❌ Variáveis de ambiente OBRIGATÓRIAS faltando:\n` +
      `   ${missing.join('\n   ')}\n\n` +
      `💡 Solução:\n` +
      `   1. Copie o arquivo .env.example para .env\n` +
      `   2. Preencha os valores das variáveis\n` +
      `   3. Reinicie o servidor\n`
    );
  }

  // Validar JWT_SECRET tem tamanho mínimo
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn(
      `⚠️  JWT_SECRET é muito curto (mínimo recomendado: 32 caracteres)\n` +
      `   Gere um secret forte com:\n` +
      `   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n`
    );
  }

  // Validar DATABASE_URL tem formato correto
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    throw new Error(
      `❌ DATABASE_URL deve começar com 'postgresql://'\n` +
      `   Formato esperado: postgresql://user:password@host:5432/database\n`
    );
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Variáveis de ambiente validadas com sucesso!');
  }
}

/**
 * Obtém uma variável de ambiente com valor padrão
 * @param {string} key - Nome da variável
 * @param {string} defaultValue - Valor padrão se não existir
 * @returns {string}
 */
export function getEnv(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

/**
 * Verifica se está em ambiente de produção
 * @returns {boolean}
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Verifica se está em ambiente de desenvolvimento
 * @returns {boolean}
 */
export function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}
