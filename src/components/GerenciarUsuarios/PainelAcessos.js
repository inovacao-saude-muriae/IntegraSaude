"use client";

import { useEffect } from "react";
import styles from "./GerenciarAcessos.module.css";
import GerenciarAcessos, { formataCpf } from "./GerenciarAcessos";

// ═══════════════════════════════════════════════════════════════════════════
// PAINEL DE ACESSOS — modal amplo, aberto direto pelo botão "Acessos" da lista
// de usuários. Não pede para escolher o usuário de novo: recebe o CPF e carrega
// do banco os vínculos daquele usuário.
//
// O corpo é o MESMO componente usado na 2ª etapa do cadastro
// (GerenciarAcessos), com a lista lateral desligada e o usuário fixo.
// ═══════════════════════════════════════════════════════════════════════════

export default function PainelAcessos({ usuario, catalogo, onFechar, onSalvo }) {
  // Esc fecha; o corpo não rola junto com a página de trás.
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [onFechar]);

  const modulos = (usuario?.modulos || []).filter((m) => m.ativo !== false);

  return (
    <div
      className={styles.painelFundo}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className={styles.painel} role="dialog" aria-modal="true" aria-labelledby="painel-titulo">
        <div className={styles.painelTopo}>
          <div>
            <h2 id="painel-titulo" className={styles.painelTitulo}>
              Acessos de {usuario?.nome || "usuário"}
            </h2>
            <div className={styles.painelSub}>
              {formataCpf(usuario?.cpf)} · {usuario?.cargo || "sem cargo"} ·{" "}
              {usuario?.ativo ? "conta ativa" : "conta inativa"}
            </div>
            <div className={styles.painelResumo}>
              {modulos.length === 0 ? (
                <span className={styles.painelSemModulo}>Sem acessos configurados</span>
              ) : (
                modulos.map((m) => (
                  <span key={m.modulo} className={styles.painelMedalha}>
                    {m.nome} · {m.perfil}
                  </span>
                ))
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.painelFechar}
            onClick={onFechar}
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            ×
          </button>
        </div>

        <div className={styles.painelCorpo}>
          <GerenciarAcessos
            cpf={usuario?.cpf || null}
            modo="edicao"
            catalogo={catalogo}
            mostrarLista={false}
            onSalvo={onSalvo}
          />
        </div>
      </div>
    </div>
  );
}
