'use client';
import { formatarCpfExibicao } from '@/lib/cpf';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import styles from './FiltersBar.module.css';
import { STATUS_COMUNICACAO, STATUS_PEDIDO, documentoPaciente } from './constants';

export default function FiltersBar({
  filters,
  handleFilterChange,
  clearFilters,
  showAdvancedFilters,
  setShowAdvancedFilters,
  allProceduresList = [],
  filtrosFixos = false,
  pacientesFila = [],
  contexto = "LISTA_ESPERA", // "LISTA_ESPERA" ou "LIBERADOS"
  tiposExame = [],
  selectedExame = "",
  onSelectExame = () => {},
  unificado = false, // quando true, remove o card próprio (fica dentro de um painel único)
}) {
  const isLiberados = contexto === "LIBERADOS";
  const isListaEspera = contexto === "LISTA_ESPERA";
  // Quando fixos, os filtros avançados ficam sempre abertos.
  const filtrosAbertos = filtrosFixos || showAdvancedFilters;
  // Estado local para os filtros
  const [draftFilters, setDraftFilters] = useState(filters);
  const [prevFilters, setPrevFilters] = useState(filters);

  // Dropdown de pacientes na fila (ao clicar no campo de busca).
  const [dropAberto, setDropAberto] = useState(false);
  const buscaRef = useRef(null);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function handleClickOutside(e) {
      if (buscaRef.current && !buscaRef.current.contains(e.target)) {
        setDropAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lista única de pacientes na fila (por CPF), filtrada pelo termo digitado.
  const termoBusca = (draftFilters.search || draftFilters.searchName || '').toLowerCase().trim();
  const pacientesUnicos = [];
  const cpfsVistos = new Set();
  for (const p of pacientesFila) {
    const cpf = (p.cpf || '').replace(/\D/g, '');
    if (cpf && cpfsVistos.has(cpf)) continue;
    if (cpf) cpfsVistos.add(cpf);
    pacientesUnicos.push(p);
  }
  const pacientesFiltrados = pacientesUnicos.filter((p) => {
    if (!termoBusca) return true;
    const nome = (p.patientName || '').toLowerCase();
    const mae = (p.motherName || '').toLowerCase();
    const cpfLimpo = (p.cpf || '').replace(/\D/g, '');
    const buscaLimpa = termoBusca.replace(/\D/g, '');
    return nome.includes(termoBusca) || mae.includes(termoBusca) || (buscaLimpa && cpfLimpo.includes(buscaLimpa));
  });

  const formatCPF = (cpf) => {
    if (!cpf) return '';
    return formatarCpfExibicao(cpf);
  };

  const selecionarPaciente = (p) => {
    const nome = p.patientName || '';
    handleDraftChange('search', nome);
    handleDraftChange('searchName', nome);
    handleFilterChange('search', nome);
    handleFilterChange('searchName', nome);
    setDropAberto(false);
  };

  // Sincronização padrão recomendada pelo React (sem acionar cascading render em useEffect)
  if (filters !== prevFilters) {
    setPrevFilters(filters);
    setDraftFilters(filters);
  }

  const handleDraftChange = (field, value) => {
    setDraftFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Aplica todos os filtros ao clicar em "Filtrar"
  const handleApplyFilters = () => {
    Object.keys(draftFilters).forEach((key) => {
      handleFilterChange(key, draftFilters[key]);
    });
  };

  const handleClear = () => {
    clearFilters();
    setDraftFilters({});
  };

  return (
    <div className={`${styles.filterCard} ${unificado ? styles.filterCardFlat : ''}`}>
      {/* BARRA SUPERIOR DE BUSCA E AÇÕES */}
      <div className={styles.filterBarTop}>
        <div className={styles.mainSearchBox} ref={buscaRef} style={{ position: 'relative' }}>
          <div className={styles.lupaIconContainer}>
            <Image
              src="/img/icon/lupa.png"
              alt="Buscar"
              width={18}
              height={18}
              className={styles.searchIconImg}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <input
            type="text"
            placeholder="Buscar por paciente, mãe, CPF ou Cartão SUS..."
            value={draftFilters.search || draftFilters.searchName || ''}
            onFocus={() => pacientesFila.length > 0 && setDropAberto(true)}
            onChange={(e) => {
              handleDraftChange('search', e.target.value);
              handleDraftChange('searchName', e.target.value);
              if (pacientesFila.length > 0) setDropAberto(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setDropAberto(false);
                handleApplyFilters();
              }
            }}
          />

          {/* DROPDOWN COM OS PACIENTES DA FILA (tabela) */}
          {dropAberto && pacientesFila.length > 0 && (
            <div className={styles.patientDropdown}>
              <table className={styles.patientTable}>
                <thead>
                  <tr>
                    <th>CPF / CNS</th>
                    <th>Usuário</th>
                    <th>Nome da mãe</th>
                    <th>Data nasc.</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientesFiltrados.length > 0 ? (
                    pacientesFiltrados.map((p, idx) => (
                      <tr
                        key={p.cpf ? `${p.cpf}-${idx}` : idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selecionarPaciente(p);
                        }}
                      >
                        <td>{documentoPaciente({ cpf: p.cpf, cns: p.susCard })}</td>
                        <td className={styles.patientTableName}>{p.patientName}</td>
                        <td>{p.motherName || "Não informada"}</td>
                        <td>{p.birthDate || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className={styles.patientTableEmpty}>
                        Nenhum paciente na fila.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.filterActionsTop}>
          {!filtrosFixos && (
            <button
              type="button"
              className={`${styles.toggleFilterBtn} ${
                showAdvancedFilters ? styles.activeToggle : ''
              }`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}
            </button>
          )}

        </div>
      </div>

      {/* PAINEL DE FILTROS AVANÇADOS (fixo na Lista de Espera) */}
      {filtrosAbertos && (
        <div className={styles.advancedFiltersWrapper}>
          <div className={styles.filterSection}>
            <span className={styles.sectionTitle}>Filtros Gerais</span>
            <div className={styles.filterGrid}>
              {/* Tipo de Exame — substitui as antigas abas */}
              <div className={styles.fieldItem}>
                <label>Tipo de Exame</label>
                <select
                  value={selectedExame || ''}
                  onChange={(e) => onSelectExame(e.target.value)}
                >
                  <option value="">Todos os exames</option>
                  {tiposExame.map((t) => (
                    <option key={t.id} value={t.nome}>{t.nome}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldItem}>
                <label>Procedimento</label>
                <select
                  value={draftFilters.procedure || draftFilters.searchProcedure || ''}
                  onChange={(e) => {
                    handleDraftChange('procedure', e.target.value);
                    handleDraftChange('searchProcedure', e.target.value);
                  }}
                >
                  <option value="">Todos os procedimentos</option>
                  {allProceduresList.map((p, idx) => (
                    <option key={idx} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldItem}>
                <label>Classificação de Risco</label>
                <select
                  value={draftFilters.classification || ''}
                  onChange={(e) =>
                    handleDraftChange('classification', e.target.value)
                  }
                >
                  <option value="">Todas</option>
                  <option value="Verde">Verde (Eletivo)</option>
                  <option value="Amarelo">Amarelo (Prioritário)</option>
                  <option value="Vermelho">Vermelho (Urgente)</option>
                </select>
              </div>

              {/* Tipo de Cota — habilitado apenas em Liberados */}
              <div className={styles.fieldItem}>
                <label>Tipo de Cota</label>
                <select
                  value={draftFilters.quotaType || ''}
                  onChange={(e) => handleDraftChange('quotaType', e.target.value)}
                  disabled={!isLiberados}
                >
                  <option value="">Todas</option>
                  <option value="SUS">SUS</option>
                  <option value="OCI">OCI</option>
                  <option value="PPI">PPI</option>
                  <option value="Credenciamento">Credenciamento</option>
                </select>
              </div>

              {/* Status do Pedido — habilitado nas duas telas */}
              <div className={styles.fieldItem}>
                <label>Status do Pedido</label>
                <select
                  value={draftFilters.orderStatus || ''}
                  onChange={(e) => handleDraftChange('orderStatus', e.target.value)}
                >
                  <option value="">Todos</option>
                  {STATUS_PEDIDO.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Status de Comunicação — habilitado apenas em Lista de Espera */}
              <div className={styles.fieldItem}>
                <label>Status de Comunicação</label>
                <select
                  value={draftFilters.communicationStatus || ''}
                  onChange={(e) =>
                    handleDraftChange('communicationStatus', e.target.value)
                  }
                  disabled={!isListaEspera}
                >
                  <option value="">Todas</option>
                  {STATUS_COMUNICACAO.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Data de Comunicação (preenchida x não preenchida) — Lista de Espera */}
              <div className={styles.fieldItem}>
                <label>Data Comunicação</label>
                <select
                  value={draftFilters.communicationFilled || ''}
                  onChange={(e) =>
                    handleDraftChange('communicationFilled', e.target.value)
                  }
                  disabled={!isListaEspera}
                >
                  <option value="">Todas</option>
                  <option value="FILLED">Preenchida</option>
                  <option value="EMPTY">Não preenchida</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.filterSection}>
            <span className={styles.sectionTitle}>Filtros por Período / Datas</span>
            <div className={styles.filterGridDates}>
              {/* Período Entrada — habilitado em Lista de Espera */}
              <div className={styles.fieldItem}>
                <label>Período Entrada</label>
                <div className={styles.dateRangeBox}>
                  <input
                    type="date"
                    value={draftFilters.entryDateStart || ''}
                    onChange={(e) => handleDraftChange('entryDateStart', e.target.value)}
                    disabled={!isListaEspera}
                  />
                  <span>até</span>
                  <input
                    type="date"
                    value={draftFilters.entryDateEnd || ''}
                    onChange={(e) => handleDraftChange('entryDateEnd', e.target.value)}
                    disabled={!isListaEspera}
                  />
                </div>
              </div>

              {/* Período Comunicação — habilitado em Lista de Espera */}
              <div className={styles.fieldItem}>
                <label>Período Comunicação</label>
                <div className={styles.dateRangeBox}>
                  <input
                    type="date"
                    value={draftFilters.communicationDateStart || ''}
                    onChange={(e) => handleDraftChange('communicationDateStart', e.target.value)}
                    disabled={!isListaEspera}
                  />
                  <span>até</span>
                  <input
                    type="date"
                    value={draftFilters.communicationDateEnd || ''}
                    onChange={(e) => handleDraftChange('communicationDateEnd', e.target.value)}
                    disabled={!isListaEspera}
                  />
                </div>
              </div>

              {/* Período Liberação — habilitado em Liberados */}
              <div className={styles.fieldItem}>
                <label>Período Liberação</label>
                <div className={styles.dateRangeBox}>
                  <input
                    type="date"
                    value={draftFilters.releaseDateStart || ''}
                    onChange={(e) => handleDraftChange('releaseDateStart', e.target.value)}
                    disabled={!isLiberados}
                  />
                  <span>até</span>
                  <input
                    type="date"
                    value={draftFilters.releaseDateEnd || ''}
                    onChange={(e) => handleDraftChange('releaseDateEnd', e.target.value)}
                    disabled={!isLiberados}
                  />
                </div>
              </div>

              {/* Período Faturamento — habilitado em Liberados */}
              <div className={styles.fieldItem}>
                <label>Período Faturamento</label>
                <div className={styles.dateRangeBox}>
                  <input
                    type="date"
                    value={draftFilters.billingDateStart || ''}
                    onChange={(e) => handleDraftChange('billingDateStart', e.target.value)}
                    disabled={!isLiberados}
                  />
                  <span>até</span>
                  <input
                    type="date"
                    value={draftFilters.billingDateEnd || ''}
                    onChange={(e) => handleDraftChange('billingDateEnd', e.target.value)}
                    disabled={!isLiberados}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.bottomFilterActions}>
            <button
              type="button"
              className={styles.clearFilterBtn}
              onClick={handleClear}
            >
              Limpar
            </button>
            <button
              type="button"
              className={styles.applyFilterBtn}
              onClick={handleApplyFilters}
            >
              Filtrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}