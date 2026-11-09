'use client';

import { useState, useRef, useEffect } from 'react';
import { buscarPessoaExistente } from './actions';
import { useConfirm } from '@/components/ConfirmDialog';
import { documentoPaciente } from '@/app/regulacao/constants';
import { mascararTelefone } from '@/lib/telefone';
import SeletorPaciente from '@/components/SeletorPaciente';
import { formatarCpfExibicao } from '@/lib/cpf';
import styles from './CadastroPacienteJunta.module.css';

const LOCAIS_DISPONIVEIS = [
  'CAEE',
  'APAE',
  'Ambulatório',
  'Centro de Especialidades',
];

const TIPOS_DEFICIENCIA = ['Física', 'Intelectual', 'Visual', 'Auditiva'];

export default function CadastroPacienteJunta({ onCadastrar }) {
  const confirm = useConfirm();

  // Pessoa selecionada (cadastro em /pessoas). Aqui só se anexa dados da Junta.
  const [pessoa, setPessoa] = useState(null);
  const [tiposDeficiencia, setTiposDeficiencia] = useState([]);
  const [locaisEncaminhados, setLocaisEncaminhados] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const formatCPF = (cpf) => {
    if (!cpf) return '';
    return formatarCpfExibicao(cpf);
  };

  const handleSelectPessoa = (p) => {
    if (!p) return handleClear(); // campo editado: descarta a seleção
    setPessoa(p);
    // Pré-carrega dados de Junta já existentes, se vierem na busca.
    const existentes = (p.tipoDeficiencia || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setTiposDeficiencia(existentes);
    setLocaisEncaminhados(p.servicosAtivos || []);
  };

  const handleClear = () => {
    setPessoa(null);
    setTiposDeficiencia([]);
    setLocaisEncaminhados([]);
  };

  const handleCheckboxChange = (local) => {
    setLocaisEncaminhados((prev) =>
      prev.includes(local) ? prev.filter((l) => l !== local) : [...prev, local],
    );
  };

  const handleTipoChange = (tipo) => {
    setTiposDeficiencia((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pessoa) return alert('Busque e selecione a pessoa no banco primeiro.');
    if (tiposDeficiencia.length === 0) {
      return alert('Selecione ao menos um tipo de deficiência.');
    }

    const ok = await confirm({
      title: 'Salvar dados da Junta',
      message: 'Deseja confirmar o cadastro dos dados da Junta para este paciente?',
      confirmText: 'Salvar',
    });
    if (!ok) return;

    setSalvando(true);
    const res = await onCadastrar({
      cpf: pessoa.cpf,
      tipoDeficiencia: tiposDeficiencia.join(', '),
      locaisEncaminhados,
    });
    setSalvando(false);
    if (res?.success !== false) handleClear();
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {/* SEÇÃO 1: IDENTIFICAÇÃO DO PACIENTE (estilo Novo Pedido) */}
        <div className={styles.identSection}>
          <div className={styles.identHeader}>
            <h4>1. Identificação do Paciente</h4>
          </div>

          {/* SELETOR DE PACIENTE E DADOS NA MESMA LINHA */}
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
            
            <div className={`${styles.field} ${styles.colMed}`}>
              <label>Telefone / WhatsApp</label>
              <input type="text" value={mascararTelefone(pessoa?.telefone)} disabled readOnly placeholder="(00) 00000-0000" />
            </div>
          </div>
        </div>
        {/* FIM DA SEÇÃO 1 */}

        <form onSubmit={handleSubmit} className={styles.formContainer}>
          {/* TIPO DE DEFICIÊNCIA */}
          <div className={styles.cardSection}>
            <h3 className={styles.sectionHeaderTitle}>
              Tipo de Deficiência * (pode selecionar mais de um)
            </h3>
            <div className={styles.checkboxGrid}>
              {TIPOS_DEFICIENCIA.map((tipo) => (
                <label key={tipo} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={tiposDeficiencia.includes(tipo)}
                    onChange={() => handleTipoChange(tipo)}
                  />
                  {tipo}
                </label>
              ))}
            </div>
          </div>

          {/* LOCAIS DE ENCAMINHAMENTO */}
          <div className={styles.cardSection}>
            <h3 className={styles.sectionHeaderTitle}>
              Locais de Encaminhamento / Vinculados
            </h3>
            <div className={styles.checkboxGrid}>
              {LOCAIS_DISPONIVEIS.map((local) => (
                <label key={local} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={locaisEncaminhados.includes(local)}
                    onChange={() => handleCheckboxChange(local)}
                  />
                  {local}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={handleClear} className={styles.secondaryBtn} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={salvando || !pessoa}>
              {salvando ? 'Salvando...' : 'Salvar Dados da Junta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}