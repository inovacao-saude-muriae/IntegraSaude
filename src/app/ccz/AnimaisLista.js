"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ListaCCZ.module.css";
import { listarAnimais, excluirAnimal, arquivarAnimal } from "./actions";
import FichaAnimal from "./FichaAnimal";
import FichaCompletaAnimal from "./FichaCompletaAnimal";
import { useNotify } from "@/components/ConfirmDialog";

// Opções do dropdown de filtro por situação. O value é a chave enviada à
// action (server-side); o label é o texto exibido. Critério ÚNICO por vez.
const OPCOES_FILTRO = [
  { value: "", label: "Todos" },
  { value: "ADOTADO", label: "Adotados" },
  { value: "DEVOLVIDO", label: "Devolvidos" },
  { value: "COM_TUTOR", label: "Com tutor" },
  { value: "SEM_TUTOR", label: "Sem tutor" },
  { value: "INCINERADO", label: "Incinerados" },
];

export default function AnimaisLista({
  onEditar,
  podeEditar = true, // permissão CCZ › Animais › editar
  podeCriar = false, // permissão CCZ › Animais › criar
  onNovo = null, // leva para a aba "Novo" (quando a tela tem abas)
}) {
  const notify = useNotify();
  const [animais, setAnimais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState(""); // chave do dropdown de situação
  const [fichaId, setFichaId] = useState(null); // id do animal com ficha aberta
  const [fichaCompletaId, setFichaCompletaId] = useState(null); // id do animal com ficha completa aberta
  const [incluirArquivados, setIncluirArquivados] = useState(false); // mostra também os arquivados

  // Carrega a lista no servidor combinando busca textual + filtro de situação.
  const carregar = useCallback(async (termoBusca, filtro, verArquivados) => {
    setCarregando(true);
    const res = await listarAnimais({
      termo: termoBusca,
      filtroSituacao: filtro,
      incluirArquivados: verArquivados,
    });
    setAnimais(res.success ? res.data : []);
    setCarregando(false);
  }, []);

  // Refaz a busca no servidor quando o termo ou o filtro mudam (termo com
  // debounce para evitar uma consulta a cada tecla).
  useEffect(() => {
    const t = setTimeout(() => {
      carregar(termo, filtroSituacao, incluirArquivados);
    }, 300);
    return () => clearTimeout(t);
  }, [termo, filtroSituacao, incluirArquivados, carregar]);

  // Arquivar é a saída padrão: sai da lista de trabalho, fica no banco com
  // motivo, data e autor. Excluir é permissão excepcional.
  const handleArquivar = async (id) => {
    const motivo = window.prompt(
      "Arquivar este animal?\n\nInforme o motivo (mínimo 5 caracteres):",
    );
    if (motivo === null) return;
    const res = await arquivarAnimal(id, motivo);
    if (res.success) {
      await notify({ tipo: "sucesso", message: "Animal arquivado." });
      await carregar(termo, filtroSituacao, incluirArquivados);
    } else {
      await notify({ tipo: "erro", message: res.error || "Erro ao arquivar animal" });
    }
  };

  const handleExcluir = async (id) => {
    const res = await excluirAnimal(id);
    if (res.success) {
      await carregar(termo, filtroSituacao, incluirArquivados);
    } else {
      await notify({ tipo: "erro", message: res.error || "Erro ao excluir animal" });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.listaHeader}>
          <h2 className={styles.cardHeaderTitle}>
            Animais cadastrados{animais.length > 0 ? ` (${animais.length})` : ""}
          </h2>
          <div className={styles.listaToolbar}>
            {podeCriar && onNovo && (
              <button
                type="button"
                className={styles.btnCardVisualizar}
                onClick={onNovo}
                title="Cadastrar um novo animal"
              >
                + Novo animal
              </button>
            )}
            <select
              className={styles.filtroSelect}
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              aria-label="Filtrar animais por situação"
            >
              {OPCOES_FILTRO.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: "#475569",
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={incluirArquivados}
                onChange={(e) => setIncluirArquivados(e.target.checked)}
              />
              Mostrar arquivados
            </label>
            <input
              type="text"
              className={styles.buscaInput}
              placeholder="Buscar por nome, id, espécie ou tutor..."
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
            />
          </div>
        </div>

        {carregando ? (
          <p className={styles.vazio}>Carregando animais...</p>
        ) : animais.length === 0 ? (
          <p className={styles.vazio}>Nenhum animal encontrado.</p>
        ) : (
          <div className={styles.cardsGrid}>
            {animais.map((a) => (
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

                    {/* Badge de situação: só aparece quando informada.
                        Adotado = verde, Devolvido = âmbar, CCZ = azul. */}
                    {a.situacao && (
                      <div className={styles.animalCardRow}>
                        <span className={styles.infoLabel}>Situação:</span>
                        <div className={styles.animalCardBadges}>
                          <span
                            className={
                              a.situacao === "Adotado"
                                ? styles.badgeSuccess
                                : a.situacao === "Devolvido"
                                ? styles.badgeWarning
                                : styles.badgeInfo
                            }
                            title={
                              a.situacao === "CCZ"
                                ? "Permanece no CCZ (sob custódia)"
                                : `Situação: ${a.situacao}`
                            }
                          >
                            {a.situacao === "CCZ" ? "No CCZ" : a.situacao}
                          </span>
                        </div>
                      </div>
                    )}

                    {a.temEsporotricose && (
                      <div className={styles.animalCardRow}>
                        <span className={styles.infoLabel}>Doenças:</span>
                        <div className={styles.animalCardBadges}>
                          <span
                            className={a.esporotricoseEncerrada ? styles.badgeDanger : styles.badgeSuccess}
                            title={a.esporotricoseEncerrada ? "Esporotricose: caso(s) encerrado(s)" : "Esporotricose: caso em andamento"}
                          >
                            Esporotricose: {a.esporotricoseEncerrada ? "Encerrado" : "Em andamento"}
                          </span>
                          {/* Badge de incineração: "Incinerado" se algum caso
                              tiver incinerado === "Sim"; "Não incinerado" se
                              algum caso for "Não" (e nenhum "Sim"); sem badge
                              quando não informado. */}
                          {a.esporotricoseIncinerado === "Sim" && (
                            <span
                              className={styles.badgeDanger}
                              title="Animal incinerado"
                            >
                              Incinerado
                            </span>
                          )}
                          {a.esporotricoseIncinerado === "Não" && (
                            <span
                              className={styles.badgeWarning}
                              title="Animal não incinerado"
                            >
                              Não incinerado
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
            if (podeEditar && onEditar) onEditar(id);
          }}
          onExcluir={handleExcluir}
          onArquivar={handleArquivar}
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
