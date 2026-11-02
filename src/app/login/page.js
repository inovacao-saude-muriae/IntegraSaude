'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Mapeamento de destinos com base no perfil (Role)
  const getDestinationByRole = (role) => {
    switch (role) {
      case 'ADMIN':
      case 'GESTOR':
        return '/'; // Gestor/Admin vai para o Dashboard Geral

      case 'OPERADOR_REGULA':
      case 'ADMIN_REGULA':
        return '/regulacao?tab=DASHBOARD';

      case 'ADMIN_FARMACIA':
      case 'OPERADOR_FARMACIA':
        return '/camara-tecnica/farmacia-judicial?tab=DASHBOARD';

      case 'ADMIN_PROCESSO':
        return '/camara-tecnica/processos';

      case 'OPERADOR_JUNTA':
      case 'ADMIN_JUNTA':
        return '/junta-reguladora?tab=CADASTRO';

      default:
        return '/regulacao';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);

    const formData = new FormData(e.target);
    const res = await loginAction(formData);

    if (res?.success) {
      const cpfDigitado = formData.get('cpf')?.replace(/\D/g, '');
      if (typeof window !== 'undefined' && cpfDigitado) {
        localStorage.setItem('user_cpf', cpfDigitado);
      }

      // 1. Atualiza o cache de rotas do Next.js para reconhecer o cookie recém-criado
      router.refresh();

      // 2. Redireciona para o destino baseado no perfil
      const destination = getDestinationByRole(res.role);
      router.push(destination);
    } else {
      setMsg(res?.error || 'CPF ou senha incorretos.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.loginContainer}>
        {/* Logo */}
        <div className={styles.logoContainer}>
          <img 
            src="/img/logos-integra/integralogo.png" 
            alt="IntegraSaúde" 
            className={styles.logoImage}
          />
        </div>

        {/* Formulário de Login */}
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Bem-vindo</h2>
            <p className={styles.formSubtitle}>Entre com suas credenciais para acessar o sistema</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {msg && (
              <div className={styles.errorAlert}>
                <span>{msg}</span>
              </div>
            )}

            <div className={styles.inputGroup}>
              <label className={styles.label}>CPF ou Usuário</label>
              <input
                type="text"
                name="cpf"
                required
                placeholder="Digite seu CPF ou nome de usuário"
                className={styles.input}
                autoComplete="username"
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Senha</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="senha"
                  required
                  placeholder="Digite sua senha"
                  className={styles.input}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className={styles.togglePassword}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`${styles.submitButton} ${loading ? styles.submitButtonLoading : ''}`}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}