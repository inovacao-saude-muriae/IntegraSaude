"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ListaCCZ.module.css";
import FichaDenuncia from "./FichaDenuncia";
import { useNotify } from "@/components/ConfirmDialog";

const TITULOS_POR_TIPO = {
  AGRESSIVO: "Denúncias de Animais Agressivos",
  DOENTE: "Denúncias de Animais Doentes",
};

export default function DenunciasLista({ onEditar, tipo = "AGRESSIVO" }) {
  const notify = useNotify();
  const [denuncias, setDenuncias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [fichaAberta, setFichaAberta] = useState(null);
  const [incluirArquivadas, setIncluirArquivadas] = useState(false);

  const titulo = TITULOS_POR_TIPO[tipo] || TITULOS_POR_TIPO.AGRESSIVO;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(
        `/api/ccz/denuncias?tipo=${encodeURIComponent(tipo)}` +
          (incluirArquivadas ? "&incluirArquivadas=true" : ""),
      );
      if (res.ok) {
        const data = await res.json();
        setDenuncias(data);
      }
    } catch (error) {
      console.error("Erro ao carregar denúncias:", error);
    } finally {
      setCarregando(false);
    }
  }, [tipo, incluirArquivadas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
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
            {titulo}{filtrados.length > 0 ? ` (${filtrados.length})` : ""}
          </h2>
          <input
            type="text"
            className={styles.buscaInput}
            placeholder="Buscar por ID, animal, descrição ou localização..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "#475569",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <input
              type="checkbox"
              checked={incluirArquivadas}
              onChange={(e) => setIncluirArquivadas(e.target.checked)}
            />
            Mostrar arquivadas
          </label>
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
                  <th style={{ textAlign: "center" }}>Ações</th>
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
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        title="Tira a denúncia da lista sem apagar o registro"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const motivo = window.prompt(
                            "Arquivar esta denúncia?\n\nInforme o motivo (mínimo 5 caracteres):",
                          );
                          if (motivo === null) return;
                          const res = await fetch(`/api/ccz/denuncias/${d.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ motivo }),
                          });
                          const dados = await res.json().catch(() => ({}));
                          if (res.ok) {
                            await notify({ tipo: "sucesso", message: "Denúncia arquivada." });
                            carregar();
                          } else {
                            await notify({
                              tipo: "erro",
                              message: dados.error || "Erro ao arquivar a denúncia.",
                            });
                          }
                        }}
                        style={{
                          padding: "0.3rem 0.7rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          border: "1px solid #e5c46b",
                          background: "#fff8e6",
                          color: "#7a5600",
                          borderRadius: "8px",
                          cursor: "pointer",
                        }}
                      >
                        Arquivar
                      </button>
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
                await notify({ tipo: "erro", message: "Erro ao excluir a denúncia" });
              }
            } catch (error) {
              console.error("Erro ao excluir:", error);
              await notify({ tipo: "erro", message: "Erro ao excluir a denúncia" });
            }
          }}
        />
      )}
    </div>
  );
}
