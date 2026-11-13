// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO PRÓPRIO DA ÁREA PROCESSOS — normalização de nomes
// ─────────────────────────────────────────────────────────────────────────
// As especialidades e procedimentos dos Processos Judiciais são um cadastro
// PRÓPRIO da Câmara Técnica (tabelas processos_especialidades,
// processos_procedimentos). Não usam `junta_especialidades` nem
// `regula_procedimentos`.
//
// Cada item guarda, além do nome como foi digitado, uma CHAVE normalizada
// (`nome_chave`, única) para impedir nomes equivalentes no mesmo catálogo:
//   "Cardiologia", "cardiologia " e "CARDIOlogia" → "cardiologia"
//   "Ortopedia Infantil" e "Ortopedia  infantil"  → "ortopedia infantil"
// Acentos são removidos na chave (comparação), nunca no nome exibido.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normaliza o nome para comparação: sem acento, minúsculas, espaços e
 * pontuação colapsados. Retorna "" para entrada vazia.
 */
export function chaveDoNome(valor) {
  const bruto = typeof valor === "string" ? valor : "";
  return bruto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nome como será exibido: espaços colapsados, sem espaços nas pontas. */
export function limparNome(valor) {
  const bruto = typeof valor === "string" ? valor : "";
  return bruto.replace(/\s+/g, " ").trim();
}

export const TAMANHO_MAXIMO_NOME = 150;
