"use client";

import { useState, useEffect } from "react";
import styles from "./RelatorioAcessos.module.css";

const formatarDataHora = (valor) => {
  if (!valor) return "Nunca acessou";
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatarData = (valor) => {
  if (!valor) return "-";
  return new Date(valor).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function RelatorioAcessos() {
  const [filtros, setFiltros] = useState({
    userCpf: "",
    modulo: "",
    dataInicio: "",
    dataFim: "",
  });
  const [acessos, setAcessos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const atualizar = (campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  };

  const buscar = async (page = 1) => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: page.toString(),
      limit: pagination.limit.toString(),
    });

    if (filtros.userCpf) params.append("userCpf", filtros.userCpf);
    if (filtros.modulo) params.append("modulo", filtros.modulo);
    if (filtros.dataInicio) params.append("dataInicio", filtros.dataInicio);
    if (filtros.dataFim) params.append("dataFim", filtros.dataFim);

    try {
      const res = await fetch(`/api/admin/acessos?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const corpo = await res.json().catch(() => ({}));
        throw new Error(corpo.error || "Erro ao buscar acessos");
      }

      const data = await res.json();
      setAcessos(data.data || []);
      setPagination(data.pagination || pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const limparFiltros = () => {
    setFiltros({
      userCpf: "",
      modulo: "",
      dataInicio: "",
      dataFim: "",
    });
  };

  const exportarCSV = () => {
    const headers = ["CPF", "Nome", "Cargo", "Último Acesso", "Módulos e perfis"];
    const rows = acessos.map((a) => [
      a.cpf,
      a.nome,
      a.cargo || "-",
      formatarDataHora(a.ultimoAcesso),
      a.modulos.map((m) => `${m.modulo} (${m.perfil})`).join("; "),
    ]);

    // Properly escape CSV cells (quotes become double-quotes)
    const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // Add UTF-8 BOM for Excel compatibility on Windows
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-acessos-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
    buscar();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Relatório de Acessos ao Sistema</h2>
          <p className={styles.subtitle}>
            Histórico de logins e permissões dos usuários
          </p>
        </div>
        <button
          type="button"
          className={styles.btnExport}
          onClick={exportarCSV}
          disabled={acessos.length === 0}
        >
          Exportar CSV
        </button>
      </div>

      <div className={styles.filtros}>
        <div className={styles.filtroRow}>
          <div className={styles.field}>
            <label>CPF do Usuário</label>
            <input
              type="text"
              value={filtros.userCpf}
              onChange={(e) => atualizar("userCpf", e.target.value)}
              placeholder="Filtrar por CPF"
            />
          </div>

          <div className={styles.field}>
            <label>Módulo</label>
            <select
              value={filtros.modulo}
              onChange={(e) => atualizar("modulo", e.target.value)}
            >
              <option value="">Todos os módulos</option>
              <option value="REGULACAO">Regulação</option>
              <option value="FARMACIA">Farmácia Judicial</option>
              <option value="JUNTA">Junta Reguladora</option>
              <option value="CCZ">CCZ</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>Data Início</label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => atualizar("dataInicio", e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Data Fim</label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => atualizar("dataFim", e.target.value)}
            />
          </div>
        </div>

        <div className={styles.filtroActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={limparFiltros}
          >
            Limpar filtros
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => buscar(1)}
            disabled={loading}
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </div>

      {error && <div className={styles.alertErro}>{error}</div>}

      {loading && <div className={styles.loading}>Carregando acessos...</div>}

      {!loading && acessos.length === 0 && (
        <div className={styles.vazio}>
          Nenhum acesso encontrado com os filtros aplicados.
        </div>
      )}

      {!loading && acessos.length > 0 && (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>CPF</th>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Último Acesso</th>
                  <th>Módulos</th>
                </tr>
              </thead>
              <tbody>
                {acessos.map((acesso) => (
                  <tr key={acesso.cpf}>
                    <td>{acesso.cpf}</td>
                    <td className={styles.nomeCell}>{acesso.nome}</td>
                    <td>{acesso.cargo || "-"}</td>
                    <td>{formatarDataHora(acesso.ultimoAcesso)}</td>
                    <td>
                      <div className={styles.modulosList}>
                        {acesso.modulos.length > 0 ? (
                          acesso.modulos.map((m, i) => (
                            <span key={i} className={styles.moduloBadge}>
                              {m.modulo} <small>({m.perfil})</small>
                            </span>
                          ))
                        ) : (
                          <span className={styles.semModulos}>Sem módulos</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                Página {pagination.page} de {pagination.totalPages} ({pagination.total}{" "}
                registros)
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnPage}
                  onClick={() => buscar(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  ‹ Anterior
                </button>
                <button
                  type="button"
                  className={styles.btnPage}
                  onClick={() => buscar(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Próxima ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
