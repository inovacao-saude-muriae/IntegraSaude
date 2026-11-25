// ═══════════════════════════════════════════════════════════════════════════
// PDF — FICHA DE ESPOROTRICOSE
// Centro de Controle de Zoonoses de Muriaé.
//
// Organiza TODAS as informações registradas no formulário existente,
// preservando identificação, condição clínica, tratamento, manejo,
// orientações, conclusão e encaminhamentos.
//
// A classificação (Em andamento / Encerrado) é indicada por TEXTO — nunca só
// por cor — para permanecer legível em impressão preto e branco.
// Campos não preenchidos aparecem como "—".
// A apresentação vem do template institucional (documentoCcz.js).
// ═══════════════════════════════════════════════════════════════════════════

import { criarDocumentoCcz, formatarData, nomeArquivo, texto } from "./documentoCcz";
import { obterLogoCcz } from "./logoCcz";
import { padraoRelatorio } from "./historicoAnimalPdf";
import { gerarTermoPdf } from "./termoCcz";

const MARGEM_X = 15;
const LARGURA_UTIL = 180;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

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

const mascararTelefone = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor(v);
};

const simNao = (v) => valor(v);

/**
 * Ficha de Esporotricose — MESMO padrão visual do Histórico Completo do
 * Animal e da Ficha de Fiscalização da Leishmaniose: cabeçalho institucional,
 * títulos em azul escuro sem barras, divisórias finas, rótulo + valor.
 * Sem fotografia do animal.
 */
export async function gerarPdfEsporotricose(data) {
  const d = data || {};
  const animal = d.animal || {};
  const tutor = d.temTutor && d.tutor ? d.tutor : null;
  const encerrado = Boolean(d.encerrado);
  const classificacao = encerrado ? "ENCERRADO" : "EM ANDAMENTO";

  const base = criarDocumentoCcz({
    logo: await obterLogoCcz(),
    titulo: "FICHA DE ESPOROTRICOSE",
    subtitulo: "ACOMPANHAMENTO DE ANIMAL",
    identificacao: `Registro ${valor(d.id)} · Visita de ${formatarData(d.dataVisita)}`,
    nota: "Ficha de acompanhamento de animal com esporotricose, com registro da avaliação clínica, do tratamento, do manejo domiciliar e das orientações sanitárias prestadas pela equipe do Centro de Controle de Zoonoses.",
  });

  const doc = base.doc;
  const novaPaginaSePreciso = base.novaPagina;
  const { secao, subtitulo, campos, paragrafo } = padraoRelatorio(base);

  /** Duas colunas de rótulo + valor (mesma apresentação do Histórico). */
  const linha = (rotulo1, valor1, rotulo2, valor2) => {
    const pares = rotulo2 ? [[rotulo1, valor1], [rotulo2, valor2]] : [[rotulo1, valor1]];
    campos(pares, 2);
  };

  // ── 1. IDENTIFICAÇÃO DO REGISTRO ────────────────────────────────────────
  secao("1. Identificação do Registro");
  linha("DATA DA VISITA", formatarData(d.dataVisita), "FISCAL RESPONSÁVEL", valor(d.fiscalResponsavel));
  linha("CLASSIFICAÇÃO", classificacao, "ENCERRADO EM", encerrado ? formatarData(d.dataEncerramentoYmd || d.dataEncerramento) : "—");
  if (encerrado) {
    linha("DESFECHO DO CASO", valor(d.desfecho), "ENCERRADO POR", valor(d.encerradoPor));
  }

  // ── 2. IDENTIFICAÇÃO DO ANIMAL ─────────────────────────────────────────
  secao("2. Identificação do Animal");
  linha("NOME DO ANIMAL", animal.nome || "Sem nome", "ID CCZ", valor(animal.id || d.animalId));
  linha("ESPÉCIE", valor(animal.especie), "SEXO", valor(animal.sexo));
  linha("PORTE", valor(animal.porte), "IDADE ESTIMADA", valor(animal.idade));
  linha(
    "RAÇA/PELAGEM",
    valor(animal.racaPelagem || animal.raca),
    "POSSUI IDENTIFICAÇÃO (COLEIRA OU CHIP)",
    valor(animal.possuiIdentificacao),
  );

  // ── 3. TUTOR RESPONSÁVEL (só quando houver) ────────────────────────────
  if (tutor) {
    secao("3. Tutor Responsável");
    linha("NOME COMPLETO", valor(tutor.nome), "CPF", valor(tutor.cpf));
    linha("TELEFONE", mascararTelefone(tutor.telefone));
    paragrafo("ENDEREÇO COMPLETO", tutor.endereco);
  }

  // ── 4. CONDIÇÃO CLÍNICA E TRATAMENTO ───────────────────────────────────
  secao(`${tutor ? "4" : "3"}. Condição Clínica e Tratamento`);
  linha(
    "APRESENTA LESÕES COMPATÍVEIS COM A DOENÇA?",
    simNao(d.apresentaLesoes),
    "EM TRATAMENTO VETERINÁRIO?",
    simNao(d.emTratamentoVeterinario),
  );
  paragrafo("DESCRIÇÃO DAS LESÕES", d.apresentaLesoes === "Sim" ? d.descricaoLesoes : null);
  paragrafo("DESCRIÇÃO DO TRATAMENTO", d.emTratamentoVeterinario === "Sim" ? d.descricaoTratamentoVet : null);
  paragrafo("MEDICAMENTOS PRESCRITOS", d.medicamentosPrescritos);
  linha(
    "HOUVE INTERRUPÇÃO DO TRATAMENTO?",
    simNao(d.interrupcaoTratamento),
    "REGISTRO DE RETORNO VETERINÁRIO?",
    simNao(d.retornoVeterinario),
  );

  // ── 5. MANEJO DOMICILIAR (só com tutor) ────────────────────────────────
  if (tutor) {
    secao("5. Manejo Domiciliar e Biossegurança");
    linha("ISOLAMENTO DOMICILIAR", simNao(d.isolamentoDomiciliar), "ACESSO À RUA", simNao(d.acessoRua));
    paragrafo("OBSERVAÇÕES DO ISOLAMENTO", d.isolamentoDomiciliar === "Sim" ? d.observacoesIsolamento : null);
    linha("USO DE EPI", simNao(d.usoEpi), "QUAIS EPIs", valor(d.quaisEpis));
    paragrafo("HIGIENIZAÇÃO DO AMBIENTE", d.higienizacaoAmbiente);

    // ── 6. OUTROS ANIMAIS E PESSOAS ──────────────────────────────────────
    secao("6. Outros Animais e Pessoas na Residência");
    linha(
      "OUTROS ANIMAIS NA RESIDÊNCIA",
      simNao(d.outrosAnimaisResidencia),
      "PESSOAS COM LESÕES",
      simNao(d.pessoasComLesoes),
    );
    paragrafo(
      "DESCRIÇÃO DOS OUTROS ANIMAIS",
      d.outrosAnimaisResidencia === "Sim" ? d.outrosAnimaisDescricao : null,
    );
    paragrafo("DESCRIÇÃO DAS PESSOAS COM LESÕES", d.pessoasComLesoes === "Sim" ? d.pessoasLesoesDescricao : null);

    // ── 7. CIÊNCIA DO RESPONSÁVEL ────────────────────────────────────────
    secao("7. Ciência do Responsável");
    linha(
      "CIENTE DO TRATAMENTO CONTÍNUO",
      simNao(d.cienteTratamentoContinuo),
      "CIENTE DA CONTENÇÃO DOMICILIAR",
      simNao(d.cienteContencao),
    );
    linha("CIENTE DO USO DE EPI/LUVAS", simNao(d.cienteEpi), "CIENTE DA DESTINAÇÃO DE RESÍDUOS", simNao(d.cienteResiduos));
  }

  // ── 8. CONCLUSÃO DA EQUIPE TÉCNICA ─────────────────────────────────────
  secao(`${tutor ? "8" : "4"}. Conclusão da Equipe Técnica`);
  paragrafo("CONDIÇÕES GERAIS DO AMBIENTE", d.condicoesGeraisAmbiente);
  paragrafo(
    "CONCLUSÃO TÉCNICA",
    d.conclusaoTecnica || (d.condicoesGeraisAmbiente ? null : "Nenhuma conclusão registrada."),
  );
  const encaminhamentos = [
    d.encAcompanhamentoCcz && "Acompanhamento periódico pelo CCZ",
    d.encNotificacaoTutor && "Notificação formal ao tutor",
    d.encMinisterioPublico && "Encaminhamento ao Ministério Público",
    d.encOutrasMedidas && "Outras medidas sanitárias",
  ].filter(Boolean);
  paragrafo("ENCAMINHAMENTOS", encaminhamentos.length ? encaminhamentos.join("; ") : null);
  if (d.encOutrasMedidas && d.outrasMedidasDescricao) {
    paragrafo("DESCRIÇÃO DAS OUTRAS MEDIDAS", d.outrasMedidasDescricao);
  }

  // ── 9. ENCERRAMENTO DO ACOMPANHAMENTO ──────────────────────────────────
  // Impressa só quando o caso foi encerrado (campo vazio nunca vira "Não").
  if (encerrado) {
    secao(`${tutor ? "9" : "5"}. Encerramento do Acompanhamento`);
    linha("SITUAÇÃO DO CASO", "Encerrado");
    linha("DESFECHO DO CASO", valor(d.desfecho));
    linha("DATA DO ENCERRAMENTO", formatarData(d.dataEncerramentoYmd || d.dataEncerramento));
    linha("ENCERRADO POR", valor(d.encerradoPor));
    paragrafo("OBSERVAÇÃO / JUSTIFICATIVA DO ENCERRAMENTO", d.justificativaEncerramento);
  }

  // ── VISITAS DE ACOMPANHAMENTO ──────────────────────────────────────────
  if (Array.isArray(d.visitas) && d.visitas.length > 0) {
    const numero = secaoNumero(tutor, encerrado, 1);
    secao(`${numero}. Visitas de Acompanhamento`);
    d.visitas.forEach((v) => {
      let descricao = v.observacao || "Visita de acompanhamento";
      if (v.temRelatorio && v.relatorio) {
        const r = v.relatorio;
        const detalhes = [];
        if (r.evolucaoQuadro) detalhes.push(`Evolução: ${r.evolucaoQuadro}`);
        if (r.apresentaLesoes === "Sim" && r.descricaoLesoes) detalhes.push(`Lesões: ${r.descricaoLesoes}`);
        if (r.medicamentosAtuais) detalhes.push(`Medicamentos: ${r.medicamentosAtuais}`);
        if (r.adesaoTratamento) detalhes.push(`Adesão: ${r.adesaoTratamento}`);
        if (r.isolamentoAdequado) detalhes.push(`Isolamento: ${r.isolamentoAdequado}`);
        if (r.usoEpiAdequado) detalhes.push(`Uso de EPI: ${r.usoEpiAdequado}`);
        if (r.higienizacaoAdequada) detalhes.push(`Higienização: ${r.higienizacaoAdequada}`);
        if (r.orientacoesRepassadas) detalhes.push(`Orientações: ${r.orientacoesRepassadas}`);
        if (detalhes.length > 0) descricao = detalhes.join(" · ");
      }
      paragrafo(`VISITA — ${formatarData(v.data)}`, descricao);
    });
  }

  // ── ASSINATURAS ────────────────────────────────────────────────────────
  secao(`${secaoNumero(tutor, encerrado, Array.isArray(d.visitas) && d.visitas.length ? 2 : 1)}. Assinaturas`);
  novaPaginaSePreciso(20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Muriaé/MG, ${dataPorExtenso(d.dataVisita)}.`,
    MARGEM_X + LARGURA_UTIL,
    base.y,
    { align: "right" },
  );
  base.y += 8;

  if (d.fiscalResponsavel) {
    subtitulo("Equipe técnica participante");
    novaPaginaSePreciso(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(30, 41, 59);
    doc.text(`${valor(d.fiscalResponsavel)} — Fiscal responsável`, MARGEM_X, base.y);
    base.y += 4.6;
    base.y += 4;
  }

  const assinaturas = [];
  if (tutor) {
    assinaturas.push({ nome: tutor.nome, funcao: "Tutor(a) do animal" });
  }
  assinaturas.push({ nome: d.fiscalResponsavel, funcao: "Fiscal responsável — CCZ" });
  base.assinaturas(assinaturas);

  base.finalizar();
  return doc.save(nomeArquivo("ficha-esporotricose", d.id, animal.id || d.animalId));
}

/**
 * Número da última seção de dados, para a seguinte continuar a sequência:
 * com tutor a ficha usa 1–8 (e 9 no encerramento); sem tutor, 1–4 (e 5).
 */
function secaoNumero(temTutor, encerrado, extra) {
  const ultima = temTutor ? (encerrado ? 9 : 8) : encerrado ? 5 : 4;
  return ultima + extra;
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMO DE VISTORIA / ESPOROTRICOSE — usa o MODELO ÚNICO dos termos
// (termoCcz.js), o mesmo de Gerenciamento > Termos. Havendo tutor, nome e
// endereço são preenchidos; sem tutor, a linha permanece em branco.
// ═══════════════════════════════════════════════════════════════════════════

export async function gerarTermoEsporotricose(data) {
  const d = data || {};
  const animal = d.animal || {};
  return gerarTermoPdf("esporotricose", {
    animal: {
      id: animal.id || d.animalId,
      nome: animal.nome,
      especie: animal.especie,
    },
    tutor: d.tutor?.nome ? d.tutor : null,
    registro: { fiscalResponsavel: d.fiscalResponsavel },
    data: d.dataVisita,
    arquivo: nomeArquivo("termo-esporotricose", d.id),
  });
}
