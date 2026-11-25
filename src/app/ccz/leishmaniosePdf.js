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

import { criarDocumentoCcz } from "./documentoCcz";
import { obterLogoCcz } from "./logoCcz";
import { padraoRelatorio } from "./historicoAnimalPdf";

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

export async function gerarPdfLeishmaniose(registro) {
  const base = criarDocumentoCcz({
    logo: await obterLogoCcz(),
    titulo: "FICHA DE FISCALIZAÇÃO E ACOMPANHAMENTO",
    subtitulo: "LEISHMANIOSE",
    identificacao: `Registro ${valor(registro.id)} · Fiscalização de ${formatarData(registro.dataFiscalizacao)}`,
    nota: "Verificar as condições de manejo e tratamento de animal positivo para Leishmaniose, com foco na avaliação do risco à saúde pública e da responsabilidade do(a) tutor(a) quanto aos cuidados com o animal e o cumprimento das orientações sanitárias e terapêuticas passadas pelo Médico Veterinário.",
  });

  const doc = base.doc;
  const novaPaginaSePreciso = base.novaPagina;
  // Padrão do relatório clínico-administrativo da Ficha Completa do Animal:
  // títulos em azul escuro sem barras, divisórias finas, rótulo + valor.
  const { secao, subtitulo, campos, paragrafo } = padraoRelatorio(base);

  /** Duas colunas de rótulo + valor (mesma apresentação do Histórico). */
  const linha = (rotulo1, valor1, rotulo2, valor2) => {
    const pares = rotulo2 ? [[rotulo1, valor1], [rotulo2, valor2]] : [[rotulo1, valor1]];
    campos(pares, 2);
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

  // ── 9. SITUAÇÃO DO CASO / ENCERRAMENTO ────────────────────────────────
  // Só é impressa quando o caso foi encerrado; casos em acompanhamento não
  // recebem a seção (o campo em branco nunca vira "Não").
  if (registro.situacaoCaso === "ENCERRADO") {
    secao("9. Encerramento do Acompanhamento");
    linha("SITUAÇÃO DO CASO", "Encerrado");
    linha("DESFECHO DO CASO", registro.desfecho);
    linha("DATA DO ENCERRAMENTO", formatarData(registro.dataEncerramento));
    linha("ENCERRADO POR", registro.encerradoPorNome);
    paragrafo("OBSERVAÇÃO / JUSTIFICATIVA DO ENCERRAMENTO", registro.justificativaEncerramento);
  }

  // ── 10. ASSINATURAS ────────────────────────────────────────────────────
  secao(`${registro.situacaoCaso === "ENCERRADO" ? "10" : "9"}. Assinaturas`);
  novaPaginaSePreciso(20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Muriaé/MG, ${dataPorExtenso(registro.dataFiscalizacao)}.`,
    MARGEM_X + LARGURA_UTIL,
    base.y,
    { align: "right" },
  );
  base.y += 8;

  // Equipe técnica participante (inclui o responsável pela fiscalização).
  const equipe = registro.equipe?.length
    ? registro.equipe
    : [
        {
          nome: registro.responsavelNome,
          cargo: registro.responsavelCargo,
        },
      ];

  subtitulo("Equipe técnica participante");
  equipe.forEach((m) => {
    novaPaginaSePreciso(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `${valor(m.nome)}${m.cargo ? ` — ${m.cargo}` : ""}${
        m.naoRemovivel || m.usuarioCpf ? " (responsável pela fiscalização)" : ""
      }`,
      MARGEM_X,
      base.y,
    );
    base.y += 4.6;
  });
  base.y += 4;

  // Assinaturas em espaço livre para assinatura manual, LADO A LADO.
  const veterinarios = registro.veterinarios?.length ? registro.veterinarios : [];

  const assinaturas = [];
  if (registro.tutorNome) {
    assinaturas.push({ nome: registro.tutorNome, funcao: "Tutor(a) do animal" });
  }
  veterinarios.forEach((v, i) => {
    assinaturas.push({
      nome: v.nome,
      funcao:
        v.cargo || (i === 0 ? "Médico(a) Veterinário(a) do CCZ" : "Médico(a) Veterinário(a)"),
      registro: v.registro,
    });
  });
  assinaturas.push({
    nome: registro.coordenadorNome,
    funcao: registro.coordenadorCargo || "Coordenador(a) e Responsável Técnico(a)",
  });

  base.assinaturas(assinaturas);

  base.finalizar();

  const nomeArquivo = `leishmaniose-${(registro.animalNome || registro.animalId || "ficha")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()}-${String(registro.dataFiscalizacao || "").slice(0, 10)}.pdf`;

  doc.save(nomeArquivo);
  return doc;
}
