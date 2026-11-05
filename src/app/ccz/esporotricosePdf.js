// Geração de PDF da Esporotricose em formato de prontuário
// Layout similar ao histórico completo do animal, com campos estruturados

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { mascararTelefone } from "@/lib/telefone";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");

const dataPorExtenso = (ymd) => {
  if (!ymd) return { dia: "____", mes: "____________", ano: "______" };
  const [a, m, d] = ymd.split("-");
  return { dia: d, mes: MESES[Number(m) - 1] || "____________", ano: a };
};

// ── RELATÓRIO COMPLETO EM FORMATO PRONTUÁRIO ────────────────────────────────
export function gerarPdfEsporotricose(data) {
  const doc = new jsPDF();
  const margemX = 20;
  const larguraUtil = 170;
  let yPos = 20;

  // ═══════════════════════════════════════════════════════════════════════════
  // CABEÇALHO COM LOGO
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const logo = '/img/logo/logo-ccz.png';
    doc.addImage(logo, 'PNG', margemX, yPos, 25, 25);
  } catch (e) {
    // Se a logo não carregar, continua sem ela
  }

  // Título
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('CENTRO DE CONTROLE DE ZOONOSES', margemX + 30, yPos + 8);
  
  doc.setFontSize(12);
  doc.text('RELATÓRIO DE ESPOROTRICOSE', margemX + 30, yPos + 16);
  
  yPos += 35;

  // Linha separadora
  doc.setDrawColor(200);
  doc.line(margemX, yPos, margemX + larguraUtil, yPos);
  yPos += 8;

  // Info do animal
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Animal: ${data.animal?.nome || "Sem nome"} (ID: ${data.animal?.id || "-"})`, margemX, yPos);
  yPos += 10;

  // Função auxiliar para desenhar campo de prontuário
  const drawCampo = (x, y, largura, label, valor) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 2, y + 3);
    
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y + 4, largura, 7, 1, 1, "FD");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    const textoValor = doc.splitTextToSize(String(valor || "-"), largura - 4);
    doc.text(textoValor[0] || "-", x + 2, y + 9);
  };

  const drawCampoLargo = (x, y, largura, label, valor) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 2, y + 3);
    
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y + 4, largura, 10, 1, 1, "FD");
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    const textoValor = doc.splitTextToSize(String(valor || "-"), largura - 4);
    let textY = y + 9;
    textoValor.slice(0, 2).forEach(linha => {
      doc.text(linha, x + 2, textY);
      textY += 4;
    });
  };

  const drawSecaoTitulo = (titulo) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margemX, yPos - 2, margemX + larguraUtil, yPos - 2);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(titulo, margemX, yPos + 3);
    
    doc.setLineWidth(0.5);
    doc.line(margemX, yPos + 5, margemX + larguraUtil, yPos + 5);
    yPos += 10;
  };

  const col1 = margemX;
  const col2 = margemX + 57;
  const col3 = margemX + 114;
  const larguraCol = 54;

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTIFICAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  drawSecaoTitulo("Identificação");
  
  drawCampo(col1, yPos, larguraCol, "Data da visita", formatarData(data.dataVisita));
  drawCampo(col2, yPos, larguraCol, "Fiscal responsável", data.fiscalResponsavel || "-");
  yPos += 13;

  // ═══════════════════════════════════════════════════════════════════════════
  // DADOS DO ANIMAL
  // ═══════════════════════════════════════════════════════════════════════════
  yPos += 5;
  drawSecaoTitulo("Dados do Animal");

  const a = data.animal || {};
  drawCampo(col1, yPos, larguraCol, "ID", a.id || "-");
  drawCampo(col2, yPos, larguraCol, "Nome", a.nome || "Sem nome");
  drawCampo(col3, yPos, larguraCol, "Espécie", a.especie || "-");
  yPos += 13;

  drawCampo(col1, yPos, larguraCol, "Sexo", a.sexo || "-");
  drawCampo(col2, yPos, larguraCol, "Porte", a.porte || "-");
  drawCampo(col3, yPos, larguraCol, "Idade", a.idade || "-");
  yPos += 13;

  // ═══════════════════════════════════════════════════════════════════════════
  // DADOS DO TUTOR (se houver)
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.temTutor && data.tutor) {
    yPos += 5;
    drawSecaoTitulo("Tutor Responsável");

    drawCampo(col1, yPos, larguraCol, "CPF", data.tutor.cpf || "-");
    drawCampoLargo(col2, yPos, larguraUtil - larguraCol, "Nome completo", data.tutor.nome || "-");
    yPos += 13;

    drawCampo(col1, yPos, larguraCol, "Telefone", data.tutor.telefone ? mascararTelefone(data.tutor.telefone) : "-");
    yPos += 13;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONDIÇÃO CLÍNICA
  // ═══════════════════════════════════════════════════════════════════════════
  yPos += 5;
  if (yPos > 240) {
    doc.addPage();
    yPos = 15;
  }
  drawSecaoTitulo("Condição Clínica");

  drawCampo(col1, yPos, larguraCol, "Apresenta lesões", data.apresentaLesoes || "Não");
  if (data.apresentaLesoes === "Sim" && data.descricaoLesoes) {
    const larguraDesc = larguraCol * 2 + 4;
    drawCampoLargo(col2, yPos, larguraDesc, "Descrição das lesões", data.descricaoLesoes);
    yPos += 16;
  } else {
    yPos += 13;
  }

  drawCampo(col1, yPos, larguraCol, "Em tratamento veterinário", data.emTratamentoVeterinario || "Não");
  if (data.emTratamentoVeterinario === "Sim" && data.descricaoTratamentoVet) {
    const larguraDesc = larguraCol * 2 + 4;
    drawCampoLargo(col2, yPos, larguraDesc, "Descrição do tratamento", data.descricaoTratamentoVet);
    yPos += 16;
  } else {
    yPos += 13;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRATAMENTO
  // ═══════════════════════════════════════════════════════════════════════════
  yPos += 5;
  if (yPos > 240) {
    doc.addPage();
    yPos = 15;
  }
  drawSecaoTitulo("Tratamento");

  if (data.medicamentosPrescritos) {
    drawCampoLargo(col1, yPos, larguraUtil, "Medicamentos prescritos", data.medicamentosPrescritos);
    yPos += 16;
  }

  drawCampo(col1, yPos, larguraCol, "Houve interrupção", data.interrupcaoTratamento || "Não");
  drawCampo(col2, yPos, larguraCol, "Retorno ao veterinário", data.retornoVeterinario || "Não");
  yPos += 13;

  // ═══════════════════════════════════════════════════════════════════════════
  // MANEJO DOMICILIAR (apenas se tem tutor)
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.temTutor) {
    yPos += 5;
    if (yPos > 240) {
      doc.addPage();
      yPos = 15;
    }
    drawSecaoTitulo("Manejo Domiciliar");

    drawCampo(col1, yPos, larguraCol, "Isolamento domiciliar", data.isolamentoDomiciliar || "Não");
    if (data.isolamentoDomiciliar === "Sim" && data.observacoesIsolamento) {
      const larguraObs = larguraCol * 2 + 4;
      drawCampoLargo(col2, yPos, larguraObs, "Observações", data.observacoesIsolamento);
      yPos += 16;
    } else {
      yPos += 13;
    }

    drawCampo(col1, yPos, larguraCol, "Acesso à rua", data.acessoRua || "Não");
    drawCampo(col2, yPos, larguraCol, "Uso de EPI", data.usoEpi || "Não");
    if (data.usoEpi === "Sim" && data.quaisEpis) {
      drawCampo(col3, yPos, larguraCol, "Quais EPIs", data.quaisEpis);
    }
    yPos += 13;

    if (data.higienizacaoAmbiente) {
      // Verificar se há espaço para o campo de higienização
      if (yPos > 250) {
        doc.addPage();
        yPos = 15;
      }
      drawCampoLargo(col1, yPos, larguraUtil, "Higienização do ambiente", data.higienizacaoAmbiente);
      yPos += 16;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OUTROS ANIMAIS E PESSOAS
    // ═══════════════════════════════════════════════════════════════════════════
    yPos += 5;
    if (yPos > 240) {
      doc.addPage();
      yPos = 15;
    }
    drawSecaoTitulo("Outros Animais e Pessoas na Residência");

    drawCampo(col1, yPos, larguraCol, "Outros animais", data.outrosAnimaisResidencia || "Não");
    if (data.outrosAnimaisResidencia === "Sim" && data.outrosAnimaisDescricao) {
      const larguraDesc = larguraCol * 2 + 4;
      drawCampoLargo(col2, yPos, larguraDesc, "Descrição", data.outrosAnimaisDescricao);
      yPos += 16;
    } else {
      yPos += 13;
    }

    drawCampo(col1, yPos, larguraCol, "Pessoas com lesões", data.pessoasComLesoes || "Não");
    if (data.pessoasComLesoes === "Sim" && data.pessoasLesoesDescricao) {
      const larguraDesc = larguraCol * 2 + 4;
      drawCampoLargo(col2, yPos, larguraDesc, "Descrição", data.pessoasLesoesDescricao);
      yPos += 16;
    } else {
      yPos += 13;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CIÊNCIA DO RESPONSÁVEL
    // ═══════════════════════════════════════════════════════════════════════════
    yPos += 5;
    if (yPos > 240) {
      doc.addPage();
      yPos = 15;
    }
    drawSecaoTitulo("Ciência do Responsável");

    drawCampo(col1, yPos, larguraUtil/2, "Ciente: tratamento contínuo", data.cienteTratamentoContinuo || "Não");
    drawCampo(col2 + 30, yPos, larguraUtil/2, "Ciente: contenção domiciliar", data.cienteContencao || "Não");
    yPos += 13;

    drawCampo(col1, yPos, larguraUtil/2, "Ciente: uso de EPI/luvas", data.cienteEpi || "Não");
    drawCampo(col2 + 30, yPos, larguraUtil/2, "Ciente: destinação de resíduos", data.cienteResiduos || "Não");
    yPos += 13;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AVALIAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  yPos += 5;
  if (yPos > 240) {
    doc.addPage();
    yPos = 15;
  }
  drawSecaoTitulo("Avaliação");

  if (data.condicoesGeraisAmbiente) {
    drawCampoLargo(col1, yPos, larguraUtil, "Condições gerais do ambiente", data.condicoesGeraisAmbiente);
    yPos += 16;
  }

  if (data.conclusaoTecnica) {
    drawCampoLargo(col1, yPos, larguraUtil, "Conclusão técnica", data.conclusaoTecnica);
    yPos += 16;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENCAMINHAMENTOS
  // ═══════════════════════════════════════════════════════════════════════════
  yPos += 5;
  if (yPos > 240) {
    doc.addPage();
    yPos = 15;
  }
  drawSecaoTitulo("Encaminhamentos");

  const encaminhamentos = [];
  if (data.encAcompanhamentoCcz) encaminhamentos.push("Acompanhamento periódico pelo CCZ");
  if (data.encNotificacaoTutor) encaminhamentos.push("Notificação formal ao tutor");
  if (data.encMinisterioPublico) encaminhamentos.push("Encaminhamento ao Ministério Público");
  if (data.encOutrasMedidas) encaminhamentos.push("Outras medidas sanitárias");

  if (encaminhamentos.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhum encaminhamento marcado.", margemX + 2, yPos + 5);
    yPos += 10;
  } else {
    encaminhamentos.forEach((enc) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(`• ${enc}`, margemX + 2, yPos + 5);
      yPos += 6;
    });
  }

  if (data.encOutrasMedidas && data.outrasMedidasDescricao) {
    drawCampoLargo(col1, yPos, larguraUtil, "Outras medidas / observações", data.outrasMedidasDescricao);
    yPos += 16;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENDA DE ACOMPANHAMENTO (se tiver)
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.encAcompanhamentoCcz && data.visitas && data.visitas.length > 0) {
    yPos += 5;
    if (yPos > 220) {
      doc.addPage();
      yPos = 15;
    }
    drawSecaoTitulo("Agenda de Acompanhamento");

    const visitasData = data.visitas.map(v => {
      let descricao = v.observacao || "Visita de acompanhamento";
      
      // Se a visita tem relatório, montar descrição detalhada
      if (v.temRelatorio && v.relatorio) {
        const r = v.relatorio;
        const detalhes = [];
        
        if (r.evolucaoQuadro) detalhes.push(`Evolução: ${r.evolucaoQuadro}`);
        if (r.apresentaLesoes === "Sim" && r.descricaoLesoes) {
          detalhes.push(`Lesões: ${r.descricaoLesoes}`);
        }
        if (r.medicamentosAtuais) detalhes.push(`Medicamentos: ${r.medicamentosAtuais}`);
        if (r.adesaoTratamento) detalhes.push(`Adesão: ${r.adesaoTratamento}`);
        if (r.isolamentoAdequado) detalhes.push(`Isolamento: ${r.isolamentoAdequado}`);
        if (r.usoEpiAdequado) detalhes.push(`Uso de EPI: ${r.usoEpiAdequado}`);
        if (r.higienizacaoAdequada) detalhes.push(`Higienização: ${r.higienizacaoAdequada}`);
        if (r.orientacoesRepassadas) detalhes.push(`Orientações: ${r.orientacoesRepassadas}`);
        
        if (detalhes.length > 0) {
          descricao = detalhes.join(" | ");
        }
      }
      
      return [formatarData(v.data), descricao];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Data', 'Descrição']],
      body: visitasData,
      margin: { left: margemX, right: margemX },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 30, halign: 'left' },
        1: { cellWidth: 152, halign: 'left' },
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      bodyStyles: {
        textColor: [71, 85, 105],
      },
    });
  }

  // Rodapé
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${i} de ${totalPaginas}`, 105, 285, { align: "center" });
    doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, 210 - margemX, 285, { align: "right" });
  }

  // ── RODAPÉ FINAL ──────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    const rodapeY = 290;
    doc.text('Centro de Controle de Zoonoses - CCZ', 105, rodapeY, { align: 'center' });
  }

  doc.save(`esporotricose-${data.id}.pdf`);
}

// ── TERMO (documento formal com assinaturas) ────────────────────────────────
export function gerarTermoEsporotricose(data) {
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
  doc.text('TERMO DE VISTORIA / ESPOROTRICOSE', margemX + 30, y + 16);
  
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
  primeiraFrase += `, responsável pelo animal ${nomeAnimal}, declaro que fui devidamente informado(a) pela equipe técnica do Centro de Controle de Zoonoses sobre a esporotricose felina, seus riscos à saúde pública e animal, e as medidas de controle necessárias.`;
  
  const texto = `${primeiraFrase}

Fui orientado(a) quanto aos seguintes pontos:

• A esporotricose é uma doença causada por fungo, transmissível ao ser humano;
• O animal diagnosticado deve ser tratado conforme orientação veterinária;
• É necessário manter o animal em ambiente adequado, evitando o contato com outros animais e pessoas vulneráveis;
• Os cuidados de higiene e manejo são fundamentais para prevenir a disseminação da doença;
• O acompanhamento veterinário deve ser mantido até a alta clínica.

Comprometo-me a seguir todas as orientações fornecidas pela equipe do CCZ e a comunicar qualquer alteração no estado de saúde do animal.`;

  const linhasTexto = doc.splitTextToSize(texto, larguraUtil);
  doc.text(linhasTexto, margemX, y);
  y += linhasTexto.length * 6 + 20;

  y += 20;

  // ── ASSINATURAS ───────────────────────────────────────────────────────────
  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  // Data e local PREENCHIDOS
  doc.setFontSize(10);
  const dataAtual = new Date();
  const dia = String(dataAtual.getDate()).padStart(2, '0');
  const mes = MESES[dataAtual.getMonth()];
  const ano = dataAtual.getFullYear();
  
  console.log('Data Esporotricose:', { dia, mes, ano, dataAtual }); // Debug
  
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

  doc.save(`termo-esporotricose-${data.id}.pdf`);
}
