'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordInput.module.css';

/**
 * Campo de senha com mostrar/ocultar — o padrão do IntegraSaúde.
 *
 * - começa oculto (`type="password"`);
 * - o ícone de olho revela (`type="text"`) e vira olho riscado;
 * - clicar no ícone NÃO envia o formulário (`type="button"`) e não mexe no
 *   valor digitado nem nas validações do campo;
 * - o ícone fica dentro do campo, à direita e centralizado na vertical, e
 *   identifica o estado por tooltip (`title`) e por `aria-label`/`aria-pressed`.
 *
 * Uso: substitui o <input> por este componente, mantendo o mesmo
 * `className` do projeto para herdar dimensões, bordas e cores.
 *
 *   <PasswordInput
 *     id="senha"
 *     className={styles.input}
 *     value={senha}
 *     onChange={(e) => setSenha(e.target.value)}
 *     required
 *     autoComplete="current-password"
 *   />
 *
 * O `className` vai para o <input> (visual do campo); o wrapper é só
 * posicionamento do ícone. Use `wrapperClassName` quando o layout exigir.
 *
 * Campo NÃO controlado (formulários que leem FormData, como o login): basta
 * omitir `value`/`onChange` e passar `defaultValue`. O componente só troca o
 * `type` do input, então o valor digitado é preservado.
 */
export default function PasswordInput({
  className = '',
  wrapperClassName = '',
  id,
  value,
  defaultValue,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required = false,
  minLength,
  disabled = false,
  name,
  onFocus,
  onBlur,
  autoFocus = false,
  ...rest
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className={`${styles.wrapper} ${wrapperClassName}`.trim()}>
      <input
        {...rest}
        id={id}
        name={name}
        type={visivel ? 'text' : 'password'}
        {...(value !== undefined ? { value, onChange } : { defaultValue, onChange })}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        autoFocus={autoFocus}
        className={`${className} ${styles.inputComOlho}`.trim()}
      />
      <button
        type="button"
        className={styles.olho}
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={0}
        disabled={disabled}
      >
        {visivel ? (
          <EyeOff size={18} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Eye size={18} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
