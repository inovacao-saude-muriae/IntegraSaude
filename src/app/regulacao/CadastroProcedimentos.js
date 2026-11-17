"use client";

import { useState } from "react";
import "@/components/cadastros/padraoCadastro.css";
import ModalConfirmacaoExclusao from "@/app/regulacao/Modals/ModalConfirmacaoExclusao";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import BotaoEditar from "@/components/BotaoEditar";
import FiltroSituacao, { passaSituacao } from "@/components/cadastros/FiltroSituacao";
import StatusRegistro from "@/components/cadastros/StatusRegistro";
import { situacaoRegistro, passaSituacaoOperacional } from "@/components/cadastros/situacaoCadastro";
import AcoesSituacao from "@/components/cadastros/AcoesSituacao";
import {
  createRegistro,
  updateRegistro,
  deleteRegistro,
  alterarSituacaoProcedimento,
  alterarSituacaoTipoExame,
} from "./procedimentosActions";

const FORM_VAZIO = {
  linha: null, // linha em edição (com procedimentoId / tipoExameId)
  tipoExameId: "", // id do tipo selecionado ("__novo__" para criar)
  tipoExameNome: "", // usado quando tipoExameId === "__novo__"
  procedimentoSel: "", // valor do dropdown de procedimento ("", "__novo__" ou id)
  procedimentoNome: "", // nome do procedimento (novo ou existente em edição)
  valor: "",
  isEditing: false,
  isFormActive: false,
};

export default function CadastroProcedimentos({
  data = { tiposExame: [], linhas: [] },
  reloadData = () => {},
  podeInativar = false,
}) {
  const confirm = useConfirm();
  const notify = useNotify();

  const [deleteConfig, setDeleteConfig] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [filterTipoExameId, setFilterTipoExameId] = useState("");
  const [situacao, setSituacao] = useState("ativos");
  const [alternando, setAlternando] = useState(null);

  const resetForm = () => setForm(FORM_VAZIO);

  const carregarParaEdicao = (linha) => {
    setForm({
      linha,
      tipoExameId: String(linha.tipoExameId),
      tipoExameNome: "",
      procedimentoSel: linha.procedimentoId ? String(linha.procedimentoId) : "",
      procedimentoNome: linha.nome || "",
      valor: linha.valor != null ? String(linha.valor) : "",
      isEditing: true,
      isFormActive: false,
    });
  };

  const habilitarEdicao = () => setForm((prev) => ({ ...prev, isFormActive: true }));

  const usandoNovoTipo = form.tipoExameId === "__novo__";
  const usandoNovoProc = form.procedimentoSel === "__novo__";

  // Procedimentos disponíveis para o dropdown: os do tipo de exame selecionado
  // (quando um tipo existente está escolhido); com tipo novo, não há procedimentos prévios.
  // Só procedimentos disponíveis para uso: ativo E de um tipo de exame ativo.
  // O procedimento já selecionado continua na lista mesmo se estiver inativo,
  // para que a edição de um registro antigo não perca a referência.
  const procedimentosDoTipo = (data.linhas || []).filter(
    (l) =>
      l.procedimentoId &&
      String(l.tipoExameId) === String(form.tipoExameId) &&
      (l.disponivel !== false || String(l.procedimentoId) === String(form.procedimentoSel)),
  );

  // Ao escolher um procedimento no dropdown
  const onSelecionarProcedimento = (value) => {
    if (value === "__novo__") {
      setForm((prev) => ({
        ...prev,
        procedimentoSel: "__novo__",
        procedimentoNome: "",
        valor: "",
        linha: prev.linha?.procedimentoId ? { ...prev.linha, procedimentoId: null } : prev.linha,
      }));
      return;
    }
    if (value === "") {
      setForm((prev) => ({
        ...prev,
        procedimentoSel: "",
        procedimentoNome: "",
        valor: "",
        linha: prev.linha?.procedimentoId ? { ...prev.linha, procedimentoId: null } : prev.linha,
      }));
      return;
    }
    // Procedimento existente selecionado -> carrega para edição
    const proc = procedimentosDoTipo.find((p) => String(p.procedimentoId) === String(value));
    setForm((prev) => ({
      ...prev,
      procedimentoSel: value,
      procedimentoNome: proc?.nome || "",
      valor: proc?.valor != null ? String(proc.valor) : "",
      linha: proc || prev.linha,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!form.tipoExameId) {
      await notify({ tipo: "erro", title: "Campo obrigatório", message: "Selecione ou informe o tipo de exame." });
      return;
    }
    if (usandoNovoTipo && !form.tipoExameNome.trim()) {
      await notify({ tipo: "erro", title: "Campo obrigatório", message: "Informe o nome do novo tipo de exame." });
      return;
    }
    if (usandoNovoProc && !form.procedimentoNome.trim()) {
      await notify({ tipo: "erro", title: "Campo obrigatório", message: "Informe o nome do novo procedimento." });
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
      tipoExameId: usandoNovoTipo ? "" : form.tipoExameId,
      tipoExameNome: usandoNovoTipo ? form.tipoExameNome : "",
      procedimentoNome: form.procedimentoNome,
      valor: form.valor,
    };

    // Se um procedimento existente foi selecionado, a operação é uma atualização dele.
    const linhaAlvo = form.linha;
    const deveAtualizar = form.isEditing || (linhaAlvo && linhaAlvo.procedimentoId);

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
  // O cadastro da Regulação tem UM nível: o próprio procedimento.
  // Categoria superior: inativa/reativa o Tipo de Exame inteiro.
  async function alternarTipoExame(linha) {
    const ativo = linha.tipoExameAtivo !== false;
    const acao = ativo ? "Inativar" : "Reativar";
    const subordinados = (data.linhas || []).filter(
      (l) => l.procedimentoId && String(l.tipoExameId) === String(linha.tipoExameId),
    );
    const inativosIndividualmente = subordinados.filter((l) => l.ativo === false).length;

    const ok = await confirm({
      title: `${acao} tipo de exame`,
      message: ativo
        ? `Inativar o tipo de exame "${linha.tipoExameNome}"? Os ${subordinados.length} ` +
          `procedimento(s) dele ficam indisponíveis para novos pedidos de exame, mas os ` +
          `pedidos que já os utilizam continuam intactos. Nenhum procedimento será ` +
          `inativado individualmente.`
        : `Reativar o tipo de exame "${linha.tipoExameNome}"? Os procedimentos dele voltam ` +
          `a ficar disponíveis, exceto os que estavam inativos individualmente` +
          (inativosIndividualmente ? ` (${inativosIndividualmente})` : "") +
          `, que continuam inativos.`,
      confirmText: acao,
    });
    if (!ok) return;

    setAlternando(linha.id);
    const res = await alterarSituacaoTipoExame(linha.tipoExameId, { ativo: !ativo });
    setAlternando(null);
    if (!res.success) return notify({ tipo: "erro", title: "Erro", message: res.error });
    await notify({
      tipo: "sucesso",
      title: `Tipo de exame ${ativo ? "inativado" : "reativado"}`,
      message: `"${linha.tipoExameNome}" ${ativo ? "inativado" : "reativado"} com sucesso!`,
    });
    reloadData();
  }

  async function alternarProcedimento(linha) {
    const ativo = linha.ativo !== false;
    const acao = ativo ? "Inativar" : "Reativar";
    const ok = await confirm({
      title: `${acao} procedimento`,
      message: ativo
        ? `Inativar "${linha.nome}"? Ele deixa de ser oferecido em novos pedidos de ` +
          `exame, mas continua visível nos pedidos que já o utilizam.`
        : `Reativar "${linha.nome}"? Ele volta a ser oferecido nos novos pedidos.`,
      confirmText: acao,
    });
    if (!ok) return;

    setAlternando(linha.id);
    const res = await alterarSituacaoProcedimento(linha.procedimentoId, { ativo: !ativo });
    setAlternando(null);
    if (!res.success) return notify({ tipo: "erro", title: "Erro", message: res.error });
    await notify({
      tipo: "sucesso",
      title: `Procedimento ${ativo ? "inativado" : "reativado"}`,
      message: `"${linha.nome}" ${ativo ? "inativado" : "reativado"} com sucesso!`,
    });
    reloadData();
  }

  const linhasTabela = (data.linhas || []).filter((l) => {
    if (filterTipoExameId && String(l.tipoExameId) !== String(filterTipoExameId)) {
      return false;
    }
    // O filtro olha a disponibilidade operacional: um procedimento ativo de um
    // tipo inativo aparece em "Inativos" (indisponível por categoria).
    return passaSituacaoOperacional(situacao, l.disponivel !== false);
  });

  const temProcedimentoSelecionado = usandoNovoProc || Boolean(form.procedimentoNome.trim());

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

      <div className="cadCadastro">
      <div className="cadCard">
        <div className="cadCardTitleRow">
          <h3 className="cadCardTitle">Exames e Procedimentos</h3>
          <span className="cadCardSubtitle">Ex.: Imagem (exame) — Ultrassonografia (procedimento)</span>
        </div>

        {/* AÇÃO PRINCIPAL — cadastro de um novo registro */}
        <div className="cadBarraAcoes">
          <button
            type="button"
            className="cadBtnAdicionar"
            onClick={() => setForm({ ...FORM_VAZIO, isFormActive: true })}
          >
            Adicionar novo
          </button>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={submit} className="cadForm">
          <div className="cadFormSecao">
            <div className="cadFormSecaoTopo">
              <h4>Informações do Registro</h4>
            </div>
            <div className="cadGrade">
              <div className="cadCampo cadCol6">
                <label>Tipo de Exame *</label>
                <select
                  value={form.tipoExameId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipoExameId: e.target.value,
                      tipoExameNome: "",
                      // troca de tipo limpa a seleção de procedimento
                      procedimentoSel: "",
                      procedimentoNome: "",
                      valor: "",
                    })
                  }
                  disabled={!form.isFormActive}
                  required
                >
                  <option value="">-- Selecione o Tipo de Exame --</option>
                  {(data.tiposExame || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                      {t.ativo === false ? " (inativo)" : ""}
                    </option>
                  ))}
                  <option value="__novo__">+ Novo tipo de exame...</option>
                </select>
              </div>

              {!usandoNovoTipo &&
                form.tipoExameId &&
                (data.tiposExame || []).find((t) => String(t.id) === String(form.tipoExameId))
                  ?.ativo === false && (
                  <p className="cadCampoDica cadOcupaTudo">
                    Este tipo de exame está inativo: os procedimentos dele ficam
                    indisponíveis até o tipo ser reativado na listagem de cadastros.
                  </p>
                )}

              {usandoNovoTipo && (
                <div className="cadCampo cadCol6">
                  <label>Nome do Novo Tipo de Exame *</label>
                  <input
                    type="text"
                    value={form.tipoExameNome}
                    placeholder="Ex.: Imagem"
                    onChange={(e) => setForm({ ...form, tipoExameNome: e.target.value })}
                    disabled={!form.isFormActive}
                    required
                  />
                </div>
              )}

              <div className="cadCampo cadCol6">
                <label>Procedimento (opcional)</label>
                <select
                  value={form.procedimentoSel}
                  onChange={(e) => onSelecionarProcedimento(e.target.value)}
                  disabled={!form.isFormActive || !form.tipoExameId}
                >
                  <option value="">-- Nenhum / Selecione --</option>
                  {procedimentosDoTipo.map((p) => (
                    <option key={p.procedimentoId} value={p.procedimentoId}>
                      {p.nome}
                      {p.ativo === false ? " (inativo)" : ""}
                    </option>
                  ))}
                  <option value="__novo__">+ Novo procedimento...</option>
                </select>
              </div>

              {usandoNovoProc && (
                <div className="cadCampo cadCol6">
                  <label>Nome do Novo Procedimento *</label>
                  <input
                    type="text"
                    value={form.procedimentoNome}
                    placeholder="Ex.: Ultrassonografia"
                    onChange={(e) => setForm({ ...form, procedimentoNome: e.target.value })}
                    disabled={!form.isFormActive}
                    required
                  />
                </div>
              )}

              <div className="cadCampo cadCol4">
                <label>Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor}
                  placeholder="0,00"
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  disabled={!form.isFormActive || !temProcedimentoSelecionado}
                />
              </div>
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
                        tipo: form.linha?.procedimentoId ? "PROCEDIMENTO" : "SERVICO",
                        nome: form.linha?.procedimentoId
                          ? form.linha.nome
                          : form.linha?.tipoExameNome,
                        detalhe: form.linha?.procedimentoId
                          ? `Tipo de Exame: ${form.linha.tipoExameNome}`
                          : undefined,
                        mensagemWarning: form.linha?.procedimentoId
                          ? "Esta ação não pode ser desfeita."
                          : "Excluir o tipo de exame também remove os procedimentos vinculados. Esta ação não pode ser desfeita.",
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
              <FiltroSituacao id="filtro-situacao-procedimentos" valor={situacao} onChange={setSituacao} />
              <div className="cadFiltroSituacao">
                <label>Filtrar por Tipo de Exame:</label>
                <select
                  value={filterTipoExameId}
                  onChange={(e) => setFilterTipoExameId(e.target.value)}
                  className="cadFiltroSelect"
                >
                  <option value="">-- Todos os Tipos de Exames --</option>
                  {(data.tiposExame || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                      {t.ativo === false ? " (inativo)" : ""}
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
                  <th>Tipo de Exame</th>
                  <th>Procedimento</th>
                  <th className="cadDireita">Valor (R$)</th>
                  <th>Situação</th>
                  <th className="cadDireita">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhasTabela.map((l, i) => {
                  // A linha da categoria (TIPO_EXAME) mostra a própria situação;
                  // as demais combinam o procedimento com o tipo de exame.
                  const ehCategoria = l.tipo === "TIPO_EXAME";
                  // Hierarquia visual: cada categoria abre um grupo e os
                  // procedimentos dela aparecem recuados logo abaixo.
                  const categoriaAnterior = linhasTabela[i - 1];
                  const abreGrupo =
                    ehCategoria &&
                    (!categoriaAnterior ||
                      String(categoriaAnterior.tipoExameId) !== String(l.tipoExameId));
                  const situacaoLinha = situacaoRegistro({
                    ativo: ehCategoria ? l.tipoExameAtivo : l.ativo,
                    paiAtivo: ehCategoria ? true : l.tipoExameAtivo,
                  });
                  return (
                    <tr
                      key={l.id}
                      className={[
                        ehCategoria ? "cadLinhaCategoria" : "cadLinhaSubordinada",
                        abreGrupo ? "cadGrupoInicio" : "",
                        situacaoLinha.motivo === "categoria"
                          ? "cadLinhaIndisponivel"
                          : situacaoLinha.operacional
                            ? ""
                            : ehCategoria
                              ? ""
                              : "cadLinhaInativa",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <td>
                        {ehCategoria ? (
                          <>
                            <strong className="cadCategoriaNome">{l.tipoExameNome}</strong>
                            <span className="cadMarcaCategoria">categoria</span>
                          </>
                        ) : (
                          <span className="cadSubordinadoNome">{l.tipoExameNome}</span>
                        )}
                      </td>
                      <td>
                        {ehCategoria ? (
                          <span className="cadVazio">—</span>
                        ) : (
                          <>
                            <span className="cadConector" aria-hidden="true">└</span>
                            {l.nome}
                          </>
                        )}
                      </td>
                      <td className="cadDireita">
                        {l.valor != null ? `R$ ${Number(l.valor).toFixed(2)}` : "—"}
                      </td>
                      <td>
                        <StatusRegistro
                          ativo={situacaoLinha.individualAtivo}
                          paiInativo={!ehCategoria && !situacaoLinha.paiAtivo}
                          nomePai="Tipo de exame"
                        />
                      </td>
                      <td>
                        <div className="cadAcoesLinha">
                          {ehCategoria ? (
                            <AcoesSituacao
                              ativo={l.tipoExameAtivo !== false}
                              podeInativar={podeInativar}
                              ocupado={alternando === l.id}
                              onAlternar={() => alternarTipoExame(l)}
                              rotuloInativar="Inativar tipo"
                              rotuloReativar="Reativar tipo"
                            />
                          ) : (
                            <AcoesSituacao
                              ativo={l.ativo !== false}
                              podeInativar={podeInativar}
                              ocupado={alternando === l.id}
                              onAlternar={() => alternarProcedimento(l)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {linhasTabela.length === 0 && (
                  <tr>
                    <td colSpan={5} className="cadTabelaVazia">
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
    </>
  );
}
