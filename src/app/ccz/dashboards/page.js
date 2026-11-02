"use client";

import { useEffect, useState } from "react";
import { CCZProceduresChart, CCZProcedureTypesChart, CCZAnimalsChart } from "@/components/charts/CCZCharts";
import styles from "./dashboards.module.css";

export default function CCZDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const res = await fetch("/api/ccz/dashboard", { cache: "no-store" });
        
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
        <h1 className={styles.title}>Dashboard do CCZ</h1>
        <p className={styles.subtitle}>Visão geral dos procedimentos e animais cadastrados</p>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartWrapper}>
          <CCZProceduresChart data={data?.evolution || []} />
        </div>

        <div className={styles.chartWrapper}>
          <CCZProcedureTypesChart data={data?.procedureTypes || []} />
        </div>

        <div className={styles.chartWrapper}>
          <CCZAnimalsChart data={data?.animals || []} />
        </div>
      </div>
    </div>
  );
}
