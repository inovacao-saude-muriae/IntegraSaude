"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./AgendaCCZ.module.css";
import { getAgendaProcedimentos } from "./actions";
import RelatorioVisitaEsporotricose from "./RelatorioVisitaEsporotricose";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Date -> 'YYYY-MM-DD' sem efeito de fuso.
const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
};

const formatarDiaBR = (ymd) => {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
};

export default function AgendaCCZ({ onAbrirProcedimento }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1); // 1-12
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [visitaSelecionada, setVisitaSelecionada] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await getAgendaProcedimentos(ano, mes);
    setEventos(res.success ? res.data : []);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const irMes = (delta) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    } else if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    }
    setMes(novoMes);
    setAno(novoAno);
  };

  // Grade do mês (semanas domingo a sábado).
  const primeiroDia = new Date(ano, mes - 1, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const offsetInicio = primeiroDia.getDay();

  const celulas = [];
  for (let i = 0; i < offsetInicio; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(new Date(ano, mes - 1, d));
  while (celulas.length % 7 !== 0) celulas.push(null);

  const eventosPorDia = eventos.reduce((acc, e) => {
    (acc[e.data] = acc[e.data] || []).push(e);
    return acc;
  }, {});

  const ymdHoje = toYMD(hoje);

  const rotuloEvento = (e) => {
    if (e.tipoEvento === "ESPORO_VISITA") {
      return e.label || `Esporotricose — ${e.animalNome || "Sem nome"}`;
    }
    return `${e.tipoEvento === "RETORNO" ? "Retorno" : e.tipo} — ${e.animalNome || "Sem nome"}`;
  };

  // Classe de cor do evento conforme o tipo.
  const classeEvento = (e) => {
    if (e.tipoEvento === "RETORNO") return styles.eventRetorno;
    if (e.tipoEvento === "ESPORO_VISITA") return styles.eventEsporo;
    return "";
  };

  const eventosDoDiaModal = diaSelecionado
    ? eventosPorDia[diaSelecionado] || []
    : [];

  const abrirRelatorioVisita = (evento) => {
    if (evento.tipoEvento === "ESPORO_VISITA" && evento.visitaId) {
      setVisitaSelecionada({
        visitaId: evento.visitaId,
        animalNome: evento.animalNome || "Sem nome",
        tutorNome: evento.tutorNome || "Sem tutor",
        dataVisita: formatarDiaBR(evento.data),
      });
      setDiaSelecionado(null); // Fecha o modal do dia
    }
  };

  return (
    <div className={styles.card}>
      {/* CABEÇALHO COM NAVEGAÇÃO DE MÊS */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>
            Agenda <span className={styles.badgeServico}>Procedimentos</span>
          </h3>
          <p className={styles.subtitle}>
            Procedimentos agendados e retornos. Clique em um dia para ver os detalhes.
          </p>
        </div>
        <div className={styles.monthNav}>
          <button type="button" onClick={() => irMes(-1)} className={styles.navBtn}>‹</button>
          <span className={styles.monthLabel}>{MESES[mes - 1]} {ano}</span>
          <button type="button" onClick={() => irMes(1)} className={styles.navBtn}>›</button>
        </div>
      </div>

      {/* LEGENDA */}
      <div className={styles.legenda}>
        <span className={styles.legProc}>Agendado</span>
        <span className={styles.legRet}>Retorno</span>
        <span className={styles.legEsporo}>Esporotricose</span>
      </div>

      {/* CABEÇALHO DOS DIAS DA SEMANA */}
      <div className={styles.weekHeader}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className={styles.weekDay}>{d}</div>
        ))}
      </div>

      {/* GRADE DO CALENDÁRIO */}
      <div className={styles.grid}>
        {celulas.map((dateObj, idx) => {
          if (!dateObj) return <div key={`e-${idx}`} className={styles.emptyCell} />;
          const ymd = toYMD(dateObj);
          const doDia = eventosPorDia[ymd] || [];
          const ehHoje = ymd === ymdHoje;
          return (
            <div
              key={ymd}
              className={`${styles.dayCell} ${ehHoje ? styles.today : ""}`}
              onClick={() => setDiaSelecionado(ymd)}
            >
              <div className={styles.dayNumber}>{dateObj.getDate()}</div>
              <div className={styles.events}>
                {doDia.slice(0, 4).map((e, i) => (
                  <div
                    key={`${e.procedimentoId || "esporo"}-${e.tipoEvento}-${i}`}
                    className={`${styles.event} ${classeEvento(e)}`}
                    title={rotuloEvento(e)}
                  >
                    {rotuloEvento(e)}
                  </div>
                ))}
                {doDia.length > 4 && (
                  <div className={styles.moreEvents}>+{doDia.length - 4} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && <div className={styles.loadingBox}>Carregando agenda...</div>}

      {/* MODAL DO DIA */}
      {diaSelecionado && (
        <div className={styles.modalOverlay} onClick={() => setDiaSelecionado(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Agenda do dia</h3>
                <p className={styles.modalSubtitle}>{formatarDiaBR(diaSelecionado)}</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDiaSelecionado(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {eventosDoDiaModal.length === 0 ? (
                <p className={styles.vazioModal}>Nenhum evento neste dia.</p>
              ) : (
                <div className={styles.diaList}>
                  {eventosDoDiaModal.map((e, i) => (
                    <div
                      key={`${e.procedimentoId || "esporo"}-${e.tipoEvento}-${i}`}
                      className={styles.diaItem}
                    >
                      <div>
                        <strong>
                          {e.tipoEvento === "ESPORO_VISITA"
                            ? "Esporotricose · acompanhamento"
                            : e.tipoEvento === "RETORNO"
                              ? `Retorno · ${e.tipo}`
                              : e.tipo}
                        </strong>
                        <div className={styles.diaItemSub}>
                          {e.animalNome || "Sem nome"} ({e.animalId})
                          {e.tutorNome ? ` · ${e.tutorNome}` : ""}
                          {e.veterinario ? ` · Vet.: ${e.veterinario}` : ""}
                          {e.tipoEvento === "ESPORO_VISITA" && e.observacao
                            ? ` · ${e.observacao}`
                            : ""}
                        </div>
                      </div>
                      {e.tipoEvento === "ESPORO_VISITA" ? (
                        e.temRelatorio ? (
                          <button
                            type="button"
                            className={styles.verBtnPreenchido}
                            onClick={() => abrirRelatorioVisita(e)}
                          >
                            ✓ Preenchido
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.verBtn}
                            onClick={() => abrirRelatorioVisita(e)}
                          >
                            Relatório
                          </button>
                        )
                      ) : onAbrirProcedimento && e.procedimentoId ? (
                        <button
                          type="button"
                          className={styles.verBtn}
                          onClick={() => onAbrirProcedimento(e.procedimentoId)}
                        >
                          Abrir
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RELATÓRIO DE VISITA */}
      {visitaSelecionada && (
        <RelatorioVisitaEsporotricose
          visitaId={visitaSelecionada.visitaId}
          animalNome={visitaSelecionada.animalNome}
          tutorNome={visitaSelecionada.tutorNome}
          dataVisita={visitaSelecionada.dataVisita}
          onFechar={() => setVisitaSelecionada(null)}
          onSalvo={() => {
            setVisitaSelecionada(null);
            carregar(); // Recarrega a agenda
          }}
        />
      )}
    </div>
  );
}
