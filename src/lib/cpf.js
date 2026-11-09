// Helpers de CPF provisório (EMPI).
//
// Pessoas que chegam sem documento recebem um CPF PROVISÓRIO: letra "T" + 10
// dígitos (ex.: T0000000001). Cabe em VarChar(11) e nunca se confunde com um CPF
// real (11 dígitos numéricos). Arquivo neutro (cliente e servidor).

export const CPF_PROVISORIO_REGEX = /^T\d{10}$/;
export const ROTULO_CPF_PROVISORIO = "CPF não informado";
// Data de nascimento neutra usada em cadastros importados sem data.
export const DATA_NASC_PLACEHOLDER = "1900-01-01";

const apenasDigitos = (valor) => (valor ? String(valor).replace(/\D/g, "") : "");

/** true se o valor é um CPF provisório (T + 10 dígitos). */
export function isCpfProvisorio(cpf) {
  if (!cpf) return false;
  return CPF_PROVISORIO_REGEX.test(String(cpf).trim().toUpperCase());
}

/**
 * Normaliza o valor usado como CHAVE de pessoa: provisório → maiúsculo,
 * senão somente dígitos.
 */
export function normalizarCpfChave(valor) {
  if (!valor) return "";
  const texto = String(valor).trim().toUpperCase();
  return CPF_PROVISORIO_REGEX.test(texto) ? texto : apenasDigitos(texto);
}

/** Texto para exibição: provisório → rótulo; 11 dígitos → 000.000.000-00. */
export function formatarCpfExibicao(cpf) {
  if (!cpf) return "";
  if (isCpfProvisorio(cpf)) return ROTULO_CPF_PROVISORIO;
  const d = apenasDigitos(cpf);
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return String(cpf);
}
