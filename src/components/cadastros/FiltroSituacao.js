"use client";

// Filtro de situação reutilizável por todos os cadastros (Serviços,
// Especialidades, Procedimentos). Valores: "ativos" | "inativos" | "todos".

export const SITUACOES = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "inativos", rotulo: "Inativos" },
  { valor: "todos", rotulo: "Todos" },
];

export function passaSituacao(situacao, ativo) {
  if (situacao === "ativos") return ativo !== false;
  if (situacao === "inativos") return ativo === false;
  return true;
}

export default function FiltroSituacao({
  valor = "ativos",
  onChange,
  label = "Situação:",
  id,
}) {
  return (
    <div className="cadFiltroSituacao">
      <label htmlFor={id || "filtro-situacao"}>{label}</label>
      <select
        id={id || "filtro-situacao"}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="cadFiltroSelect"
      >
        {SITUACOES.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
