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

// ── GERADOR ────────────────────────────────────────────────────────────────
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
  });

  modelo.paragrafos({ tutor, animal, dados: registro }).forEach((p) => {
    base.paragrafo("", p, 0);
  });

  // ── LOCAL E DATA — linha de preenchimento manual no modelo em branco ────
  base.y += 2;
  const data = emBranco ? "" : dataDoTermo(dados.data);
  base.paragrafo("Local e data", data ? `Muriaé, ${data}.` : `Muriaé, ____ de ______________ de ______.`);

  // ── ASSINATURAS — sempre preservadas ────────────────────────────────────
  base.y += 4;
  if (tutor || emBranco) {
    base.assinatura("", modelo.assinaturaResponsavel);
  }
  base.assinatura("", modelo.assinaturaVeterinario);

  base.finalizar();
  const arquivo = dados.arquivo || `${modelo.arquivo}${emBranco ? "" : "-preenchido"}.pdf`;
  return base.doc.save(arquivo);
}

export { formatarData };
