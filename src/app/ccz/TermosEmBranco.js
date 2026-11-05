'use client';

import { useState } from 'react';
import Image from 'next/image';
import jsPDF from 'jspdf';
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
  if (termo.tipo === 'esporotricose') {
    gerarTermoEsporotricosePdf();
  } else if (termo.tipo === 'denuncia') {
    gerarTermoDenuncia();
  } else {
    gerarTermoProcedimentoPdf();
  }
}

function gerarTermoProcedimentoPdf() {
  const doc = new jsPDF();
  const margemX = 20;
  const larguraUtil = 170;
  let y = 20;

  try {
    const logo = '/img/logo/logo-ccz.png';
    doc.addImage(logo, 'PNG', margemX, y, 25, 25);
  } catch (e) {}

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('CENTRO DE CONTROLE DE ZOONOSES', margemX + 30, y + 8);
  
  doc.setFontSize(12);
  doc.text('TERMO DE PROCEDIMENTO VETERINÁRIO', margemX + 30, y + 16);
  
  y += 40;
  doc.setDrawColor(200);
  doc.line(margemX, y, margemX + larguraUtil, y);
  y += 15;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  
  const texto = `Eu, __________________________________________________, residente no endereço __________________________________________________, responsável pelo animal __________________________________________________, declaro que fui devidamente informado(a) sobre o procedimento de _____________________________________________ que será realizado.

Fui esclarecido(a) quanto aos objetivos, riscos e benefícios do procedimento, bem como sobre os cuidados necessários no pós-procedimento.

Autorizo a equipe veterinária do CCZ a realizar o procedimento acima mencionado, estando ciente de que todas as medidas de segurança e bem-estar animal serão adotadas durante a execução.

Comprometo-me a seguir todas as orientações fornecidas pela equipe veterinária quanto aos cuidados pós-procedimento e retornos necessários.`;

  const linhasTexto = doc.splitTextToSize(texto, larguraUtil);
  doc.text(linhasTexto, margemX, y);
  y += linhasTexto.length * 6 + 40;

  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  let xPos1 = margemX;
  
  doc.line(xPos1, y, xPos1 + 50, y);
  xPos1 += 50;
  doc.text(', ', xPos1, y);
  xPos1 += doc.getTextWidth(', ');
  
  doc.line(xPos1, y, xPos1 + 15, y);
  xPos1 += 15;
  doc.text(' de ', xPos1, y);
  xPos1 += doc.getTextWidth(' de ');
  
  doc.line(xPos1, y, xPos1 + 35, y);
  xPos1 += 35;
  doc.text(' de ', xPos1, y);
  xPos1 += doc.getTextWidth(' de ');
  
  doc.line(xPos1, y, xPos1 + 20, y);
  y += 20;

  const xResp = margemX + larguraUtil / 2 - 40;
  doc.line(xResp, y, xResp + 80, y);
  doc.setFontSize(9);
  doc.text('Assinatura do Responsável pelo Animal', xResp + 5, y + 5);

  y += 25;

  const xVet = margemX + larguraUtil / 2 - 40;
  doc.line(xVet, y, xVet + 80, y);
  doc.text('Veterinário Responsável', xVet + 15, y + 5);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Centro de Controle de Zoonoses - CCZ', 105, 280, { align: 'center' });

  doc.save('termo-procedimento-veterinario.pdf');
}

function gerarTermoEsporotricosePdf() {
  const doc = new jsPDF();
  const margemX = 20;
  const larguraUtil = 170;
  let y = 20;

  try {
    const logo = '/img/logo/logo-ccz.png';
    doc.addImage(logo, 'PNG', margemX, y, 25, 25);
  } catch (e) {}

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('CENTRO DE CONTROLE DE ZOONOSES', margemX + 30, y + 8);
  
  doc.setFontSize(12);
  doc.text('TERMO DE VISTORIA / ESPOROTRICOSE', margemX + 30, y + 16);
  
  y += 40;
  doc.setDrawColor(200);
  doc.line(margemX, y, margemX + larguraUtil, y);
  y += 15;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  
  const texto = `Eu, __________________________________________________, residente no endereço __________________________________________________, responsável pelo animal __________________________________________________, declaro que fui devidamente informado(a) pela equipe técnica do Centro de Controle de Zoonoses sobre a esporotricose felina, seus riscos à saúde pública e animal, e as medidas de controle necessárias.

Fui orientado(a) quanto aos seguintes pontos:

• A esporotricose é uma doença causada por fungo, transmissível ao ser humano;
• O animal diagnosticado deve ser tratado conforme orientação veterinária;
• É necessário manter o animal em ambiente adequado, evitando o contato com outros animais e pessoas vulneráveis;
• Os cuidados de higiene e manejo são fundamentais para prevenir a disseminação da doença;
• O acompanhamento veterinário deve ser mantido até a alta clínica.

Comprometo-me a seguir todas as orientações fornecidas pela equipe do CCZ e a comunicar qualquer alteração no estado de saúde do animal.`;

  const linhasTexto = doc.splitTextToSize(texto, larguraUtil);
  doc.text(linhasTexto, margemX, y);
  y += linhasTexto.length * 6 + 40;

  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  let xPos3 = margemX;
  
  doc.line(xPos3, y, xPos3 + 50, y);
  xPos3 += 50;
  doc.text(', ', xPos3, y);
  xPos3 += doc.getTextWidth(', ');
  
  doc.line(xPos3, y, xPos3 + 15, y);
  xPos3 += 15;
  doc.text(' de ', xPos3, y);
  xPos3 += doc.getTextWidth(' de ');
  
  doc.line(xPos3, y, xPos3 + 35, y);
  xPos3 += 35;
  doc.text(' de ', xPos3, y);
  xPos3 += doc.getTextWidth(' de ');
  
  doc.line(xPos3, y, xPos3 + 20, y);
  y += 20;

  const xResp = margemX + larguraUtil / 2 - 40;
  doc.line(xResp, y, xResp + 80, y);
  doc.setFontSize(9);
  doc.text('Assinatura do Responsável pelo Animal', xResp + 5, y + 5);

  y += 25;

  const xVet = margemX + larguraUtil / 2 - 40;
  doc.line(xVet, y, xVet + 80, y);
  doc.text('Veterinário Responsável', xVet + 15, y + 5);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Centro de Controle de Zoonoses - CCZ', 105, 280, { align: 'center' });

  doc.save('termo-esporotricose.pdf');
}

function gerarTermoDenuncia() {
  const doc = new jsPDF();
  const margemX = 20;
  const larguraUtil = 170;
  let y = 20;

  try {
    const logo = '/img/logo/logo-ccz.png';
    doc.addImage(logo, 'PNG', margemX, y, 25, 25);
  } catch (e) {}

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('CENTRO DE CONTROLE DE ZOONOSES', margemX + 30, y + 8);
  
  doc.setFontSize(12);
  doc.text('TERMO DE COMPROMISSO E RESPONSABILIDADE', margemX + 30, y + 16);
  
  y += 40;
  doc.setDrawColor(200);
  doc.line(margemX, y, margemX + larguraUtil, y);
  y += 15;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  
  const texto = `Eu, __________________________________________________, residente no endereço __________________________________________________, responsável pelo animal __________________________________________________, declaro que fui notificado(a) pela equipe do Centro de Controle de Zoonoses sobre denúncia de comportamento agressivo do animal sob minha responsabilidade.

Fui orientado(a) e comprometo-me com os seguintes pontos:

• Manter o animal devidamente contido e sob vigilância, evitando sua circulação livre em vias públicas;
• Utilizar focinheira e guia apropriadas durante passeios em locais públicos, conforme legislação vigente;
• Garantir que o animal permaneça em local seguro dentro da propriedade, com cercamento adequado;
• Não permitir que o animal tenha acesso direto a pessoas que transitam pela via pública;
• Providenciar atendimento veterinário caso seja identificado comportamento agressivo persistente;
• Comunicar ao CCZ qualquer incidente envolvendo o animal.

Estou ciente de que o não cumprimento destas medidas pode resultar em apreensão do animal, aplicação de multa e outras sanções previstas na legislação municipal e estadual de proteção e controle de animais.

Declaro estar ciente de minhas responsabilidades como tutor e comprometo-me a adotar todas as medidas necessárias para garantir a segurança pública.`;

  const linhasTexto = doc.splitTextToSize(texto, larguraUtil);
  doc.text(linhasTexto, margemX, y);
  y += linhasTexto.length * 6 + 40;

  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  let xPos7 = margemX;
  
  doc.line(xPos7, y, xPos7 + 50, y);
  xPos7 += 50;
  doc.text(', ', xPos7, y);
  xPos7 += doc.getTextWidth(', ');
  
  doc.line(xPos7, y, xPos7 + 15, y);
  xPos7 += 15;
  doc.text(' de ', xPos7, y);
  xPos7 += doc.getTextWidth(' de ');
  
  doc.line(xPos7, y, xPos7 + 35, y);
  xPos7 += 35;
  doc.text(' de ', xPos7, y);
  xPos7 += doc.getTextWidth(' de ');
  
  doc.line(xPos7, y, xPos7 + 20, y);
  y += 20;

  const xResp = margemX + larguraUtil / 2 - 40;
  doc.line(xResp, y, xResp + 80, y);
  doc.setFontSize(9);
  doc.text('Assinatura do Responsável pelo Animal', xResp + 5, y + 5);

  y += 25;

  const xVet = margemX + larguraUtil / 2 - 40;
  doc.line(xVet, y, xVet + 80, y);
  doc.text('Veterinário Responsável', xVet + 15, y + 5);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Centro de Controle de Zoonoses - CCZ', 105, 280, { align: 'center' });

  doc.save('termo-compromisso-denuncia.pdf');
}

function ModalVisualizarTermo({ termo, onFechar }) {
  const handleBaixar = () => {
    gerarTermoPdf(termo);
  };

  // Renderiza o termo de procedimento veterinário
  if (termo.tipo === 'procedimento') {
    return (
      <div className={stylesModal.overlay}>
        <div className={stylesModal.modal}>
          <div className={stylesModal.termo}>
            <div className={stylesModal.cabecalho}>
              <div className={stylesModal.logoBox}>
                <Image
                  src="/img/logo/logo-ccz.png"
                  alt="Logo CCZ"
                  width={80}
                  height={80}
                  className={stylesModal.logoImage}
                />
              </div>
              <div className={stylesModal.tituloBox}>
                <h1>CENTRO DE CONTROLE DE ZOONOSES</h1>
                <h2>TERMO DE PROCEDIMENTO VETERINÁRIO</h2>
              </div>
            </div>

            <div className={stylesModal.linha}></div>

            <div className={stylesModal.secao}>
              <div className={stylesModal.textoExplicativo}>
                <p>
                  Eu,{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
                  residente no endereço{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
                  responsável pelo animal{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>, 
                  declaro que fui devidamente informado(a) sobre o procedimento de{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> que será realizado.
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

            <div className={stylesModal.linha}></div>

            <div className={stylesModal.secao}>
              <p className={stylesModal.localData}>
                <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>, 
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; de <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </p>
            </div>

            <div className={stylesModal.assinaturas}>
              <div className={stylesModal.assinatura}>
                <div className={stylesModal.linhaAssinatura}></div>
                <p>Assinatura do Responsável pelo Animal</p>
              </div>

              <div className={stylesModal.assinatura}>
                <div className={stylesModal.linhaAssinatura}></div>
                <p>Veterinário Responsável</p>
              </div>
            </div>

            <div className={stylesModal.rodape}>
              <p>Centro de Controle de Zoonoses - CCZ</p>
            </div>
          </div>

          <div className={stylesModal.rodapeModal}>
            <button onClick={onFechar} className={stylesModal.btnFecharRodape}>
              Fechar
            </button>
            <button onClick={handleBaixar} className={stylesModal.btnBaixar}>
              Baixar PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renderiza o termo de esporotricose
  if (termo.tipo === 'esporotricose') {
    return (
      <div className={stylesModal.overlay}>
        <div className={stylesModal.modal}>
          <div className={stylesModal.termo}>
            <div className={stylesModal.cabecalho}>
              <div className={stylesModal.logoBox}>
                <Image
                  src="/img/logo/logo-ccz.png"
                  alt="Logo CCZ"
                  width={80}
                  height={80}
                  className={stylesModal.logoImage}
                />
              </div>
              <div className={stylesModal.tituloBox}>
                <h1>CENTRO DE CONTROLE DE ZOONOSES</h1>
                <h2>TERMO DE VISTORIA / ESPOROTRICOSE</h2>
              </div>
            </div>

            <div className={stylesModal.linha}></div>

            <div className={stylesModal.secao}>
              <div className={stylesModal.textoExplicativo}>
                <p>
                  Eu,{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
                  residente no endereço{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
                  responsável pelo animal{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>, 
                  declaro que fui devidamente informado(a) pela equipe técnica do Centro de Controle de Zoonoses 
                  sobre a esporotricose felina, seus riscos à saúde pública e animal, e as medidas de controle necessárias.
                </p>
                <p>Fui orientado(a) quanto aos seguintes pontos:</p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <li>A esporotricose é uma doença causada por fungo, transmissível ao ser humano;</li>
                  <li>O animal diagnosticado deve ser tratado conforme orientação veterinária;</li>
                  <li>É necessário manter o animal em ambiente adequado, evitando o contato com outros animais e pessoas vulneráveis;</li>
                  <li>Os cuidados de higiene e manejo são fundamentais para prevenir a disseminação da doença;</li>
                  <li>O acompanhamento veterinário deve ser mantido até a alta clínica.</li>
                </ul>
                <p>
                  Comprometo-me a seguir todas as orientações fornecidas pela equipe do CCZ e a comunicar 
                  qualquer alteração no estado de saúde do animal.
                </p>
              </div>
            </div>

            <div className={stylesModal.linha}></div>

            <div className={stylesModal.secao}>
              <p className={stylesModal.localData}>
                <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>, 
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; de <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </p>
            </div>

            <div className={stylesModal.assinaturas}>
              <div className={stylesModal.assinatura}>
                <div className={stylesModal.linhaAssinatura}></div>
                <p>Assinatura do Responsável pelo Animal</p>
              </div>

              <div className={stylesModal.assinatura}>
                <div className={stylesModal.linhaAssinatura}></div>
                <p>Veterinário Responsável</p>
              </div>
            </div>

            <div className={stylesModal.rodape}>
              <p>Centro de Controle de Zoonoses - CCZ</p>
            </div>
          </div>

          <div className={stylesModal.rodapeModal}>
            <button onClick={onFechar} className={stylesModal.btnFecharRodape}>
              Fechar
            </button>
            <button onClick={handleBaixar} className={stylesModal.btnBaixar}>
              Baixar PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renderiza o termo de denúncia
  if (termo.tipo === 'denuncia') {
    return (
      <div className={stylesModal.overlay}>
        <div className={stylesModal.modal}>
          <div className={stylesModal.termo}>
            <div className={stylesModal.cabecalho}>
              <div className={stylesModal.logoBox}>
                <Image
                  src="/img/logo/logo-ccz.png"
                  alt="Logo CCZ"
                  width={80}
                  height={80}
                  className={stylesModal.logoImage}
                />
              </div>
              <div className={stylesModal.tituloBox}>
                <h1>CENTRO DE CONTROLE DE ZOONOSES</h1>
                <h2>TERMO DE COMPROMISSO E RESPONSABILIDADE</h2>
              </div>
            </div>

            <div className={stylesModal.linha}></div>

            <div className={stylesModal.secao}>
              <div className={stylesModal.textoExplicativo}>
                <p>
                  Eu,{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
                  residente no endereço{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
                  responsável pelo animal{' '}
                  <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>, 
                  declaro que fui notificado(a) pela equipe do Centro de Controle de Zoonoses sobre denúncia de 
                  comportamento agressivo do animal sob minha responsabilidade.
                </p>
                <p>Fui orientado(a) e comprometo-me com os seguintes pontos:</p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <li>Manter o animal devidamente contido e sob vigilância, evitando sua circulação livre em vias públicas;</li>
                  <li>Utilizar focinheira e guia apropriadas durante passeios em locais públicos, conforme legislação vigente;</li>
                  <li>Garantir que o animal permaneça em local seguro dentro da propriedade, com cercamento adequado;</li>
                  <li>Não permitir que o animal tenha acesso direto a pessoas que transitam pela via pública;</li>
                  <li>Providenciar atendimento veterinário caso seja identificado comportamento agressivo persistente;</li>
                  <li>Comunicar ao CCZ qualquer incidente envolvendo o animal.</li>
                </ul>
                <p>
                  Estou ciente de que o não cumprimento destas medidas pode resultar em apreensão do animal, 
                  aplicação de multa e outras sanções previstas na legislação municipal e estadual de proteção 
                  e controle de animais.
                </p>
                <p>
                  Declaro estar ciente de minhas responsabilidades como tutor e comprometo-me a adotar todas 
                  as medidas necessárias para garantir a segurança pública.
                </p>
              </div>
            </div>

            <div className={stylesModal.linha}></div>

            <div className={stylesModal.secao}>
              <p className={stylesModal.localData}>
                <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>, 
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; de <span className={stylesModal.linhaManual}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </p>
            </div>

            <div className={stylesModal.assinaturas}>
              <div className={stylesModal.assinatura}>
                <div className={stylesModal.linhaAssinatura}></div>
                <p>Assinatura do Responsável pelo Animal</p>
              </div>

              <div className={stylesModal.assinatura}>
                <div className={stylesModal.linhaAssinatura}></div>
                <p>Veterinário Responsável</p>
              </div>
            </div>

            <div className={stylesModal.rodape}>
              <p>Centro de Controle de Zoonoses - CCZ</p>
            </div>
          </div>

          <div className={stylesModal.rodapeModal}>
            <button onClick={onFechar} className={stylesModal.btnFecharRodape}>
              Fechar
            </button>
            <button onClick={handleBaixar} className={stylesModal.btnBaixar}>
              Baixar PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function TermosEmBranco() {
  const [termoSelecionado, setTermoSelecionado] = useState(null);

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
                  <td 
                    className={styles.boldName}
                    onClick={() => setTermoSelecionado(termo)}
                  >
                    {termo.nome}
                  </td>
                  <td onClick={() => setTermoSelecionado(termo)}>
                    {termo.descricao}
                  </td>
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

      {termoSelecionado && (
        <ModalVisualizarTermo
          termo={termoSelecionado}
          onFechar={() => setTermoSelecionado(null)}
        />
      )}
    </div>
  );
}
