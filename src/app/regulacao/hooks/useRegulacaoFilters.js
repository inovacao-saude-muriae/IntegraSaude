"use client";

import { useState, useEffect } from "react";

const FILTROS_VAZIOS = {
  // Busca ampla (nome, mãe, CPF, cartão SUS)
  search: "",
  // Selects
  searchProcedure: "",
  classification: "",
  quotaType: "",
  orderStatus: "", // status do pedido (Aguardando, Liberado, Cancelado, Devolvido)
  communicationStatus: "", // texto do status de comunicação (ex.: "Avisado")
  communicationFilled: "", // "", "FILLED" ou "EMPTY" (data de comunicação preenchida?)
  // Períodos (ISO YYYY-MM-DD)
  entryDateStart: "",
  entryDateEnd: "",
  communicationDateStart: "",
  communicationDateEnd: "",
  releaseDateStart: "",
  releaseDateEnd: "",
  billingDateStart: "",
  billingDateEnd: "",
};

const STORAGE_KEY = "regulacao_filtros_persistentes";

const norm = (v) => String(v || "").trim().toLowerCase();
const soDigitos = (v) => String(v || "").replace(/\D/g, "");

// Converte "DD/MM/YYYY" -> "YYYY-MM-DD"; deixa ISO como está.
const paraISO = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return s.length >= 10 ? s.slice(0, 10) : s;
};

// Retorna a data ISO de um item priorizando o campo *Raw (já ISO).
const dataISOItem = (raw, formatado) => paraISO(raw || formatado);

// Carrega filtros do localStorage
const carregarFiltros = () => {
  if (typeof window === "undefined") return { ...FILTROS_VAZIOS };
  try {
    const salvos = localStorage.getItem(STORAGE_KEY);
    if (salvos) {
      const parsed = JSON.parse(salvos);
      return { ...FILTROS_VAZIOS, ...parsed };
    }
  } catch (err) {
    console.error("Erro ao carregar filtros persistentes:", err);
  }
  return { ...FILTROS_VAZIOS };
};

// Salva filtros no localStorage
const salvarFiltros = (filtros) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtros));
  } catch (err) {
    console.error("Erro ao salvar filtros persistentes:", err);
  }
};

export function useRegulacaoFilters() {
  const [filters, setFilters] = useState(carregarFiltros);

  // Persiste filtros no localStorage sempre que mudarem (#9)
  useEffect(() => {
    salvarFiltros(filters);
  }, [filters]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ ...FILTROS_VAZIOS });
  };

  // Verifica se uma data ISO está dentro de um intervalo [ini, fim] (ambos opcionais).
  const dentroDoIntervalo = (dataISO, ini, fim) => {
    if (!dataISO) return !ini && !fim ? true : false;
    if (ini && dataISO < ini) return false;
    if (fim && dataISO > fim) return false;
    return true;
  };

  const applyFilters = (items) => {
    if (!Array.isArray(items)) return [];

    return items.filter((item) => {
      // 1. Busca ampla: nome do paciente, nome da mãe, CPF e cartão SUS.
      const termo = norm(filters.search);
      if (termo) {
        const termoDigitos = soDigitos(filters.search);
        const alvoTexto = `${norm(item.patientName)} ${norm(item.motherName)}`;
        const alvoDigitos = `${soDigitos(item.cpf)} ${soDigitos(item.susCard)}`;
        const casaTexto = alvoTexto.includes(termo);
        const casaDigitos = termoDigitos && alvoDigitos.includes(termoDigitos);
        if (!casaTexto && !casaDigitos) return false;
      }

      // 2. Procedimento (select) — comparação case-insensitive.
      if (filters.searchProcedure && norm(item.procedure) !== norm(filters.searchProcedure)) {
        return false;
      }

      // 3. Classificação de risco.
      if (filters.classification && norm(item.classification) !== norm(filters.classification)) {
        return false;
      }

      // 4. Tipo de cota (SUS agrega PPI).
      if (filters.quotaType) {
        const alvo = norm(filters.quotaType);
        const cota = norm(item.quota);
        if (alvo === "sus") {
          if (cota !== "sus" && cota !== "ppi") return false;
        } else if (cota !== alvo) {
          return false;
        }
      }

      // 4b. Status do pedido.
      if (filters.orderStatus && norm(item.status) !== norm(filters.orderStatus)) {
        return false;
      }

      // 5. Status da comunicação (texto exato, case-insensitive).
      if (filters.communicationStatus && norm(item.communicationStatus) !== norm(filters.communicationStatus)) {
        return false;
      }

      // 5b. Data de comunicação preenchida ou não.
      if (filters.communicationFilled) {
        const temData = Boolean(item.communicationDate);
        if (filters.communicationFilled === "FILLED" && !temData) return false;
        if (filters.communicationFilled === "EMPTY" && temData) return false;
      }

      // 6. Período de entrada (data do pedido).
      if (filters.entryDateStart || filters.entryDateEnd) {
        const d = dataISOItem(item.requestDateRaw, item.requestDate);
        if (!dentroDoIntervalo(d, filters.entryDateStart, filters.entryDateEnd)) return false;
      }

      // 7. Período de comunicação.
      if (filters.communicationDateStart || filters.communicationDateEnd) {
        const d = paraISO(item.communicationDate);
        if (!dentroDoIntervalo(d, filters.communicationDateStart, filters.communicationDateEnd)) return false;
      }

      // 8. Período de liberação.
      if (filters.releaseDateStart || filters.releaseDateEnd) {
        const d = dataISOItem(item.releaseDateRaw, item.releaseDate);
        if (!dentroDoIntervalo(d, filters.releaseDateStart, filters.releaseDateEnd)) return false;
      }

      // 9. Período de faturamento.
      if (filters.billingDateStart || filters.billingDateEnd) {
        const d = paraISO(item.billingDate);
        if (!dentroDoIntervalo(d, filters.billingDateStart, filters.billingDateEnd)) return false;
      }

      return true;
    });
  };

  return {
    filters,
    handleFilterChange,
    clearFilters,
    applyFilters,
  };
}
