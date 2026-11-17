"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ESPECIALIDADES E PROCEDIMENTOS — catálogo PRÓPRIO da área Processos
// ─────────────────────────────────────────────────────────────────────────
// Câmara Técnica → Processos → Especialidades e Procedimentos.
//
// Estrutura IDÊNTICA à de "Exames e Procedimentos" (Regulação) e "Serviços e
// Especialidades" (Junta): Buscar no Banco + Adicionar novo, Informações do
// Registro (dois campos lado a lado, com "+ Nova ..." dentro do próprio
// campo de seleção) e a tabela Cadastros com filtros de situação e de
// especialidade. Sem cabeçalho externo: o título é o do container.
//
// Independência dos catálogos: nada aqui lê ou grava `junta_servicos`,
// `junta_especialidades` ou `regula_procedimentos`. As fontes são
// `processos_especialidades`, `processos_procedimentos` e o vínculo N:N em
// `processos_especialidade_procedimento`.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import "@/components/cadastros/padraoCadastro.css";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import BotaoEditar from "@/components/BotaoEditar";
import FiltroSituacao from "@/components/cadastros/FiltroSituacao";
import StatusRegistro from "@/components/cadastros/StatusRegistro";
import { situacaoRegistro, passaSituacaoOperacional } from "@/components/cadastros/situacaoCadastro";
import AcoesSituacao from "@/components/cadastros/AcoesSituacao";
import {
  alterarSituacaoEspecialidadeProcesso,
  alterarSituacaoProcedimentoProcesso,
  getCatalogoProcessosData,
  salvarRegistroCatalogo,
} from "./actions";

const FORM_VAZIO = {
  linha: null, // linha em edição (par Especialidade + Procedimento)
  especialidadeId: "", // id da especialidade ("__novo__" para criar)
  especialidadeNome: "", // usado quando especialidadeId === "__novo__"
  procedimentoSel: "", // "" | "__novo__" | id do procedimento
  procedimentoNome: "", // nome do procedimento (novo ou existente)
  search: "",
  isEditing: false,
  isFormActive: false,
};

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
  const notify = useNotify();

  const [data, setData] = useState({
    especialidades: [],
    procedimentos: [],
    linhas: [],
  });
  const [form, setForm] = useState(FORM_VAZIO);
  const [dropAberto, setDropAberto] = useState(false);
  const [filterEspecialidadeId, setFilterEspecialidadeId] = useState("");
  const [situacao, setSituacao] = useState("ativos");
  const [alternando, setAlternando] = useState(null);

  const dropRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const reloadData = useCallback(async () => {
    const res = await getCatalogoProcessosData();
    setData(
      res?.success
        ? res
        : { especialidades: [], procedimentos: [], linhas: [] },
    );
    return res;
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const res = await getCatalogoProcessosData();
      if (!ativo) return;
      setData(res?.success ? res : { especialidades: [], procedimentos: [], linhas: [] });
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const resetForm = () => setForm(FORM_VAZIO);

  const carregarParaEdicao = (linha) => {
    setForm({
      linha,
      especialidadeId: String(linha.especialidadeId),
      especialidadeNome: "",
      procedimentoSel: linha.procedimentoId ? String(linha.procedimentoId) : "",
      procedimentoNome: linha.procedimentoNome || "",
      search: linha.procedimentoNome || linha.especialidadeNome,
      isEditing: true,
      isFormActive: false,
    });
    setDropAberto(false);
  };

  const habilitarEdicao = () => setForm((prev) => ({ ...prev, isFormActive: true }));

  // ── Busca no banco ───────────────────────────────────────────────────────
  const termo = (form.search || "").toLowerCase().trim();
  const linhasFiltradas = (data.linhas || []).filter((l) => {
    if (!termo) return true;
    return (
      (l.procedimentoNome || "").toLowerCase().includes(termo) ||
      (l.especialidadeNome || "").toLowerCase().includes(termo)
    );
  });

  const usandoNovaEsp = form.especialidadeId === "__novo__";
  const usandoNovoProc = form.procedimentoSel === "__novo__";

  // Procedimentos elegíveis para a especialidade escolhida: os já vinculados a
  // ela. Um procedimento existente de outra especialidade continua disponível
  // pela busca/lista geral — o vínculo N:N é criado ao salvar.
  const procedimentosDisponiveis = (data.procedimentos || []).filter(
    (p) =>
      p.ativo !== false ||
      // inativo só aparece se já estiver vinculado a esta especialidade
      (form.especialidadeId &&
        form.especialidadeId !== "__novo__" &&
        (p.especialidadeIds || []).includes(Number(form.especialidadeId))),
  );

  // O <select> controlado não expõe a opção "+ Novo procedimento..." como
  // valor: ao escolhê-la, o navegador volta para a opção atual e o evento
  // nunca chega ao estado. Por isso o "+ Novo" é tratado aqui, no próprio
  // evento de mudança, antes de qualquer outra coisa.
  const mudarProcedimento = (e) => {
    const value = e.target.value;
    if (value === "__novo__") {
      setForm((prev) => ({
        ...prev,
        procedimentoSel: "__novo__",
        procedimentoNome: "",
        linha: prev.linha?.procedimentoId
          ? { ...prev.linha, procedimentoId: null }
          : prev.linha,
      }));
      return;
    }
    onSelecionarProcedimento(value);
  };

  const onSelecionarProcedimento = (value) => {
    if (value === "__novo__") {
      setForm((prev) => ({
        ...prev,
        procedimentoSel: "__novo__",
        procedimentoNome: "",
        linha: prev.linha?.procedimentoId
          ? { ...prev.linha, procedimentoId: null }
          : prev.linha,
      }));
      return;
    }
    if (value === "") {
      setForm((prev) => ({
        ...prev,
        procedimentoSel: "",
        procedimentoNome: "",
        linha: prev.linha?.procedimentoId
          ? { ...prev.linha, procedimentoId: null }
          : prev.linha,
      }));
      return;
    }
    const proc = procedimentosDisponiveis.find((p) => String(p.id) === String(value));
    setForm((prev) => ({
      ...prev,
      procedimentoSel: value,
      procedimentoNome: proc?.nome || "",
      linha: prev.linha,
    }));
  };

  // ── Salvar ───────────────────────────────────────────────────────────────
  const submit = async (e) => {
    e.preventDefault();

    if (!form.especialidadeId) {
      await notify({
        tipo: "erro",
        title: "Campo obrigatório",
        message: "Selecione ou informe a especialidade.",
      });
      return;
    }
    if (usandoNovaEsp && !form.especialidadeNome.trim()) {
      await notify({
        tipo: "erro",
        title: "Campo obrigatório",
        message: "Informe o nome da nova especialidade.",
      });
      return;
    }
    if (usandoNovoProc && !form.procedimentoNome.trim()) {
      await notify({
        tipo: "erro",
        title: "Campo obrigatório",
        message: "Informe o nome do novo procedimento.",
      });
      return;
    }

    const ok = await confirm({
      title: form.isEditing ? "Atualizar registro" : "Cadastrar registro",
      message: form.isEditing
        ? "Deseja salvar as alterações deste registro?"
        : "Deseja confirmar este cadastro?",
      confirmText: form.isEditing ? "Atualizar" : "Cadastrar",
    });
    if (!ok) return;

    const payload = {
      linha: form.linha,
      especialidadeId: usandoNovaEsp ? null : form.especialidadeId,
      especialidadeNome: usandoNovaEsp ? form.especialidadeNome : "",
      procedimentoId: usandoNovoProc ? null : form.procedimentoSel,
      procedimentoNome: form.procedimentoNome,
    };
    const res = await salvarRegistroCatalogo({
      linha: form.linha,
      especialidadeId: usandoNovaEsp ? null : form.especialidadeId,
      especialidadeNome: usandoNovaEsp ? form.especialidadeNome : "",
      procedimentoId: usandoNovoProc ? null : form.procedimentoSel,
      procedimentoNome: form.procedimentoNome,
    });

    if (res.success) {
      await notify({
        tipo: "sucesso",
        title: form.isEditing ? "Registro atualizado" : "Registro cadastrado",
        message: form.isEditing
          ? "Registro atualizado com sucesso!"
          : "Registro cadastrado com sucesso!",
      });
      await reloadData();
      resetForm();
    } else {
      await notify({ tipo: "erro", title: "Erro", message: res.error });
    }
  };

  // ── Inativar / Reativar ──────────────────────────────────────────────────
  async function alternarEspecialidade(linha) {
    const ativo = linha.especialidadeAtivo !== false;
    const acao = ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} especialidade`,
      message: ativo
        ? `Inativar a especialidade "${linha.especialidadeNome}"? Os procedimentos dela ` +
          `ficam indisponíveis neste contexto — sem serem inativados individualmente. ` +
          `Os vínculos e os registros históricos são preservados.`
        : `Reativar a especialidade "${linha.especialidadeNome}"? Os procedimentos dela ` +
          `voltam a ficar disponíveis, exceto os que estavam inativos individualmente, ` +
          `que continuam inativos.`,
      confirmText: acao,
    });
    if (!ok) return;

    setAlternando(`e-${linha.especialidadeId}`);
    const res = await alterarSituacaoEspecialidadeProcesso(linha.especialidadeId, {
      ativo: !ativo,
    });
    setAlternando(null);
    if (!res.success) {
      return notify({ tipo: "erro", title: "Erro", message: res.error });
    }
    await notify({
      tipo: "sucesso",
      title: `Especialidade ${ativo ? "inativada" : "reativada"}`,
      message: `"${linha.especialidadeNome}" ${ativo ? "inativada" : "reativada"} com sucesso!`,
    });
    reloadData();
  }

  async function alternarProcedimento(linha) {
    const ativo = linha.procedimentoAtivo !== false;
    const acao = ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} procedimento`,
      message: ativo
        ? `Inativar "${linha.procedimentoNome}"? Ele deixa de ser oferecido em novos ` +
          `processos. Os vínculos com as especialidades e os registros históricos são ` +
          `preservados.`
        : `Reativar "${linha.procedimentoNome}"? Ele volta a ser oferecido nos novos processos.`,
      confirmText: acao,
    });
    if (!ok) return;

    setAlternando(`p-${linha.procedimentoId}`);
    const res = await alterarSituacaoProcedimentoProcesso(linha.procedimentoId, {
      ativo: !ativo,
    });
    setAlternando(null);
    if (!res.success) {
      return notify({ tipo: "erro", title: "Erro", message: res.error });
    }
    await notify({
      tipo: "sucesso",
      title: `Procedimento ${ativo ? "inativado" : "reativado"}`,
      message: `"${linha.procedimentoNome}" ${ativo ? "inativado" : "reativado"} com sucesso!`,
    });
    reloadData();
  }

  // ── Tabela ───────────────────────────────────────────────────────────────
  const linhasTabela = (data.linhas || []).filter((l) => {
    if (filterEspecialidadeId && String(l.especialidadeId) !== String(filterEspecialidadeId)) {
      return false;
    }
    // Disponibilidade neste contexto: procedimento ativo E especialidade ativa.
    return passaSituacaoOperacional(situacao, l.disponivel !== false);
  });

  return (
    <div className="cadCadastro">
      <div className="cadCard">
        <div className="cadCardTitleRow">
          <h3 className="cadCardTitle">Especialidades e Procedimentos</h3>
          <span className="cadCardSubtitle">
            Ex.: Ortopedia (especialidade) | Artroplastia (procedimento)
          </span>
        </div>

        {/* BUSCA */}
        <div className="cadBuscaBox">
          <div className="cadCampo">
            <label>Buscar no Banco (Especialidade ou Procedimento)</label>
            <div className="cadBuscaRow">
              <div className="cadBuscaWrapper" ref={dropRef}>
                <input
                  type="text"
                  className="cadBuscaInput"
                  value={form.search || ""}
                  placeholder="Selecionar ou digitar para buscar..."
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, search: e.target.value }));
                    setDropAberto(true);
                  }}
                  onFocus={() => setDropAberto(true)}
                />
                <span className="cadBuscaSeta" onClick={() => setDropAberto(!dropAberto)}>
                  {dropAberto ? "▲" : "▼"}
                </span>

                {dropAberto && (
                  <div className="cadDropdown">
                    <div className="cadDropdownScroll">
                      <table className="cadDropdownTabela">
                        <thead>
                          <tr>
                            <th>Especialidade</th>
                            <th>Procedimento</th>
                            <th>Situação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasFiltradas.length > 0 ? (
                            linhasFiltradas.map((l) => (
                              <tr
                                key={l.id}
                                onMouseDown={(ev) => {
                                  ev.preventDefault();
                                  carregarParaEdicao(l);
                                }}
                                className={form.linha?.id === l.id ? "cadLinhaSelecionada" : ""}
                              >
                                <td>
                                  <strong>{l.especialidadeNome}</strong>
                                </td>
                                <td>{l.procedimentoNome || "—"}</td>
                                <td>
                                  <StatusRegistro
                                    ativo={
                                      l.procedimentoId
                                        ? l.procedimentoAtivo !== false
                                        : l.especialidadeAtivo !== false
                                    }
                                    paiInativo={l.especialidadeAtivo === false}
                                    nomePai="Especialidade"
                                  />
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" className="cadSemDados">
                                Nenhum registro encontrado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="cadBtnAdicionar"
                onClick={() => setForm({ ...FORM_VAZIO, isFormActive: true })}
              >
                + Adicionar novo
              </button>
            </div>
          </div>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={submit} className="cadForm">
          <div className="cadFormSecao">
            <div className="cadFormSecaoTopo">
              <h4>Informações do Registro</h4>
            </div>
            <div className="cadGrade">
              <div className="cadCampo cadCol6">
                <label>Especialidade *</label>
                <select
                  value={form.especialidadeId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      especialidadeId: e.target.value,
                      especialidadeNome: "",
                      // troca de especialidade limpa a seleção de procedimento
                      procedimentoSel: "",
                      procedimentoNome: "",
                      linha: null,
                    })
                  }
                  disabled={!form.isFormActive}
                  required
                >
                  <option value="">-- Selecione a Especialidade --</option>
                  {(data.especialidades || []).map((esp) => (
                    <option key={esp.id} value={esp.id}>
                      {esp.nome}
                      {esp.ativo === false ? " (inativa)" : ""}
                    </option>
                  ))}
                  {podeCriarEspecialidade && (
                    <option value="__novo__">+ Nova especialidade...</option>
                  )}
                </select>
                {form.isFormActive && (data.especialidades || []).length === 0 && (
                  <p className="cadCampoDica">
                    Nenhuma especialidade ativa. Use “+ Nova especialidade…” para cadastrar.
                  </p>
                )}
              </div>

              {usandoNovaEsp && (
                <div className="cadCampo cadCol6">
                  <label>Nome da Nova Especialidade *</label>
                  <input
                    type="text"
                    value={form.especialidadeNome}
                    placeholder="Ex.: Ortopedia"
                    onChange={(e) => setForm({ ...form, especialidadeNome: e.target.value })}
                    disabled={!form.isFormActive}
                    required
                  />
                </div>
              )}

              <div className="cadCampo cadCol6">
                <label>Procedimento</label>
                <select
                  value={form.procedimentoSel}
                  onChange={mudarProcedimento}
                  disabled={!form.isFormActive || !form.especialidadeId}
                >
                  <option value="">-- Nenhum / Selecione --</option>
                  {procedimentosDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.ativo === false ? " (inativo)" : ""}
                    </option>
                  ))}
                  {podeCriarProcedimento && (
                    <option value="__novo__">+ Novo procedimento...</option>
                  )}
                </select>
              </div>

              {usandoNovoProc && (
                <div className="cadCampo cadCol6">
                  <label>Nome do Novo Procedimento *</label>
                  <input
                    type="text"
                    value={form.procedimentoNome}
                    placeholder="Ex.: Artroplastia"
                    onChange={(e) => setForm({ ...form, procedimentoNome: e.target.value })}
                    disabled={!form.isFormActive}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <div className="cadFormAcoes">
            {form.isEditing && !form.isFormActive && <BotaoEditar onClick={habilitarEdicao} />}
            {form.isFormActive && (
              <>
                <button type="button" className="cadBtnGhost" onClick={resetForm}>
                  Cancelar
                </button>
                <button type="submit" className="cadBtnPrimario">
                  {form.isEditing ? "Atualizar" : "Salvar"}
                </button>
              </>
            )}
          </div>
        </form>

        {/* TABELA ÚNICA */}
        <div className="cadTabelaTopo">
          <div className="cadTabelaTopoLinha">
            <h4 className="cadTabelaTitulo">Cadastros</h4>
            <div className="cadFiltros">
              <FiltroSituacao
                id="filtro-situacao-catalogo-processos"
                valor={situacao}
                onChange={setSituacao}
              />
              <div className="cadFiltroSituacao">
                <label>Filtrar por Especialidade:</label>
                <select
                  value={filterEspecialidadeId}
                  onChange={(e) => setFilterEspecialidadeId(e.target.value)}
                  className="cadFiltroSelect"
                >
                  <option value="">-- Todas as Especialidades --</option>
                  {(data.especialidades || []).map((esp) => (
                    <option key={esp.id} value={esp.id}>
                      {esp.nome}
                      {esp.ativo === false ? " (inativa)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="cadTabelaWrapper">
            <table className="cadTabela">
              <thead>
                <tr>
                  <th>Especialidade</th>
                  <th>Procedimento</th>
                  <th>Situação</th>
                  <th className="cadDireita">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhasTabela.map((l) => {
                  const temProcedimento = Boolean(l.procedimentoId);
                  // A linha da especialidade (categoria) mostra a própria
                  // situação; a do vínculo combina procedimento com especialidade.
                  const situacaoLinha = temProcedimento
                    ? situacaoRegistro({
                        ativo: l.procedimentoAtivo,
                        paiAtivo: l.especialidadeAtivo,
                      })
                    : situacaoRegistro({ ativo: l.especialidadeAtivo, paiAtivo: true });
                  return (
                    <tr
                      key={l.id}
                      className={
                        situacaoLinha.motivo === "categoria"
                          ? "cadLinhaIndisponivel"
                          : situacaoLinha.operacional
                            ? ""
                            : "cadLinhaInativa"
                      }
                    >
                      <td>
                        <strong>{l.especialidadeNome}</strong>
                        {!temProcedimento && (
                          <span className="cadMarcaCategoria">categoria</span>
                        )}
                      </td>
                      <td>{l.procedimentoNome || "—"}</td>
                      <td>
                        <StatusRegistro
                          ativo={situacaoLinha.individualAtivo}
                          paiInativo={temProcedimento && !situacaoLinha.paiAtivo}
                          nomePai="Especialidade"
                        />
                      </td>
                      <td>
                        <div className="cadAcoesLinha">
                          {temProcedimento ? (
                            <AcoesSituacao
                              ativo={l.procedimentoAtivo !== false}
                              podeInativar={podeInativarProcedimento}
                              ocupado={alternando === `p-${l.procedimentoId}`}
                              onAlternar={() => alternarProcedimento(l)}
                            />
                          ) : (
                            <AcoesSituacao
                              ativo={l.especialidadeAtivo !== false}
                              podeInativar={podeInativarEspecialidade}
                              ocupado={alternando === `e-${l.especialidadeId}`}
                              onAlternar={() => alternarEspecialidade(l)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {linhasTabela.length === 0 && (
                  <tr>
                    <td colSpan={4} className="cadTabelaVazia">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
