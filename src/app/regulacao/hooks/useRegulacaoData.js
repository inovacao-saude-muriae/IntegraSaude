"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { localPorTipoExame } from "../constants";
import {
  getPedidosExames,
  getAuxiliaryData,
  searchPessoa,
  searchPessoasAutocomplete,
  createPedidoExame,
  updateCommunicationDate,
  releasePaciente,
  createPessoa,
  createMedico,
  createUbs,
  createProcedimento,
  getCotasFinanceiras,
  saveCotaFinanceira,
  getPlanejamentoCidades,
  savePlanejamentoCidade,
  updateBillingDate,
  updatePedidoExame,
  deletePedidoExame,
  cancelarPedidoExame,
  updateMedico,
  deleteMedico,
  updatePessoa,
  deletePessoa,
  updateUbs,
  deleteUbs,
  updateProcedimento,
} from "../actions";

export function useRegulacaoData(setActiveTab) {
  const confirm = useConfirm();
  const [cadSubTab, setCadSubTab] = useState("PACIENTES");
  const [selectedQueueExam, setSelectedQueueExam] = useState("");
  const [selectedReleasedExam, setSelectedReleasedExam] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedReleasedIds, setSelectedReleasedIds] = useState([]);

  const autocompleteRef = useRef(null);
  const isSelectedRef = useRef(false);

  const [auxData, setAuxData] = useState({
    tiposExame: [],
    procedimentos: [],
    medicos: [],
    ubsList: [],
    pessoas: [],
  });
  const [requests, setRequests] = useState([]);
  const [cotasFinanceiras, setCotasFinanceiras] = useState([]);
  const [planejamentoCidades, setPlanejamentoCidades] = useState([]);

  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);

  const _hoje = new Date();
  const [finMonth, setFinMonth] = useState(
    String(_hoje.getMonth() + 1).padStart(2, "0")
  );
  const [finYear, setFinYear] = useState(String(_hoje.getFullYear()));

  const [editCotaModal, setEditCotaModal] = useState(null);

  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaModalType, setQuotaModalType] = useState("OCI");
  const [quotaModalYear, setQuotaModalYear] = useState("2026");

  const [editingItem, setEditingItem] = useState(null);
  const [releasingItem, setReleasingItem] = useState(null);
  // Aba de onde a edição foi aberta (para voltar ao cancelar/salvar).
  const [editOrigin, setEditOrigin] = useState("LISTA_ESPERA");

  const [regulationForm, setRegulationForm] = useState({
    status: "Liberado",
    quota: "",
    releaseDate: new Date().toISOString().split("T")[0],
    quotaCompetenceMonth: new Date().toISOString().slice(5, 7),
    quotaCompetenceYear: `${new Date().getFullYear()}`,
    generalObservation: "",
    regulatorDoctorId: "",
    communicationDate: "",
    communicationStatus: "Avisado",
  });

  const [formPessoa, setFormPessoa] = useState({
    cpf: "",
    nomeCompleto: "",
    dataNascimento: "",
    nomeMae: "",
    telefone: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "Muriaé",
    uf: "MG",
    cep: "",
  });
  const [formMedico, setFormMedico] = useState({
    nome: "",
    crm: "",
    ufCrm: "MG",
    especialidade: "",
    tipo: "Solicitante",
  });
  const [formUbs, setFormUbs] = useState({ nome: "", cnes: "" });
  const [formProcedimento, setFormProcedimento] = useState({
    nome: "",
    valor: "",
    tipoExameId: "",
  });

  const [newRequest, setNewRequest] = useState({
    patientSearch: "",
    patientName: "",
    motherName: "",
    cpf: "",
    susCard: "",
    examTypeId: "",
    procedureId: "",
    procedureName: "",
    estimatedCost: 0,
    localRealizacao: "",
    competence: `${new Date().toISOString().slice(5, 7)}/${new Date().getFullYear()}`,
    requestDate: new Date().toISOString().split("T")[0],
    classification: "Verde",
    medicoSolicitanteId: "",
    ubsResponsavelId: "",
    justification: "",
  });

  // Função manual de recarga (usada pelos handlers após criar/editar/excluir)
  const reloadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pedidos, aux, cotas] = await Promise.all([
        getPedidosExames(),
        getAuxiliaryData(),
        getCotasFinanceiras(),
      ]);
      setRequests(pedidos || []);
      setAuxData(
        aux || {
          tiposExame: [],
          procedimentos: [],
          medicos: [],
          ubsList: [],
          pessoas: [],
        }
      );
      setCotasFinanceiras(cotas || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. CARREGAMENTO INICIAL ISOLADO NO EFFECT
  useEffect(() => {
    let isMounted = true;

    async function fetchInitialData() {
      try {
        setLoading(true);
        const [pedidos, aux, cotas] = await Promise.all([
          getPedidosExames(),
          getAuxiliaryData(),
          getCotasFinanceiras(),
        ]);

        if (isMounted) {
          setRequests(pedidos || []);
          setAuxData(
            aux || {
              tiposExame: [],
              procedimentos: [],
              medicos: [],
              ubsList: [],
              pessoas: [],
            }
          );
          setCotasFinanceiras(cotas || []);
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Função manual para recarregar o planejamento por cidade
  const reloadPlanejamento = useCallback(async (ano = finYear) => {
    const dados = await getPlanejamentoCidades(ano);
    setPlanejamentoCidades(dados || []);
  }, [finYear]);

  // 2. RECARREGA PLANEJAMENTO QUANDO O ANO MUDA (ISOLADO NO EFFECT)
  useEffect(() => {
    let isMounted = true;

    async function fetchPlanejamento() {
      try {
        const dados = await getPlanejamentoCidades(finYear);
        if (isMounted) {
          setPlanejamentoCidades(dados || []);
        }
      } catch (error) {
        console.error("Erro ao carregar planejamento:", error);
      }
    }

    fetchPlanejamento();

    return () => {
      isMounted = false;
    };
  }, [finYear]);

  // Salva uma célula do planejamento (cidade/ano/mês) e atualiza o estado local.
  const handleSavePlanejamentoCidade = async (cidade, mes, valor) => {
    const res = await savePlanejamentoCidade({ cidade, ano: finYear, mes, valor });
    if (res.success) {
      setPlanejamentoCidades((prev) => {
        const outros = prev.filter(
          (p) => !(p.cidade === cidade && p.ano === finYear && p.mes === mes)
        );
        return [...outros, res.data];
      });
    } else {
      alert("Erro ao salvar planejamento: " + res.error);
    }
    return res;
  };

  // Cancelar pedido — o padrão da Regulação. Some da lista de trabalho, mas
  // continua no banco com status "Cancelado" e o motivo registrado no
  // histórico (quem cancelou, quando, de qual status para qual).
  const handleCancelOrder = async (item) => {
    const motivo = window.prompt(
      `Cancelar o pedido de ${item.patientName}?\n\nInforme o motivo do cancelamento (mínimo 5 caracteres):`,
    );
    if (motivo === null) return; // desistiu
    const res = await cancelarPedidoExame(item.dbId || item.id, motivo);
    if (res.success) {
      await alert("Pedido cancelado. O histórico foi preservado.");
      reloadData();
    } else alert("Não foi possível cancelar: " + res.error);
  };

  const handleDeleteOrder = async (item) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o pedido de ${item.patientName}?`
      )
    )
      return;
    const res = await deletePedidoExame(item.dbId || item.id);
    if (res.success) {
      reloadData();
    } else alert("Erro ao excluir: " + res.error);
  };

  const handleDeleteSelectedOrders = async (ids) => {
    try {
      for (const id of ids) await deletePedidoExame(id);
      setSelectedIds([]);
      reloadData();
    } catch (error) {
      alert("Erro ao excluir: " + error.message);
    }
  };

  const handleEditOrder = (pedido, origem = "LISTA_ESPERA") => {
    setEditingItem(pedido);
    setEditOrigin(origem);
    setActiveTab("EDITAR_PEDIDO");
  };

  const handleEditStatusChange = (newStatus) => {
    if (newStatus === "Aguardando") {
      setEditingItem((prev) => ({
        ...prev,
        status: "Aguardando",
        quota: "",
        releaseDate: "",
        regulatorDoctorId: "",
        regulatorDoctor: "",
      }));
    } else setEditingItem((prev) => ({ ...prev, status: newStatus }));
  };

  const handleSaveEditedOrder = async (e) => {
    if (e) e.preventDefault();
    if (!editingItem) return;
    const ok = await confirm({
      title: "Salvar alterações",
      message: "Deseja salvar as alterações deste pedido?",
      confirmText: "Salvar",
    });
    if (!ok) return;
    const res = await updatePedidoExame(
      editingItem.dbId || editingItem.id,
      editingItem
    );
    if (res.success) {
      await reloadData();
    } else {
      alert("Erro ao atualizar: " + res.error);
    }
  };

  const handleOpenReleaseModal = (item) => {
    const today = new Date().toISOString().split("T")[0];
    setReleasingItem(item);

    setRegulationForm({
      status: "Liberado",
      quota: item.quota || "",
      releaseDate: today,
      quotaCompetenceMonth: today.slice(5, 7),
      quotaCompetenceYear: today.slice(0, 4),
      generalObservation: "",
      regulatorDoctorId: item.regulatorDoctorId || "",
      communicationDate: item.communicationDate || "",
      communicationStatus: item.communicationStatus || "Avisado",
    });

    setActiveTab("LIBERAR_PEDIDO");
  };

  const handleReleaseDateChange = (newReleaseDate) => {
    if (!newReleaseDate)
      return setRegulationForm((prev) => ({ ...prev, releaseDate: "" }));
    setRegulationForm((prev) => ({
      ...prev,
      releaseDate: newReleaseDate,
      quotaCompetenceMonth: newReleaseDate.slice(5, 7),
      quotaCompetenceYear: newReleaseDate.slice(0, 4),
    }));
  };

  const handleSelectQuotaType = (selectedQuota) => {
    setRegulationForm((prev) => ({ ...prev, quota: selectedQuota }));
    if (selectedQuota) {
      // Se for PPI, valida a disponibilidade usando a cota SUS
      const targetQuotaModal = selectedQuota === "PPI" ? "SUS" : selectedQuota;
      setQuotaModalType(targetQuotaModal);
      setQuotaModalYear(
        regulationForm.quotaCompetenceYear || `${new Date().getFullYear()}`
      );
      setShowQuotaModal(true);
    }
  };

  const handleSelectMonthFromModal = (monthValue) => {
    setRegulationForm((prev) => ({
      ...prev,
      quotaCompetenceMonth: monthValue,
      quotaCompetenceYear: quotaModalYear,
    }));
    setShowQuotaModal(false);
  };

  const handleConfirmRelease = async (e) => {
    if (e) e.preventDefault();
    if (regulationForm.status !== "Liberado")
      return alert('Selecione o status "Liberado".');
    if (!regulationForm.quota) return alert("Selecione um Tipo de Cota.");

    const ok = await confirm({
      title: "Liberar pedido",
      message: "Deseja confirmar a liberação deste pedido?",
      confirmText: "Liberar",
    });
    if (!ok) return;
    const res = await releasePaciente(releasingItem.id, regulationForm);
    if (res.success) {
      await reloadData();
      setReleasingItem(null);
      setActiveTab("LISTA_ESPERA");
    } else alert("Erro ao atualizar a liberação.");
  };

  const handleSavePessoa = async (e) => {
    if (e) e.preventDefault();
    const res = await createPessoa(formPessoa);
    if (res.success) {
      setFormPessoa({
        cpf: "",
        nomeCompleto: "",
        dataNascimento: "",
        nomeMae: "",
        telefone: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "Muriaé",
        uf: "MG",
        cep: "",
      });
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleUpdatePessoa = async (cpf, data) => {
    const res = await updatePessoa(cpf, data);
    if (res.success) {
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleDeletePessoa = async (cpf) => {
    const res = await deletePessoa(cpf);
    if (res.success) {
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleSaveMedico = async (e) => {
    if (e) e.preventDefault();
    const res = await createMedico(formMedico);
    if (res.success) {
      setFormMedico({
        nome: "",
        crm: "",
        ufCrm: "MG",
        especialidade: "",
        tipo: "Solicitante",
      });
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleUpdateMedico = async (id, data) => {
    const res = await updateMedico(id, data);
    if (res.success) {
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleDeleteMedico = async (id) => {
    const res = await deleteMedico(id);
    if (res.success) {
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleSaveUbs = async (e) => {
    if (e) e.preventDefault();
    const res = await createUbs(formUbs);
    if (res.success) {
      setFormUbs({ nome: "", cnes: "" });
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleUpdateUbs = async (id, data) => {
    const res = await updateUbs(id, data);
    if (res.success) {
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleDeleteUbs = async (id) => {
    const res = await deleteUbs(id);
    if (res.success) {
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleSaveProcedimento = async (e) => {
    if (e) e.preventDefault();
    const res = await createProcedimento(formProcedimento);
    if (res.success) {
      setFormProcedimento({ nome: "", valor: "", tipoExameId: "" });
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleUpdateProcedimento = async (id, data) => {
    const res = await updateProcedimento(id, data);
    if (res.success) {
      reloadData();
    } else alert("Erro: " + res.error);
  };

  const handleOpenDefineTetoModal = (tipoCota, valorAtual) => {
    setEditCotaModal({ open: true, tipoCota, valor: valorAtual || "" });
  };

  const handleSaveTetoCota = async (e) => {
    if (e) e.preventDefault();
    if (!editCotaModal) return;

    const ok = await confirm({
      title: "Salvar teto",
      message: "Deseja salvar o teto financeiro desta cota?",
      confirmText: "Salvar",
    });
    if (!ok) return;
    const res = await saveCotaFinanceira({
      tipoCota: editCotaModal.tipoCota,
      mes: finMonth,
      ano: finYear,
      valorTeto: editCotaModal.valor,
    });
    if (res.success) {
      setEditCotaModal(null);
      reloadData();
    } else alert("Erro: " + res.error);
  };

  // 🎯 REGRA DE CÁLCULO MENSAL: SUS DEBITA PEDIDOS "SUS" E "PPI"
  const calculateMonthQuotaDetails = (quotaType, year, monthValue) => {
    const norm = (v) => String(v || "").trim().toUpperCase();
    const tipoAlvo = norm(quotaType);

    const record = cotasFinanceiras.find(
      (c) =>
        norm(c.tipoCota) === tipoAlvo && c.mes === monthValue && c.ano === year
    );
    const totalLimit = record ? record.valorTeto : 0;

    const totalUsed = requests
      .filter((r) => {
        if (r.status !== "Liberado") return false;
        if (r.quotaCompetenceMonth !== monthValue || r.quotaCompetenceYear !== year) return false;

        const cotaPedido = norm(r.quota);

        if (tipoAlvo === "SUS") {
          return cotaPedido === "SUS" || cotaPedido === "PPI";
        }

        return cotaPedido === tipoAlvo;
      })
      .reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

    return { totalLimit, totalUsed, available: totalLimit - totalUsed };
  };

  const handleUpdateBillingDate = async (id, newDate) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, billingDate: newDate } : req))
    );
    await updateBillingDate(id, newDate);
  };

  const handlePatientSearchChange = async (e) => {
    const value = e.target.value;
    isSelectedRef.current = false;
    setNewRequest((prev) => ({ ...prev, patientSearch: value }));
    if (value.trim().length >= 2) {
      setIsSearchingPatient(true);
      const suggestions = await searchPessoasAutocomplete(value);
      setPatientSuggestions(suggestions || []);
      if (!isSelectedRef.current) setShowSuggestions(true);
      setIsSearchingPatient(false);
    } else {
      setPatientSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectPatientSuggestion = (pessoa) => {
    isSelectedRef.current = true;
    setShowSuggestions(false);
    setPatientSuggestions([]);
    setNewRequest((prev) => ({
      ...prev,
      patientSearch: pessoa.nomeCompleto,
      patientName: pessoa.nomeCompleto,
      motherName: pessoa.nomeMae || "",
      cpf: pessoa.cpf,
      cns: pessoa.cns || "",
      susCard: pessoa.cns || "",
      sexo: pessoa.sexo || "",
      dataNascimento: pessoa.dataNascimento || "",
      telefone: pessoa.telefone || "",
      ubsReferencia: pessoa.ubsReferencia || "",
      ubsResponsavelId: pessoa.ubsReferenciaId ? String(pessoa.ubsReferenciaId) : "",
      cep: pessoa.cep || "",
      logradouro: pessoa.logradouro || "",
      numero: pessoa.numero || "",
      complemento: pessoa.complemento || "",
      bairro: pessoa.bairro || "",
      cidade: pessoa.cidade || "",
      uf: pessoa.uf || "",
    }));
  };

  const handleInputFocus = () => {
    if (isSelectedRef.current) return;
    if (newRequest.patientSearch.length >= 2 && patientSuggestions.length > 0)
      setShowSuggestions(true);
  };

  const handleSearchPatientManual = async () => {
    if (!newRequest.patientSearch) return;
    const pessoa = await searchPessoa(newRequest.patientSearch.trim());
    if (pessoa) {
      isSelectedRef.current = true;
      setNewRequest((prev) => ({
        ...prev,
        patientName: pessoa.nomeCompleto,
        motherName: pessoa.nomeMae,
        cpf: pessoa.cpf,
        susCard: "",
      }));
      setPatientSuggestions([]);
      setShowSuggestions(false);
    } else alert("Pessoa não encontrada.");
  };

  const handleExamTypeChange = (e) => {
    const selectedTypeId = e.target.value;
    const tipo = auxData.tiposExame?.find(
      (t) => String(t.id) === String(selectedTypeId)
    );
    const local = localPorTipoExame(tipo?.nome);
    setNewRequest((prev) => ({
      ...prev,
      examTypeId: selectedTypeId,
      procedureId: "",
      procedureName: "",
      estimatedCost: 0,
      localRealizacao: local,
    }));
  };

  const handleProcedureChange = (e) => {
    const selectedProcId = Number(e.target.value);
    const foundProc = auxData.procedimentos.find(
      (p) => p.id === selectedProcId
    );
    if (foundProc) {
      setNewRequest((prev) => ({
        ...prev,
        procedureId: foundProc.id,
        procedureName: foundProc.nome,
        estimatedCost: foundProc.valor,
      }));
    } else
      setNewRequest((prev) => ({
        ...prev,
        procedureId: "",
        procedureName: "",
        estimatedCost: 0,
      }));
  };

  const handleCreateRequest = async (e) => {
    if (e) e.preventDefault();
    if (
      !newRequest.patientName ||
      !newRequest.examTypeId ||
      !newRequest.procedureId
    )
      return alert("Preencha os campos obrigatórios.");
    const ok = await confirm({
      title: "Cadastrar pedido",
      message: "Deseja enviar este pedido para a lista de espera?",
      confirmText: "Enviar",
    });
    if (!ok) return;
    const res = await createPedidoExame(newRequest);
    if (res.success) {
      reloadData();
      setActiveTab("LISTA_ESPERA");
      setNewRequest({
        patientSearch: "",
        patientName: "",
        motherName: "",
        cpf: "",
        susCard: "",
        examTypeId: "",
        procedureId: "",
        procedureName: "",
        estimatedCost: 0,
        localRealizacao: "",
        competence: `${new Date().toISOString().slice(5, 7)}/${new Date().getFullYear()}`,
        requestDate: new Date().toISOString().split("T")[0],
        classification: "Verde",
        medicoSolicitanteId: "",
        ubsResponsavelId: "",
        justification: "",
      });
    } else alert("Erro ao registrar.");
  };

  const handleUpdateCommunicationDate = async (id, newDate) => {
    const atual = requests.find((r) => r.id === id);
    setRequests((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, communicationDate: newDate } : req
      )
    );
    await updateCommunicationDate(id, newDate, {
      statusComunicacao: atual?.communicationStatus || "",
    });
  };

  const handleUpdateCommunicationStatus = async (id, newStatus) => {
    const atual = requests.find((r) => r.id === id);
    setRequests((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, communicationStatus: newStatus } : req
      )
    );
    await updateCommunicationDate(id, atual?.communicationDate || "", {
      statusComunicacao: newStatus,
    });
  };

  return {
    loading,
    auxData,
    requests,
    cotasFinanceiras,
    selectedQueueExam,
    setSelectedQueueExam,
    selectedReleasedExam,
    setSelectedReleasedExam,
    selectedIds,
    setSelectedIds,
    selectedReleasedIds,
    setSelectedReleasedIds,
    editingItem,
    setEditingItem,
    editOrigin,
    releasingItem,
    setReleasingItem,
    regulationForm,
    setRegulationForm,
    newRequest,
    setNewRequest,
    formPessoa,
    setFormPessoa,
    formMedico,
    setFormMedico,
    formUbs,
    setFormUbs,
    formProcedimento,
    setFormProcedimento,
    patientSuggestions,
    showSuggestions,
    isSearchingPatient,
    autocompleteRef,
    finMonth,
    setFinMonth,
    finYear,
    setFinYear,
    editCotaModal,
    setEditCotaModal,
    showQuotaModal,
    setShowQuotaModal,
    quotaModalType,
    setQuotaModalType,
    quotaModalYear,
    setQuotaModalYear,
    cadSubTab,
    setCadSubTab,
    handleCancelOrder,
    handleDeleteOrder,
    handleDeleteSelectedOrders,
    handleEditOrder,
    handleEditStatusChange,
    handleSaveEditedOrder,
    handleOpenReleaseModal,
    handleReleaseDateChange,
    handleSelectQuotaType,
    handleSelectMonthFromModal,
    handleConfirmRelease,
    handleSavePessoa,
    handleUpdatePessoa,
    handleDeletePessoa,
    handleSaveMedico,
    handleUpdateMedico,
    handleDeleteMedico,
    handleSaveUbs,
    handleUpdateUbs,
    handleDeleteUbs,
    handleSaveProcedimento,
    handleUpdateProcedimento,
    handleOpenDefineTetoModal,
    handleSaveTetoCota,
    planejamentoCidades,
    handleSavePlanejamentoCidade,
    calculateMonthQuotaDetails,
    handleUpdateBillingDate,
    handlePatientSearchChange,
    handleSelectPatientSuggestion,
    handleInputFocus,
    handleSearchPatientManual,
    handleExamTypeChange,
    handleProcedureChange,
    handleCreateRequest,
    handleUpdateCommunicationDate,
    handleUpdateCommunicationStatus,
  };
}