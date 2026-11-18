"use client";

// ═══════════════════════════════════════════════════════════════════════════
// REALIZAR BLOQUEIO — Processos Cirúrgicos (Câmara Técnica › Processos Judiciais)
// ─────────────────────────────────────────────────────────────────────────
// 1. Busca por nome, CPF ou número do processo judicial.
// 2. Paciente com UM processo → carrega automaticamente; com vários →
//    apresenta a lista para escolher aquele que receberá o bloqueio.
// 3. Os dados do processo aparecem em campos SOMENTE LEITURA.
// 4. Data (obrigatória) + valor monetário brasileiro (obrigatório, > 0).
//
// O bloqueio é gravado em processos_bloqueios vinculado ao PROCESSO
// (processo_id), nunca apenas ao paciente. As permissões vêm do servidor
// (`podeCriar`); o backend revalida tudo em `criarBloqueio`.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatarCpfExibicao } from "@/lib/cpf";
import { mascararMoeda, formatarMoedaBRL } from "@/lib/moeda";
import { buscarProcessosParaBloqueio, criarBloqueio, listarBloqueios } from "../actions";
import styles from "../page.module.css";

const hoje = () => new Date().toISOString().slice(0, 10);

const dataBR = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};

export default function BloqueioJudicial({ podeCriar = false }) {
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
  const timer = useRef(null);

  const recarregarBloqueios = useCallback(async () => {
    const res = await listarBloqueios({});
    if (res.success) setBloqueios(res.data);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await listarBloqueios({});
      if (vivo && res.success) setBloqueios(res.data);
    })();
    return () => {
      vivo = false;
    };
  }, []);

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

  const bloqueiosDoProcesso = useMemo(
    () => (processo ? bloqueios.filter((b) => b.processoId === processo.id) : []),
    [bloqueios, processo],
  );

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
    await recarregarBloqueios();
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

              {bloqueiosDoProcesso.length > 0 && (
                <div className={styles.campoGrande}>
                  <label className={styles.label}>
                    Bloqueios já registrados neste processo
                  </label>
                  <div className={styles.tabelaWrap}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Valor</th>
                          <th>Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bloqueiosDoProcesso.map((b) => (
                          <tr key={b.id}>
                            <td>{dataBR(b.dataBloqueio)}</td>
                            <td>{formatarMoedaBRL(b.valor)}</td>
                            <td>{b.observacao || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </form>
      </section>
    </div>
  );
}
