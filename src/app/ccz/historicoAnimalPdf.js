// Geração de PDF do histórico completo do animal em formato de prontuário
// Layout similar ao formato web, com campos estruturados e tabela de histórico

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatarData = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
};

const formatarEndereco = (end) => {
  if (!end) return "-";
  const partes = [];
  if (end.logradouro) partes.push(end.logradouro);
  if (end.numero) partes.push(end.numero);
  if (end.complemento) partes.push(end.complemento);
  if (end.bairro) partes.push(end.bairro);
  if (end.cidade && end.uf) partes.push(`${end.cidade}/${end.uf}`);
  if (end.cep) partes.push(`CEP: ${end.cep}`);
  return partes.length > 0 ? partes.join(", ") : "-";
};

export function gerarHistoricoCompletoPdf(dados) {
  const doc = new jsPDF();
  const margemX = 14;
  const larguraUtil = 182; // 210 - 28
  let yPos = 15;

  const { animal, tutor, procedimentos, zoonoses, denuncias, esporotricose } = dados;

  // ═══════════════════════════════════════════════════════════════
  // CABEÇALHO DO RELATÓRIO
  // ═══════════════════════════════════════════════════════════════
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(margemX, yPos, 210 - margemX, yPos);
  yPos += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("FICHA COMPLETA DO ANIMAL E HISTÓRICO", 105, yPos, { align: "center" });
  yPos += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Período: Histórico completo", 105, yPos, { align: "center" });
  yPos += 3;

  doc.setLineWidth(0.8);
  doc.line(margemX, yPos, 210 - margemX, yPos);
  yPos += 8;

  // Função auxiliar para desenhar campo de prontuário
  const drawCampo = (x, y, largura, label, valor) => {
    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 2, y + 3);
    
    // Box do valor
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y + 4, largura, 7, 1, 1, "FD");
    
    // Valor
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    const textoValor = doc.splitTextToSize(String(valor || "-"), largura - 4);
    doc.text(textoValor[0] || "-", x + 2, y + 9);
  };

  const drawCampoLargo = (x, y, largura, label, valor) => {
    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 2, y + 3);
    
    // Box do valor
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y + 4, largura, 10, 1, 1, "FD");
    
    // Valor (pode ter múltiplas linhas)
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
    doc.line(margemX, yPos - 2, 210 - margemX, yPos - 2);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(titulo, margemX, yPos + 3);
    
    doc.setLineWidth(0.5);
    doc.line(margemX, yPos + 5, 210 - margemX, yPos + 5);
    yPos += 10;
  };

  // ═══════════════════════════════════════════════════════════════
  // DADOS DO ANIMAL
  // ═══════════════════════════════════════════════════════════════
  drawSecaoTitulo("Dados do Animal");

  // Primeira linha: ID, Nome, Espécie
  const col1 = margemX;
  const col2 = margemX + 60;
  const col3 = margemX + 122;
  const larguraCol = 58;

  drawCampo(col1, yPos, larguraCol, "ID", animal.id);
  drawCampo(col2, yPos, larguraCol, "Nome", animal.nome || "-");
  drawCampo(col3, yPos, larguraCol, "Espécie", animal.especie || "-");
  yPos += 13;

  // Segunda linha: Sexo, Porte, Idade
  drawCampo(col1, yPos, larguraCol, "Sexo", animal.sexo);
  drawCampo(col2, yPos, larguraCol, "Porte", animal.porte || "-");
  drawCampo(col3, yPos, larguraCol, "Idade", animal.idade || "-");
  yPos += 13;

  // Terceira linha: Data cadastro, Castrado
  drawCampo(col1, yPos, larguraCol, "Data de cadastro", formatarData(animal.dataCadastro));
  drawCampo(col2, yPos, larguraCol, "Castrado", animal.castrado);
  yPos += 13;

  // Quarta linha: Doença crônica + Qual doença (na mesma linha se tiver)
  drawCampo(col1, yPos, larguraCol, "Doença crônica", animal.doencaCronica);
  if (animal.doencaCronica === "Sim" && animal.qualDoenca) {
    // Qual doença ao lado, ocupando 2 colunas
    const larguraQual = larguraCol * 2 + 4; // 2 colunas + espaço entre
    drawCampoLargo(col2, yPos, larguraQual, "Qual doença", animal.qualDoenca);
    yPos += 16;
  } else {
    // Se não tem doença crônica, mostrar outros campos
    drawCampo(col2, yPos, larguraCol, "Apetite normal", animal.apetiteNormal);
    drawCampo(col3, yPos, larguraCol, "Vômito / Diarreia", animal.sintomasVomitoDiarreia);
    yPos += 13;
  }

  // Quinta linha: Em tratamento + Qual tratamento (na mesma linha se tiver)
  drawCampo(col1, yPos, larguraCol, "Em tratamento", animal.emTratamento);
  if (animal.emTratamento === "Sim" && animal.qualTratamento) {
    // Tratamento ao lado, ocupando 2 colunas
    const larguraTrat = larguraCol * 2 + 4;
    drawCampoLargo(col2, yPos, larguraTrat, "Tratamento", animal.qualTratamento);
    yPos += 16;
  } else {
    yPos += 13;
  }

  // Sexta linha: Observações (sempre separado, linha inteira)
  if (animal.observacoes && animal.observacoes.trim()) {
    drawCampoLargo(col1, yPos, larguraUtil, "Observações", animal.observacoes);
    yPos += 16;
  }

  // ═══════════════════════════════════════════════════════════════
  // TUTOR RESPONSÁVEL
  // ═══════════════════════════════════════════════════════════════
  if (tutor) {
    yPos += 5;
    if (yPos > 240) {
      doc.addPage();
      yPos = 15;
    }
    
    drawSecaoTitulo("Tutor Responsável");

    drawCampo(col1, yPos, larguraCol, "CPF", tutor.cpf);
    drawCampoLargo(col2, yPos, larguraUtil - larguraCol, "Nome completo", tutor.nome);
    yPos += 13;

    drawCampo(col1, yPos, larguraCol, "Telefone / WhatsApp", tutor.telefone || "-");
    drawCampo(col2, yPos, larguraCol, "CNS", tutor.cns || "-");
    yPos += 13;

    if (tutor.endereco) {
      drawCampoLargo(col1, yPos, larguraUtil, "Endereço", formatarEndereco(tutor.endereco));
      yPos += 16;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTÓRICO DE ATENDIMENTOS (TABELA)
  // ═══════════════════════════════════════════════════════════════
  yPos += 5;
  if (yPos > 220) {
    doc.addPage();
    yPos = 15;
  }

  drawSecaoTitulo("Histórico de Atendimentos");

  // Montar timeline
  const timeline = [];

  // Cadastro
  if (animal.dataCadastro) {
    timeline.push({
      data: animal.dataCadastro,
      tipo: "Cadastro inicial",
      descricao: "Animal cadastrado no sistema",
    });
  }

  // Procedimentos
  procedimentos.forEach((p) => {
    timeline.push({
      data: p.dataProcedimento,
      tipo: p.tipo + (p.status ? ` - ${p.status}` : ""),
      descricao: p.descricao || p.medicacaoPrescrita || "-",
    });
  });

  // Zoonoses
  zoonoses.forEach((z) => {
    timeline.push({
      data: z.dataIdentificacao,
      tipo: `Zoonose: ${z.doenca}`,
      descricao: `Risco: ${z.grauRisco} | Risco de vida: ${z.riscoVida}`,
    });
  });

  // Denúncias
  denuncias.forEach((d) => {
    timeline.push({
      data: d.dataDenuncia,
      tipo: "Denúncia: Cão agressivo",
      descricao: `Local: ${d.localizacao} | Risco: ${d.causouRisco}`,
    });
  });

  // Esporotricose
  esporotricose.forEach((e) => {
    // Montar descrição detalhada da visita inicial
    const descInicial = [];
    
    if (e.numeroProtocolo) descInicial.push(`Protocolo: ${e.numeroProtocolo}`);
    if (e.fiscalResponsavel) descInicial.push(`Fiscal: ${e.fiscalResponsavel}`);
    if (e.apresentaLesoes) {
      descInicial.push(`Apresenta lesões: ${e.apresentaLesoes}`);
      if (e.apresentaLesoes === "Sim" && e.descricaoLesoes) {
        descInicial.push(`Descrição: ${e.descricaoLesoes}`);
      }
    }
    if (e.emTratamentoVeterinario) {
      descInicial.push(`Em tratamento veterinário: ${e.emTratamentoVeterinario}`);
      if (e.emTratamentoVeterinario === "Sim" && e.descricaoTratamentoVet) {
        descInicial.push(`Tratamento: ${e.descricaoTratamentoVet}`);
      }
    }
    if (e.conclusaoTecnica) descInicial.push(`Conclusão: ${e.conclusaoTecnica}`);
    
    timeline.push({
      data: e.dataVisita,
      tipo: "Esporotricose - Visita inicial",
      descricao: descInicial.length > 0 ? descInicial.join(" | ") : "Visita inicial registrada",
    });

    e.visitas.forEach((v) => {
      let desc = v.observacao || `Visita agendada para ${formatarData(v.data)}`;
      
      if (v.temRelatorio && v.relatorio) {
        const r = v.relatorio;
        const detalhes = [];
        
        // Informações completas do relatório
        if (r.apresentaLesoes) {
          detalhes.push(`Apresenta lesões: ${r.apresentaLesoes}`);
          if (r.apresentaLesoes === "Sim" && r.descricaoLesoes) {
            detalhes.push(`Descrição: ${r.descricaoLesoes}`);
          }
        }
        
        if (r.evolucaoQuadro) {
          detalhes.push(`Evolução: ${r.evolucaoQuadro}`);
        }
        
        if (r.emTratamento) {
          detalhes.push(`Em tratamento: ${r.emTratamento}`);
          if (r.emTratamento === "Sim") {
            if (r.medicamentosAtuais) detalhes.push(`Medicamentos: ${r.medicamentosAtuais}`);
            if (r.adesaoTratamento) detalhes.push(`Adesão: ${r.adesaoTratamento}`);
          }
        }
        
        if (r.isolamentoAdequado) detalhes.push(`Isolamento: ${r.isolamentoAdequado}`);
        if (r.usoEpiAdequado) detalhes.push(`Uso de EPI: ${r.usoEpiAdequado}`);
        if (r.higienizacaoAdequada) detalhes.push(`Higienização: ${r.higienizacaoAdequada}`);
        
        if (r.orientacoesRepassadas) {
          detalhes.push(`Orientações: ${r.orientacoesRepassadas}`);
        }
        
        // Encaminhamentos
        if (r.encVeterinario || r.encNotificacao || r.encOutros) {
          const encs = [];
          if (r.encVeterinario) encs.push("Veterinário");
          if (r.encNotificacao) encs.push("Notificação");
          if (r.encOutros) encs.push("Outros");
          detalhes.push(`Encaminhamentos: ${encs.join(", ")}`);
          if (r.descricaoEncaminhamentos) {
            detalhes.push(`Detalhes: ${r.descricaoEncaminhamentos}`);
          }
        }
        
        if (r.necessidadeNovaVisita === "Sim" && r.dataProximaVisita) {
          detalhes.push(`Próxima visita: ${formatarData(r.dataProximaVisita)}`);
        }
        
        if (r.observacoesGerais) {
          detalhes.push(`Observações: ${r.observacoesGerais}`);
        }
        
        if (r.profissionalResponsavel) {
          detalhes.push(`Responsável: ${r.profissionalResponsavel}`);
        }
        
        if (detalhes.length > 0) {
          desc = detalhes.join(" | ");
        }
      }
      
      timeline.push({
        data: v.data,
        tipo: "Esporotricose - Acompanhamento",
        descricao: desc,
      });
    });
  });

  // Ordenar por data
  timeline.sort((a, b) => new Date(b.data) - new Date(a.data));

  // Gerar tabela
  if (timeline.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhum atendimento registrado.", 105, yPos + 20, { align: "center" });
  } else {
    const tableData = timeline.map(item => [
      formatarData(item.data),
      item.tipo,
      item.descricao
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Data', 'Tipo', 'Descrição']],
      body: tableData,
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
        0: { cellWidth: 25, halign: 'left' },
        1: { cellWidth: 50, halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 107, halign: 'left' },
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

  // Salvar
  const nomeArquivo = `Historico_${animal.nome || animal.id}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeArquivo);
}
