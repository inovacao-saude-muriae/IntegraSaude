"use client";

import styles from "./FiltroAno.module.css";

export const TODOS_OS_ANOS = "todos";

// Opções padrão: ano atual e os 5 anteriores (mesma faixa do dashboard do CCZ).
export const anosPadrao = (qtd = 6) => {
  const atual = new Date().getFullYear();
  return Array.from({ length: qtd }, (_, i) => atual - i);
};

// Toolbar do filtro de ano global dos dashboards (mesmo visual do CCZ).
// valor: número do ano ou "todos". onChange recebe número ou "todos".
export default function FiltroAno({
  valor,
  onChange,
  anos,
  incluirTodos = true,
  dica,
}) {
  const lista = anos && anos.length ? anos : anosPadrao();
  const rotulo = valor === TODOS_OS_ANOS ? "todos os anos" : String(valor);

  return (
    <div className={styles.toolbar}>
      <label className={styles.anoFiltro}>
        <span className={styles.anoFiltroLabel}>Ano</span>
        <select
          value={valor}
          onChange={(e) =>
            onChange(
              e.target.value === TODOS_OS_ANOS
                ? TODOS_OS_ANOS
                : Number(e.target.value),
            )
          }
          aria-label="Filtrar dashboard por ano"
        >
          {incluirTodos && <option value={TODOS_OS_ANOS}>Todos os anos</option>}
          {lista.map((ano) => (
            <option key={ano} value={ano}>
              {ano}
            </option>
          ))}
        </select>
      </label>
      <span className={styles.toolbarHint}>Indicadores referentes a: {rotulo}</span>
      {dica && <span className={styles.toolbarHint}>{dica}</span>}
    </div>
  );
}
