"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSOS JUDICIAIS — tela de consulta, cadastro, edição e exclusão
// ─────────────────────────────────────────────────────────────────────────
// Duas abas (mesma identidade visual dos outros módulos):
//   1. Consultar Processos  → lista com ações Visualizar / Editar / Excluir
//   2. Novo Processo        → mesmo formulário da edição (sem duplicar código)
//
// O componente NÃO decide autorização: recebe as flags já calculadas no
// servidor (`podeCriar`, `podeEditar`, `podeExcluir`) e, ainda assim, toda
// operação é revalidada no backend por `requirePermissao`.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import SeletorPaciente from "@/components/SeletorPaciente";
import { formatarCpfExibicao } from "@/lib/cpf";
import {
  criarProcesso,
  editarProcesso,
  excluirProcesso,
  listarProcessos,
  obterCatalogosProcesso,
  obterProcesso,
  verificarDependenciasProcesso,
} from "./actions";
import styles from "./page.module.css";

const FORM_VAZIO = {
  pacienteCpf: "",
  pacienteNome: "",
  numeroProcesso: "",
  numeroPasta: "",
  especialidadeId: "",
  procedimentoId: "",
};

function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

// ── Modal simples (mesmo padrão visual do ConfirmDialog) ───────────────────
function Modal({ titulo, children, onFechar, largura = "640px" }) {
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className={styles.overlay} onClick={onFechar} role="presentation">
      <div
        className={styles.modal}
        style={{ maxWidth: largura }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{titulo}</h3>
          <button
            type="button"
            className={styles.modalFechar}
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ProcessosJudiciaisPage({
  podeCriar = false,
  podeEditar = false,
  podeExcluir = false,
}) {
  const confirm = useConfirm();

  const [aba, setAba] = useState("consultar");
  const [processos, setProcessos] = useState([]);
  const [catalogos, setCatalogos] = useState({ especialidades: [], procedimentos: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState(null);

  // Formulário (novo e edição usam o MESMO estado/componente)
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  // CPF do titular no momento em que a edição começou (detecta a troca).
  const [cpfOriginal, setCpfOriginal] = useState("");
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Modais
  const [detalhe, setDetalhe] = useState(null);
  const [exclusao, setExclusao] = useState(null); // { processo, dependencias, podeExcluir }
  const [modalEspecialidade, setModalEspecialidade] = useState(false);
  const [modalProcedimento, setModalProcedimento] = useState(false);
  const [filtroModal, setFiltroModal] = useState("");

  // ── Carga ────────────────────────────────────────────────────────────────
  const recarregar = useCallback(async (termo = "") => {
    const res = await listarProcessos({ termo });
    if (res.success) setProcessos(res.data);
    else setErro(res.error);
    return res;
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [lista, cats] = await Promise.all([
        listarProcessos({}),
        obterCatalogosProcesso(),
      ]);
      if (!vivo) return;
      if (lista.success) setProcessos(lista.data);
      else setErro(lista.error);
      if (cats.success) {
        setCatalogos({
          especialidades: cats.especialidades || [],
          procedimentos: cats.procedimentos || [],
        });
      }
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const especialidadeNome = useMemo(() => {
    const e = catalogos.especialidades.find(
      (x) => String(x.id) === String(form.especialidadeId),
    );
    return e?.nome || "";
  }, [catalogos.especialidades, form.especialidadeId]);

  const procedimentoNome = useMemo(() => {
    const p = catalogos.procedimentos.find(
      (x) => String(x.id) === String(form.procedimentoId),
    );
    return p?.nome || "";
  }, [catalogos.procedimentos, form.procedimentoId]);

  // Procedimentos compatíveis: os do tipo de exame da especialidade escolhida.
  // Especialidade ainda não classificada → todos (o backend valida quando houver
  // classificação; nada é adivinhado aqui).
  const procedimentosCompativeis = useMemo(() => {
    const esp = catalogos.especialidades.find(
      (x) => String(x.id) === String(form.especialidadeId),
    );
    if (!esp?.tipoExameId) return catalogos.procedimentos;
    return catalogos.procedimentos.filter((p) => p.tipoExameId === esp.tipoExameId);
  }, [catalogos, form.especialidadeId]);

  // ── Formulário ───────────────────────────────────────────────────────────
  function limparFormulario() {
    setForm(FORM_VAZIO);
    setEditandoId(null);
    setCpfOriginal("");
    setPacienteSelecionado(null);
    setErro("");
  }

  function abrirNovo() {
    limparFormulario();
    setAba("novo");
  }

  async function abrirEdicao(processo) {
    const res = await obterProcesso(processo.id);
    if (!res.success) {
      setErro(res.error);
      return;
    }
    const p = res.data;
    setForm({
      pacienteCpf: p.pacienteCpf,
      pacienteNome: p.pacienteNome,
      numeroProcesso: p.numeroProcesso,
      numeroPasta: p.numeroPasta,
      especialidadeId: p.especialidadeId ? String(p.especialidadeId) : "",
      procedimentoId: p.procedimentoId ? String(p.procedimentoId) : "",
    });
    setPacienteSelecionado(
      p.pacienteCpf
        ? { cpf: p.pacienteCpf, nomeCompleto: p.pacienteNome, nome: p.pacienteNome }
        : null,
    );
    setEditandoId(p.id);
    setCpfOriginal(p.pacienteCpf);
    setErro("");
    setAba("novo");
  }

  function selecionarPaciente(pessoa) {
    if (!pessoa) {
      setPacienteSelecionado(null);
      setForm((f) => ({ ...f, pacienteCpf: "", pacienteNome: "" }));
      return;
    }
    setPacienteSelecionado(pessoa);
    setForm((f) => ({
      ...f,
      pacienteCpf: pessoa.cpf,
      pacienteNome: pessoa.nomeCompleto || pessoa.nome || "",
    }));
  }

  // Trocar a especialidade LIMPA o procedimento: ele pode não ser compatível.
  function trocarEspecialidade(novaId) {
    setForm((f) => ({
      ...f,
      especialidadeId: novaId,
      procedimentoId: novaId === f.especialidadeId ? f.procedimentoId : "",
    }));
  }

  async function salvar(e) {
    e?.preventDefault?.();
    setErro("");

    if (!form.pacienteCpf) return setErro("Selecione o paciente vinculado.");
    if (!form.numeroProcesso.trim()) return setErro("Informe o número do processo.");
    if (!form.numeroPasta.trim()) return setErro("Informe o número da pasta.");
    if (!form.especialidadeId) return setErro("Selecione a especialidade.");

    const trocandoPaciente =
      Boolean(editandoId) && form.pacienteCpf !== cpfOriginal;

    const payload = {
      pacienteCpf: form.pacienteCpf,
      numeroProcesso: form.numeroProcesso.trim(),
      numeroPasta: form.numeroPasta.trim(),
      especialidadeId: form.especialidadeId || null,
      procedimentoId: form.procedimentoId || null,
    };

    if (editandoId) {
      const ok = await confirm({
        title: "Salvar alterações",
        message: `Confirmar as alterações no processo ${form.numeroProcesso}?`,
        confirmText: "Salvar",
      });
      if (!ok) return;

      // Troca de paciente: confirmação ESPECÍFICA (muda o titular do processo).
      if (trocandoPaciente) {
        const okTroca = await confirm({
          title: "Trocar o paciente vinculado",
          message:
            "Você está mudando o paciente titular deste processo. " +
            "Os documentos e o histórico passam a pertencer ao novo paciente. Confirmar a troca?",
          confirmText: "Trocar paciente",
        });
        if (!okTroca) return;
        payload.confirmarTrocaPaciente = true;
      }

      setSalvando(true);
      const res = await editarProcesso(editandoId, payload);
      setSalvando(false);
      if (!res.success) return setErro(res.error);

      setAviso(
        res.semAlteracoes
          ? "Nenhuma alteração para salvar."
          : `Processo ${payload.numeroProcesso} atualizado com sucesso.`,
      );
      limparFormulario();
      setAba("consultar");
      await recarregar(busca);
      return;
    }

    const ok = await confirm({
      title: "Cadastrar processo",
      message: `Confirmar o cadastro do processo ${payload.numeroProcesso}?`,
      confirmText: "Cadastrar",
    });
    if (!ok) return;

    setSalvando(true);
    const res = await criarProcesso(payload);
    setSalvando(false);
    if (!res.success) return setErro(res.error);

    setAviso(`Processo ${payload.numeroProcesso} cadastrado com sucesso.`);
    limparFormulario();
    setAba("consultar");
    await recarregar(busca);
  }

  // ── Exclusão ─────────────────────────────────────────────────────────────
  async function abrirExclusao(processo) {
    const res = await verificarDependenciasProcesso(processo.id);
    if (!res.success) return setErro(res.error);
    setExclusao(res.data);
  }

  async function confirmarExclusao() {
    if (!exclusao) return;
    const res = await excluirProcesso(exclusao.id, { confirmado: true });
    if (!res.success) {
      setErro(res.error);
      setExclusao(null);
      return;
    }
    setAviso(`Processo ${exclusao.numeroProcesso} excluído.`);
    setExclusao(null);
    await recarregar(busca);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const listaFiltrada = processos;

  return (
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Processos Judiciais</h1>
          <p className={styles.subtitulo}>
            Câmara Técnica › Processos — consulta, cadastro, edição e exclusão.
          </p>
        </div>
        <div className={styles.abas}>
          <button
            type="button"
            className={aba === "consultar" ? styles.abaAtiva : styles.aba}
            onClick={() => setAba("consultar")}
          >
            Consultar Processos
          </button>
          <button
            type="button"
            className={aba === "novo" ? styles.abaAtiva : styles.aba}
            onClick={() => {
              if (!editandoId) limparFormulario();
              setAba("novo");
            }}
          >
            {editandoId ? "Editar Processo" : "Novo Processo"}
          </button>
        </div>
      </div>

      {aviso && (
        <div className={styles.avisoSucesso} role="status">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar">
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

      {/* ── ABA 1: CONSULTAR ─────────────────────────────────────────────── */}
      {aba === "consultar" && (
        <section className={styles.card}>
          <div className={styles.barraBusca}>
            <input
              className={styles.campoBusca}
              placeholder="Buscar por paciente, número do processo ou pasta…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") recarregar(e.target.value);
              }}
            />
            <button
              type="button"
              className={styles.botaoSecundario}
              onClick={() => recarregar(busca)}
            >
              Buscar
            </button>
            {podeCriar && (
              <button type="button" className={styles.botaoPrimario} onClick={abrirNovo}>
                + Novo Processo
              </button>
            )}
          </div>

          {carregando ? (
            <p className={styles.vazio}>Carregando processos…</p>
          ) : listaFiltrada.length === 0 ? (
            <p className={styles.vazio}>Nenhum processo cadastrado.</p>
          ) : (
            <div className={styles.tabelaWrap}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Nº do Processo</th>
                    <th>Nº da Pasta</th>
                    <th>Especialidade</th>
                    <th>Procedimento</th>
                    <th>Data do Cadastro</th>
                    <th className={styles.colAcoes}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.nomeCelula}>{p.pacienteNome}</div>
                        <div className={styles.cpfCelula}>
                          {formatarCpfExibicao(p.pacienteCpf)}
                        </div>
                      </td>
                      <td>{p.numeroProcesso}</td>
                      <td>{p.numeroPasta}</td>
                      <td>{p.especialidadeNome || "—"}</td>
                      <td>{p.procedimentoNome || "—"}</td>
                      <td>{dataCurta(p.dataCadastro)}</td>
                      <td>
                        <div className={styles.acoes}>
                          <button
                            type="button"
                            className={styles.botaoIcone}
                            title="Visualizar"
                            onClick={() => setDetalhe(p)}
                          >
                            👁 Visualizar
                          </button>
                          {podeEditar && (
                            <button
                              type="button"
                              className={styles.botaoIconeAzul}
                              title="Editar"
                              onClick={() => abrirEdicao(p)}
                            >
                              ✎ Editar
                            </button>
                          )}
                          {podeExcluir && (
                            <button
                              type="button"
                              className={styles.botaoIconeVermelho}
                              title="Excluir"
                              onClick={() => abrirExclusao(p)}
                            >
                              🗑 Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── ABA 2: NOVO / EDITAR ─────────────────────────────────────────── */}
      {aba === "novo" && (
        <section className={styles.card}>
          <h2 className={styles.secaoTitulo}>
            {editandoId ? `Editar processo #${editandoId}` : "Novo processo judicial"}
          </h2>

          <form onSubmit={salvar} className={styles.formulario}>
            <div className={styles.campoGrande}>
              <label className={styles.label}>Paciente vinculado *</label>
              <SeletorPaciente
                label=""
                value={pacienteSelecionado}
                onSelect={selecionarPaciente}
                placeholder="Digite nome ou CPF para buscar…"
              />
              {form.pacienteCpf && (
                <span className={styles.dica}>
                  CPF {formatarCpfExibicao(form.pacienteCpf)}
                </span>
              )}
            </div>

            <div className={styles.linha}>
              <div className={styles.campo}>
                <label className={styles.label}>Número do processo *</label>
                <input
                  className={styles.input}
                  value={form.numeroProcesso}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, numeroProcesso: e.target.value }))
                  }
                  maxLength={100}
                />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>Número da pasta *</label>
                <input
                  className={styles.input}
                  value={form.numeroPasta}
                  onChange={(e) => setForm((f) => ({ ...f, numeroPasta: e.target.value }))}
                  maxLength={50}
                />
              </div>
            </div>

            <div className={styles.linha}>
              <div className={styles.campo}>
                <label className={styles.label}>Especialidade *</label>
                <div className={styles.campoComBotao}>
                  <input
                    className={styles.input}
                    value={especialidadeNome}
                    readOnly
                    placeholder="Nenhuma especialidade selecionada"
                  />
                  <button
                    type="button"
                    className={styles.botaoSecundario}
                    onClick={() => {
                      setFiltroModal("");
                      setModalEspecialidade(true);
                    }}
                  >
                    Selecionar
                  </button>
                </div>
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>Procedimento</label>
                <div className={styles.campoComBotao}>
                  <input
                    className={styles.input}
                    value={procedimentoNome}
                    readOnly
                    placeholder={
                      form.especialidadeId
                        ? "Nenhum procedimento selecionado"
                        : "Escolha a especialidade primeiro"
                    }
                  />
                  <button
                    type="button"
                    className={styles.botaoSecundario}
                    disabled={!form.especialidadeId}
                    onClick={() => {
                      setFiltroModal("");
                      setModalProcedimento(true);
                    }}
                  >
                    Selecionar
                  </button>
                  {form.procedimentoId && (
                    <button
                      type="button"
                      className={styles.botaoLimpar}
                      title="Limpar procedimento"
                      onClick={() => setForm((f) => ({ ...f, procedimentoId: "" }))}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.acoesForm}>
              <button
                type="button"
                className={styles.botaoSecundario}
                onClick={() => {
                  limparFormulario();
                  setAba("consultar");
                }}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.botaoPrimario} disabled={salvando}>
                {salvando
                  ? "Salvando…"
                  : editandoId
                    ? "Salvar alterações"
                    : "Cadastrar processo"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Modal: detalhe ───────────────────────────────────────────────── */}
      {detalhe && (
        <Modal titulo="Detalhes do processo" onFechar={() => setDetalhe(null)}>
          <dl className={styles.detalhes}>
            <dt>Paciente</dt>
            <dd>
              {detalhe.pacienteNome} ({formatarCpfExibicao(detalhe.pacienteCpf)})
            </dd>
            <dt>Número do processo</dt>
            <dd>{detalhe.numeroProcesso}</dd>
            <dt>Número da pasta</dt>
            <dd>{detalhe.numeroPasta}</dd>
            <dt>Especialidade</dt>
            <dd>{detalhe.especialidadeNome || "—"}</dd>
            <dt>Procedimento</dt>
            <dd>{detalhe.procedimentoNome || "—"}</dd>
            <dt>Data do cadastro</dt>
            <dd>{dataCurta(detalhe.dataCadastro)}</dd>
            <dt>Última alteração</dt>
            <dd>{dataCurta(detalhe.atualizadoEm)}</dd>
            <dt>Situação</dt>
            <dd>{detalhe.status}</dd>
          </dl>
          <div className={styles.acoesForm}>
            <button
              type="button"
              className={styles.botaoSecundario}
              onClick={() => setDetalhe(null)}
            >
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: exclusão ──────────────────────────────────────────────── */}
      {exclusao && (
        <Modal
          titulo="Excluir processo"
          onFechar={() => setExclusao(null)}
          largura="480px"
        >
          {/* Confirmação com os dados do processo e do paciente, para não
              excluir o registro errado. */}
          <dl className={styles.detalhes}>
            <dt>Número do processo</dt>
            <dd>{exclusao.numeroProcesso}</dd>
            <dt>Paciente vinculado</dt>
            <dd>{exclusao.pacienteNome}</dd>
          </dl>

          {exclusao.podeExcluir ? (
            <p className={styles.avisoTexto}>
              Esta operação é <strong>definitiva</strong>: o processo será removido
              e não poderá ser recuperado. A exclusão fica registrada na auditoria.
            </p>
          ) : (
            <p className={styles.avisoTextoErro}>
              Este processo possui {exclusao.dependencias.total} registro(s)
              vinculado(s) ({exclusao.dependencias.documentos} documento(s),{" "}
              {exclusao.dependencias.movimentacoes} movimentação(ões)) e{" "}
              <strong>não pode ser excluído</strong>.
            </p>
          )}

          <div className={styles.acoesForm}>
            <button
              type="button"
              className={styles.botaoSecundario}
              onClick={() => setExclusao(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.botaoPerigo}
              disabled={!exclusao.podeExcluir}
              onClick={confirmarExclusao}
            >
              Confirmar exclusão
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: especialidade ─────────────────────────────────────────── */}
      {modalEspecialidade && (
        <Modal titulo="Selecionar especialidade" onFechar={() => setModalEspecialidade(false)}>
          <input
            className={styles.campoBusca}
            placeholder="Filtrar especialidades…"
            value={filtroModal}
            onChange={(e) => setFiltroModal(e.target.value)}
          />
          <div className={styles.listaModal}>
            {catalogos.especialidades.length === 0 && (
              <p className={styles.vazio}>
                Nenhuma especialidade cadastrada. Cadastre em Gerenciamento › Serviços e
                Especialidades.
              </p>
            )}
            {catalogos.especialidades
              .filter((e) =>
                (e.nome + " " + (e.servico || ""))
                  .toLowerCase()
                  .includes(filtroModal.toLowerCase()),
              )
              .map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={styles.itemModal}
                  onClick={() => {
                    trocarEspecialidade(String(e.id));
                    setModalEspecialidade(false);
                  }}
                >
                  <span>{e.nome}</span>
                  <span className={styles.itemModalSub}>{e.servico}</span>
                </button>
              ))}
          </div>
        </Modal>
      )}

      {/* ── Modal: procedimento ──────────────────────────────────────────── */}
      {modalProcedimento && (
        <Modal titulo="Selecionar procedimento" onFechar={() => setModalProcedimento(false)}>
          <input
            className={styles.campoBusca}
            placeholder="Filtrar procedimentos…"
            value={filtroModal}
            onChange={(e) => setFiltroModal(e.target.value)}
          />
          <div className={styles.listaModal}>
            {procedimentosCompativeis.length === 0 && (
              <p className={styles.vazio}>
                Nenhum procedimento compatível com esta especialidade.
              </p>
            )}
            {procedimentosCompativeis
              .filter((p) => p.nome.toLowerCase().includes(filtroModal.toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.itemModal}
                  onClick={() => {
                    setForm((f) => ({ ...f, procedimentoId: String(p.id) }));
                    setModalProcedimento(false);
                  }}
                >
                  <span>{p.nome}</span>
                </button>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
