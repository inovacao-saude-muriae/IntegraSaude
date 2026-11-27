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

// A fotografia do animal NÃO é impressa neste documento: ela permanece
// apenas na ficha visualizada no sistema. O cadastro e o armazenamento da
// imagem não são alterados.

/**
 * Padrão do relatório clínico-administrativo da ficha:
 * títulos em azul escuro sem preenchimento, linha divisória fina e cinza,
 * dados em rótulo pequeno + valor em destaque (sem caixas) e tabelas com
 * cabeçalho cinza muito claro. Nenhuma barra azul de destaque.
 */
export function padraoRelatorio(base) {
  const { doc } = base;
  const AZUL_ESCURO = [15, 23, 42];
  const CINZA_ROTULO = [100, 116, 139];
  const CINZA_TEXTO = [30, 41, 59];
  const CINZA_LINHA = [226, 232, 240];
  const CINZA_CABECALHO = [241, 245, 249];
  const CINZA_ZEBRA = [250, 251, 252];
  // Respiro horizontal das células (pt). É o padding usado tanto para medir o
  // texto quanto para desenhá-lo — o cabeçalho nunca invade a coluna vizinha.
  const PAD = 4.2;
  // Respiro vertical das células e do cabeçalho.
  const PAD_V = 3.2;
  const ALTURA_CABECALHO = 4.2; // altura da linha de título
  const ALTURA_LINHA = 4.4;

  /** Título de seção — texto azul escuro, sem fundo, com divisória cinza. */
  const secao = (titulo) => {
    base.novaPagina(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...AZUL_ESCURO);
    doc.text(String(titulo).toUpperCase(), base.margemX, base.y);
    base.y += 2;
    doc.setDrawColor(...CINZA_LINHA);
    doc.setLineWidth(0.3);
    doc.line(base.margemX, base.y, base.margemX + base.largura, base.y);
    base.y += 6;
  };

  /** Subtítulo de grupo (tabelas) — menor, com a contagem ao lado. */
  const subtitulo = (titulo, contagem = "") => {
    base.novaPagina(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...AZUL_ESCURO);
    doc.text(String(titulo), base.margemX, base.y);
    if (contagem) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...CINZA_ROTULO);
      doc.text(String(contagem), base.margemX + base.largura, base.y, {
        align: "right",
      });
    }
    base.y += 4.5;
  };

  /** Grade de rótulo + valor, sem caixas, com divisórias discretas. */
  const campos = (lista, colunas = 3) => {
    const larguraColuna = base.largura / colunas;
    let coluna = 0;

    const medir = (valor, largura) =>
      doc.splitTextToSize(texto(valor), largura - 3);

    for (let i = 0; i < lista.length; i += colunas) {
      const linhaCampos = lista.slice(i, i + colunas);
      const alturas = linhaCampos.map(
        ([, valor]) => medir(valor, larguraColuna).length * 4,
      );
      const alturaLinha = Math.max(...alturas) + 8.5;
      base.novaPagina(alturaLinha + 2);
      const topo = base.y;

      linhaCampos.forEach(([rotulo, valor], idx) => {
        const x = base.margemX + idx * larguraColuna;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.4);
        doc.setTextColor(...CINZA_ROTULO);
        doc.text(String(rotulo).toUpperCase(), x, topo);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...CINZA_TEXTO);
        doc.text(medir(valor, larguraColuna), x, topo + 4.4);
      });

      base.y = topo + alturaLinha;
      doc.setDrawColor(...CINZA_LINHA);
      doc.setLineWidth(0.2);
      doc.line(
        base.margemX,
        base.y - 3.5,
        base.margemX + base.largura,
        base.y - 3.5,
      );
      coluna = 0;
    }
  };

  /** Tabela: cabeçalho cinza muito claro, texto azul escuro, linhas finas. */
  const tabela = (colunas, registros = []) => {
    if (!colunas?.length || !registros.length) return;
    // Cada coluna recebe uma largura MÍNIMA que caiba o maior título (em no
    // máximo 2 linhas) e o maior conteúdo curto (datas, situações), medida com
    // a fonte real do PDF. O que sobra da área útil é distribuído na proporção
    // declarada — nenhum título invade a coluna vizinha.
    const fonteDe = (tamanho, negrito) => {
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(tamanho);
    };
    // Títulos curtos (1–2 palavras, até 14 caracteres) são medidos em UMA linha:
    // quebrar "ACOMPANHAMENTO" no meio da palavra fica ilegível. Títulos longos
    // quebram em até 2 linhas.
    const medirTexto = (txt, tamanho, negrito) => {
      fonteDe(tamanho, negrito);
      return doc.getTextWidth(String(txt));
    };
    const umaLinha = (titulo) =>
      titulo.length <= 14 && titulo.split(" ").filter(Boolean).length <= 2;

    const minimos = colunas.map((col, i) => {
      const titulo = String(col.titulo).toUpperCase();
      // largura mínima do título: cabe em até 2 linhas
      const palavras = titulo.split(" ");
      const maiorPalavra = Math.max(
        ...palavras.map((p) => medirTexto(p, 6.8, true)),
      );
      const tituloUmaLinha = medirTexto(titulo, 6.8, true);
      // O título precisa caber INTEIRO em até 2 linhas (senão o jsPDF quebra
      // no meio da palavra): o mínimo é a largura que comporta 2 linhas.
      const tituloMin = umaLinha(titulo)
        ? Math.ceil(tituloUmaLinha) + 2
        : Math.max(
            maiorPalavra,
            Math.ceil(tituloUmaLinha / 2) + 2,
            Math.ceil(tituloUmaLinha * 0.56) + 2,
          );
      // largura mínima do conteúdo: maior valor CURTO (sem espaços) da coluna
      const maiorValor = registros.reduce((t, r) => {
        const v = r[col.chave];
        if (v === null || v === undefined || v === "") return t;
        const partes = String(v).split(/\s+/).filter(Boolean);
        return Math.max(t, ...partes.map((x) => medirTexto(x, 7.8, false)));
      }, 0);
      // limites: nunca menor que a palavra do título, nunca maior que 45% da área
      return Math.min(
        Math.max(tituloMin, Math.ceil(maiorValor)) + PAD * 2 + 2,
        base.largura * 0.45,
      );
    });

    const somaMin = minimos.reduce((t, v) => t + v, 0);
    const sobra = Math.max(0, base.largura - somaMin);
    const totalPeso = colunas.reduce((t, c) => t + (c.largura || 1), 0);
    const larguras = colunas.map(
      (c, i) => minimos[i] + (sobra * (c.largura || 1)) / totalPeso,
    );
    const xs = larguras.map(
      (_, i) => base.margemX + larguras.slice(0, i).reduce((t, v) => t + v, 0),
    );

    const medirLinha = (registro) => {
      const celulas = colunas.map((col, i) => {
        const v = registro[col.chave];
        const txt = v === null || v === undefined || v === "" ? "—" : String(v);
        return doc.splitTextToSize(txt, larguras[i] - PAD * 2);
      });
      return {
        celulas,
        altura:
          Math.max(...celulas.map((c) => c.length)) * ALTURA_LINHA + PAD_V,
      };
    };

    // Títulos podem quebrar em duas (ou mais) linhas dentro da PRÓPRIA coluna:
    // a altura do cabeçalho acompanha a maior quantidade de linhas.
    const linhasCabecalho = colunas.map((col) =>
      doc.splitTextToSize(
        String(col.titulo).toUpperCase(),
        larguras[colunas.indexOf(col)] - PAD * 2,
      ),
    );
    const maxLinhasCabecalho = Math.max(
      1,
      ...linhasCabecalho.map((l) => l.length),
    );

    const cabecalho = () => {
      const altura = maxLinhasCabecalho * ALTURA_CABECALHO + PAD_V;
      doc.setFillColor(...CINZA_CABECALHO);
      doc.rect(base.margemX, base.y, base.largura, altura, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...AZUL_ESCURO);
      colunas.forEach((col, i) => {
        const direita = col.alinhamento === "right";
        const x = direita ? xs[i] + larguras[i] - PAD : xs[i] + PAD;
        doc.text(linhasCabecalho[i], x, base.y + ALTURA_CABECALHO, {
          align: direita ? "right" : "left",
        });
      });
      base.y += altura;
      doc.setDrawColor(...CINZA_LINHA);
      doc.setLineWidth(0.2);
      doc.line(base.margemX, base.y, base.margemX + base.largura, base.y);
    };

    if (base.y + 14 > base.limiteY()) {
      doc.addPage();
      base.y = base.margemX + 2;
    }
    cabecalho();

    registros.forEach((registro, indice) => {
      const { celulas, altura } = medirLinha(registro);
      if (base.y + altura > base.limiteY()) {
        doc.addPage();
        base.y = base.margemX + 2;
        cabecalho();
      }

      if (indice % 2 === 1) {
        doc.setFillColor(...CINZA_ZEBRA);
        doc.rect(base.margemX, base.y, base.largura, altura, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...CINZA_TEXTO);
      celulas.forEach((linhas, i) => {
        const direita = colunas[i].alinhamento === "right";
        const x = direita ? xs[i] + larguras[i] - PAD : xs[i] + PAD;
        doc.text(linhas, x, base.y + ALTURA_LINHA, {
          align: direita ? "right" : "left",
        });
      });

      base.y += altura;
      doc.setDrawColor(...CINZA_LINHA);
      doc.setLineWidth(0.2);
      doc.line(base.margemX, base.y, base.margemX + base.largura, base.y);
    });

    base.y += 7;
  };

  /** Texto corrido sem caixa: rótulo pequeno e o conteúdo abaixo. */
  const paragrafo = (rotulo, valorTexto) => {
    const linhas = doc.splitTextToSize(texto(valorTexto), base.largura);
    const altura = linhas.length * 4 + (rotulo ? 6 : 0);
    base.novaPagina(altura + 4);
    if (rotulo) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(...CINZA_ROTULO);
      doc.text(String(rotulo).toUpperCase(), base.margemX, base.y);
      base.y += 4.4;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...CINZA_TEXTO);
    doc.text(linhas, base.margemX, base.y);
    base.y += altura + 4;
  };

  return { secao, subtitulo, campos, tabela, paragrafo };
}

/** Valor de um campo do detalhe do registro histórico. */
function valorDetalhe(registro, rotulo) {
  const item = (registro?.detalhes || []).find((d) => d?.rotulo === rotulo);
  const v = item?.valor;
  return v === null || v === undefined || String(v).trim() === ""
    ? ""
    : String(v);
}

export async function gerarHistoricoCompletoPdf(dados) {
  const {
    animal = {},
    tutor = null,
    historico = [],
    procedimentos = [],
  } = dados || {};

  const base = criarDocumentoCcz({
    logo: await obterLogoCcz(),
    titulo: "FICHA COMPLETA DO ANIMAL",
    identificacao: `${animal.nome || "Sem nome"} · ID CCZ ${texto(animal.id)}`,
    nota: "Documento de identificação e histórico do animal atendido pelo Centro de Controle de Zoonoses, com os dados cadastrais e os registros de acompanhamento, procedimentos, fiscalizações e denúncias vinculados.",
  });
  const doc = base.doc;
  const { secao, subtitulo, campos, tabela, paragrafo } = padraoRelatorio(base);

  // ── IDENTIFICAÇÃO DO ANIMAL ────────────────────────────────────────────
  secao("Identificação do Animal");
  campos(
    [
      ["Nome do animal", animal.nome || "Sem nome"],
      ["ID CCZ", animal.id],
      ["Espécie", animal.especie],
      ["Sexo", animal.sexo],
      ["Porte", animal.porte],
      ["Idade estimada", animal.idade],
      ["Raça / pelagem", animal.racaPelagem],
      ["Possui identificação", animal.possuiIdentificacao],
      ["Castrado", animal.castrado],
      ["Situação cadastral", animal.situacao || "Não informada"],
      ["Possui responsável", animal.possuiResponsavel],
      ["Data do cadastro", formatarData(animal.dataCadastro)],
    ],
    3,
  );

  // ── CONDIÇÕES DE SAÚDE ─────────────────────────────────────────────────
  secao("Condições de Saúde");
  campos(
    [
      ["Doença crônica", animal.doencaCronica],
      ["Qual doença", animal.qualDoenca],
      ["Em tratamento", animal.emTratamento],
      ["Qual tratamento", animal.qualTratamento],
      ["Apetite normal", animal.apetiteNormal],
      ["Vômito / diarreia", animal.sintomasVomitoDiarreia],
    ],
    3,
  );
  if (animal.observacoes) paragrafo("Observações", animal.observacoes);

  // ── TUTOR (só quando houver) ───────────────────────────────────────────
  if (tutor && tutor.nome) {
    secao("Tutor Responsável");
    campos(
      [
        ["Nome completo", tutor.nome],
        ["CPF", tutor.cpf],
        ["Telefone / WhatsApp", tutor.telefone],
        ["CNS", tutor.cns],
      ],
      2,
    );
    if (tutor.endereco) paragrafo("Endereço completo", tutor.endereco);
  }

  // ── 4. HISTÓRICO — UMA TABELA POR TIPO DE REGISTRO ─────────────────────
  const registros =
    Array.isArray(historico) && historico.length
      ? historico
      : (procedimentos || []).map((p, i) => ({
          chave: `PROCEDIMENTO:${p.id || i}`,
          data: p.dataProcedimento,
          tipo: "PROCEDIMENTO",
          titulo: p.tipo || "Procedimento",
          subtitulo: p.status || "",
          resumo: p.descricao || "",
        }));

  const porData = (a, b) =>
    String(b.data || "").localeCompare(String(b.data || ""));
  // Cada origem reúne o registro inicial E os retornos que dela nasceram: a
  // visita de acompanhamento da esporotricose entra na tabela de esporotricose
  // (nunca em tabela própria). Visita sem origem confiável fica de fora.
  const grupo = (origens) => {
    const lista = Array.isArray(origens) ? origens : [origens];
    return registros.filter((r) => lista.includes(r.origem)).sort(porData);
  };
  // Tipo de atendimento: registro inicial x retorno.
  const tipoAtendimento = (r) => {
    if (r.origem === "ESPORO_VISITA" || r.origem === "LEISHMANIOSE_RETORNO")
      return "Retorno";
    if (r.origem === "ESPOROTRICOSE" || r.origem === "LEISHMANIOSE")
      return "Fiscalização";
    if (r.origem === "PROCEDIMENTO") return "Procedimento";
    return "—";
  };

  const TIPOS = [
    {
      origem: "PROCEDIMENTO",
      titulo: "Procedimentos",
      vazio: "Nenhum procedimento registrado.",
      colunas: [
        { titulo: "Data", largura: 0.7, chave: "data" },
        { titulo: "Tipo de Atendimento", largura: 1.45, chave: "atendimento" },
        { titulo: "Tipo de Procedimento", largura: 1.3, chave: "tipo" },
        { titulo: "Situação", largura: 1.0, chave: "situacao" },
        { titulo: "Responsável", largura: 1.3, chave: "responsavel" },
        { titulo: "Descrição / Medicação", largura: 2.0, chave: "descricao" },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        atendimento: tipoAtendimento(r),
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
      origem: ["ESPOROTRICOSE", "ESPORO_VISITA"],
      titulo: "Esporotricose",
      vazio: "Nenhum registro de esporotricose.",
      // O responsável não aparece na tabela (fica na ficha detalhada e no
      // registro original); a largura liberada vai para a conclusão.
      colunas: [
        // Data compacta; Tipo de Atendimento com largura suficiente para o
        // título em uma linha (não invade a coluna vizinha); o restante vai
        // para a conclusão técnica.
        { titulo: "Data", largura: 0.7, chave: "data" },
        { titulo: "Tipo de Atendimento", largura: 1.5, chave: "atendimento" },
        { titulo: "Acompanhamento", largura: 1.4, chave: "situacao" },
        {
          titulo: "Conclusão Técnica da Visita",
          largura: 4.9,
          chave: "tecnica",
        },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        atendimento: tipoAtendimento(r),
        // Situação do acompanhamento + desfecho final (distintos da
        // conclusão clínica registrada na fiscalização).
        situacao: [
          valorDetalhe(r, "Situação do caso") ||
            (r.encerrado ? "Encerrado" : "Em andamento"),
          valorDetalhe(r, "Desfecho do caso"),
        ]
          .filter((v) => v && v !== "—")
          .join(" · "),
        // Na visita, a conclusão é a observação do acompanhamento; na
        // fiscalização, a conclusão técnica registrada.
        tecnica:
          valorDetalhe(r, "Conclusão técnica") ||
          valorDetalhe(r, "Observações gerais") ||
          r.resumo ||
          "—",
      }),
    },
    {
      origem: ["LEISHMANIOSE", "LEISHMANIOSE_RETORNO"],
      titulo: "Leishmaniose",
      vazio: "Nenhuma fiscalização de leishmaniose.",
      // O Responsável foi removido da tabela (permanece na ficha detalhada e
      // no registro original). A largura liberada é redistribuída entre a
      // situação do caso e a conduta, para não sobrar espaço vazio.
      colunas: [
        { titulo: "Data", largura: 0.7, chave: "data" },
        { titulo: "Tipo de Atendimento", largura: 1.5, chave: "atendimento" },
        { titulo: "Situação do Caso", largura: 1.4, chave: "situacao" },
        { titulo: "Conduta / Encaminhamentos", largura: 4.2, chave: "conduta" },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        atendimento: tipoAtendimento(r),
        // Situação do acompanhamento (Em acompanhamento / Encerrado) com o
        // desfecho final; a situação geral da visita continua na coluna de
        // conduta, sem se confundir com o encerramento do caso.
        situacao: [
          valorDetalhe(r, "Situação do caso") || "Em acompanhamento",
          valorDetalhe(r, "Desfecho do caso"),
        ]
          .filter((v) => v && v !== "—")
          .join(" · "),
        conduta: [
          valorDetalhe(r, "Conduta do tutor"),
          valorDetalhe(r, "Situação geral") &&
            `Situação geral: ${valorDetalhe(r, "Situação geral")}`,
          valorDetalhe(r, "Acompanhamento pelo CCZ"),
        ]
          .filter((v) => v && v !== "—")
          .join(" · "),
      }),
    },
    {
      origem: "DENUNCIA",
      titulo: "Denúncias e Outros Acompanhamentos",
      vazio: "Nenhuma denúncia ou acompanhamento vinculado.",
      colunas: [
        { titulo: "Data", largura: 0.7, chave: "data" },
        { titulo: "Tipo de Atendimento", largura: 1.45, chave: "atendimento" },
        { titulo: "Situação", largura: 1.0, chave: "situacao" },
        { titulo: "Localização", largura: 1.5, chave: "local" },
        { titulo: "Causou Risco", largura: 1.0, chave: "risco" },
        { titulo: "Relato", largura: 2.6, chave: "relato" },
      ],
      montar: (r) => ({
        data: formatarData(r.data),
        atendimento: tipoAtendimento(r),
        situacao: r.subtitulo || "—",
        local: valorDetalhe(r, "Localização"),
        risco: valorDetalhe(r, "Causou risco"),
        relato: valorDetalhe(r, "Relato") || r.resumo || "",
      }),
    },
  ];

  const grupos = TIPOS.map((tipo) => ({
    tipo,
    lista: grupo(tipo.origem),
  })).filter((g) => g.lista.length);

  secao("Histórico de Acompanhamentos");
  if (!grupos.length) {
    paragrafo("Registros", "Nenhum registro vinculado a este animal.");
  } else {
    grupos.forEach(({ tipo, lista }) => {
      subtitulo(
        tipo.titulo,
        `${lista.length} ${lista.length === 1 ? "registro" : "registros"}`,
      );
      tabela(tipo.colunas, lista.map(tipo.montar));
    });
  }

  // ── EMISSÃO ────────────────────────────────────────────────────────────
  secao("Emissão");
  campos(
    [
      ["Documento gerado em", formatarDataHora(new Date())],
      ["Registro", animal.id],
    ],
    2,
  );

  base.finalizar();
  return doc.save(
    nomeArquivo("ficha-animal", animal.nome || animal.id, animal.id),
  );
}
