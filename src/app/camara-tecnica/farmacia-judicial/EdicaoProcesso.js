'use client';

import { useState } from 'react';
import IdentificacaoPaciente from '@/components/IdentificacaoPaciente';
import '@/components/cadastros/padraoCadastro.css';
import styles from './PacientesJudiciais.module.css';

const MED_VAZIO = { medicamentoId: '', qtdMensal: '', statusMedication: 'Ativo' };

// Situação do processo: ATIVO/INATIVO; valores legados são lidos como Inativo.
const normalizarSituacao = (v) =>
  String(v || '').trim().toUpperCase() === 'INATIVO' ? 'Inativo' : 'Ativo';

/**
 * Formulário de EDIÇÃO do processo da Farmácia Judicial — MESMO padrão visual
 * do Novo Processo dos Procedimentos Cirúrgicos: container único de
 * identificação (somente leitura), Informações do Processo e Medicamentos.
 *
 * A situação só é alterável aqui; ao selecionar Inativo, a justificativa é
 * obrigatória e ocupa a linha inteira. Ao reativar, o campo some e o histórico
 * da última inativação é preservado no registro/auditoria.
 */
export default function EdicaoProcesso({
  processo,
  paciente,
  catalogo = [],
  salvando = false,
  onCancelar,
  onSalvar,
}) {
  const [numeroProcesso, setNumeroProcesso] = useState(processo?.numeroProcesso || '');
  const [status, setStatus] = useState(normalizarSituacao(processo?.status));
  const [justificativa, setJustificativa] = useState(processo?.justificativaInativacao || '');
  const [medicamentos, setMedicamentos] = useState(
    processo?.medicamentos?.length
      ? processo.medicamentos.map((m) => ({
          medicamentoId: String(m.medicamentoId || ''),
          qtdMensal: String(m.qtdMensal || ''),
          statusMedication: m.statusMedication || 'Ativo',
        }))
      : [{ ...MED_VAZIO }],
  );
  const [erro, setErro] = useState('');

  const alterarMed = (idx, campo, valor) =>
    setMedicamentos((prev) => {
      const novo = [...prev];
      novo[idx] = { ...novo[idx], [campo]: valor };
      return novo;
    });

  const adicionarMed = () => setMedicamentos((prev) => [...prev, { ...MED_VAZIO }]);
  const removerMed = (idx) =>
    setMedicamentos((prev) => prev.filter((_, i) => i !== idx));

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!numeroProcesso.trim()) return setErro('Informe o número do processo.');
    if (status === 'Inativo' && justificativa.trim().length < 15) {
      return setErro('Informe a Justificativa da Inativação (mínimo de 15 caracteres).');
    }
    await onSalvar({
      numeroPasta: processo.numeroPasta,
      numeroProcesso: numeroProcesso.trim(),
      status,
      justificativaInativacao: status === 'Inativo' ? justificativa.trim() : '',
      medicamentos: medicamentos.filter((m) => m.medicamentoId && m.qtdMensal),
    });
  };

  const inativando = status === 'Inativo';

  return (
    <div className={styles.mainWrapper}>
      <h2 className={styles.tituloAba}>Editar processo judicial</h2>

      {erro && (
        <div className={styles.erroEdicao} role="alert">
          {erro}
        </div>
      )}

      <IdentificacaoPaciente
        titulo="1. Identificação do Paciente"
        buscaLabel="Nome do Paciente"
        buscaPlaceholder="Digite o nome ou CPF para buscar..."
        buscaTexto={paciente?.nomeCompleto || paciente?.nome || ''}
        buscaAtiva={false}
        cpfSelecionado={paciente?.cpf || processo?.pessoaCpf || ''}
        paciente={
          paciente
            ? {
                ...paciente,
                ubsReferencia:
                  paciente.ubsReferencia?.nome || paciente.ubsReferencia || '—',
              }
            : null
        }
      />

      <form onSubmit={salvar} className={styles.formContainer}>
        <div className={styles.cardSection}>
          <h3 className={styles.sectionHeaderTitle}>INFORMAÇÕES DO PROCESSO</h3>
          <div className={styles.gridProcesso}>
            <div className={styles.fieldGroup}>
              <label>Número do Processo *</label>
              <input
                type="text"
                value={numeroProcesso}
                onChange={(e) => setNumeroProcesso(e.target.value)}
                maxLength={100}
                placeholder="Ex: 5001234-56.2026.8.13.0439"
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>Número da Pasta</label>
              <input type="text" value={processo?.numeroPasta || ''} readOnly />
            </div>

            <div className={styles.fieldGroup}>
              <label>Situação do Processo *</label>
              <select
                value={status}
                onChange={(e) => {
                  const valor = e.target.value;
                  setStatus(valor);
                  if (valor === 'Ativo') setJustificativa('');
                }}
                required
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>

            {inativando && (
              <div className={`${styles.fieldGroup} ${styles.colJustificativa}`}>
                <label>Justificativa da Inativação *</label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="Descreva o motivo da inativação do processo..."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  required
                />
                {justificativa.trim().length < 15 && (
                  <small className={styles.fieldHint}>Mínimo de 15 caracteres.</small>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.cardSection}>
          <h3 className={styles.sectionHeaderTitle}>MEDICAMENTOS E PRESCRIÇÃO MENSAL</h3>
          {medicamentos.map((med, idx) => (
            <div key={idx} className={styles.treatmentGrid}>
              <div className={styles.fieldGroup}>
                <label>Medicamento do Catálogo</label>
                <select
                  value={med.medicamentoId}
                  onChange={(e) => alterarMed(idx, 'medicamentoId', e.target.value)}
                >
                  <option value="">-- Selecione do Catálogo --</option>
                  {catalogo.map((item) => (
                    <option key={item.id} value={String(item.id)}>
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
                  onChange={(e) => alterarMed(idx, 'qtdMensal', e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label>Status do Medicamento</label>
                <select
                  value={med.statusMedication || 'Ativo'}
                  onChange={(e) => alterarMed(idx, 'statusMedication', e.target.value)}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Descontinuado">Descontinuado</option>
                </select>
              </div>
              {medicamentos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerMed(idx)}
                  className={styles.removeRowBtn}
                  aria-label="Remover medicamento"
                >
                  🗑
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={adicionarMed} className={styles.addRowBtn}>
            + Adicionar Outro Medicamento
          </button>
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onCancelar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
