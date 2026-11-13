"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

// Módulos do sistema com suas informações
const MODULOS = [
  {
    id: "regulacao",
    nome: "Regulação",
    descricao: "Gestão completa de pedidos de exames, controle de fila de espera e liberações",
    sigla: "REG",
    cor: "#0066cc",
    corClara: "#e6f2ff",
    link: "/regulacao?tab=DASHBOARD",
    modulo: "REGULACAO",
  },
  {
    id: "farmacia",
    nome: "Farmácia Judicial",
    descricao: "Controle de processos judiciais, estoque de medicamentos e dispensação",
    sigla: "FJ",
    cor: "#00a86b",
    corClara: "#e6f9f3",
    link: "/camara-tecnica/farmacia-judicial?tab=DASHBOARD",
    modulo: "FARMACIA",
  },
  {
    id: "processos",
    nome: "Processos Judiciais",
    descricao: "Gestão de processos judiciais e acompanhamento processual",
    sigla: "PJ",
    cor: "#059669",
    corClara: "#d1fae5",
    link: "/camara-tecnica/processos",
    modulo: "PROCESSOS",
  },
  {
    id: "junta",
    nome: "Junta Reguladora",
    descricao: "Avaliação multiprofissional de pacientes e coordenação de serviços especializados",
    sigla: "JR",
    cor: "#8b5cf6",
    corClara: "#f3f0ff",
    link: "/junta-reguladora?tab=DASHBOARD",
    modulo: "JUNTA",
  },
  {
    id: "ccz",
    nome: "CCZ",
    descricao: "Centro de Controle de Zoonoses - gestão de casos e vigilância epidemiológica",
    sigla: "CCZ",
    cor: "#d97706",
    corClara: "#fef3e6",
    link: "/ccz?tab=DASHBOARD",
    modulo: "CCZ",
  },
  {
    id: "gerenciamento",
    nome: "Gerenciamento",
    descricao: "Administração de usuários, relatórios gerenciais e configurações do sistema",
    sigla: "ADM",
    cor: "#64748b",
    corClara: "#f1f5f9",
    link: "/gerenciamento/usuarios",
    modulo: "GESTAO",
  },
];

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function initHome() {
      try {
        const resUser = await fetch("/api/me");
        if (!ativo) return;
        
        if (!resUser.ok) {
          router.replace("/login");
          return;
        }

        const dataUser = await resUser.json();
        
        setUser(dataUser.user);
      } catch (err) {
        console.error("Erro ao carregar usuário:", err);
        router.replace("/login");
      } finally {
        if (ativo) setLoading(false);
      }
    }

    initHome();

    return () => {
      ativo = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando módulos do sistema...</p>
      </div>
    );
  }

  if (!user) return null;

  // Filtra os cartões pelos VÍNCULOS ativos que /api/me devolveu. Nenhum
  // perfil legado participa: quem não tem vínculo com o módulo não vê o cartão,
  // e quem vê continua barrado no layout do módulo e na API.
  const meusModulos = new Set(
    (user?.modulos || []).filter((m) => m).map((m) => m.modulo),
  );
  const modulosDisponiveis = MODULOS.filter((modulo) => meusModulos.has(modulo.modulo));

  const handleModuleClick = (link) => {
    router.push(link);
  };

  return (
    <div className={styles.homeContainer}>
      {/* CABEÇALHO */}
      <header className={styles.homeHeader}>
        <div className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle}>
            Bem-vindo(a), <span className={styles.userName}>{user?.nomeCompleto}</span>
          </h1>
          <p className={styles.welcomeSubtitle}>
            Selecione um módulo para começar a trabalhar
          </p>
        </div>
      </header>

      {/* GRID DE MÓDULOS */}
      <section className={styles.modulesGrid}>
        {modulosDisponiveis.map((modulo) => (
          <div
            key={modulo.id}
            className={styles.moduleCard}
            onClick={() => handleModuleClick(modulo.link)}
          >
            <div className={styles.moduleHeader}>
              <div 
                className={styles.moduleBadge}
                style={{ 
                  backgroundColor: modulo.cor,
                  color: '#ffffff'
                }}
              >
                {modulo.sigla}
              </div>
              <div className={styles.moduleArrow} style={{ color: modulo.cor }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className={styles.moduleContent}>
              <h2 className={styles.moduleName}>{modulo.nome}</h2>
              <p className={styles.moduleDescription}>{modulo.descricao}</p>
            </div>
            <div className={styles.moduleFooter}>
              <div 
                className={styles.moduleIndicator}
                style={{ backgroundColor: modulo.cor }}
              ></div>
            </div>
          </div>
        ))}
      </section>

      {/* INFORMAÇÕES ADICIONAIS */}
      <footer className={styles.homeFooter}>
        <div className={styles.userInfo}>
          <span className={styles.userRole}>{user?.cargo || "Usuário do Sistema"}</span>
          <span className={styles.separator}>•</span>
          <span className={styles.accessInfo}>
            {modulosDisponiveis.length} módulo{modulosDisponiveis.length !== 1 ? "s" : ""} disponível
            {modulosDisponiveis.length !== 1 ? "eis" : ""}
          </span>
        </div>
      </footer>
    </div>
  );
}
