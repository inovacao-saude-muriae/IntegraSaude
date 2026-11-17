// Formatação e leitura de valores monetários brasileiros.
// PURO (sem imports e sem diretiva de cliente): usado tanto por server actions
// quanto por componentes de cliente.
//
// A digitação é tratada em CENTAVOS: o usuário digita só números e o campo
// mostra "1.234,56". Nada de parseFloat em valor com vírgula.

const AGRUPADO = /\B(?=(\d{3})+(?!\d))/g;

/** Converte a digitação livre em centavos inteiros. */
export function centavosDe(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return Math.round(valor * 100);
  const texto = String(valor);
  // Valor já formatado/normalizado ("1.234,56" ou "1234.56"): remove milhar.
  if (texto.includes(",") || /\.\d{2}$/.test(texto)) {
    const normalizado = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
  }
  const digitos = texto.replace(/\D/g, "");
  return digitos ? Number(digitos) : 0;
}

/** Centavos → "1.234,56" (sem símbolo). */
export function formatarCentavos(centavos) {
  const n = Math.abs(Math.trunc(Number(centavos) || 0));
  const reais = String(Math.trunc(n / 100)).replace(AGRUPADO, ".");
  const resto = String(n % 100).padStart(2, "0");
  return `${reais},${resto}`;
}

/** Texto digitado → valor mascarado "1.234,56". */
export function mascararMoeda(valor) {
  return formatarCentavos(centavosDe(valor));
}

/** Valor do banco (string "1234.56" ou número) → "1.234,56". */
export function formatarValorMonetario(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero)) return "";
  return formatarCentavos(Math.round(numero * 100));
}

/** Valor do banco → "R$ 1.234,56". */
export function formatarMoedaBRL(valor) {
  const texto = formatarValorMonetario(valor);
  return texto ? `R$ ${texto}` : "—";
}
