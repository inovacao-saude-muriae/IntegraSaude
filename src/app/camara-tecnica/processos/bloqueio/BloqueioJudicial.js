"use client";

// ═══════════════════════════════════════════════════════════════════════════
// REALIZAR BLOQUEIO — Processos Cirúrgicos (Câmara Técnica › Processos Judiciais)
// ─────────────────────────────────────────────────────────────────────────
// 1. Busca por nome, CPF ou número do processo judicial.
// 2. Paciente com UM processo → carrega automaticamente; com vários →
//    apresenta a lista para escolher aquele que receberá o bloqueio.
// 3. Os dados do processo aparecem em campos SOMENTE LEITURA.
// 4. Data (obrigatória) + valor monetário brasileiro (obrigatório, > 0).
// 5. Abaixo do formulário, a tabela com TODOS os bloqueios cadastrados, com
//    pesquisa, Editar e Excluir (permissões vêm do servidor).
//
// O bloqueio é gravado em processos_bloqueios vinculado ao PROCESSO
// (processo_id), nunca apenas ao paciente. As permissões vêm do servidor
// (`podeCriar`); o backend revalida tudo em `criarBloqueio`.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { formatarCpfExibicao } from "@/lib/cpf";
import { mascararMoeda, formatarMoedaBRL } from "@/lib/moeda";
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

export default function BloqueioJudicial({
  podeCriar = false,
  podeEditar = false,
  podeExcluir = false,
}) {
  const confirmar = useConfirm();
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
  // Pesquisa da tabela (nome, CPF, número da pasta ou do processo).
  const [buscaTabela, setBuscaTabela] = useState("");
  const [carregandoTabela, setCarregandoTabela] = useState(true);
  // Edição inline de um bloqueio da tabela.
  const [editando, setEditando] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const timer = useRef(null);
  const timerTabela = useRef(null);

  const recarregarBloqueios = useCallback(async (termoBusca = "") => {
    const res = await listarBloqueios({ termo: termoBusca });
    if (res.success) setBloqueios(res.data);
    else setErro(res.error);
    return res;
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await listarBloqueios({});
      if (!vivo) return;
      if (res.success) setBloqueios(res.data);
      else setErro(res.error);
      setCarregandoTabela(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Pesquisa com debounce na tabela de bloqueios.
  function aoPesquisarTabela(texto) {
    setBuscaTabela(texto);
    clearTimeout(timerTabela.current);
    timerTabela.current = setTimeout(() => recarregarBloqueios(texto), 350);
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

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(timerTabela.current);
    },
    [],
  );

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
    // Atualiza a tabela sem recarregar a página.
    await recarregarBloqueios(buscaTabela);
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
    await recarregarBloqueios(buscaTabela);
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
    await recarregarBloqueios(buscaTabela);
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
        {/* ── Bloqueios cadastrados ─────────────────────────────────────── */}
        <div className={styles.tabelaSecao}>
          <h2 className={styles.secaoTitulo}>Bloqueios cadastrados</h2>

          <div className={styles.barraBusca}>
            <input
              className={styles.campoBusca}
              placeholder="Buscar por nome, CPF, número da pasta ou do processo…"
              value={buscaTabela}
              onChange={(e) => aoPesquisarTabela(e.target.value)}
            />
            <button
              type="button"
              className={styles.botaoSecundario}
              onClick={() => recarregarBloqueios(buscaTabela)}
            >
              Buscar
            </button>
          </div>

          {carregandoTabela ? (
            <p className={styles.vazio}>Carregando bloqueios…</p>
          ) : bloqueios.length === 0 ? (
            <p className={styles.vazio}>
              {buscaTabela
                ? "Nenhum bloqueio encontrado para esta busca."
                : "Nenhum bloqueio cadastrado."}
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
                      <td>{b.processo?.numeroPasta || "—"}</td>
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

        {/* ── Edição do bloqueio (inline, no painel) ────────────────────── */}
        {editando && (
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
      </section>
    </div>
  );
}
