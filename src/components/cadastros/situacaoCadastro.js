// Regra única de situação hierárquica dos cadastros (categoria → subordinado).
// Função pura, sem imports: é usada tanto nas server actions (que calculam a
// disponibilidade que devolvem) quanto nos componentes de cliente (que a
// exibem). Este arquivo NÃO pode ter "use client" nem importar nada de
// cliente, senão as server actions passam a chamar uma função de cliente.

// ═══════════════════════════════════════════════════════════════════════════
// Situação HIERÁRQUICA dos cadastros (categoria → registro subordinado)
// ─────────────────────────────────────────────────────────────────────────
// Os três cadastros do sistema têm dois níveis:
//
//   Regulação   → Tipo de Exame      → Procedimento
//   Junta       → Serviço            → Especialidade
//   Processos   → Especialidade      → Procedimento (N:N)
//
// A inativação da categoria NÃO altera o `ativo` dos subordinados: o que ela
// faz é torná-los operacionalmente indisponíveis. Assim:
//
//   - reativar a categoria devolve cada subordinado ao estado que ele tinha
//     antes (as inativações individuais continuam valendo);
//   - no N:N, um procedimento inativo dentro de uma especialidade continua
//     disponível pela outra especialidade ativa.
//
// `situacaoRegistro` é a única regra; o banco guarda a situação individual.

/**
 * @param {{ ativo?: boolean, paiAtivo?: boolean }} dados
 * @returns {{ individualAtivo: boolean, paiAtivo: boolean, operacional: boolean, motivo: "ativo"|"individual"|"categoria" }}
 */
export function situacaoRegistro({ ativo, paiAtivo } = {}) {
  const individualAtivo = ativo !== false;
  const categoriaAtiva = paiAtivo !== false;
  if (!individualAtivo) {
    return { individualAtivo, paiAtivo: categoriaAtiva, operacional: false, motivo: "individual" };
  }
  if (!categoriaAtiva) {
    return { individualAtivo, paiAtivo: categoriaAtiva, operacional: false, motivo: "categoria" };
  }
  return { individualAtivo, paiAtivo: true, operacional: true, motivo: "ativo" };
}

/**
 * O filtro de situação opera sobre a disponibilidade OPERACIONAL, que é o que
 * o administrador enxerga na tela. "Inativos" reúne tanto os inativados
 * individualmente quanto os indisponíveis por causa da categoria superior.
 */
export function passaSituacaoOperacional(situacao, operacional) {
  if (situacao === "ativos") return operacional === true;
  if (situacao === "inativos") return operacional !== true;
  return true;
}
