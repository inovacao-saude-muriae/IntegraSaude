"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ESPECIALIDADES E PROCEDIMENTOS — catálogo PRÓPRIO da área Processos
// ─────────────────────────────────────────────────────────────────────────
// Câmara Técnica → Processos → Especialidades e Procedimentos.
//
// Independente da Junta Reguladora: nada aqui lê ou grava
// `junta_servicos`, `junta_especialidades` ou `regula_procedimentos`.
//
// Layout PADRONIZADO com Serviços e Especialidades (Junta) e Procedimentos
// (Regulação): busca, formulário e tabela única com situação e ações. A
// especialidade em foco é escolhida pela primeira coluna da tabela; os
// procedimentos listados são os dela, e o vínculo continua N:N (um
// procedimento pode estar em várias especialidades).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import "@/components/cadastros/padraoCadastro.css";
import { useConfirm } from "@/components/ConfirmDialog";
import FiltroSituacao, { passaSituacao } from "@/components/cadastros/FiltroSituacao";
import StatusRegistro from "@/components/cadastros/StatusRegistro";
import AcoesSituacao from "@/components/cadastros/AcoesSituacao";
import {
  alterarSituacaoEspecialidadeProcesso,
  alterarSituacaoProcedimentoProcesso,
  criarEspecialidadeProcesso,
  criarProcedimentoProcesso,
  definirProcedimentosDaEspecialidade,
  editarEspecialidadeProcesso,
  editarProcedimentoProcesso,
  listarCatalogoProcessos,
} from "./actions";
import styles from "./catalogo.module.css";

export default function CatalogoProcessosPage({
  podeCriarEspecialidade = false,
  podeEditarEspecialidade = false,
  podeInativarEspecialidade = false,
  podeCriarProcedimento = false,
  podeEditarProcedimento = false,
  podeInativarProcedimento = false,
  podeVincular = false,
}) {
  const confirm = useConfirm();

  const [dados, setDados] = useState({ especialidades: [], procedimentos: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const [selecionadaId, setSelecionadaId] = useState(null);
  const [buscaEsp, setBuscaEsp] = useState("");
  const [situacao, setSituacao] = useState("ativos");
  const [buscaProc, setBuscaProc] = useState("");
  const [situacaoProc, setSituacaoProc] = useState("ativos");
  const [alternando, setAlternando] = useState("");

  // Modais
  const [modalEsp, setModalEsp] = useState(null); // { id?, nome }
  const [modalProc, setModalProc] = useState(null); // { id?, nome, especialidadeIds }
  const [modalVincular, setModalVincular] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    const res = await listarCatalogoProcessos({ incluirInativos: true });
    if (res.success) setDados(res.data);
    else setErro(res.error);
    return res;
  }, []);

  useEffect(() => {
    (async () => {
      await recarregar();
      setCarregando(false);
    })();
  }, [recarregar]);

  const especialidadesVisiveis = useMemo(() => {
    const termo = buscaEsp.trim().toLowerCase();
    return dados.especialidades
      .filter((e) => passaSituacao(situacao, e.ativo !== false))
      .filter((e) => (termo ? e.nome.toLowerCase().includes(termo) : true));
  }, [dados.especialidades, buscaEsp, situacao]);

  // A especialidade em foco é DERIVADA: se a escolhida continua na lista usa
  // ela; senão cai para a primeira visível. Sem setState dentro de efeito.
  const selecionada = useMemo(() => {
    const escolhida = dados.especialidades.find((e) => e.id === selecionadaId);
    if (escolhida) return escolhida;
    return especialidadesVisiveis[0] || null;
  }, [dados.especialidades, especialidadesVisiveis, selecionadaId]);

  const procedimentosVisiveis = useMemo(() => {
    if (!selecionada) return [];
    const termo = buscaProc.trim().toLowerCase();
    return (selecionada.procedimentos || [])
      .filter((p) => passaSituacao(situacaoProc, p.ativo !== false))
      .filter((p) => (termo ? p.nome.toLowerCase().includes(termo) : true));
  }, [selecionada, buscaProc, situacaoProc]);

  function limparMensagens() {
    setErro("");
    setAviso("");
  }

  // ── Especialidades ───────────────────────────────────────────────────────
  async function salvarEspecialidade(e) {
    e?.preventDefault?.();
    limparMensagens();
    const alvo = modalEsp;
    if (!alvo?.nome?.trim()) return setErro("Informe o nome da especialidade.");

    setSalvando(true);
    const res = alvo.id
      ? await editarEspecialidadeProcesso(alvo.id, { nome: alvo.nome })
      : await criarEspecialidadeProcesso({ nome: alvo.nome });
    setSalvando(false);

    if (!res.success) return setErro(res.error);
    setModalEsp(null);
    setAviso(alvo.id ? "Especialidade atualizada." : "Especialidade cadastrada.");
    await recarregar();
    // Foca a especialidade recém-criada (a seleção é derivada do id).
    if (!alvo.id && res.data?.id) setSelecionadaId(res.data.id);
  }

  async function alternarEspecialidade(esp) {
    const ativo = esp.ativo !== false;
    const acao = ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} especialidade`,
      message: ativo
        ? `Inativar "${esp.nome}"? Ela deixa de aparecer em novos cadastros de processo, ` +
          `mas continua visível nos processos que já a utilizam.`
        : `Reativar "${esp.nome}"? Ela volta a aparecer nos novos cadastros.`,
      confirmText: acao,
    });
    if (!ok) return;
    limparMensagens();
    setAlternando(`e-${esp.id}`);
    const res = await alterarSituacaoEspecialidadeProcesso(esp.id, { ativo: !ativo });
    setAlternando("");
    if (!res.success) return setErro(res.error);
    setAviso(`Especialidade ${ativo ? "inativada" : "reativada"}.`);
    await recarregar();
  }

  // ── Procedimentos ────────────────────────────────────────────────────────
  async function salvarProcedimento(e) {
    e?.preventDefault?.();
    limparMensagens();
    const alvo = modalProc;
    if (!alvo?.nome?.trim()) return setErro("Informe o nome do procedimento.");

    setSalvando(true);
    const res = alvo.id
      ? await editarProcedimentoProcesso(alvo.id, { nome: alvo.nome })
      : await criarProcedimentoProcesso({
          nome: alvo.nome,
          especialidadeIds: alvo.especialidadeIds || [],
        });
    setSalvando(false);

    if (!res.success) return setErro(res.error);
    setModalProc(null);
    setAviso(alvo.id ? "Procedimento atualizado." : "Procedimento cadastrado.");
    await recarregar();
  }

  async function alternarProcedimento(proc) {
    const ativo = proc.ativo !== false;
    const acao = ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} procedimento`,
      message: ativo
        ? `Inativar "${proc.nome}"? Ele deixa de aparecer em novos cadastros, mas ` +
          `continua visível nos processos que já o utilizam.`
        : `Reativar "${proc.nome}"?`,
      confirmText: acao,
    });
    if (!ok) return;
    limparMensagens();
    setAlternando(`p-${proc.id}`);
    const res = await alterarSituacaoProcedimentoProcesso(proc.id, { ativo: !ativo });
    setAlternando("");
    if (!res.success) return setErro(res.error);
    setAviso(`Procedimento ${ativo ? "inativado" : "reativado"}.`);
    await recarregar();
  }

  async function salvarVinculos(e) {
    e?.preventDefault?.();
    limparMensagens();
    if (!selecionada) return;
    const marcados = (modalVincular?.selecionados || []).map(Number);
    setSalvando(true);
    const res = await definirProcedimentosDaEspecialidade(selecionada.id, {
      procedimentoIds: marcados,
    });
    setSalvando(false);
    if (!res.success) return setErro(res.error);
    setModalVincular(null);
    setAviso("Procedimentos da especialidade atualizados.");
    await recarregar();
  }

  // Procedimentos disponíveis para vincular (todos, ativos primeiro).
  const todosProcedimentos = useMemo(
    () =>
      [...dados.procedimentos].sort((a, b) => {
        if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
        return a.nome.localeCompare(b.nome, "pt-BR");
      }),
    [dados.procedimentos],
  );

  return (
    <div className="cadCadastro">
      {/* Cabeçalho e avisos no MESMO padrão de "Exames e Procedimentos" e
          "Serviços e Especialidades" (padraoCadastro.css). */}
      <div className="cadPaginaCabecalho">
        <div>
          <h1 className="cadPaginaTitulo">Especialidades e Procedimentos</h1>
          <p className="cadPaginaSubtitulo">
            Catálogo próprio da área Processos (Câmara Técnica). Não compartilha
            cadastros com a Junta Reguladora.
          </p>
        </div>
      </div>

      {aviso && (
        <div className="cadAviso cadAvisoSucesso" role="status">
          {aviso}
          <button
            type="button"
            className="cadAvisoFechar"
            onClick={() => setAviso("")}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}
      {erro && (
        <div className="cadAviso cadAvisoErro" role="alert">
          {erro}
          <button
            type="button"
            className="cadAvisoFechar"
            onClick={() => setErro("")}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      <div className="cadCard">
        <div className="cadCardTitleRow">
          <h3 className="cadCardTitle">Especialidades e Procedimentos</h3>
          <span className="cadCardSubtitle">
            Ex.: Cardiologia (especialidade) — Consulta Cardiológica (procedimento)
          </span>
        </div>

        {/* BUSCA */}
        <div className="cadBuscaBox">
          <div className="cadCampo">
            <label>Buscar especialidade</label>
            <div className="cadBuscaRow">
              <div className="cadBuscaWrapper">
                <input
                  type="text"
                  className="cadBuscaInput"
                  value={buscaEsp}
                  placeholder="Digite o nome da especialidade..."
                  onChange={(e) => setBuscaEsp(e.target.value)}
                />
              </div>
              {podeCriarEspecialidade && (
                <button
                  type="button"
                  className="cadBtnAdicionar"
                  onClick={() => setModalEsp({ nome: "" })}
                >
                  + Adicionar especialidade
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABELA DE ESPECIALIDADES */}
        <div className="cadTabelaTopo">
          <div className="cadTabelaTopoLinha">
            <h4 className="cadTabelaTitulo">Especialidades</h4>
            <div className="cadFiltros">
              <FiltroSituacao
                id="filtro-situacao-especialidades"
                valor={situacao}
                onChange={setSituacao}
              />
            </div>
          </div>

          <div className="cadTabelaWrapper">
            <table className="cadTabela">
              <thead>
                <tr>
                  <th>Especialidade</th>
                  <th>Situação</th>
                  <th className="cadDireita">Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={3} className="cadTabelaVazia">
                      Carregando catálogo…
                    </td>
                  </tr>
                ) : especialidadesVisiveis.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="cadTabelaVazia">
                      Nenhuma especialidade encontrada. Use “+ Adicionar especialidade”.
                    </td>
                  </tr>
                ) : (
                  especialidadesVisiveis.map((e) => {
                    const ativo = e.ativo !== false;
                    const emFoco = selecionada?.id === e.id;
                    return (
                      <tr
                        key={e.id}
                        className={ativo ? "" : "cadLinhaInativa"}
                        style={emFoco ? { background: "#eff6ff" } : undefined}
                      >
                        <td>
                          <div className={styles.celulaEsp}>
                            <button
                              type="button"
                              onClick={() => setSelecionadaId(e.id)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                font: "inherit",
                                fontWeight: 600,
                                color: emFoco ? "#1d4ed8" : "#0f172a",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                              title="Ver os procedimentos desta especialidade"
                            >
                              {e.nome}
                            </button>
                            {emFoco && (
                              <span className={styles.tagInativo}>em foco</span>
                            )}
                            <span className={styles.tagUsos}>
                              {e.procedimentos.length} procedimento(s) · {e.usos} processo(s)
                            </span>
                          </div>
                        </td>
                        <td>
                          <StatusRegistro ativo={ativo} />
                        </td>
                        <td>
                          <div className="cadAcoesLinha">
                            {podeEditarEspecialidade && (
                              <button
                                type="button"
                                className="cadBtnGhost"
                                style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem" }}
                                onClick={() => setModalEsp({ id: e.id, nome: e.nome })}
                              >
                                Editar
                              </button>
                            )}
                            <AcoesSituacao
                              ativo={ativo}
                              podeInativar={podeInativarEspecialidade}
                              ocupado={alternando === `e-${e.id}`}
                              onAlternar={() => alternarEspecialidade(e)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PROCEDIMENTOS DA ESPECIALIDADE EM FOCO */}
        <div className="cadTabelaTopo">
          <div className="cadTabelaTopoLinha">
            <h4 className="cadTabelaTitulo">
              {selecionada
                ? `Procedimentos — ${selecionada.nome}`
                : "Procedimentos"}
            </h4>
            <div className="cadFiltros">
              <FiltroSituacao
                id="filtro-situacao-procedimentos-processos"
                valor={situacaoProc}
                onChange={setSituacaoProc}
              />
              {selecionada && podeVincular && (
                <button
                  type="button"
                  className="cadBtnGhost"
                  onClick={() =>
                    setModalVincular({
                      selecionados: selecionada.procedimentos.map((p) => p.id),
                    })
                  }
                >
                  Gerenciar vínculos
                </button>
              )}
              {podeCriarProcedimento && (
                <button
                  type="button"
                  className="cadBtnAdicionar"
                  onClick={() =>
                    setModalProc({
                      nome: "",
                      especialidadeIds: selecionada ? [selecionada.id] : [],
                    })
                  }
                >
                  + Adicionar procedimento
                </button>
              )}
            </div>
          </div>

          <div className="cadBuscaBox" style={{ padding: "0.85rem" }}>
            <div className="cadBuscaWrapper">
              <input
                type="text"
                className="cadBuscaInput"
                value={buscaProc}
                placeholder="Buscar procedimento nesta especialidade..."
                onChange={(e) => setBuscaProc(e.target.value)}
              />
            </div>
          </div>

          <div className="cadTabelaWrapper">
            <table className="cadTabela">
              <thead>
                <tr>
                  <th>Procedimento</th>
                  <th>Situação</th>
                  <th className="cadDireita">Ações</th>
                </tr>
              </thead>
              <tbody>
                {!selecionada ? (
                  <tr>
                    <td colSpan={3} className="cadTabelaVazia">
                      Selecione uma especialidade na tabela acima para ver seus
                      procedimentos.
                    </td>
                  </tr>
                ) : procedimentosVisiveis.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="cadTabelaVazia">
                      Nenhum procedimento para os filtros selecionados. Use “Gerenciar
                      vínculos” ou “+ Adicionar procedimento”.
                    </td>
                  </tr>
                ) : (
                  procedimentosVisiveis.map((p) => {
                    const ativo = p.ativo !== false;
                    return (
                      <tr key={p.id} className={ativo ? "" : "cadLinhaInativa"}>
                        <td><strong>{p.nome}</strong></td>
                        <td><StatusRegistro ativo={ativo} /></td>
                        <td>
                          <div className="cadAcoesLinha">
                            {podeEditarProcedimento && (
                              <button
                                type="button"
                                className="cadBtnGhost"
                                style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem" }}
                                onClick={() => setModalProc({ id: p.id, nome: p.nome })}
                              >
                                Editar
                              </button>
                            )}
                            <AcoesSituacao
                              ativo={ativo}
                              podeInativar={podeInativarProcedimento}
                              ocupado={alternando === `p-${p.id}`}
                              onAlternar={() => alternarProcedimento(p)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modal especialidade ────────────────────────────────────────────── */}
      {modalEsp && (
        <div className={styles.overlay} onClick={() => setModalEsp(null)} role="presentation">
          <div
            className={styles.modal}
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className={styles.modalTitulo}>
              {modalEsp.id ? "Editar especialidade" : "Nova especialidade"}
            </h3>
            <form onSubmit={salvarEspecialidade} className={styles.formulario}>
              <label className={styles.label}>Nome *</label>
              <input
                className={styles.input}
                autoFocus
                maxLength={150}
                value={modalEsp.nome}
                onChange={(ev) => setModalEsp({ ...modalEsp, nome: ev.target.value })}
                placeholder="Ex.: Cardiologia"
              />
              <p className={styles.dica}>
                Nomes equivalentes (maiúsculas, acentos e espaços) não são duplicados.
              </p>
              <div className={styles.acoesForm}>
                <button
                  type="button"
                  className="cadBtnGhost"
                  onClick={() => setModalEsp(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="cadBtnPrimario" disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal procedimento ─────────────────────────────────────────────── */}
      {modalProc && (
        <div
          className={styles.overlay}
          onClick={() => setModalProc(null)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className={styles.modalTitulo}>
              {modalProc.id ? "Editar procedimento" : "Novo procedimento"}
            </h3>
            <form onSubmit={salvarProcedimento} className={styles.formulario}>
              <label className={styles.label}>Nome *</label>
              <input
                className={styles.input}
                autoFocus
                maxLength={150}
                value={modalProc.nome}
                onChange={(ev) => setModalProc({ ...modalProc, nome: ev.target.value })}
                placeholder="Ex.: Consulta Cardiológica"
              />

              {!modalProc.id && (
                <>
                  <label className={styles.label}>Especialidades vinculadas</label>
                  <div className={styles.caixaSelecao}>
                    {dados.especialidades
                      .filter((e) => e.ativo)
                      .map((e) => (
                        <label key={e.id} className={styles.check}>
                          <input
                            type="checkbox"
                            checked={(modalProc.especialidadeIds || []).includes(e.id)}
                            onChange={(ev) => {
                              const atual = modalProc.especialidadeIds || [];
                              setModalProc({
                                ...modalProc,
                                especialidadeIds: ev.target.checked
                                  ? [...atual, e.id]
                                  : atual.filter((x) => x !== e.id),
                              });
                            }}
                          />
                          {e.nome}
                        </label>
                      ))}
                    {dados.especialidades.filter((e) => e.ativo).length === 0 && (
                      <p className={styles.dica}>
                        Cadastre uma especialidade primeiro.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className={styles.acoesForm}>
                <button
                  type="button"
                  className="cadBtnGhost"
                  onClick={() => setModalProc(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="cadBtnPrimario" disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal vínculos ─────────────────────────────────────────────────── */}
      {modalVincular && selecionada && (
        <div
          className={styles.overlay}
          onClick={() => setModalVincular(null)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className={styles.modalTitulo}>
              Procedimentos de “{selecionada.nome}”
            </h3>
            <form onSubmit={salvarVinculos} className={styles.formulario}>
              <div className={styles.caixaSelecao}>
                {todosProcedimentos.length === 0 && (
                  <p className={styles.dica}>
                    Nenhum procedimento no catálogo. Cadastre um em “+ Adicionar
                    procedimento”.
                  </p>
                )}
                {todosProcedimentos.map((p) => (
                  <label key={p.id} className={styles.check}>
                    <input
                      type="checkbox"
                      checked={(modalVincular.selecionados || []).includes(p.id)}
                      onChange={(ev) => {
                        const atual = modalVincular.selecionados || [];
                        setModalVincular({
                          selecionados: ev.target.checked
                            ? [...atual, p.id]
                            : atual.filter((x) => x !== p.id),
                        });
                      }}
                    />
                    {p.nome}
                    {!p.ativo && <span className={styles.tagInativo}>inativo</span>}
                  </label>
                ))}
              </div>
              <div className={styles.acoesForm}>
                <button
                  type="button"
                  className="cadBtnGhost"
                  onClick={() => setModalVincular(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="cadBtnPrimario" disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar vínculos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
