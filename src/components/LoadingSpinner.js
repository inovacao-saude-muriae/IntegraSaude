import styles from "./LoadingSpinner.module.css";

/**
 * Componente de loading spinner padrão do sistema
 * @param {Object} props
 * @param {string} props.size - Tamanho: 'sm', 'md' (padrão), 'lg'
 * @param {string} props.variant - Variante: 'primary' (padrão), 'white'
 * @param {string} props.label - Texto de acessibilidade
 * @param {boolean} props.inline - Se deve ser exibido inline (sem centralização)
 */
export default function LoadingSpinner({ 
  size = "md", 
  variant = "primary",
  label = "Carregando...",
  inline = false 
}) {
  const sizeClass = styles[`spinner${size.charAt(0).toUpperCase() + size.slice(1)}`];
  const variantClass = styles[`spinner${variant.charAt(0).toUpperCase() + variant.slice(1)}`];
  const containerClass = inline ? styles.spinnerInline : styles.spinnerContainer;

  return (
    <div className={containerClass} role="status" aria-label={label}>
      <div className={`${styles.spinner} ${sizeClass} ${variantClass}`} />
      <span className={styles.srOnly}>{label}</span>
    </div>
  );
}
