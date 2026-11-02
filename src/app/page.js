"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import ModalTrocarSenha from "@/components/ModalTrocarSenha";

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
    roles: ["GESTOR", "REGULACAO_ADMIN", "REGULACAO_COMUM"],
  },
  {
    id: "farmacia",
    nome: "Farmácia Judicial",
    descricao: "Controle de processos judiciais, estoque de medicamentos e dispensação",
    sigla: "FJ",
    cor: "#00a86b",
    corClara: "#e6f9f3",
    link: "/camara-tecnica/farmacia-judicial?tab=DASHBOARD",
    roles: ["GESTOR", "FARMACIA_ADMIN"],
  },
  {
    id: "processos",
    nome: "Processos Judiciais",
    descricao: "Gestão de processos judiciais e acompanhamento processual",
    sigla: "PJ",
    cor: "#059669",
    corClara: "#d1fae5",
    link: "/camara-tecnica/processos",
    roles: ["GESTOR", "PROCESSO_ADMIN"],
  },
  {
    id: "junta",
    nome: "Junta Reguladora",
    descricao: "Avaliação multiprofissional de pacientes e coordenação de serviços especializados",
    sigla: "JR",
    cor: "#8b5cf6",
    corClara: "#f3f0ff",
    link: "/junta-reguladora?tab=DASHBOARD",
    roles: ["GESTOR", "JUNTA_ADMIN", "JUNTA_CAEE", "JUNTA_EDUCACAO", "JUNTA_SAUDE", "JUNTA_ASSISTENCIA"],
  },
  {
    id: "ccz",
    nome: "CCZ",
    descricao: "Centro de Controle de Zoonoses - gestão de casos e vigilância epidemiológica",
    sigla: "CCZ",
    cor: "#d97706",
    corClara: "#fef3e6",
    link: "/ccz?tab=DASHBOARD",
    roles: ["GESTOR", "CCZ_ADMIN", "CCZ_COMUM"],
  },
  {
    id: "gerenciamento",
    nome: "Gerenciamento",
    descricao: "Administração de usuários, relatórios gerenciais e configurações do sistema",
    sigla: "ADM",
    cor: "#64748b",
    corClara: "#f1f5f9",
    link: "/gerenciamento/usuarios",
    roles: ["GESTOR"],
  },
];

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [mostrarModalSenha, setMostrarModalSenha] = useState(false);

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
        
        // DEBUG: Log do primeiroAcesso
        console.log('🔍 DEBUG - Dados do usuário:', {
          nome: dataUser.user?.nomeCompleto,
          role: dataUser.user?.role,
          primeiroAcesso: dataUser.user?.primeiroAcesso,
        });
        
        // IMPORTANTE: Verifica primeiro acesso e mostra modal
        if (dataUser.user?.primeiroAcesso === true) {
          console.log('✅ Primeiro acesso detectado! Mostrando modal...');
          setUser(dataUser.user);
          setMostrarModalSenha(true);
          setLoading(false);
          return;
        }

        console.log('ℹ️ Não é primeiro acesso, mostrando módulos normalmente');
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

  const handleSucessoTrocaSenha = () => {
    // Recarrega os dados do usuário para atualizar primeiroAcesso
    setMostrarModalSenha(false);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando módulos do sistema...</p>
      </div>
    );
  }

  if (!user) return null;

  // Filtra módulos baseado nas permissões do usuário
  const modulosDisponiveis = MODULOS.filter((modulo) =>
    modulo.roles.includes(user.role)
  );

  const handleModuleClick = (link) => {
    router.push(link);
  };

  return (
    <div className={styles.homeContainer}>
      {/* Modal de Trocar Senha (primeiro acesso) */}
      {mostrarModalSenha && (
        <ModalTrocarSenha onSucesso={handleSucessoTrocaSenha} />
      )}

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
          <span className={styles.userRole}>{user?.cargo || user?.role}</span>
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
