'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PasswordInput from '@/components/PasswordInput';
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
          else {
            router.replace('/');
            router.refresh();
          }
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
            <label className={styles.label} htmlFor="modalSenhaAtual">Senha Atual</label>
            <PasswordInput
              id="modalSenhaAtual"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
              className={styles.input}
              placeholder="Digite sua senha atual"
              autoComplete="current-password"
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="modalNovaSenha">Nova Senha</label>
            <PasswordInput
              id="modalNovaSenha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              onFocus={() => setMostrarRequisitos(true)}
              required
              minLength={8}
              className={styles.input}
              placeholder="Digite sua nova senha"
              autoComplete="new-password"
            />

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
            <label className={styles.label} htmlFor="modalConfirmarSenha">Confirmar Nova Senha</label>
            <PasswordInput
              id="modalConfirmarSenha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={8}
              className={styles.input}
              placeholder="Digite novamente a nova senha"
              autoComplete="new-password"
            />
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
