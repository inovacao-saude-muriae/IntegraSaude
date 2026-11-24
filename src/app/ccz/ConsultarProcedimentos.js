"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, SearchX, FileDown, FileText } from "lucide-react";
import styles from "../camara-tecnica/processos/ConsultarProcessos.module.css";
// Ajustes próprios dos filtros (linhas do grid e ações na última linha).
import filtrosProc from "./ConsultarProcedimentos.module.css";
// Badges originais da antiga Lista (CCZ) — cores por situação preservadas.
import stylesLista from "./ListaCCZ.module.css";
import { useNotify } from "@/components/ConfirmDialog";
import {
  listarProcedimentosConsulta,
  obterFiltrosProcedimentos,
  obterProcedimento,
} from "./actions";
import TermoInternacao from "./TermoInternacao";
import { gerarPdfProcedimento } from "./procedimentoPdf";
import { gerarTermoProcedimentoPdf } from "./termoProcedimentoPdf";

// CCZ > Procedimentos — Consultar Registros
// Mesmo padrão visual e funcional de Leishmaniose e Esporotricose:
// container de filtros, estado inicial com lupa, tabela com linha clicável,
// paginação de 100 no backend. Somente leitura.
const FILTROS_VAZIOS = {
  busca: "",
  tipo: "",
  periodoInicio: "",
  periodoFim: "",
  responsavel: "",
  status: "",
};

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "—");

const classeStatus = (status) => {
  if (status === "Realizado") return stylesLista.statusRealizado;
  if (status === "Cancelado") return stylesLista.statusCancelado;
  return stylesLista.statusAgendado;
};

export default function ConsultarProcedimentos() {
  const notify = useNotify();

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [resultado, setResultado] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");

  const [tipos, setTipos] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [situacoes, setSituacoes] = useState([]);

  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [termoId, setTermoId] = useState(null);

  useEffect(() => {
    let ativo = true;
    obterFiltrosProcedimentos().then((res) => {
      if (!ativo || !res?.success) return;
      setTipos(res.tipos || []);
      setResponsaveis(res.responsaveis || []);
      setSituacoes(res.situacoes || []);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const consultar = useCallback(async (pagina, filtrosUsados) => {
    setConsultando(true);
    setErro("");
    const res = await listarProcedimentosConsulta({ ...filtrosUsados, pagina });
    setConsultando(false);
    if (res?.success) {
      setResultado(res);
    } else {
      setResultado(null);
      setErro(res?.error || "Não foi possível consultar os procedimentos.");
    }
  }, []);

  const alterarFiltro = (campo, valor) =>
    setFiltros((f) => ({ ...f, [campo]: valor }));

  const filtrar = (e) => {
    e.preventDefault();
    consultar(1, filtros);
  };

  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    setResultado(null);
    setErro("");
  };

  const baixarFicha = async (registro) => {
    try {
      await gerarPdfProcedimento(registro);
    } catch (e) {
      console.error(e);
      notify.error("Não foi possível gerar o PDF.");
    }
  };

  const gerarTermo = async (registro) => {
    try {
      await gerarTermoProcedimentoPdf(registro);
    } catch (e) {
      console.error(e);
      notify.error("Não foi possível gerar o termo.");
    }
  };

  const abrirDetalhe = async (id) => {
    setCarregandoDetalhe(true);
    setDetalhe(null);
    const res = await obterProcedimento(id);
    setCarregandoDetalhe(false);
    if (res?.success) setDetalhe(res.data);
    else notify.error(res?.error || "Procedimento não encontrado.");
  };

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

          <div className={`${styles.gridFiltros} ${filtrosProc.gridFiltrosProc}`}>
            <div className={`${styles.fieldGroup} ${filtrosProc.colProcBusca}`}>
              <label>Buscar Registro</label>
              <input
                value={filtros.busca}
                onChange={(e) => alterarFiltro("busca", e.target.value)}
                placeholder="Digite o nome ou ID do animal, nome ou CPF do tutor..."
              />
            </div>

            <div className={`${styles.fieldGroup} ${filtrosProc.colProcTipo}`}>
              <label>Tipo de Procedimento</label>
              <select
                value={filtros.tipo}
                onChange={(e) => alterarFiltro("tipo", e.target.value)}
              >
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${filtrosProc.colProcSituacao}`}>
              <label>Situação</label>
              <select
                value={filtros.status}
                onChange={(e) => alterarFiltro("status", e.target.value)}
              >
                <option value="">Todas</option>
                {situacoes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${filtrosProc.colProcResponsavel}`}>
              <label>Responsável</label>
              <select
                value={filtros.responsavel}
                onChange={(e) => alterarFiltro("responsavel", e.target.value)}
              >
                <option value="">Todos</option>
                {responsaveis.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${filtrosProc.colProcPeriodo}`}>
              <label>Período do Procedimento</label>
              <div className={styles.periodo}>
                <input
                  type="date"
                  value={filtros.periodoInicio}
                  onChange={(e) => alterarFiltro("periodoInicio", e.target.value)}
                  aria-label="Data inicial do procedimento"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.periodoFim}
                  onChange={(e) => alterarFiltro("periodoFim", e.target.value)}
                  aria-label="Data final do procedimento"
                />
              </div>
            </div>

            <div className={`${styles.filtrosAcoes} ${filtrosProc.acoesProc}`}>
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
              registros.
            </p>
          </div>
        )}

        {/* ── RESULTADOS ──────────────────────────────────────────────────── */}
        {resultado && (
          <div className={styles.resultados}>
            <div className={styles.resumo}>
              <span>
                <strong>{resultado.total}</strong>{" "}
                {resultado.total === 1
                  ? "registro encontrado"
                  : "registros encontrados"}
              </span>
              <span className={styles.resumoPagina}>
                Página {resultado.pagina} de {resultado.totalPaginas} · 100 por página
              </span>
            </div>

            <div className={styles.tabelaWrapper}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Data do Procedimento</th>
                    <th>Nome do Animal</th>
                    <th>ID CCZ</th>
                    <th>Tipo de Procedimento</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className={styles.tabelaVazia}>
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                  {resultado.data.map((r) => (
                    <tr
                      key={r.id}
                      className={styles.linhaClicavel}
                      onClick={() => abrirDetalhe(r.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") abrirDetalhe(r.id);
                      }}
                      title="Clique para ver o registro completo"
                    >
                      <td>{formatarData(r.dataProcedimento)}</td>
                      <td>{r.animalNome || "Sem nome"}</td>
                      <td>{r.animalId || "—"}</td>
                      <td>{r.tipo || "—"}</td>
                      <td>
                        {r.status ? (
                          <span className={classeStatus(r.status)}>{r.status}</span>
                        ) : (
                          "—"
                        )}
                      </td>
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
            aria-label="Detalhes do procedimento"
            onClick={(e) => e.stopPropagation()}
          >
            {carregandoDetalhe && !detalhe && (
              <p className={styles.vazio}>Carregando procedimento...</p>
            )}

            {detalhe && (
              <>
                <div className={styles.painelTopo}>
                  <h3>Procedimento — {detalhe.tipo || "Registro"}</h3>
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
                  <Bloco titulo="1. Dados do Procedimento" css={styles}>
                    <Campo label="Tipo de Procedimento" valor={detalhe.tipo} css={styles} />
                    <Campo
                      label="Data do Procedimento"
                      valor={formatarData(detalhe.dataProcedimento)}
                      css={styles}
                    />
                    <Campo label="Situação" valor={detalhe.status} css={styles} />
                    <Campo label="Responsável" valor={detalhe.veterinario} css={styles} />
                    <Campo label="Data de Retorno" valor={formatarData(detalhe.dataRetorno)} css={styles} />
                    <Campo label="Identificador" valor={detalhe.id} css={styles} />
                    <Campo label="Descrição" valor={detalhe.descricao} css={styles} largo />
                    <Campo
                      label="Medicação prescrita"
                      valor={detalhe.medicacaoPrescrita}
                      css={styles}
                      largo
                    />
                  </Bloco>

                  <Bloco titulo="2. Identificação do Animal" css={styles}>
                    <Campo label="Nome do Animal" valor={detalhe.animalNome || "Sem nome"} css={styles} />
                    <Campo label="ID CCZ" valor={detalhe.animalId} css={styles} />
                    <Campo label="Espécie" valor={detalhe.animalEspecie} css={styles} />
                    <Campo label="Raça" valor={detalhe.animalRaca} css={styles} />
                  </Bloco>

                  {detalhe.tutorNome && (
                    <Bloco titulo="3. Identificação do Responsável pelo Animal" css={styles}>
                      <Campo label="Nome do tutor" valor={detalhe.tutorNome} css={styles} />
                      <Campo label="CPF" valor={detalhe.tutor?.cpf} css={styles} />
                      <Campo label="Telefone" valor={detalhe.tutor?.telefone} css={styles} />
                      <Campo label="Endereço" valor={detalhe.tutor?.endereco} css={styles} largo />
                    </Bloco>
                  )}
                </div>

                <div className={styles.acoesDetalhe}>
                  <button
                    type="button"
                    className={styles.btnPrimario}
                    onClick={() => baixarFicha(detalhe)}
                  >
                    <FileDown size={16} /> Gerar PDF
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => gerarTermo(detalhe)}
                  >
                    <FileText size={16} /> Gerar Termo
                  </button>
                  {detalhe.tipo === "Internação" && (
                    <button
                      type="button"
                      className={styles.btnPrimario}
                      onClick={() => setTermoId(detalhe.id)}
                    >
                      <FileDown size={16} /> Ver termo
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setDetalhe(null)}
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {termoId && (
        <TermoInternacao
          procedimentoId={termoId}
          onFechar={() => setTermoId(null)}
        />
      )}
    </div>
  );
}

function Bloco({ titulo, children, css }) {
  return (
    <div className={css.cardSection}>
      <h4 className={css.sectionHeaderTitle}>
        <FileText size={16} aria-hidden="true" style={{ marginRight: "0.4rem" }} />
        {titulo}
      </h4>
      <div className={css.grid3}>{children}</div>
    </div>
  );
}

function Campo({ label, valor, largo = false, css }) {
  const texto =
    valor === null || valor === undefined || valor === "" ? "—" : String(valor);
  if (largo) {
    return (
      <div className={css.campoLeituraLargo}>
        <label>{label}</label>
        <textarea readOnly rows={2} value={texto} />
      </div>
    );
  }
  return (
    <div className={css.campoLeitura}>
      <label>{label}</label>
      <input readOnly value={texto} />
    </div>
  );
}
