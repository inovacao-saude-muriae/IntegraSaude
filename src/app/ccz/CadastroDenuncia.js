"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CadastroTutor.module.css";
import { useNotify } from "@/components/ConfirmDialog";
import { salvarDenuncia, buscarAnimaisCCZ } from "./actions";

const FORM_VAZIO = {
  animalId: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "Muriaé",
  uf: "MG",
  pontoReferencia: "",
  descricaoCao: "",
  causouRisco: "Não",
  relato: "",
};

// Rótulos específicos por tipo de denúncia. O formulário é o mesmo; muda só a
// terminologia exibida (os campos gravados continuam idênticos).
const ROTULOS_POR_TIPO = {
  AGRESSIVO: {
    descricao: "Descrição do Cão *",
    descricaoPlaceholder: "Porte, cor, raça, características...",
    botao: "Registrar Denúncia",
  },
  DOENTE: {
    descricao: "Descrição do animal *",
    descricaoPlaceholder: "Espécie, porte, cor, sintomas/estado do animal...",
    botao: "Registrar Denúncia",
  },
};

export default function CadastroDenuncia({ tipo = "AGRESSIVO" }) {
  const notify = useNotify();

  const rotulos = ROTULOS_POR_TIPO[tipo] || ROTULOS_POR_TIPO.AGRESSIVO;

  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepErro, setCepErro] = useState("");
  const [tutorInfo, setTutorInfo] = useState(null);

  // Busca de animal (opcional)
  const [animalNome, setAnimalNome] = useState("");
  const [animaisResultados, setAnimaisResultados] = useState([]);
  const [animaisDropAberto, setAnimaisDropAberto] = useState(false);
  const [animaisBuscando, setAnimaisBuscando] = useState(false);
  const animaisDropRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (animaisDropRef.current && !animaisDropRef.current.contains(e.target)) {
        setAnimaisDropAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Busca animais
  const buscarAnimal = async (valor) => {
    setAnimalNome(valor);
    setForm((prev) => ({ ...prev, animalId: "" }));

    if (valor.trim().length < 2) {
      setAnimaisDropAberto(false);
      setAnimaisResultados([]);
      return;
    }

    setAnimaisDropAberto(true);
    setAnimaisBuscando(true);
    const res = await buscarAnimaisCCZ(valor.trim());
    setAnimaisResultados(res.success ? res.data : []);
    setAnimaisBuscando(false);
  };

  const selecionarAnimal = (animal) => {
    setForm((prev) => ({ ...prev, animalId: animal.id }));
    setAnimalNome(animal.nome || "");
    setAnimaisDropAberto(false);
    
    // Carregar informações do tutor se existir
    if (animal.tutorNome) {
      setTutorInfo({
        nome: animal.tutorNome,
        cpf: animal.pessoaCpf || "",
      });
    } else {
      setTutorInfo(null);
    }
  };

  const limparAnimal = () => {
    setForm((prev) => ({ ...prev, animalId: "" }));
    setAnimalNome("");
    setTutorInfo(null);
  };

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Buscar endereço pelo CEP
  async function buscarCep(cep) {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      setCepErro("");
      return;
    }

    setCepLoading(true);
    setCepErro("");

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();

      if (data.erro) {
        setCepErro("CEP não encontrado");
        return;
      }

      setForm((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
        complemento: data.complemento || prev.complemento,
      }));
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      setCepErro("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  function handleCepChange(e) {
    const valor = e.target.value;
    setForm((prev) => ({ ...prev, cep: valor }));
    buscarCep(valor);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    setSalvando(true);
    const resultado = await salvarDenuncia({ ...form, tipo });
    setSalvando(false);

    if (resultado.sucesso) {
      notify("Denúncia registrada com sucesso!", "success");
      // Limpar formulário
      setForm(FORM_VAZIO);
      setAnimalNome("");
    } else {
      setErro(resultado.erro || "Erro ao registrar denúncia");
    }
  }

  return (
    <div className={styles.container}>
      {erro && <div className={styles.alertErro}>{erro}</div>}

      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          {/* Grid Animal + Tutor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Animal (opcional) */}
            <div>
              <label
                htmlFor="animalNome"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Animal (opcional)
              </label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <div style={{ position: "relative", flex: 1 }} ref={animaisDropRef}>
                  <div className={styles.inputWrapperWithIcon}>
                    <input
                      id="animalNome"
                      type="text"
                      value={animalNome}
                      onChange={(e) => buscarAnimal(e.target.value)}
                      placeholder="Digite o nome ou ID"
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.85rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "0.875rem",
                      }}
                    />
                    <span className={styles.arrowIcon}>{animaisDropAberto ? "▲" : "▼"}</span>
                  </div>

                  {animaisDropAberto && (
                    <div className={styles.tableDropdownMenu}>
                      <div className={styles.tableContainerScroll}>
                        <table className={styles.patientTableDropdown}>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Nome</th>
                              <th>Espécie</th>
                              <th>Tutor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {animaisBuscando ? (
                              <tr>
                                <td colSpan="4" className={styles.noDataTd}>
                                  Buscando...
                                </td>
                              </tr>
                            ) : animaisResultados.length === 0 ? (
                              <tr>
                                <td colSpan="4" className={styles.noDataTd}>
                                  Nenhum animal encontrado
                                </td>
                              </tr>
                            ) : (
                              animaisResultados.map((animal) => (
                                <tr key={animal.id} onClick={() => selecionarAnimal(animal)}>
                                  <td>{animal.id}</td>
                                  <td className={styles.boldName}>{animal.nome}</td>
                                  <td>{animal.especie}</td>
                                  <td>{animal.tutorNome}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                {form.animalId && (
                  <button
                    type="button"
                    onClick={limparAnimal}
                    style={{
                      padding: "0.6rem 0.85rem",
                      backgroundColor: "#fee2e2",
                      color: "#991b1b",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Limpar
                  </button>
                )}
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                Informe se o animal estiver cadastrado
              </p>
            </div>

            {/* Tutor (exibido quando animal selecionado tem tutor) */}
            <div>
              <label
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Tutor
              </label>
              {tutorInfo ? (
                <div
                  style={{
                    padding: "0.6rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    minHeight: "38px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: "600", color: "#1e293b" }}>
                      {tutorInfo.nome}
                    </div>
                    {tutorInfo.cpf && (
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                        CPF: {tutorInfo.cpf}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "0.6rem 0.85rem",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    color: "#94a3b8",
                    fontSize: "0.875rem",
                    minHeight: "38px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Selecione um animal com tutor
                </div>
              )}
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                Carregado automaticamente do animal
              </p>
            </div>
          </div>

          <div className={styles.formSectionTitle}>Localização</div>

          {/* Grid de Endereço */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* CEP */}
            <div>
              <label
                htmlFor="cep"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                CEP
              </label>
              <input
                id="cep"
                type="text"
                name="cep"
                value={form.cep}
                onChange={handleCepChange}
                placeholder="00000-000"
                maxLength={9}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
              {cepLoading && (
                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                  Buscando endereço...
                </p>
              )}
              {cepErro && (
                <p style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem" }}>
                  {cepErro}
                </p>
              )}
            </div>

            {/* Bairro */}
            <div>
              <label
                htmlFor="bairro"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Bairro
              </label>
              <input
                id="bairro"
                type="text"
                name="bairro"
                value={form.bairro}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Logradouro */}
            <div>
              <label
                htmlFor="logradouro"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Logradouro / Rua
              </label>
              <input
                id="logradouro"
                type="text"
                name="logradouro"
                value={form.logradouro}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Número */}
            <div>
              <label
                htmlFor="numero"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Número
              </label>
              <input
                id="numero"
                type="text"
                name="numero"
                value={form.numero}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Complemento */}
            <div>
              <label
                htmlFor="complemento"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Complemento
              </label>
              <input
                id="complemento"
                type="text"
                name="complemento"
                value={form.complemento}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 2.5fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Cidade */}
            <div>
              <label
                htmlFor="cidade"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Cidade
              </label>
              <input
                id="cidade"
                type="text"
                name="cidade"
                value={form.cidade}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* UF */}
            <div>
              <label
                htmlFor="uf"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                UF
              </label>
              <input
                id="uf"
                type="text"
                name="uf"
                value={form.uf}
                onChange={handleChange}
                maxLength={2}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  textTransform: "uppercase",
                }}
              />
            </div>

            {/* Ponto de Referência */}
            <div>
              <label
                htmlFor="pontoReferencia"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Ponto de Referência
              </label>
              <input
                id="pontoReferencia"
                type="text"
                name="pontoReferencia"
                value={form.pontoReferencia}
                onChange={handleChange}
                placeholder="Próximo ao mercado X..."
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
            </div>
          </div>

          <div className={styles.formSectionTitle}>Informações do Incidente</div>

          {/* Descrição do Cão e Causou Risco lado a lado */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Descrição do Cão */}
            <div>
              <label
                htmlFor="descricaoCao"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                {rotulos.descricao}
              </label>
              <input
                id="descricaoCao"
                type="text"
                name="descricaoCao"
                value={form.descricaoCao}
                onChange={handleChange}
                required
                placeholder={rotulos.descricaoPlaceholder}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Cão mordeu/causou risco */}
            <div>
              <label
                htmlFor="causouRisco"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Cão mordeu/causou risco? *
              </label>
              <select
                id="causouRisco"
                name="causouRisco"
                value={form.causouRisco}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  backgroundColor: "white",
                }}
              >
                <option value="Não">Não</option>
                <option value="Sim">Sim</option>
              </select>
            </div>
          </div>

          {/* Relato */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="relato"
              style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
            >
              Relato *
            </label>
            <textarea
              id="relato"
              name="relato"
              value={form.relato}
              onChange={handleChange}
              required
              rows={5}
              placeholder="Descreva detalhadamente o que ocorreu..."
              style={{
                width: "100%",
                padding: "0.6rem 0.85rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.875rem",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={salvando}
              style={{
                backgroundColor: salvando ? "#94a3b8" : "#10b981",
                color: "white",
                padding: "0.75rem 2rem",
                border: "none",
                borderRadius: "8px",
                cursor: salvando ? "not-allowed" : "pointer",
                fontSize: "0.875rem",
                fontWeight: "600",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!salvando) e.target.style.backgroundColor = "#059669";
              }}
              onMouseLeave={(e) => {
                if (!salvando) e.target.style.backgroundColor = "#10b981";
              }}
            >
              {salvando ? "Salvando..." : rotulos.botao}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
