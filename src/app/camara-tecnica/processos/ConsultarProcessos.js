"use client";

import { useMemo, useState } from "react";
import { Filter, SearchX } from "lucide-react";
import SeletorProcesso from "@/components/SeletorProcesso";
import { formatarCpfExibicao } from "@/lib/cpf";
import { mascararTelefone } from "@/lib/telefone";
import { listarProcessos, obterProcesso, buscarProcessosJudiciais } from "./actions";
import styles from "./ConsultarProcessos.module.css";

// Status do processo: operacional (ATIVO/INATIVO). Qualquer outro valor é
// tratado como Inativo na EXIBIÇÃO, nunca convertido no banco.
const normalizarStatus = (v) =>
  String(v || "").trim().toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";

const ROTULO_STATUS = { ATIVO: "Ativo", INATIVO: "Inativo" };

// ISO (yyyy-mm-dd...) → dd/mm/aaaa sem passar por Date (evita efeito de fuso).
const formatarData = (v) => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : "—";
};

// Data e hora do cadastro em fuso local (America/Sao_Paulo, UTC-3).
const formatarDataHora = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return formatarData(v);
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mi = String(local.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${local.getUTCFullYear()} às ${hh}:${mi}`;
};

const FILTROS_VAZIOS = {
  busca: "",
  especialidadeId: "",
  procedimentoId: "",
  status: "todos",
  dataInicio: "",
  dataFim: "",
};

// Busca suspensa da consulta: mesma fonte do campo "Buscar Registro".
const buscarProcessos = (termo) => buscarProcessosJudiciais(termo);

/**
 * Aba "Consultar Processos" dos Procedimentos Cirúrgicos — MESMA estrutura
 * visual e funcional da Consulta da Farmácia Judicial: card de filtros,
 * busca suspensa (um processo por linha), Filtrar/Limpar filtros, estado
 * inicial, tabela paginada (100/página, no backend) e visualização completa.
 */
export default function ConsultarProcessos({
  catalogoFiltros = { especialidades: [], procedimentos: [], vinculosProcedimentos: {} },
  podeEditar = false,
  podeExcluir = false,
  onEditar,
  onExcluir,
  onAtualizar,
}) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  // Registro escolhido na tabela suspensa (um processo por linha).
  const [processoSelecionado, setProcessoSelecionado] = useState(null);
  const [resultado, setResultado] = useState(null); // null = nenhuma consulta ainda
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  // Procedimentos do filtro: sem especialidade, TODOS; com especialidade,
  // apenas os vinculados a ela. O campo nunca é desabilitado.
  const procedimentosDoFiltro = useMemo(() => {
    const todos = catalogoFiltros.procedimentos || [];
    const espId = filtros.especialidadeId;
    if (!espId) return todos;
    const vinculados = new Set(
      catalogoFiltros.vinculosProcedimentos?.[String(espId)] || [],
    );
    return todos.filter((p) => vinculados.has(p.id));
  }, [catalogoFiltros, filtros.especialidadeId]);

  const alterarFiltro = (campo, valor) =>
    setFiltros((f) => {
      const proximo = { ...f, [campo]: valor };
      // Trocar a especialidade limpa o procedimento incompatível com ela.
      if (campo === "especialidadeId" && proximo.procedimentoId) {
        const vinculados = new Set(
          catalogoFiltros.vinculosProcedimentos?.[String(valor)] || [],
        );
        if (valor && !vinculados.has(Number(proximo.procedimentoId))) {
          proximo.procedimentoId = "";
        }
      }
      return proximo;
    });

  async function consultar(pagina = 1, atuais = filtros) {
    setConsultando(true);
    setErro("");
    try {
      const res = await listarProcessos({
        busca: atuais.busca,
        especialidadeId: atuais.especialidadeId,
        procedimentoId: atuais.procedimentoId,
        status: atuais.status,
        dataInicio: atuais.dataInicio,
        dataFim: atuais.dataFim,
        pagina,
      });
      if (!res.success) {
        setErro(res.error || "Não foi possível consultar os processos.");
        setResultado(null);
        return;
      }
      setResultado({
        registros: res.data || [],
        total: res.total ?? 0,
        pagina: res.pagina ?? 1,
        totalPaginas: res.totalPaginas ?? 1,
      });
    } finally {
      setConsultando(false);
    }
  }

  // Filtrar sem nenhum campo preenchido devolve todos os registros.
  const filtrar = (e) => {
    e?.preventDefault?.();
    consultar(1, filtros);
  };

  // Limpar filtros: zera campos, seleção da busca E resultados (volta ao
  // estado inicial "Nenhuma consulta realizada").
  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    setProcessoSelecionado(null);
    setResultado(null);
    setErro("");
    setAviso("");
  };

  async function abrirDetalhe(id) {
    setCarregandoDetalhe(true);
    setErro("");
    try {
      const res = await obterProcesso(id);
      if (!res.success) {
        setErro(res.error || "Não foi possível abrir o processo.");
        return;
      }
      setDetalhe(res.data);
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  // Editar/Excluir continuam sendo as ações já existentes da página.
  async function editar() {
    if (!detalhe) return;
    const processo = detalhe;
    setDetalhe(null);
    await onEditar?.(processo);
  }

  async function excluir() {
    if (!detalhe) return;
    const processo = detalhe;
    setDetalhe(null);
    await onExcluir?.(processo);
  }

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {aviso && (
          <div className={styles.avisoSucesso} role="status">
            {aviso}
            <button type="button" onClick={() => setAviso("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}
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
            <div className={styles.colBuscaRegistro}>
              <SeletorProcesso
                label="Buscar Registro"
                placeholder="Digite o nome, CPF, número do processo ou pasta..."
                selecionado={processoSelecionado}
                onSelect={(p) => {
                  setProcessoSelecionado(p);
                  // Selecionar no dropdown preenche o filtro do backend.
                  setFiltros((f) => ({ ...f, busca: p ? p.numeroProcesso : "" }));
                }}
                buscar={buscarProcessos}
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colEspecialidade}`}>
              <label>Especialidade</label>
              <select
                value={filtros.especialidadeId}
                onChange={(e) => alterarFiltro("especialidadeId", e.target.value)}
              >
                <option value="">Todas</option>
                {(catalogoFiltros.especialidades || []).map((esp) => (
                  <option key={esp.id} value={String(esp.id)}>
                    {esp.nome}
                    {esp.ativo === false ? " (inativa)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colProcedimento}`}>
              <label>Procedimento</label>
              <select
                value={filtros.procedimentoId}
                onChange={(e) => alterarFiltro("procedimentoId", e.target.value)}
              >
                <option value="">Todos</option>
                {procedimentosDoFiltro.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nome}
                    {p.ativo === false ? " (inativo)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colStatus}`}>
              <label>Status do Processo</label>
              <select
                value={filtros.status}
                onChange={(e) => alterarFiltro("status", e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="ativos">Ativo</option>
                <option value="inativos">Inativo</option>
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colPeriodoCadastro}`}>
              <label>Período do cadastro</label>
              <div className={styles.periodo}>
                <input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => alterarFiltro("dataInicio", e.target.value)}
                  aria-label="Data inicial do cadastro"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => alterarFiltro("dataFim", e.target.value)}
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

        {/* ── ESTADO INICIAL: nada é consultado até clicar em Filtrar ─────── */}
        {!resultado && (
          <div className={styles.estadoInicial}>
            <SearchX size={44} strokeWidth={1.5} aria-hidden="true" />
            <h3>Nenhuma consulta realizada</h3>
            <p>
              Selecione os filtros ou clique em Filtrar para consultar todos os
              processos.
            </p>
          </div>
        )}

        {/* ── RESULTADOS (só após consultar) ──────────────────────────────── */}
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
                    <th>Nome do Paciente</th>
                    <th>Número do Processo</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.registros.length === 0 && (
                    <tr>
                      <td colSpan={3} className={styles.tabelaVazia}>
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                  {resultado.registros.map((r) => (
                    <tr
                      key={r.id}
                      className={styles.linhaClicavel}
                      onClick={() => abrirDetalhe(r.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") abrirDetalhe(r.id);
                      }}
                      title="Clique para visualizar o processo completo"
                    >
                      <td>{formatarData(r.dataCadastro)}</td>
                      <td>{r.pacienteNome || "—"}</td>
                      <td>{r.numeroProcesso || "—"}</td>
                    </tr>
                  ))}
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

      {/* ── VISUALIZAÇÃO COMPLETA (somente leitura) ───────────────────────── */}
      {(carregandoDetalhe || detalhe) && (
        <div
          className={styles.painelFundo}
          role="presentation"
          onClick={() => setDetalhe(null)}
        >
          <div
            className={styles.painelDetalhe}
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do processo"
            onClick={(e) => e.stopPropagation()}
          >
            {carregandoDetalhe && !detalhe && (
              <p className={styles.vazio}>Carregando processo...</p>
            )}

            {detalhe && (
              <>
                <div className={styles.painelTopo}>
                  <h3>Detalhes do processo</h3>
                  <button
                    type="button"
                    className={styles.btnFechar}
                    onClick={() => setDetalhe(null)}
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                </div>

                <div className={styles.corpoDetalhe}>
                  {/* 1. IDENTIFICAÇÃO DO PACIENTE */}
                  <div className={styles.cardSection}>
                    <h4 className={styles.sectionHeaderTitle}>
                      1. Identificação do Paciente
                    </h4>
                    <div className={styles.grid3}>
                      <div className={styles.campoLeitura}>
                        <label>Nome do Paciente</label>
                        <input readOnly value={detalhe.pacienteNome || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>CPF</label>
                        <input
                          readOnly
                          value={formatarCpfExibicao(detalhe.pacienteCpf) || "—"}
                        />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Telefone</label>
                        <input readOnly value={mascararTelefone(detalhe.telefone) || "—"} />
                      </div>
                    </div>
                  </div>

                  {/* 2. INFORMAÇÕES DO PROCESSO */}
                  <div className={styles.cardSection}>
                    <h4 className={styles.sectionHeaderTitle}>
                      2. Informações do Processo
                    </h4>
                    <div className={styles.grid3}>
                      <div className={styles.campoLeitura}>
                        <label>Número do Processo</label>
                        <input readOnly value={detalhe.numeroProcesso || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Número da Pasta</label>
                        <input
                          readOnly
                          value={detalhe.numeroPastaPaciente || detalhe.numeroPasta || "—"}
                        />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Status do Processo</label>
                        <input
                          readOnly
                          value={ROTULO_STATUS[normalizarStatus(detalhe.status)]}
                          className={
                            normalizarStatus(detalhe.status) === "INATIVO"
                              ? styles.situacaoInativa
                              : styles.situacaoAtiva
                          }
                        />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Especialidade</label>
                        <input readOnly value={detalhe.especialidadeNome || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Procedimento</label>
                        <input readOnly value={detalhe.procedimentoNome || "—"} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Data do Cadastro</label>
                        <input readOnly value={formatarDataHora(detalhe.dataCadastro)} />
                      </div>
                      <div className={styles.campoLeitura}>
                        <label>Bloqueios registrados</label>
                        <input readOnly value={String(detalhe.totalBloqueios ?? 0)} />
                      </div>
                    </div>

                    {detalhe.justificativaInativacao && (
                      <div className={styles.campoLeituraLargo}>
                        <label>Justificativa da Inativação</label>
                        <textarea
                          readOnly
                          rows={2}
                          value={detalhe.justificativaInativacao}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.acoesDetalhe}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setDetalhe(null)}
                  >
                    Fechar
                  </button>
                  {podeEditar && (
                    <button type="button" className={styles.btnEditar} onClick={editar}>
                      ✎ Editar
                    </button>
                  )}
                  {podeExcluir && (
                    <button type="button" className={styles.btnPerigo} onClick={excluir}>
                      Excluir
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
