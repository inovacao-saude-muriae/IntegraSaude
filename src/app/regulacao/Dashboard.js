"use client";

import { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";
import FiltroAno from "@/components/FiltroAno/FiltroAno";
import { getPedidosDashboard } from "./actions";

const brl = (v) =>
  `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Converte DD/MM/YYYY ou ISO em Date (ou null).
const parseData = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const diffDias = (ini, fim) => {
  if (!ini || !fim) return null;
  return Math.max(0, Math.round((fim - ini) / (1000 * 60 * 60 * 24)));
};

export default function Dashboard({ auxData = {}, setActiveTab }) {
  const tiposExame = auxData.tiposExame || [];
  const [filtroExame, setFiltroExame] = useState(""); // "" = Todos

  // FILTRO DE ANO GLOBAL: os pedidos são buscados no servidor já filtrados
  // pelo ano da data de solicitação (ver getPedidosDashboard em actions.js).
  // Default: ano atual; "todos" = sem filtro.
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [requests, setRequests] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Recarrega os indicadores sempre que o ano muda.
  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const res = await getPedidosDashboard(anoSelecionado);
        if (cancelado) return;
        setRequests(res.success ? res.data : []);
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [anoSelecionado]);

  // Aplica o filtro por tipo de exame (compara por id ou nome).
  const dadosFiltrados = filtroExame
    ? requests.filter((r) => {
        const alvo = tiposExame.find((t) => String(t.id) === String(filtroExame));
        if (!alvo) return true;
        return (
          String(r.examTypeId) === String(alvo.id) ||
          r.examType?.toLowerCase().trim() === alvo.nome?.toLowerCase().trim()
        );
      })
    : requests;

  const liberados = dadosFiltrados.filter((r) => r.status === "Liberado");
  const aguardando = dadosFiltrados.filter((r) => r.status === "Aguardando");
  const cancelados = dadosFiltrados.filter((r) => r.status === "Cancelado");
  const devolvidos = dadosFiltrados.filter((r) => r.status === "Devolvido");

  const totalGeral = dadosFiltrados.length;
  const totalAguardando = aguardando.length;
  const totalLiberados = liberados.length;

  // Taxa de liberação sobre o total de solicitações.
  const taxaLiberacao = totalGeral ? (totalLiberados / totalGeral) * 100 : 0;

  // Valor total autorizado (soma do custo estimado dos liberados).
  const valorTotalLiberado = liberados.reduce((s, r) => s + (Number(r.estimatedCost) || 0), 0);

  // Tempo médio de espera (dias) entre pedido e liberação.
  const temposEspera = liberados
    .map((r) => diffDias(parseData(r.requestDateRaw || r.requestDate), parseData(r.releaseDateRaw || r.releaseDate)))
    .filter((n) => n !== null);
  const tempoMedioEspera = temposEspera.length
    ? Math.round(temposEspera.reduce((a, b) => a + b, 0) / temposEspera.length)
    : 0;

  // ── PONTOS DE ATENÇÃO (AUDITORIA) ──────────────────────────────────────
  const semRegulador = liberados.filter((r) => !r.regulatorDoctorId && !r.regulatorDoctor).length;
  const semCompetencia = liberados.filter((r) => !r.quotaCompetenceMonth || !r.quotaCompetenceYear).length;
  const semCota = liberados.filter((r) => !r.quota).length;
  const semComunicacao = liberados.filter((r) => !r.communicationDate && !r.communicationStatus).length;
  const urgentesNaFila = aguardando.filter((r) => r.classification === "Vermelho").length;

  const alertas = [
    { label: "Liberados sem médico regulador", valor: semRegulador },
    { label: "Liberados sem competência definida", valor: semCompetencia },
    { label: "Liberados sem tipo de cota", valor: semCota },
    { label: "Liberados sem comunicação registrada", valor: semComunicacao },
    { label: "Urgências (Vermelho) ainda na fila", valor: urgentesNaFila },
  ];
  const totalAlertas = alertas.reduce((s, a) => s + a.valor, 0);

  // ── FINANCEIRO POR COTA (valor liberado somado) ────────────────────────
  const cotasMap = {};
  for (const r of liberados) {
    const cota = (r.quota || "Sem cota").toUpperCase();
    if (!cotasMap[cota]) cotasMap[cota] = { qtd: 0, valor: 0 };
    cotasMap[cota].qtd += 1;
    cotasMap[cota].valor += Number(r.estimatedCost) || 0;
  }
  const financeiroPorCota = Object.entries(cotasMap)
    .map(([cota, d]) => ({ cota, ...d }))
    .sort((a, b) => b.valor - a.valor);

  // ── PRODUTIVIDADE POR MÉDICO REGULADOR ─────────────────────────────────
  const regMap = {};
  for (const r of liberados) {
    const nome = r.regulatorDoctor || "— Não informado —";
    if (!regMap[nome]) regMap[nome] = { qtd: 0, valor: 0 };
    regMap[nome].qtd += 1;
    regMap[nome].valor += Number(r.estimatedCost) || 0;
  }
  const produtividadeReguladores = Object.entries(regMap)
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 6);

  // ── DISTRIBUIÇÕES POR RISCO ─────────────────────────────────────────────
  const contarRisco = (lista, cor) => lista.filter((r) => r.classification === cor).length;
  const filaRisco = {
    Vermelho: contarRisco(aguardando, "Vermelho"),
    Amarelo: contarRisco(aguardando, "Amarelo"),
    Verde: contarRisco(aguardando, "Verde"),
  };

  // Tipo de exame (fila)
  const examTypeCountsFila = (auxData.tiposExame || []).map((tipo) => ({
    nome: tipo.nome,
    count: aguardando.filter(
      (r) =>
        r.examType?.toLowerCase().trim() === tipo.nome?.toLowerCase().trim() ||
        String(r.examTypeId) === String(tipo.id)
    ).length,
  }));

  return (
    <div className={styles.container}>
      {/* BANNER */}
      <div className={styles.welcomeBanner}>
        <div>
          <h2>Painel de Auditoria — Regulação</h2>
          <p>Indicadores de conformidade, financeiro e produtividade das solicitações de exames.</p>
        </div>
        <div className={styles.bannerActions}>
          <div className={styles.examFilter}>
            <label htmlFor="dashExameFiltro">Tipo de Exame</label>
            <select
              id="dashExameFiltro"
              value={filtroExame}
              onChange={(e) => setFiltroExame(e.target.value)}
            >
              <option value="">Todos os exames</option>
              {tiposExame.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <button type="button" className={styles.newRequestBtn} onClick={() => setActiveTab("LISTA_ESPERA")}>
            Ver fila de espera
          </button>
        </div>
      </div>

      {/* FILTRO DE ANO GLOBAL (pelo ano da data de solicitação do pedido) */}
      <FiltroAno
        valor={anoSelecionado}
        onChange={setAnoSelecionado}
        dica={carregando ? "Carregando..." : "Pedidos considerados pela data de solicitação"}
      />

      {/* KPIs DE AUDITORIA */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Total de Solicitações</span>
            <div className={`${styles.iconBox} ${styles.indigoIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{totalGeral}<span className={styles.kpiUnit}>registros</span></div>
          <div className={styles.kpiFooter}>Pedidos do período selecionado</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => setActiveTab("LIBERADOS")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Taxa de Liberação</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{taxaLiberacao.toFixed(1)}<span className={styles.kpiUnit}>%</span></div>
          <div className={styles.kpiFooter}>{totalLiberados} liberados de {totalGeral}</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Valor Autorizado</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
          <div className={styles.kpiValue} style={{ fontSize: "1.4rem" }}>{brl(valorTotalLiberado)}</div>
          <div className={styles.kpiFooter}>Soma dos exames liberados</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Tempo Médio de Espera</span>
            <div className={`${styles.iconBox} ${styles.yellowIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{tempoMedioEspera}<span className={styles.kpiUnit}>dias</span></div>
          <div className={styles.kpiFooter}>Do pedido até a liberação</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => setActiveTab("LISTA_ESPERA")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Fila de Espera</span>
            <div className={`${styles.iconBox} ${styles.yellowIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{totalAguardando}<span className={styles.kpiUnit}>pacientes</span></div>
          <div className={styles.kpiFooter}>Aguardando regulação</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Cancelados / Devolvidos</span>
            <div className={`${styles.iconBox} ${styles.redIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{cancelados.length + devolvidos.length}<span className={styles.kpiUnit}>casos</span></div>
          <div className={styles.kpiFooter}>{cancelados.length} cancelados · {devolvidos.length} devolvidos</div>
        </div>
      </section>

      {/* PONTOS DE ATENÇÃO (AUDITORIA) */}
      <div className={styles.panelCard}>
        <div className={styles.panelHeader}>
          <h3>Pontos de Atenção para Auditoria</h3>
          <span className={styles.cardSubtitle}>
            {totalAlertas === 0
              ? "Nenhuma inconsistência encontrada nos registros liberados."
              : `${totalAlertas} ocorrência(s) que merecem revisão.`}
          </span>
        </div>
        <div className={styles.auditGrid}>
          {alertas.map((a) => (
            <div
              key={a.label}
              className={`${styles.auditItem} ${a.valor > 0 ? styles.auditWarn : styles.auditOk}`}
            >
              <span className={styles.auditValue}>{a.valor}</span>
              <span className={styles.auditLabel}>{a.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FINANCEIRO POR COTA + PRODUTIVIDADE DOS REGULADORES */}
      <div className={styles.contentGrid}>
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Valor Autorizado por Cota</h3>
            <span className={styles.cardSubtitle}>Total liberado agrupado por tipo de cota</span>
          </div>
          <div className={styles.examTypeList}>
            {financeiroPorCota.length === 0 ? (
              <div className={styles.emptyRow}>Nenhum exame liberado ainda.</div>
            ) : (
              financeiroPorCota.map((c) => (
                <div key={c.cota} className={styles.examTypeRow}>
                  <span>{c.cota} <small style={{ color: "#94a3b8" }}>({c.qtd})</small></span>
                  <span className={styles.examCountBadgeSuccess}>{brl(c.valor)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Produtividade dos Reguladores</h3>
            <span className={styles.cardSubtitle}>Liberações por médico regulador</span>
          </div>
          <div className={styles.examTypeList}>
            {produtividadeReguladores.length === 0 ? (
              <div className={styles.emptyRow}>Nenhuma liberação registrada.</div>
            ) : (
              produtividadeReguladores.map((m) => (
                <div key={m.nome} className={styles.examTypeRow}>
                  <span>{m.nome}</span>
                  <span className={styles.examCountBadge}>{m.qtd} · {brl(m.valor)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DISTRIBUIÇÃO POR RISCO (FILA) + TIPO DE EXAME (FILA) */}
      <div className={styles.contentGrid}>
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Fila por Classificação de Risco</h3>
            <span className={styles.cardSubtitle}>Pacientes aguardando regulação</span>
          </div>
          <div className={styles.riskProgressList}>
            {[
              { label: "Vermelho (Urgente)", badge: styles.redBadge, cor: "#dc2626", valor: filaRisco.Vermelho },
              { label: "Amarelo (Prioritário)", badge: styles.yellowBadge, cor: "#d97706", valor: filaRisco.Amarelo },
              { label: "Verde (Eletivo)", badge: styles.greenBadge, cor: "#16a34a", valor: filaRisco.Verde },
            ].map((r) => (
              <div key={r.label} className={styles.riskItem}>
                <div className={styles.riskHeader}>
                  <span className={`${styles.riskBadge} ${r.badge}`}>{r.label}</span>
                  <strong>{r.valor} pacientes</strong>
                </div>
                <div className={styles.progressBarBg}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${totalAguardando ? (r.valor / totalAguardando) * 100 : 0}%`, backgroundColor: r.cor }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Fila por Tipo de Exame</h3>
            <span className={styles.cardSubtitle}>Solicitações aguardando por tipo</span>
          </div>
          <div className={styles.examTypeList}>
            {examTypeCountsFila.map((item) => (
              <div key={item.nome} className={styles.examTypeRow}>
                <span>{item.nome}</span>
                <span className={styles.examCountBadge}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
