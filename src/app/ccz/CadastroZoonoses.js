"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CadastroTutor.module.css";
import { useNotify } from "@/components/ConfirmDialog";
import { salvarZoonose, buscarAnimaisCCZ } from "./actions";

const FORM_VAZIO = {
  animalId: "",
  doenca: "",
  dataIdentificacao: "",
  grauRisco: "",
  riscoVida: "",
  formasContaminacao: "",
  solicitacaoAcompanhamento: "",
  dataAgendamento: "",
  responsavelMonitoramento: "",
  observacao: "",
};

export default function CadastroZoonoses({ registroInicial = null, onSalvo }) {
  const notify = useNotify();

  const editando = Boolean(registroInicial?.id);
  const [form, setForm] = useState(registroInicial ? { ...FORM_VAZIO, ...registroInicial } : FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Busca de animal
  const [animalNome, setAnimalNome] = useState(registroInicial?.animalNome || "");
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
  };

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Limpar data de agendamento se solicitação for "Não"
    if (name === "solicitacaoAcompanhamento" && value === "Não") {
      setForm((prev) => ({ ...prev, dataAgendamento: "" }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    if (!form.animalId) {
      setErro("Selecione um animal");
      return;
    }

    setSalvando(true);
    const resultado = await salvarZoonose(form);
    setSalvando(false);

    if (resultado.sucesso) {
      await notify({
        tipo: "sucesso",
        title: "Sucesso",
        message: editando 
          ? "Zoonose atualizada com sucesso!" 
          : "Zoonose cadastrada com sucesso!",
      });
      
      if (editando && typeof onSalvo === "function") {
        onSalvo();
      } else {
        // Limpar formulário apenas se for novo cadastro
        setForm(FORM_VAZIO);
        setAnimalNome("");
      }
    } else {
      setErro(resultado.erro || "Erro ao salvar zoonose");
    }
  }

  return (
    <div className={styles.container}>
      {erro && <div className={styles.alertErro}>{erro}</div>}

      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          {/* Animal */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="animalNome"
              style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
            >
              Animal *
            </label>
            <div style={{ position: "relative" }} ref={animaisDropRef}>
              <div className={styles.inputWrapperWithIcon}>
                <input
                  id="animalNome"
                  type="text"
                  value={animalNome}
                  onChange={(e) => buscarAnimal(e.target.value)}
                  placeholder="Digite o nome, ID ou espécie do animal"
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
          </div>

          <div className={styles.formSectionTitle}>Dados da Doença</div>

          {/* Grid para Nome da Doença e Data lado a lado */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Nome da Doença */}
            <div>
              <label
                htmlFor="doenca"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Nome da Doença *
              </label>
              <input
                id="doenca"
                type="text"
                name="doenca"
                value={form.doenca}
                onChange={handleChange}
                required
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Data de Identificação */}
            <div>
              <label
                htmlFor="dataIdentificacao"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Data de Identificação *
              </label>
              <input
                id="dataIdentificacao"
                type="date"
                name="dataIdentificacao"
                value={form.dataIdentificacao}
                onChange={handleChange}
                required
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

          <div className={styles.formSectionTitle}>Avaliação de Risco</div>

          {/* Grid para Grau de Risco e Risco de Vida lado a lado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Grau de Risco */}
            <div>
              <label
                htmlFor="grauRisco"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Grau de Risco de Contaminação *
              </label>
              <select
                id="grauRisco"
                name="grauRisco"
                value={form.grauRisco}
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
                <option value="">Selecione</option>
                <option value="Baixo">Baixo</option>
                <option value="Moderado">Moderado</option>
                <option value="Alto">Alto</option>
                <option value="Crítico">Crítico</option>
              </select>
            </div>

            {/* Risco de Vida */}
            <div>
              <label
                htmlFor="riscoVida"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Risco de Vida *
              </label>
              <select
                id="riscoVida"
                name="riscoVida"
                value={form.riscoVida}
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
                <option value="">Selecione</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>
          </div>

          {/* Formas de Contaminação */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="formasContaminacao"
              style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
            >
              Formas de Contaminação *
            </label>
            <textarea
              id="formasContaminacao"
              name="formasContaminacao"
              value={form.formasContaminacao}
              onChange={handleChange}
              required
              rows={3}
              placeholder="Descreva as principais formas de transmissão da doença..."
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

          <div className={styles.formSectionTitle}>Monitoramento</div>

          {/* Grid para Acompanhamento e Data (se Sim) */}
          <div style={{ display: "grid", gridTemplateColumns: form.solicitacaoAcompanhamento === "Sim" ? "1fr 1fr" : "1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Solicitação de Acompanhamento */}
            <div>
              <label
                htmlFor="solicitacaoAcompanhamento"
                style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
              >
                Solicitação de Acompanhamento *
              </label>
              <select
                id="solicitacaoAcompanhamento"
                name="solicitacaoAcompanhamento"
                value={form.solicitacaoAcompanhamento}
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
                <option value="">Selecione</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>

            {/* Data de Agendamento - Condicional */}
            {form.solicitacaoAcompanhamento === "Sim" && (
              <div>
                <label
                  htmlFor="dataAgendamento"
                  style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
                >
                  Data para Agenda *
                </label>
                <input
                  id="dataAgendamento"
                  type="date"
                  name="dataAgendamento"
                  value={form.dataAgendamento}
                  onChange={handleChange}
                  required={form.solicitacaoAcompanhamento === "Sim"}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
            )}
          </div>

          {/* Responsável pelo Monitoramento */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="responsavelMonitoramento"
              style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
            >
              Responsável pelo Monitoramento *
            </label>
            <input
              id="responsavelMonitoramento"
              type="text"
              name="responsavelMonitoramento"
              value={form.responsavelMonitoramento}
              onChange={handleChange}
              required
              placeholder="Nome do profissional responsável pelo acompanhamento"
              style={{
                width: "100%",
                padding: "0.6rem 0.85rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div className={styles.formSectionTitle}>Observações Adicionais</div>

          {/* Observações */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="observacao"
              style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#334155" }}
            >
              Observações
            </label>
            <textarea
              id="observacao"
              name="observacao"
              value={form.observacao}
              onChange={handleChange}
              rows={4}
              placeholder="Informações complementares sobre o caso..."
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
                backgroundColor: salvando ? "#94a3b8" : "#2563eb",
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
                if (!salvando) e.target.style.backgroundColor = "#1d4ed8";
              }}
              onMouseLeave={(e) => {
                if (!salvando) e.target.style.backgroundColor = "#2563eb";
              }}
            >
              {salvando ? "Salvando..." : "Cadastrar Notificação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
