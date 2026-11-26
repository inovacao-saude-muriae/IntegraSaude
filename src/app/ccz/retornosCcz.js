// Agendamento de retorno do CCZ — ponto ÚNICO usado por Esporotricose e
// Leishmaniose. O retorno é registrado como um procedimento com status
// "Agendado" na data do retorno e vinculado (data_retorno) ao atendimento que
// o solicitou, de modo que o Histórico do Animal consiga identificar a origem
// do acompanhamento sem duplicar dados.

export const RETORNO_ESPOROTRICOSE = "Retorno de Esporotricose";
export const RETORNO_LEISHMANIOSE = "Retorno de Leishmaniose";

// ymd (YYYY-MM-DD) → Date UTC (mesma convenção das colunas @db.Date).
export function ymdParaDataUtc(ymd) {
  const [a, m, d] = String(ymd || "")
    .split("-")
    .map(Number);
  if (!a || !m || !d) return null;
  return new Date(Date.UTC(a, m - 1, d));
}

export function dataParaYmd(data) {
  return data ? new Date(data).toISOString().slice(0, 10) : "";
}

export function gerarIdProcedimento(prefixo = "PRO") {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    .toUpperCase()
    .slice(0, 50);
}

/**
 * Cria (ou reaproveita) o agendamento de retorno de um atendimento.
 *
 * - `client` aceita o `tx` da transação em curso (ou `prisma`).
 * - `origemId` é o id da fiscalização que solicitou o retorno.
 * - `veterinario` recebe o nome do usuário autenticado (responsável).
 * - Nunca duplica: se já existir procedimento de retorno do mesmo animal na
 *   mesma data, ele é reaproveitado e apenas re-vinculado à origem.
 * - Data no passado (visita já realizada) não gera agendamento.
 */
export async function agendarRetorno(
  client,
  { animalId, tipo, data, origemId, veterinario, descricao },
) {
  if (!client || !animalId || !tipo) return null;
  const dataRetorno = ymdParaDataUtc(data);
  if (!dataRetorno) return null;

  const hoje = new Date();
  const hojeUtc = new Date(
    Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()),
  );
  if (dataRetorno.getTime() < hojeUtc.getTime()) return null;

  const existente = await client.cadastroProcedimento.findFirst({
    where: { animalId, tipo, dataProcedimento: dataRetorno },
    select: { id: true },
  });

  const dados = {
    animalId,
    tipo,
    dataProcedimento: dataRetorno,
    dataRetorno,
    status: "Agendado",
    veterinario: veterinario || null,
    descricao: descricao || null,
  };

  if (existente) {
    await client.cadastroProcedimento.update({
      where: { id: existente.id },
      data: dados,
    });
    return existente.id;
  }

  const id = gerarIdProcedimento("PRO");
  await client.cadastroProcedimento.create({ data: { id, ...dados } });
  return id;
}

/**
 * Converte o agendamento em visita REALIZADA, quando o atendimento de origem
 * foi registrado. Mantém a origem (data_retorno = data da visita) e o
 * responsável já gravado no procedimento.
 */
export async function concluirRetorno(
  client,
  { animalId, tipo, data, origemId, veterinario, descricao },
) {
  if (!client || !animalId || !tipo) return null;
  const dia = ymdParaDataUtc(data);
  if (!dia) return null;

  const existente = await client.cadastroProcedimento.findFirst({
    where: { animalId, tipo, dataProcedimento: dia },
    select: { id: true, veterinario: true },
  });

  const dados = {
    animalId,
    tipo,
    dataProcedimento: dia,
    dataRetorno: dia,
    status: "Realizado",
    veterinario: existente?.veterinario || veterinario || null,
    descricao: descricao || null,
  };

  if (existente) {
    await client.cadastroProcedimento.update({
      where: { id: existente.id },
      data: dados,
    });
    return existente.id;
  }

  const id = gerarIdProcedimento("PRO");
  await client.cadastroProcedimento.create({ data: { id, ...dados } });
  return id;
}
