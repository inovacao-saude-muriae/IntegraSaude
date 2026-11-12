"use client";

import { useState } from "react";
import styles from "./ListaEspera.module.css";
import BotaoEditar from "@/components/BotaoEditar";
import { STATUS_COMUNICACAO } from "./constants";

// Lista padrão de segurança para garantir a exibição dos botões
const DEFAULT_TIPOS_EXAME = [
  { id: "1", nome: "Ressonância Magnética" },
  { id: "2", nome: "Tomografia Computadorizada" },
  { id: "3", nome: "Cintilografia" },
];

export default function ListaEspera({
  auxData,
  requests,
  selectedQueueExam,
  setSelectedQueueExam,
  applyFilters,
  handleUpdateCommunicationDate,
  handleUpdateCommunicationStatus,
  handleOpenReleaseModal,
  handleEditOrder,
  handleExportToExcelWaiting = () => {},
  handleCancelOrder = null,
  handleDeleteOrder = null,
  podeExcluir = false,
  podeCancelar = false,
  loading,
}) {
  const [selectedIds, setSelectedIds] = useState([]);

  // Garante que a lista de tipos de exames nunca fique undefined
  const tiposExameLista =
    auxData?.tiposExame && auxData.tiposExame.length > 0
      ? auxData.tiposExame
      : DEFAULT_TIPOS_EXAME;

  // 1. Encontra o objeto do exame selecionado nas auxiliares
  const selectedTypeObj = tiposExameLista.find(
    (t) =>
      t.nome?.toLowerCase().trim() === selectedQueueExam?.toLowerCase().trim() ||
      String(t.id) === String(selectedQueueExam)
  );

  // 2. Filtra estritamente por Status "Aguardando" E pelo Tipo de Exame ativo
  const baseWaiting = (requests || []).filter((item) => {
    if (item.status !== "Aguardando") return false;
    if (!selectedQueueExam) return true;

    if (selectedTypeObj && item.examTypeId) {
      return String(item.examTypeId) === String(selectedTypeObj.id);
    }

    if (item.examType && selectedTypeObj) {
      return item.examType.toLowerCase().trim() === selectedTypeObj.nome.toLowerCase().trim();
    }

    return true;
  });

  // 3. Aplica os filtros avançados
  const waitingList =
    typeof applyFilters === "function"
      ? applyFilters(baseWaiting).filter((item) => {
          if (!selectedTypeObj) return true;
          if (item.examTypeId) {
            return String(item.examTypeId) === String(selectedTypeObj.id);
          }
          return (
            String(item.examType || "").toLowerCase().trim() ===
            selectedTypeObj.nome.toLowerCase().trim()
          );
        })
      : baseWaiting;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(waitingList.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const getRiskClass = (classification) => {
    switch (classification) {
      case "Vermelho":
        return styles.riskRed;
      case "Amarelo":
        return styles.riskYellow;
      default:
        return styles.riskGreen;
    }
  };

  return (
    <div className={styles.container}>
      {/* CABEÇALHO E RESUMO DA FILA */}
      <div className={styles.tableHeaderBar}>
        <div className={styles.infoGroup}>
          <h3>
            Fila de Espera: <span>{selectedQueueExam || "Todos"}</span>
          </h3>
          <p>
            Total aguardando: <strong>{waitingList.length}</strong> paciente(s)
          </p>
        </div>

        <button
          type="button"
          className={styles.exportBtn}
          onClick={() => handleExportToExcelWaiting(selectedIds)}
          disabled={selectedIds.length === 0}
        >
          📊 Exportar Selecionados ({selectedIds.length}) para Excel
        </button>
      </div>

      {/* TABELA DE DADOS */}
      {loading ? (
        <div className={styles.loadingState}>Carregando fila de espera...</div>
      ) : waitingList.length === 0 ? (
        <div className={styles.emptyState}>
          Nenhum paciente aguardando na fila para <strong>{selectedQueueExam}</strong>.
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      waitingList.length > 0 &&
                      selectedIds.length === waitingList.length
                    }
                  />
                </th>
                <th>Cód. Reg.</th>
                <th>Paciente</th>
                <th>Procedimento</th>
                <th>Data Pedido</th>
                <th>Avisado Em</th>
                <th>Status Com.</th>
                <th style={{ textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {waitingList.map((item) => {
                const isSelected = selectedIds.includes(item.id);

                return (
                  <tr
                    key={item.id}
                    className={isSelected ? styles.selectedRow : ""}
                  >
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(item.id)}
                      />
                    </td>
                    <td>
                      <strong>{item.id}</strong>
                    </td>
                    <td>
                      <div className={styles.patientHeader}>
                        <span className={styles.patientName}>
                          {item.patientName}
                        </span>
                        <span
                          className={`${styles.riskTag} ${getRiskClass(
                            item.classification
                          )}`}
                        >
                          {item.classification || "Verde"}
                        </span>
                      </div>
                      <small className={styles.subText}>
                        Mãe: {item.motherName || "Não informada"}
                      </small>
                    </td>
                    <td>{item.procedure}</td>
                    <td>{item.requestDate || "—"}</td>
                    <td>
                      <input
                        type="date"
                        className={styles.dateInput}
                        value={item.communicationDate || ""}
                        onChange={(e) =>
                          handleUpdateCommunicationDate(item.id, e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={item.communicationStatus || ""}
                        onChange={(e) =>
                          handleUpdateCommunicationStatus(item.id, e.target.value)
                        }
                      >
                        <option value="">— Selecionar —</option>
                        {STATUS_COMUNICACAO.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className={styles.actionsCell}>
                      <button
                        type="button"
                        className={styles.releaseBtn}
                        onClick={() => handleOpenReleaseModal(item)}
                      >
                        Liberar
                      </button>
                      <BotaoEditar
                        onClick={() => handleEditOrder(item, "LISTA_ESPERA")}
                        title="Editar Pedido"
                      />
                      {podeCancelar && handleCancelOrder && (
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => handleCancelOrder(item)}
                          title="Cancelar o pedido (preserva o histórico)"
                        >
                          Cancelar
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          type="button"
                          className={styles.excluirBtn}
                          onClick={() => handleDeleteOrder(item)}
                          title="Excluir definitivamente (permissão excepcional)"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}