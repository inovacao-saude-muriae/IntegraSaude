"use client";

import { useState } from "react";
import styles from "./EditarPedido.module.css";
import { useUnsavedChanges } from "./hooks/useUnsavedChanges";
import { STATUS_COMUNICACAO } from "./constants";

const MESES_COMPETENCIA = [
  { value: "01", name: "Jan" },
  { value: "02", name: "Fev" },
  { value: "03", name: "Mar" },
  { value: "04", name: "Abr" },
  { value: "05", name: "Mai" },
  { value: "06", name: "Jun" },
  { value: "07", name: "Jul" },
  { value: "08", name: "Ago" },
  { value: "09", name: "Set" },
  { value: "10", name: "Out" },
  { value: "11", name: "Nov" },
  { value: "12", name: "Dez" },
];

const _anoAtual = new Date().getFullYear();
const ANOS_COMPETENCIA = [
  String(_anoAtual - 1),
  String(_anoAtual),
  String(_anoAtual + 1),
  String(_anoAtual + 2),
];

export default function EditarPedido({
  editingItem,
  setEditingItem,
  auxData,
  editOrigin,
  handleEditStatusChange,
  handleSaveEditedOrder,
  onBack,
}) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Protege a navegação e recarregamento da página (F5) caso haja alterações pendentes
  useUnsavedChanges(isDirty);

  if (!editingItem) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsDirty(false); // Desativa a proteção para permitir o envio normal do formulário
    if (handleSaveEditedOrder) {
      await handleSaveEditedOrder(e);
    }
    setShowSuccessModal(true);
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    onBack();
  };

  const handleCancel = () => {
    if (isDirty && !confirm("Existem alterações não salvas. Deseja realmente voltar para a fila?")) {
      return;
    }
    onBack();
  };

  return (
    <div className={styles.card}>
      {/* MODAL ELEGANTE DE SUCESSO */}
      {showSuccessModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalIconWrapper}>
              <div className={styles.modalIcon}>✓</div>
            </div>

            <h3 className={styles.modalTitle}>Alteração Realizada!</h3>
            <p className={styles.modalDescription}>
              As informações do pedido <strong>#{editingItem.id}</strong> do paciente{" "}
              <strong>{editingItem.patientName}</strong> foram atualizadas com sucesso.
            </p>

            <button
              type="button"
              className={styles.modalConfirmBtn}
              onClick={handleCloseSuccessModal}
            >
              Voltar para a Fila
            </button>
          </div>
        </div>
      )}

      {/* CABEÇALHO DA TELA */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>
            Editar Pedido de Regulação #{editingItem.id}
          </h2>
          <p className={styles.subtitle}>
            Alteração de status, procedimentos e dados da solicitação médica
          </p>
        </div>

        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={handleCancel}
        >
          ← Voltar para a Fila
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.patientFormContainer}>
        {/* SEÇÃO 1: IDENTIFICAÇÃO DO PACIENTE (SOMENTE LEITURA) */}
        <div className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h4>1. Identificação do Paciente (Consulta)</h4>
          </div>

          <div className={styles.formGridStrict}>
            <div className={`${styles.fieldGroup} ${styles.colName}`}>
              <label>Nome do Paciente</label>
              <input
                type="text"
                value={editingItem.patientName || ""}
                disabled
                readOnly
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colMother}`}>
              <label>Nome da Mãe</label>
              <input
                type="text"
                value={editingItem.motherName || "Não informada"}
                disabled
                readOnly
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colCpf}`}>
              <label>CPF</label>
              <input
                type="text"
                value={editingItem.cpf || ""}
                disabled
                readOnly
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colSus}`}>
              <label>Cartão SUS</label>
              <input
                type="text"
                value={editingItem.susCard || "Não informado"}
                disabled
                readOnly
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: DADOS DO EXAME E SOLICITAÇÃO (EDITÁVEL) */}
        <div className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h4>2. Detalhes do Exame e Solicitação</h4>
          </div>

          <div className={styles.formGridStrict}>
            <div className={`${styles.fieldGroup} ${styles.colStatus}`}>
              <label>Status do Pedido *</label>
              <select
                value={editingItem.status || "Aguardando"}
                onChange={(e) => {
                  setIsDirty(true);
                  handleEditStatusChange(e.target.value);
                }}
                required
              >
                <option value="Aguardando">Aguardando (Volta para Fila)</option>
                <option value="Liberado">Liberado</option>
                <option value="Cancelado">Cancelado</option>
                <option value="Devolvido">Devolvido</option>
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colProcedure}`}>
              <label>Procedimento / Exame *</label>
              <select
                value={editingItem.procedureId || ""}
                onChange={(e) => {
                  setIsDirty(true);
                  const procId = Number(e.target.value);
                  const foundProc = auxData.procedimentos?.find((p) => p.id === procId);
                  setEditingItem({
                    ...editingItem,
                    procedureId: procId,
                    procedure: foundProc ? foundProc.nome : editingItem.procedure,
                    estimatedCost: foundProc ? foundProc.valor : editingItem.estimatedCost,
                  });
                }}
                required
              >
                <option value="">-- Selecione o Procedimento --</option>
                {(auxData.procedimentos || [])
                  // Só oferece procedimento operacionalmente disponível; o que
                  // está no pedido continua na lista para não perder o vínculo.
                  .filter((p) => p.disponivel !== false || p.id === editingItem.procedureId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (R$ {Number(p.valor).toFixed(2)})
                      {p.disponivel === false ? " (indisponível)" : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colRisk}`}>
              <label>Classificação de Risco *</label>
              <select
                value={editingItem.classification || "Verde"}
                onChange={(e) => {
                  setIsDirty(true);
                  setEditingItem({ ...editingItem, classification: e.target.value });
                }}
                required
              >
                <option value="Verde">Verde (Eletivo)</option>
                <option value="Amarelo">Amarelo (Prioritário)</option>
                <option value="Vermelho">Vermelho (Urgente)</option>
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colDoctor}`}>
              <label>Médico Solicitante</label>
              <select
                value={editingItem.requestDoctorId ? String(editingItem.requestDoctorId) : ""}
                onChange={(e) => {
                  setIsDirty(true);
                  setEditingItem({ ...editingItem, requestDoctorId: e.target.value });
                }}
              >
                <option value="">-- Selecione o Médico Solicitante --</option>
                {auxData.medicos
                  ?.filter((m) => m.tipo === "Solicitante")
                  .map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.nome} (CRM: {m.crm})
                    </option>
                  ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colUbs}`}>
              <label>UBS Solicitante</label>
              <select
                value={editingItem.requestUbsId ? String(editingItem.requestUbsId) : ""}
                onChange={(e) => {
                  setIsDirty(true);
                  setEditingItem({ ...editingItem, requestUbsId: e.target.value });
                }}
              >
                <option value="">-- Selecione a UBS --</option>
                {auxData.ubsList?.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.nome} (CNES: {u.cnes})
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
              <label htmlFor="justification">Justificativa do Pedido (Quadro Clínico)</label>
              <textarea
                id="justification"
                rows={3}
                value={editingItem.justification || editingItem.observacao || ""}
                onChange={(e) => {
                  setIsDirty(true);
                  setEditingItem({
                    ...editingItem,
                    justification: e.target.value,
                    observacao: e.target.value,
                  });
                }}
                placeholder="Descreva a justificativa médica e o quadro clínico do paciente..."
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: DADOS DA AUTORIZAÇÃO (para pedidos liberados) */}
        {(editOrigin === "LIBERADOS" || editingItem.status === "Liberado") && (
          <div className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <h4>3. Dados da Autorização</h4>
            </div>

            <div className={styles.formGridStrict}>
              <div className={`${styles.fieldGroup} ${styles.colRisk}`}>
                <label>Tipo de Cota</label>
                <select
                  value={editingItem.quota || ""}
                  onChange={(e) => {
                    setIsDirty(true);
                    setEditingItem({ ...editingItem, quota: e.target.value });
                  }}
                >
                  <option value="">-- Selecione a Cota --</option>
                  <option value="CREDENCIAMENTO">CREDENCIAMENTO</option>
                  <option value="OCI">OCI</option>
                  <option value="SUS">SUS</option>
                  <option value="PPI">PPI (Debita no SUS)</option>
                </select>
              </div>

              {/* Competência da cota: aparece após selecionar a cota.
                  É a partir dela que o débito do financeiro é feito. */}
              {editingItem.quota && (
                <>
                  <div className={`${styles.fieldGroup} ${styles.colRisk}`}>
                    <label>Mês da Competência *</label>
                    <select
                      value={editingItem.quotaCompetenceMonth || ""}
                      onChange={(e) => {
                        setIsDirty(true);
                        setEditingItem({ ...editingItem, quotaCompetenceMonth: e.target.value });
                      }}
                    >
                      <option value="">-- Mês --</option>
                      {MESES_COMPETENCIA.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.name} ({m.value})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`${styles.fieldGroup} ${styles.colRisk}`}>
                    <label>Ano da Competência *</label>
                    <select
                      value={editingItem.quotaCompetenceYear || ""}
                      onChange={(e) => {
                        setIsDirty(true);
                        setEditingItem({ ...editingItem, quotaCompetenceYear: e.target.value });
                      }}
                    >
                      <option value="">-- Ano --</option>
                      {ANOS_COMPETENCIA.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className={`${styles.fieldGroup} ${styles.colCpf}`}>
                <label>Data de Liberação</label>
                <input
                  type="date"
                  value={editingItem.releaseDateRaw || ""}
                  onChange={(e) => {
                    setIsDirty(true);
                    setEditingItem({
                      ...editingItem,
                      releaseDate: e.target.value,
                      releaseDateRaw: e.target.value,
                    });
                  }}
                />
              </div>

              <div className={`${styles.fieldGroup} ${styles.colDoctor}`}>
                <label>Médico Regulador / Responsável</label>
                <select
                  value={editingItem.regulatorDoctorId ? String(editingItem.regulatorDoctorId) : ""}
                  onChange={(e) => {
                    setIsDirty(true);
                    setEditingItem({ ...editingItem, regulatorDoctorId: e.target.value });
                  }}
                >
                  <option value="">-- Selecione o Médico Regulador --</option>
                  {auxData.medicos
                    ?.filter((m) => m.tipo === "Regulador")
                    .map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.nome} (CRM: {m.crm})
                      </option>
                    ))}
                </select>
              </div>

              <div className={`${styles.fieldGroup} ${styles.colCpf}`}>
                <label>Data de Comunicação</label>
                <input
                  type="date"
                  value={editingItem.communicationDate || ""}
                  onChange={(e) => {
                    setIsDirty(true);
                    setEditingItem({ ...editingItem, communicationDate: e.target.value });
                  }}
                />
              </div>

              <div className={`${styles.fieldGroup} ${styles.colDoctor}`}>
                <label>Status da Comunicação</label>
                <select
                  value={editingItem.communicationStatus || ""}
                  onChange={(e) => {
                    setIsDirty(true);
                    setEditingItem({ ...editingItem, communicationStatus: e.target.value });
                  }}
                >
                  <option value="">-- Selecione --</option>
                  {STATUS_COMUNICACAO.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                <label htmlFor="generalObservation">Observação Geral da Regulação</label>
                <textarea
                  id="generalObservation"
                  rows={3}
                  value={editingItem.generalObservation || ""}
                  onChange={(e) => {
                    setIsDirty(true);
                    setEditingItem({
                      ...editingItem,
                      generalObservation: e.target.value,
                    });
                  }}
                  placeholder="Observações específicas sobre esta liberação..."
                />
              </div>
            </div>
          </div>
        )}

        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryBtn} onClick={handleCancel}>
            Cancelar
          </button>
          <button type="submit" className={styles.updateBtn}>
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}