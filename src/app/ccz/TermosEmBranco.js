'use client';

import { gerarTermoPdf as gerarTermoPdfModelo } from './termoCcz';
import styles from './ListaCCZ.module.css';
import stylesModal from './TermoProcedimento.module.css';

const TERMOS_DISPONIVEIS = [
  {
    id: 1,
    nome: 'Termo de Procedimento Veterinário',
    descricao: 'Termo de consentimento para procedimentos veterinários em geral',
    tipo: 'procedimento'
  },
  {
    id: 2,
    nome: 'Termo de Vistoria / Esporotricose',
    descricao: 'Termo de orientação sobre esporotricose felina e medidas de controle',
    tipo: 'esporotricose'
  },
  {
    id: 4,
    nome: 'Termo de Compromisso e Responsabilidade',
    descricao: 'Termo para denúncias de comportamento agressivo de animais',
    tipo: 'denuncia'
  }
];

function gerarTermoPdf(termo) {
  return gerarTermoPdfModelo(termo.tipo, { emBranco: true });
}

export default function TermosEmBranco() {

  return (
    <div className={styles.container}>
      <div className={`${styles.card} ${styles.formCard}`}>
        <div className={styles.listaHeader}>
          <h2 className={styles.cardHeaderTitle}>Termos Disponíveis</h2>
        </div>

        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
          Clique em um termo para visualizar e baixar o documento em branco para preenchimento manual.
        </p>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome do Termo</th>
                <th>Descrição</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {TERMOS_DISPONIVEIS.map((termo) => (
                <tr key={termo.id} style={{ cursor: 'pointer' }}>
                  <td className={styles.boldName}>
                    {termo.nome}
                  </td>
                  <td>{termo.descricao}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={styles.btnFicha}
                      onClick={(e) => {
                        e.stopPropagation();
                        gerarTermoPdf(termo);
                      }}
                      title="Baixar PDF"
                    >
                      ⬇️ Baixar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
