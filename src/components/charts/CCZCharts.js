"use client";

import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
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

// Rótulo com o total do mês acima da barra empilhada (omitido quando 0).
// Renderizado a partir do último segmento da pilha; `dados[index].total` vem
// do cálculo feito no componente.
const renderTotalLabel = (dados) => function TotalLabel(props) {
  const { x, y, width, index } = props;
  const total = dados[index]?.total;
  if (!total) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fill="#0f172a"
      fontSize={12}
      fontWeight={700}
    >
      {total}
    </text>
  );
};

// Formatter que esconde zeros nos rótulos.
const semZero = (v) => (v > 0 ? v : "");

/**
 * Stacked bar chart for monthly counts split into "Com tutor" / "Sem tutor".
 * Expects data as 12 items: { mes, comTutor, semTutor }.
 * Mostra o número de cada segmento (quando > 0) e o total acima da barra.
 */
export function CCZMensalEmpilhadoChart({ data, titulo, height = 300, bare = false }) {
  const dados = (data && data.length > 0 ? data : []).map((d) => ({
    ...d,
    total: (d.comTutor || 0) + (d.semTutor || 0),
  }));

  const chart = (
    <>
      {titulo && <h3 className={styles.chartTitle}>{titulo}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={dados} margin={{ top: 22, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="comTutor" stackId="tutor" fill={COLORS.success} name="Com tutor" radius={[0, 0, 0, 0]}>
            <LabelList dataKey="comTutor" position="center" formatter={semZero} fill="#ffffff" fontSize={11} fontWeight={700} />
          </Bar>
          <Bar dataKey="semTutor" stackId="tutor" fill={COLORS.warning} name="Sem tutor" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="semTutor" position="center" formatter={semZero} fill="#1f2937" fontSize={11} fontWeight={700} />
            <LabelList dataKey="semTutor" content={renderTotalLabel(dados)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );

  // bare: sem o cartão interno (quando o painel pai já é o cartão).
  if (bare) return chart;
  return <div className={styles.chartContainer}>{chart}</div>;
}

/**
 * Bar chart simples (série única "Sem tutor") por mês, com o valor acima da barra.
 * Expects data as 12 items: { mes, semTutor }.
 */
export function CCZMensalSimplesChart({ data, titulo, height = 300, bare = false }) {
  const dados = data && data.length > 0 ? data : [];

  const chart = (
    <>
      {titulo && <h3 className={styles.chartTitle}>{titulo}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={dados} margin={{ top: 22, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="semTutor" fill="#64748b" name="Sem tutor" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="semTutor" position="top" formatter={semZero} fill="#0f172a" fontSize={12} fontWeight={700} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );

  if (bare) return chart;
  return <div className={styles.chartContainer}>{chart}</div>;
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
