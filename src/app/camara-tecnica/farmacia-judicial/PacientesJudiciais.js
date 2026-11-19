'use client';

import { useState, useRef, useEffect } from 'react';
import { buscarPessoaExistente } from './actions';
import { useConfirm } from '@/components/ConfirmDialog';
import IdentificacaoPaciente from '@/components/IdentificacaoPaciente';
import { pessoaAptaParaVinculo } from '@/components/cadastros/SituacaoPessoa';
import '@/components/cadastros/padraoCadastro.css';
import styles from './PacientesJudiciais.module.css';

const MED_VAZIO = { medicamentoId: '', qtdMensal: '', statusMedication: 'Ativo' };

const PROCESSO_VAZIO = {
  numeroPasta: '',
  numeroProcesso: '',
  // Situação na Farmácia Judicial (operacional) — não confundir com a
  // Situação Cadastral da pessoa, exibida somente para leitura acima.
  status: 'Ativo',
  justificativaInativacao: '',
};

// Situação operacional: só ATIVO e INATIVO (Falecido pertence à Pessoa).
const normalizarSituacaoFarmacia = (v) =>
  String(v || '').trim().toUpperCase() === 'INATIVO' ? 'Inativo' : 'Ativo';

export default function TabPacientesJudiciais({
  pacientes = [],
  catalogo = [],
  onCreatePaciente,
  loading,
}) {
  const confirm = useConfirm();

  // Pessoa selecionada no banco (somente leitura aqui — cadastro vive em /pessoas).
  const [pessoa, setPessoa] = useState(null);
  // Texto do campo de busca do container único de identificação.
  const [buscaTexto, setBuscaTexto] = useState('');
  const [form, setForm] = useState(PROCESSO_VAZIO);
  const [medicamentosForm, setMedicamentosForm] = useState([{ ...MED_VAZIO }]);
  const [salvando, setSalvando] = useState(false);

  // Fonte de busca do container: cadastro central (inclui falecidos, cujo
  // vínculo novo é bloqueado depois, no frontend e no backend).
  const buscarPessoas = async (termo) => {
    const lista = await buscarPessoaExistente(termo);
    return Array.isArray(lista) ? lista : [];
  };

  const handleSelectPessoa = (p) => {
    if (!p) return handleClear(); // campo editado: descarta a seleção
    // `p.situacao` vem da pessoa central e é apenas exibido (somente leitura).
    setPessoa(p);
    setBuscaTexto(p.nomeCompleto || p.nome || '');

    // Se a pessoa já for paciente judicial, carrega processo + medicamentos.
    const pacienteExistente = pacientes.find(
      (pc) => (pc.cpf || '').replace(/\D/g, '') === (p.cpf || '').replace(/\D/g, ''),
    );

    if (pacienteExistente) {
      setForm({
        numeroPasta: pacienteExistente.numeroPasta || '',
        numeroProcesso: pacienteExistente.numeroProcesso || '',
        status: normalizarSituacaoFarmacia(pacienteExistente.status),
        // Justificativa anteriormente registrada (somente leitura do histórico).
        justificativaInativacao: pacienteExistente.justificativaInativacao || '',
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
    setBuscaTexto('');
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
    // Justificativa obrigatória quando a situação for Inativo.
    if (form.status === 'Inativo' && form.justificativaInativacao.trim().length < 15) {
      return alert('Informe a Justificativa da Inativação (mínimo de 15 caracteres).');
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
      justificativaInativacao:
        form.status === 'Inativo' ? form.justificativaInativacao.trim() : '',
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
        {/* SEÇÃO 1: IDENTIFICAÇÃO DO PACIENTE — container ÚNICO e compartilhado
            (mesmo componente, grid e estilos da Regulação e do Prontuário da
            Junta). Campos somente leitura, vindos do cadastro central `pessoa`. */}
        <IdentificacaoPaciente
          titulo="1. Identificação do Paciente"
          buscaLabel="Nome do Paciente"
          buscaPlaceholder="Digite o nome ou CPF para buscar..."
          buscaTexto={buscaTexto}
          onBuscaTextoChange={setBuscaTexto}
          onSelect={handleSelectPessoa}
          buscar={buscarPessoas}
          incluirIndisponiveis
          cpfSelecionado={pessoa?.cpf || ''}
          paciente={
            pessoa
              ? {
                  nomeMae: pessoa.nomeMae,
                  dataNascimento: pessoa.dataNascimento,
                  sexo: pessoa.sexo,
                  telefone: pessoa.telefone,
                  cpf: pessoa.cpf,
                  cns: pessoa.cns,
                  situacao: pessoa.situacao,
                  ubsReferencia: pessoa.ubsReferencia,
                  logradouro: pessoa.logradouro,
                  numero: pessoa.numero,
                  complemento: pessoa.complemento,
                  bairro: pessoa.bairro,
                  cidade: pessoa.cidade,
                  uf: pessoa.uf,
                  cep: pessoa.cep,
                }
              : null
          }
        />
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
                    <label>Situação na Farmácia Judicial *</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: e.target.value,
                          // Ao voltar para Ativo o campo some e o texto é limpo;
                          // o histórico da inativação anterior fica no registro.
                          justificativaInativacao:
                            e.target.value === 'Ativo' ? '' : form.justificativaInativacao,
                        })
                      }
                      required
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>

                  {/* Justificativa: aparece SOMENTE com a situação Inativo. */}
                  {form.status === 'Inativo' && (
                    <div className={`${styles.fieldGroup} ${styles.colJustificativa}`}>
                      <label>Justificativa da Inativação *</label>
                      <textarea
                        rows={2}
                        maxLength={500}
                        placeholder="Descreva o motivo da inativação na Farmácia Judicial..."
                        value={form.justificativaInativacao}
                        onChange={(e) =>
                          setForm({ ...form, justificativaInativacao: e.target.value })
                        }
                        required
                      />
                      {form.justificativaInativacao.trim().length < 15 && (
                        <small className={styles.fieldHint}>
                          Mínimo de 15 caracteres.
                        </small>
                      )}
                    </div>
                  )}
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
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={salvando || loading || !pessoaAptaParaVinculo(pessoa?.situacao)}
                >
                  {salvando ? 'Salvando...' : 'Salvar Processo e Medicamentos'}
                </button>
              </div>
            </form>
      </div>
    </div>
  );
}
