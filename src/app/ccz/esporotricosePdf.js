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

import {
  criarDocumentoCcz,
  formatarData,
  formatarDataHora,
  nomeArquivo,
  texto,
} from "./documentoCcz";
import { obterLogoCcz } from "./logoCcz";
import { gerarTermoPdf } from "./termoCcz";

const mascararTelefone = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return texto(v);
};

const simNao = (v) => texto(v);

export async function gerarPdfEsporotricose(data) {
  const d = data || {};
  const animal = d.animal || {};
  const tutor = d.temTutor && d.tutor ? d.tutor : null;
  const classificacao = d.encerrado ? "ENCERRADO" : "EM ANDAMENTO";

  const doc = criarDocumentoCcz({
    logo: await obterLogoCcz(),
    titulo: "FICHA DE ESPOROTRICOSE",
    identificacao: `Registro ${texto(d.id)} · ${formatarData(d.dataVisita)} · ${classificacao}`,
    nota: "Ficha de acompanhamento de animal com esporotricose, com registro da avaliação clínica, do tratamento, do manejo domiciliar e das orientações sanitárias prestadas pela equipe do Centro de Controle de Zoonoses.",
  });

  const total = 1; let secao = 1;

  // ── IDENTIFICAÇÃO ───────────────────────────────────────────────────────
  doc.secao(`${secao}. Identificação`);
  doc.linha("DATA DA VISITA", formatarData(d.dataVisita), "FISCAL RESPONSÁVEL", d.fiscalResponsavel);
  doc.linha(
    "CLASSIFICAÇÃO",
    classificacao,
    "ENCERRADO EM",
    d.encerrado ? formatarDataHora(d.dataEncerramento) : "—",
  );
  if (d.encerrado) {
    doc.linha("DESFECHO DO CASO", d.desfecho || "—", "ENCERRADO POR", d.encerradoPor || "—");
    if (d.justificativaEncerramento) {
      doc.paragrafo("OBSERVAÇÃO / JUSTIFICATIVA DO ENCERRAMENTO", d.justificativaEncerramento);
    }
  }
  secao += 1;

  // ── DADOS DO ANIMAL ─────────────────────────────────────────────────────
  doc.secao(`${secao}. Dados do Animal`);
  doc.linha("NOME DO ANIMAL", animal.nome || "Sem nome", "ID CCZ", animal.id || d.animalId);
  doc.linha("ESPÉCIE", animal.especie, "SEXO", animal.sexo);
  doc.linha("PORTE", animal.porte, "IDADE ESTIMADA", animal.idade);
  doc.linha("RAÇA/PELAGEM", animal.racaPelagem || animal.raca, "POSSUI IDENTIFICAÇÃO", animal.possuiIdentificacao);
  secao += 1;

  // ── TUTOR (só quando houver) ────────────────────────────────────────────
  if (tutor) {
    doc.secao(`${secao}. Tutor Responsável`);
    doc.linha("NOME COMPLETO", tutor.nome, "CPF", tutor.cpf);
    doc.linha("TELEFONE", tutor.telefone ? mascararTelefone(tutor.telefone) : "—");
    if (tutor.endereco) doc.paragrafo("ENDEREÇO COMPLETO", tutor.endereco);
    secao += 1;
  }

  // ── CONDIÇÃO CLÍNICA ────────────────────────────────────────────────────
  doc.secao(`${secao}. Condição Clínica`);
  doc.linha("APRESENTA LESÕES", simNao(d.apresentaLesoes));
  if (d.apresentaLesoes === "Sim" && d.descricaoLesoes) {
    doc.paragrafo("DESCRIÇÃO DAS LESÕES", d.descricaoLesoes);
  }
  doc.linha("EM TRATAMENTO VETERINÁRIO", simNao(d.emTratamentoVeterinario));
  if (d.emTratamentoVeterinario === "Sim" && d.descricaoTratamentoVet) {
    doc.paragrafo("DESCRIÇÃO DO TRATAMENTO", d.descricaoTratamentoVet);
  }
  secao += 1;

  // ── TRATAMENTO ──────────────────────────────────────────────────────────
  doc.secao(`${secao}. Tratamento`);
  if (d.medicamentosPrescritos) {
    doc.paragrafo("MEDICAMENTOS PRESCRITOS", d.medicamentosPrescritos);
  }
  doc.linha(
    "HOUVE INTERRUPÇÃO DO TRATAMENTO",
    simNao(d.interrupcaoTratamento),
    "RETORNO AO VETERINÁRIO",
    simNao(d.retornoVeterinario),
  );
  secao += 1;

  // ── MANEJO DOMICILIAR (só com tutor) ────────────────────────────────────
  if (tutor) {
    doc.secao(`${secao}. Manejo Domiciliar`);
    doc.linha("ISOLAMENTO DOMICILIAR", simNao(d.isolamentoDomiciliar));
    if (d.isolamentoDomiciliar === "Sim" && d.observacoesIsolamento) {
      doc.paragrafo("OBSERVAÇÕES DO ISOLAMENTO", d.observacoesIsolamento);
    }
    doc.linha("ACESSO À RUA", simNao(d.acessoRua), "USO DE EPI", simNao(d.usoEpi));
    if (d.usoEpi === "Sim" && d.quaisEpis) {
      doc.linha("QUAIS EPIs", d.quaisEpis);
    }
    if (d.higienizacaoAmbiente) {
      doc.paragrafo("HIGIENIZAÇÃO DO AMBIENTE", d.higienizacaoAmbiente);
    }
    secao += 1;

    // ── OUTROS ANIMAIS E PESSOAS ──────────────────────────────────────────
    doc.secao(`${secao}. Outros Animais e Pessoas na Residência`);
    doc.linha("OUTROS ANIMAIS NA RESIDÊNCIA", simNao(d.outrosAnimaisResidencia));
    if (d.outrosAnimaisResidencia === "Sim" && d.outrosAnimaisDescricao) {
      doc.paragrafo("DESCRIÇÃO", d.outrosAnimaisDescricao);
    }
    doc.linha("PESSOAS COM LESÕES", simNao(d.pessoasComLesoes));
    if (d.pessoasComLesoes === "Sim" && d.pessoasLesoesDescricao) {
      doc.paragrafo("DESCRIÇÃO", d.pessoasLesoesDescricao);
    }
    secao += 1;

    // ── CIÊNCIA DO RESPONSÁVEL ────────────────────────────────────────────
    doc.secao(`${secao}. Ciência do Responsável`);
    doc.linha("TRATAMENTO CONTÍNUO", simNao(d.cienteTratamentoContinuo), "CONTENÇÃO DOMICILIAR", simNao(d.cienteContencao));
    doc.linha("USO DE EPI/LUVAS", simNao(d.cienteEpi), "DESTINAÇÃO DE RESÍDUOS", simNao(d.cienteResiduos));
    secao += 1;
  }

  // ── AVALIAÇÃO E CONCLUSÃO ───────────────────────────────────────────────
  doc.secao(`${secao}. Avaliação e Conclusão`);
  if (d.condicoesGeraisAmbiente) {
    doc.paragrafo("CONDIÇÕES GERAIS DO AMBIENTE", d.condicoesGeraisAmbiente);
  }
  if (d.conclusaoTecnica) {
    doc.paragrafo("CONCLUSÃO TÉCNICA", d.conclusaoTecnica);
  }
  if (!d.condicoesGeraisAmbiente && !d.conclusaoTecnica) {
    doc.paragrafo("CONCLUSÃO TÉCNICA", "Nenhuma conclusão registrada.");
  }
  secao += 1;

  // ── ENCAMINHAMENTOS ─────────────────────────────────────────────────────
  doc.secao(`${secao}. Encaminhamentos`);
  const encaminhamentos = [];
  if (d.encAcompanhamentoCcz) encaminhamentos.push("Acompanhamento periódico pelo CCZ");
  if (d.encNotificacaoTutor) encaminhamentos.push("Notificação formal ao tutor");
  if (d.encMinisterioPublico) encaminhamentos.push("Encaminhamento ao Ministério Público");
  if (d.encOutrasMedidas) encaminhamentos.push("Outras medidas sanitárias");

  doc.paragrafo(
    "ENCAMINHAMENTOS REGISTRADOS",
    encaminhamentos.length ? encaminhamentos.map((e) => `• ${e}`).join("\n") : "Nenhum encaminhamento registrado.",
  );

  if (d.encOutrasMedidas && d.outrasMedidasDescricao) {
    doc.paragrafo("OUTRAS MEDIDAS / OBSERVAÇÕES", d.outrasMedidasDescricao);
  }

  // ── AGENDA DE ACOMPANHAMENTO ────────────────────────────────────────────
  if (d.encAcompanhamentoCcz && Array.isArray(d.visitas) && d.visitas.length > 0) {
    doc.secao(`${secao}. Agenda de Acompanhamento`);
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
      doc.paragrafo(`VISITA — ${formatarData(v.data)}`, descricao);
    });
  }

  // ── ASSINATURAS ─────────────────────────────────────────────────────────
  doc.secao(`${d.encAcompanhamentoCcz && d.visitas?.length ? secao + 1 : secao}. Assinaturas`);
  if (tutor) {
    doc.assinatura(tutor.nome, "Tutor(a) do animal");
  }
  doc.assinatura(d.fiscalResponsavel, "Fiscal responsável — CCZ");

  doc.finalizar();
  return doc.doc.save(nomeArquivo("ficha-esporotricose", d.id, animal.id || d.animalId));
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
