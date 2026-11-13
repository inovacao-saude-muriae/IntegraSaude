"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { ConfirmProvider } from "@/components/ConfirmDialog";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  // Troca de senha obrigatória (primeiro acesso): o sistema está bloqueado e
  // esta é a única tela liberada pelo proxy. Sem Header e sem Sidebar, para
  // não sugerir navegação que o servidor vai negar.
  const isTrocarSenha = pathname === "/trocar-senha";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoginPage || isTrocarSenha) {
    return <ConfirmProvider>{children}</ConfirmProvider>;
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <ConfirmProvider>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%" }}>
        {/* Header fixo no topo com z-index alto */}
        <Header onToggleSidebar={toggleSidebar} />

        {/* Estrutura inferior posicionada abaixo do Header */}
        <div style={{ display: "flex", flex: 1, width: "100%" }}>
          <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
          
          {/* Backdrop para mobile */}
          {sidebarOpen && (
            <div
              onClick={closeSidebar}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                zIndex: 999,
                display: "none",
              }}
              className="sidebar-backdrop"
            />
          )}

          <main
            style={{
              flex: 1,
              minWidth: 0,
              marginTop: "60px",
              padding: "0.75rem 1rem",
              boxSizing: "border-box",
              minHeight: "calc(100vh - 60px)",
              backgroundColor: "var(--bg-main, #f8fafc)",
            }}
            className="main-content"
          >
            {children}
          </main>
        </div>
      </div>
      
      {/* CSS Responsivo */}
      <style jsx>{`
        @media (max-width: 768px) {
          .sidebar-backdrop {
            display: block !important;
          }
          
          .main-content {
            margin-left: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </ConfirmProvider>
  );
}