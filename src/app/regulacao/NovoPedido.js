'use client';

import styles from './NovoPedido.module.css';
import { useUnsavedChanges } from './hooks/useUnsavedChanges';
import { LOCAIS_REALIZACAO } from './constants';
import { mascararTelefone } from '@/lib/telefone';
import { pessoaAptaParaVinculo } from '@/components/cadastros/SituacaoPessoa';
import IdentificacaoPaciente from '@/components/IdentificacaoPaciente';
import '@/components/cadastros/padraoCadastro.css';

export default function NovoPedido({
  newRequest = {
    patientSearch: '',
    patientName: '',
    situacao: '',
    motherName: '',
    cpf: '',
    susCard: '',
    examTypeId: '',
    procedureId: '',
    medicoSolicitanteId: '',
    ubsResponsavelId: '',
    classification: 'Verde',
    justification: '',
  },
  setNewRequest = () => {},
  handleCreateRequest = () => {},
  auxData = { tiposExame: [], medicos: [], ubsList: [], pessoas: [] },
  availableProcedures = [],
  handleSelectPatientSuggestion = () => {},
  handleExamTypeChange = () => {},
  handleProcedureChange = () => {},
}) {
  // Fonte de busca do SeletorPaciente: filtra a lista de pessoas (auxData.pessoas),
  // que já traz TODOS os campos usados ao selecionar (sexo, telefone, UBS, endereço...).
  // Mantém a mesma fonte de dados usada antes pelo dropdown inline.
  const buscarPessoas = async (termo) => {
    const lista = auxData.pessoas || [];
    const alvo = (termo || '').toLowerCase().trim();
    if (!alvo) return lista;
    const cleanSearch = alvo.replace(/\D/g, '');
    return lista.filter((p) => {
      const matchName = (p.nomeCompleto || '').toLowerCase().includes(alvo);
      const matchMother = (p.nomeMae || '').toLowerCase().includes(alvo);
      const cleanCpf = (p.cpf || '').replace(/\D/g, '');
      const matchCpf = cleanSearch ? cleanCpf.includes(cleanSearch) : false;
      return matchName || matchMother || matchCpf;
    });
  };

  const isDirty = Boolean(
    newRequest.patientName ||
    newRequest.cpf ||
    newRequest.examTypeId ||
    newRequest.procedureId ||
    newRequest.justification
  );

  useUnsavedChanges(isDirty);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (handleCreateRequest) {
      await handleCreateRequest(e);
    }
  };

  // Seleção pelo SeletorPaciente: preserva 100% do comportamento anterior,
  // chamando handleSelectPatientSuggestion (preenche cpf, cns, susCard, sexo,
  // telefone, UBS, endereço etc.). Ignora null (campo apenas editado/limpo).
  const handleSelectPerson = (pessoa) => {
    if (!pessoa) return;
    handleSelectPatientSuggestion(pessoa);
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Cadastrar Novo Pedido</h2>

      <form onSubmit={onSubmit} className={styles.patientFormContainer}>
        
        {/* SEÇÃO 1: BUSCA E IDENTIFICAÇÃO DO PACIENTE
            Container ÚNICO e reutilizável (também usado pelo Prontuário da
            Junta): mesmos campos, grid e estilos. A busca e a seleção continuam
            chamando handleSelectPatientSuggestion (preenche newRequest). */}
        <IdentificacaoPaciente
          titulo="1. Identificação do Paciente"
          buscaLabel="Nome do Paciente"
          buscaPlaceholder="Digite o nome ou CPF para buscar..."
          buscaTexto={newRequest.patientSearch || ''}
          onBuscaTextoChange={(v) =>
            setNewRequest((prev) => ({ ...prev, patientSearch: v }))
          }
          onSelect={handleSelectPerson}
          buscar={buscarPessoas}
          cpfSelecionado={newRequest.cpf}
          paciente={{
            nomeMae: newRequest.motherName,
            dataNascimento: newRequest.dataNascimento,
            sexo: newRequest.sexo,
            telefone: newRequest.telefone,
            cpf: newRequest.cpf,
            cns: newRequest.susCard,
            situacao: newRequest.situacao,
            ubsReferencia: newRequest.ubsReferencia,
            // Endereço completo do cadastro central (pessoa_endereco).
            logradouro: newRequest.logradouro,
            numero: newRequest.numero,
            complemento: newRequest.complemento,
            bairro: newRequest.bairro,
            cidade: newRequest.cidade,
            uf: newRequest.uf,
            cep: newRequest.cep,
          }}
        />

        {/* SEÇÃO 2: DETALHES DO PEDIDO */}
        <div className={styles.formSection}>
          <div className={styles.formSectionHeader}>
            <h4>2. Detalhes do pedido</h4>
          </div>

          <div className={styles.formGridStrict}>
            <div className={`${styles.fieldGroup} ${styles.colExamType}`}>
              <label>Tipo de Exame *</label>
              <select value={newRequest.examTypeId || ''} onChange={handleExamTypeChange} required>
                <option value="">Selecione o Exame</option>
                {auxData.tiposExame?.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colProcedure}`}>
              <label>Procedimento Específico *</label>
              <select
                value={newRequest.procedureId || ''}
                onChange={handleProcedureChange}
                disabled={!newRequest.examTypeId}
                required
              >
                <option value="">
                  {!newRequest.examTypeId
                    ? 'Selecione primeiro o Exame'
                    : '-- Selecione o Procedimento --'}
                </option>
                {availableProcedures?.map((proc) => (
                  <option key={proc.id} value={proc.id}>
                    {proc.nome} (R$ {Number(proc.valor || 0).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colLocal}`}>
              <label>Local de Realização</label>
              <select
                value={newRequest.localRealizacao || ''}
                onChange={(e) => setNewRequest({ ...newRequest, localRealizacao: e.target.value })}
              >
                <option value="">-- Selecione --</option>
                {LOCAIS_REALIZACAO.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colDoctor}`}>
              <label>Médico Solicitante *</label>
              <select
                value={newRequest.medicoSolicitanteId || ''}
                onChange={(e) => setNewRequest({ ...newRequest, medicoSolicitanteId: e.target.value })}
                required
              >
                <option value="">Selecione o Médico</option>
                {auxData.medicos
                  ?.filter((m) => m.tipo === 'Solicitante')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} (CRM: {m.crm})
                    </option>
                  ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.colRisk}`}>
              <label>Classificação de Risco *</label>
              <select
                value={newRequest.classification || 'Verde'}
                onChange={(e) => setNewRequest({ ...newRequest, classification: e.target.value })}
                required
              >
                <option value="Verde">Verde (Eletivo)</option>
                <option value="Amarelo">Amarelo (Prioritário)</option>
                <option value="Vermelho">Vermelho (Urgente)</option>
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
              <label htmlFor="justification">Justificativa do Pedido (Quadro Clínico)</label>
              <textarea
                id="justification"
                rows="3"
                placeholder="Descreva a justificativa médica e o quadro clínico do paciente..."
                value={newRequest.justification || ''}
                onChange={(e) => setNewRequest({ ...newRequest, justification: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={!pessoaAptaParaVinculo(newRequest.situacao)}
            title={
              pessoaAptaParaVinculo(newRequest.situacao)
                ? undefined
                : 'Pessoa com situação cadastral Falecido. Não é possível realizar novos vínculos.'
            }
          >
                Cadastrar
          </button>
        </div>
      </form>
    </div>
  );
}