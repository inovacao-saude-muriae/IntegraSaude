"use server";

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL DO CCZ — agregações no PostgreSQL
// ─────────────────────────────────────────────────────────────────────────
// FONTES REAIS (nada é criado ou inferido):
//   • ccz_animais          → cadastro do animal (especie, sexo, situacao,
//                            castrado, data_cadastro, data_devolucao, pessoa_cpf)
//   • ccz_tutores          → tutor (1 linha por pessoa; Pessoa é a fonte central)
//   • ccz_denuncias        → denúncias (situacao Ativa/Arquivada, tipo,
//                            dataDenuncia, arquivada_em, bairro do LOCAL)
//   • ccz_procedimentos    → ações realizadas (tipo: Castração, Vacinação, ...;
//                            status Realizado/Agendado)
//   • ccz_esporotricose(+visitas) → atendimentos de esporotricose e vistorias
//
// CONTAGENS SEM DUPLICAÇÃO: cada indicador agrega UMA tabela-base, sem JOIN
// multiplicador. Quando precisa cruzar (animal × tutor × denúncia), usa
// subconsultas escalares — nunca JOIN que multiplique linhas.
//
// BAIRRO:
//   • Animais → NÃO existe bairro no cadastro do animal. Usa-se o bairro do
//     endereço ATUAL da Pessoa (pessoa_endereco.endereco_atual) do tutor.
//   • Denúncias → ccz_denuncias.bairro (bairro do LOCAL da ocorrência, não da
//     pessoa). Nunca se usa o endereço do tutor como local da denúncia.
//   • Grafias diferentes do mesmo bairro são unificadas por chave normalizada
//     (sem acento, minúscula, espaços simples); exibe-se a grafia mais frequente.
//
// SITUAÇÕES REAIS:
//   • Animal: Adotado, Devolvido, CCZ, vazio (não informado).
//   • Denúncia: Ativa, Arquivada. Arquivada NÃO é concluída — o sistema não
//     possui status de conclusão nem data de encerramento da denúncia, por isso
//     o tempo médio de conclusão de denúncias não é calculado.
//
// FILTROS: período de cadastro, bairro, espécie, sexo, situação do animal e
// situação da denúncia, combinados por AND. Bairro/espécie/sexo/situação do
// animal só recortam os indicadores de ANIMAIS; a situação da denúncia só
// recorta os indicadores de DENÚNCIAS (evita distorção entre naturezas).
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

const FUSO_OFFSET_MS = 3 * 60 * 60 * 1000;

const SITUACOES_ANIMAL = [
  { valor: "Adotado", rotulo: "Adotado" },
  { valor: "Devolvido", rotulo: "Devolvido" },
  { valor: "CCZ", rotulo: "Sob custódia do CCZ" },
  { valor: "__VAZIO__", rotulo: "Não informado" },
];

const SITUACOES_DENUNCIA = [
  { valor: "Ativa", rotulo: "Ativa" },
  { valor: "Arquivada", rotulo: "Arquivada" },
];

function responder(erro) {
  const status = erro?.status || 500;
  if (status >= 401) {
    return { success: false, error: erro?.message || "Erro ao carregar o dashboard.", status };
  }
  console.error("[Dashboard CCZ] erro:", erro);
  return { success: false, error: "Erro ao carregar o dashboard.", status: 500 };
}

function diaLocalParaUtc(valor, limite) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || "").trim());
  if (!m) return null;
  const base = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() - FUSO_OFFSET_MS + (limite === "fim" ? 86400000 - 1 : 0));
}

const texto = (v) => String(v ?? "").trim();

// Condições do cadastro do animal (período, espécie, sexo, situação, bairro).
function condicoesAnimal(filtros = {}) {
  const sql = [];
  const de = diaLocalParaUtc(filtros.cadastroInicio, "inicio");
  const ate = diaLocalParaUtc(filtros.cadastroFim, "fim");
  if (de) sql.push(Prisma.sql`a.data_cadastro >= ${de}`);
  if (ate) sql.push(Prisma.sql`a.data_cadastro <= ${ate}`);

  const especie = texto(filtros.especie);
  if (especie) sql.push(Prisma.sql`btrim(a.especie) = ${especie}`);

  const sexo = texto(filtros.sexo);
  if (sexo) sql.push(Prisma.sql`btrim(a.sexo) = ${sexo}`);

  const situacao = texto(filtros.situacaoAnimal);
  if (situacao === "__VAZIO__") sql.push(Prisma.sql`COALESCE(btrim(a.situacao), '') = ''`);
  else if (situacao) sql.push(Prisma.sql`btrim(a.situacao) = ${situacao}`);

  const bairro = texto(filtros.bairro);
  if (bairro) {
    // Bairro do animal = bairro do endereço atual do tutor (Pessoa central).
    sql.push(Prisma.sql`EXISTS (
      SELECT 1 FROM public.pessoa_endereco pe
      WHERE pe.pessoa_cpf = a.pessoa_cpf AND pe.endereco_atual = true
        AND ${chaveBairro(Prisma.sql`pe.bairro`)} = ${bairro})`);
  }
  return sql;
}

// Chave normalizada de bairro: sem acento, minúscula, espaços simples.
function chaveBairro(expr) {
  return Prisma.sql`lower(regexp_replace(translate(btrim(COALESCE(${expr}, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g'))`;
}

// Condições das denúncias (período, situação, bairro do LOCAL).
function condicoesDenuncia(filtros = {}) {
  const sql = [];
  const de = diaLocalParaUtc(filtros.cadastroInicio, "inicio");
  const ate = diaLocalParaUtc(filtros.cadastroFim, "fim");
  if (de) sql.push(Prisma.sql`d."dataDenuncia" >= ${de}`);
  if (ate) sql.push(Prisma.sql`d."dataDenuncia" <= ${ate}`);

  const situacao = texto(filtros.situacaoDenuncia);
  if (situacao) sql.push(Prisma.sql`btrim(d.situacao) = ${situacao}`);

  const bairro = texto(filtros.bairro);
  if (bairro) sql.push(Prisma.sql`${chaveBairro(Prisma.sql`d.bairro`)} = ${bairro}`);
  return sql;
}

const juntar = (condicoes) =>
  condicoes.length ? Prisma.join(condicoes, " AND ") : Prisma.sql`1=1`;

// Catálogo dos filtros.
export async function obterFiltrosDashboardCcz() {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const [especies, sexos, bairrosAnimais, bairrosDenuncias] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT btrim(especie) AS valor, COUNT(*)::int AS quantidade
        FROM public.ccz_animais
        WHERE btrim(COALESCE(especie, '')) <> ''
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT btrim(sexo) AS valor, COUNT(*)::int AS quantidade
        FROM public.ccz_animais
        WHERE btrim(COALESCE(sexo, '')) <> ''
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT ${chaveBairro(Prisma.sql`pe.bairro`)} AS chave,
               (array_agg(btrim(pe.bairro) ORDER BY btrim(pe.bairro)))[1] AS nome,
               COUNT(*)::int AS quantidade
        FROM public.ccz_animais a
        JOIN public.pessoa_endereco pe ON pe.pessoa_cpf = a.pessoa_cpf AND pe.endereco_atual = true
        WHERE btrim(COALESCE(pe.bairro, '')) <> ''
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT ${chaveBairro(Prisma.sql`d.bairro`)} AS chave,
               (array_agg(btrim(d.bairro) ORDER BY btrim(d.bairro)))[1] AS nome,
               COUNT(*)::int AS quantidade
        FROM public.ccz_denuncias d
        WHERE btrim(COALESCE(d.bairro, '')) <> ''
        GROUP BY 1 ORDER BY 1`),
    ]);

    // União dos bairros das duas origens, uma linha por chave normalizada.
    const mapa = new Map();
    for (const b of [...bairrosAnimais, ...bairrosDenuncias]) {
      if (!b.chave) continue;
      const atual = mapa.get(b.chave);
      if (!atual) mapa.set(b.chave, { valor: b.chave, nome: b.nome });
    }
    const bairros = [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const rotuloSexo = (v) =>
      v === "M" ? "Macho" : v === "F" ? "Fêmea" : v === "I" ? "Indefinido" : v;

    return {
      success: true,
      bairros,
      especies: especies.map((e) => ({ valor: e.valor, rotulo: e.valor })),
      sexos: sexos.map((s) => ({ valor: s.valor, rotulo: rotuloSexo(s.valor) })),
      situacoesAnimal: SITUACOES_ANIMAL,
      situacoesDenuncia: SITUACOES_DENUNCIA,
    };
  } catch (erro) {
    return responder(erro);
  }
}

export async function obterDashboardCcz(filtros = {}) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    const whereAnimal = juntar(condicoesAnimal(filtros));
    const whereDenuncia = juntar(condicoesDenuncia(filtros));
    const temFiltroAnimal =
      condicoesAnimal(filtros).length > 0;

    // Universo de animais filtrados (subconsulta reutilizada).
    const animais = Prisma.sql`
      SELECT a.id, a.especie, a.sexo, a.situacao, a.castrado, a.pessoa_cpf,
             a.data_cadastro, a.data_devolucao
      FROM public.ccz_animais a
      WHERE ${whereAnimal}`;

    const denuncias = Prisma.sql`
      SELECT d.id, d.situacao, d.tipo, d.bairro, d."dataDenuncia", d."arquivada_em"
      FROM public.ccz_denuncias d
      WHERE ${whereDenuncia}`;

    const [
      indicadoresAnimais,
      indicadoresDenuncias,
      porEspecie,
      porSexo,
      porSituacaoAnimal,
      porCastracao,
      bairrosAnimais,
      evolucaoAnimais,
      denunciasPorSituacao,
      denunciasPorBairro,
      denunciasPorTipo,
      evolucaoDenuncias,
      pendentesPorBairro,
      procedimentosPorTipo,
      evolucaoProcedimentos,
      esporotricose,
    ] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS animais,
               COUNT(DISTINCT pessoa_cpf)::int AS tutores,
               COUNT(*) FILTER (WHERE pessoa_cpf IS NULL)::int AS sem_tutor
        FROM (${animais}) u`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE btrim(situacao) = 'Ativa')::int AS pendentes,
               COUNT(*) FILTER (WHERE btrim(situacao) = 'Arquivada')::int AS arquivadas
        FROM (${denuncias}) u`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(NULLIF(btrim(especie), ''), 'Não informada') AS nome, COUNT(*)::int AS quantidade
        FROM (${animais}) u GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT CASE btrim(COALESCE(sexo, '')) WHEN 'M' THEN 'Macho' WHEN 'F' THEN 'Fêmea'
               WHEN 'I' THEN 'Indefinido' WHEN '' THEN 'Não informado' ELSE btrim(sexo) END AS nome,
               COUNT(*)::int AS quantidade
        FROM (${animais}) u GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT CASE btrim(COALESCE(situacao, '')) WHEN 'Adotado' THEN 'Adotado'
               WHEN 'Devolvido' THEN 'Devolvido' WHEN 'CCZ' THEN 'Sob custódia do CCZ'
               ELSE 'Não informado' END AS nome,
               COUNT(*)::int AS quantidade
        FROM (${animais}) u GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT CASE WHEN btrim(COALESCE(castrado, '')) = 'Sim' THEN 'Castrado' ELSE 'Não castrado' END AS nome,
               COUNT(*)::int AS quantidade
        FROM (${animais}) u GROUP BY 1 ORDER BY quantidade DESC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT ${chaveBairro(Prisma.sql`pe.bairro`)} AS chave,
               (array_agg(btrim(pe.bairro) ORDER BY btrim(pe.bairro)))[1] AS nome,
               COUNT(*)::int AS quantidade
        FROM (${animais}) u
        JOIN public.pessoa_endereco pe ON pe.pessoa_cpf = u.pessoa_cpf AND pe.endereco_atual = true
        WHERE btrim(COALESCE(pe.bairro, '')) <> ''
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(data_cadastro - interval '3 hours', 'YYYY-MM') AS mes, COUNT(*)::int AS quantidade
        FROM (${animais}) u
        WHERE data_cadastro IS NOT NULL
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT btrim(situacao) AS nome, COUNT(*)::int AS quantidade
        FROM (${denuncias}) u GROUP BY 1 ORDER BY quantidade DESC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT ${chaveBairro(Prisma.sql`bairro`)} AS chave,
               (array_agg(btrim(bairro) ORDER BY btrim(bairro)))[1] AS nome,
               COUNT(*)::int AS quantidade
        FROM (${denuncias}) u
        WHERE btrim(COALESCE(bairro, '')) <> ''
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT COALESCE(NULLIF(btrim(tipo), ''), 'Não informado') AS nome, COUNT(*)::int AS quantidade
        FROM (${denuncias}) u GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char("dataDenuncia" - interval '3 hours', 'YYYY-MM') AS mes, COUNT(*)::int AS quantidade
        FROM (${denuncias}) u
        WHERE "dataDenuncia" IS NOT NULL
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT ${chaveBairro(Prisma.sql`bairro`)} AS chave,
               (array_agg(btrim(bairro) ORDER BY btrim(bairro)))[1] AS nome,
               COUNT(*)::int AS quantidade
        FROM (${denuncias}) u
        WHERE btrim(situacao) = 'Ativa' AND btrim(COALESCE(bairro, '')) <> ''
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC LIMIT 10`),
      prisma.$queryRaw(Prisma.sql`
        SELECT btrim(tipo) AS nome, COUNT(*)::int AS quantidade
        FROM public.ccz_procedimentos
        WHERE ${temFiltroAnimal ? Prisma.sql`animal_id IN (SELECT id FROM (${animais}) x)` : Prisma.sql`1=1`}
          AND btrim(COALESCE(status, '')) = 'Realizado'
        GROUP BY 1 ORDER BY quantidade DESC, nome ASC`),
      prisma.$queryRaw(Prisma.sql`
        SELECT to_char(data_procedimento - interval '3 hours', 'YYYY-MM') AS mes, COUNT(*)::int AS quantidade
        FROM public.ccz_procedimentos
        WHERE ${temFiltroAnimal ? Prisma.sql`animal_id IN (SELECT id FROM (${animais}) x)` : Prisma.sql`1=1`}
          AND btrim(COALESCE(status, '')) = 'Realizado'
        GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw(Prisma.sql`
        SELECT
          (SELECT COUNT(*)::int FROM public.ccz_esporotricose e
            WHERE ${temFiltroAnimal ? Prisma.sql`e.animal_id IN (SELECT id FROM (${animais}) x)` : Prisma.sql`1=1`}) AS casos,
          (SELECT COUNT(*)::int FROM public.ccz_esporotricose e
            WHERE e.encerrado = true
              AND ${temFiltroAnimal ? Prisma.sql`e.animal_id IN (SELECT id FROM (${animais}) x)` : Prisma.sql`1=1`}) AS encerrados,
          (SELECT COUNT(*)::int FROM public.ccz_esporotricose_visitas v
            JOIN public.ccz_esporotricose e2 ON e2.id = v.esporotricose_id
            WHERE ${temFiltroAnimal ? Prisma.sql`e2.animal_id IN (SELECT id FROM (${animais}) x)` : Prisma.sql`1=1`}) AS visitas`),
    ]);

    const ia = indicadoresAnimais[0] || {};
    const idn = indicadoresDenuncias[0] || {};
    const esp = esporotricose[0] || {};

    return {
      success: true,
      indicadores: {
        animais: Number(ia.animais || 0),
        tutores: Number(ia.tutores || 0),
        semTutor: Number(ia.sem_tutor || 0),
        denuncias: Number(idn.total || 0),
        denunciasPendentes: Number(idn.pendentes || 0),
        denunciasArquivadas: Number(idn.arquivadas || 0),
        denunciasConcluidas: 0, // não existe status de conclusão no sistema
        casosEsporotricose: Number(esp.casos || 0),
        esporotricoseEncerrados: Number(esp.encerrados || 0),
        visitasEsporotricose: Number(esp.visitas || 0),
      },
      animais: {
        porEspecie: porEspecie.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        porSexo: porSexo.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        porSituacao: porSituacaoAnimal.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        castracao: porCastracao.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        bairros: bairrosAnimais.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        evolucao: evolucaoAnimais.map((r) => ({ mes: r.mes, quantidade: Number(r.quantidade) })),
      },
      denuncias: {
        porSituacao: denunciasPorSituacao.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        porBairro: denunciasPorBairro.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        porTipo: denunciasPorTipo.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        evolucao: evolucaoDenuncias.map((r) => ({ mes: r.mes, quantidade: Number(r.quantidade) })),
        pendentesPorBairro: pendentesPorBairro.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
      },
      acoes: {
        porTipo: procedimentosPorTipo.map((r) => ({ nome: r.nome, quantidade: Number(r.quantidade) })),
        evolucao: evolucaoProcedimentos.map((r) => ({ mes: r.mes, quantidade: Number(r.quantidade) })),
      },
    };
  } catch (erro) {
    return responder(erro);
  }
}
