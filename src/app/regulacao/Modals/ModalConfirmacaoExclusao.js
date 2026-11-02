"use client";

import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import styles from "./ModalConfirmacaoExclusao.module.css";

export default function ModalConfirmacaoExclusao({
  config,
  onConfirm,
  onCancel,
}) {
  const { modalRef } = useModalKeyboard(!!config, onCancel);
  
  if (!config) return null;

  const iconMap = {
    PESSOA: "👤",
    MEDICO: "👨‍⚕️",
    UBS: "🏥",
    PEDIDO: "📋",
    PROCEDIMENTO: "🩺",
    SERVICO: "🗂️",
    ESPECIALIDADE: "🩺",
  };

  const colorMap = {
    PESSOA: styles.tagPaciente,
    MEDICO: styles.tagMedico,
    UBS: styles.tagUbs,
    PEDIDO: styles.tagPedido,
    PROCEDIMENTO: styles.tagMedico,
    SERVICO: styles.tagUbs,
    ESPECIALIDADE: styles.tagMedico,
  };

  const labelMap = {
    PESSOA: "Paciente",
    MEDICO: "Médico",
    UBS: "Unidade de Saúde",
    PEDIDO: "Pedido de Regulação",
    PROCEDIMENTO: "Procedimento",
    SERVICO: "Serviço",
    ESPECIALIDADE: "Especialidade",
  };

  const icon = iconMap[config.tipo] ?? "⚠️";
  const tagClass = colorMap[config.tipo] ?? "";
  const label = labelMap[config.tipo] ?? "Atenção";

  return (
    <div className={styles.overlay}>
      <div ref={modalRef} className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.itemCard}>
          <span className={`${styles.tag} ${tagClass}`}>
            {icon} {label}
          </span>
          <p id="modal-title" className={styles.itemName}>{config.nome}</p>
          {config.detalhe && (
            <p className={styles.itemDetalhe}>{config.detalhe}</p>
          )}
        </div>

        <p className={styles.warning}>
          ⚠️ {config.mensagemWarning || "Esta ação não pode ser desfeita."}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {config.cancelText || "Cancelar"}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
          >
            {config.confirmText || "Sim, Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}