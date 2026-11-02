"use client";

import { useEffect, useState } from "react";
import { RegulacaoEvolutionChart, RegulacaoRiskChart, RegulacaoStatusChart } from "@/components/charts/RegulacaoCharts";
import styles from "./dashboards.module.css";

export default function RegulacaoDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const res = await fetch("/api/regulacao/dashboard", { cache: "no-store" });
        
        if (!res.ok) {
          throw new Error("Erro ao carregar dados do dashboard");
        }
        
        const result = await res.json();
        setData(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Carregando dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Erro ao carregar dashboard: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard de Regulação</h1>
        <p className={styles.subtitle}>Visão geral dos pedidos de exames e procedimentos</p>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartWrapper}>
          <RegulacaoEvolutionChart data={data?.evolution || []} />
        </div>

        <div className={styles.chartWrapper}>
          <RegulacaoRiskChart data={data?.risk || []} />
        </div>

        <div className={styles.chartWrapper}>
          <RegulacaoStatusChart data={data?.status || []} />
        </div>
      </div>
    </div>
  );
}
