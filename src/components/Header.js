"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import styles from "./Header.module.css";

export default function Header({ onToggleSidebar }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userData, setUserData] = useState({
    name: "Carregando...",
    cargo: "Aguarde...",
  });

  // Função para obter título da página baseado no pathname
  const getPageTitle = () => {
    if (pathname === "/") return "Início";
    if (pathname.startsWith("/regulacao")) return "Regulação";
    if (pathname.startsWith("/camara-tecnica/farmacia-judicial")) return "Farmácia Judicial";
    if (pathname.startsWith("/camara-tecnica/processos")) return "Processos Judiciais";
    if (pathname.startsWith("/junta-reguladora")) return "Junta Reguladora";
    if (pathname.startsWith("/ccz")) return "CCZ";
    if (pathname.startsWith("/gerenciamento/pessoas")) return "Cadastro de Pessoas";
    if (pathname.startsWith("/gerenciamento/medicos")) return "Médicos";
    if (pathname.startsWith("/gerenciamento/ubs")) return "Unidades de Saúde";
    if (pathname.startsWith("/gerenciamento/usuarios")) return "Gerenciar Usuários";
    if (pathname.startsWith("/gerenciamento/relatorios")) return "Relatórios Gerais";
    return "Sistema";
  };

  useEffect(() => {
    async function fetchUserData() {
      try {
        // Consulta a sessão real do usuário logado via cookie HTTP
        const res = await fetch("/api/me");

        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setUserData({
              name: data.user.nomeCompleto || "Usuário do Sistema",
              // Texto de identificação do cargo — não é autorização.
              cargo: data.user.cargo || "Usuário do Sistema",
            });
            return;
          }
        }

        // Se a sessão for inválida/expirada
        setUserData({
          name: "Sessão Expirada",
          cargo: "Não Autenticado",
        });
      } catch (error) {
        console.error("Erro ao carregar dados do usuário no Header:", error);
        setUserData({
          name: "Erro de Conexão",
          cargo: "-",
        });
      }
    }

    fetchUserData();
  }, []);

  // Logout real: encerra a sessão no banco (o token deixa de valer), remove o
  // cookie e registra o evento na auditoria — tudo na server action.
  const handleLogout = async () => {
    try {
      await logoutAction();
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("user_cpf");
      }
      router.replace("/login");
      router.refresh();
    }
  };

  const initialLetter =
    userData.name && userData.name !== "Carregando..."
      ? userData.name.trim().charAt(0).toUpperCase()
      : "U";

  return (
    <header className={styles.header}>
      {/* BOTÃO HAMBURGER (visível apenas em mobile) */}
      <button
        type="button"
        className={styles.hamburgerBtn}
        aria-label="Abrir menu de navegação"
        title="Menu"
        onClick={onToggleSidebar}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* BREADCRUMB */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <span className={styles.breadcrumbItem}>
          <span className={styles.breadcrumbIcon}>📍</span>
          {getPageTitle()}
        </span>
      </nav>

      {/* INFORMAÇÕES DO USUÁRIO LOGADO */}
      <div className={styles.userInfo} role="status" aria-label="Informações do usuário">
        <div className={styles.userAvatar} aria-hidden="true">{initialLetter}</div>
        <div className={styles.userDetails}>
          <span className={styles.userName}>{userData.name}</span>
          <span className={styles.userRole}>{userData.cargo}</span>
        </div>
      </div>

      {/* BOTÃO DE SAIR */}
      <button
        type="button"
        className={styles.logoutBtn}
        aria-label="Sair do sistema"
        title="Sair do Sistema"
        onClick={handleLogout}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </header>
  );
}