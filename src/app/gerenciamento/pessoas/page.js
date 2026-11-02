"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./Pessoas.module.css";
import { buscarCep } from "@/lib/viacep";
import { useConfirm } from "@/components/ConfirmDialog";
import BotaoEditar from "@/components/BotaoEditar";
import { documentoPaciente } from "@/app/regulacao/constants";
import { mascararTelefone as maskTelefone } from "@/lib/telefone";
import { validarCNS } from "@/lib/validations/cns";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import {
  listarPessoas,
  listarUbs,
  criarPessoa,
  atualizarPessoa,
  excluirPessoa,
} from "./actions";

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

const FORM_VAZIO = {
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
  cpf: maskCpf(p.cpf),
  telefone: maskTelefone(p.telefone),
  cep: maskCep(p.cep),
  ubsReferenciaId: p.ubsReferenciaId ? String(p.ubsReferenciaId) : "",
});

export default function PessoasPage() {
  const confirm = useConfirm();
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
  const [cnsErro, setCnsErro] = useState("");

  const { modalRef: deleteModalRef } = useModalKeyboard(confirmarExclusao, () => setConfirmarExclusao(false));

  const editavel = modo === "novo" || modo === "edicao";

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [resUbs, resPessoas] = await Promise.all([listarUbs(), listarPessoas("")]);
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
      const res = await listarPessoas(valor.trim());
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
    const cpfLimpo = (p.cpf || "").replace(/\D/g, "");
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

    const res =
      modo === "edicao"
        ? await atualizarPessoa(payload.cpf, payload)
        : await criarPessoa(payload);

    setSalvando(false);

    if (res.success) {
      setErro("");
      const busca = await listarPessoas(payload.cpf);
      const salva = busca.success
        ? busca.data.find((x) => soDigitos(x.cpf) === payload.cpf)
        : null;
      if (salva) selecionarPessoa(salva);
      else cancelar();
    } else {
      setErro(res.error || "Não foi possível salvar.");
    }
  };

  const confirmarRemover = async () => {
    setSalvando(true);
    const res = await excluirPessoa(soDigitos(form.cpf));
    setSalvando(false);
    setConfirmarExclusao(false);
    if (res.success) cancelar();
    else setErro(res.error || "Não foi possível excluir.");
  };

  const pessoaSelecionada = Boolean(soDigitos(form.cpf));
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
          <button type="button" className={styles.btnAdicionar} onClick={novoCadastro}>
            Adicionar novo
          </button>
        </div>

        <div className={styles.camposBloco}>
        <div className={styles.formSectionTitle}>Dados pessoais</div>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.colWide}`} style={{ position: "relative" }} ref={dropdownRef}>
            <label>Nome completo *</label>
            <div className={styles.inputWrapperWithIcon}>
              <input
                type="text"
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
              />
              {!editavel && (
                <span className={styles.arrowIcon} onClick={() => setDropAberto(!dropAberto)}>
                  {dropAberto ? "▲" : "▼"}
                </span>
              )}
            </div>
            {!editavel && dropAberto && (
              <div className={styles.tableDropdownMenu}>
                <div className={styles.tableContainerScroll}>
                  <table className={styles.patientTableDropdown}>
                    <thead>
                      <tr>
                        <th>CPF / CNS</th>
                        <th>Usuário</th>
                        <th>Nome da mãe</th>
                        <th>Data nasc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pessoasFiltradas.length > 0 ? (
                        pessoasFiltradas.map((p) => (
                          <tr
                            key={p.cpf}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selecionarPessoa(p);
                            }}
                            className={soDigitos(form.cpf) === soDigitos(p.cpf) ? styles.selectedRow : ""}
                          >
                            <td>{documentoPaciente({ cpf: p.cpf, cns: p.cns })}</td>
                            <td className={styles.boldName}>{p.nomeCompleto}</td>
                            <td>{p.nomeMae || "Não informada"}</td>
                            <td>
                              {p.dataNascimento
                                ? p.dataNascimento.split("-").reverse().join("/")
                                : "-"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className={styles.noDataTd}>
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
            <label>Nome da mãe</label>
            <input
              type="text"
              value={form.nomeMae}
              onChange={(e) => setForm({ ...form, nomeMae: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label>Data de nascimento *</label>
            <input
              type="date"
              value={form.dataNascimento}
              onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
              disabled={!editavel}
              required
            />
          </div>
          <div className={styles.field}>
            <label>Sexo *</label>
            <select
              value={form.sexo}
              onChange={(e) => setForm({ ...form, sexo: e.target.value })}
              disabled={!editavel}
              required
            >
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Telefone / WhatsApp</label>
            <input
              type="text"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
              placeholder="(00) 00000-0000"
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label>CPF *</label>
            <input
              type="text"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })}
              placeholder="000.000.000-00"
              disabled={modo !== "novo"}
              required
            />
          </div>
          <div className={styles.field}>
            <label>CNS (Cartão SUS)</label>
            <input
              type="text"
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
            />
            {cnsErro && editavel && <small className={styles.hintErro}>{cnsErro}</small>}
          </div>
          <div className={styles.field}>
            <label>UBS de referência</label>
            <select
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
            <label>CEP</label>
            <input
              type="text"
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
            />
            {cepLoading && <small className={styles.hint}>Buscando endereço...</small>}
            {cepErro && <small className={styles.hintErro}>{cepErro}</small>}
          </div>
          <div className={styles.field}>
            <label>Bairro</label>
            <input
              type="text"
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label>Logradouro / Rua</label>
            <input
              type="text"
              value={form.logradouro}
              onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label>Número</label>
            <input
              type="text"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label>Complemento</label>
            <input
              type="text"
              value={form.complemento}
              onChange={(e) => setForm({ ...form, complemento: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label>Cidade</label>
            <input
              type="text"
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              disabled={!editavel}
            />
          </div>
          <div className={styles.field}>
            <label>UF</label>
            <input
              type="text"
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
          {modo === "edicao" && (
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() => setConfirmarExclusao(true)}
              disabled={salvando}
            >
              Excluir
            </button>
          )}
          {editavel && (
            <button type="submit" className={styles.btnPrimary} disabled={salvando}>
              {salvando ? "Salvando..." : modo === "edicao" ? "Atualizar" : "Salvar"}
            </button>
          )}
        </div>
      </form>

      {/* POPUP DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {confirmarExclusao && (
        <div className={styles.modalOverlay} onClick={() => setConfirmarExclusao(false)}>
          <div ref={deleteModalRef} className={styles.modal} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title" className={styles.modalTitle}>Excluir pessoa</h3>
            <p className={styles.modalText}>
              Tem certeza que deseja excluir <strong>{form.nomeCompleto}</strong>?
              Esta ação não pode ser desfeita.
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
