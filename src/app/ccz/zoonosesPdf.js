// Geração de PDF para Zoonoses

import jsPDF from "jspdf";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");

// ── TERMO DE NOTIFICAÇÃO DE ZOONOSE (com dados preenchidos) ─────────────────
export function gerarTermoZoonose(data) {
  const doc = new jsPDF();
  const margemX = 20;
  const larguraUtil = 170;
  let y = 20;

  // ── CABEÇALHO COM LOGO ────────────────────────────────────────────────────
  try {
    const logo = '/img/logo/logo-ccz.png';
    doc.addImage(logo, 'PNG', margemX, y, 25, 25);
  } catch (e) {
    // Se a logo não carregar, continua sem ela
  }

  // Título
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('CENTRO DE CONTROLE DE ZOONOSES', margemX + 30, y + 8);
  
  doc.setFontSize(12);
  doc.text('TERMO DE NOTIFICAÇÃO DE ZOONOSE', margemX + 30, y + 16);
  
  y += 40;

  // Linha separadora
  doc.setDrawColor(200);
  doc.line(margemX, y, margemX + larguraUtil, y);
  y += 15;

  // ── TEXTO EXPLICATIVO COM DADOS PREENCHIDOS ───────────────────────────────
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  
  console.log('Dados Zoonose PDF:', { 
    tutorNome: data.tutorNome, 
    endereco: data.tutor?.endereco, 
    animal: data.animal?.nome,
    tutor: data.tutor 
  }); // Debug
  
  const doencaNome = data.doenca || '____________________________';
  const grauRisco = data.grauRisco || '____________';
  const nomeTutor = data.tutorNome || 'Sem tutor';
  const nomeAnimal = data.animal?.nome || '__________________________________________________';
  
  // Monta a primeira frase condicionalmente
  let primeiraFrase = `Eu, ${nomeTutor}`;
  if (data.tutor?.endereco) {
    primeiraFrase += `, residente no endereço ${data.tutor.endereco}`;
  }
  primeiraFrase += `, responsável pelo animal ${nomeAnimal}, declaro que fui devidamente informado(a) pela equipe técnica do Centro de Controle de Zoonoses sobre a notificação de ${doencaNome}, classificada como grau de risco ${grauRisco}.`;
  
  const texto = `${primeiraFrase}

Fui orientado(a) quanto aos seguintes pontos:

• A doença notificada requer acompanhamento veterinário e medidas de controle específicas;
• É fundamental seguir rigorosamente as orientações da equipe técnica do CCZ;
• O não cumprimento das medidas recomendadas pode agravar o quadro e representar risco à saúde pública;
• Devo comunicar imediatamente qualquer alteração no estado de saúde do animal;
• É necessário manter o ambiente higienizado e adotar as medidas preventivas indicadas.

Comprometo-me a seguir todas as orientações fornecidas pela equipe do CCZ e a colaborar com o monitoramento necessário para o controle da zoonose notificada.`;

  const linhasTexto = doc.splitTextToSize(texto, larguraUtil);
  doc.text(linhasTexto, margemX, y);
  y += linhasTexto.length * 6 + 20;

  // ── DATA E LOCAL PREENCHIDOS ──────────────────────────────────────────────
  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  const dataAtual = new Date();
  const dia = String(dataAtual.getDate()).padStart(2, '0');
  const mes = MESES[dataAtual.getMonth()];
  const ano = dataAtual.getFullYear();
  
  doc.text(`Muriaé, ${dia} de ${mes} de ${ano}`, margemX, y);
  y += 20;

  // Assinatura do Responsável
  const xResp = margemX + larguraUtil / 2 - 40;
  doc.line(xResp, y, xResp + 80, y);
  doc.setFontSize(9);
  doc.text('Assinatura do Responsável pelo Animal', xResp + 5, y + 5);

  y += 25;

  // Assinatura do Veterinário
  const xVet = margemX + larguraUtil / 2 - 40;
  doc.line(xVet, y, xVet + 80, y);
  doc.text('Veterinário Responsável', xVet + 15, y + 5);

  // ── RODAPÉ ────────────────────────────────────────────────────────────────
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  const rodapeY = 280;
  doc.text('Centro de Controle de Zoonoses - CCZ', 105, rodapeY, { align: 'center' });

  // Salvar PDF
  doc.save(`termo-zoonose-${data.id}.pdf`);
}
