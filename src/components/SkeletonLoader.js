import styles from "./SkeletonLoader.module.css";

/**
 * Componente de skeleton loader para feedback visual durante carregamento
 * @param {Object} props
 * @param {string} props.variant - 'text', 'title', 'card', 'avatar', 'button', 'table'
 * @param {number} props.rows - Número de linhas (para variant='table')
 * @param {number} props.lines - Número de linhas de texto (para variant='text')
 * @param {string} props.width - Largura customizada
 * @param {string} props.height - Altura customizada
 */
export default function SkeletonLoader({ 
  variant = "text",
  rows = 5,
  lines = 3,
  width,
  height,
}) {
  const style = {
    ...(width && { width }),
    ...(height && { height }),
  };

  if (variant === "table") {
    return (
      <div className={styles.skeletonTable} role="status" aria-label="Carregando tabela">
        <div className={styles.skeletonTableHeader}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className={styles.skeletonTableHeaderCell} />
          ))}
        </div>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className={styles.skeletonTableRow}>
            {[...Array(4)].map((_, j) => (
              <div key={j} className={styles.skeletonTableCell} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={styles.skeletonCard} style={style} role="status" aria-label="Carregando card">
        <div className={styles.skeletonCardHeader} />
        <div className={styles.skeletonCardBody}>
          <div className={styles.skeletonLine} style={{ width: "90%" }} />
          <div className={styles.skeletonLine} style={{ width: "75%" }} />
          <div className={styles.skeletonLine} style={{ width: "85%" }} />
        </div>
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={styles.skeletonTextBlock} role="status" aria-label="Carregando texto">
        {[...Array(lines)].map((_, i) => (
          <div
            key={i}
            className={styles.skeletonLine}
            style={{ width: i === lines - 1 ? "60%" : "100%", ...style }}
          />
        ))}
      </div>
    );
  }

  const variantClass = styles[`skeleton${variant.charAt(0).toUpperCase() + variant.slice(1)}`];

  return (
    <div
      className={`${styles.skeleton} ${variantClass}`}
      style={style}
      role="status"
      aria-label={`Carregando ${variant}`}
    />
  );
}
