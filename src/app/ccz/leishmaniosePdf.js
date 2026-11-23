// ═══════════════════════════════════════════════════════════════════════════
// PDF — FICHA DE FISCALIZAÇÃO E ACOMPANHAMENTO / LEISHMANIOSE
// Centro de Controle de Zoonoses de Muriaé. Formato A4, pronto para impressão.
//
// Usa EXCLUSIVAMENTE os dados históricos gravados na fiscalização (snapshot
// do animal, do tutor e da equipe na data) — nada é relido dos cadastros
// centrais, para que o documento não mude retroativamente.
//
// Campos não preenchidos aparecem como "—" (nunca como resposta negativa).
// As assinaturas ficam em espaço livre para assinatura manual.
// ═══════════════════════════════════════════════════════════════════════════

import jsPDF from "jspdf";

const MARGEM_X = 15;
const LARGURA_UTIL = 180;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const formatarData = (ymd) => {
  if (!ymd) return "—";
  const s = String(ymd).slice(0, 10);
  const partes = s.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : s;
};

const dataPorExtenso = (ymd) => {
  if (!ymd) return "____ de ____________________ de ______";
  const [a, m, d] = String(ymd).slice(0, 10).split("-");
  return `${d} de ${MESES[Number(m) - 1] || "__________"} de ${a}`;
};

const valor = (v) => {
  if (v === null || v === undefined) return "—";
  const t = String(v).trim();
  return t === "" ? "—" : t;
};

export function gerarPdfLeishmaniose(registro) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const paginaAltura = doc.internal.pageSize.getHeight();
  const rodapeY = paginaAltura - 12;
  let y = 15;

  const novaPaginaSePreciso = (altura = 10) => {
    if (y + altura > paginaAltura - 20) {
      doc.addPage();
      y = 18;
    }
  };

  // ── CABEÇALHO INSTITUCIONAL ────────────────────────────────────────────
  try {
    doc.addImage("/img/logo/logo-ccz.png", "PNG", MARGEM_X, y, 18, 18);
  } catch {
    /* sem imagem o documento continua válido */
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("PREFEITURA MUNICIPAL DE MURIAÉ", MARGEM_X + 22, y + 5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Secretaria Municipal de Saúde", MARGEM_X + 22, y + 10);
  doc.text("Centro de Controle de Zoonoses", MARGEM_X + 22, y + 14.5);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("CEP 36880-000 — Muriaé/MG", MARGEM_X + 22, y + 19);

  y += 24;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(MARGEM_X, y, MARGEM_X + LARGURA_UTIL, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("FICHA DE FISCALIZAÇÃO E ACOMPANHAMENTO", MARGEM_X + LARGURA_UTIL / 2, y, {
    align: "center",
  });
  y += 6;
  doc.setFontSize(11);
  doc.text("LEISHMANIOSE", MARGEM_X + LARGURA_UTIL / 2, y, { align: "center" });
  y += 7;

  // ── FINALIDADE ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const finalidade = doc.splitTextToSize(
    "Verificar as condições de manejo e tratamento de animal positivo para Leishmaniose, com foco na avaliação do risco à saúde pública e da responsabilidade do(a) tutor(a) quanto aos cuidados com o animal e o cumprimento das orientações sanitárias e terapêuticas passadas pelo Médico Veterinário.",
    LARGURA_UTIL - 6,
  );
  const alturaFinalidade = finalidade.length * 3.4 + 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(MARGEM_X, y, LARGURA_UTIL, alturaFinalidade, "FD");
  doc.text(finalidade, MARGEM_X + 3, y + 4.5);
  y += alturaFinalidade + 7;

  // ── TÍTULO DE SEÇÃO ────────────────────────────────────────────────────
  const secao = (titulo) => {
    novaPaginaSePreciso(14);
    doc.setFillColor(15, 23, 42);
    doc.rect(MARGEM_X, y, LARGURA_UTIL, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo.toUpperCase(), MARGEM_X + 3, y + 4.6);
    y += 9;
  };

  // Linha rótulo/valor em duas colunas.
  const linha = (rotulo1, valor1, rotulo2, valor2) => {
    novaPaginaSePreciso(11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(rotulo1, MARGEM_X, y);
    if (rotulo2) doc.text(rotulo2, MARGEM_X + 92, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(valor(valor1), 86)[0], MARGEM_X, y + 4.5);
    if (rotulo2) {
      doc.text(doc.splitTextToSize(valor(valor2), 86)[0], MARGEM_X + 92, y + 4.5);
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGEM_X, y + 6.5, MARGEM_X + LARGURA_UTIL, y + 6.5);
    y += 10;
  };

  // Bloco de texto com quebra automática de linha.
  const paragrafo = (rotulo, texto, alturaMinima = 0) => {
    const conteudo = texto ? doc.splitTextToSize(valor(texto), LARGURA_UTIL - 6) : ["—"];
    const altura = Math.max(alturaMinima, conteudo.length * 4 + 9);
    novaPaginaSePreciso(altura + 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(rotulo, MARGEM_X, y);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(MARGEM_X, y + 2.5, LARGURA_UTIL, altura - 2.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(conteudo, MARGEM_X + 3, y + 7.5);
    y += altura + 4;
  };

  // ── 1. IDENTIFICAÇÃO DO RESPONSÁVEL PELO ANIMAL ────────────────────────
  if (registro.tutorNome) {
    secao("1. Identificação do Responsável pelo Animal");
    linha("NOME COMPLETO", registro.tutorNome, "CPF", registro.tutorCpf);
    linha("TELEFONE", registro.tutorTelefone, "BAIRRO", registro.tutorBairro);
    paragrafo("ENDEREÇO COMPLETO", registro.tutorEndereco);
  }

  // ── 2. IDENTIFICAÇÃO DO ANIMAL ─────────────────────────────────────────
  secao(`${registro.tutorNome ? "2" : "1"}. Identificação do Animal`);
  linha("NOME DO ANIMAL", registro.animalNome || "Sem nome", "ID CCZ", registro.animalId);
  linha("ESPÉCIE", registro.animalEspecie, "SEXO", registro.animalSexo);
  linha("IDADE ESTIMADA", registro.animalIdade, "RAÇA/PELAGEM", registro.animalRacaPelagem);
  linha(
    "POSSUI IDENTIFICAÇÃO (COLEIRA OU CHIP)",
    registro.animalIdentificacao,
    "DATA DA FISCALIZAÇÃO",
    formatarData(registro.dataFiscalizacao),
  );

  // ── 3. CONDIÇÃO CLÍNICA E TRATAMENTO ───────────────────────────────────
  secao("3. Condição Clínica e Tratamento");
  linha(
    "AINDA APRESENTA LESÕES COMPATÍVEIS COM A DOENÇA?",
    registro.apresentaLesoes,
    "QUAIS LESÕES?",
    registro.quaisLesoes,
  );
  linha(
    "EM TRATAMENTO VETERINÁRIO CONTÍNUO?",
    registro.emTratamento,
    "INÍCIO DO TRATAMENTO",
    formatarData(registro.tratamentoInicio),
  );
  linha(
    "PROFISSIONAL OU SERVIÇO DE REFERÊNCIA",
    registro.profissionalRef,
    "POSOLOGIA CORRETA ADMINISTRADA?",
    registro.posologiaCorreta,
  );
  linha(
    "HOUVE INTERRUPÇÃO DO TRATAMENTO?",
    registro.interrupcao,
    "MOTIVO DA INTERRUPÇÃO",
    registro.interrupcaoMotivo,
  );
  linha(
    "REGISTRO DE RETORNO/REVISÃO VETERINÁRIA?",
    registro.retornoVeterinario,
    "DATA DO RETORNO",
    formatarData(registro.retornoData),
  );
  paragrafo("MEDICAMENTOS PRESCRITOS", registro.medicamentos);

  // ── 4. MANEJO E BIOSSEGURANÇA ──────────────────────────────────────────
  secao("4. Conduta do Tutor quanto ao Manejo e Biossegurança");
  linha(
    "MANTIDO COM COLEIRA REPELENTE?",
    registro.coleiraRepelente,
    "INTERVALO DE TROCA",
    registro.coleiraTroca,
  );
  linha(
    "FREQUÊNCIA DA HIGIENIZAÇÃO",
    registro.frequenciaHigiene,
    "ACESSO A ÁREAS PERIURBANAS OU MATA?",
    registro.acessoAreaRural,
  );
  linha(
    "VIAJOU PARA OUTRO MUNICÍPIO?",
    registro.deslocamento,
    "QUANDO OCORREU",
    registro.deslocamentoQuando,
  );
  paragrafo("PRODUTOS UTILIZADOS NA HIGIENIZAÇÃO E RESÍDUOS CONTAMINADOS", registro.produtosHigiene);

  // ── 5. OUTROS ANIMAIS E PESSOAS ────────────────────────────────────────
  secao("5. Outros Animais e Pessoas na Residência");
  linha(
    "EXISTEM OUTROS ANIMAIS NO DOMICÍLIO?",
    registro.outrosAnimais,
    "OUTROS ANIMAIS COM LESÕES SUSPEITAS?",
    registro.outrosComLesoes,
  );
  linha(
    "PESSOAS COM LESÕES SUSPEITAS DE LEISHMANIOSE CUTÂNEA?",
    registro.pessoasComLesoes,
    "ORIENTADAS A PROCURAR ATENDIMENTO MÉDICO?",
    registro.pessoasOrientadas,
  );
  paragrafo("ESPÉCIES E QUANTIDADES DE OUTROS ANIMAIS", registro.outrosAnimaisDesc);

  // ── 6. CONDIÇÕES DO AMBIENTE ───────────────────────────────────────────
  secao("6. Condições do Ambiente");
  linha(
    "CONDIÇÕES SANITÁRIAS GERAIS",
    registro.condicoesSanitarias,
    "RISCO DE DISSEMINAÇÃO DA DOENÇA?",
    registro.riscoDisseminacao,
  );
  linha("HÁ RISCO À SAÚDE PÚBLICA IDENTIFICADO?", registro.riscoSaudePublica);
  paragrafo("OBSERVAÇÕES", registro.condicoesObs);
  paragrafo("DESCRIÇÃO DOS RISCOS IDENTIFICADOS", registro.riscoDescricao);

  // ── 7. CONHECIMENTO E COMPROMETIMENTO ──────────────────────────────────
  if (registro.tutorNome) {
    secao("7. Conhecimento, Comprometimento e Orientações");
    linha("ORIENTADO SOBRE A ZOONOSE E FORMAS DE TRANSMISSÃO", registro.orientZoonose, "TRATAMENTO CONTÍNUO", registro.orientTratamento);
    linha("USO CORRETO DA COLEIRA REPELENTE", registro.orientColeira, "CONTATAR O CCZ EM NOVAS LESÕES", registro.orientNovasLesoes);
    linha(
      "CIENTE DA OBRIGATORIEDADE DAS ORIENTAÇÕES SANITÁRIAS E TERAPÊUTICAS",
      registro.orientObrigacoes,
      "DEMONSTRA COMPROMETIMENTO?",
      registro.comprometimento,
    );
  }

  // ── 8. CONCLUSÃO DA EQUIPE TÉCNICA ─────────────────────────────────────
  secao(`${registro.tutorNome ? "8" : "7"}. Conclusão da Equipe Técnica`);
  if (registro.tutorNome) {
    linha("CONDUTA DO TUTOR", registro.condutaTutor);
  }
  linha("SITUAÇÃO GERAL", registro.situacaoGeral);
  paragrafo(
    "ENCAMINHAMENTOS SUGERIDOS",
    [
      registro.encAcompanhamento && "Acompanhamento periódico pelo CCZ",
      registro.encNotificacao && "Notificação formal ao tutor",
      registro.encOutrasMedidas && "Outras medidas sanitárias",
    ]
      .filter(Boolean)
      .join("; ") || null,
  );
  if (registro.encOutrasMedidas) {
    paragrafo("DESCRIÇÃO DAS OUTRAS MEDIDAS", registro.encOutrasDescricao);
  }

  // ── 9. ASSINATURAS ─────────────────────────────────────────────────────
  secao("9. Assinaturas");
  novaPaginaSePreciso(20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Muriaé/MG, ${dataPorExtenso(registro.dataFiscalizacao)}.`,
    MARGEM_X + LARGURA_UTIL,
    y,
    { align: "right" },
  );
  y += 8;

  // Equipe técnica participante (inclui o responsável pela fiscalização).
  const equipe = registro.equipe?.length
    ? registro.equipe
    : [
        {
          nome: registro.responsavelNome,
          cargo: registro.responsavelCargo,
        },
      ];

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("EQUIPE TÉCNICA PARTICIPANTE", MARGEM_X, y);
  y += 5;
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  equipe.forEach((m) => {
    novaPaginaSePreciso(6);
    doc.text(
      `${valor(m.nome)}${m.cargo ? ` — ${m.cargo}` : ""}${
        m.naoRemovivel || m.usuarioCpf ? " (responsável pela fiscalização)" : ""
      }`,
      MARGEM_X + 2,
      y,
    );
    y += 5;
  });
  y += 4;

  const assinatura = (nome, funcao, registroProf) => {
    novaPaginaSePreciso(24);
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(MARGEM_X + 20, y + 10, MARGEM_X + 110, y + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(valor(nome), MARGEM_X + 65, y + 14.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${funcao}${registroProf ? ` — ${registroProf}` : ""}`,
      MARGEM_X + 65,
      y + 18.5,
      { align: "center" },
    );
    y += 24;
  };

  if (registro.tutorNome) {
    assinatura(registro.tutorNome, "Tutor(a) do animal", null);
  }

  const veterinarios = registro.veterinarios?.length
    ? registro.veterinarios
    : [];

  veterinarios.forEach((v, i) => {
    assinatura(
      v.nome,
      v.cargo || (i === 0 ? "Médico(a) Veterinário(a) do CCZ" : "Médico(a) Veterinário(a)"),
      v.registro,
    );
  });

  assinatura(
    registro.coordenadorNome,
    registro.coordenadorCargo || "Coordenador(a) e Responsável Técnico(a)",
    null,
  );

  // ── RODAPÉ EM TODAS AS PÁGINAS ─────────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGEM_X, rodapeY - 3, MARGEM_X + LARGURA_UTIL, rodapeY - 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Ficha de Fiscalização e Acompanhamento — Leishmaniose · CCZ Muriaé/MG`,
      MARGEM_X,
      rodapeY + 1,
    );
    doc.text(`Página ${p} de ${total}`, MARGEM_X + LARGURA_UTIL, rodapeY + 1, {
      align: "right",
    });
  }

  const nomeArquivo = `leishmaniose-${(registro.animalNome || registro.animalId || "ficha")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()}-${String(registro.dataFiscalizacao || "").slice(0, 10)}.pdf`;

  doc.save(nomeArquivo);
  return doc;
}
