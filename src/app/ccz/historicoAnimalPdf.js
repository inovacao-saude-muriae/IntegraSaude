// ═══════════════════════════════════════════════════════════════════════════
// PDF — FICHA DO ANIMAL
// Centro de Controle de Zoonoses de Muriaé.
//
// Identificação completa do animal, fotografia principal (quando existir no
// cadastro — nunca uma imagem genérica), dados do tutor apenas quando houver
// tutor vinculado e o histórico cronológico dos registros do animal.
//
// A fotografia é lida do cadastro (data URL). Se não houver, o documento
// simplesmente não traz imagem — nada é inventado.
// A apresentação vem do template institucional (documentoCcz.js).
// ═══════════════════════════════════════════════════════════════════════════

import {
  criarDocumentoCcz,
  formatarData,
  formatarDataHora,
  nomeArquivo,
  texto,
} from "./documentoCcz";
import { obterLogoCcz } from "./logoCcz";

const FORMATO_IMAGEM = (dataUrl) => {
  const m = /^data:image\/(png|jpeg|jpg|webp)/i.exec(String(dataUrl || ""));
  if (!m) return null;
  const tipo = m[1].toLowerCase();
  return tipo === "jpg" ? "JPEG" : tipo.toUpperCase();
};

/** Desenha a fotografia do animal preservando a proporção (sem distorcer). */
function desenharFoto(doc, dataUrl, x, y, largura, altura) {
  const formato = FORMATO_IMAGEM(dataUrl);
  if (!formato) return false;

  let proporcao = 4 / 3;
  try {
    const img = doc.getImageProperties(dataUrl);
    if (img?.width && img?.height) proporcao = img.width / img.height;
  } catch {
    /* usa a proporção padrão 4:3 */
  }

  let larguraFinal = largura;
  let alturaFinal = largura / proporcao;
  if (alturaFinal > altura) {
    alturaFinal = altura;
    larguraFinal = altura * proporcao;
  }

  const xFinal = x + (largura - larguraFinal) / 2;
  const yFinal = y + (altura - alturaFinal) / 2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(x, y, largura, altura, "FD");
  try {
    doc.addImage(dataUrl, formato, xFinal, yFinal, larguraFinal, alturaFinal);
    return true;
  } catch {
    return false;
  }
}

/** Valor de um campo do detalhe do registro histórico. */
function valorDetalhe(registro, rotulo) {
  const item = (registro?.detalhes || []).find((d) => d?.rotulo === rotulo);
  const v = item?.valor;
  return v === null || v === undefined || String(v).trim() === "" ? "" : String(v);
}

export async function gerarHistoricoCompletoPdf(dados) {
  const { animal = {}, tutor = null, historico = [], procedimentos = [] } = dados || {};

  const base = criarDocumentoCcz({
    logo: await obterLogoCcz(),
    titulo: "FICHA COMPLETA DO ANIMAL",
    identificacao: `${animal.nome || "Sem nome"} · ID CCZ ${texto(animal.id)}`,
    nota: "Documento de identificação e histórico do animal atendido pelo Centro de Controle de Zoonoses, com os dados cadastrais e os registros de procedimentos, fiscalizações e denúncias vinculados.",
  });
  const doc = base.doc;

  // ── 1. IDENTIFICAÇÃO DO ANIMAL ─────────────────────────────────────────
  base.secao("1. Identificação do Animal");

  const temFoto = Boolean(animal.fotoUrl);
  if (temFoto) {
    const larguraFoto = 46;
    const alturaFoto = 34;
    const topoBloco = base.y;
    desenharFoto(doc, animal.fotoUrl, base.margemX, topoBloco, larguraFoto, alturaFoto);
    // Os campos ficam à direita da fotografia.
    const deslocamento = larguraFoto + 5;
    const yOriginal = base.y;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text("NOME DO ANIMAL", base.margemX + deslocamento, yOriginal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(texto(animal.nome || "Sem nome"), base.margemX + deslocamento, yOriginal + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text("ID CCZ", base.margemX + deslocamento, yOriginal + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(texto(animal.id), base.margemX + deslocamento, yOriginal + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text("SITUAÇÃO", base.margemX + deslocamento + 62, yOriginal + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(texto(animal.situacao || "Não informada"), base.margemX + deslocamento + 62, yOriginal + 16);

    base.y = topoBloco + alturaFoto + 4;
  }

  base.linha("NOME DO ANIMAL", animal.nome || "Sem nome", "ID CCZ", animal.id);
  base.linha("ESPÉCIE", animal.especie, "SEXO", animal.sexo);
  base.linha("PORTE", animal.porte, "IDADE ESTIMADA", animal.idade);
  base.linha("RAÇA / PELAGEM", animal.racaPelagem, "POSSUI IDENTIFICAÇÃO (COLEIRA OU CHIP)", animal.possuiIdentificacao);
  base.linha("SITUAÇÃO CADASTRAL DO ANIMAL", animal.situacao || "Não informada", "DATA DO CADASTRO", formatarData(animal.dataCadastro));
  base.linha("CASTRADO", animal.castrado, "POSSUI RESPONSÁVEL", animal.possuiResponsavel);

  // ── 2. CONDIÇÕES DE SAÚDE ──────────────────────────────────────────────
  base.secao("2. Condições de Saúde");
  base.linha("DOENÇA CRÔNICA", animal.doencaCronica, "QUAL DOENÇA", animal.qualDoenca);
  base.linha("EM TRATAMENTO", animal.emTratamento, "QUAL TRATAMENTO", animal.qualTratamento);
  base.linha("APETITE NORMAL", animal.apetiteNormal, "VÔMITO / DIARREIA", animal.sintomasVomitoDiarreia);
  if (animal.observacoes) base.paragrafo("OBSERVAÇÕES", animal.observacoes);

  // ── 3. TUTOR (só quando houver) ────────────────────────────────────────
  if (tutor && tutor.nome) {
    base.secao("3. Tutor Responsável");
    base.linha("NOME COMPLETO", tutor.nome, "CPF", tutor.cpf);
    base.linha("TELEFONE / WHATSAPP", tutor.telefone, "CNS", tutor.cns);
    if (tutor.endereco) base.paragrafo("ENDEREÇO COMPLETO", tutor.endereco);
  }

  // ── 4. HISTÓRICO — UMA TABELA POR TIPO DE REGISTRO ─────────────────────
  const registros = Array.isArray(historico) && historico.length
    ? historico
    : (procedimentos || []).map((p, i) => ({
        chave: `PROCEDIMENTO:${p.id || i}`,
        data: p.dataProcedimento,
        tipo: "PROCEDIMENTO",
        titulo: p.tipo || "Procedimento",
        subtitulo: p.status || "",
        resumo: p.descricao || "",
      }));

  const porData = (a, b) => String(b.data || "").localeCompare(String(a.data || ""));
  const grupo = (origem) =>
    registros.filter((r) => r.origem === origem).sort(porData);

  const TIPOS = [
    {
      origem: "ESPORO_VISITA",
      titulo: "4.1 Visitas de Acompanhamento",
      vazio: "Nenhuma visita de acompanhamento registrada.",
      colunas: [
        { titulo: "Data", largura: 1.1, chave: "data" },
        { titulo: "Fiscalização", largura: 1.5, chave: "registro" },
        { titulo: "Responsável", largura: 2, chave: "responsavel" },
        { titulo: "Observação / Resumo", largura: 3.6, chave: "resumo" },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        registro: r.subtitulo || "—",
        responsavel:
          valorDetalhe(r, "Profissional responsável") ||
          valorDetalhe(r, "Fiscal responsável") ||
          "—",
        resumo:
          valorDetalhe(r, "Observações gerais") ||
          valorDetalhe(r, "Observação") ||
          r.resumo ||
          "—",
      }),
    },
    {
      origem: "PROCEDIMENTO",
      titulo: "4.2 Procedimentos",
      vazio: "Nenhum procedimento registrado.",
      colunas: [
        { titulo: "Data", largura: 1.1, chave: "data" },
        { titulo: "Tipo de Procedimento", largura: 2, chave: "tipo" },
        { titulo: "Situação", largura: 1.2, chave: "situacao" },
        { titulo: "Responsável", largura: 2.2, chave: "responsavel" },
        { titulo: "Descrição / Medicação", largura: 3, chave: "descricao" },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        tipo: r.titulo || "—",
        situacao: r.subtitulo || "—",
        responsavel: valorDetalhe(r, "Veterinário responsável"),
        descricao: [
          valorDetalhe(r, "Descrição"),
          valorDetalhe(r, "Medicação prescrita"),
        ]
          .filter((v) => v && v !== "—")
          .join(" · "),
      }),
    },
    {
      origem: "ESPOROTRICOSE",
      titulo: "4.3 Esporotricose",
      vazio: "Nenhum registro de esporotricose.",
      colunas: [
        { titulo: "Data", largura: 1.1, chave: "data" },
        { titulo: "Conclusão", largura: 1.3, chave: "conclusao" },
        { titulo: "Fiscal Responsável", largura: 1.9, chave: "responsavel" },
        { titulo: "Lesões / Tratamento", largura: 2.4, chave: "clinico" },
        { titulo: "Conclusão Técnica", largura: 3, chave: "tecnica" },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        conclusao: r.subtitulo || "—",
        responsavel: valorDetalhe(r, "Fiscal responsável"),
        clinico: [
          valorDetalhe(r, "Apresenta lesões"),
          valorDetalhe(r, "Em tratamento veterinário"),
        ]
          .filter((v) => v && v !== "—")
          .join(" · "),
        tecnica: valorDetalhe(r, "Conclusão técnica") || r.resumo || "",
      }),
    },
    {
      origem: "LEISHMANIOSE",
      titulo: "4.4 Leishmaniose",
      vazio: "Nenhuma fiscalização de leishmaniose.",
      colunas: [
        { titulo: "Data", largura: 1.1, chave: "data" },
        { titulo: "Situação Geral", largura: 2, chave: "situacao" },
        { titulo: "Responsável", largura: 1.9, chave: "responsavel" },
        { titulo: "Lesões / Tratamento", largura: 2.4, chave: "clinico" },
        { titulo: "Conduta / Encaminhamentos", largura: 2.8, chave: "conduta" },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        situacao: valorDetalhe(r, "Situação geral") || r.subtitulo || "",
        responsavel: valorDetalhe(r, "Responsável") || valorDetalhe(r, "Responsável pela fiscalização"),
        clinico: [
          valorDetalhe(r, "Apresenta lesões"),
          valorDetalhe(r, "Em tratamento"),
        ]
          .filter((v) => v && v !== "—")
          .join(" · "),
        conduta: [
          valorDetalhe(r, "Conduta do tutor"),
          valorDetalhe(r, "Acompanhamento pelo CCZ"),
        ]
          .filter((v) => v && v !== "—")
          .join(" · "),
      }),
    },
    {
      origem: "DENUNCIA",
      titulo: "4.5 Denúncias e Demais Acompanhamentos",
      vazio: "Nenhuma denúncia ou acompanhamento vinculado.",
      colunas: [
        { titulo: "Data", largura: 1.1, chave: "data" },
        { titulo: "Situação", largura: 1.3, chave: "situacao" },
        { titulo: "Localização", largura: 2.2, chave: "local" },
        { titulo: "Causou Risco", largura: 1.2, chave: "risco" },
        { titulo: "Relato", largura: 3.2, chave: "relato" },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        situacao: r.subtitulo || "—",
        local: valorDetalhe(r, "Localização"),
        risco: valorDetalhe(r, "Causou risco"),
        relato: valorDetalhe(r, "Relato") || r.resumo || "",
      }),
    },
  ];

  let algumRegistro = false;
  TIPOS.forEach((tipo) => {
    const lista = grupo(tipo.origem);
    if (!lista.length) return;
    algumRegistro = true;
    base.secao(tipo.titulo);
    base.tabela(tipo.colunas, lista.map(tipo.montar));
  });

  if (!algumRegistro) {
    base.secao("4. Histórico de Registros");
    base.paragrafo("REGISTROS", "Nenhum registro vinculado a este animal.");
  }

  // ── EMISSÃO ────────────────────────────────────────────────────────────
  base.secao("5. Emissão");
  base.linha("DOCUMENTO GERADO EM", formatarDataHora(new Date()), "REGISTRO", animal.id);

  base.finalizar();
  return doc.save(nomeArquivo("ficha-animal", animal.nome || animal.id, animal.id));
}
