"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, SearchX } from "lucide-react";
import styles from "../camara-tecnica/processos/ConsultarProcessos.module.css";
// Badges originais da Lista do CCZ — cores preservadas por situação.
import stylesLista from "./ListaCCZ.module.css";
import { consultarAnimais, obterFiltrosAnimais } from "./actions";
import FichaCompletaAnimal from "./FichaCompletaAnimal";

// CCZ > Zoonoses > Animais — Consultar Registros
// Mesmo padrão visual e funcional de Leishmaniose/Esporotricose > Consultar
// Registros: container de filtros, estado inicial com lupa, tabela com linha
// clicável (somente leitura) e paginação de 100 no backend.
const FILTROS_VAZIOS = {
  busca: "",
  periodoInicio: "",
  periodoFim: "",
  especie: "",
  situacao: "",
  bairro: "",
};

const SITUACOES = [
  { value: "", label: "Todas" },
  { value: "CCZ", label: "No CCZ" },
  { value: "Adotado", label: "Adotado" },
  { value: "Devolvido", label: "Devolvido" },
  { value: "SEM_TUTOR", label: "Sem tutor" },
  { value: "Arquivado", label: "Arquivado" },
];

const formatarData = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const badgeSituacao = (situacao) => {
  if (!situacao) return null;
  if (situacao === "Adotado") return { css: stylesLista.badgeSuccess, texto: "Adotado" };
  if (situacao === "Devolvido") return { css: stylesLista.badgeWarning, texto: "Devolvido" };
  if (situacao === "Arquivado") return { css: stylesLista.badgeDanger, texto: "Arquivado" };
  if (situacao === "CCZ") return { css: stylesLista.badgeInfo, texto: "No CCZ" };
  return { css: stylesLista.badgeInfo, texto: situacao };
};

export default function ConsultarAnimais() {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [resultado, setResultado] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [opcoes, setOpcoes] = useState({ especies: [], bairros: [] });

  const [historicoId, setHistoricoId] = useState(null);

  useEffect(() => {
    let ativo = true;
    obterFiltrosAnimais().then((res) => {
      if (ativo && res?.success) {
        setOpcoes({ especies: res.especies || [], bairros: res.bairros || [] });
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  const consultar = useCallback(async (pagina, filtrosUsados) => {
    setConsultando(true);
    setErro("");
    const res = await consultarAnimais({ ...filtrosUsados, pagina });
    setConsultando(false);
    if (res?.success) {
      setResultado(res);
    } else {
      setResultado(null);
      setErro(res?.error || "Não foi possível consultar os animais.");
    }
  }, []);

  const alterarFiltro = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));

  const filtrar = (e) => {
    e.preventDefault();
    consultar(1, filtros);
  };

  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    setResultado(null);
    setErro("");
  };

  // Ficha completa (somente leitura) do animal selecionado — o próprio
  // componente carrega o histórico e trata o erro.
  const abrirHistorico = (id) => setHistoricoId(id);

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {erro && (
          <div className={styles.avisoErro} role="alert">
            {erro}
            <button type="button" onClick={() => setErro("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}

        {/* ── FILTROS ─────────────────────────────────────────────────────── */}
        <form className={styles.cardFiltros} onSubmit={filtrar}>
          <div className={styles.cardFiltrosHeader}>
            <h4>Filtros da Consulta</h4>
          </div>

          <div className={styles.gridFiltros}>
            <div className={`${styles.fieldGroup} ${styles.colBuscaRegistro}`}>
              <label>Buscar Registro</label>
              <input
                value={filtros.busca}
                onChange={(e) => alterarFiltro("busca", e.target.value)}
                placeholder="Digite o nome ou ID do animal, nome ou CPF do tutor..."
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colEspecialidade}`}>
              <label>Espécie</label>
              <select
                value={filtros.especie}
                onChange={(e) => alterarFiltro("especie", e.target.value)}
              >
                <option value="">Todas</option>
                {opcoes.especies.map((esp) => (
                  <option key={esp} value={esp}>
                    {esp}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colStatus}`}>
              <label>Situação do Animal</label>
              <select
                value={filtros.situacao}
                onChange={(e) => alterarFiltro("situacao", e.target.value)}
              >
                {SITUACOES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colEspecialidade}`}>
              <label>Bairro</label>
              <select
                value={filtros.bairro}
                onChange={(e) => alterarFiltro("bairro", e.target.value)}
              >
                <option value="">Todos</option>
                {opcoes.bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colPeriodoCadastro}`}>
              <label>Período do Cadastro</label>
              <div className={styles.periodo}>
                <input
                  type="date"
                  value={filtros.periodoInicio}
                  onChange={(e) => alterarFiltro("periodoInicio", e.target.value)}
                  aria-label="Data inicial do cadastro"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.periodoFim}
                  onChange={(e) => alterarFiltro("periodoFim", e.target.value)}
                  aria-label="Data final do cadastro"
                />
              </div>
            </div>

            <div className={styles.filtrosAcoes}>
              <button type="submit" className={styles.btnPrimario} disabled={consultando}>
                <Filter size={16} strokeWidth={2.5} aria-hidden="true" />
                {consultando ? "Filtrando…" : "Filtrar"}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={limpar}
                disabled={consultando}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </form>

        {/* ── ESTADO INICIAL ──────────────────────────────────────────────── */}
        {!resultado && (
          <div className={styles.estadoInicial}>
            <SearchX size={44} strokeWidth={1.5} aria-hidden="true" />
            <h3>Nenhuma consulta realizada</h3>
            <p>
              Selecione os filtros ou clique em Filtrar para consultar todos os
              animais.
            </p>
          </div>
        )}

        {/* ── RESULTADOS ──────────────────────────────────────────────────── */}
        {resultado && (
          <div className={styles.resultados}>
            <div className={styles.resumo}>
              <span>
                <strong>{resultado.total}</strong>{" "}
                {resultado.total === 1 ? "registro encontrado" : "registros encontrados"}
              </span>
              <span className={styles.resumoPagina}>
                Página {resultado.pagina} de {resultado.totalPaginas} · 100 por página
              </span>
            </div>

            <div className={styles.tabelaWrapper}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Data do Cadastro</th>
                    <th>Nome do Animal</th>
                    <th>ID CCZ</th>
                    <th>Espécie</th>
                    <th>Nome do Tutor</th>
                    <th>Bairro</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.data.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.tabelaVazia}>
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                  {resultado.data.map((a) => {
                    const badge = badgeSituacao(a.situacao);
                    return (
                      <tr
                        key={a.id}
                        className={styles.linhaClicavel}
                        onClick={() => abrirHistorico(a.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") abrirHistorico(a.id);
                        }}
                        title="Clique para ver a ficha completa do animal"
                      >
                        <td>{formatarData(a.dataCadastro)}</td>
                        <td>{a.nome || "Sem nome"}</td>
                        <td>{a.id}</td>
                        <td>{a.especie || "—"}</td>
                        <td>{a.tutorNome || "Sem tutor"}</td>
                        <td>{a.bairro || "—"}</td>
                        <td>{badge ? <span className={badge.css}>{badge.texto}</span> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.paginacao}>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={resultado.pagina <= 1 || consultando}
                onClick={() => consultar(resultado.pagina - 1, filtros)}
              >
                ← Anterior
              </button>
              <span>
                Página {resultado.pagina} de {resultado.totalPaginas}
              </span>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={resultado.pagina >= resultado.totalPaginas || consultando}
                onClick={() => consultar(resultado.pagina + 1, filtros)}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── FICHA COMPLETA (somente leitura) ─────────────────────────────── */}
      {historicoId && (
        <FichaCompletaAnimal
          animalId={historicoId}
          onFechar={() => setHistoricoId(null)}
        />
      )}
    </div>
  );
}
