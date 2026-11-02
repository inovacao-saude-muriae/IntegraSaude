'use client';

import { useState, useRef, useEffect } from 'react';
import { buscarPessoaExistente } from './actions';
import { useConfirm } from '@/components/ConfirmDialog';
import { documentoPaciente } from '@/app/regulacao/constants';
import { mascararTelefone } from '@/lib/telefone';
import SeletorPaciente from '@/components/SeletorPaciente';
import styles from './PacientesJudiciais.module.css';

const MED_VAZIO = { medicamentoId: '', qtdMensal: '', statusMedication: 'Ativo' };

const PROCESSO_VAZIO = {
  numeroPasta: '',
  numeroProcesso: '',
  status: 'Ativo',
};

export default function TabPacientesJudiciais({
  pacientes = [],
  catalogo = [],
  onCreatePaciente,
  loading,
}) {
  const confirm = useConfirm();

  // Pessoa selecionada no banco (somente leitura aqui — cadastro vive em /pessoas).
  const [pessoa, setPessoa] = useState(null);
  const [form, setForm] = useState(PROCESSO_VAZIO);
  const [medicamentosForm, setMedicamentosForm] = useState([{ ...MED_VAZIO }]);
  const [salvando, setSalvando] = useState(false);

  const formatCPF = (cpf) => {
    if (!cpf) return '';
    const d = cpf.replace(/\D/g, '');
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleSelectPessoa = (p) => {
    setPessoa(p);

    // Se a pessoa já for paciente judicial, carrega processo + medicamentos.
    const pacienteExistente = pacientes.find(
      (pc) => (pc.cpf || '').replace(/\D/g, '') === (p.cpf || '').replace(/\D/g, ''),
    );

    if (pacienteExistente) {
      setForm({
        numeroPasta: pacienteExistente.numeroPasta || '',
        numeroProcesso: pacienteExistente.numeroProcesso || '',
        status: pacienteExistente.status || 'Ativo',
      });
      if (pacienteExistente.medicamentosLista?.length > 0) {
        setMedicamentosForm(
          pacienteExistente.medicamentosLista.map((m) => ({
            medicamentoId: m.medicamentoId || m.id || '',
            qtdMensal: m.qtdMensal || m.quantidade || '',
            statusMedication: m.statusMedication || m.status || 'Ativo',
          })),
        );
      } else {
        setMedicamentosForm([{ ...MED_VAZIO }]);
      }
    } else {
      setForm(PROCESSO_VAZIO);
      setMedicamentosForm([{ ...MED_VAZIO }]);
    }
  };

  const handleClear = () => {
    setPessoa(null);
    setForm(PROCESSO_VAZIO);
    setMedicamentosForm([{ ...MED_VAZIO }]);
  };

  const handleAddMedRow = () => setMedicamentosForm((prev) => [...prev, { ...MED_VAZIO }]);
  const handleRemoveMedRow = (index) =>
    setMedicamentosForm((prev) => prev.filter((_, i) => i !== index));
  const handleMedChange = (index, field, value) =>
    setMedicamentosForm((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pessoa) return alert('Busque e selecione a pessoa no banco primeiro.');
    if (!form.numeroPasta || !form.numeroProcesso) {
      return alert('Informe o número da pasta e do processo.');
    }

    const ok = await confirm({
      title: 'Salvar paciente judicial',
      message: 'Deseja confirmar o cadastro do processo e medicamentos?',
      confirmText: 'Salvar',
    });
    if (!ok) return;

    setSalvando(true);
    const payload = {
      cpf: pessoa.cpf,
      numeroPasta: form.numeroPasta,
      numeroProcesso: form.numeroProcesso,
      status: form.status,
      medicamentos: medicamentosForm.filter((m) => m.medicamentoId && m.qtdMensal),
    };

    const res = await onCreatePaciente(payload);
    setSalvando(false);
    if (res?.success !== false) {
      handleClear();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {/* SEÇÃO 1: IDENTIFICAÇÃO DO PACIENTE (estilo Novo Pedido) */}
        <div className={styles.identSection}>
          <div className={styles.identHeader}>
            <h4>1. Identificação do Paciente</h4>
          </div>

          {/* CAMPOS NOME, CPF E NOME DA MÃE NA MESMA LINHA */}
          <div className={styles.dataGrid}>
            <div className={`${styles.field} ${styles.colName}`}>
              <SeletorPaciente
                onSelect={handleSelectPessoa}
                label="Nome completo"
                placeholder="Digite nome ou CPF para buscar..."
                required
                value={pessoa}
              />
            </div>
            
            <div className={`${styles.field} ${styles.colCpf}`}>
              <label>CPF</label>
              <input type="text" value={pessoa ? formatCPF(pessoa.cpf) : ''} disabled readOnly placeholder="000.000.000-00" />
            </div>
            
            <div className={`${styles.field} ${styles.colMother}`}>
              <label>Nome da mãe</label>
              <input type="text" value={pessoa?.nomeMae || ''} disabled readOnly placeholder="—" />
            </div>
          </div>
        </div>
        {/* FIM DA SEÇÃO 1 */}

            <form onSubmit={handleSubmit} className={styles.formContainer}>
              {/* DADOS DO PROCESSO JUDICIAL */}
              <div className={styles.cardSection}>
                <h3 className={styles.sectionHeaderTitle}>DADOS DO PROCESSO JUDICIAL</h3>
                <div className={styles.gridProcesso}>
                  <div className={styles.fieldGroup}>
                    <label>Nº Pasta Judicial *</label>
                    <input
                      type="text"
                      placeholder="Ex: PJ-2026/089"
                      value={form.numeroPasta}
                      onChange={(e) => setForm({ ...form, numeroPasta: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Nº do Processo Judicial *</label>
                    <input
                      type="text"
                      placeholder="Ex: 5001234-56.2026.8.13.0439"
                      value={form.numeroProcesso}
                      onChange={(e) => setForm({ ...form, numeroProcesso: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Status do Paciente *</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      required
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Falecido">Falecido</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* MEDICAMENTOS E PRESCRIÇÃO MENSAL */}
              <div className={styles.cardSection}>
                <h3 className={styles.sectionHeaderTitle}>MEDICAMENTOS E PRESCRIÇÃO MENSAL</h3>
                {medicamentosForm.map((med, idx) => (
                  <div key={idx} className={styles.treatmentGrid}>
                    <div className={styles.fieldGroup}>
                      <label>Medicamento do Catálogo</label>
                      <select
                        value={med.medicamentoId}
                        onChange={(e) => handleMedChange(idx, 'medicamentoId', e.target.value)}
                      >
                        <option value="">-- Selecione do Catálogo --</option>
                        {catalogo.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nome} ({item.dosagem})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label>Qtd Prescrita Mensal</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Ex: 30"
                        value={med.qtdMensal}
                        onChange={(e) => handleMedChange(idx, 'qtdMensal', e.target.value)}
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label>Status do Medicamento</label>
                      <select
                        value={med.statusMedication || 'Ativo'}
                        onChange={(e) => handleMedChange(idx, 'statusMedication', e.target.value)}
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                        <option value="Descontinuado">Descontinuado</option>
                      </select>
                    </div>

                    {medicamentosForm.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedRow(idx)}
                        className={styles.removeRowBtn}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                ))}

                <button type="button" onClick={handleAddMedRow} className={styles.addRowBtn}>
                  + Adicionar Outro Medicamento
                </button>
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={handleClear} className={styles.secondaryBtn} disabled={salvando}>
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={salvando || loading}>
                  {salvando ? 'Salvando...' : 'Salvar Processo e Medicamentos'}
                </button>
              </div>
            </form>
      </div>
    </div>
  );
}
