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

export async function gerarHistoricoCompletoPdf(dados) {
  const { animal = {}, tutor = null, historico = [], procedimentos = [] } = dados || {};

  const base = criarDocumentoCcz({
    logo: await obterLogoCcz(),
    titulo: "FICHA DO ANIMAL",
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

  // ── 4. HISTÓRICO CRONOLÓGICO ───────────────────────────────────────────
  const registros = Array.isArray(historico) && historico.length
    ? historico
    : (procedimentos || []).map((p, i) => ({
        chave: `PROCEDIMENTO:${p.id || i}`,
        data: p.dataProcedimento,
        tipo: "Procedimento",
        titulo: p.tipo || "Procedimento",
        subtitulo: p.status || "",
        resumo: p.descricao || "",
      }));

  base.secao("4. Histórico de Registros");

  if (!registros.length) {
    base.paragrafo("REGISTROS", "Nenhum registro vinculado a este animal.");
  } else {
    registros.forEach((r) => {
      base.linha(
        "DATA",
        formatarData(r.data),
        "TIPO DE REGISTRO",
        r.tipo || r.titulo || "Registro",
      );
      base.linha("DESCRIÇÃO", r.titulo || "—", "SITUAÇÃO", r.subtitulo);
      if (r.resumo) base.paragrafo("RESUMO", r.resumo);

      (r.detalhes || [])
        .filter((d) => d && String(d.valor || "").trim() !== "" && d.rotulo !== "Tipo" && d.rotulo !== "Status")
        .forEach((d) => {
          if (d.largo) base.paragrafo(d.rotulo, d.valor);
          else base.linha(d.rotulo, d.valor);
        });
    });
  }

  // ── EMISSÃO ────────────────────────────────────────────────────────────
  base.secao("5. Emissão");
  base.linha("DOCUMENTO GERADO EM", formatarDataHora(new Date()), "REGISTRO", animal.id);

  base.finalizar();
  return doc.save(nomeArquivo("ficha-animal", animal.nome || animal.id, animal.id));
}
