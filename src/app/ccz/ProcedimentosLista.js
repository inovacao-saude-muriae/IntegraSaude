"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ListaCCZ.module.css";
import { listarProcedimentos, excluirProcedimento } from "./actions";
import TermoInternacao from "./TermoInternacao";
import FichaProcedimento from "./FichaProcedimento";

const formatarData = (ymd) =>
  ymd ? ymd.split("-").reverse().join("/") : "-";

export default function ProcedimentosLista({ onEditar }) {
  const [procedimentos, setProcedimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [termoInternacaoId, setTermoInternacaoId] = useState(null); // procId do termo aberto
  const [fichaId, setFichaId] = useState(null); // ID do procedimento com ficha aberta

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarProcedimentos();
    setProcedimentos(res.success ? res.data : []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleExcluir = async (id) => {
    const res = await excluirProcedimento(id);
    if (res.success) {
      await carregar();
    } else {
      alert(res.error || "Erro ao excluir procedimento");
    }
  };

  const termoLimpo = termo.trim().toLowerCase();
  const filtrados = procedimentos.filter((p) => {
    if (!termoLimpo) return true;
    return (
      (p.animalNome || "").toLowerCase().includes(termoLimpo) ||
      (p.animalId || "").toLowerCase().includes(termoLimpo) ||
      (p.tutorNome || "").toLowerCase().includes(termoLimpo) ||
      (p.tipo || "").toLowerCase().includes(termoLimpo) ||
      (p.status || "").toLowerCase().includes(termoLimpo)
    );
  });

  const classeStatus = (status) => {
    if (status === "Realizado") return styles.statusRealizado;
    if (status === "Cancelado") return styles.statusCancelado;
    return styles.statusAgendado;
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.listaHeader}>
          <h2 className={styles.cardHeaderTitle}>
            Procedimentos{filtrados.length > 0 ? ` (${filtrados.length})` : ""}
          </h2>
          <input
            type="text"
            className={styles.buscaInput}
            placeholder="Buscar por animal, ID, tipo ou status..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        {carregando ? (
          <p className={styles.vazio}>Carregando procedimentos...</p>
        ) : filtrados.length === 0 ? (
          <p className={styles.vazio}>Nenhum procedimento encontrado.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} ${styles.tableCompact}`}>
              <thead>
                <tr>
                  <th>ID Animal</th>
                  <th>Animal</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Veterinário</th>
                  <th>Retorno</th>
                  <th>Termo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr 
                    key={p.id}
                    onClick={() => setFichaId(p.id)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "";
                    }}
                    title="Clique para visualizar procedimento"
                  >
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#475569" }}>
                        {p.animalId}
                      </span>
                    </td>
                    <td>
                      <span className={styles.boldName}>
                        {p.animalNome || "Sem nome"}
                      </span>
                    </td>
                    <td>{p.tipo}</td>
                    <td>{formatarData(p.dataProcedimento)}</td>
                    <td>
                      <span className={classeStatus(p.status)}>{p.status}</span>
                    </td>
                    <td>{p.veterinario || "-"}</td>
                    <td>{p.dataRetorno ? formatarData(p.dataRetorno) : "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      {p.tipo === "Internação" ? (
                        <button
                          type="button"
                          className={styles.btnFicha}
                          onClick={(e) => {
                            e.stopPropagation(); // Impede que o clique abra a edição
                            setTermoInternacaoId(p.id);
                          }}
                        >
                          Ver termo
                        </button>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {termoInternacaoId && (
        <TermoInternacao
          procedimentoId={termoInternacaoId}
          onFechar={() => setTermoInternacaoId(null)}
        />
      )}

      {fichaId && (
        <FichaProcedimento
          procedimentoId={fichaId}
          onFechar={() => setFichaId(null)}
          onEditar={(id) => {
            setFichaId(null);
            onEditar(id);
          }}
          onExcluir={handleExcluir}
        />
      )}
    </div>
  );
}
