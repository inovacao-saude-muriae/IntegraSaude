'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordInput.module.css';

/**
 * Campo de senha com mostrar/ocultar — o padrão do IntegraSaúde.
 *
 * - começa oculto (`type="password"`) com o ícone de olho riscado (`EyeOff`);
 * - clicar revela (`type="text"`) e o ícone vira olho aberto (`Eye`);
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
  style,
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
        style={style}

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
        {/* O ícone representa o ESTADO do campo: oculto → olho riscado
            (EyeOff); visível → olho aberto (Eye). O rótulo/tooltip continua
            descrevendo a AÇÃO do clique ("Mostrar senha" / "Ocultar senha"). */}
        {visivel ? (
          <Eye size={19} strokeWidth={2} aria-hidden="true" />
        ) : (
          <EyeOff size={19} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
