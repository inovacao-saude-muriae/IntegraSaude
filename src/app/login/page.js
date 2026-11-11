'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getDestinationByRole = (role) => {
    switch (role) {
      case 'ADMIN':
      case 'GESTOR':        return '/';
      case 'ADMIN_FARMACIA':
      case 'OPERADOR_FARMACIA': return '/camara-tecnica/farmacia-judicial?tab=DASHBOARD';
      case 'ADMIN_PROCESSO':    return '/camara-tecnica/processos';
      case 'OPERADOR_JUNTA':
      case 'ADMIN_JUNTA':       return '/junta-reguladora?tab=CADASTRO';
      default:                  return '/regulacao';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    const formData = new FormData(e.target);
    const res = await loginAction(formData);
    if (res?.success) {
      const cpf = formData.get('cpf')?.replace(/\D/g, '');
      if (typeof window !== 'undefined' && cpf) localStorage.setItem('user_cpf', cpf);
      router.refresh();
      router.push(getDestinationByRole(res.role));
    } else {
      setMsg(res?.error || 'CPF ou senha incorretos.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>

      {/* ── PAINEL ESQUERDO ── */}
      <aside className={styles.panel} aria-label="Informações institucionais">
        <div className={styles.panelContent}>
          <p className={styles.institution}>
            <span className={styles.instDot}/>
            Secretaria Municipal de Saúde de Muriaé
          </p>

          <h1 className={styles.headline}>
            Setores diferentes.<br/>
            <span className={styles.mint}>Uma só plataforma.</span>
          </h1>

          <Image
            src="/img/logos-integra/imglogin.svg"
            alt=""
            width={854}
            height={546}
            aria-hidden="true"
            className={styles.illustration}
            unoptimized
          />
        </div>
      </aside>

      {/* ── ÁREA DE LOGIN (direita) ── */}
      <section className={styles.loginArea} aria-label="Área de login">
        <div className={styles.loginBox}>

          <div className={styles.logoWrap}>
            <Image
              src="/img/logos-integra/logointegraCompleto.png"
              alt="IntegraSaúde — Sistema modular integrado"
              width={380}
              height={70}
              className={styles.logo}
              priority
            />
          </div>

          <p className={styles.subtitle}>Entre com suas credenciais</p>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>

            {msg && (
              <div className={styles.error} role="alert">{msg}</div>
            )}

            {/* CPF ou Usuário */}
            <div className={styles.field}>
              <label htmlFor="cpf" className={styles.label}>CPF ou Usuário</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <input
                  id="cpf"
                  type="text"
                  name="cpf"
                  required
                  placeholder="Digite seu CPF ou usuário"
                  className={styles.input}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Senha */}
            <div className={styles.field}>
              <label htmlFor="senha" className={styles.label}>Senha</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  name="senha"
                  required
                  placeholder="Digite sua senha"
                  className={`${styles.input} ${styles.inputPwd}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.togglePwd}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Entrando…' : (
                <>
                  Entrar
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>

          </form>
        </div>
      </section>

    </div>
  );
}
