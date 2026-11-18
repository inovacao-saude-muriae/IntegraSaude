'use client';

// CONTAINER ÚNICO de identificação do paciente (somente leitura).
//
// Reutilizado por todas as telas que precisam mostrar os dados da tabela central
// `pessoa` a partir de uma busca: Regulação (Novo Pedido) e Prontuário da Junta
// Reguladora. A estrutura, os campos, o grid e os estilos vivem AQUI — nenhuma
// tela recria o modelo. Os dados são sempre de exibição: a edição continua
// exclusivamente no Gerenciamento > Cadastro de Pessoas.
import { mascararTelefone } from '@/lib/telefone';
import { formatarCpfExibicao } from '@/lib/cpf';
import SeletorPaciente from '@/components/SeletorPaciente';
import SituacaoPessoa from '@/components/cadastros/SituacaoPessoa';
import '@/components/cadastros/padraoCadastro.css';
import styles from './IdentificacaoPaciente.module.css';

// dd/mm/aaaa a partir de ISO (sem passar por Date: evita efeito de fuso).
// Aceita também valores já formatados no servidor.
const formatarData = (v) => {
  const s = String(v || '');
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
};

export default function IdentificacaoPaciente({
  titulo = 'Identificação do Paciente',
  // Busca (SeletorPaciente): controlada por quem usa o componente.
  buscaLabel = 'Nome completo',
  buscaPlaceholder = 'Digite nome ou CPF para buscar...',
  buscaTexto = '',
  onBuscaTextoChange = () => {},
  onSelect = () => {},
  buscar,
  buscaAtiva = true,
  incluirIndisponiveis = false,
  cpfSelecionado = '',
  // Dados do paciente selecionado (tabela central `pessoa`).
  paciente = null,
}) {
  const p = paciente || {};
  return (
    <div className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <h4>{titulo}</h4>
      </div>

      <div className={styles.formGridStrict}>
        <div className={`${styles.fieldGroup} ${styles.colName}`}>
          <SeletorPaciente
            label={buscaLabel}
            required
            placeholder={buscaPlaceholder}
            texto={buscaTexto}
            onTextoChange={onBuscaTextoChange}
            onSelect={onSelect}
            buscar={buscar}
            buscaAtiva={buscaAtiva}
            incluirIndisponiveis={incluirIndisponiveis}
            cpfSelecionado={cpfSelecionado}
          />
          <p className={styles.helperNote}>
            A pessoa precisa estar cadastrada em{' '}
            <strong>Gerenciamento &gt; Cadastro de Pessoas</strong>.
          </p>
        </div>

        <div className={`${styles.fieldGroup} ${styles.colMother}`}>
          <label>Nome da Mãe</label>
          <input
            type="text"
            value={p.nomeMae || ''}
            readOnly
            placeholder="Nome da Mãe"
            className={styles.readOnlyInput}
          />
        </div>

        <div className={`${styles.fieldGroup} ${styles.colSmall}`}>
          <label>Data de nascimento</label>
          <input
            type="text"
            value={formatarData(p.dataNascimento)}
            readOnly
            placeholder="dd/mm/aaaa"
            className={styles.readOnlyInput}
          />
        </div>

        <div className={`${styles.fieldGroup} ${styles.colSmall}`}>
          <label>Sexo</label>
          <input
            type="text"
            value={p.sexo || ''}
            readOnly
            placeholder="—"
            className={styles.readOnlyInput}
          />
        </div>

        <div className={`${styles.fieldGroup} ${styles.colSmall}`}>
          <label>Telefone</label>
          <input
            type="text"
            value={mascararTelefone(p.telefone)}
            readOnly
            placeholder="(00) 00000-0000"
            className={styles.readOnlyInput}
          />
        </div>

        <div className={`${styles.fieldGroup} ${styles.colCpf}`}>
          <label>CPF *</label>
          <input
            type="text"
            value={formatarCpfExibicao(p.cpf) || ''}
            readOnly
            placeholder="000.000.000-00"
            className={styles.readOnlyInput}
          />
        </div>

        <div className={`${styles.fieldGroup} ${styles.colSus}`}>
          <label>Cartão SUS</label>
          <input
            type="text"
            value={p.cns || ''}
            readOnly
            placeholder="700000000000000"
            className={styles.readOnlyInput}
          />
        </div>

        <SituacaoPessoa
          situacao={p.situacao || ''}
          className={`${styles.fieldGroup} ${styles.colSituacao}`}
        />

        <div className={`${styles.fieldGroup} ${styles.colUbsRef}`}>
          <label>UBS de referência</label>
          <input
            type="text"
            value={p.ubsReferencia || ''}
            readOnly
            placeholder="—"
            className={styles.readOnlyInput}
          />
        </div>
      </div>
    </div>
  );
}
