"use client";

import { useState, useEffect } from "react";
import stylesModal from "./AgendaCCZ.module.css";
import stylesForm from "./CadastroAnimal.module.css";
import { useNotify } from "@/components/ConfirmDialog";
import { salvarRelatorioVisita, obterRelatorioVisita } from "./actions";

const hojeYMD = () => new Date().toISOString().split("T")[0];

const FORM_VAZIO = {
  visitaId: "",
  profissionalResponsavel: "",
  apresentaLesoes: "Não",
  descricaoLesoes: "",
  evolucaoQuadro: "Estável",
  emTratamento: "Sim",
  medicamentosAtuais: "",
  adesaoTratamento: "Boa",
  isolamentoAdequado: "Sim",
  usoEpiAdequado: "Sim",
  higienizacaoAdequada: "Sim",
  orientacoesRepassadas: "",
  observacoesGerais: "",
  necessidadeNovaVisita: "Sim",
  dataProximaVisita: "",
  encVeterinario: false,
  encNotificacao: false,
  encOutros: false,
  descricaoEncaminhamentos: "",
};

export default function RelatorioVisitaEsporotricose({
  visitaId,
  animalNome,
  tutorNome,
  dataVisita,
  onFechar,
  onSalvo,
}) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const notify = useNotify();

  useEffect(() => {
    if (!visitaId) return;
    
    const carregar = async () => {
      setCarregando(true);
      const res = await obterRelatorioVisita(visitaId);
      setCarregando(false);
      
      if (res.success && res.data) {
        setForm({ ...FORM_VAZIO, ...res.data });
      } else {
        setForm({ ...FORM_VAZIO, visitaId });
      }
    };
    
    carregar();
  }, [visitaId]);

  const atualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.profissionalResponsavel?.trim()) {
      notify("Informe o profissional responsável.", "warning");
      return;
    }

    setSalvando(true);
    const res = await salvarRelatorioVisita({ ...form, visitaId });
    setSalvando(false);

    if (res.success) {
      let mensagem = "Relatório salvo com sucesso!";
      
      // Se agendou automaticamente a próxima visita, informa ao usuário
      if (res.proximaVisitaAgendada) {
        const dataFormatada = res.proximaVisitaAgendada.split("-").reverse().join("/");
        mensagem += ` Próxima visita agendada para ${dataFormatada}.`;
      }
      
      notify(mensagem, "success");
      if (onSalvo) onSalvo();
      if (onFechar) onFechar();
    } else {
      notify(res.error || "Erro ao salvar relatório.", "error");
    }
  };

  if (carregando) {
    return (
      <div className={stylesModal.modalOverlay} onClick={onFechar}>
        <div className={stylesModal.modal} onClick={(e) => e.stopPropagation()}>
          <div className={stylesModal.modalHeader}>
            <h3 className={stylesModal.modalTitle}>Carregando relatório...</h3>
            <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={stylesModal.modalOverlay} onClick={onFechar}>
      <div
        className={stylesModal.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className={stylesModal.modalHeader}>
          <div>
            <h3 className={stylesModal.modalTitle}>
              Relatório de Acompanhamento · Esporotricose
            </h3>
            <p className={stylesModal.modalSubtitle}>
              Animal: {animalNome || "Sem nome"} | Tutor: {tutorNome || "Sem tutor"} | Visita: {dataVisita}
            </p>
          </div>
          <button type="button" className={stylesModal.modalClose} onClick={onFechar} disabled={salvando}>
            ✕
          </button>
        </div>

        <div className={stylesModal.modalBody}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Identificação */}
            <div>
              <h4 className={stylesForm.formSectionTitle}>Identificação</h4>
              <div className={stylesForm.grid}>
                <div className={stylesForm.field + " " + stylesForm.colFull}>
                  <label>
                    Profissional Responsável <span style={{color: "#ef4444"}}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.profissionalResponsavel}
                    onChange={(e) => atualizarCampo("profissionalResponsavel", e.target.value)}
                    maxLength={150}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Condição Clínica */}
            <div>
              <h4 className={stylesForm.formSectionTitle}>Condição Clínica Observada</h4>
              <div className={stylesForm.grid}>
                <div className={stylesForm.field + " " + stylesForm.colLg}>
                  <label>Apresenta lesões visíveis?</label>
                  <select value={form.apresentaLesoes} onChange={(e) => atualizarCampo("apresentaLesoes", e.target.value)}>
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div className={stylesForm.field + " " + stylesForm.colLg}>
                  <label>Evolução do quadro</label>
                  <select value={form.evolucaoQuadro || "Estável"} onChange={(e) => atualizarCampo("evolucaoQuadro", e.target.value)}>
                    <option value="Melhora">Melhora</option>
                    <option value="Estável">Estável</option>
                    <option value="Piora">Piora</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>
                {form.apresentaLesoes === "Sim" && (
                  <div className={stylesForm.field + " " + stylesForm.colFull}>
                    <label>Descrição das lesões</label>
                    <textarea
                      value={form.descricaoLesoes || ""}
                      onChange={(e) => atualizarCampo("descricaoLesoes", e.target.value)}
                      rows={3}
                      placeholder="Descreva a localização, tamanho, aspecto das lesões..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tratamento */}
            <div>
              <h4 className={stylesForm.formSectionTitle}>Tratamento Atual</h4>
              <div className={stylesForm.grid}>
                <div className={stylesForm.field + " " + stylesForm.colLg}>
                  <label>Animal está em tratamento?</label>
                  <select value={form.emTratamento} onChange={(e) => atualizarCampo("emTratamento", e.target.value)}>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div className={stylesForm.field + " " + stylesForm.colLg}>
                  <label>Adesão ao tratamento</label>
                  <select value={form.adesaoTratamento || "Boa"} onChange={(e) => atualizarCampo("adesaoTratamento", e.target.value)}>
                    <option value="Boa">Boa</option>
                    <option value="Regular">Regular</option>
                    <option value="Ruim">Ruim</option>
                    <option value="Não se aplica">Não se aplica</option>
                  </select>
                </div>
                {form.emTratamento === "Sim" && (
                  <div className={stylesForm.field + " " + stylesForm.colFull}>
                    <label>Medicamentos atuais</label>
                    <textarea
                      value={form.medicamentosAtuais || ""}
                      onChange={(e) => atualizarCampo("medicamentosAtuais", e.target.value)}
                      rows={2}
                      placeholder="Informe os medicamentos em uso, dosagens e frequência..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Manejo */}
            <div>
              <h4 className={stylesForm.formSectionTitle}>Manejo e Cuidados</h4>
              <div className={stylesForm.grid}>
                <div className={stylesForm.field + " " + stylesForm.colMd}>
                  <label>Isolamento adequado?</label>
                  <select value={form.isolamentoAdequado} onChange={(e) => atualizarCampo("isolamentoAdequado", e.target.value)}>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Parcial">Parcial</option>
                  </select>
                </div>
                <div className={stylesForm.field + " " + stylesForm.colMd}>
                  <label>Uso de EPI adequado?</label>
                  <select value={form.usoEpiAdequado} onChange={(e) => atualizarCampo("usoEpiAdequado", e.target.value)}>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Parcial">Parcial</option>
                  </select>
                </div>
                <div className={stylesForm.field + " " + stylesForm.colMd}>
                  <label>Higienização adequada?</label>
                  <select value={form.higienizacaoAdequada} onChange={(e) => atualizarCampo("higienizacaoAdequada", e.target.value)}>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Parcial">Parcial</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Orientações */}
            <div>
              <h4 className={stylesForm.formSectionTitle}>Orientações Fornecidas</h4>
              <div className={stylesForm.grid}>
                <div className={stylesForm.field + " " + stylesForm.colFull}>
                  <label>Orientações repassadas ao tutor</label>
                  <textarea
                    value={form.orientacoesRepassadas || ""}
                    onChange={(e) => atualizarCampo("orientacoesRepassadas", e.target.value)}
                    rows={3}
                    placeholder="Descreva as orientações sobre cuidados, tratamento, prevenção..."
                  />
                </div>
              </div>
            </div>

            {/* Avaliação */}
            <div>
              <h4 className={stylesForm.formSectionTitle}>Avaliação e Próximos Passos</h4>
              <div className={stylesForm.grid}>
                <div className={stylesForm.field + " " + stylesForm.colFull}>
                  <label>Observações gerais</label>
                  <textarea
                    value={form.observacoesGerais || ""}
                    onChange={(e) => atualizarCampo("observacoesGerais", e.target.value)}
                    rows={3}
                    placeholder="Avaliação geral da situação, condições ambientais, cooperação do tutor..."
                  />
                </div>
                <div className={stylesForm.field + " " + stylesForm.colLg}>
                  <label>Necessidade de nova visita?</label>
                  <select value={form.necessidadeNovaVisita} onChange={(e) => atualizarCampo("necessidadeNovaVisita", e.target.value)}>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                {form.necessidadeNovaVisita === "Sim" && (
                  <div className={stylesForm.field + " " + stylesForm.colLg}>
                    <label>Data sugerida para próxima visita</label>
                    <input
                      type="date"
                      value={form.dataProximaVisita || ""}
                      onChange={(e) => atualizarCampo("dataProximaVisita", e.target.value)}
                      min={hojeYMD()}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Encaminhamentos */}
            <div>
              <h4 className={stylesForm.formSectionTitle}>Encaminhamentos</h4>
              <div className={stylesForm.checkboxRow}>
                <label className={stylesForm.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.encVeterinario}
                    onChange={(e) => atualizarCampo("encVeterinario", e.target.checked)}
                  />
                  Encaminhamento para veterinário
                </label>
                <label className={stylesForm.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.encNotificacao}
                    onChange={(e) => atualizarCampo("encNotificacao", e.target.checked)}
                  />
                  Nova notificação/alerta
                </label>
                <label className={stylesForm.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.encOutros}
                    onChange={(e) => atualizarCampo("encOutros", e.target.checked)}
                  />
                  Outros encaminhamentos
                </label>
              </div>

              {(form.encVeterinario || form.encNotificacao || form.encOutros) && (
                <div className={stylesForm.grid} style={{marginTop: "0.75rem"}}>
                  <div className={stylesForm.field + " " + stylesForm.colFull}>
                    <label>Descrição dos encaminhamentos</label>
                    <textarea
                      value={form.descricaoEncaminhamentos || ""}
                      onChange={(e) => atualizarCampo("descricaoEncaminhamentos", e.target.value)}
                      rows={2}
                      placeholder="Detalhe os encaminhamentos necessários..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={onFechar}
                disabled={salvando}
                style={{
                  padding: "0.65rem 1.25rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  cursor: salvando ? "not-allowed" : "pointer",
                  opacity: salvando ? 0.5 : 1
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                style={{
                  padding: "0.65rem 1.25rem",
                  border: "1px solid #2563eb",
                  borderRadius: "8px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  cursor: salvando ? "not-allowed" : "pointer",
                  opacity: salvando ? 0.5 : 1
                }}
              >
                {salvando ? "Salvando..." : "Salvar Relatório"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
