// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE INSTITUCIONAL DOS DOCUMENTOS DO CCZ
//
// Fonte ÚNICA do cabeçalho, tipografia, margens, blocos, rodapé e paginação
// dos PDFs do Centro de Controle de Zoonoses: Ficha do Animal, Ficha de
// Procedimento, Ficha de Esporotricose e Ficha de Leishmaniose.
//
// Cada ficha monta apenas o SEU conteúdo; a apresentação fica aqui.
// jsPDF trabalha em milímetros, formato A4 retrato.
// ═══════════════════════════════════════════════════════════════════════════

import jsPDF from "jspdf";

export const MARGEM_X = 15;
export const LARGURA_UTIL = 180;

// Azul institucional e cinzas — sem excesso de cor.
const AZUL = [15, 23, 42];
const AZUL_MEDIO = [30, 58, 95];
const CINZA_ROTULO = [100, 116, 139];
const CINZA_TEXTO = [30, 41, 59];
const CINZA_LINHA = [226, 232, 240];
const CINZA_FUNDO = [248, 250, 252];
const CINZA_RODAPE = [148, 163, 184];

// Espessura da linha divisória do cabeçalho institucional: 1px = 0.25 mm.
// Ponto único de ajuste — vale para todos os documentos que usam o template.
export const ESPESSURA_LINHA_CABECALHO = 0.25;

export const formatarData = (valor) => {
  if (!valor) return "—";
  const s = String(valor).slice(0, 10);
  const partes = s.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : s;
};

export const formatarDataHora = (valor) => {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return formatarData(valor);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Data de emissão do documento (hoje), no fuso local.
export const hoje = () => {
  const d = new Date();
  return d.toLocaleDateString("pt-BR");
};

export const texto = (v) => {
  if (v === null || v === undefined) return "—";
  const t = String(v).trim();
  return t === "" ? "—" : t;
};

// Nome de arquivo seguro, sem acentos nem espaços.
export const nomeArquivo = (prefixo, ...partes) => {
  const resto = partes
    .filter(Boolean)
    .map((p) =>
      String(p)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .toLowerCase(),
    )
    .filter(Boolean)
    .join("-");
  return `${prefixo}${resto ? `-${resto}` : ""}.pdf`;
};

/**
 * Cria o documento já com o cabeçalho institucional.
 *
 * @param {object} opcoes
 * @param {string} opcoes.titulo    Título do documento (ex.: "FICHA DE PROCEDIMENTO")
 * @param {string} [opcoes.subtitulo] Linha secundária do título
 * @param {string} [opcoes.identificacao] Linha de identificação do registro
 * @param {string} [opcoes.nota]    Texto corrido de finalidade (opcional)
 * @param {string} [opcoes.rodape]  Texto do rodapé (padrão: documentos do CCZ)
 * @param {string} [opcoes.logo]    Data URL otimizada da logomarca (obterLogoCcz)
 */
export function criarDocumentoCcz({
  titulo,
  subtitulo = "",
  identificacao = "",
  nota = "",
  logo = null,
  rodape = "Centro de Controle de Zoonoses · Secretaria Municipal de Saúde · Prefeitura Municipal de Muriaé/MG",
} = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const paginaAltura = doc.internal.pageSize.getHeight();
  const paginaLargura = doc.internal.pageSize.getWidth();
  const centro = paginaLargura / 2;
  let y = MARGEM_X;

  // ── CABEÇALHO: logomarca + identificação institucional ──────────────────
  const logoLargura = 20;
  const logoAltura = 20;
  const blocoTextoX = MARGEM_X + logoLargura + 6;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGEM_X, y, logoLargura, logoAltura);
    } catch {
      /* sem a imagem o documento continua válido */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.text("PREFEITURA MUNICIPAL DE MURIAÉ", blocoTextoX, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE", blocoTextoX, y + 11.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("CENTRO DE CONTROLE DE ZOONOSES", blocoTextoX, y + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...CINZA_ROTULO);
  doc.text("CEP 36880-000 — Muriaé/MG", blocoTextoX, y + 21);

  y += logoAltura + 3;
  // Linha divisória do cabeçalho: 1px (0.25 mm) em azul institucional.
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(ESPESSURA_LINHA_CABECALHO);
  doc.line(MARGEM_X, y, MARGEM_X + LARGURA_UTIL, y);
  doc.setDrawColor(...CINZA_LINHA);
  doc.setLineWidth(0.2);
  doc.line(MARGEM_X, y + 1.2, MARGEM_X + LARGURA_UTIL, y + 1.2);
  y += 8;

  // ── TÍTULO ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...AZUL);
  doc.text(titulo, centro, y, { align: "center" });
  y += 5.5;

  if (subtitulo) {
    doc.setFontSize(10.5);
    doc.text(subtitulo, centro, y, { align: "center" });
    y += 5.5;
  }

  if (identificacao) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA_ROTULO);
    doc.text(identificacao, centro, y, { align: "center" });
    y += 5;
  }

  // ── NOTA DE FINALIDADE ──────────────────────────────────────────────────
  if (nota) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const linhas = doc.splitTextToSize(nota, LARGURA_UTIL - 6);
    const altura = linhas.length * 3.4 + 4;
    doc.setFillColor(...CINZA_FUNDO);
    doc.setDrawColor(...CINZA_LINHA);
    doc.rect(MARGEM_X, y - 2, LARGURA_UTIL, altura, "FD");
    doc.text(linhas, MARGEM_X + 3, y + 1.5);
    y += altura + 5;
  }

  // ── ESTADO DO DOCUMENTO ─────────────────────────────────────────────────
  const api = {
    doc,
    get y() {
      return y;
    },
    set y(novo) {
      y = novo;
    },
    margemX: MARGEM_X,
    largura: LARGURA_UTIL,
    centro,
    paginaAltura,
    rodapeTexto: rodape,
  };

  // Reserva o espaço do rodapé em cada página.
  api.limiteY = () => paginaAltura - 20;

  api.novaPagina = (altura = 12) => {
    if (y + altura > api.limiteY()) {
      doc.addPage();
      y = MARGEM_X + 2;
      return true;
    }
    return false;
  };

  /** Título de seção — faixa azul institucional. */
  api.secao = (tituloSecao) => {
    api.novaPagina(14);
    doc.setFillColor(...AZUL_MEDIO);
    doc.rect(MARGEM_X, y, LARGURA_UTIL, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(String(tituloSecao).toUpperCase(), MARGEM_X + 3, y + 4.6);
    y += 9.5;
  };

  /** Linha rótulo/valor em uma ou duas colunas, com divisória discreta. */
  api.linha = (rotulo1, valor1, rotulo2 = "", valor2 = "") => {
    const duasColunas = Boolean(rotulo2);
    const larguraCol = duasColunas ? 86 : LARGURA_UTIL;
    const x2 = MARGEM_X + 92;

    const preparar = (rotulo, valor, x) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...CINZA_ROTULO);
      const rotuloLinhas = doc.splitTextToSize(String(rotulo || "").toUpperCase(), larguraCol);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...CINZA_TEXTO);
      const valorLinhas = doc.splitTextToSize(texto(valor), larguraCol);
      return { rotuloLinhas, valorLinhas, x };
    };

    const col1 = preparar(rotulo1, valor1, MARGEM_X);
    const col2 = duasColunas ? preparar(rotulo2, valor2, x2) : null;

    const alturaRotulo = Math.max(col1.rotuloLinhas.length, col2?.rotuloLinhas.length || 1) * 3;
    const alturaValor = Math.max(col1.valorLinhas.length, col2?.valorLinhas.length || 1) * 3.9;
    const alturaBloco = alturaRotulo + alturaValor + 3.5;

    api.novaPagina(alturaBloco + 2);

    const desenhar = (col) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...CINZA_ROTULO);
      doc.text(col.rotuloLinhas, col.x, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...CINZA_TEXTO);
      doc.text(col.valorLinhas, col.x, y + alturaRotulo + 3);
    };

    desenhar(col1);
    if (col2) desenhar(col2);

    doc.setDrawColor(...CINZA_LINHA);
    doc.setLineWidth(0.2);
    doc.line(MARGEM_X, y + alturaBloco, MARGEM_X + LARGURA_UTIL, y + alturaBloco);
    y += alturaBloco + 3;
  };

  /** Bloco de texto corrido (observações, relatos, descrições). */
  api.paragrafo = (rotulo, valorTexto, alturaMinima = 0) => {
    const conteudo = doc.splitTextToSize(texto(valorTexto), LARGURA_UTIL - 6);
    const alturaTexto = conteudo.length * 4;
    const altura = Math.max(alturaMinima, alturaTexto + 8);

    api.novaPagina(altura + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...CINZA_ROTULO);
    doc.text(String(rotulo || "").toUpperCase(), MARGEM_X, y);

    doc.setFillColor(...CINZA_FUNDO);
    doc.setDrawColor(...CINZA_LINHA);
    doc.rect(MARGEM_X, y + 2.5, LARGURA_UTIL, altura - 2.5, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA_TEXTO);
    doc.text(conteudo, MARGEM_X + 3, y + 7);
    y += altura + 3;
  };

  /** Grade de campos (2 ou 3 colunas) — rótulo em cima, valor em caixa. */
  api.grade = (campos, colunas = 3) => {
    const larguraColuna = LARGURA_UTIL / colunas;
    let coluna = 0;

    campos.forEach(({ label, valor: v }) => {
      if (coluna === 0) api.novaPagina(14);
      const x = MARGEM_X + coluna * larguraColuna;
      const largura = larguraColuna - 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...CINZA_ROTULO);
      doc.text(String(label || "").toUpperCase(), x, y);

      doc.setFillColor(...CINZA_FUNDO);
      doc.setDrawColor(...CINZA_LINHA);
      doc.roundedRect(x, y + 2, largura, 6.5, 1, 1, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...CINZA_TEXTO);
      const linhas = doc.splitTextToSize(texto(v), largura - 3);
      doc.text(linhas[0], x + 1.5, y + 6.2);

      coluna += 1;
      if (coluna === colunas) {
        coluna = 0;
        y += 11.5;
      }
    });

    if (coluna !== 0) y += 11.5;
  };

  /** Linha de assinatura com nome e função. */
  /**
   * Bloco de assinaturas LADO A LADO: cada linha tem meia largura útil, com
   * nome em destaque acima da linha e a função em cinza abaixo. Aceita de 1 a
   * 2 assinaturas; as que não couberem abrem uma nova linha abaixo.
   *
   * @param {Array<{nome, funcao, registro}>} itens
   */
  api.assinaturas = (itens = []) => {
    const lista = itens.filter(Boolean);
    if (!lista.length) return;

    const LARGURA_ASSINATURA = (LARGURA_UTIL - 20) / 2;
    const ALTURA_BLOCO = 22;
    const xColunas = [MARGEM_X, MARGEM_X + LARGURA_ASSINATURA + 20];

    for (let i = 0; i < lista.length; i += 2) {
      api.novaPagina(ALTURA_BLOCO + 4);
      const topo = y;
      lista.slice(i, i + 2).forEach((item, coluna) => {
        const x = xColunas[coluna];
        const centroAssinatura = x + LARGURA_ASSINATURA / 2;

        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.3);
        doc.line(x, topo + 8, x + LARGURA_ASSINATURA, topo + 8);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...AZUL);
        doc.text(texto(item.nome), centroAssinatura, topo + 12.5, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...CINZA_ROTULO);
        const descricao = `${item.funcao || ""}${item.registro ? ` — ${item.registro}` : ""}`;
        doc.text(
          doc.splitTextToSize(descricao, LARGURA_ASSINATURA - 2),
          centroAssinatura,
          topo + 16.5,
          { align: "center" },
        );
      });
      y = topo + ALTURA_BLOCO;
    }
  };

  /** Assinatura isolada (largura total) — mantida para os demais documentos. */
  api.assinatura = (nome, funcao, registroProf = "") => {
    api.novaPagina(26);
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(MARGEM_X + 20, y + 10, MARGEM_X + 110, y + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...AZUL);
    doc.text(texto(nome), MARGEM_X + 65, y + 14.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA_ROTULO);
    doc.text(`${funcao}${registroProf ? ` — ${registroProf}` : ""}`, MARGEM_X + 65, y + 18.5, {
      align: "center",
    });
    y += 24;
  };

  /**
   * Tabela de registros históricos.
   * Cabeçalho azul institucional repetido a cada nova página, bordas discretas,
   * larguras proporcionais, quebra automática das células e nenhuma linha
   * cortada entre páginas.
   *
   * @param {Array<{titulo:string, largura:number, chave:string, alinhamento?:string}>} colunas
   * @param {Array<object>} registros
   */
  api.tabela = (colunas, registros = []) => {
    if (!colunas?.length) return;
    const totalLargura = colunas.reduce((t, c) => t + (c.largura || 1), 0);
    const larguras = colunas.map((c) => ((c.largura || 1) / totalLargura) * LARGURA_UTIL);
    const xs = larguras.map((_, i) => MARGEM_X + larguras.slice(0, i).reduce((t, v) => t + v, 0));

    const PAD = 2;
    const ALTURA_LINHA = 4.2;

    const medirLinha = (registro) => {
      const celulas = colunas.map((col, i) => {
        const valor = registro[col.chave];
        const txt = valor === null || valor === undefined || valor === "" ? "—" : String(valor);
        return doc.splitTextToSize(txt, larguras[i] - PAD * 2);
      });
      const linhas = Math.max(...celulas.map((c) => c.length));
      return { celulas, altura: linhas * ALTURA_LINHA + PAD * 1.4 };
    };

    const desenharCabecalho = () => {
      doc.setFillColor(...AZUL_MEDIO);
      doc.rect(MARGEM_X, y, LARGURA_UTIL, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      colunas.forEach((col, i) => {
        const alinhamento = col.alinhamento === "right" ? "right" : "left";
        const x = alinhamento === "right" ? xs[i] + larguras[i] - PAD : xs[i] + PAD;
        doc.text(String(col.titulo).toUpperCase(), x, y + 3.9, { align: alinhamento });
      });
      y += 6;
    };

    if (y + 12 > api.limiteY()) {
      doc.addPage();
      y = MARGEM_X + 2;
    }
    desenharCabecalho();

    registros.forEach((registro, indice) => {
      const { celulas, altura } = medirLinha(registro);

      // A linha nunca é cortada: se não couber, o cabeçalho se repete na nova página.
      if (y + altura > api.limiteY()) {
        doc.addPage();
        y = MARGEM_X + 2;
        desenharCabecalho();
      }

      if (indice % 2 === 1) {
        doc.setFillColor(...CINZA_FUNDO);
        doc.rect(MARGEM_X, y, LARGURA_UTIL, altura, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.6);
      doc.setTextColor(...CINZA_TEXTO);
      celulas.forEach((linhas, i) => {
        const alinhamento = colunas[i].alinhamento === "right" ? "right" : "left";
        const x = alinhamento === "right" ? xs[i] + larguras[i] - PAD : xs[i] + PAD;
        doc.text(linhas, x, y + ALTURA_LINHA, { align: alinhamento });
      });

      doc.setDrawColor(...CINZA_LINHA);
      doc.setLineWidth(0.2);
      doc.line(MARGEM_X, y + altura, MARGEM_X + LARGURA_UTIL, y + altura);
      y += altura;
    });

    y += 5;
  };

  /** Rodapé institucional + paginação + data de emissão em todas as páginas. */
  api.finalizar = () => {
    const emissao = hoje();
    const total = doc.internal.getNumberOfPages();
    const rodapeY = paginaAltura - 12;

    for (let p = 1; p <= total; p += 1) {
      doc.setPage(p);
      doc.setDrawColor(...CINZA_LINHA);
      doc.setLineWidth(0.2);
      doc.line(MARGEM_X, rodapeY - 4, MARGEM_X + LARGURA_UTIL, rodapeY - 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...CINZA_RODAPE);
      doc.text(`Emitido em ${emissao}`, MARGEM_X, rodapeY);
      doc.text(`Página ${p} de ${total}`, MARGEM_X + LARGURA_UTIL, rodapeY, {
        align: "right",
      });

      doc.setFontSize(6);
      const rodapeLinhas = doc.splitTextToSize(rodape, LARGURA_UTIL - 44);
      doc.text(rodapeLinhas[0], MARGEM_X + LARGURA_UTIL / 2, rodapeY, { align: "center" });
    }
  };

  return api;
}

/** Abre o PDF em nova aba (visualizar/imprimir) e mantém o download. */
export function salvarPdf(doc, arquivo) {
  doc.save(arquivo);
  return doc;
}
