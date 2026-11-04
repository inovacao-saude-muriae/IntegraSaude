"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ListaCCZ.module.css";
import { documentoPaciente } from "@/app/regulacao/constants";
import { mascararTelefone } from "@/lib/telefone";
import { listarTutoresComAnimais } from "./actions";
import FichaTutor from "./FichaTutor";

export default function TutoresLista({ onEditar }) {
  const [tutores, setTutores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [cpfFicha, setCpfFicha] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarTutoresComAnimais();
    setTutores(res.success ? res.data : []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
    carregar();
  }, [carregar]);

  const termoLimpo = termo.trim().toLowerCase();
  const termoDigitos = termo.replace(/\D/g, "");
  const filtrados = tutores.filter((t) => {
    if (!termoLimpo) return true;
    const nome = (t.nome || "").toLowerCase();
    const cpf = (t.cpf || "").replace(/\D/g, "");
    return nome.includes(termoLimpo) || (termoDigitos && cpf.includes(termoDigitos));
  });

  // Monta "Nome (Id)" de cada animal do tutor (usa "Sem nome" quando não há nome).
  const nomesAnimais = (animais) =>
    (animais || [])
      .map((a) => `${a.nome?.trim() || "Sem nome"} (${a.id})`)
      .join(", ");

  const handleExcluir = async (cpf) => {
    try {
      const res = await fetch(`/api/ccz/tutores/${cpf}`, { method: "DELETE" });
      if (res.ok) {
        await carregar();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir tutor");
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir tutor");
    }
  };

  return (
    <>
      {cpfFicha && (
        <FichaTutor
          cpf={cpfFicha}
          onFechar={() => setCpfFicha(null)}
          onEditar={(cpf) => {
            setCpfFicha(null);
            onEditar(cpf);
          }}
          onExcluir={handleExcluir}
        />
      )}

      <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.listaHeader}>
          <h2 className={styles.cardHeaderTitle}>
            Tutores cadastrados{filtrados.length > 0 ? ` (${filtrados.length})` : ""}
          </h2>
          <input
            type="text"
            className={styles.buscaInput}
            placeholder="Buscar por nome ou CPF..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        {carregando ? (
          <p className={styles.vazio}>Carregando tutores...</p>
        ) : filtrados.length === 0 ? (
          <p className={styles.vazio}>Nenhum tutor encontrado.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} ${styles.tableCompact}`}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF / CNS</th>
                  <th>Telefone</th>
                  <th>Animais</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr 
                    key={t.pessoaCpf}
                    onClick={() => setCpfFicha(t.pessoaCpf)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "";
                    }}
                    title="Clique para visualizar tutor"
                  >
                    <td className={styles.boldName}>{t.nome}</td>
                    <td>{documentoPaciente({ cpf: t.cpf, cns: t.cns })}</td>
                    <td>{t.telefone ? mascararTelefone(t.telefone) : "-"}</td>
                    <td>
                      {t.animais.length > 0 ? (
                        nomesAnimais(t.animais)
                      ) : (
                        <span className={styles.semTutor}>Nenhum</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
