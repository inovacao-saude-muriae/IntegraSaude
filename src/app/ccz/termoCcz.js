// ═══════════════════════════════════════════════════════════════════════════
// TERMOS DO CCZ — MODELO ÚNICO
//
// Fonte única do layout dos três termos:
//   • Termo de Procedimento Veterinário
//   • Termo de Vistoria / Esporotricose
//   • Termo de Compromisso e Responsabilidade (Denúncias)
//
// Os mesmos textos e o mesmo layout servem para:
//   • Gerenciamento > Termos  → modelo EM BRANCO (linhas de preenchimento);
//   • Serviços (Procedimentos, Esporotricose, Denúncias) → modelo PREENCHIDO
//     com os dados do registro selecionado.
//
// Regras de preenchimento:
//   • Havendo tutor, entram nome completo e endereço completos.
//   • NÃO havendo tutor, a linha de preenchimento permanece em branco — nunca
//     aparece "Sem tutor", "Não informado" ou dado fictício.
//   • Os espaços para assinatura manual são sempre preservados.
//
// A apresentação (cabeçalho, tipografia, margens, rodapé e paginação) vem do
// template institucional documentoCcz.js.
// ═══════════════════════════════════════════════════════════════════════════

import { criarDocumentoCcz, formatarData, hoje } from "./documentoCcz";
import { obterLogoCcz } from "./logoCcz";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const LINHA = "______________________________________________";

const preencher = (valor, largura = LINHA.length) => {
  const t = String(valor ?? "").trim();
  return t || "_".repeat(largura);
};

const ITENS_ESPOROTRICOSE = [
  "A esporotricose é uma doença causada por fungo, transmissível ao ser humano;",
  "O animal diagnosticado deve ser tratado conforme orientação veterinária;",
  "É necessário manter o animal em ambiente adequado, evitando o contato com outros animais e pessoas vulneráveis;",
  "Os cuidados de higiene e manejo são fundamentais para prevenir a disseminação da doença;",
  "O acompanhamento veterinário deve ser mantido até a alta clínica.",
];

const ITENS_DENUNCIA = [
  "Manter o animal devidamente contido e sob vigilância, evitando sua circulação livre em vias públicas;",
  "Utilizar focinheira e guia apropriadas durante passeios em locais públicos, conforme legislação vigente;",
  "Garantir que o animal permaneça em local seguro dentro da propriedade, com cercamento adequado;",
  "Não permitir que o animal tenha acesso direto a pessoas que transitam pela via pública;",
  "Providenciar atendimento veterinário caso seja identificado comportamento agressivo persistente;",
  "Comunicar ao CCZ qualquer incidente envolvendo o animal.",
];

const ITENS_CUIDADOS_LEISHMANIOSE = [
  "Manter o animal domiciliado e sem acesso à rua durante o tratamento até alta médica;",
  "Impedir o contato do animal com outras pessoas;",
  "Administrar o tratamento terapêutico conforme orientação médica veterinária;",
  "Utilizar luvas e EPI's para fazer o tratamento do animal;",
  "Não abandonar ou recusar fazer o tratamento terapêutico do animal;",
  "Passar todas informações pertinentes ao prognóstico do animal aos veterinários do CCZ;",
  "Quando solicitado, levar o animal para acompanhamento do tratamento e controle da doença;",
  "Se necessário, solicitar a visita técnica para acompanhamento e monitoramento da doença.",
];

const ITENS_LEIS_LEISHMANIOSE = [
  "Lei Estadual nº 13.317/1999, Código de Saúde do Estado de Minas Gerais, Art. 38.",
  "Lei Municipal nº 7163/2024, normas para criação de animais, Art. 20-M, Art. 20-L, Art. 20-F, Art. 12, Art. 14, Art. 16 e Art. 17.",
];

// ── MODELOS ────────────────────────────────────────────────────────────────
// Cada modelo define: título, subtítulo, parágrafos e a linha de assinatura
// do responsável pelo animal (que some quando o animal não tem tutor).

export const MODELOS_TERMO = {
  procedimento: {
    tipo: "procedimento",
    nome: "Termo de Procedimento Veterinário",
    titulo: "TERMO DE PROCEDIMENTO VETERINÁRIO",
    subtitulo: "",
    paragrafos: ({ tutor, animal, dados }) => [
      `Eu, ${preencher(tutor?.nome, 50)}, residente no endereço ${preencher(tutor?.endereco, 80)}, responsável pelo animal ${preencher(animal?.nome, 40)}, declaro que fui devidamente informado(a) sobre o procedimento de ${preencher(dados?.tipo, 45)} que será realizado.`,
      "Fui esclarecido(a) quanto aos objetivos, riscos e benefícios do procedimento, bem como sobre os cuidados necessários no pós-procedimento.",
      "Autorizo a equipe veterinária do CCZ a realizar o procedimento acima mencionado, estando ciente de que todas as medidas de segurança e bem-estar animal serão adotadas durante a execução.",
      "Comprometo-me a seguir todas as orientações fornecidas pela equipe veterinária quanto aos cuidados pós-procedimento e retornos necessários.",
    ],
    assinaturaResponsavel: "Assinatura do Responsável pelo Animal",
    assinaturaVeterinario: "Veterinário Responsável",
    arquivo: "termo-procedimento-veterinario",
  },

  esporotricose: {
    tipo: "esporotricose",
    nome: "Termo de Vistoria / Esporotricose",
    titulo: "TERMO DE VISTORIA / ESPOROTRICOSE",
    subtitulo: "",
    paragrafos: ({ tutor, animal }) => [
      `Eu, ${preencher(tutor?.nome, 50)}, residente no endereço ${preencher(tutor?.endereco, 80)}, responsável pelo animal ${preencher(animal?.nome, 40)}, declaro que fui devidamente informado(a) pela equipe técnica do Centro de Controle de Zoonoses sobre a esporotricose felina, seus riscos à saúde pública e animal, e as medidas de controle necessárias.`,
      "Fui orientado(a) quanto aos seguintes pontos:",
      ...ITENS_ESPOROTRICOSE.map((i) => `• ${i}`),
      "Comprometo-me a seguir todas as orientações fornecidas pela equipe do CCZ e a comunicar qualquer alteração no estado de saúde do animal.",
    ],
    assinaturaResponsavel: "Assinatura do Responsável pelo Animal",
    assinaturaVeterinario: "Veterinário Responsável",
    arquivo: "termo-esporotricose",
  },

  leishmaniose: {
    tipo: "leishmaniose",
    nome: "Protocolo de Monitoramento Zoonoses — Termo de Responsabilidade",
    titulo: "PROTOCOLO DE MONITORAMENTO ZOONOSES",
    subtitulo: "FICHA DE ATENDIMENTO E TERMO DE RESPONSABILIDADE",
    cabecalho: {
      linhas: [
        { texto: "PREFEITURA MUNICIPAL DE MURIAÉ", negrito: true, tamanho: 11 },
        { texto: "SECRETARIA DE SAÚDE MUNICIPAL", tamanho: 9 },
        { texto: "CENTRO DE CONTROLE DE ZOONOSES", negrito: true, tamanho: 9.5 },
        { texto: "CEP: 36880-000, MURIAÉ, MG", tamanho: 7.5, cinza: true },
        { texto: "Telefone: 32 98832-5309", tamanho: 7.5, cinza: true },
      ],
    },
    paragrafos: ({ tutor, animal }) => [
      "**ÁREA DE CIÊNCIA DE RESPONSABILIDADE PERANTE AOS CUIDADOS E ORIENTAÇÕES MÉDICAS:**",
      `EU, ${preencher(tutor?.nome)} CPF (${preencher(tutor?.cpf, 22)})`,
      `RESIDENTE ${preencher(tutor?.endereco)}`,
      `RESPONSÁVEL PELO ANIMAL: ${preencher(animal?.nome)}`,
      "**ESTOU CIENTE E FUI ORIENTADO QUE DEVO:**",
      ...ITENS_CUIDADOS_LEISHMANIOSE.map((i) => `• ${i}`),
      "**ESTOU CIENTE E FUI ORIENTADO TAMBÉM SOBRE AS LEIS PERTINENTES AO CONTROLE DE ZOONOSES E RESPONSABILIDADES DO TUTOR PERANTE O ANIMAL:**",
      ...ITENS_LEIS_LEISHMANIOSE.map((i) => `• ${i}`),
      "**POR FIM, ESTOU CIENTE QUE O TRATAMENTO E CONTROLE DA DOENÇA SÃO DE MINHA RESPONSABILIDADE, SEGUINDO TODAS AS ORIENTAÇÕES QUE ME FORAM FORNECIDAS.**",
    ],
    // Termo administrativo: as duas assinaturas ficam SEMPRE impressas, em
    // linhas empilhadas, com os espaços preservados para preenchimento manual.
    assinaturasEmpilhadas: [
      "Assinatura do Responsável",
      "Assinatura e carimbo Médico Veterinário",
    ],
    arquivo: "protocolo-monitoramento-zoonoses",
  },

  denuncia: {
    tipo: "denuncia",
    nome: "Termo de Compromisso e Responsabilidade",
    titulo: "TERMO DE COMPROMISSO E RESPONSABILIDADE",
    subtitulo: "",
    paragrafos: ({ tutor, animal }) => [
      `Eu, ${preencher(tutor?.nome, 50)}, residente no endereço ${preencher(tutor?.endereco, 80)}, responsável pelo animal ${preencher(animal?.nome, 40)}, declaro que fui notificado(a) pela equipe do Centro de Controle de Zoonoses sobre denúncia de comportamento agressivo do animal sob minha responsabilidade.`,
      "Fui orientado(a) e comprometo-me com os seguintes pontos:",
      ...ITENS_DENUNCIA.map((i) => `• ${i}`),
      "Estou ciente de que o não cumprimento destas medidas pode resultar em apreensão do animal, aplicação de multa e outras sanções previstas na legislação municipal e estadual de proteção e controle de animais.",
      "Declaro estar ciente de minhas responsabilidades como tutor e comprometo-me a adotar todas as medidas necessárias para garantir a segurança pública.",
    ],
    assinaturaResponsavel: "Assinatura do Responsável pelo Animal",
    assinaturaVeterinario: "Veterinário Responsável",
    arquivo: "termo-compromisso-responsabilidade",
  },
};

export const modelosDisponiveis = () => Object.values(MODELOS_TERMO);

/** Data do termo: hoje (modelo em branco) ou a data do registro. */
function dataDoTermo(valor) {
  const d = valor ? new Date(valor) : new Date();
  if (Number.isNaN(d.getTime())) return hoje();
  return `${String(d.getDate()).padStart(2, "0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// ── DESENHO DO TERMO ───────────────────────────────────────────────────────
// Documento de texto corrido: parágrafos justificados, espaçamento natural,
// linhas de preenchimento integradas ao texto, orientações em lista, local e
// data, assinaturas LADO A LADO e rodapé discreto. Sem caixas, cards ou
// blocos por parágrafo.

const MARGEM = 15;
const LARGURA = 180;
const ENTRE_PARAGRAFOS = 3.6;
const ALTURA_LINHA = 4.6;

/**
 * Gera o PDF de um termo.
 *
 * @param {string} tipo  "procedimento" | "esporotricose" | "denuncia"
 * @param {object} [dados]
 * @param {object} [dados.animal]  { id, nome, especie, sexo, porte, idade }
 * @param {object|null} [dados.tutor] { nome, cpf, telefone, endereco } | null
 * @param {object} [dados.registro] dados próprios do termo (tipo do procedimento…)
 * @param {string} [dados.data]     data do registro (YYYY-MM-DD)
 * @param {boolean} [dados.emBranco] força o modelo em branco
 * @param {string} [dados.arquivo]  nome do arquivo
 */
export async function gerarTermoPdf(tipo, dados = {}) {
  const modelo = MODELOS_TERMO[tipo];
  if (!modelo) throw new Error(`Modelo de termo desconhecido: ${tipo}`);

  const emBranco = dados.emBranco === true;
  const tutor = !emBranco && dados.tutor?.nome ? dados.tutor : null;
  const animal = !emBranco ? dados.animal || null : null;
  const registro = !emBranco ? dados.registro || null : null;

  const base = criarDocumentoCcz({
    logo: await obterLogoCcz(),
    titulo: modelo.titulo,
    subtitulo: modelo.subtitulo,
    cabecalho: modelo.cabecalho,
  });
  const { doc } = base;
  let y = base.y + 4;

  const limiteY = () => base.paginaAltura - 24;

  const novaPagina = (altura) => {
    if (y + altura > limiteY()) {
      doc.addPage();
      y = MARGEM + 2;
    }
  };

  /** Parágrafo justificado, com espaçamento natural entre parágrafos. */
  const paragrafo = (txt, { negrito = false } = {}) => {
    const conteudo = String(txt || "").trim();
    if (!conteudo) return;
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const linhas = doc.splitTextToSize(conteudo, LARGURA);
    linhas.forEach((linha) => {
      novaPagina(ALTURA_LINHA * 2);
      const ultima = linha === linhas[linhas.length - 1];
      if (ultima) {
        doc.text(linha, MARGEM, y);
      } else {
        doc.text(linha, MARGEM, y, { maxWidth: LARGURA, align: "justify" });
      }
      y += ALTURA_LINHA;
    });
    y += ENTRE_PARAGRAFOS;
  };

  /** Item de lista (orientações), com recuo pendente. */
  const itemLista = (txt) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const linhas = doc.splitTextToSize(String(txt || ""), LARGURA - 6);
    linhas.forEach((linha, i) => {
      novaPagina(ALTURA_LINHA * 2);
      if (i === 0) doc.text("•", MARGEM + 1, y);
      doc.text(linha, MARGEM + 6, y);
      y += ALTURA_LINHA;
    });
    y += 1.2;
  };

  modelo.paragrafos({ tutor, animal, dados: registro }).forEach((p) => {
    const t = String(p);
    if (t.startsWith("• ")) itemLista(t.slice(2));
    else if (t.startsWith("**")) paragrafo(t.replace(/\*\*/g, ""), { negrito: true });
    else paragrafo(t);
  });

  // ── LOCAL E DATA ────────────────────────────────────────────────────────
  y += modelo.assinaturasEmpilhadas ? 6 : 6;
  novaPagina(14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const data = emBranco ? "" : dataDoTermo(dados.data);
  doc.text(data ? `Muriaé, ${data}.` : "Muriaé, ____ de ______________ de ______.", MARGEM, y);

  // ── ASSINATURAS LADO A LADO ─────────────────────────────────────────────
  y += 22;
  novaPagina(28);
  const larguraLinha = (LARGURA - 20) / 2;
  const xEsquerda = MARGEM;
  const xDireita = MARGEM + larguraLinha + 20;

  const assinatura = (x, rotulo, nome) => {
    doc.setDrawColor(120, 130, 145);
    doc.setLineWidth(0.3);
    doc.line(x, y, x + larguraLinha, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(rotulo, x + larguraLinha / 2, y + 4.5, { align: "center" });
    if (nome) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(nome, x + larguraLinha / 2, y - 1.5, { align: "center" });
    }
  };

  if (modelo.assinaturasEmpilhadas) {
    // Linhas de assinatura empilhadas e centralizadas (termo administrativo).
    const larguraAssinatura = 90;
    const xCentro = MARGEM + (LARGURA - larguraAssinatura) / 2;
    y += 2;
    modelo.assinaturasEmpilhadas.forEach((rotulo, i) => {
      if (i > 0) y += 10;
      novaPagina(24);
      doc.setDrawColor(120, 130, 145);
      doc.setLineWidth(0.3);
      doc.line(xCentro, y, xCentro + larguraAssinatura, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(rotulo, MARGEM + LARGURA / 2, y + 4.5, { align: "center" });
    });
  } else {
    if (tutor || emBranco) {
      assinatura(xEsquerda, modelo.assinaturaResponsavel, tutor?.nome || "");
    }
    assinatura(xDireita, modelo.assinaturaVeterinario, registro?.veterinario || "");
  }

  base.finalizar();
  const arquivo = dados.arquivo || `${modelo.arquivo}${emBranco ? "" : "-preenchido"}.pdf`;
  return base.doc.save(arquivo);
}

export { formatarData };
