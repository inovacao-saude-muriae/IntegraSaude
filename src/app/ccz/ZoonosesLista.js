"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ListaCCZ.module.css";
import FichaZoonose from "./FichaZoonose";

export default function ZoonosesLista({ onEditar }) {
  const [zoonoses, setZoonoses] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [fichaAberta, setFichaAberta] = useState(null); // ID da zoonose com ficha aberta

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/ccz/zoonoses");
      if (res.ok) {
        const data = await res.json();
        setZoonoses(data);
      }
    } catch (error) {
      console.error("Erro ao carregar zoonoses:", error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
    carregar();
  }, [carregar]);

  const termoLimpo = termo.trim().toLowerCase();
  const filtrados = zoonoses.filter((z) => {
    if (!termoLimpo) return true;
    return (
      (z.id || "").toLowerCase().includes(termoLimpo) ||
      (z.animal?.nome || "").toLowerCase().includes(termoLimpo) ||
      (z.doenca || "").toLowerCase().includes(termoLimpo) ||
      (z.responsavelMonitoramento || "").toLowerCase().includes(termoLimpo)
    );
  });

  function formatarData(data) {
    if (!data) return "-";
    const d = new Date(data);
    return d.toLocaleDateString("pt-BR");
  }

  function obterCorGrauRisco(grau) {
    const cores = {
      Baixo: "#10b981",
      Moderado: "#f59e0b",
      Alto: "#f97316",
      Crítico: "#ef4444",
    };
    return cores[grau] || "#6b7280";
  }

  function obterCorRiscoVida(risco) {
    return risco === "Sim" ? "#ef4444" : "#10b981";
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.listaHeader}>
          <h2 className={styles.cardHeaderTitle}>
            Notificações de Zoonoses{filtrados.length > 0 ? ` (${filtrados.length})` : ""}
          </h2>
          <input
            type="text"
            className={styles.buscaInput}
            placeholder="Buscar por ID, animal, doença ou responsável..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        {carregando ? (
          <p className={styles.vazio}>Carregando notificações...</p>
        ) : filtrados.length === 0 ? (
          <p className={styles.vazio}>Nenhuma notificação cadastrada.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} ${styles.tableCompact}`}>
              <thead>
                <tr>
                  <th>ID Animal</th>
                  <th>Animal</th>
                  <th style={{ textAlign: "center" }}>Data Identificação</th>
                  <th style={{ textAlign: "center" }}>Grau de Risco</th>
                  <th style={{ textAlign: "center" }}>Risco de Vida</th>
                  <th>Responsável</th>
                  <th style={{ textAlign: "center" }}>Acompanhamento</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((z) => (
                  <tr 
                    key={z.id}
                    onClick={() => setFichaAberta(z.id)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "";
                    }}
                    title="Clique para visualizar zoonose"
                  >
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#475569" }}>
                        {z.animal?.id || "-"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.boldName}>{z.animal?.nome || "-"}</div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "0.85rem", color: "#475569" }}>
                        {formatarData(z.dataIdentificacao)}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={styles.badge}
                        style={{
                          backgroundColor: obterCorGrauRisco(z.grauRisco),
                          color: "white",
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "999px",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {z.grauRisco}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={styles.badge}
                        style={{
                          backgroundColor: obterCorRiscoVida(z.riscoVida),
                          color: "white",
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "999px",
                          fontWeight: "600",
                        }}
                      >
                        {z.riscoVida === "Sim" ? "⚠️ Sim" : "✓ Não"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.85rem", color: "#475569" }}>
                        {z.responsavelMonitoramento}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {z.periodoMonitoramento === "Sim" ? (
                        <div>
                          <div style={{ 
                            color: "#2563eb", 
                            fontWeight: "600",
                            fontSize: "0.85rem"
                          }}>
                            📅 {z.dataAgendamento ? formatarData(z.dataAgendamento) : "Agendado"}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: "1.2rem" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Ficha */}
      {fichaAberta && (
        <FichaZoonose
          zoonoseId={fichaAberta}
          onFechar={() => setFichaAberta(null)}
          onEditar={(id) => {
            setFichaAberta(null);
            onEditar?.(id);
          }}
          onExcluir={async (id) => {
            try {
              const res = await fetch(`/api/ccz/zoonoses/${id}`, {
                method: "DELETE",
              });
              
              if (res.ok) {
                // Recarrega a lista
                carregar();
              } else {
                alert("Erro ao excluir a zoonose");
              }
            } catch (error) {
              console.error("Erro ao excluir:", error);
              alert("Erro ao excluir a zoonose");
            }
          }}
        />
      )}
    </div>
  );
}
