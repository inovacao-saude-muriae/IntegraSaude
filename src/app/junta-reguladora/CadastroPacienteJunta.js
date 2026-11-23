'use client';

import { useState, useRef, useEffect } from 'react';
import { buscarPessoaExistente } from './actions';
import { useConfirm } from '@/components/ConfirmDialog';
import { documentoPaciente } from '@/app/regulacao/constants';
import { mascararTelefone } from '@/lib/telefone';
import { pessoaAptaParaVinculo } from '@/components/cadastros/SituacaoPessoa';
import IdentificacaoPaciente from '@/components/IdentificacaoPaciente';
import { formatarCpfExibicao } from '@/lib/cpf';
import '@/components/cadastros/padraoCadastro.css';
import styles from './CadastroPacienteJunta.module.css';

const LOCAIS_DISPONIVEIS = [
  'CAEE',
  'APAE',
  'Ambulatório',
  'Centro de Especialidades',
];

const TIPOS_DEFICIENCIA = ['Física', 'Intelectual', 'Visual', 'Auditiva'];

export default function CadastroPacienteJunta({
  onCadastrar,
  titulo = 'Cadastrar Novo Pedido',
}) {
  const confirm = useConfirm();

  // Pessoa selecionada (cadastro em /pessoas). Aqui só se anexa dados da Junta.
  const [pessoa, setPessoa] = useState(null);
  // Texto da busca do container (controlado pelo componente único).
  const [buscaTexto, setBuscaTexto] = useState('');
  const [tiposDeficiencia, setTiposDeficiencia] = useState([]);
  const [locaisEncaminhados, setLocaisEncaminhados] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const formatCPF = (cpf) => {
    if (!cpf) return '';
    return formatarCpfExibicao(cpf);
  };

  const handleSelectPessoa = (p) => {
    if (!p) return handleClear(); // campo editado: descarta a seleção
    // `p.situacao` vem da pessoa central e é apenas exibido (somente leitura).
    setPessoa(p);
    setBuscaTexto(p.nomeCompleto || p.nome || '');
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
    setBuscaTexto('');
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
    <div className="paginaContainer">
      <div className="paginaPainel">
        <h2 className={styles.cardTitle}>{titulo}</h2>

        {/* BLOCO 1 — IDENTIFICAÇÃO DO PACIENTE: container ÚNICO, o mesmo
            componente e layout da Regulação (Novo Pedido) e da Farmácia
            Judicial. Dados da tabela central `pessoa`, somente leitura;
            só a busca é editável. */}
        <IdentificacaoPaciente
          titulo="1. Identificação do Paciente"
          buscaLabel="Nome do Paciente"
          buscaPlaceholder="Digite o nome ou CPF para buscar..."
          buscaTexto={buscaTexto}
          onBuscaTextoChange={setBuscaTexto}
          onSelect={handleSelectPessoa}
          buscar={(termo) => buscarPessoaExistente(termo)}
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
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={salvando || !pessoa || !pessoaAptaParaVinculo(pessoa?.situacao)}
            >
              {salvando ? 'Salvando...' : 'Salvar Dados da Junta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}