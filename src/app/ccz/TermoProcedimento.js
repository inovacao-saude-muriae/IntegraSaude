'use client';

import { useRef } from 'react';
import Image from 'next/image';
import styles from './TermoProcedimento.module.css';
import { gerarTermoProcedimentoPdf } from './termoProcedimentoPdf';

export default function TermoProcedimento({ procedimento, onFechar }) {
  const termoRef = useRef(null);

  const formatarData = (data) => {
    if (!data) return '___/___/_____';
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  const handleBaixar = () => {
    // Adicionar dados do tutor e animal se existirem
    const dadosCompletos = {
      ...procedimento,
      tutor: procedimento.tutor || null,
      animal: procedimento.animal || null
    };
    gerarTermoProcedimentoPdf(dadosCompletos);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* CONTEÚDO DO TERMO */}
        <div className={styles.termo} ref={termoRef}>
          {/* CABEÇALHO */}
          <div className={styles.cabecalho}>
            <div className={styles.logoBox}>
              <Image
                src="/img/logo/logo-ccz.png"
                alt="Logo CCZ"
                width={80}
                height={80}
                className={styles.logoImage}
              />
            </div>
            <div className={styles.tituloBox}>
              <h1>CENTRO DE CONTROLE DE ZOONOSES</h1>
              <h2>TERMO DE PROCEDIMENTO VETERINÁRIO</h2>
            </div>
          </div>

          <div className={styles.linha}></div>

          {/* TEXTO EXPLICATIVO */}
          <div className={styles.secao}>
            <div className={styles.textoExplicativo}>
              <p>
                Eu, <strong>{procedimento.tutor?.nome || 'Sem tutor'}</strong>
                {procedimento.tutor?.endereco && (
                  <>, residente no endereço <strong>{procedimento.tutor.endereco}</strong></>
                )}, 
                responsável pelo animal <strong>{procedimento.animal?.nome || procedimento.animalNome || '______________________'}</strong>, 
                declaro que fui devidamente informado(a) sobre o procedimento de{' '}
                <strong>{procedimento.tipo || '_________________________________'}</strong> que será realizado.
              </p>
              <p>
                Fui esclarecido(a) quanto aos objetivos, riscos e benefícios do procedimento, 
                bem como sobre os cuidados necessários no pós-procedimento.
              </p>
              <p>
                Autorizo a equipe veterinária do CCZ a realizar o procedimento acima mencionado, 
                estando ciente de que todas as medidas de segurança e bem-estar animal serão 
                adotadas durante a execução.
              </p>
              <p>
                Comprometo-me a seguir todas as orientações fornecidas pela equipe veterinária 
                quanto aos cuidados pós-procedimento e retornos necessários.
              </p>
            </div>
          </div>

          <div className={styles.linha}></div>

          {/* LOCAL E DATA */}
          <div className={styles.secao}>
            <p className={styles.localData}>
              Muriaé, {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* ASSINATURAS */}
          <div className={styles.assinaturas}>
            <div className={styles.assinatura}>
              <div className={styles.linhaAssinatura}></div>
              <p>Assinatura do Responsável pelo Animal</p>
            </div>

            <div className={styles.assinatura}>
              <div className={styles.linhaAssinatura}></div>
              <p>Veterinário Responsável</p>
            </div>
          </div>

          {/* RODAPÉ */}
          <div className={styles.rodape}>
            <p>Centro de Controle de Zoonoses - CCZ</p>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO NO RODAPÉ */}
        <div className={styles.rodapeModal}>
          <button onClick={onFechar} className={styles.btnFecharRodape}>
            Fechar
          </button>
          <button onClick={handleBaixar} className={styles.btnBaixar}>
            Baixar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
