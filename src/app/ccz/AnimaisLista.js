"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ListaCCZ.module.css";
import { listarAnimais, excluirAnimal } from "./actions";
import FichaAnimal from "./FichaAnimal";
import FichaCompletaAnimal from "./FichaCompletaAnimal";

export default function AnimaisLista({ onEditar }) {
  const [animais, setAnimais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [fichaId, setFichaId] = useState(null); // id do animal com ficha aberta
  const [fichaCompletaId, setFichaCompletaId] = useState(null); // id do animal com ficha completa aberta

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarAnimais();
    setAnimais(res.success ? res.data : []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
    carregar();
  }, [carregar]);

  const handleExcluir = async (id) => {
    const res = await excluirAnimal(id);
    if (res.success) {
      await carregar();
    } else {
      alert(res.error || "Erro ao excluir animal");
    }
  };

  const termoLimpo = termo.trim().toLowerCase();
  const filtrados = animais.filter((a) => {
    if (!termoLimpo) return true;
    return (
      (a.nome || "").toLowerCase().includes(termoLimpo) ||
      (a.id || "").toLowerCase().includes(termoLimpo) ||
      (a.especie || "").toLowerCase().includes(termoLimpo) ||
      (a.tutorNome || "").toLowerCase().includes(termoLimpo)
    );
  });

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.listaHeader}>
          <h2 className={styles.cardHeaderTitle}>
            Animais cadastrados{filtrados.length > 0 ? ` (${filtrados.length})` : ""}
          </h2>
          <input
            type="text"
            className={styles.buscaInput}
            placeholder="Buscar por nome, id, espécie ou tutor..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        {carregando ? (
          <p className={styles.vazio}>Carregando animais...</p>
        ) : filtrados.length === 0 ? (
          <p className={styles.vazio}>Nenhum animal encontrado.</p>
        ) : (
          <div className={styles.cardsGrid}>
            {filtrados.map((a) => (
              <div key={a.id} className={styles.animalCard}>
                <div className={styles.animalCardFoto}>
                  {a.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.fotoUrl}
                      alt={a.nome || "Animal"}
                      className={styles.cardFoto}
                    />
                  ) : (
                    <div className={styles.cardFotoVazia}>Sem foto</div>
                  )}
                </div>
                
                <div className={styles.animalCardBody}>
                  <div className={styles.animalCardHeader}>
                    <h3 className={styles.animalCardNome}>{a.nome || "Sem nome"}</h3>
                    <span className={styles.animalCardId}>ID: {a.id}</span>
                  </div>
                  
                  <div className={styles.animalCardInfo}>
                    <div className={styles.animalCardRow}>
                      <span className={styles.infoLabel}>Tutor:</span>
                      <span className={styles.infoValue}>
                        {a.tutorNome || <span className={styles.semTutor}>Sem tutor</span>}
                      </span>
                    </div>
                    
                    {(a.temEsporotricose || a.temZoonoses) && (
                      <div className={styles.animalCardRow}>
                        <span className={styles.infoLabel}>Doenças:</span>
                        <div className={styles.animalCardBadges}>
                          {a.temEsporotricose && (
                            <span className={styles.badgeEsporo} title="Animal tem/teve esporotricose">
                              🦠 Esporotricose
                            </span>
                          )}
                          {a.temZoonoses && (
                            <span className={styles.badgeZoonose} title="Animal tem/teve zoonoses">
                              ⚠️ Zoonose
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.animalCardFooter}>
                    <button
                      type="button"
                      className={styles.btnCardVisualizar}
                      onClick={() => setFichaId(a.id)}
                    >
                      Ver ficha
                    </button>
                    <button
                      type="button"
                      className={styles.btnCardHistorico}
                      onClick={() => setFichaCompletaId(a.id)}
                    >
                      Histórico
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {fichaId && (
        <FichaAnimal 
          animalId={fichaId} 
          onFechar={() => setFichaId(null)}
          onEditar={(id) => {
            setFichaId(null);
            onEditar(id);
          }}
          onExcluir={handleExcluir}
        />
      )}

      {fichaCompletaId && (
        <FichaCompletaAnimal
          animalId={fichaCompletaId}
          onFechar={() => setFichaCompletaId(null)}
        />
      )}
    </div>
  );
}
