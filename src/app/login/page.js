'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import PasswordInput from '@/components/PasswordInput';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Destino PADRÃO de todo login: a página Início, para todos os perfis —
  // quem tem um módulo só e quem tem vários. Os módulos continuam acessíveis
  // pela Sidebar e pelos cartões do Início.
  //
  // Primeiro acesso: o servidor (proxy.js) intercepta a navegação e leva para
  // /trocar-senha antes de qualquer página operacional — o redirecionamento
  // não depende desta tela nem da página Início.
  const DESTINO_PADRAO = '/';

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
      // replace: o botão "voltar" não devolve o usuário ao formulário de login.
      router.replace(DESTINO_PADRAO);
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
                <PasswordInput
                  id="senha"
                  name="senha"
                  required
                  placeholder="Digite sua senha"
                  className={`${styles.input} ${styles.inputPwd}`}
                  wrapperClassName={styles.inputWrapPwd}
                  autoComplete="current-password"
                />
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
