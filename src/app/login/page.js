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
      {/* Lado esquerdo - Branding */}
      <div className={styles.brandingSide}>
        <div className={styles.brandingContent}>
          <div className={styles.logoContainer}>
            <img 
              src="/img/logos-integra/integralogo.png" 
              alt="IntegraSaúde" 
              className={styles.logoImageLogin}
            />
          </div>
          
          <div className={styles.brandingDescription}>
            <h2>Sistema de Gestão em Saúde</h2>
            <p>Plataforma completa e integrada para gestão municipal de saúde, com controle de processos, auditoria e relatórios gerenciais.</p>
          </div>

          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <span>Segurança e Conformidade</span>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <span>Gestão Integrada</span>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <span>Auditoria Completa</span>
            </div>
          </div>
        </div>

        <div className={styles.brandingFooter}>
          <p>© 2024 IntegraSaúde. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Lado direito - Formulário */}
      <div className={styles.formSide}>
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Bem-vindo de volta</h2>
            <p className={styles.formSubtitle}>Entre com suas credenciais para acessar o sistema</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {msg && (
              <div className={styles.errorAlert}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{msg}</span>
              </div>
            )}

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                CPF ou Usuário
              </label>
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
              <label className={styles.label}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Senha
              </label>
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
                  {showPassword ? (
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
              disabled={loading}
              className={`${styles.submitButton} ${loading ? styles.submitButtonLoading : ''}`}
            >
              {loading ? (
                <>
                  <svg className={styles.spinner} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Entrando...
                </>
              ) : (
                <>
                  Entrar no Sistema
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className={styles.formFooter}>
            <div className={styles.securityBadge}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Conexão segura e criptografada</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}