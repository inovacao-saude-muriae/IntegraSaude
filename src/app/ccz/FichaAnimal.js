"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import stylesModal from "./AgendaCCZ.module.css";
import styles from "./ListaCCZ.module.css";
import { mascararTelefone } from "@/lib/telefone";
import { obterFichaAnimal } from "./actions";
import { useConfirm } from "@/components/ConfirmDialog";

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");

export default function FichaAnimal({ animalId, onFechar, onEditar, onExcluir }) {
  const confirm = useConfirm();
  const [ficha, setFicha] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
    setCarregando(true);
    setErro("");
    obterFichaAnimal(animalId).then((res) => {
      if (!ativo) return;
      if (res.success) setFicha(res.data);
      else setErro(res.error || "Não foi possível carregar a ficha.");
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [animalId]);

  // ── Gera o PDF com todas as informações da ficha + procedimentos ──
  const baixarRelatorio = () => {
    if (!ficha) return;

    const doc = new jsPDF();
    const margemX = 14;
    const larguraUtil = 210 - margemX * 2;
    let y = 18;

    // Cabeçalho
    doc.setFillColor(74, 111, 165);
    doc.rect(0, 0, 210, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Ficha do Animal — CCZ", margemX, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `${ficha.nome || "Sem nome"}  (ID: ${ficha.id})`,
      margemX,
      20,
    );
    const emissao = new Date().toLocaleString("pt-BR");
    doc.text(`Emitido em: ${emissao}`, 210 - margemX, 20, { align: "right" });

    y = 34;
    doc.setTextColor(30, 41, 59);

    // Imagem do animal (se houver e for data URL de imagem).
    if (ficha.fotoUrl && ficha.fotoUrl.startsWith("data:image")) {
      try {
        const fmt = ficha.fotoUrl.includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(ficha.fotoUrl, fmt, 210 - margemX - 34, y, 34, 34);
      } catch {
        // Ignora foto inválida — segue sem a imagem.
      }
    }

    // Função utilitária para títulos de seção.
    const secao = (titulo) => {
      y += 2;
      doc.setFillColor(241, 245, 249);
      doc.rect(margemX, y, larguraUtil, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(titulo, margemX + 2, y + 5);
      y += 11;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
    };

    // Linha "rótulo: valor" (quebra de página automática).
    const linha = (rotulo, valor) => {
      if (y > 275) {
        doc.addPage();
        y = 18;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${rotulo}: `, margemX, y);
      const larguraRotulo = doc.getTextWidth(`${rotulo}: `);
      doc.setFont("helvetica", "normal");
      const texto = doc.splitTextToSize(
        String(valor || "-"),
        larguraUtil - larguraRotulo - 36,
      );
      doc.text(texto, margemX + larguraRotulo, y);
      y += texto.length * 5 + 1;
    };

    secao("Identificação");
    linha("Nome", ficha.nome || "Sem nome");
    linha("Espécie", ficha.especie);
    linha("Sexo", ficha.sexo);
    linha("Porte", ficha.porte);
    linha("Idade", ficha.idade);
    linha("Castrado", ficha.castrado);

    secao("Tutor");
    if (ficha.tutor) {
      linha("Nome", ficha.tutor.nome);
      linha("CPF", ficha.tutor.cpf);
      linha(
        "Telefone",
        ficha.tutor.telefone ? mascararTelefone(ficha.tutor.telefone) : "-",
      );
    } else {
      linha("Tutor", "Animal sem tutor vinculado");
    }

    secao("Dados clínicos");
    linha(
      "Doença crônica",
      ficha.doencaCronica === "Sim" ? "Sim" : "Não",
    );
    linha("Apetite", ficha.apetiteNormal);
    linha("Vômito / Diarreia", ficha.sintomasVomitoDiarreia);
    linha(
      "Em tratamento",
      ficha.emTratamento === "Sim"
        ? `Sim${ficha.qualTratamento ? ` — ${ficha.qualTratamento}` : ""}`
        : "Não",
    );
    if (ficha.observacoes) linha("Observação", ficha.observacoes);

    const nomeArquivo = `ficha-animal-${ficha.id}.pdf`;
    doc.save(nomeArquivo);
  };

  return (
    <div className={stylesModal.modalOverlay} onClick={onFechar}>
      <div 
        className={stylesModal.modal} 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className={stylesModal.modalHeader}>
          <div>
            <h3 className={stylesModal.modalTitle}>Ficha do animal</h3>
            {ficha && (
              <p className={stylesModal.modalSubtitle}>
                {ficha.nome || "Sem nome"} ({ficha.id})
              </p>
            )}
          </div>
          <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className={stylesModal.modalBody}>
          {carregando ? (
            <p style={{ textAlign: "center", color: "#64748b" }}>Carregando ficha...</p>
          ) : erro ? (
            <p style={{ textAlign: "center", color: "#dc2626" }}>{erro}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* IDENTIFICAÇÃO */}
              <section>
                <h4 style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: "700", 
                  color: "#64748b", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.05em",
                  marginBottom: "1rem"
                }}>
                  Identificação
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Nome
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.nome || "Sem nome"}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      ID
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.id}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Espécie
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.especie || "-"}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Sexo
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.sexo || "-"}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Porte
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.porte || "-"}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Idade
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.idade || "-"}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Castrado
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.castrado === "Sim" ? "Sim" : "Não"}
                    </div>
                  </div>
                </div>
              </section>

              {/* TUTOR */}
              <section>
                <h4 style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: "700", 
                  color: "#64748b", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.05em",
                  marginBottom: "1rem"
                }}>
                  Tutor
                </h4>
                
                {ficha.tutor ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                        Nome
                      </label>
                      <div style={{ 
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#f8fafc", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}>
                        {ficha.tutor.nome}
                      </div>
                    </div>
                    
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                        CPF
                      </label>
                      <div style={{ 
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#f8fafc", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}>
                        {ficha.tutor.cpf}
                      </div>
                    </div>
                    
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                        Telefone
                      </label>
                      <div style={{ 
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#f8fafc", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}>
                        {ficha.tutor.telefone ? mascararTelefone(ficha.tutor.telefone) : "-"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: "#64748b", fontStyle: "italic" }}>Animal sem tutor vinculado.</p>
                )}
              </section>

              {/* DADOS CLÍNICOS */}
              <section>
                <h4 style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: "700", 
                  color: "#64748b", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.05em",
                  marginBottom: "1rem"
                }}>
                  Dados Clínicos
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Doença crônica
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.doencaCronica === "Sim" ? "Sim" : "Não"}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Apetite
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.apetiteNormal || "-"}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Vômito / Diarreia
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.sintomasVomitoDiarreia || "-"}
                    </div>
                  </div>
                  
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Em tratamento
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {ficha.emTratamento === "Sim"
                        ? `Sim${ficha.qualTratamento ? ` — ${ficha.qualTratamento}` : ""}`
                        : "Não"}
                    </div>
                  </div>
                </div>
              </section>

              {/* OBSERVAÇÕES */}
              {ficha.observacoes && (
                <section>
                  <h4 style={{ 
                    fontSize: "0.75rem", 
                    fontWeight: "700", 
                    color: "#64748b", 
                    textTransform: "uppercase", 
                    letterSpacing: "0.05em",
                    marginBottom: "1rem"
                  }}>
                    Observações
                  </h4>
                  <div style={{ 
                    padding: "0.75rem", 
                    backgroundColor: "#f8fafc", 
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {ficha.observacoes}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          {ficha && (
            <>
              <button 
                type="button" 
                className={styles.btnGhost}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Excluir animal",
                    message: `Deseja excluir o animal ${ficha.nome || "Sem nome"}? Esta ação não pode ser desfeita.`,
                    confirmText: "Excluir",
                  });
                  if (!ok) return;
                  onExcluir?.(ficha.id);
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
                className={styles.btnPrimary}
                onClick={() => {
                  onEditar?.(ficha.id);
                  onFechar();
                }}
              >
                Editar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
