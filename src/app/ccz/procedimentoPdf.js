// ═══════════════════════════════════════════════════════════════════════════
// PDF — FICHA DE PROCEDIMENTO
// Centro de Controle de Zoonoses de Muriaé.
//
// Um documento por registro selecionado: identificação do animal, do tutor
// (quando houver), dados do procedimento e informações registradas.
// Não inventa campos: o que não existe no cadastro não é impresso.
// A apresentação vem do template institucional (documentoCcz.js).
// ═══════════════════════════════════════════════════════════════════════════

import {
  criarDocumentoCcz,
  formatarData,
  nomeArquivo,
  texto,
} from "./documentoCcz";
import { obterLogoCcz } from "./logoCcz";

export async function gerarPdfProcedimento(registro) {
  const dados = registro || {};
  const animal = dados.animal || {};
  const tutor = dados.tutor || null;

  const doc = criarDocumentoCcz({
    logo: await obterLogoCcz(),
    titulo: "FICHA DE PROCEDIMENTO",
    identificacao: `Registro ${texto(dados.id)} · ${formatarData(dados.dataProcedimento)}`,
    nota: "Documento emitido pelo Centro de Controle de Zoonoses referente ao procedimento realizado ou agendado no animal identificado abaixo, para fins de registro e arquivamento administrativo.",
  });

  // ── 1. IDENTIFICAÇÃO DO ANIMAL ─────────────────────────────────────────
  doc.secao("1. Identificação do Animal");
  doc.linha("NOME DO ANIMAL", animal.nome || dados.animalNome || "Sem nome", "ID CCZ", dados.animalId);
  doc.linha("ESPÉCIE", animal.especie || dados.animalEspecie, "RAÇA/PELAGEM", animal.racaPelagem || animal.raca);
  doc.linha(
    "SEXO",
    animal.sexo,
    "IDADE ESTIMADA",
    animal.idade,
  );
  doc.linha(
    "PORTE",
    animal.porte,
    "POSSUI IDENTIFICAÇÃO (COLEIRA OU CHIP)",
    animal.possuiIdentificacao,
  );
  doc.linha("SITUAÇÃO CADASTRAL", animal.situacao);

  // ── 2. IDENTIFICAÇÃO DO TUTOR (só quando houver) ───────────────────────
  if (tutor) {
    doc.secao("2. Identificação do Tutor");
    doc.linha("NOME COMPLETO", tutor.nome, "CPF", tutor.cpf);
    doc.linha("TELEFONE", tutor.telefone);
    if (tutor.endereco) doc.paragrafo("ENDEREÇO COMPLETO", tutor.endereco);
  }

  // ── 3. DADOS DO PROCEDIMENTO ───────────────────────────────────────────
  doc.secao(`${tutor ? "3" : "2"}. Dados do Procedimento`);
  doc.linha("TIPO DE PROCEDIMENTO", dados.tipo, "DATA DO PROCEDIMENTO", formatarData(dados.dataProcedimento));
  doc.linha("PROFISSIONAL RESPONSÁVEL", dados.veterinario, "SITUAÇÃO", dados.status);
  doc.linha(
    "PREVISÃO DE RETORNO",
    dados.dataRetorno ? formatarData(dados.dataRetorno) : "Sem retorno previsto",
    "IDENTIFICADOR DO REGISTRO",
    dados.id,
  );

  // ── 4. INFORMAÇÕES E OBSERVAÇÕES ───────────────────────────────────────
  doc.secao(`${tutor ? "4" : "3"}. Informações e Observações`);
  if (dados.descricao) doc.paragrafo("DESCRIÇÃO DO PROCEDIMENTO", dados.descricao);
  if (dados.medicacaoPrescrita) doc.paragrafo("MEDICAÇÃO PRESCRITA", dados.medicacaoPrescrita);
  if (!dados.descricao && !dados.medicacaoPrescrita) {
    doc.paragrafo("OBSERVAÇÕES", "Nenhuma observação registrada para este procedimento.");
  }

  // ── ASSINATURA DO PROFISSIONAL RESPONSÁVEL ─────────────────────────────
  doc.secao(`${tutor ? "5" : "4"}. Assinatura`);
  doc.assinatura(
    dados.veterinario || "Profissional responsável",
    "Médico(a) Veterinário(a) responsável pelo procedimento",
  );

  doc.finalizar();
  return doc.doc.save(nomeArquivo("ficha-procedimento", dados.id, dados.animalId));
}
