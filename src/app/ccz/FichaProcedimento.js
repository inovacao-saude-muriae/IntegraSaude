"use client";

import { useState, useEffect } from "react";
import stylesModal from "./AgendaCCZ.module.css";
import styles from "./ListaCCZ.module.css";
import { obterProcedimento } from "./actions";
import TermoProcedimento from "./TermoProcedimento";
import { useConfirm } from "@/components/ConfirmDialog";

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");

export default function FichaProcedimento({ procedimentoId, onFechar, onEditar, onExcluir }) {
  const confirm = useConfirm();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarTermo, setMostrarTermo] = useState(false);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
    setCarregando(true);
    setErro("");
    obterProcedimento(procedimentoId).then((res) => {
      if (!ativo) return;
      if (res.success) setDados(res.data);
      else setErro(res.error || "Não foi possível carregar o procedimento.");
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [procedimentoId]);

  if (carregando) {
    return (
      <div className={stylesModal.modalOverlay} onClick={onFechar}>
        <div className={stylesModal.modal} onClick={(e) => e.stopPropagation()}>
          <div className={stylesModal.modalHeader}>
            <h3 className={stylesModal.modalTitle}>Carregando...</h3>
            <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className={stylesModal.modalOverlay} onClick={onFechar}>
        <div className={stylesModal.modal} onClick={(e) => e.stopPropagation()}>
          <div className={stylesModal.modalHeader}>
            <h3 className={stylesModal.modalTitle}>Erro ao carregar</h3>
            <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
              ✕
            </button>
          </div>
          <div className={stylesModal.modalBody}>
            <p>{erro || "Não foi possível carregar o procedimento."}</p>
          </div>
        </div>
      </div>
    );
  }

  const obterCorStatus = (status) => {
    const cores = {
      Agendado: "#3b82f6",
      Realizado: "#10b981",
      Cancelado: "#ef4444",
    };
    return cores[status] || "#6b7280";
  };

  return (
    <div className={stylesModal.modalOverlay} onClick={onFechar}>
      <div
        className={stylesModal.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "800px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className={stylesModal.modalHeader}>
          <div>
            <h3 className={stylesModal.modalTitle}>Ficha do Procedimento</h3>
            <p className={stylesModal.modalSubtitle}>
              {dados.tipo} - {dados.animalNome || "Sem nome"} ({dados.animalId})
            </p>
          </div>
          <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className={stylesModal.modalBody}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Informações do Procedimento */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Informações do Procedimento</h4>
              
              <div className={styles.fichaGrid}>
                <div><strong>Animal:</strong> {dados.animalNome || "Sem nome"}</div>
                <div><strong>ID do Animal:</strong> {dados.animalId}</div>
                <div><strong>Tipo:</strong> {dados.tipo}</div>
                <div><strong>Data:</strong> {formatarData(dados.dataProcedimento)}</div>
                <div>
                  <strong>Status:</strong>
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      backgroundColor: obterCorStatus(dados.status),
                      color: "white",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "999px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                    }}
                  >
                    {dados.status}
                  </span>
                </div>
                <div><strong>Veterinário:</strong> {dados.veterinario || "-"}</div>
              </div>
            </section>

            {/* Descrição */}
            {dados.descricao && (
              <section className={styles.fichaSecao}>
                <h4 className={styles.fichaTitle}>Descrição</h4>
                <div style={{ 
                  padding: "0.75rem", 
                  backgroundColor: "#f8fafc", 
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  whiteSpace: "pre-wrap"
                }}>
                  {dados.descricao}
                </div>
              </section>
            )}

            {/* Medicação Prescrita */}
            {dados.medicacaoPrescrita && (
              <section className={styles.fichaSecao}>
                <h4 className={styles.fichaTitle}>Medicação Prescrita</h4>
                <div style={{ 
                  padding: "0.75rem", 
                  backgroundColor: "#f8fafc", 
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  whiteSpace: "pre-wrap"
                }}>
                  {dados.medicacaoPrescrita}
                </div>
              </section>
            )}

            {/* Retorno */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Retorno</h4>
              <div className={styles.fichaGrid}>
                <div><strong>Retorno Agendado:</strong> {dados.temRetorno}</div>
                {dados.temRetorno === "Sim" && dados.dataRetorno && (
                  <div><strong>Data do Retorno:</strong> {formatarData(dados.dataRetorno)}</div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.btnGhost}
            onClick={async () => {
              const ok = await confirm({
                title: "Excluir procedimento",
                message: "Deseja excluir este procedimento? Esta ação não pode ser desfeita.",
                confirmText: "Excluir",
              });
              if (!ok) return;
              onExcluir?.(dados.id);
              onFechar();
            }}
            style={{ 
              color: "#dc2626",
              borderColor: "#fca5a5"
            }}
          >
            Excluir
          </button>
          <button 
            type="button"
            className={styles.btnFicha}
            onClick={() => setMostrarTermo(true)}
          >
            Gerar Termo
          </button>
          <button 
            className={styles.btnPrimary}
            onClick={() => {
              onEditar?.(dados.id);
              onFechar();
            }}
          >
            Editar
          </button>
        </div>
      </div>

      {/* MODAL DO TERMO */}
      {mostrarTermo && (
        <TermoProcedimento
          procedimento={dados}
          onFechar={() => setMostrarTermo(false)}
        />
      )}
    </div>
  );
}
