"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CadastroTutor.module.css";
import { buscarCep } from "@/lib/viacep";
import { mascararTelefone as maskTelefone } from "@/lib/telefone";
import { documentoPaciente } from "@/app/regulacao/constants";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import { buscarPessoasCCZ, salvarTutor, listarAnimaisDoTutor } from "./actions";

// ── Máscaras locais ───────────────────────────────────────────────────────
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
  // Dados pessoais (vão para a tabela `pessoa`).
  cpf: "",
  nomeCompleto: "",
  sexo: "Masculino",
  dataNascimento: "",
  nomeMae: "",
  telefone: "",
  cns: "",
  // Endereço (tabela `pessoa_endereco`).
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "Muriaé",
  uf: "MG",
  // Complementares CCZ (tabela `ccz_tutores`).
  rg: "",
  tutorSexo: "",
  profissao: "",
  telefoneSecundario: "",
  pontoReferencia: "",
  observacoes: "",
};

// Preenche o formulário a partir de uma pessoa vinda do banco.
const pessoaParaForm = (p) => ({
  ...FORM_VAZIO,
  ...p,
  cpf: maskCpf(p.cpf),
  telefone: maskTelefone(p.telefone),
  telefoneSecundario: p.telefoneSecundario ? maskTelefone(p.telefoneSecundario) : "",
  cep: maskCep(p.cep),
});

export default function CadastroTutor({ cpfInicial = "", onVoltarLista }) {
  // Edição aberta a partir da aba "Lista" (quando um CPF inicial é informado).
  const edicaoViaLista = Boolean(soDigitos(cpfInicial)) && typeof onVoltarLista === "function";
  const confirm = useConfirm();
  const notify = useNotify();

  const [form, setForm] = useState(FORM_VAZIO);
  // Modos: "leitura" (busca ativa), "novo" (cadastro), "edicao" (editar).
  const [modo, setModo] = useState("leitura");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Busca (campo "Nome completo" select-like + dropdown em tabela).
  const [termo, setTermo] = useState("");
  const [pessoas, setPessoas] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [dropAberto, setDropAberto] = useState(false);
  const dropdownRef = useRef(null);

  const [cepLoading, setCepLoading] = useState(false);
  const [cepErro, setCepErro] = useState("");

  // Animais vinculados ao tutor selecionado (bloco de vínculos).
  const [animais, setAnimais] = useState([]);
  const [animaisLoading, setAnimaisLoading] = useState(false);

  const editavel = modo === "novo" || modo === "edicao";
  const cpfSelecionado = soDigitos(form.cpf);

  // Edição vinda da aba "Lista": carrega o tutor pelo CPF e abre em edição.
  useEffect(() => {
    let ativo = true;
    const cpf = soDigitos(cpfInicial);
    if (!cpf) return;
    (async () => {
      const res = await buscarPessoasCCZ(cpf);
      if (!ativo) return;
      const p = res.success ? res.data.find((x) => soDigitos(x.cpf) === cpf) : null;
      if (p) {
        setForm(pessoaParaForm(p));
        setTermo(p.nomeCompleto || "");
        setModo("edicao");
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpfInicial]);

  // Carrega os animais do tutor sempre que um tutor com CPF é selecionado
  // (modo leitura). Em novo/edição não lista para não confundir com o cadastro.
  useEffect(() => {
    let ativo = true;
    if (modo === "leitura" && cpfSelecionado) {
      setAnimaisLoading(true);
      listarAnimaisDoTutor(cpfSelecionado).then((res) => {
        if (!ativo) return;
        setAnimais(res.success ? res.data : []);
        setAnimaisLoading(false);
      });
    } else {
      setAnimais([]);
    }
    return () => {
      ativo = false;
    };
  }, [cpfSelecionado, modo]);

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

  // Busca (debounce por tamanho mínimo) - só funciona em modo leitura
  const handleBuscar = async (valor) => {
    setTermo(valor);
    setForm((prev) => ({ ...prev, nomeCompleto: valor }));
    
    // Só busca se estiver em modo leitura
    if (modo !== "leitura") return;
    
    if (!dropAberto) setDropAberto(true);
    if (valor.trim().length >= 2) {
      setBuscando(true);
      const res = await buscarPessoasCCZ(valor.trim());
      setPessoas(res.success ? res.data : []);
      setBuscando(false);
    } else {
      setPessoas([]);
    }
  };

  const selecionarPessoa = (p) => {
    setForm(pessoaParaForm(p));
    setModo("leitura");
    setTermo(p.nomeCompleto || "");
    setDropAberto(false);
    setCepErro("");
    setErro("");
  };

  // ── ViaCEP ────────────────────────────────────────────────────────────────
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

  // ── Ações ───────────────────────────────────────────────────────────────
  const novoCadastro = () => {
    const nomeDigitado = termo.trim();
    setForm({ ...FORM_VAZIO, nomeCompleto: nomeDigitado });
    setModo("novo");
    setDropAberto(false);
    setPessoas([]);
    setTermo("");
    setCepErro("");
    setErro("");
  };

  const iniciarEdicao = () => {
    setModo("edicao");
  };

  const cancelarOperacao = () => {
    if (cpfSelecionado && modo === "edicao") {
      // Volta para modo leitura mantendo dados
      setModo("leitura");
    } else if (edicaoViaLista && onVoltarLista) {
      onVoltarLista();
    } else {
      // Limpa e volta para modo leitura
      setForm(FORM_VAZIO);
      setTermo("");
      setPessoas([]);
      setModo("leitura");
      setErro("");
    }
  };

  const habilitarEdicao = () => {
    setModo("edicao");
    setCepErro("");
    setErro("");
  };

  const cancelar = () => {
    // Edição vinda da Lista: cancelar volta direto para a lista de tutores.
    if (edicaoViaLista) {
      onVoltarLista();
      return;
    }
    setForm(FORM_VAZIO);
    setModo("leitura");
    setTermo("");
    setPessoas([]);
    setDropAberto(false);
    setCepErro("");
    setErro("");
  };

  const salvar = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: modo === "edicao" ? "Atualizar tutor" : "Cadastrar tutor",
      message:
        modo === "edicao"
          ? "Deseja salvar as alterações deste tutor?"
          : "Deseja confirmar o cadastro deste tutor?",
      confirmText: modo === "edicao" ? "Atualizar" : "Cadastrar",
    });
    if (!ok) return;

    setSalvando(true);
    const payload = {
      ...form,
      cpf: soDigitos(form.cpf),
      telefone: soDigitos(form.telefone),
      telefoneSecundario: soDigitos(form.telefoneSecundario),
      cep: soDigitos(form.cep),
      cns: soDigitos(form.cns),
    };

    const res = await salvarTutor(payload);
    setSalvando(false);

    if (res.success) {
      setErro("");
      await notify({ tipo: "sucesso", title: "Pronto", message: "Tutor salvo com sucesso!" });
      if (edicaoViaLista) {
        onVoltarLista();
        return;
      }
      // Após salvar, volta para modo leitura vazio
      setForm(FORM_VAZIO);
      setModo("leitura");
      setTermo("");
      setPessoas([]);
      setDropAberto(false);
    } else {
      setErro(res.error || "Não foi possível salvar o tutor.");
    }
  };

  const pessoaSelecionada = Boolean(soDigitos(form.cpf));
  const tituloForm =
    modo === "novo" ? "Novo tutor" : modo === "edicao" ? "Editar tutor" : "Dados do tutor";

  return (
    <div className={styles.container}>
      {erro && <div className={styles.alertErro}>{erro}</div>}

      <form onSubmit={salvar} className={`${styles.card} ${styles.formCard}`}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardHeaderTitle}>{tituloForm}</h2>
          <button type="button" className={styles.btnAdicionar} onClick={novoCadastro}>
            Cadastrar novo
          </button>
        </div>

        <div className={styles.camposBloco}>
          <div className={styles.formSectionTitle}>Dados pessoais</div>
          <div className={styles.grid}>
            <div
              className={`${styles.field} ${styles.colWide}`}
              style={{ position: "relative" }}
              ref={dropdownRef}
            >
              <label>Nome completo *</label>
              <div className={styles.inputWrapperWithIcon}>
                <input
                  type="text"
                  value={form.nomeCompleto}
                  placeholder={editavel ? "" : "Digite nome ou CPF para buscar..."}
                  onChange={(e) => {
                    if (editavel) {
                      setForm({ ...form, nomeCompleto: e.target.value });
                    } else {
                      handleBuscar(e.target.value);
                    }
                  }}
                  onFocus={() => {
                    if (!editavel) setDropAberto(true);
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
                          <th>Nome</th>
                          <th>Nome da mãe</th>
                          <th>Data nasc.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pessoas.length > 0 ? (
                          pessoas.map((p) => (
                            <tr
                              key={p.cpf}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selecionarPessoa(p);
                              }}
                              className={
                                soDigitos(form.cpf) === soDigitos(p.cpf) ? styles.selectedRow : ""
                              }
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
              <label>Telefone / WhatsApp *</label>
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
                onChange={(e) =>
                  setForm({ ...form, cns: e.target.value.replace(/\D/g, "").slice(0, 15) })
                }
                placeholder="Opcional"
                disabled={!editavel}
              />
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
            <button type="button" className={styles.btnPrimary} onClick={iniciarEdicao}>
              Editar
            </button>
          )}
          {modo === "leitura" && !pessoaSelecionada && (
            <button type="button" className={styles.btnGhost} onClick={novoCadastro}>
              Novo
            </button>
          )}
          {editavel && (
            <>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={cancelarOperacao}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={salvando}>
                {salvando ? "Salvando..." : modo === "edicao" ? "Atualizar" : "Salvar"}
              </button>
            </>
          )}
        </div>
      </form>

      {/* BLOCO: ANIMAIS VINCULADOS AO TUTOR SELECIONADO */}
      {modo === "leitura" && pessoaSelecionada && (
        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardHeaderTitle}>
              Animais vinculados{animais.length > 0 ? ` (${animais.length})` : ""}
            </h2>
          </div>

          {animaisLoading ? (
            <p className={styles.animaisVazio}>Carregando animais...</p>
          ) : animais.length === 0 ? (
            <p className={styles.animaisVazio}>
              Nenhum animal vinculado a este tutor. Vincule pela aba{" "}
              <strong>Animais</strong>.
            </p>
          ) : (
            <div className={styles.tableContainerScroll}>
              <table className={styles.animaisTable}>
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Nome</th>
                    <th>Espécie</th>
                    <th>Sexo</th>
                    <th>Porte</th>
                    <th>Idade</th>
                    <th>Castrado</th>
                  </tr>
                </thead>
                <tbody>
                  {animais.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td className={styles.boldName}>{a.nome || "Sem nome"}</td>
                      <td>{a.especie || "-"}</td>
                      <td>{a.sexo}</td>
                      <td>{a.porte || "-"}</td>
                      <td>{a.idade || "-"}</td>
                      <td>{a.castrado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
