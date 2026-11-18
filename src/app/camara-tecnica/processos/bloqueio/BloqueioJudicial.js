"use client";

// ═══════════════════════════════════════════════════════════════════════════
// REALIZAR BLOQUEIO — Processos Cirúrgicos (Câmara Técnica › Processos Judiciais)
// ─────────────────────────────────────────────────────────────────────────
// 1. Busca por nome, CPF ou número do processo judicial.
// 2. Paciente com UM processo → carrega automaticamente; com vários →
//    apresenta a lista para escolher aquele que receberá o bloqueio.
// 3. Os dados do processo aparecem em campos SOMENTE LEITURA.
// 4. Data (obrigatória) + valor monetário brasileiro (obrigatório, > 0).
// 5. Duas abas, no mesmo padrão de Consultar Processos/Novo Processo:
//    "Consultar Bloqueios" (filtros + tabela + Editar/Excluir) e
//    "Novo Bloqueio" (formulário de cadastro, sem alteração de campos).
//
// O bloqueio é gravado em processos_bloqueios vinculado ao PROCESSO
// (processo_id), nunca apenas ao paciente. As permissões vêm do servidor
// (`podeCriar`); o backend revalida tudo em `criarBloqueio`.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatarCpfExibicao } from "@/lib/cpf";
import { mascararMoeda, formatarMoedaBRL } from "@/lib/moeda";
import { obterCatalogoParaFiltros } from "../especialidades/actions";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  buscarProcessosParaBloqueio,
  criarBloqueio,
  editarBloqueio,
  excluirBloqueio,
  listarBloqueios,
} from "../actions";
import styles from "../page.module.css";

const hoje = () => new Date().toISOString().slice(0, 10);

const dataBR = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};

const FILTROS_VAZIOS = {
  busca: "",
  especialidadeId: "",
  procedimentoId: "",
  dataInicio: "",
  dataFim: "",
};

export default function BloqueioJudicial({
  podeCriar = false,
  podeEditar = false,
  podeExcluir = false,
}) {
  const confirmar = useConfirm();
  // Mesmas abas de Novo Processo: Consultar Bloqueios / Novo Bloqueio.
  const [aba, setAba] = useState("consultar");
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [processo, setProcesso] = useState(null);
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [bloqueios, setBloqueios] = useState([]);
  // Filtros da consulta: a tabela só aparece depois de uma consulta.
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [consultou, setConsultou] = useState(false);
  const [total, setTotal] = useState(0);
  const [valorTotal, setValorTotal] = useState("0.00");
  const [consultando, setConsultando] = useState(false);
  // Catálogo dos FILTROS (inclui itens inativos = registros históricos).
  const [catalogoFiltros, setCatalogoFiltros] = useState({
    especialidades: [],
    procedimentos: [],
    vinculosProcedimentos: {},
  });
  // Edição inline de um bloqueio da tabela.
  const [editando, setEditando] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const timer = useRef(null);

  // Consulta no backend: os filtros combinam entre si (AND).
  const consultar = useCallback(async (filtrosConsulta = {}, { todos = false } = {}) => {
    setConsultando(true);
    const res = await listarBloqueios({ ...filtrosConsulta, todos });
    setConsultando(false);
    if (!res.success) {
      setErro(res.error);
      return res;
    }
    setBloqueios(res.data);
    setTotal(res.total ?? res.data.length);
    setValorTotal(res.valorTotal || "0.00");
    setConsultou(true);
    return res;
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Nada é listado na abertura: só o catálogo dos filtros.
      const cats = await obterCatalogoParaFiltros();
      if (vivo && cats.success) {
        setCatalogoFiltros({
          especialidades: cats.especialidades || [],
          procedimentos: cats.procedimentos || [],
          vinculosProcedimentos: cats.vinculosProcedimentos || {},
        });
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Procedimentos exibidos no filtro: sem especialidade, TODOS; com
  // especialidade, apenas os vinculados a ela. O campo nunca é desabilitado.
  const procedimentosDoFiltro = useMemo(() => {
    const todos = catalogoFiltros.procedimentos || [];
    const espId = filtros.especialidadeId;
    if (!espId) return todos;
    const vinculados = new Set(
      catalogoFiltros.vinculosProcedimentos?.[String(espId)] || [],
    );
    return todos.filter((p) => vinculados.has(p.id));
  }, [catalogoFiltros, filtros.especialidadeId]);

  function alterarFiltro(campo, valor) {
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
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    setBloqueios([]);
    setTotal(0);
    setValorTotal("0.00");
    setConsultou(false);
    setErro("");
  }


  // Busca com debounce (nome, CPF ou número do processo).
  const buscar = useCallback(async (texto) => {
    const consulta = String(texto || "").trim();
    if (consulta.length < 2) {
      setResultados([]);
      setBuscou(false);
      return;
    }
    setBuscando(true);
    const res = await buscarProcessosParaBloqueio(consulta);
    setBuscando(false);
    setBuscou(true);
    if (!res.success) {
      setErro(res.error);
      setResultados([]);
      return;
    }
    setResultados(res.data);
    // Com um único processo o seletor já vem com ele escolhido.
    if (res.data.length === 1) {
      setProcesso(res.data[0]);
    } else {
      setProcesso(null);
    }
  }, []);

  function aoDigitar(texto) {
    setTermo(texto);
    setErro("");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => buscar(texto), 350);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  // Escolhe o processo que receberá o bloqueio. A lista de resultados é
  // mantida: com vários processos, o dropdown continua disponível.
  function selecionar(p) {
    setProcesso(p);
    setTermo(p.pacienteNome || "");
    setErro("");
  }

  function limpar() {
    setProcesso(null);
    setTermo("");
    setResultados([]);
    setBuscou(false);
    setValor("");
    setObservacao("");
    setData(hoje());
    setErro("");
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    setAviso("");

    if (!processo) return setErro("Selecione o processo que receberá o bloqueio.");
    if (!data) return setErro("Informe a data do bloqueio.");
    if (!valor || valor === "0,00") return setErro("Informe um valor maior que zero.");

    setSalvando(true);
    const res = await criarBloqueio({
      processoId: processo.id,
      dataBloqueio: data,
      valor,
      observacao,
    });
    setSalvando(false);

    if (!res.success) return setErro(res.error);

    setAviso(
      `Bloqueio de ${formatarMoedaBRL(res.data.valor)} registrado no processo ` +
        `${res.data.processo?.numeroProcesso || processo.numeroProcesso}.`,
    );
    setValor("");
    setObservacao("");
    setData(hoje());
    // Atualiza a tabela sem recarregar a página (refaz a consulta atual).
    if (consultou) await consultar(filtros);
  }

  // ── Edição e exclusão pela tabela ────────────────────────────────────────
  function abrirEdicao(b) {
    setEditando({
      id: b.id,
      numeroProcesso: b.processo?.numeroProcesso || "",
      pacienteNome: b.processo?.pacienteNome || "",
      dataBloqueio: b.dataBloqueio || hoje(),
      valor: formatarMoedaBRL(b.valor),
      observacao: b.observacao || "",
    });
    setErro("");
    setAba("novo");
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    if (!editando) return;
    setErro("");
    setSalvandoEdicao(true);
    const res = await editarBloqueio(editando.id, {
      dataBloqueio: editando.dataBloqueio,
      valor: editando.valor,
      observacao: editando.observacao,
    });
    setSalvandoEdicao(false);
    if (!res.success) return setErro(res.error);
    setAviso(
      `Bloqueio do processo ${editando.numeroProcesso} atualizado ` +
        `(${formatarMoedaBRL(res.data.valor)}).`,
    );
    setEditando(null);
    if (consultou) await consultar(filtros);
  }

  async function remover(b) {
    const ok = await confirmar({
      title: "Excluir bloqueio",
      message:
        `Excluir o bloqueio de ${formatarMoedaBRL(b.valor)} de ` +
        `${dataBR(b.dataBloqueio)} do processo ${b.processo?.numeroProcesso || ""}? ` +
        "A exclusão é registrada na auditoria.",
      confirmText: "Excluir",
    });
    if (!ok) return;
    setErro("");
    const res = await excluirBloqueio(b.id, { confirmado: true });
    if (!res.success) return setErro(res.error);
    setAviso(`Bloqueio de ${b.processo?.numeroProcesso || ""} excluído.`);
    if (consultou) await consultar(filtros);
  }

  return (
    <div className={styles.container}>
      {/* Container principal único, sem cabeçalho externo: o título fica no
          topo do painel (padrão Novo Pedido da Regulação). */}
      <section className={styles.painel}>
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

        <div className={styles.abas}>
          <button
            type="button"
            className={aba === "consultar" ? styles.abaAtiva : styles.aba}
            onClick={() => setAba("consultar")}
          >
            Consultar Bloqueios
          </button>
          <button
            type="button"
            className={aba === "novo" ? styles.abaAtiva : styles.aba}
            onClick={() => {
              setEditando(null);
              setAba("novo");
            }}
          >
            Novo Bloqueio
          </button>
        </div>

        {aba === "novo" && (
          <div className={styles.bloco}>
        <h2 className={styles.secaoTitulo}>Dados do bloqueio</h2>

        <form onSubmit={salvar} className={styles.formulario}>
          <div className={styles.campoGrande}>
            <label className={styles.label}>Buscar paciente ou processo *</label>
            <input
              className={styles.input}
              placeholder="Nome, CPF ou número do processo judicial…"
              value={termo}
              onChange={(e) => aoDigitar(e.target.value)}
              autoComplete="off"
            />
            <span className={styles.dica}>
              {buscando
                ? "Buscando…"
                : processo
                  ? "Processo selecionado. Altere a busca para escolher outro."
                  : "Digite ao menos 2 caracteres (nome, CPF ou número do processo)."}
            </span>

            {/* Lista suspensa com os processos encontrados: o bloqueio é
                vinculado ao processo escolhido. Com um único processo, ele já
                vem selecionado. */}
            {resultados.length > 0 && (
              <div className={styles.campoGrande} style={{ marginTop: "0.75rem" }}>
                <label className={styles.label}>Processo para o bloqueio *</label>
                <select
                  className={styles.select}
                  value={processo ? String(processo.id) : ""}
                  onChange={(e) => {
                    const alvo = resultados.find((p) => String(p.id) === e.target.value);
                    if (alvo) selecionar(alvo);
                  }}
                  required
                >
                  <option value="">
                    {resultados.length === 1
                      ? "Selecione o processo"
                      : `Selecione o processo (${resultados.length} encontrados)`}
                  </option>
                  {resultados.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {`${p.numeroProcesso} · pasta ${p.numeroPastaPaciente || p.numeroPasta || "—"}` +
                        `${p.especialidadeNome ? ` · ${p.especialidadeNome}` : ""}` +
                        `${p.procedimentoNome ? ` / ${p.procedimentoNome}` : ""}`}
                    </option>
                  ))}
                </select>
                <span className={styles.dica}>
                  {resultados.length === 1
                    ? "Este paciente possui um único processo: o bloqueio será vinculado a ele."
                    : "Este paciente possui vários processos: escolha aquele que receberá o bloqueio."}
                </span>
              </div>
            )}

            {buscou && !buscando && resultados.length === 0 && !processo && (
              <span className={styles.dica}>
                Nenhum processo encontrado para esta busca.
              </span>
            )}
          </div>

          {processo && (
            <>
              <div className={styles.linha}>
                <div className={styles.campo}>
                  <label className={styles.label}>Paciente</label>
                  <input
                    className={styles.input}
                    value={processo.pacienteNome}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div className={styles.campo}>
                  <label className={styles.label}>CPF</label>
                  <input
                    className={styles.input}
                    value={formatarCpfExibicao(processo.pacienteCpf)}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
              </div>

              <div className={styles.linha}>
                <div className={styles.campo}>
                  <label className={styles.label}>Número da pasta</label>
                  <input
                    className={styles.input}
                    value={processo.numeroPastaPaciente || processo.numeroPasta || "—"}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div className={styles.campo}>
                  <label className={styles.label}>Número do processo</label>
                  <input
                    className={styles.input}
                    value={processo.numeroProcesso}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
              </div>

              <div className={styles.linha}>
                <div className={styles.campo}>
                  <label className={styles.label}>Especialidade</label>
                  <input
                    className={styles.input}
                    value={processo.especialidadeNome || "—"}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div className={styles.campo}>
                  <label className={styles.label}>Procedimento</label>
                  <input
                    className={styles.input}
                    value={processo.procedimentoNome || "—"}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
              </div>

              <div className={styles.linha}>
                <div className={styles.campo}>
                  <label className={styles.label}>Data do bloqueio *</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.campo}>
                  <label className={styles.label}>Valor do bloqueio (R$) *</label>
                  <input
                    className={styles.input}
                    value={valor}
                    onChange={(e) => setValor(mascararMoeda(e.target.value))}
                    placeholder="0,00"
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>

              <div className={styles.campoGrande}>
                <label className={styles.label}>Observação</label>
                <input
                  className={styles.input}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  maxLength={255}
                  placeholder="Opcional"
                />
              </div>

              <div className={styles.acoesForm}>
                <button type="button" className={styles.botaoSecundario} onClick={limpar}>
                  Cancelar
                </button>
                {podeCriar && (
                  <button type="submit" className={styles.botaoPrimario} disabled={salvando}>
                    {salvando ? "Salvando…" : "Registrar bloqueio"}
                  </button>
                )}
              </div>

              {!podeCriar && (
                <span className={styles.dica}>
                  Seu perfil consulta processos, mas não registra bloqueios.
                </span>
              )}

            </>
          )}
        </form>
          </div>
        )}

        {aba === "novo" && editando && (
          <div className={styles.blocoEdicao}>
            <h3 className={styles.secaoTitulo}>
              Editar bloqueio · processo {editando.numeroProcesso}
            </h3>
            <span className={styles.dica}>{editando.pacienteNome}</span>
            <form onSubmit={salvarEdicao} className={styles.formulario}>
              <div className={styles.linha}>
                <div className={styles.campo}>
                  <label className={styles.label}>Data do bloqueio *</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={editando.dataBloqueio}
                    onChange={(e) =>
                      setEditando((x) => ({ ...x, dataBloqueio: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className={styles.campo}>
                  <label className={styles.label}>Valor do bloqueio (R$) *</label>
                  <input
                    className={styles.input}
                    value={editando.valor}
                    onChange={(e) =>
                      setEditando((x) => ({ ...x, valor: mascararMoeda(e.target.value) }))
                    }
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>
              <div className={styles.campoGrande}>
                <label className={styles.label}>Observação</label>
                <input
                  className={styles.input}
                  value={editando.observacao}
                  onChange={(e) =>
                    setEditando((x) => ({ ...x, observacao: e.target.value }))
                  }
                  maxLength={255}
                  placeholder="Opcional"
                />
              </div>
              <div className={styles.acoesForm}>
                <button
                  type="button"
                  className={styles.botaoSecundario}
                  onClick={() => setEditando(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.botaoPrimario}
                  disabled={salvandoEdicao}
                >
                  {salvandoEdicao ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        )}

        {aba === "consultar" && (
          <div className={styles.bloco}>
            {/* Filtros de consulta: nada é listado até uma consulta. */}
            <div className={styles.filtros}>
              <div className={styles.filtrosGrid}>
                <div className={styles.campoFiltroBusca}>
                  <label>Buscar Registro</label>
                  <input
                    value={filtros.busca}
                    onChange={(e) => alterarFiltro("busca", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") consultar(filtros);
                    }}
                    placeholder="Digite o nome, CPF, número do processo ou número da pasta..."
                    autoComplete="off"
                  />
                </div>
                <div className={styles.campoFiltro}>
                  <label>Especialidade</label>
                  <select
                    value={filtros.especialidadeId}
                    onChange={(e) => alterarFiltro("especialidadeId", e.target.value)}
                  >
                    <option value="">Todas</option>
                    {catalogoFiltros.especialidades.map((esp) => (
                      <option key={esp.id} value={String(esp.id)}>
                        {esp.nome}
                        {esp.ativo === false ? " (inativa)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.campoFiltro}>
                  <label>Procedimento</label>
                  <select
                    value={filtros.procedimentoId}
                    onChange={(e) => alterarFiltro("procedimentoId", e.target.value)}
                  >
                    <option value="">Todos</option>
                    {procedimentosDoFiltro.map((pr) => (
                      <option key={pr.id} value={String(pr.id)}>
                        {pr.nome}
                        {pr.ativo === false ? " (inativo)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.campoFiltro}>
                  <label>Período da Data do Bloqueio</label>
                  <div className={styles.periodo}>
                    <input
                      type="date"
                      value={filtros.dataInicio}
                      onChange={(e) => alterarFiltro("dataInicio", e.target.value)}
                      aria-label="Data inicial"
                    />
                    <span>até</span>
                    <input
                      type="date"
                      value={filtros.dataFim}
                      onChange={(e) => alterarFiltro("dataFim", e.target.value)}
                      aria-label="Data final"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.filtrosAcoes}>
                <button
                  type="button"
                  className={styles.botaoPrimario}
                  onClick={() => consultar(filtros)}
                  disabled={consultando}
                >
                  {consultando ? "Filtrando…" : "Filtrar"}
                </button>
                <button type="button" className={styles.botaoSecundario} onClick={limparFiltros}>
                  Limpar filtros
                </button>
                <button
                  type="button"
                  className={styles.botaoSecundario}
                  onClick={() => consultar({}, { todos: true })}
                  disabled={consultando}
                >
                  Consultar todos
                </button>
              </div>
            </div>

            <div className={styles.resumoConsulta}>
              {consultou ? (
                <>
                  <span>
                    <strong>{total}</strong>{" "}
                    {total === 1 ? "registro encontrado" : "registros encontrados"}
                  </span>
                  <span>
                    Valor total: <strong>{formatarMoedaBRL(valorTotal)}</strong>
                  </span>
                </>
              ) : (
                <span>
                  Preencha os filtros e clique em Filtrar, ou consulte todos os registros.
                </span>
              )}
            </div>

            {!consultou ? null : bloqueios.length === 0 ? (
              <p className={styles.vazio}>
                Nenhum bloqueio encontrado para os filtros informados.
              </p>
            ) : (
              <div className={styles.tabelaWrap}>

              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Nº da Pasta</th>
                    <th>Paciente</th>
                    <th>Nº do Processo</th>
                    <th>Especialidade</th>
                    <th>Procedimento</th>
                    <th>Data do Bloqueio</th>
                    <th>Valor do Bloqueio</th>
                    <th className={styles.colAcoes}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {bloqueios.map((b) => (
                    <tr key={b.id}>
                      <td className={styles.colPasta}>
                        {b.processo?.numeroPasta || "—"}
                      </td>
                      <td>
                        <div className={styles.nomeCelula}>
                          {b.processo?.pacienteNome || "—"}
                        </div>
                        <div className={styles.cpfCelula}>
                          {formatarCpfExibicao(b.processo?.pacienteCpf)}
                        </div>
                      </td>
                      <td>{b.processo?.numeroProcesso || "—"}</td>
                      <td>{b.processo?.especialidadeNome || "—"}</td>
                      <td>{b.processo?.procedimentoNome || "—"}</td>
                      <td>{dataBR(b.dataBloqueio)}</td>
                      <td className={styles.valorCelula}>{formatarMoedaBRL(b.valor)}</td>
                      <td>
                        <div className={styles.acoes}>
                          {podeEditar && (
                            <button
                              type="button"
                              className={styles.botaoIconeAzul}
                              title="Editar bloqueio"
                              onClick={() => abrirEdicao(b)}
                            >
                              ✎ Editar
                            </button>
                          )}
                          {podeExcluir && (
                            <button
                              type="button"
                              className={styles.botaoIconeVermelho}
                              title="Excluir bloqueio"
                              onClick={() => remover(b)}
                            >
                              🗑 Excluir
                            </button>
                          )}
                          {!podeEditar && !podeExcluir && (
                            <span className={styles.dica}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}