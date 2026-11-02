/**
 * Validação do Cartão Nacional de Saúde (CNS) segundo algoritmo oficial.
 * 
 * Existem dois tipos de CNS:
 * - Definitivo: começa com 1 ou 2 (15 dígitos)
 * - Provisório: começa com 7, 8 ou 9 (15 dígitos)
 * 
 * Referência: Ministério da Saúde
 */

/**
 * Valida CNS definitivo (começa com 1 ou 2)
 */
function validarCNSDefinitivo(cns) {
  const pis = cns.substring(0, 11);
  
  let soma = 0;
  for (let i = 0; i < 11; i++) {
    soma += parseInt(pis[i]) * (15 - i);
  }
  
  let resto = soma % 11;
  let dv = 11 - resto;
  dv = dv === 11 ? 0 : dv;
  
  if (dv === 10) {
    soma = 0;
    for (let i = 0; i < 11; i++) {
      soma += parseInt(pis[i]) * (15 - i);
    }
    soma += 2;
    resto = soma % 11;
    dv = 11 - resto;
    const resultado = dv === 11 ? 0 : dv;
    
    return cns === pis + "001" + resultado.toString();
  } else {
    return cns === pis + "000" + dv.toString();
  }
}

/**
 * Valida CNS provisório (começa com 7, 8 ou 9)
 */
function validarCNSProvisorio(cns) {
  let soma = 0;
  for (let i = 0; i < 15; i++) {
    soma += parseInt(cns[i]) * (15 - i);
  }
  
  return soma % 11 === 0;
}

/**
 * Valida um número de CNS completo
 * @param {string} cns - CNS com 15 dígitos (apenas números)
 * @returns {boolean} - true se válido, false se inválido
 */
export function validarCNS(cns) {
  if (!cns) return true; // CNS é opcional
  
  // Remove caracteres não numéricos
  const cnsLimpo = cns.replace(/\D/g, "");
  
  // CNS deve ter exatamente 15 dígitos
  if (cnsLimpo.length !== 15) return false;
  
  // Verifica se não é uma sequência repetida (ex: 111111111111111)
  if (/^(\d)\1{14}$/.test(cnsLimpo)) return false;
  
  const primeiroDigito = cnsLimpo[0];
  
  // CNS definitivo: começa com 1 ou 2
  if (primeiroDigito === "1" || primeiroDigito === "2") {
    return validarCNSDefinitivo(cnsLimpo);
  }
  
  // CNS provisório: começa com 7, 8 ou 9
  if (primeiroDigito === "7" || primeiroDigito === "8" || primeiroDigito === "9") {
    return validarCNSProvisorio(cnsLimpo);
  }
  
  // CNS deve começar com 1, 2, 7, 8 ou 9
  return false;
}

/**
 * Formata um CNS para exibição (adiciona espaços)
 * @param {string} cns - CNS sem formatação
 * @returns {string} - CNS formatado
 */
export function formatarCNS(cns) {
  if (!cns) return "";
  const cnsLimpo = cns.replace(/\D/g, "");
  
  if (cnsLimpo.length <= 3) return cnsLimpo;
  if (cnsLimpo.length <= 7) return `${cnsLimpo.slice(0, 3)} ${cnsLimpo.slice(3)}`;
  if (cnsLimpo.length <= 11) return `${cnsLimpo.slice(0, 3)} ${cnsLimpo.slice(3, 7)} ${cnsLimpo.slice(7)}`;
  return `${cnsLimpo.slice(0, 3)} ${cnsLimpo.slice(3, 7)} ${cnsLimpo.slice(7, 11)} ${cnsLimpo.slice(11, 15)}`;
}
