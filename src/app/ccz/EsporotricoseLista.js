"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ListaCCZ.module.css";
import { listarEsporotricose, obterEsporotricose } from "./actions";
import { gerarPdfEsporotricose } from "./esporotricosePdf";
import FichaEsporotricose from "./FichaEsporotricose";

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");

export default function EsporotricoseLista({ onEditar }) {
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [fichaAberta, setFichaAberta] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarEsporotricose();
    setRegistros(res.success ? res.data : []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
    carregar();
  }, [carregar]);

  const termoLimpo = termo.trim().toLowerCase();
  const filtrados = registros.filter((r) => {
    if (!termoLimpo) return true;
    return (
      (r.animalNome || "").toLowerCase().includes(termoLimpo) ||
      (r.animalId || "").toLowerCase().includes(termoLimpo) ||
      (r.tutorNome || "").toLowerCase().includes(termoLimpo)
    );
  });

  // Baixa o relatório completo do registro.
  const baixarPdf = async (id) => {
    const res = await obterEsporotricose(id);
    if (res.success) gerarPdfEsporotricose(res.data);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.listaHeader}>
          <h2 className={styles.cardHeaderTitle}>
            Esporotricose{filtrados.length > 0 ? ` (${filtrados.length})` : ""}
          </h2>
          <input
            type="text"
            className={styles.buscaInput}
            placeholder="Buscar por animal ou ID..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        {carregando ? (
          <p className={styles.vazio}>Carregando registros...</p>
        ) : filtrados.length === 0 ? (
          <p className={styles.vazio}>Nenhum registro de esporotricose encontrado.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} ${styles.tableCompact}`}>
              <thead>
                <tr>
                  <th>ID Animal</th>
                  <th>Animal</th>
                  <th>Data da visita</th>
                  <th>Lesões</th>
                  <th>Nº visitas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr 
                    key={r.id}
                    onClick={() => setFichaAberta(r.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#475569" }}>
                        {r.animalId}
                      </span>
                    </td>
                    <td>
                      <span className={styles.boldName}>
                        {r.animalNome || "Sem nome"}
                      </span>
                    </td>
                    <td>{formatarData(r.dataVisita)}</td>
                    <td>{r.apresentaLesoes || "Não"}</td>
                    <td>
                      <span className={styles.badge}>{r.visitasCount}</span>
                    </td>
                    <td>
                      <span className={r.encerrado ? styles.badgeDanger : styles.badgeSuccess}>
                        {r.encerrado ? "Encerrado" : "Em andamento"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Ficha Completa */}
      {fichaAberta && (
        <FichaEsporotricose
          esporotricoseId={fichaAberta}
          onFechar={() => setFichaAberta(null)}
          onEditar={(id) => {
            setFichaAberta(null);
            onEditar(id);
          }}
          onBaixarFicha={baixarPdf}
        />
      )}
    </div>
  );
}
