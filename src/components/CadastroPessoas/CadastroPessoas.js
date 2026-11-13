"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./CadastroPessoas.module.css";
import { buscarCep } from "@/lib/viacep";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import BotaoEditar from "@/components/BotaoEditar";
import { documentoPaciente } from "@/app/regulacao/constants";
import { isCpfProvisorio, DATA_NASC_PLACEHOLDER } from "@/lib/cpf";
import { mascararTelefone as maskTelefone } from "@/lib/telefone";
import { validarCNS } from "@/lib/validations/cns";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import {
  listarPessoas,
  listarUbs,
  criarPessoa,
  atualizarPessoa,
  excluirPessoa,
  confirmarUnificacaoPessoas,
} from "@/app/gerenciamento/pessoas/actions";
import {
  inativarPessoa,
  reativarPessoa,
  consultarSituacaoPessoa,
} from "@/app/gerenciamento/pessoas/pessoaInativacao";

// ── Máscaras ────────────────────────────────────────────────────────────
const maskCpf = (v) =>
  (v || "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const maskCep = (v) =>
  (v || "").replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2");

const soDigitos = (v) => (v ? v.replace(/\D/g, "") : "");

const NOMES_MODULOS = {
  JUNTA: "Junta Reguladora",
  FARMACIA_JUDICIAL: "Farmácia Judicial",
  CCZ: "CCZ (tutor)",
};

const FORM_VAZIO = {
  // cpfChave = identidade da pessoa carregada (oficial ou provisório "T...").
  cpfChave: "",
  cpf: "",
  nomeCompleto: "",
  sexo: "Masculino",
  dataNascimento: "",
  nomeMae: "",
  telefone: "",
  cns: "",
  ubsReferenciaId: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "Muriaé",
  uf: "MG",
};

// Preenche o formulário a partir de uma pessoa vinda do banco.
const pessoaParaForm = (p) => ({
  ...FORM_VAZIO,
  ...p,
  cpfChave: p.cpf,
  // CPF provisório não é exibido: o campo fica vazio para informar o oficial.
  cpf: isCpfProvisorio(p.cpf) ? "" : maskCpf(p.cpf),
  dataNascimento: p.dataNascimento === DATA_NASC_PLACEHOLDER ? "" : p.dataNascimento || "",
  telefone: maskTelefone(p.telefone),
  cep: maskCep(p.cep),
  ubsReferenciaId: p.ubsReferenciaId ? String(p.ubsReferenciaId) : "",
});

// Tela de Cadastro de Pessoas (Pacientes) compartilhada entre o Gerenciamento
// (/gerenciamento/pessoas) e a Regulação (aba PACIENTES). Única fonte de UI e
// consome as MESMAS server actions de @/app/gerenciamento/pessoas/actions.
// `podeExcluir`: só quem tem a permissão própria de exclusão do cadastro central
// (pessoas:excluir) vê o botão. O backend revalida e ainda bloqueia quem tem
// vínculos em outros módulos.
export default function CadastroPessoas({
  podeExcluir = false,
  podeInativar = false,
  podeReativar = false,
}) {
  const confirm = useConfirm();
  const notify = useNotify();
  const [ubsList, setUbsList] = useState([]);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState(FORM_VAZIO);
  // Modos: "leitura" (campos travados), "novo" (cadastro), "edicao" (editar).
  const [modo, setModo] = useState("leitura");
  const [salvando, setSalvando] = useState(false);

  // Busca (estilo Novo Pedido: campo select-like + dropdown em tabela).
  const [termo, setTermo] = useState("");
  const [pessoas, setPessoas] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [dropAberto, setDropAberto] = useState(false);
  const dropdownRef = useRef(null);

  const [cepLoading, setCepLoading] = useState(false);
  const [cepErro, setCepErro] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  // Filtro de situação cadastral: "ativas" | "inativas" | "todas".
  const [filtroSituacao, setFiltroSituacao] = useState("ativas");
  // Modal de inativação/reativação: { tipo: "inativar" | "reativar" } | null.
  const [situacaoModal, setSituacaoModal] = useState(null);
  const [justificativa, setJustificativa] = useState("");
  const [situacaoErro, setSituacaoErro] = useState("");
  const [situacaoSalvando, setSituacaoSalvando] = useState(false);
  const [situacaoInfo, setSituacaoInfo] = useState(null);
  const [cnsErro, setCnsErro] = useState("");

  // Conflito de CPF: { cpf, nome, payload } quando o CPF informado já existe.
  const [conflito, setConflito] = useState(null);
  const [unificando, setUnificando] = useState(false);
  const [conflitoErro, setConflitoErro] = useState("");
  const [conflitoModulos, setConflitoModulos] = useState([]);

  const { modalRef: deleteModalRef } = useModalKeyboard(confirmarExclusao, () => setConfirmarExclusao(false));
  const fecharSituacao = useCallback(() => {
    if (situacaoSalvando) return;
    setSituacaoModal(null);
    setJustificativa("");
    setSituacaoErro("");
  }, [situacaoSalvando]);
  const { modalRef: situacaoModalRef } = useModalKeyboard(Boolean(situacaoModal), fecharSituacao);

  // Fecha o modal de conflito (não fecha durante a unificação) e devolve o foco ao campo CPF.
  const fecharConflito = useCallback(() => {
    if (unificando) return;
    setConflito(null);
    setConflitoErro("");
    setConflitoModulos([]);
    setTimeout(() => document.getElementById("cpf")?.focus(), 30);
  }, [unificando]);
  const { modalRef: conflitoModalRef } = useModalKeyboard(Boolean(conflito), fecharConflito);

  const editavel = modo === "novo" || modo === "edicao";

  // Troca de filtro de situação: recarrega a lista (o backend filtra).
  const trocarFiltroSituacao = async (valor) => {
    setFiltroSituacao(valor);
    setBuscando(true);
    const res = await listarPessoas(termo.trim(), { situacao: valor });
    setPessoas(res.success ? res.data : []);
    setBuscando(false);
  };

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [resUbs, resPessoas] = await Promise.all([
        listarUbs(),
        listarPessoas("", { situacao: "ativas" }),
      ]);
      if (!ativo) return;
      if (resUbs.success) setUbsList(resUbs.data);
      if (resPessoas.success) setPessoas(resPessoas.data);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Busca ─────────────────────────────────────────────────────────────────
  const handleBuscar = async (valor) => {
    setTermo(valor);
    // O campo "Nome completo" é também o campo de busca: reflete o que é digitado.
    setForm((prev) => ({ ...prev, nomeCompleto: valor }));
    // Só mostra o dropdown ao começar a digitar (>= 2 caracteres).
    if (valor.trim().length >= 2) {
      setDropAberto(true);
      setBuscando(true);
      const res = await listarPessoas(valor.trim(), { situacao: filtroSituacao });
      setPessoas(res.success ? res.data : []);
      setBuscando(false);
    } else {
      setDropAberto(false);
      setPessoas([]);
    }
  };

  const pessoasFiltradas = pessoas.filter((p) => {
    const t = termo.toLowerCase().trim();
    if (!t) return true;
    const nome = (p.nomeCompleto || "").toLowerCase();
    const mae = (p.nomeMae || "").toLowerCase();
    const cpfLimpo = isCpfProvisorio(p.cpf) ? "" : (p.cpf || "").replace(/\D/g, "");
    const buscaLimpa = t.replace(/\D/g, "");
    return (
      nome.includes(t) ||
      mae.includes(t) ||
      (buscaLimpa && cpfLimpo.includes(buscaLimpa))
    );
  });

  const selecionarPessoa = (p) => {
    setForm(pessoaParaForm(p));
    setModo("leitura");
    setTermo(p.nomeCompleto || "");
    setDropAberto(false);
    setCepErro("");
    // Histórico/situação: só rótulos e contagens por módulo, para a tela
    // mostrar por que o cadastro está inativo (sem expor dados de módulos).
    consultarSituacaoPessoa(p.cpf).then((res) => {
      if (res?.success) setSituacaoInfo(res.data);
      else setSituacaoInfo(null);
    });
  };

  // ── ViaCEP ──────────────────────────────────────────────────────────────
  const consultarCep = async (valor) => {
    const digitos = soDigitos(valor);
    if (digitos.length !== 8) return;
    setCepErro("");
    setCepLoading(true);
    try {
      const res = await buscarCep(digitos);
      if (res.success) {
        setForm((prev) => ({
          ...prev,
          logradouro: res.data.logradouro || prev.logradouro,
          bairro: res.data.bairro || prev.bairro,
          cidade: res.data.cidade || prev.cidade,
          uf: res.data.uf || prev.uf,
          complemento: res.data.complemento || prev.complemento,
        }));
      } else {
        setCepErro(res.error || "CEP não encontrado.");
      }
    } finally {
      setCepLoading(false);
    }
  };

  // ── Ações ─────────────────────────────────────────────────────────────────
  const novoCadastro = () => {
    // Preserva o nome já digitado no campo de busca ao iniciar um novo cadastro.
    const nomeDigitado = termo.trim();
    setForm({ ...FORM_VAZIO, nomeCompleto: nomeDigitado });
    setModo("novo");
    setDropAberto(false);
    setCepErro("");
  };

  const habilitarEdicao = () => {
    setModo("edicao");
    setCepErro("");
  };

  const cancelar = () => {
    setForm(FORM_VAZIO);
    setModo("leitura");
    setTermo("");
    setDropAberto(false);
    setCepErro("");
    setConfirmarExclusao(false);
    setErro("");
  };

  const salvar = async (e) => {
    e.preventDefault();

    // Validar CNS antes de salvar
    if (form.cns && !validarCNS(form.cns)) {
      setCnsErro("CNS inválido. Verifique o número digitado.");
      setSalvando(false);
      return;
    }

    const ok = await confirm({
      title: modo === "edicao" ? "Atualizar pessoa" : "Cadastrar pessoa",
      message:
        modo === "edicao"
          ? "Deseja salvar as alterações desta pessoa?"
          : "Deseja confirmar o cadastro desta pessoa?",
      confirmText: modo === "edicao" ? "Atualizar" : "Cadastrar",
    });
    if (!ok) return;
    setSalvando(true);
    const payload = {
      ...form,
      cpf: soDigitos(form.cpf),
      telefone: soDigitos(form.telefone),
      cep: soDigitos(form.cep),
      cns: soDigitos(form.cns),
      ubsReferenciaId: form.ubsReferenciaId || null,
    };

    // Em edição de pessoa com CPF provisório, cpf vazio mantém o provisório.
    const res =
      modo === "edicao"
        ? await atualizarPessoa(form.cpfChave, payload)
        : await criarPessoa(payload);

    setSalvando(false);

    // CPF informado já pertence a outro cadastro ativo: nada foi salvo; abre o modal.
    if (res.status === "CPF_DUPLICADO_CONFLITO") {
      setErro("");
      setConflitoErro("");
      setConflitoModulos([]);
      setConflito({
        cpf: res.pessoa_conflito?.cpf || "",
        nome: res.pessoa_conflito?.nome || "",
        payload,
      });
      return;
    }

    if (res.success) {
      setErro("");
      const chaveFinal = res.cpf || payload.cpf;
      const busca = await listarPessoas(chaveFinal);
      const salva = busca.success
        ? busca.data.find((x) => x.cpf === chaveFinal)
        : null;
      if (salva) selecionarPessoa(salva);
      else cancelar();
    } else {
      setErro(res.error || "Não foi possível salvar.");
    }
  };

  const abrirSituacao = (tipo) => {
    setSituacaoErro("");
    setJustificativa("");
    setSituacaoModal({ tipo });
  };

  const confirmarSituacao = async () => {
    const acao = situacaoModal?.tipo;
    if (!acao) return;
    setSituacaoErro("");
    setSituacaoSalvando(true);
    const res =
      acao === "inativar"
        ? await inativarPessoa(form.cpfChave, { justificativa })
        : await reativarPessoa(form.cpfChave, { justificativa });
    setSituacaoSalvando(false);

    if (res.success) {
      setSituacaoModal(null);
      setJustificativa("");
      await notify({
        tipo: "sucesso",
        message:
          acao === "inativar"
            ? "Pessoa inativada. Os vínculos e o histórico foram preservados."
            : "Pessoa reativada com todos os vínculos preservados.",
      });
      const busca = await listarPessoas(form.cpfChave, { situacao: "todas" });
      const atualizada = busca.success
        ? busca.data.find((x) => x.cpf === form.cpfChave)
        : null;
      if (atualizada) setForm(pessoaParaForm(atualizada));
      return;
    }
    setSituacaoErro(res.error || "Não foi possível alterar a situação do cadastro.");
  };

  const confirmarRemover = async () => {
    setSalvando(true);
    const res = await excluirPessoa(form.cpfChave);
    setSalvando(false);
    setConfirmarExclusao(false);
    if (res.success) {
      cancelar();
    } else {
      const vinculos = Array.isArray(res.vinculos) && res.vinculos.length
        ? ` Módulos com vínculo: ${res.vinculos.join(", ")}.`
        : "";
      setErro((res.error || "Não foi possível excluir.") + vinculos);
    }
  };

  const confirmarUnificacao = async () => {
    if (!conflito || unificando) return;
    setUnificando(true);
    setConflitoErro("");
    setConflitoModulos([]);
    let res;
    try {
      res = await confirmarUnificacaoPessoas({
        pessoaAlvoCpf: conflito.cpf,
        pessoaOrigemCpf: form.cpfChave,
        motivo: "Unificação por informação de CPF oficial",
        dadosFormulario: conflito.payload,
      });
    } catch {
      res = { success: false, error: "Erro de comunicação ao unificar. Nada foi alterado." };
    }
    setUnificando(false);

    if (!res.success) {
      setConflitoErro(res.mensagem || res.error || "Não foi possível unificar os cadastros.");
      setConflitoModulos(res.status === "CONFLITO_MODULO" ? res.modulos || [] : []);
      return;
    }

    const principal = res.pessoa_alvo;
    setConflito(null);
    setErro("");
    await notify({
      tipo: "sucesso",
      title: "Cadastros unificados",
      message: `Históricos transferidos para ${principal.nomeCompleto}.`,
    });
    // Recarrega a lista e abre a ficha do cadastro principal.
    const busca = await listarPessoas(principal.cpf);
    if (busca.success) setPessoas(busca.data);
    selecionarPessoa(principal);
  };

  const pessoaSelecionada = Boolean(form.cpfChave);
  const cpfProvisorioAtual = modo === "edicao" && isCpfProvisorio(form.cpfChave);
  const tituloForm =
    modo === "novo" ? "Nova pessoa" : modo === "edicao" ? "Editar pessoa" : "Dados da pessoa";

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Cadastro de Pessoas</h1>
          <p className={styles.subtitle}>
            Base central compartilhada entre Regulação, Farmácia Judicial, Junta e CCZ.
          </p>
        </div>
      </header>

      {erro && <div className={styles.alertErro}>{erro}</div>}

      {/* CARD ÚNICO: BUSCA + DADOS DA PESSOA */}
      <form onSubmit={salvar} className={`${styles.card} ${styles.formCard}`}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardHeaderTitle}>{tituloForm}</h2>
          <div className={styles.headerAcoes}>
            <div className={styles.filtroSituacao} role="group" aria-label="Filtrar por situação cadastral">
              {[
                ["ativas", "Ativas"],
                ["inativas", "Inativas"],
                ["todas", "Todas"],
              ].map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => trocarFiltroSituacao(valor)}
                  className={filtroSituacao === valor ? styles.filtroAtivo : styles.filtroBtn}
                  aria-pressed={filtroSituacao === valor}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <button type="button" className={styles.btnAdicionar} onClick={novoCadastro}>
              Adicionar novo
            </button>
          </div>
        </div>

        {/* Situação cadastral da pessoa carregada (discreta, mas clara) */}
        {pessoaSelecionada && !editavel && (
          <div className={form.ativo === false ? styles.avisoInativa : styles.avisoAtiva} role="status">
            <span className={styles.pillSituacao}>{form.ativo === false ? "Inativa" : "Ativa"}</span>
            <span>
              {form.ativo === false
                ? "Cadastro inativo: o histórico continua consultável, mas a pessoa não deve ser usada em novos cadastros."
                : "Cadastro ativo e disponível para novos atendimentos."}
              {situacaoInfo?.ultimaAlteracaoSituacao && (
                <em className={styles.avisoDetalhe}>
                  {" "}
                  Última alteração: {situacaoInfo.ultimaAlteracaoSituacao.acao === "DESATIVAR" ? "inativado" : "reativado"}
                  {situacaoInfo.ultimaAlteracaoSituacao.usuario
                    ? ` por ${situacaoInfo.ultimaAlteracaoSituacao.usuario}`
                    : ""}
                  {situacaoInfo.ultimaAlteracaoSituacao.em
                    ? ` em ${new Date(situacaoInfo.ultimaAlteracaoSituacao.em).toLocaleString("pt-BR")}`
                    : ""}
                  .
                </em>
              )}
            </span>
          </div>
        )}

        <div className={styles.camposBloco}>
        <div className={styles.formSectionTitle}>Dados pessoais</div>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.colWide}`} style={{ position: "relative" }} ref={dropdownRef}>
            <label htmlFor="nomeCompleto">Nome completo <span aria-label="obrigatório">*</span></label>
            <div className={styles.inputWrapperWithIcon}>
              <input
                type="text"
                id="nomeCompleto"
                value={form.nomeCompleto}
                placeholder={editavel ? "" : "Digite nome ou CPF para buscar..."}
                onChange={(e) => {
                  // Em cadastro novo ou edição, apenas edita o nome (sem buscar).
                  // Só no modo leitura o campo funciona como busca de pessoa.
                  if (editavel) {
                    setForm({ ...form, nomeCompleto: e.target.value });
                  } else {
                    handleBuscar(e.target.value);
                  }
                }}
                autoComplete="off"
                required
                aria-required="true"
                aria-describedby={!editavel && dropAberto ? "pessoa-search-results" : undefined}
              />
              {!editavel && (
                <span className={styles.arrowIcon} onClick={() => setDropAberto(!dropAberto)} aria-hidden="true">
                  {dropAberto ? "▲" : "▼"}
                </span>
              )}
            </div>
            {!editavel && dropAberto && (
              <div className={styles.tableDropdownMenu} id="pessoa-search-results" role="listbox" aria-label="Resultados da busca de pessoas">
                <div className={styles.tableContainerScroll}>
                  <table className={styles.patientTableDropdown}>
                    <thead>
                      <tr>
                        <th>CPF / CNS</th>
                        <th>Usuário</th>
                        <th>Nome da mãe</th>
                        <th>Data nasc.</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pessoasFiltradas.length > 0 ? (
                        pessoasFiltradas.map((p) => (
                          <tr
                            key={p.cpf}
                            role="option"
                            aria-selected={form.cpfChave === p.cpf}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selecionarPessoa(p);
                            }}
                            className={form.cpfChave === p.cpf ? styles.selectedRow : ""}
                          >
                            <td>{documentoPaciente({ cpf: p.cpf, cns: p.cns })}</td>
                            <td className={styles.boldName}>{p.nomeCompleto}</td>
                            <td>{p.nomeMae || "Não informada"}</td>
                            <td>
                              {p.dataNascimento
                                ? p.dataNascimento.split("-").reverse().join("/")
                                : "-"}
                            </td>
                            <td>
                              <span className={p.ativo === false ? styles.tagInativa : styles.tagAtiva}>
                                {p.ativo === false ? "Inativa" : "Ativa"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className={styles.noDataTd} role="status">
                            {buscando ? "Buscando pessoas..." : "Nenhuma pessoa encontrada."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className={`${styles.field} ${styles.colWide}`}>
            <label htmlFor="nomeMae">Nome da mãe</label>
            <input
              type="text"
              id="nomeMae"
              value={form.nomeMae}
              onChange={(e) => setForm({ ...form, nomeMae: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="dataNascimento">Data de nascimento <span aria-label="obrigatório">*</span></label>
            <input
              type="date"
              id="dataNascimento"
              value={form.dataNascimento}
              onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
              disabled={!editavel}
              required
              aria-required="true"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="sexo">Sexo <span aria-label="obrigatório">*</span></label>
            <select
              id="sexo"
              value={form.sexo}
              onChange={(e) => setForm({ ...form, sexo: e.target.value })}
              disabled={!editavel}
              required
              aria-required="true"
            >
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="telefone">Telefone / WhatsApp</label>
            <input
              type="text"
              id="telefone"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
              placeholder="(00) 00000-0000"
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="cpf">CPF {modo !== "edicao" && <span aria-label="obrigatório">*</span>}</label>
            <input
              type="text"
              id="cpf"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })}
              placeholder={isCpfProvisorio(form.cpfChave) ? "CPF não informado" : "000.000.000-00"}
              disabled={!(modo === "novo" || cpfProvisorioAtual)}
              required={modo === "novo"}
              aria-required={modo === "novo" ? "true" : "false"}
              aria-describedby={cpfProvisorioAtual ? "cpf-hint" : undefined}
            />
            {cpfProvisorioAtual && (
              <small id="cpf-hint" className={styles.hint}>
                Informe o CPF oficial para substituir o cadastro provisório.
              </small>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor="cns">CNS (Cartão SUS)</label>
            <input
              type="text"
              id="cns"
              value={form.cns}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, "").slice(0, 15);
                setForm({ ...form, cns: valor });
                setCnsErro("");
                // Validação inline quando completo
                if (valor.length === 15 && !validarCNS(valor)) {
                  setCnsErro("CNS inválido");
                }
              }}
              placeholder="15 dígitos"
              disabled={!editavel}
              className={cnsErro && editavel ? styles.inputErro : ""}
              aria-invalid={cnsErro && editavel ? "true" : "false"}
              aria-describedby={cnsErro && editavel ? "cns-error" : undefined}
            />
            {cnsErro && editavel && <small id="cns-error" className={styles.hintErro} role="alert">{cnsErro}</small>}
          </div>
          <div className={styles.field}>
            <label htmlFor="ubsReferenciaId">UBS de referência</label>
            <select
              id="ubsReferenciaId"
              value={form.ubsReferenciaId}
              onChange={(e) => setForm({ ...form, ubsReferenciaId: e.target.value })}
              disabled={!editavel}
            >
              <option value="">-- Nenhuma --</option>
              {ubsList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formSectionTitle}>Endereço</div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor="cep">CEP</label>
            <input
              type="text"
              id="cep"
              value={form.cep}
              onChange={(e) => {
                const masked = maskCep(e.target.value);
                setForm({ ...form, cep: masked });
                setCepErro("");
                if (soDigitos(masked).length === 8) consultarCep(masked);
              }}
              onBlur={(e) => consultarCep(e.target.value)}
              placeholder="00000-000"
              disabled={!editavel}
              aria-describedby={cepLoading ? "cep-loading" : cepErro ? "cep-error" : undefined}
              aria-invalid={cepErro ? "true" : "false"}
            />
            {cepLoading && <small id="cep-loading" className={styles.hint} role="status">Buscando endereço...</small>}
            {cepErro && <small id="cep-error" className={styles.hintErro} role="alert">{cepErro}</small>}
          </div>
          <div className={styles.field}>
            <label htmlFor="bairro">Bairro</label>
            <input
              type="text"
              id="bairro"
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="logradouro">Logradouro / Rua</label>
            <input
              type="text"
              id="logradouro"
              value={form.logradouro}
              onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="numero">Número</label>
            <input
              type="text"
              id="numero"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="complemento">Complemento</label>
            <input
              type="text"
              id="complemento"
              value={form.complemento}
              onChange={(e) => setForm({ ...form, complemento: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="cidade">Cidade</label>
            <input
              type="text"
              id="cidade"
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="uf">UF</label>
            <input
              type="text"
              id="uf"
              value={form.uf}
              maxLength={2}
              onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
              disabled={!editavel}
            />
          </div>
        </div>
        </div>

        <div className={styles.formActions}>
          {modo === "leitura" && pessoaSelecionada && (
            <BotaoEditar onClick={habilitarEdicao} />
          )}
          {editavel && (
            <button type="button" className={styles.btnGhost} onClick={cancelar} disabled={salvando}>
              Cancelar
            </button>
          )}
          {modo === "leitura" && pessoaSelecionada && form.ativo !== false && podeInativar && (
            <button
              type="button"
              className={styles.btnSecundario}
              onClick={() => abrirSituacao("inativar")}
              disabled={salvando}
              aria-label="Inativar pessoa"
            >
              Inativar
            </button>
          )}
          {modo === "leitura" && pessoaSelecionada && form.ativo === false && podeReativar && (
            <button
              type="button"
              className={styles.btnSecundario}
              onClick={() => abrirSituacao("reativar")}
              disabled={salvando}
              aria-label="Reativar pessoa"
            >
              Reativar
            </button>
          )}
          {modo === "edicao" && podeExcluir && (
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() => setConfirmarExclusao(true)}
              disabled={salvando}
              aria-label="Excluir pessoa"
            >
              Excluir
            </button>
          )}
          {editavel && (
            <button type="submit" className={styles.btnPrimary} disabled={salvando} aria-label={modo === "edicao" ? "Atualizar cadastro" : "Salvar novo cadastro"}>
              {salvando ? "Salvando..." : modo === "edicao" ? "Atualizar" : "Salvar"}
            </button>
          )}
        </div>
      </form>

      {/* MODAL: CPF JÁ CADASTRADO EM OUTRO REGISTRO (unificação de históricos) */}
      {conflito && (
        <div className={styles.modalOverlay} onClick={fecharConflito}>
          <div
            ref={conflitoModalRef}
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="conflito-title"
            aria-describedby="conflito-text"
          >
            <h3 id="conflito-title" className={styles.modalTitle}>Cadastro existente com este CPF</h3>
            <p id="conflito-text" className={styles.modalText}>
              O CPF informado pertence a <strong>{conflito.nome}</strong>. Deseja transferir o
              histórico atual (medicamentos/exames) para o cadastro principal?
            </p>
            {conflitoErro && (
              <div className={styles.alertErro} role="alert">
                {conflitoErro}
                {conflitoModulos.length > 0 && (
                  <ul>
                    {conflitoModulos.map((m) => (
                      <li key={m}>{NOMES_MODULOS[m] || m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={fecharConflito}
                disabled={unificando}
              >
                Cancelar / Corrigir CPF
              </button>
              {conflitoModulos.length === 0 && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={confirmarUnificacao}
                  disabled={unificando}
                >
                  {unificando ? "Unificando..." : "Sim, Unificar Históricos"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INATIVAR / REATIVAR PESSOA */}
      {situacaoModal && (
        <div className={styles.modalOverlay} onClick={fecharSituacao}>
          <div
            ref={situacaoModalRef}
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="situacao-title"
            aria-describedby="situacao-text"
          >
            <h3 id="situacao-title" className={styles.modalTitle}>
              {situacaoModal.tipo === "inativar" ? "Inativar pessoa" : "Reativar pessoa"}
            </h3>
            <p id="situacao-text" className={styles.modalText}>
              {situacaoModal.tipo === "inativar" ? (
                <>
                  Você vai inativar o cadastro de <strong>{form.nomeCompleto}</strong>
                  {form.cpfChave && !isCpfProvisorio(form.cpfChave) ? (
                    <> (CPF {maskCpf(form.cpfChave)})</>
                  ) : null}
                  .<br />
                  <span className={styles.modalNota}>
                    Nada será apagado: pedidos da Regulação, processos da Câmara Técnica,
                    registros da Farmácia Judicial, prontuários da Junta Reguladora e os
                    vínculos do CCZ (inclusive os animais) continuam intactos. O cadastro
                    sai das listas de uso e o histórico permanece consultável.
                  </span>
                </>
              ) : (
                <>
                  Reativar o cadastro de <strong>{form.nomeCompleto}</strong>
                  {form.cpfChave && !isCpfProvisorio(form.cpfChave) ? (
                    <> (CPF {maskCpf(form.cpfChave)})</>
                  ) : null}
                  ?<br />
                  <span className={styles.modalNota}>
                    O MESMO registro volta a ficar ativo — nenhum cadastro novo é criado —
                    e todos os vínculos já existentes são mantidos.
                  </span>
                </>
              )}
            </p>
            <div className={styles.field}>
              <label htmlFor="justificativa-situacao">
                Justificativa <span aria-label="obrigatório">*</span>
              </label>
              <textarea
                id="justificativa-situacao"
                className={styles.textarea}
                rows={3}
                maxLength={500}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder={
                  situacaoModal.tipo === "inativar"
                    ? "Ex.: cadastro duplicado de paciente que já possui registro ativo."
                    : "Ex.: paciente retornou ao acompanhamento na UBS."
                }
                required
                aria-required="true"
              />
              <small className={styles.hint}>Mínimo de 15 caracteres. Fica registrado na auditoria.</small>
            </div>
            {situacaoErro && (
              <div className={styles.alertErro} role="alert">
                {situacaoErro}
              </div>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={fecharSituacao}
                disabled={situacaoSalvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={situacaoModal.tipo === "inativar" ? styles.btnDanger : styles.btnPrimary}
                onClick={confirmarSituacao}
                disabled={situacaoSalvando || justificativa.trim().length < 15}
              >
                {situacaoSalvando
                  ? "Salvando..."
                  : situacaoModal.tipo === "inativar"
                    ? "Confirmar inativação"
                    : "Confirmar reativação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {confirmarExclusao && (
        <div className={styles.modalOverlay} onClick={() => setConfirmarExclusao(false)}>
          <div ref={deleteModalRef} className={styles.modal} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title" className={styles.modalTitle}>Excluir pessoa</h3>
            <p className={styles.modalText}>
              Tem certeza que deseja excluir <strong>{form.nomeCompleto}</strong>?
              Esta ação não pode ser desfeita e só é permitida quando a pessoa não
              possui registros em outros módulos do IntegraSaúde.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setConfirmarExclusao(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={confirmarRemover}
                disabled={salvando}
              >
                {salvando ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
