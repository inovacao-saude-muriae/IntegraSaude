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
import IdentificacaoPaciente from "@/components/IdentificacaoPaciente";
import { pessoaAptaParaVinculo } from "@/components/cadastros/SituacaoPessoa";
import "@/components/cadastros/padraoCadastro.css";
import { formatarCpfExibicao } from "@/lib/cpf";
import {
  obterCatalogoParaFiltros,
  obterCatalogoParaFormulario,
} from "./especialidades/actions";
import {
  criarProcesso,
  editarProcesso,
  excluirProcesso,
  listarProcessos,
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
  // Situação do PROCESSO (operacional) — independe da Situação Cadastral.
  status: "ATIVO",
  justificativaInativacao: "",
  // Texto do campo de busca do container único de identificação.
  buscaPaciente: "",
};

// Somente ATIVO/INATIVO; valores legados são exibidos sem conversão.
const normalizarStatusProcesso = (v) =>
  String(v || "").trim().toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";
const ROTULO_STATUS_PROCESSO = { ATIVO: "Ativo", INATIVO: "Inativo" };

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
  // Catálogo PRÓPRIO da área Processos: cada especialidade já vem com os
  // procedimentos vinculados a ela (nada de Junta Reguladora).
  const [especialidades, setEspecialidades] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  // Filtros da CONSULTA: a tabela só aparece depois de uma consulta.
  const FILTROS_VAZIOS = {
    busca: "",
    dataInicio: "",
    dataFim: "",
    especialidadeId: "",
    procedimentoId: "",
    // Todos | Ativos | Inativos — situação do PROCESSO.
    status: "todos",
  };
  // Catálogo dos FILTROS (inclui itens inativos = registros históricos).
  const [catalogoFiltros, setCatalogoFiltros] = useState({
    especialidades: [],
    procedimentos: [],
    vinculosProcedimentos: {},
  });
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [consultou, setConsultou] = useState(false);
  const [total, setTotal] = useState(0);
  const [consultando, setConsultando] = useState(false);

  // Formulário (novo e edição usam o MESMO estado/componente)
  const [form, setForm] = useState(FORM_VAZIO);
  const [processos, setProcessos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  // CPF do titular no momento em que a edição começou (detecta a troca).
  const [cpfOriginal, setCpfOriginal] = useState("");
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Modais
  const [detalhe, setDetalhe] = useState(null);
  const [exclusao, setExclusao] = useState(null); // { processo, dependencias, podeExcluir }

  // ── Carga ────────────────────────────────────────────────────────────────
  // Consulta no backend: os filtros combinam entre si (AND).
  const consultar = useCallback(async (filtrosConsulta = {}, { todos = false } = {}) => {
    setConsultando(true);
    const res = await listarProcessos({ ...filtrosConsulta, todos });
    setConsultando(false);
    if (!res.success) {
      setErro(res.error);
      return res;
    }
    setProcessos(res.data);
    setTotal(res.total ?? res.data.length);
    setConsultou(true);
    return res;
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Nada é listado na abertura: só o catálogo (especialidades/procedimentos).
      const [cats, filtrosCat] = await Promise.all([
        obterCatalogoParaFormulario(),
        obterCatalogoParaFiltros(),
      ]);
      if (!vivo) return;
      if (cats.success) setEspecialidades(cats.especialidades || []);
      else setErro(cats.error);
      if (filtrosCat.success) {
        setCatalogoFiltros({
          especialidades: filtrosCat.especialidades || [],
          procedimentos: filtrosCat.procedimentos || [],
          vinculosProcedimentos: filtrosCat.vinculosProcedimentos || {},
        });
      }
      setCarregando(false);
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
    setProcessos([]);
    setTotal(0);
    setConsultou(false);
    setErro("");
  }


  const especialidadeAtual = useMemo(
    () => especialidades.find((x) => String(x.id) === String(form.especialidadeId)) || null,
    [especialidades, form.especialidadeId],
  );

  // Só os procedimentos VINCULADOS à especialidade escolhida — é o catálogo
  // próprio da área Processos, não o da Junta Reguladora.
  const procedimentosDaEspecialidade = especialidadeAtual?.procedimentos || [];

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
      numeroPasta: p.numeroPastaPaciente || p.numeroPasta,
      especialidadeId: p.especialidadeId ? String(p.especialidadeId) : "",
      procedimentoId: p.procedimentoId ? String(p.procedimentoId) : "",
      status: normalizarStatusProcesso(p.status),
      // Justificativa anteriormente registrada (histórico preservado).
      justificativaInativacao: p.justificativaInativacao || "",
      buscaPaciente: p.pacienteNome || "",
    });
    setPacienteSelecionado(
      p.pacienteCpf
        ? {
            cpf: p.pacienteCpf,
            nomeCompleto: p.pacienteNome,
            nome: p.pacienteNome,
            numeroPasta: p.numeroPastaPaciente || p.numeroPasta || "",
            situacao: p.pacienteSituacao || "",
          }
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
      setForm((f) => ({
        ...f,
        pacienteCpf: "",
        pacienteNome: "",
        numeroPasta: "",
        buscaPaciente: "",
      }));
      return;
    }
    // Pasta do paciente: se já existir, vem preenchida e bloqueada (o número é
    // do paciente, não do processo). O cadastro único devolve `numeroPasta`.
    const pastaDoPaciente = String(pessoa.numeroPasta || "").trim();
    setPacienteSelecionado({ ...pessoa, numeroPasta: pastaDoPaciente });
    setForm((f) => ({
      ...f,
      pacienteCpf: pessoa.cpf,
      buscaPaciente: pessoa.nomeCompleto || pessoa.nome || "",
      pacienteNome: pessoa.nomeCompleto || pessoa.nome || "",
      numeroPasta: pastaDoPaciente || (f.pacienteCpf === pessoa.cpf ? f.numeroPasta : ""),
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
    // Justificativa obrigatória quando a situação do processo for Inativo.
    if (
      form.status === "INATIVO" &&
      form.justificativaInativacao.trim().length < 15
    ) {
      return setErro("Informe a Justificativa da Inativação (mínimo de 15 caracteres).");
    }

    const trocandoPaciente =
      Boolean(editandoId) && form.pacienteCpf !== cpfOriginal;

    const payload = {
      pacienteCpf: form.pacienteCpf,
      numeroProcesso: form.numeroProcesso.trim(),
      numeroPasta: form.numeroPasta.trim(),
      especialidadeId: form.especialidadeId || null,
      procedimentoId: form.procedimentoId || null,
      status: form.status,
      justificativaInativacao:
        form.status === "INATIVO" ? form.justificativaInativacao.trim() : "",
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
      if (consultou) await consultar(filtros);
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
    if (consultou) await consultar(filtros);
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
    if (consultou) await consultar(filtros);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const listaFiltrada = processos;

  return (
    <div className={styles.container}>
      {/* Container principal único: abas + avisos + consulta/formulário ficam
          todos sobre o mesmo painel branco (padrão Lista de Espera da Regulação).
          Não há cabeçalho externo: o título é o da aba ativa. */}
      <section className={styles.painel}>
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
                  {procedimentosDoFiltro.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nome}
                      {p.ativo === false ? " (inativo)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.campoFiltro}>
                <label>Status do Processo</label>
                <select
                  value={filtros.status}
                  onChange={(e) => alterarFiltro("status", e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
              </div>
              <div className={styles.campoFiltro}>
                <label>Período do cadastro</label>
                <div className={styles.periodo}>
                  <input
                    type="date"
                    value={filtros.dataInicio}
                    onChange={(e) => alterarFiltro("dataInicio", e.target.value)}
                    aria-label="Data inicial do cadastro"
                  />
                  <span>até</span>
                  <input
                    type="date"
                    value={filtros.dataFim}
                    onChange={(e) => alterarFiltro("dataFim", e.target.value)}
                    aria-label="Data final do cadastro"
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
              <span>
                <strong>{total}</strong> {total === 1 ? "registro encontrado" : "registros encontrados"}
              </span>
            ) : (
              <span>Preencha os filtros e clique em Filtrar, ou consulte todos os registros.</span>
            )}
          </div>

          {!consultou ? null : carregando ? (
            <p className={styles.vazio}>Carregando processos…</p>
          ) : listaFiltrada.length === 0 ? (
            <p className={styles.vazio}>Nenhum processo encontrado para os filtros informados.</p>
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
                    <th>Status do Processo</th>
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
                      <td>
                        <span
                          className={
                            normalizarStatusProcesso(p.status) === "INATIVO"
                              ? styles.statusInativo
                              : styles.statusAtivo
                          }
                          title={p.justificativaInativacao || undefined}
                        >
                          {ROTULO_STATUS_PROCESSO[normalizarStatusProcesso(p.status)]}
                        </span>
                      </td>
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
        </div>
      )}

      {/* ── ABA 2: NOVO / EDITAR ─────────────────────────────────────────── */}
      {aba === "novo" && (
        <div className={styles.bloco}>
          <h2 className={styles.secaoTitulo}>
            {editandoId ? `Editar processo #${editandoId}` : "Novo processo judicial"}
          </h2>

          <form onSubmit={salvar} className={styles.formulario}>
            {/* BLOCO 1 — IDENTIFICAÇÃO DO PACIENTE: mesmo componente, campos e
                distribuição da Farmácia Judicial (dados da tabela central
                `pessoa`, somente leitura; só a busca é editável). */}
            <div className={styles.blocoIdentificacao}>
              <IdentificacaoPaciente
                titulo="1. Identificação do Paciente"
                buscaLabel="Nome do Paciente"
                buscaPlaceholder="Digite o nome ou CPF para buscar..."
                buscaTexto={form.buscaPaciente}
                onBuscaTextoChange={(v) => setForm((f) => ({ ...f, buscaPaciente: v }))}
                onSelect={selecionarPaciente}
                incluirIndisponiveis
                cpfSelecionado={form.pacienteCpf}
                paciente={
                  pacienteSelecionado
                    ? {
                        nomeMae: pacienteSelecionado.nomeMae,
                        dataNascimento: pacienteSelecionado.dataNascimento,
                        sexo: pacienteSelecionado.sexo,
                        telefone: pacienteSelecionado.telefone,
                        cpf: pacienteSelecionado.cpf,
                        cns: pacienteSelecionado.cns,
                        situacao: pacienteSelecionado.situacao,
                        ubsReferencia: pacienteSelecionado.ubsReferencia,
                        logradouro: pacienteSelecionado.logradouro,
                        numero: pacienteSelecionado.numero,
                        complemento: pacienteSelecionado.complemento,
                        bairro: pacienteSelecionado.bairro,
                        cidade: pacienteSelecionado.cidade,
                        uf: pacienteSelecionado.uf,
                        cep: pacienteSelecionado.cep,
                      }
                    : null
                }
              />
            </div>

            {/* BLOCO 2 — INFORMAÇÕES DO PROCESSO: processo, pasta e situação;
                especialidade e procedimento; justificativa quando Inativo. */}
            <div className={styles.cardSection}>
              <h3 className={styles.sectionHeaderTitle}>INFORMAÇÕES DO PROCESSO</h3>
              <div className={styles.gridProcesso}>
                <div className={styles.fieldGroup}>
                  <label>Número do Processo *</label>
                  <input
                    type="text"
                    value={form.numeroProcesso}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, numeroProcesso: e.target.value }))
                    }
                    maxLength={100}
                    placeholder="Ex: 5001234-56.2026.8.13.0439"
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label>Número da Pasta *</label>
                  <input
                    type="text"
                    value={form.numeroPasta}
                    onChange={(e) => setForm((f) => ({ ...f, numeroPasta: e.target.value }))}
                    maxLength={50}
                    readOnly={Boolean(pacienteSelecionado?.numeroPasta)}
                    placeholder="Número da pasta do paciente"
                  />
                  <span className={styles.dica}>
                    {pacienteSelecionado?.numeroPasta
                      ? "O paciente já possui pasta: o número é do paciente e vale para todos os processos dele."
                      : "A pasta é do paciente: será reaproveitada nos próximos processos dele."}
                  </span>
                </div>

                <div className={styles.fieldGroup}>
                  <label>Status do Processo *</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value,
                        // Ao voltar para Ativo o campo some e o texto é limpo;
                        // o histórico da inativação anterior fica no registro.
                        justificativaInativacao:
                          e.target.value === "ATIVO" ? "" : f.justificativaInativacao,
                      }))
                    }
                    required
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label>Especialidade *</label>
                  <select
                    value={form.especialidadeId}
                    onChange={(e) => trocarEspecialidade(e.target.value)}
                    required
                  >
                    <option value="">Selecione a especialidade</option>
                    {especialidades.map((esp) => (
                      <option key={esp.id} value={String(esp.id)}>
                        {esp.nome}
                      </option>
                    ))}
                  </select>
                  <span className={styles.dica}>
                    Somente especialidades ativas da Câmara Técnica.
                  </span>
                </div>

                <div className={styles.fieldGroup}>
                  <label>Procedimento</label>
                  <select
                    value={form.procedimentoId}
                    onChange={(e) => setForm((f) => ({ ...f, procedimentoId: e.target.value }))}
                    disabled={!form.especialidadeId}
                  >
                    <option value="">
                      {form.especialidadeId
                        ? "Selecione o procedimento"
                        : "Selecione primeiro a especialidade"}
                    </option>
                    {procedimentosDaEspecialidade.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <span className={styles.dica}>
                    {form.especialidadeId
                      ? "Somente procedimentos ativos vinculados à especialidade."
                      : "Escolha a especialidade para liberar os procedimentos."}
                  </span>
                </div>

                {/* Terceira linha: aparece SOMENTE com a situação Inativo. */}
                {form.status === "INATIVO" && (
                  <div className={`${styles.fieldGroup} ${styles.colJustificativa}`}>
                    <label>Justificativa da Inativação *</label>
                    <textarea
                      rows={2}
                      maxLength={500}
                      placeholder="Descreva o motivo da inativação do processo..."
                      value={form.justificativaInativacao}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, justificativaInativacao: e.target.value }))
                      }
                      required
                    />
                    {form.justificativaInativacao.trim().length < 15 && (
                      <span className={styles.dica}>Mínimo de 15 caracteres.</span>
                    )}
                  </div>
                )}
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
              <button
                type="submit"
                className={styles.botaoPrimario}
                disabled={salvando || !pessoaAptaParaVinculo(pacienteSelecionado?.situacao)}
              >
                {salvando
                  ? "Salvando…"
                  : editandoId
                    ? "Salvar alterações"
                    : "Cadastrar processo"}
              </button>
            </div>
          </form>
        </div>
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
            <dd>{detalhe.numeroPastaPaciente || detalhe.numeroPasta || "—"}</dd>
            <dt>Especialidade</dt>
            <dd>{detalhe.especialidadeNome || "—"}</dd>
            <dt>Procedimento</dt>
            <dd>{detalhe.procedimentoNome || "—"}</dd>
            <dt>Data do cadastro</dt>
            <dd>{dataCurta(detalhe.dataCadastro)}</dd>
            <dt>Última alteração</dt>
            <dd>{dataCurta(detalhe.atualizadoEm)}</dd>
            <dt>Status do Processo</dt>
            <dd>{ROTULO_STATUS_PROCESSO[normalizarStatusProcesso(detalhe.status)]}</dd>
            <dt>Justificativa da Inativação</dt>
            <dd>{detalhe.justificativaInativacao || "—"}</dd>
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

      </section>
    </div>
  );
}
