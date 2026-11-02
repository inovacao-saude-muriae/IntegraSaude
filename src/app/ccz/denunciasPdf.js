// Geração de PDF para Denúncias de Cães Agressivos

import jsPDF from "jspdf";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");

// ── TERMO DE COMPROMISSO - DENÚNCIA (com dados preenchidos) ──────────────────
export function gerarTermoDenuncia(data) {
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
  doc.text('TERMO DE COMPROMISSO E RESPONSABILIDADE', margemX + 30, y + 16);
  
  y += 40;

  // Linha separadora
  doc.setDrawColor(200);
  doc.line(margemX, y, margemX + larguraUtil, y);
  y += 15;

  // ── TEXTO EXPLICATIVO COM DADOS PREENCHIDOS ───────────────────────────────
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  
  const nomeTutor = data.tutorNome || 'Sem tutor';
  const nomeAnimal = data.animal?.nome || '__________________________________________________';
  
  // Monta a primeira frase condicionalmente
  let primeiraFrase = `Eu, ${nomeTutor}`;
  if (data.tutor?.endereco) {
    primeiraFrase += `, residente no endereço ${data.tutor.endereco}`;
  }
  primeiraFrase += `, responsável pelo animal ${nomeAnimal}, declaro que fui notificado(a) pela equipe do Centro de Controle de Zoonoses sobre denúncia de comportamento agressivo do animal sob minha responsabilidade.`;
  
  const texto = `${primeiraFrase}

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
  doc.save(`termo-denuncia-${data.id}.pdf`);
}
