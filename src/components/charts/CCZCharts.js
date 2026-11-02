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
  teal: "#14b8a6",
};

/**
 * Chart showing CCZ procedures evolution over time
 */
export function CCZProceduresChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyChart}>Sem dados para exibir</div>;
  }

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>Evolução de Procedimentos CCZ</h3>
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
            dataKey="castracao"
            stroke={COLORS.primary}
            strokeWidth={2}
            name="Castração"
            dot={{ fill: COLORS.primary, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="vacinacao"
            stroke={COLORS.success}
            strokeWidth={2}
            name="Vacinação"
            dot={{ fill: COLORS.success, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="consulta"
            stroke={COLORS.info}
            strokeWidth={2}
            name="Consulta"
            dot={{ fill: COLORS.info, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Bar chart showing procedure types distribution
 */
export function CCZProcedureTypesChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyChart}>Sem dados para exibir</div>;
  }

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>Procedimentos por Tipo</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="tipo" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          />
          <Bar dataKey="total" fill={COLORS.teal} name="Total" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Pie chart showing animals by species
 */
export function CCZAnimalsChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyChart}>Sem dados para exibir</div>;
  }

  const SPECIES_COLORS = {
    "Canina": COLORS.primary,
    "Felina": COLORS.warning,
    "Outro": COLORS.info,
  };

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>Animais por Espécie</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="especie"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={(entry) => `${entry.especie}: ${entry.total}`}
            labelLine={true}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={SPECIES_COLORS[entry.especie] || COLORS.primary} />
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
