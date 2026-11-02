"use client";

import { useState, useEffect } from "react";
import styles from "./ModalCadastroPaciente.module.css";
import { buscarCep } from "@/lib/viacep";
import { mascararTelefone } from "@/lib/telefone";

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

export default function ModalCadastroPaciente({ onClose, onSalvo, cpfInicial = "" }) {
  const [form, setForm] = useState({ ...FORM_VAZIO, cpf: maskCpf(cpfInicial) });
  const [ubsList, setUbsList] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepErro, setCepErro] = useState("");

  useEffect(() => {
    async function carregarUbs() {
      try {
        const res = await fetch("/api/ubs");
        if (res.ok) {
          const data = await res.json();
          setUbsList(data);
        }
      } catch (error) {
        console.error("Erro ao carregar UBS:", error);
      }
    }
    carregarUbs();
  }, []);

  const handleChange = (campo, valor) => {
    setErro("");
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleCepChange = (valor) => {
    const masked = maskCep(valor);
    handleChange("cep", masked);
    
    const digitos = soDigitos(valor);
    if (digitos.length === 8) {
      buscarEndereco(digitos);
    } else {
      setCepErro("");
    }
  };

  const buscarEndereco = async (cep) => {
    setCepLoading(true);
    setCepErro("");
    
    try {
      const res = await buscarCep(cep);
      if (res.erro) {
        setCepErro("CEP não encontrado");
      } else {
        setForm((prev) => ({
          ...prev,
          logradouro: res.logradouro || prev.logradouro,
          bairro: res.bairro || prev.bairro,
          cidade: res.localidade || prev.cidade,
          uf: res.uf || prev.uf,
        }));
      }
    } catch (error) {
      setCepErro("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const validarCpf = (cpf) => {
    const digitos = soDigitos(cpf);
    if (digitos.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digitos)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(digitos.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let digito1 = resto >= 10 ? 0 : resto;
    if (digito1 !== parseInt(digitos.charAt(9))) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(digitos.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let digito2 = resto >= 10 ? 0 : resto;
    return digito2 === parseInt(digitos.charAt(10));
  };

  const handleSalvar = async () => {
    setErro("");

    // Validações
    const cpfDigitos = soDigitos(form.cpf);
    if (!cpfDigitos || cpfDigitos.length !== 11) {
      setErro("CPF inválido");
      return;
    }
    if (!validarCpf(cpfDigitos)) {
      setErro("CPF inválido");
      return;
    }
    if (!form.nomeCompleto.trim()) {
      setErro("Nome completo é obrigatório");
      return;
    }
    if (!form.dataNascimento) {
      setErro("Data de nascimento é obrigatória");
      return;
    }

    setSalvando(true);

    try {
      const payload = {
        ...form,
        cpf: cpfDigitos,
        telefone: soDigitos(form.telefone),
        cep: soDigitos(form.cep),
        ubsReferenciaId: form.ubsReferenciaId ? parseInt(form.ubsReferenciaId) : null,
      };

      const res = await fetch("/api/pessoas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao cadastrar paciente");
        setSalvando(false);
        return;
      }

      onSalvo(data);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setErro("Erro ao cadastrar paciente");
      setSalvando(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Cadastrar Novo Paciente</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {erro && <div className={styles.erro}>{erro}</div>}

          <div className={styles.formGrid}>
            {/* CPF */}
            <div className={styles.formGroup}>
              <label>CPF <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={form.cpf}
                onChange={(e) => handleChange("cpf", maskCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>

            {/* Nome Completo */}
            <div className={`${styles.formGroup} ${styles.span2}`}>
              <label>Nome Completo <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={form.nomeCompleto}
                onChange={(e) => handleChange("nomeCompleto", e.target.value)}
                placeholder="Nome completo do paciente"
              />
            </div>

            {/* Sexo */}
            <div className={styles.formGroup}>
              <label>Sexo</label>
              <select value={form.sexo} onChange={(e) => handleChange("sexo", e.target.value)}>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>

            {/* Data de Nascimento */}
            <div className={styles.formGroup}>
              <label>Data de Nascimento <span className={styles.required}>*</span></label>
              <input
                type="date"
                value={form.dataNascimento}
                onChange={(e) => handleChange("dataNascimento", e.target.value)}
              />
            </div>

            {/* Nome da Mãe */}
            <div className={`${styles.formGroup} ${styles.span2}`}>
              <label>Nome da Mãe</label>
              <input
                type="text"
                value={form.nomeMae}
                onChange={(e) => handleChange("nomeMae", e.target.value)}
                placeholder="Nome completo da mãe"
              />
            </div>

            {/* Telefone */}
            <div className={styles.formGroup}>
              <label>Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => handleChange("telefone", mascararTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* CNS */}
            <div className={styles.formGroup}>
              <label>CNS (Cartão SUS)</label>
              <input
                type="text"
                value={form.cns}
                onChange={(e) => handleChange("cns", e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="000000000000000"
              />
            </div>

            {/* UBS */}
            <div className={`${styles.formGroup} ${styles.span2}`}>
              <label>UBS de Referência</label>
              <select
                value={form.ubsReferenciaId}
                onChange={(e) => handleChange("ubsReferenciaId", e.target.value)}
              >
                <option value="">Selecione uma UBS</option>
                {ubsList.map((ubs) => (
                  <option key={ubs.id} value={ubs.id}>
                    {ubs.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h3 className={styles.sectionTitle}>Endereço</h3>

          <div className={styles.formGrid}>
            {/* CEP */}
            <div className={styles.formGroup}>
              <label>CEP</label>
              <div className={styles.inputWithIcon}>
                <input
                  type="text"
                  value={form.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                />
                {cepLoading && <div className={styles.spinner}></div>}
              </div>
              {cepErro && <span className={styles.erro}>{cepErro}</span>}
            </div>

            {/* Logradouro */}
            <div className={`${styles.formGroup} ${styles.span2}`}>
              <label>Logradouro</label>
              <input
                type="text"
                value={form.logradouro}
                onChange={(e) => handleChange("logradouro", e.target.value)}
                placeholder="Rua, Avenida, etc."
              />
            </div>

            {/* Número */}
            <div className={styles.formGroup}>
              <label>Número</label>
              <input
                type="text"
                value={form.numero}
                onChange={(e) => handleChange("numero", e.target.value)}
                placeholder="Nº"
              />
            </div>

            {/* Complemento */}
            <div className={styles.formGroup}>
              <label>Complemento</label>
              <input
                type="text"
                value={form.complemento}
                onChange={(e) => handleChange("complemento", e.target.value)}
                placeholder="Apto, Bloco, etc."
              />
            </div>

            {/* Bairro */}
            <div className={styles.formGroup}>
              <label>Bairro</label>
              <input
                type="text"
                value={form.bairro}
                onChange={(e) => handleChange("bairro", e.target.value)}
                placeholder="Bairro"
              />
            </div>

            {/* Cidade */}
            <div className={styles.formGroup}>
              <label>Cidade</label>
              <input
                type="text"
                value={form.cidade}
                onChange={(e) => handleChange("cidade", e.target.value)}
                placeholder="Cidade"
              />
            </div>

            {/* UF */}
            <div className={styles.formGroup}>
              <label>UF</label>
              <select value={form.uf} onChange={(e) => handleChange("uf", e.target.value)}>
                <option value="AC">AC</option>
                <option value="AL">AL</option>
                <option value="AP">AP</option>
                <option value="AM">AM</option>
                <option value="BA">BA</option>
                <option value="CE">CE</option>
                <option value="DF">DF</option>
                <option value="ES">ES</option>
                <option value="GO">GO</option>
                <option value="MA">MA</option>
                <option value="MT">MT</option>
                <option value="MS">MS</option>
                <option value="MG">MG</option>
                <option value="PA">PA</option>
                <option value="PB">PB</option>
                <option value="PR">PR</option>
                <option value="PE">PE</option>
                <option value="PI">PI</option>
                <option value="RJ">RJ</option>
                <option value="RN">RN</option>
                <option value="RS">RS</option>
                <option value="RO">RO</option>
                <option value="RR">RR</option>
                <option value="SC">SC</option>
                <option value="SP">SP</option>
                <option value="SE">SE</option>
                <option value="TO">TO</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancelar} onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className={styles.btnSalvar} onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar Paciente"}
          </button>
        </div>
      </div>
    </div>
  );
}
