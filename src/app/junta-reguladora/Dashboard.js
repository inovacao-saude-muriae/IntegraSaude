"use client";

import { useState, useEffect } from "react";
import styles from "./Dashboard.module.css";
import FiltroAno from "@/components/FiltroAno/FiltroAno";

export default function JuntaDashboard() {
  const [dados, setDados] = useState({
    totalPacientes: 0,
    totalAtendimentos: 0,
    totalAgendamentos: 0,
    pacientesPorServico: [],
    atendimentosPorMes: [],
    atendimentosPorServico: [],
    proximosAgendamentos: [],
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // FILTRO DE ANO GLOBAL. Default: ano atual; "todos" = sem filtro.
  // O ano vai para a rota como ?ano= e é filtrado no servidor
  // (regras de data por indicador documentadas na rota).
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  // Recarrega os indicadores sempre que o ano muda.
  useEffect(() => {
    let cancelado = false;
    async function carregarDados() {
      setCarregando(true);
      setErro("");
      try {
        const res = await fetch(`/api/junta-reguladora/dashboard?ano=${encodeURIComponent(anoSelecionado)}`);
        if (!res.ok) {
          throw new Error("Erro ao carregar dados do dashboard");
        }
        const data = await res.json();
        if (!cancelado) setDados(data);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        if (!cancelado) setErro(error.message);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregarDados();
    return () => {
      cancelado = true;
    };
  }, [anoSelecionado]);

  const filtroAno = (
    <FiltroAno
      valor={anoSelecionado}
      onChange={setAnoSelecionado}
      dica="Serviços ativos e próximos agendamentos mostram a posição atual e não variam com o ano."
    />
  );

  if (carregando) {
    return (
      <div className={styles.container}>
        {filtroAno}
        <div className={styles.loading}>Carregando dashboard...</div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className={styles.container}>
        {filtroAno}
        <div className={styles.error}>Erro: {erro}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>Dashboard</h2>
      {filtroAno}

      {/* KPIs */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Total de Pacientes</span>
            <div className={`${styles.iconBox} ${styles.blueIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{dados.totalPacientes}<span className={styles.kpiUnit}>registros</span></div>
          <div className={styles.kpiFooter}>Cadastrados no período selecionado</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Atendimentos Realizados</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
                <path d="M10 9H8" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{dados.totalAtendimentos}<span className={styles.kpiUnit}>registros</span></div>
          <div className={styles.kpiFooter}>Realizados no período selecionado</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Agendamentos Ativos</span>
            <div className={`${styles.iconBox} ${styles.yellowIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{dados.totalAgendamentos}<span className={styles.kpiUnit}>registros</span></div>
          <div className={styles.kpiFooter}>Próximos atendimentos no período</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Serviços Ativos</span>
            <div className={`${styles.iconBox} ${styles.indigoIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{dados.totalServicosAtivos ?? dados.pacientesPorServico.length}<span className={styles.kpiUnit}>registros</span></div>
          <div className={styles.kpiFooter}>CAEE, APAE, Ambulatório, etc · posição atual</div>
        </div>
      </section>

      {/* PACIENTES POR SERVIÇO + ATENDIMENTOS POR SERVIÇO */}
      <div className={styles.contentGrid}>
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Pacientes por Serviço</h3>
            <span className={styles.cardSubtitle}>Distribuição de pacientes cadastrados</span>
          </div>
          <div className={styles.examTypeList}>
            {dados.pacientesPorServico.length > 0 ? (
              dados.pacientesPorServico.map((item, idx) => {
                const percentual = dados.totalPacientes > 0
                  ? ((item.total / dados.totalPacientes) * 100).toFixed(1)
                  : 0;
                return (
                  <div key={idx} className={styles.examTypeRow}>
                    <span>{item.servico} <small style={{ color: "#94a3b8" }}>({percentual}%)</small></span>
                    <span className={styles.examCountBadge}>{item.total}</span>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyRow}>Nenhum dado disponível</div>
            )}
          </div>
        </div>

        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Atendimentos por Serviço</h3>
            <span className={styles.cardSubtitle}>Total de atendimentos realizados</span>
          </div>
          <div className={styles.examTypeList}>
            {dados.atendimentosPorServico.length > 0 ? (
              dados.atendimentosPorServico.map((item, idx) => {
                const percentual = dados.totalAtendimentos > 0
                  ? ((item.total / dados.totalAtendimentos) * 100).toFixed(1)
                  : 0;
                return (
                  <div key={idx} className={styles.examTypeRow}>
                    <span>{item.servico} <small style={{ color: "#94a3b8" }}>({percentual}%)</small></span>
                    <span className={styles.examCountBadge}>{item.total}</span>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyRow}>Nenhum atendimento registrado</div>
            )}
          </div>
        </div>
      </div>

      {/* ATENDIMENTOS POR MÊS + PRÓXIMOS AGENDAMENTOS */}
      <div className={styles.contentGrid}>
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Atendimentos Mensais</h3>
            <span className={styles.cardSubtitle}>
              {dados.atendimentosPorMes.length === 12 ? "Meses do período selecionado" : "Últimos 6 meses"}
            </span>
          </div>
          <div className={styles.chartContainer}>
            <div className={styles.barChart}>
              {dados.atendimentosPorMes.length > 0 ? (
                dados.atendimentosPorMes.map((item, idx) => {
                  const maxValue = Math.max(...dados.atendimentosPorMes.map(d => d.total), 1);
                  const heightPercent = (item.total / maxValue) * 100;
                  return (
                    <div key={idx} className={styles.barWrapper}>
                      <div className={styles.barValue}>{item.total}</div>
                      <div className={styles.bar} style={{ height: `${heightPercent}%` }}></div>
                      <div className={styles.barLabel}>{item.mes}</div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", color: "#64748b", padding: "2rem", width: "100%" }}>
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Próximos Agendamentos</h3>
            <span className={styles.cardSubtitle}>Próximos 7 dias · posição atual</span>
          </div>
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Serviço</th>
                </tr>
              </thead>
              <tbody>
                {dados.proximosAgendamentos.length > 0 ? (
                  dados.proximosAgendamentos.slice(0, 5).map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: "600" }}>{item.data}</td>
                      <td>{item.paciente}</td>
                      <td>
                        <span className={styles.badge}>{item.servico}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: "center", color: "#64748b" }}>
                      Nenhum agendamento nos próximos 7 dias
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
