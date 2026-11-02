"use client";

import { useState, useEffect } from "react";
import styles from "./LiberarPedido.module.css";
import ModalSeletorCotas from "./Modals/ModalSeletorCotas";
import ModalConfirmacaoExclusao from "./Modals/ModalConfirmacaoExclusao";

export default function LiberarPedido({
  releasingItem,
  regulationForm,
  setRegulationForm,
  auxData,
  handleSelectQuotaType,
  handleReleaseDateChange,
  handleConfirmRelease,
  onBack,
  showQuotaModal,
  setShowQuotaModal,
  quotaModalType,
  quotaModalYear,
  setQuotaModalYear,
  handleSelectMonthFromModal,
  calculateMonthQuotaDetails,
}) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Alerta nativo ao tentar fechar ou atualizar a aba (F5) com alterações pendentes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "Existem informações não salvas. Deseja realmente sair?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Se a página for recarregada e perder o objeto do pedido em memória, volta para a Fila
  useEffect(() => {
    if (!releasingItem && typeof onBack === "function") {
      onBack();
    }
  }, [releasingItem, onBack]);

  if (!releasingItem) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDirty(false);

    if (handleConfirmRelease) {
      await handleConfirmRelease(e);
    }
  };

  const handleAttemptLeave = () => {
    if (isDirty) {
      setShowCancelModal(true);
    } else {
      onBack();
    }
  };

  return (
    <div className={styles.card}>
      {/* MODAL CUSTOMIZADO DO SISTEMA */}
      <ModalConfirmacaoExclusao
        config={
          showCancelModal
            ? {
                tipo: "PEDIDO",
                nome: `Cancelar Liberação do Paciente ${releasingItem.patientName}`,
                detalhe: `Pedido #${releasingItem.id} - ${releasingItem.procedure || ""}`,
                mensagemWarning: "As alterações feitas nesta tela serão perdidas.",
                confirmText: "Sim, Voltar para Fila",
                cancelText: "Continuar Editando",
              }
            : null
        }
        onConfirm={() => {
          setIsDirty(false);
          setShowCancelModal(false);
          onBack();
        }}
        onCancel={() => setShowCancelModal(false)}
      />

      {/* MODAL SELETOR DE COMPETÊNCIA DA COTA */}
      {showQuotaModal && (
        <ModalSeletorCotas
          open={showQuotaModal}
          onClose={() => setShowQuotaModal(false)}
          tipoCota={quotaModalType}
          anoAtual={quotaModalYear}
          setAnoAtual={setQuotaModalYear}
          onSelectMonth={handleSelectMonthFromModal}
          calculateMonthQuotaDetails={calculateMonthQuotaDetails}
          defaultMonth={regulationForm.quotaCompetenceMonth}
        />
      )}

      {/* CABEÇALHO DA TELA */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>
            Liberar Exame do Paciente: {releasingItem.patientName}
          </h2>
          <p className={styles.subtitle}>
            Código de Regulação: <strong>#{releasingItem.id}</strong> | Data de Entrada:{" "}
            {releasingItem.requestDate}
          </p>
        </div>

        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={handleAttemptLeave}
        >
          ← Voltar para a Fila
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.patientFormContainer}>
        {/* SEÇÃO 1: INFORMAÇÕES DO PEDIDO (CONSULTA) */}
        <div className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h4>1. Informações do Pedido (Consulta)</h4>
          </div>

          <div className={styles.formGridStrict}>
            <div className={`${styles.fieldGroup} ${styles.colNameCompact}`}>
              <label>Nome do Paciente</label>
              <input type="text" value={releasingItem.patientName || ""} disabled readOnly />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colCpfCompact}`}>
              <label>CPF</label>
              <input type="text" value={releasingItem.cpf || ""} disabled readOnly />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colMotherCompact}`}>
              <label>Nome da Mãe</label>
              <input
                type="text"
                value={releasingItem.motherName || "Não informada"}
                disabled
                readOnly
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colProcedureCompact}`}>
              <label>Procedimento / Exame</label>
              <input
                type="text"
                value={`${releasingItem.procedure || ""} (R$ ${Number(releasingItem.estimatedCost || 0).toFixed(2)})`}
                disabled
                readOnly
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colRiskCompact}`}>
              <label>Classificação de Risco</label>
              <input type="text" value={releasingItem.classification || "Verde"} disabled readOnly />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colDoctorCompact}`}>
              <label>Médico Solicitante</label>
              <input
                type="text"
                value={releasingItem.requestDoctor || "Não informado"}
                disabled
                readOnly
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colUbsCompact}`}>
              <label>UBS Solicitante</label>
              <input
                type="text"
                value={releasingItem.requestUbs || "Não informada"}
                disabled
                readOnly
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
              <label>Justificativa Clínica Inicial</label>
              <textarea
                rows={2}
                value={releasingItem.justification || "Sem justificativa cadastrada."}
                disabled
                readOnly
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: DADOS DA AUTORIZAÇÃO E COTA */}
        <div className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h4>2. Dados da Autorização e Cota</h4>
          </div>

          <div className={styles.formGridStrict}>
            <div className={`${styles.fieldGroup} ${styles.colStatusCompact}`}>
              <label>Status do Pedido *</label>
              <select
                value={regulationForm.status}
                onChange={(e) => {
                  setIsDirty(true);
                  setRegulationForm({ ...regulationForm, status: e.target.value });
                }}
                required
              >
                <option value="Liberado">Liberado</option>
                <option value="Aguardando">Aguardando (Manter na Fila)</option>
                <option value="Cancelado">Cancelado</option>
                <option value="Devolvido">Devolvido</option>
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colRiskCompact}`}>
              <label>Tipo de Cota *</label>
              <select
                value={regulationForm.quota}
                onChange={(e) => {
                  setIsDirty(true);
                  handleSelectQuotaType(e.target.value);
                }}
                required
              >
                <option value="">-- Selecione a Cota --</option>
                <option value="CREDENCIAMENTO">CREDENCIAMENTO</option>
                <option value="OCI">OCI</option>
                <option value="SUS">SUS</option>
                <option value="PPI">PPI (Debita no SUS)</option>
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colCpfCompact}`}>
              <label>Data de Liberação *</label>
              <input
                type="date"
                value={regulationForm.releaseDate}
                onChange={(e) => {
                  setIsDirty(true);
                  handleReleaseDateChange(e.target.value);
                }}
                required
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.colNameCompact}`}>
              <label>Médico Regulador / Responsável</label>
              <select
                value={regulationForm.regulatorDoctorId}
                onChange={(e) => {
                  setIsDirty(true);
                  setRegulationForm({ ...regulationForm, regulatorDoctorId: e.target.value });
                }}
              >
                <option value="">-- Selecione o Médico Regulador --</option>
                {auxData.medicos
                  ?.filter((m) => m.tipo === "Regulador")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} (CRM: {m.crm})
                    </option>
                  ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colCpfCompact}`}>
              <label htmlFor="communicationDate">Data de Comunicação</label>
              <input
                type="date"
                id="communicationDate"
                value={regulationForm.communicationDate || ""}
                onChange={(e) => {
                  setIsDirty(true);
                  setRegulationForm((prev) => ({
                    ...prev,
                    communicationDate: e.target.value,
                  }));
                }}
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
              <label htmlFor="generalObservation">Observação Geral da Regulação</label>
              <textarea
                id="generalObservation"
                rows={2}
                placeholder="Digite as observações específicas sobre esta liberação..."
                value={regulationForm.generalObservation || ""}
                onChange={(e) => {
                  setIsDirty(true);
                  setRegulationForm((prev) => ({
                    ...prev,
                    generalObservation: e.target.value,
                  }));
                }}
              />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleAttemptLeave}
          >
            Cancelar
          </button>
          <button type="submit" className={styles.updateBtn}>
            Confirmar Liberação
          </button>
        </div>
      </form>
    </div>
  );
}