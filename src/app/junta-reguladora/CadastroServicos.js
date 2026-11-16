"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import "@/components/cadastros/cadastro.module.css";
import ModalConfirmacaoExclusao from "@/app/regulacao/Modals/ModalConfirmacaoExclusao";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import BotaoEditar from "@/components/BotaoEditar";
import FiltroSituacao, { passaSituacao } from "@/components/cadastros/FiltroSituacao";
import StatusRegistro from "@/components/cadastros/StatusRegistro";
import AcoesSituacao from "@/components/cadastros/AcoesSituacao";
import {
  createRegistro,
  updateRegistro,
  deleteRegistro,
  alterarSituacaoServico,
  alterarSituacaoEspecialidade,
} from "./servicosActions";

const FORM_VAZIO = {
  linha: null, // linha em edição (com especialidadeId / servicoId)
  servicoId: "", // id do serviço selecionado ("__novo__" para criar)
  servicoNome: "", // usado quando servicoId === "__novo__"
  especialidadeSel: "", // valor do dropdown de especialidade ("", "__novo__" ou id)
  especialidadeNome: "", // nome da especialidade (nova ou existente em edição)
  search: "",
  isEditing: false,
  isFormActive: false,
};

export default function CadastroServicos({
  data = { servicos: [], linhas: [] },
  reloadData = () => {},
  podeInativar = false,
}) {
  const confirm = useConfirm();
  const notify = useNotify();

  const [deleteConfig, setDeleteConfig] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [dropAberto, setDropAberto] = useState(false);
  const [filterServicoId, setFilterServicoId] = useState("");
  const [situacao, setSituacao] = useState("ativos");
  const [alternando, setAlternando] = useState(""); // chave do registro em mudança

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

  const resetForm = () => setForm(FORM_VAZIO);

  const carregarParaEdicao = (linha) => {
    setForm({
      linha,
      servicoId: String(linha.servicoId),
      servicoNome: "",
      especialidadeSel: linha.especialidadeId ? String(linha.especialidadeId) : "",
      especialidadeNome: linha.nome || "",
      search: linha.nome || linha.servicoNome,
      isEditing: true,
      isFormActive: false,
    });
    setDropAberto(false);
  };

  const habilitarEdicao = () => setForm((prev) => ({ ...prev, isFormActive: true }));

  const termo = (form.search || "").toLowerCase().trim();
  const linhasFiltradas = (data.linhas || []).filter((l) => {
    if (!termo) return true;
    return (
      (l.nome || "").toLowerCase().includes(termo) ||
      (l.servicoNome || "").toLowerCase().includes(termo)
    );
  });

  const usandoNovoServico = form.servicoId === "__novo__";
  const usandoNovaEsp = form.especialidadeSel === "__novo__";

  // Especialidades do serviço selecionado (para o dropdown).
  const especialidadesDoServico = (data.linhas || []).filter(
    (l) => l.especialidadeId && String(l.servicoId) === String(form.servicoId)
  );

  const onSelecionarEspecialidade = (value) => {
    if (value === "__novo__") {
      setForm((prev) => ({
        ...prev,
        especialidadeSel: "__novo__",
        especialidadeNome: "",
        linha: prev.linha?.especialidadeId ? { ...prev.linha, especialidadeId: null } : prev.linha,
      }));
      return;
    }
    if (value === "") {
      setForm((prev) => ({
        ...prev,
        especialidadeSel: "",
        especialidadeNome: "",
        linha: prev.linha?.especialidadeId ? { ...prev.linha, especialidadeId: null } : prev.linha,
      }));
      return;
    }
    // Especialidade existente selecionada -> carrega para edição
    const esp = especialidadesDoServico.find((e) => String(e.especialidadeId) === String(value));
    setForm((prev) => ({
      ...prev,
      especialidadeSel: value,
      especialidadeNome: esp?.nome || "",
      linha: esp || prev.linha,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!form.servicoId) {
      await notify({ tipo: "erro", title: "Campo obrigatório", message: "Selecione ou informe o serviço." });
      return;
    }
    if (usandoNovoServico && !form.servicoNome.trim()) {
      await notify({ tipo: "erro", title: "Campo obrigatório", message: "Informe o nome do novo serviço." });
      return;
    }
    if (usandoNovaEsp && !form.especialidadeNome.trim()) {
      await notify({ tipo: "erro", title: "Campo obrigatório", message: "Informe o nome da nova especialidade." });
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
      servicoId: usandoNovoServico ? "" : form.servicoId,
      servicoNome: usandoNovoServico ? form.servicoNome : "",
      especialidadeNome: form.especialidadeNome,
    };

    const linhaAlvo = form.linha;
    const deveAtualizar = form.isEditing || (linhaAlvo && linhaAlvo.especialidadeId);

    const res = deveAtualizar
      ? await updateRegistro(linhaAlvo, payload)
      : await createRegistro(payload);

    if (res.success) {
      await notify({
        tipo: "sucesso",
        title: deveAtualizar ? "Registro atualizado" : "Registro cadastrado",
        message: deveAtualizar ? "Registro atualizado com sucesso!" : "Registro cadastrado com sucesso!",
      });
      reloadData();
      resetForm();
    } else {
      await notify({ tipo: "erro", title: "Erro", message: res.error });
    }
  };

  // ── Inativar / Reativar ──────────────────────────────────────────────────
  async function alternarServico(linha) {
    const ativo = linha.servicoAtivo !== false;
    const acao = ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} serviço`,
      message: ativo
        ? `Inativar o serviço "${linha.servicoNome}"? Ele deixa de aparecer em novos ` +
          `cadastros e as especialidades dele também ficam indisponíveis. Os ` +
          `agendamentos e atendimentos já registrados continuam intactos.`
        : `Reativar o serviço "${linha.servicoNome}"?`,
      confirmText: acao,
    });
    if (!ok) return;
    setAlternando(`s-${linha.servicoId}`);
    const res = await alterarSituacaoServico(linha.servicoId, { ativo: !ativo });
    setAlternando("");
    if (!res.success) return notify({ tipo: "erro", title: "Erro", message: res.error });
    await notify({
      tipo: "sucesso",
      title: `Serviço ${ativo ? "inativado" : "reativado"}`,
      message: `"${linha.servicoNome}" ${ativo ? "inativado" : "reativado"} com sucesso!`,
    });
    reloadData();
  }

  async function alternarEspecialidade(linha) {
    const ativo = linha.especialidadeAtivo !== false;
    const acao = ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} especialidade`,
      message: ativo
        ? `Inativar a especialidade "${linha.nome}"? Ela deixa de aparecer em novos ` +
          `cadastros, mas continua visível nos registros que já a utilizam.`
        : `Reativar a especialidade "${linha.nome}"?`,
      confirmText: acao,
    });
    if (!ok) return;
    setAlternando(`e-${linha.especialidadeId}`);
    const res = await alterarSituacaoEspecialidade(linha.especialidadeId, { ativo: !ativo });
    setAlternando("");
    if (!res.success) return notify({ tipo: "erro", title: "Erro", message: res.error });
    await notify({
      tipo: "sucesso",
      title: `Especialidade ${ativo ? "inativada" : "reativada"}`,
      message: `"${linha.nome}" ${ativo ? "inativada" : "reativada"} com sucesso!`,
    });
    reloadData();
  }

  const linhasTabela = (data.linhas || []).filter((l) => {
        if (filterServicoId && String(l.servicoId) !== String(filterServicoId)) return false;
        // Situação combinada: serviço e especialidade precisam passar no filtro.
        // Linha sem especialidade é avaliada pela situação do serviço.
        if (!passaSituacao(situacao, l.servicoAtivo !== false)) return false;
        if (l.especialidadeId && !passaSituacao(situacao, l.especialidadeAtivo !== false)) {
          return false;
        }
        return true;
      });

  const servicosDisponiveis = (data.servicos || []).filter((s) => s.ativo !== false);

  return (
    <>
      <ModalConfirmacaoExclusao
        config={deleteConfig}
        onConfirm={() => {
          if (deleteConfig?.onConfirm) deleteConfig.onConfirm();
          setDeleteConfig(null);
        }}
        onCancel={() => setDeleteConfig(null)}
      />

      <div className="cadCard">
        <div className="cadCardTitleRow">
          <h3 className="cadCardTitle">Serviços e Especialidades</h3>
          <span className="cadCardSubtitle">Ex.: Ambulatório (serviço) — Fonoaudiologia (especialidade)</span>
        </div>

        {/* BUSCA */}
        <div className="cadBuscaBox">
          <div className="cadCampo">
            <label>Buscar no Banco (Serviço ou Especialidade)</label>
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
                            <th>Serviço</th>
                            <th>Especialidade</th>
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
                                <td><strong>{l.servicoNome}</strong></td>
                                <td>{l.nome || "—"}</td>
                                <td>
                                  <StatusRegistro
                                    ativo={
                                      l.especialidadeId
                                        ? l.especialidadeAtivo !== false
                                        : l.servicoAtivo !== false
                                    }
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
                <label>Serviço *</label>
                <select
                  value={form.servicoId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      servicoId: e.target.value,
                      servicoNome: "",
                      // troca de serviço limpa a seleção de especialidade
                      especialidadeSel: "",
                      especialidadeNome: "",
                    })
                  }
                  disabled={!form.isFormActive}
                  required
                >
                  <option value="">-- Selecione o Serviço --</option>
                  {servicosDisponiveis.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                  <option value="__novo__">+ Novo serviço...</option>
                </select>
                {form.isFormActive && servicosDisponiveis.length === 0 && (
                  <p className="cadCampoDica">
                    Nenhum serviço ativo. Use “+ Novo serviço…” para cadastrar.
                  </p>
                )}
              </div>

              {usandoNovoServico && (
                <div className="cadCampo cadCol6">
                  <label>Nome do Novo Serviço *</label>
                  <input
                    type="text"
                    value={form.servicoNome}
                    placeholder="Ex.: Ambulatório"
                    onChange={(e) => setForm({ ...form, servicoNome: e.target.value })}
                    disabled={!form.isFormActive}
                    required
                  />
                </div>
              )}

              <div className="cadCampo cadCol6">
                <label>Especialidade (opcional)</label>
                <select
                  value={form.especialidadeSel}
                  onChange={(e) => onSelecionarEspecialidade(e.target.value)}
                  disabled={!form.isFormActive || !form.servicoId}
                >
                  <option value="">-- Nenhuma / Selecione --</option>
                  {especialidadesDoServico.map((esp) => (
                    <option key={esp.especialidadeId} value={esp.especialidadeId}>
                      {esp.nome}
                      {esp.especialidadeAtivo === false ? " (inativa)" : ""}
                    </option>
                  ))}
                  <option value="__novo__">+ Nova especialidade...</option>
                </select>
              </div>

              {usandoNovaEsp && (
                <div className="cadCampo cadCol6">
                  <label>Nome da Nova Especialidade *</label>
                  <input
                    type="text"
                    value={form.especialidadeNome}
                    placeholder="Ex.: Fonoaudiologia"
                    onChange={(e) => setForm({ ...form, especialidadeNome: e.target.value })}
                    disabled={!form.isFormActive}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <div className="cadFormAcoes">
            {form.isEditing && !form.isFormActive && (
              <BotaoEditar onClick={habilitarEdicao} />
            )}
            {form.isFormActive && (
              <>
                <button type="button" className="cadBtnGhost" onClick={resetForm}>
                  Cancelar
                </button>
                {form.isEditing && (
                  <button
                    type="button"
                    className="cadBtnPerigo"
                    onClick={() =>
                      setDeleteConfig({
                        tipo: form.linha?.especialidadeId ? "ESPECIALIDADE" : "SERVICO",
                        nome: form.linha?.especialidadeId
                          ? form.linha.nome
                          : form.linha?.servicoNome,
                        detalhe: form.linha?.especialidadeId
                          ? `Serviço: ${form.linha.servicoNome}`
                          : undefined,
                        mensagemWarning: form.linha?.especialidadeId
                          ? "Esta ação não pode ser desfeita."
                          : "Excluir o serviço também remove as especialidades vinculadas. Esta ação não pode ser desfeita.",
                        onConfirm: async () => {
                          const res = await deleteRegistro(form.linha);
                          if (res.success) {
                            await notify({ tipo: "sucesso", title: "Registro removido", message: "Registro removido com sucesso!" });
                            reloadData();
                            resetForm();
                          } else await notify({ tipo: "erro", title: "Erro", message: res.error });
                        },
                      })
                    }
                  >
                    Excluir
                  </button>
                )}
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
              <FiltroSituacao id="filtro-situacao-servicos" valor={situacao} onChange={setSituacao} />
              <div className="cadFiltroSituacao">
                <label>Filtrar por Serviço:</label>
                <select
                  value={filterServicoId}
                  onChange={(e) => setFilterServicoId(e.target.value)}
                  className="cadFiltroSelect"
                >
                  <option value="">-- Todos os Serviços --</option>
                  {(data.servicos || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="cadTabelaWrapper">
            <table className="cadTabela">
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th>Especialidade</th>
                  <th>Situação</th>
                  <th className="cadDireita">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhasTabela.map((l) => {
                  const temEspecialidade = Boolean(l.especialidadeId);
                  const ativo = temEspecialidade
                    ? l.especialidadeAtivo !== false
                    : l.servicoAtivo !== false;
                  return (
                    <tr key={l.id} className={ativo ? "" : "cadLinhaInativa"}>
                      <td><strong>{l.servicoNome}</strong></td>
                      <td>{l.nome || "—"}</td>
                      <td><StatusRegistro ativo={ativo} /></td>
                      <td>
                        <div className="cadAcoesLinha">
                          {temEspecialidade ? (
                            <AcoesSituacao
                              ativo={ativo}
                              podeInativar={podeInativar}
                              ocupado={alternando === `e-${l.especialidadeId}`}
                              onAlternar={() => alternarEspecialidade(l)}
                              rotuloInativar="Inativar especialidade"
                              rotuloReativar="Reativar especialidade"
                            />
                          ) : (
                            <AcoesSituacao
                              ativo={ativo}
                              podeInativar={podeInativar}
                              ocupado={alternando === `s-${l.servicoId}`}
                              onAlternar={() => alternarServico(l)}
                              rotuloInativar="Inativar serviço"
                              rotuloReativar="Reativar serviço"
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
    </>
  );
}
