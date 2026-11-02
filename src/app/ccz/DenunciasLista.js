"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ListaCCZ.module.css";
import FichaDenuncia from "./FichaDenuncia";

export default function DenunciasLista({ onEditar }) {
  const [denuncias, setDenuncias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [fichaAberta, setFichaAberta] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/ccz/denuncias");
      if (res.ok) {
        const data = await res.json();
        setDenuncias(data);
      }
    } catch (error) {
      console.error("Erro ao carregar denúncias:", error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const termoLimpo = termo.trim().toLowerCase();
  const filtrados = denuncias.filter((d) => {
    if (!termoLimpo) return true;
    return (
      (d.id || "").toLowerCase().includes(termoLimpo) ||
      (d.animal?.nome || "").toLowerCase().includes(termoLimpo) ||
      (d.descricaoCao || "").toLowerCase().includes(termoLimpo) ||
      (d.logradouro || "").toLowerCase().includes(termoLimpo) ||
      (d.bairro || "").toLowerCase().includes(termoLimpo)
    );
  });

  function formatarData(data) {
    if (!data) return "-";
    const d = new Date(data);
    return d.toLocaleDateString("pt-BR");
  }

  function formatarEndereco(d) {
    const partes = [];
    if (d.logradouro) partes.push(d.logradouro);
    if (d.numero) partes.push(d.numero);
    if (d.bairro) partes.push(d.bairro);
    return partes.join(", ") || "-";
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.listaHeader}>
          <h2 className={styles.cardHeaderTitle}>
            Denúncias de Cães Agressivos{filtrados.length > 0 ? ` (${filtrados.length})` : ""}
          </h2>
          <input
            type="text"
            className={styles.buscaInput}
            placeholder="Buscar por ID, animal, descrição ou localização..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        {carregando ? (
          <p className={styles.vazio}>Carregando denúncias...</p>
        ) : filtrados.length === 0 ? (
          <p className={styles.vazio}>Nenhuma denúncia cadastrada.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} ${styles.tableCompact}`}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome do Animal</th>
                  <th>Data da Denúncia</th>
                  <th>Localização</th>
                  <th style={{ textAlign: "center" }}>Causou Risco</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr 
                    key={d.id}
                    onClick={() => setFichaAberta(d.id)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "";
                    }}
                    title="Clique para visualizar denúncia"
                  >
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#2563eb", fontWeight: "600" }}>
                        {d.id}
                      </span>
                    </td>
                    <td>
                      <span className={styles.boldName}>{d.animal?.nome || "Sem animal vinculado"}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.85rem", color: "#475569" }}>
                        {formatarData(d.dataDenuncia)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.85rem", color: "#475569" }}>
                        {formatarEndereco(d)}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={styles.badge}
                        style={{
                          backgroundColor: d.causouRisco === "Sim" ? "#ef4444" : "#10b981",
                          color: "white",
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "999px",
                          fontWeight: "600",
                        }}
                      >
                        {d.causouRisco === "Sim" ? "⚠️ Sim" : "✓ Não"}
                      </span>
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
        <FichaDenuncia
          denunciaId={fichaAberta}
          onFechar={() => setFichaAberta(null)}
          onEditar={(id) => {
            setFichaAberta(null);
            onEditar?.(id);
          }}
          onExcluir={async (id) => {
            try {
              const res = await fetch(`/api/ccz/denuncias/${id}`, {
                method: "DELETE",
              });
              
              if (res.ok) {
                carregar();
              } else {
                alert("Erro ao excluir a denúncia");
              }
            } catch (error) {
              console.error("Erro ao excluir:", error);
              alert("Erro ao excluir a denúncia");
            }
          }}
        />
      )}
    </div>
  );
}
