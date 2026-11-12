'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ModalTrocarSenha.module.css';

// Função para validar força da senha
function validarSenhaForte(senha) {
  const erros = [];
  
  if (senha.length < 8) {
    erros.push('A senha deve ter no mínimo 8 caracteres');
  }
  
  if (!/[A-Z]/.test(senha)) {
    erros.push('Deve conter pelo menos uma letra maiúscula');
  }
  
  if (!/[a-z]/.test(senha)) {
    erros.push('Deve conter pelo menos uma letra minúscula');
  }
  
  if (!/[0-9]/.test(senha)) {
    erros.push('Deve conter pelo menos um número');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)) {
    erros.push('Deve conter pelo menos um caractere especial (!@#$%^&*...)');
  }
  
  return erros;
}

export default function ModalTrocarSenha({ onSucesso }) {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [mostrarRequisitos, setMostrarRequisitos] = useState(false);
  
  // Estados para mostrar/ocultar senhas
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  // Verificação de requisitos em tempo real
  const requisitos = {
    tamanho: novaSenha.length >= 8,
    maiuscula: /[A-Z]/.test(novaSenha),
    minuscula: /[a-z]/.test(novaSenha),
    numero: /[0-9]/.test(novaSenha),
    especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(novaSenha),
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    // Validações
    const errosValidacao = validarSenhaForte(novaSenha);
    if (errosValidacao.length > 0) {
      setErro(errosValidacao.join('. '));
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem');
      return;
    }

    if (senhaAtual === novaSenha) {
      setErro('A nova senha deve ser diferente da senha atual');
      return;
    }

    setSalvando(true);

    try {
      const res = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });

      const data = await res.json();

      // Sessão expirada/revogada: a rota recusa a troca — manda para o login
      // em vez de exibir um erro genérico.
      if (res.status === 401) {
        router.push('/login?error=session_expired');
        return;
      }

      if (res.ok) {
        setSucesso(true);
        setTimeout(() => {
          if (onSucesso) onSucesso();
        }, 1500);
      } else {
        setErro(data.error || 'Erro ao trocar senha');
      }
    } catch (err) {
      setErro('Erro de conexão com o servidor');
    } finally {
      setSalvando(false);
    }
  };

  if (sucesso) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>Senha alterada com sucesso!</h2>
          <p className={styles.successText}>Carregando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Primeiro Acesso</h2>
          <p className={styles.subtitle}>
            Por segurança, altere sua senha antes de continuar
          </p>
        </div>

        {erro && (
          <div className={styles.error}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Senha Atual</label>
            <div className={styles.inputWrapper}>
              <input
                type={mostrarSenhaAtual ? 'text' : 'password'}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
                className={styles.input}
                placeholder="Digite sua senha atual"
                autoComplete="current-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}
                className={styles.toggleButton}
                aria-label={mostrarSenhaAtual ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenhaAtual ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3.5 8 10 8a9.12 9.12 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Nova Senha</label>
            <div className={styles.inputWrapper}>
              <input
                type={mostrarNovaSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                onFocus={() => setMostrarRequisitos(true)}
                required
                minLength={8}
                className={styles.input}
                placeholder="Digite sua nova senha"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                className={styles.toggleButton}
                aria-label={mostrarNovaSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarNovaSenha ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3.5 8 10 8a9.12 9.12 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                )}
              </button>
            </div>
            
            {mostrarRequisitos && novaSenha && (
              <div className={styles.requisitos}>
                <p className={styles.requisitosTitle}>Requisitos:</p>
                <ul className={styles.requisitosList}>
                  <li className={requisitos.tamanho ? styles.requisitoCumprido : styles.requisitoNaoCumprido}>
                    {requisitos.tamanho ? '✓' : '○'} Mínimo 8 caracteres
                  </li>
                  <li className={requisitos.maiuscula ? styles.requisitoCumprido : styles.requisitoNaoCumprido}>
                    {requisitos.maiuscula ? '✓' : '○'} Letra maiúscula
                  </li>
                  <li className={requisitos.minuscula ? styles.requisitoCumprido : styles.requisitoNaoCumprido}>
                    {requisitos.minuscula ? '✓' : '○'} Letra minúscula
                  </li>
                  <li className={requisitos.numero ? styles.requisitoCumprido : styles.requisitoNaoCumprido}>
                    {requisitos.numero ? '✓' : '○'} Número
                  </li>
                  <li className={requisitos.especial ? styles.requisitoCumprido : styles.requisitoNaoCumprido}>
                    {requisitos.especial ? '✓' : '○'} Caractere especial
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Confirmar Nova Senha</label>
            <div className={styles.inputWrapper}>
              <input
                type={mostrarConfirmarSenha ? 'text' : 'password'}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                minLength={8}
                className={styles.input}
                placeholder="Digite novamente a nova senha"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                className={styles.toggleButton}
                aria-label={mostrarConfirmarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarConfirmarSenha ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3.5 8 10 8a9.12 9.12 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className={styles.submitButton}
          >
            {salvando ? (
              <>
                <span className={styles.spinner}></span>
                Alterando...
              </>
            ) : (
              'Confirmar Nova Senha'
            )}
          </button>
        </form>

        <div className={styles.info}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Sua senha será criptografada e armazenada com segurança</span>
        </div>
      </div>
    </div>
  );
}
