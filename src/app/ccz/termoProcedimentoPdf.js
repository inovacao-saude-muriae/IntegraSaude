import jsPDF from "jspdf";

const formatarData = (data) => {
  if (!data) return '___/___/_____';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

export function gerarTermoProcedimentoPdf(procedimento) {
  const doc = new jsPDF();
  const margemX = 20;
  const larguraUtil = 170; // 210 - 40
  let y = 20;

  // ── CABEÇALHO COM LOGO ────────────────────────────────────────────────────
  // Logo (se disponível)
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
  doc.text('TERMO DE PROCEDIMENTO VETERINÁRIO', margemX + 30, y + 16);
  
  y += 40;

  // Linha separadora
  doc.setDrawColor(200);
  doc.line(margemX, y, margemX + larguraUtil, y);
  y += 15;

  // ── TEXTO EXPLICATIVO DO PROCEDIMENTO ─────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  
  const nomeTutor = procedimento.tutor?.nome || 'Sem tutor';
  const nomeAnimal = procedimento.animal?.nome || procedimento.animalNome || '__________________________________________________';
  const tipoProcedimento = procedimento.tipo || '_________________________________';
  
  // Monta a primeira frase condicionalmente
  let primeiraFrase = `Eu, ${nomeTutor}`;
  if (procedimento.tutor?.endereco) {
    primeiraFrase += `, residente no endereço ${procedimento.tutor.endereco}`;
  }
  primeiraFrase += `, responsável pelo animal ${nomeAnimal}, declaro que fui devidamente informado(a) sobre o procedimento de ${tipoProcedimento} que será realizado.`;
  
  const texto = `${primeiraFrase}

Fui esclarecido(a) quanto aos objetivos, riscos e benefícios do procedimento, bem como sobre os cuidados necessários no pós-procedimento.

Autorizo a equipe veterinária do CCZ a realizar o procedimento acima mencionado, estando ciente de que todas as medidas de segurança e bem-estar animal serão adotadas durante a execução.

Comprometo-me a seguir todas as orientações fornecidas pela equipe veterinária quanto aos cuidados pós-procedimento e retornos necessários.`;

  const linhasTexto = doc.splitTextToSize(texto, larguraUtil);
  doc.text(linhasTexto, margemX, y);
  y += linhasTexto.length * 6 + 20;

  // ── INFORMAÇÕES BÁSICAS ───────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  y += 20;

  // ── ASSINATURAS ───────────────────────────────────────────────────────────
  // Verifica se precisa de nova página
  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  // Local e Data (preenchida automaticamente)
  doc.setFontSize(10);
  const dataAtual = new Date();
  const dia = String(dataAtual.getDate()).padStart(2, '0');
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const mes = meses[dataAtual.getMonth()];
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
  const nomeArquivo = `termo-procedimento-${procedimento.animalNome || procedimento.id || 'CCZ'}.pdf`;
  doc.save(nomeArquivo);
}
