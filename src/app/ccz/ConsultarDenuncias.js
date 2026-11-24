"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Filter, SearchX } from "lucide-react";
import styles from "../camara-tecnica/processos/ConsultarProcessos.module.css";
// Ajustes próprios dos filtros e badges desta tela.
import filtrosDen from "./ConsultarDenuncias.module.css";
import { useNotify } from "@/components/ConfirmDialog";
import {
  listarDenunciasConsulta,
  obterFiltrosDenuncias,
} from "./actions";
import { podeDenuncias } from "./permissoesDenuncias";
import FichaDenuncia from "./FichaDenuncia";

// CCZ > Denúncias — Consultar Registros
// Mesmo padrão visual e funcional de Leishmaniose, Esporotricose,
// Procedimentos e Animais: container de filtros, estado inicial com lupa,
// tabela com linha inteira clicável, paginação de 100 no backend.
// A tabela é somente leitura; editar/excluir ficam na ficha (FichaDenuncia),
// que revalida as permissões no backend.
const FILTROS_VAZIOS = {
  busca: "",
  causouRisco: "",
  bairro: "",
  situacao: "",
  periodoInicio: "",
  periodoFim: "",
};

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "—");

const formatarLocal = (r) => {
  const partes = [];
  if (r.logradouro) partes.push(r.logradouro);
  if (r.numero) partes.push(r.numero);
  if (r.bairro) partes.push(r.bairro);
  return partes.join(", ") || "—";
};

// A consulta é por tela: Animal agressivo tem o filtro "Causou Risco";
// Animal doente não (o risco só existe no cadastro de agressivo).
export default function ConsultarDenuncias({ tipoDenuncia = "" }) {
  const causouRiscoVisivel = String(tipoDenuncia).toUpperCase() === "AGRESSIVO";

  const notify = useNotify();

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [resultado, setResultado] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");

  const [bairros, setBairros] = useState([]);
  const [situacoes, setSituacoes] = useState([]);
  const [riscos, setRiscos] = useState([]);

  const [fichaAberta, setFichaAberta] = useState(null);
  // Permissões lidas sob demanda ao abrir a ficha: o valor chega antes da
  // montagem, então a ficha já nasce com Editar/Excluir decididos.
  const [permissoes, setPermissoes] = useState({ editar: false, excluir: false });
  const permissoesLidas = useRef(false);


  useEffect(() => {
    let ativo = true;
    obterFiltrosDenuncias().then((res) => {
      if (!ativo || !res?.success) return;
      setBairros(res.bairros || []);
      setSituacoes(res.situacoes || []);
      setRiscos(res.riscos || []);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const consultar = useCallback(async (pagina, filtrosUsados) => {
    setConsultando(true);
    setErro("");
    const res = await listarDenunciasConsulta({ ...filtrosUsados, pagina });
    setConsultando(false);
    if (res?.success) {
      setResultado(res);
    } else {
      setResultado(null);
      setErro(res?.error || "Não foi possível consultar as denúncias.");
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

  // Abre a ficha já com as permissões resolvidas (o servidor decide; a
  // consulta é somente leitura e o backend revalida em cada rota).
  const abrirFicha = async (id) => {
    if (!permissoesLidas.current) {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const data = r.ok ? await r.json() : null;
        if (data) setPermissoes(podeDenuncias(data));
      } catch {
        // Sem contexto: a ficha fica em modo consulta (fail-closed).
      }
      permissoesLidas.current = true;
    }
    setFichaAberta(id);
  };

  const excluir = async (id) => {
    try {
      const res = await fetch(`/api/ccz/denuncias/${id}`, { method: "DELETE" });
      if (res.ok) {
        await notify({ tipo: "sucesso", message: "Denúncia excluída." });
        consultar(resultado?.pagina || 1, filtros);
      } else {
        await notify({ tipo: "erro", message: "Erro ao excluir a denúncia." });
      }
    } catch {
      await notify({ tipo: "erro", message: "Erro ao excluir a denúncia." });
    }
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

          <div className={`${styles.gridFiltros} ${filtrosDen.gridFiltrosDen}`}>
            <div className={`${styles.fieldGroup} ${filtrosDen.colDenBusca}`}>
              <label>Buscar Registro</label>
              <input
                value={filtros.busca}
                onChange={(e) => alterarFiltro("busca", e.target.value)}
                placeholder="Digite o ID, o animal, a descrição ou o bairro..."
              />
            </div>

            {causouRiscoVisivel && (
              <div className={`${styles.fieldGroup} ${filtrosDen.colDenRisco}`}>
                <label>Causou Risco</label>
                <select
                  value={filtros.causouRisco}
                  onChange={(e) => alterarFiltro("causouRisco", e.target.value)}
                >
                  <option value="">Todos</option>
                  {riscos.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={`${styles.fieldGroup} ${filtrosDen.colDenBairro}`}>
              <label>Bairro</label>
              <select
                value={filtros.bairro}
                onChange={(e) => alterarFiltro("bairro", e.target.value)}
              >
                <option value="">Todos</option>
                {bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${filtrosDen.colDenSituacao}`}>
              <label>Situação da Denúncia</label>
              <select
                value={filtros.situacao}
                onChange={(e) => alterarFiltro("situacao", e.target.value)}
              >
                <option value="">Todas</option>
                {situacoes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${filtrosDen.colDenPeriodo}`}>
              <label>Período da Denúncia</label>
              <div className={styles.periodo}>
                <input
                  type="date"
                  value={filtros.periodoInicio}
                  onChange={(e) => alterarFiltro("periodoInicio", e.target.value)}
                  aria-label="Data inicial da denúncia"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.periodoFim}
                  onChange={(e) => alterarFiltro("periodoFim", e.target.value)}
                  aria-label="Data final da denúncia"
                />
              </div>
            </div>

            <div className={`${styles.filtrosAcoes} ${filtrosDen.acoesDen}`}>
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
              Selecione os filtros ou clique em Filtrar para consultar todas as
              denúncias.
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
                  ? "denúncia encontrada"
                  : "denúncias encontradas"}
              </span>
              <span className={styles.resumoPagina}>
                Página {resultado.pagina} de {resultado.totalPaginas} · 100 por página
              </span>
            </div>

            <div className={styles.tabelaWrapper}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Data da Denúncia</th>
                    <th>Nome do Animal</th>
                    <th>Localização</th>
                    <th>Causou Risco</th>
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
                      onClick={() => abrirFicha(r.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") abrirFicha(r.id);
                      }}
                      title="Clique para ver a denúncia completa"
                    >
                      <td>{formatarData(r.dataDenuncia)}</td>
                      <td>
                        {r.animalNome || "Sem animal vinculado"}
                        {r.animalId ? (
                          <span className={styles.celulaSecundaria}> · {r.animalId}</span>
                        ) : null}
                      </td>
                      <td>{formatarLocal(r)}</td>
                      <td>
                        {r.causouRisco ? (
                          <span
                            className={`${filtrosDen.statusDen} ${
                              r.causouRisco === "Sim"
                                ? filtrosDen.riscoSim
                                : filtrosDen.riscoNao
                            }`}
                          >
                            {r.causouRisco}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span
                          className={`${filtrosDen.statusDen} ${
                            r.situacao === "Arquivada"
                              ? filtrosDen.statusArquivada
                              : filtrosDen.statusAtiva
                          }`}
                        >
                          {r.situacao || "—"}
                        </span>
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

      {/* ── FICHA DA DENÚNCIA (visualização completa) ─────────────────────── */}
      {fichaAberta && (
        <FichaDenuncia
          denunciaId={fichaAberta}
          onFechar={() => setFichaAberta(null)}
          onExcluir={excluir}
          podeEditar={!!permissoes.editar}
          podeExcluir={!!permissoes.excluir}
        />
      )}
    </div>
  );
}
