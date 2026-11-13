"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ESPECIALIDADES E PROCEDIMENTOS — catálogo PRÓPRIO da área Processos
// ─────────────────────────────────────────────────────────────────────────
// Câmara Técnica → Processos → Especialidades e Procedimentos.
//
// Independente da Junta Reguladora: nada aqui lê ou grava
// `junta_servicos`, `junta_especialidades` ou `regula_procedimentos`.
//
// Duas colunas: especialidades à esquerda (com contagem de procedimentos) e,
// à direita, os procedimentos da especialidade selecionada. O cadastro de
// procedimento permite vincular a VÁRIAS especialidades — o vínculo é N:N.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
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
  const [mostrarInativas, setMostrarInativas] = useState(false);

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
      .filter((e) => (mostrarInativas ? true : e.ativo))
      .filter((e) => (termo ? e.nome.toLowerCase().includes(termo) : true));
  }, [dados.especialidades, buscaEsp, mostrarInativas]);

  // A especialidade em foco é DERIVADA: se a escolhida continua na lista usa
  // ela; senão cai para a primeira visível. Sem setState dentro de efeito.
  const selecionada = useMemo(() => {
    const escolhida = dados.especialidades.find((e) => e.id === selecionadaId);
    if (escolhida) return escolhida;
    return especialidadesVisiveis[0] || null;
  }, [dados.especialidades, especialidadesVisiveis, selecionadaId]);

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
    const acao = esp.ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} especialidade`,
      message: esp.ativo
        ? `Inativar "${esp.nome}"? Ela deixa de aparecer em novos cadastros de processo, ` +
          `mas continua visível nos processos que já a utilizam.`
        : `Reativar "${esp.nome}"? Ela volta a aparecer nos novos cadastros.`,
      confirmText: acao,
    });
    if (!ok) return;
    limparMensagens();
    const res = await alterarSituacaoEspecialidadeProcesso(esp.id, { ativo: !esp.ativo });
    if (!res.success) return setErro(res.error);
    setAviso(`Especialidade ${esp.ativo ? "inativada" : "reativada"}.`);
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
    const acao = proc.ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} procedimento`,
      message: proc.ativo
        ? `Inativar "${proc.nome}"? Ele deixa de aparecer em novos cadastros, mas ` +
          `continua visível nos processos que já o utilizam.`
        : `Reativar "${proc.nome}"?`,
      confirmText: acao,
    });
    if (!ok) return;
    limparMensagens();
    const res = await alterarSituacaoProcedimentoProcesso(proc.id, { ativo: !proc.ativo });
    if (!res.success) return setErro(res.error);
    setAviso(`Procedimento ${proc.ativo ? "inativado" : "reativado"}.`);
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
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Especialidades e Procedimentos</h1>
          <p className={styles.subtitulo}>
            Catálogo próprio da área Processos (Câmara Técnica). Não compartilha
            cadastros com a Junta Reguladora.
          </p>
        </div>
      </div>

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

      <div className={styles.grade}>
        {/* ── Especialidades ─────────────────────────────────────────────── */}
        <section className={styles.card}>
          <div className={styles.cardTopo}>
            <h2 className={styles.secaoTitulo}>Especialidades</h2>
            {podeCriarEspecialidade && (
              <button
                type="button"
                className={styles.botaoPrimario}
                onClick={() => setModalEsp({ nome: "" })}
              >
                + Nova
              </button>
            )}
          </div>

          <input
            className={styles.campoBusca}
            placeholder="Filtrar especialidades…"
            value={buscaEsp}
            onChange={(e) => setBuscaEsp(e.target.value)}
          />
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={mostrarInativas}
              onChange={(e) => setMostrarInativas(e.target.checked)}
            />
            Mostrar inativas
          </label>

          {carregando ? (
            <p className={styles.vazio}>Carregando catálogo…</p>
          ) : especialidadesVisiveis.length === 0 ? (
            <p className={styles.vazio}>
              Nenhuma especialidade cadastrada. Use “+ Nova” para começar.
            </p>
          ) : (
            <ul className={styles.lista}>
              {especialidadesVisiveis.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={
                      e.id === selecionada?.id ? styles.itemSelecionado : styles.item
                    }
                    onClick={() => setSelecionadaId(e.id)}
                  >
                    <span className={styles.itemNome}>
                      {e.nome}
                      {!e.ativo && <span className={styles.tagInativo}>inativa</span>}
                    </span>
                    <span className={styles.itemSub}>
                      {e.procedimentos.length} procedimento(s) · {e.usos} processo(s)
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Procedimentos da especialidade ─────────────────────────────── */}
        <section className={styles.card}>
          <div className={styles.cardTopo}>
            <h2 className={styles.secaoTitulo}>
              {selecionada ? `Procedimentos — ${selecionada.nome}` : "Procedimentos"}
            </h2>
            <div className={styles.acoesTopo}>
              {selecionada && podeVincular && (
                <button
                  type="button"
                  className={styles.botaoSecundario}
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
                  className={styles.botaoPrimario}
                  onClick={() =>
                    setModalProc({
                      nome: "",
                      especialidadeIds: selecionada ? [selecionada.id] : [],
                    })
                  }
                >
                  + Novo
                </button>
              )}
            </div>
          </div>

          {!selecionada ? (
            <p className={styles.vazio}>
              Selecione uma especialidade à esquerda para ver seus procedimentos.
            </p>
          ) : selecionada.procedimentos.length === 0 ? (
            <p className={styles.vazio}>
              Nenhum procedimento vinculado. Use “Gerenciar vínculos” ou cadastre um
              novo procedimento.
            </p>
          ) : (
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Procedimento</th>
                  <th>Situação</th>
                  <th className={styles.colAcoes}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {selecionada.procedimentos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>
                      <span className={p.ativo ? styles.statusAtivo : styles.statusInativo}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.acoes}>
                        {podeEditarProcedimento && (
                          <button
                            type="button"
                            className={styles.botaoIcone}
                            onClick={() => setModalProc({ id: p.id, nome: p.nome })}
                          >
                            ✎ Editar
                          </button>
                        )}
                        {podeInativarProcedimento && (
                          <button
                            type="button"
                            className={
                              p.ativo ? styles.botaoIconeVermelho : styles.botaoIconeAzul
                            }
                            onClick={() => alternarProcedimento(p)}
                          >
                            {p.ativo ? "Inativar" : "Reativar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selecionada && (
            <div className={styles.rodapeCard}>
              {podeEditarEspecialidade && (
                <button
                  type="button"
                  className={styles.botaoSecundario}
                  onClick={() => setModalEsp({ id: selecionada.id, nome: selecionada.nome })}
                >
                  ✎ Editar especialidade
                </button>
              )}
              {podeInativarEspecialidade && (
                <button
                  type="button"
                  className={
                    selecionada.ativo ? styles.botaoPerigo : styles.botaoSecundario
                  }
                  onClick={() => alternarEspecialidade(selecionada)}
                >
                  {selecionada.ativo ? "Inativar especialidade" : "Reativar especialidade"}
                </button>
              )}
            </div>
          )}
        </section>
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
                  className={styles.botaoSecundario}
                  onClick={() => setModalEsp(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.botaoPrimario} disabled={salvando}>
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
                  className={styles.botaoSecundario}
                  onClick={() => setModalProc(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.botaoPrimario} disabled={salvando}>
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
                    Nenhum procedimento no catálogo. Cadastre um em “+ Novo”.
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
                  className={styles.botaoSecundario}
                  onClick={() => setModalVincular(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.botaoPrimario} disabled={salvando}>
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
