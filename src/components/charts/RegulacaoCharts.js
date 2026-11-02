"use client";

import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import styles from "./Charts.module.css";

const COLORS = {
  primary: "#2563eb",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#06b6d4",
  purple: "#8b5cf6",
};

const RISK_COLORS = {
  "Eletivo": COLORS.info,
  "Baixo": COLORS.success,
  "Médio": COLORS.warning,
  "Alto": COLORS.danger,
  "Urgente": COLORS.purple,
};

/**
 * Chart showing evolution of exam requests over time
 */
export function RegulacaoEvolutionChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyChart}>Sem dados para exibir</div>;
  }

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>Evolução de Pedidos de Exames</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line
            type="monotone"
            dataKey="total"
            stroke={COLORS.primary}
            strokeWidth={2}
            name="Total de pedidos"
            dot={{ fill: COLORS.primary, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="liberados"
            stroke={COLORS.success}
            strokeWidth={2}
            name="Liberados"
            dot={{ fill: COLORS.success, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="aguardando"
            stroke={COLORS.warning}
            strokeWidth={2}
            name="Aguardando"
            dot={{ fill: COLORS.warning, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Bar chart showing requests by risk classification
 */
export function RegulacaoRiskChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyChart}>Sem dados para exibir</div>;
  }

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>Pedidos por Classificação de Risco</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="classificacao" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          />
          <Bar dataKey="total" name="Pedidos" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.classificacao] || COLORS.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Pie chart showing status distribution
 */
export function RegulacaoStatusChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyChart}>Sem dados para exibir</div>;
  }

  const STATUS_COLORS = {
    "Aguardando": COLORS.warning,
    "Liberado": COLORS.success,
    "Cancelado": COLORS.danger,
    "Realizado": COLORS.info,
  };

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>Distribuição por Status</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="status"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={(entry) => `${entry.status}: ${entry.total}`}
            labelLine={true}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || COLORS.primary} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
