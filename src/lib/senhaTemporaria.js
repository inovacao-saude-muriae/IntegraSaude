import crypto from "node:crypto";

// ═══════════════════════════════════════════════════════════════════════════
// SENHA TEMPORÁRIA — gerador ÚNICO do sistema
// ─────────────────────────────────────────────────────────────────────────
// Usado pelo CADASTRO de conta e pela REDEFINIÇÃO de senha. Não existe outro
// gerador: as duas funcionalidades compartilham esta função.
//
// Critérios (iguais nas duas operações):
//   • 14 caracteres;
//   • fonte criptograficamente segura (`crypto.getRandomValues`);
//   • atende a política de senha do sistema (8+, maiúscula, minúscula, número
//     e caractere especial);
//   • sem caracteres visualmente ambíguos (0, O, o, 1, l, I);
//   • diferente a cada chamada.
//
// A senha em texto NUNCA é persistida: quem chama grava apenas o hash bcrypt.
// ═══════════════════════════════════════════════════════════════════════════

const TAMANHO = 14;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnpqrstuvwxyz";
const DIGITOS = "23456789";
const ESPECIAIS = "!@#$%&*";

function sortear(alfabeto, quantidade) {
  const bytes = crypto.getRandomValues(new Uint8Array(quantidade));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]);
}

/**
 * Devolve uma senha temporária de 14 caracteres.
 * @param {number} tamanho opcional (padrão 14)
 * @returns {string}
 */
export function gerarSenhaTemporaria(tamanho = TAMANHO) {
  const minimo = 8;
  const total = Math.max(Number(tamanho) || TAMANHO, minimo);

  // Um caractere obrigatório de cada classe da política...
  const partes = [
    sortear(MAIUSCULAS, 1)[0],
    sortear(MINUSCULAS, 1)[0],
    sortear(DIGITOS, 1)[0],
    sortear(DIGITOS, 1)[0],
    sortear(ESPECIAIS, 1)[0],
  ];
  // ...e o resto do alfabeto completo.
  while (partes.length < total) {
    partes.push(sortear(ALFABETO, 1)[0]);
  }

  // Embaralha (Fisher-Yates) para o prefixo obrigatório não ficar previsível.
  const ordem = crypto.getRandomValues(new Uint8Array(partes.length));
  for (let i = partes.length - 1; i > 0; i -= 1) {
    const j = ordem[i] % (i + 1);
    [partes[i], partes[j]] = [partes[j], partes[i]];
  }
  return partes.join("");
}

export default gerarSenhaTemporaria;
