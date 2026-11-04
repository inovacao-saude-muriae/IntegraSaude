"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";

import { useRegulacaoData } from "./hooks/useRegulacaoData";
import { useRegulacaoFilters } from "./hooks/useRegulacaoFilters";

import FiltersBar from "./FiltersBar";
import Dashboard from "./Dashboard";
import NovoPedido from "./NovoPedido";
import ListaEspera from "./ListaEspera";
import Liberados from "./Liberados";
import Financeiro from "./Financeiro";
import TelaLiberarPedido from "./LiberarPedido";
import TelaEditarPedido from "./EditarPedido";

import ModalTetoFinanceiro from "./Modals/ModalTetoFinanceiro";
import ModalSeletorCotas from "./Modals/ModalSeletorCotas";

import ProcedimentosTab from "./ProcedimentosTab";
import UsuariosTab from "./UsuariosTab";

import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { usePermissoesRegulacao } from "./PermissoesRegulacaoContext";

import styles from "./page.module.css";

// verificado: catálogo só em /gerenciamento (médicos/UBS/procedimentos). Esta
// página expõe apenas as abas DASHBOARD/NOVO_PEDIDO/LISTA_ESPERA/LIBERADOS/
// FINANCEIRO, sem UI de criar/editar catálogo embutida. Por isso a flag
// podeGerenciarCatalogo (RegulacaoPermProvider) não tem consumidor aqui nesta
// etapa — fica disponível para a Etapa 2 (design §6.2, Finding 5). O
// enforcement das actions de catálogo já está garantido em FEAT-003.

function RegulacaoPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Flag GESTOR injetada pelo servidor (layout.js) — mesma regra do
  // Gerenciamento para gerenciar usuários (fail-closed).
  const { podeGerenciarUsuarios } = usePermissoesRegulacao();

  const activeTab = searchParams.get("tab") || "DASHBOARD";

  const handleSetActiveTab = (tab, subTab) => {
    if (subTab) {
      router.push(`/regulacao?tab=${tab}&subTab=${subTab}`);
    } else {
      router.push(`/regulacao?tab=${tab}`);
    }
  };

  const data = useRegulacaoData((tab) => handleSetActiveTab(tab));
  const { filters, handleFilterChange, clearFilters, applyFilters } =
    useRegulacaoFilters();

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const availableProcedures = data.auxData.procedimentos.filter(
    (p) => String(p.tipoExameId) === String(data.newRequest.examTypeId),
  );

  const activeExamName =
    activeTab === "LISTA_ESPERA"
      ? data.selectedQueueExam
      : activeTab === "LIBERADOS"
        ? data.selectedReleasedExam
        : "";

  const activeExamObj = data.auxData.tiposExame.find(
    (t) =>
      t.nome?.toLowerCase() === activeExamName?.toLowerCase() ||
      String(t.id) === String(activeExamName),
  );

  const allProceduresList = data.auxData.procedimentos
    .filter((p) => {
      if (!activeExamObj) return true;
      return String(p.tipoExameId) === String(activeExamObj.id);
    })
    .map((p) => p.nome);

  return (
    <div className={styles.container}>

      {activeTab === "DASHBOARD" && (
        <Dashboard
          requests={data.requests}
          auxData={data.auxData}
          setActiveTab={(tab) => handleSetActiveTab(tab)}
        />
      )}

      {activeTab === "NOVO_PEDIDO" && (
        <NovoPedido
          newRequest={data.newRequest}
          setNewRequest={data.setNewRequest}
          handleCreateRequest={data.handleCreateRequest}
          auxData={data.auxData}
          availableProcedures={availableProcedures}
          patientSuggestions={data.patientSuggestions}
          showSuggestions={data.showSuggestions}
          isSearchingPatient={data.isSearchingPatient}
          autocompleteRef={data.autocompleteRef}
          handlePatientSearchChange={data.handlePatientSearchChange}
          handleInputFocus={data.handleInputFocus}
          handleSearchPatientManual={data.handleSearchPatientManual}
          handleSelectPatientSuggestion={data.handleSelectPatientSuggestion}
          handleExamTypeChange={data.handleExamTypeChange}
          handleProcedureChange={data.handleProcedureChange}
        />
      )}

      {activeTab === "LISTA_ESPERA" && (
        <div className={styles.unifiedPanel}>
        <FiltersBar
          filters={filters}
          handleFilterChange={handleFilterChange}
          clearFilters={clearFilters}
          showAdvancedFilters={showAdvancedFilters}
          setShowAdvancedFilters={setShowAdvancedFilters}
          allProceduresList={allProceduresList}
          filtrosFixos={true}
          contexto="LISTA_ESPERA"
          unificado={true}
          tiposExame={data.auxData?.tiposExame || []}
          selectedExame={data.selectedQueueExam}
          onSelectExame={(nome) => data.setSelectedQueueExam(nome)}
          pacientesFila={(data.requests || []).filter(
            (r) => r.status === "Aguardando",
          )}
        />
        <ListaEspera
          auxData={data.auxData}
          requests={data.requests}
          selectedQueueExam={data.selectedQueueExam}
          setSelectedQueueExam={data.setSelectedQueueExam}
          applyFilters={applyFilters}
          handleUpdateCommunicationDate={data.handleUpdateCommunicationDate}
          handleUpdateCommunicationStatus={data.handleUpdateCommunicationStatus}
          handleOpenReleaseModal={data.handleOpenReleaseModal}
          handleEditOrder={data.handleEditOrder}
          reloadData={data.reloadData}
          loading={data.loading}
          handleExportToExcelWaiting={(selectedIds) => {
            if (!selectedIds || selectedIds.length === 0)
              return alert("Selecione pelo menos um paciente da fila.");
            const selectedItems = data.requests.filter((r) =>
              selectedIds.includes(r.id),
            );
            const exportData = selectedItems.map((item) => ({
              "Código Regulação": item.id,
              "Nome do Paciente": item.patientName,
              CPF: item.cpf,
              "Cartão SUS": item.susCard || "Não informado",
              "Nome da Mãe": item.motherName || "Não informada",
              "Tipo de Exame": item.examType,
              Procedimento: item.procedure,
              "Classificação de Risco": item.classification || "Verde",
              "Data do Pedido": item.requestDate || "Não informada",
              "Médico Solicitante": item.requestDoctor || "Não informado",
              "UBS Solicitante": item.requestUbs || "Não informada",
              "Data Comunicação": item.communicationDate || "Não informada",
              "Status Comunicação": item.communicationStatus || "Sem info",
            }));
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Fila de Espera");
            XLSX.writeFile(
              workbook,
              `ListaEspera_${String(data.selectedQueueExam || "Todos").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`,
            );
          }}
        />
        </div>
      )}

      {activeTab === "EDITAR_PEDIDO" && (
        <TelaEditarPedido
          editingItem={data.editingItem}
          setEditingItem={data.setEditingItem}
          auxData={data.auxData}
          editOrigin={data.editOrigin}
          handleEditStatusChange={data.handleEditStatusChange}
          handleSaveEditedOrder={data.handleSaveEditedOrder}
          onBack={() => {
            data.setEditingItem(null);
            handleSetActiveTab(data.editOrigin || "LISTA_ESPERA");
          }}
          styles={styles}
        />
      )}

      {activeTab === "LIBERAR_PEDIDO" && (
        <TelaLiberarPedido
          releasingItem={data.releasingItem}
          regulationForm={data.regulationForm}
          setRegulationForm={data.setRegulationForm}
          auxData={data.auxData}
          handleSelectQuotaType={data.handleSelectQuotaType}
          handleReleaseDateChange={data.handleReleaseDateChange}
          handleConfirmRelease={data.handleConfirmRelease}
          onBack={() => {
            data.setReleasingItem(null);
            handleSetActiveTab("LISTA_ESPERA");
          }}
          showQuotaModal={data.showQuotaModal}
          setShowQuotaModal={data.setShowQuotaModal}
          quotaModalType={data.quotaModalType}
          quotaModalYear={data.quotaModalYear}
          setQuotaModalYear={data.setQuotaModalYear}
          handleSelectMonthFromModal={data.handleSelectMonthFromModal}
          calculateMonthQuotaDetails={data.calculateMonthQuotaDetails}
          styles={styles}
        />
      )}

      {activeTab === "LIBERADOS" && (
        <div className={styles.unifiedPanel}>
        <FiltersBar
          filters={filters}
          handleFilterChange={handleFilterChange}
          clearFilters={clearFilters}
          showAdvancedFilters={showAdvancedFilters}
          setShowAdvancedFilters={setShowAdvancedFilters}
          allProceduresList={allProceduresList}
          filtrosFixos={true}
          contexto="LIBERADOS"
          unificado={true}
          tiposExame={data.auxData?.tiposExame || []}
          selectedExame={data.selectedReleasedExam}
          onSelectExame={(nome) => data.setSelectedReleasedExam(nome)}
          pacientesFila={(data.requests || []).filter(
            (r) => r.status === "Liberado",
          )}
        />
        <Liberados
          auxData={data.auxData}
          requests={data.requests}
          selectedReleasedExam={data.selectedReleasedExam}
          setSelectedReleasedExam={data.setSelectedReleasedExam}
          applyFilters={applyFilters}
          handleUpdateBillingDate={data.handleUpdateBillingDate}
          handleEditOrder={data.handleEditOrder}
          loading={data.loading}
          handleExportToExcelReleased={(selectedIds) => {
            if (!selectedIds || selectedIds.length === 0)
              return alert("Selecione pelo menos um paciente liberado.");
            const selectedItems = data.requests.filter((r) =>
              selectedIds.includes(r.id),
            );
            const exportData = selectedItems.map((item) => ({
              "Código Regulação": item.id,
              "Nome do Paciente": item.patientName,
              CPF: item.cpf,
              "Cartão SUS": item.susCard || "Não informado",
              "Tipo de Exame": item.examType,
              Procedimento: item.procedure,
              "Data da Liberação": item.releaseDate || "Não informada",
              "Tipo de Cota": item.quota || "N/A",
              "Competência Cota":
                item.quotaCompetenceMonth && item.quotaCompetenceYear
                  ? `${item.quotaCompetenceMonth}/${item.quotaCompetenceYear}`
                  : "N/A",
              "Data Faturado": item.billingDate || "Não informada",
              "Médico Regulador": item.regulatorDoctor || "Não informado",
              "Médico Solicitante": item.requestDoctor || "Não informado",
              "UBS Solicitante": item.requestUbs || "Não informada",
              "Valor do Exame (R$)": item.estimatedCost
                ? item.estimatedCost.toFixed(2)
                : "0.00",
            }));
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(
              workbook,
              worksheet,
              "Exames Liberados",
            );
            XLSX.writeFile(
              workbook,
              `Liberados_${data.selectedReleasedExam.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`,
            );
          }}
        />
        </div>
      )}

      {activeTab === "PROCEDIMENTOS" && <ProcedimentosTab />}

      {activeTab === "USUARIOS" &&
        (podeGerenciarUsuarios ? (
          <UsuariosTab />
        ) : (
          <AcessoNegadoModulo modulo="Gerenciar Usuários" />
        ))}

      {activeTab === "FINANCEIRO" && (
        <Financeiro
          finMonth={data.finMonth}
          setFinMonth={data.setFinMonth}
          finYear={data.finYear}
          setFinYear={data.setFinYear}
          calculateMonthQuotaDetails={data.calculateMonthQuotaDetails}
          handleOpenDefineTetoModal={data.handleOpenDefineTetoModal}
          planejamentoCidades={data.planejamentoCidades}
          handleSavePlanejamentoCidade={data.handleSavePlanejamentoCidade}
        />
      )}

      <ModalTetoFinanceiro
        editCotaModal={data.editCotaModal}
        setEditCotaModal={data.setEditCotaModal}
        handleSaveTetoCota={data.handleSaveTetoCota}
        finMonth={data.finMonth}
        finYear={data.finYear}
        styles={styles}
      />

      <ModalSeletorCotas
        open={data.showQuotaModal}
        onClose={() => data.setShowQuotaModal(false)}
        tipoCota={data.quotaModalType}
        anoAtual={data.quotaModalYear}
        setAnoAtual={data.setQuotaModalYear}
        onSelectMonth={data.handleSelectMonthFromModal}
        calculateMonthQuotaDetails={data.calculateMonthQuotaDetails}
        defaultMonth={data.regulationForm.quotaCompetenceMonth}
        styles={styles}
      />
    </div>
  );
}

export default function RegulacaoPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "#64748b",
            fontWeight: 500,
          }}
        >
          Carregando página...
        </div>
      }
    >
      <RegulacaoPageContent />
    </Suspense>
  );
}