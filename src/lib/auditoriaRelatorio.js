// Consulta da linha do tempo de auditoria por usuário. USO SOMENTE NO SERVIDOR.
// Une audit_logs (origem AUDITORIA) com rastros anteriores à auditoria
// (origem HISTORICO, só linhas anteriores ao primeiro registro de audit_logs).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_MODULOS } from "@/lib/audit";

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

function erro400(mensagem) {
  return Object.assign(new Error(mensagem), { status: 400 });
}

function dataValida(valor) {
  if (!REGEX_DATA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

export async function buscarUsuarios(q) {
  const termo = String(q || "").trim();
  if (termo.length < 2) return [];
  const digitos = termo.replace(/\D/g, "");
  const or = [
    { nome: { contains: termo, mode: "insensitive" } },
    { username: { contains: termo, mode: "insensitive" } },
  ];
  if (digitos.length > 0) or.push({ cpf: { contains: digitos } });

  return prisma.user.findMany({
    where: { OR: or },
    select: {
      cpf: true,
      nome: true,
      username: true,
      cargo: true,
      role: true,
      ativo: true,
    },
    orderBy: { nome: "asc" },
    take: 20,
  });
}

// CTE com todas as fontes. Parâmetros sempre via Prisma.sql (sem concatenação).
function montarEventos(cpf, nome) {
  return Prisma.sql`
    WITH corte AS (
      SELECT COALESCE(MIN(created_at), now()) AS ts FROM audit_logs
    ),
    eventos AS (
      SELECT 'AUDITORIA'::text AS origem, NULL::text AS match_tipo,
             a.created_at AS ts, a.modulo::text AS modulo, a.acao::text AS acao,
             a.entidade::text AS entidade, a.entidade_id::text AS entidade_id,
             a.descricao::text AS descricao, a.ip::text AS ip,
             ('A' || a.id::text) AS chave
        FROM audit_logs a
       WHERE a.user_cpf = ${cpf}

      UNION ALL
      SELECT 'HISTORICO', 'CPF', s.created_at, 'AUTH', 'LOGIN', 'Sessão', NULL,
             'Sessão iniciada', NULL, ('S' || s.id::text)
        FROM user_sessions s, corte
       WHERE s.user_id = ${cpf} AND s.created_at < corte.ts

      UNION ALL
      SELECT 'HISTORICO', 'CPF', u.created_at, 'GERENCIAMENTO', 'OUTRO', 'Acesso',
             u.modulo::text,
             'Permissão recebida: módulo ' || u.modulo || ' (nível ' || u.nivel || ')',
             NULL, ('U' || u.id::text)
        FROM user_acessos u, corte
       WHERE u.user_cpf = ${cpf} AND u.created_at < corte.ts

      UNION ALL
      SELECT 'HISTORICO', 'CPF', h.data_hora, 'REGULACAO', 'OUTRO', 'PedidoExame',
             h.pedido_id::text,
             left(btrim(COALESCE(h.acao::text, '') || ' ' || COALESCE(h.campo_alterado::text, '')), 500),
             NULL, ('H' || h.id::text)
        FROM regula_pedidos_historico h, corte
       WHERE h.usuario_cpf = ${cpf} AND h.data_hora < corte.ts

      UNION ALL
      SELECT 'HISTORICO', 'NOME', e.data_encerramento, 'CCZ', 'ENCERRAR', 'Esporotricose',
             e.id::text, 'Esporotricose encerrada', NULL, ('E' || e.id::text)
        FROM ccz_esporotricose e, corte
       WHERE lower(btrim(e.encerrado_por)) = lower(btrim(${nome}))
         AND e.data_encerramento IS NOT NULL AND e.data_encerramento < corte.ts

      UNION ALL
      SELECT 'HISTORICO', 'NOME', e."dataVisita"::timestamptz, 'CCZ', 'OUTRO', 'Esporotricose',
             e.id::text, 'Visita como fiscal responsável', NULL, ('F' || e.id::text)
        FROM ccz_esporotricose e, corte
       WHERE lower(btrim(e.fiscal_responsavel)) = lower(btrim(${nome}))
         AND e."dataVisita" IS NOT NULL AND e."dataVisita"::timestamptz < corte.ts

      UNION ALL
      SELECT 'HISTORICO', 'NOME', r.data_relatorio, 'CCZ', 'OUTRO', 'RelatorioVisita',
             r.id::text, 'Relatório de visita como profissional responsável', NULL, ('R' || r.id::text)
        FROM ccz_esporotricose_relatorios r, corte
       WHERE lower(btrim(r.profissional_responsavel)) = lower(btrim(${nome}))
         AND r.data_relatorio IS NOT NULL AND r.data_relatorio < corte.ts

      UNION ALL
      SELECT 'HISTORICO', 'NOME', j.created_at, 'FARMACIA_JUDICIAL', 'AJUSTAR', 'Estoque',
             j.medicamento_id::text, 'Ajuste de estoque', NULL, ('J' || j.id::text)
        FROM farmacia_ajustes_estoque j, corte
       WHERE lower(btrim(j.responsavel)) = lower(btrim(${nome}))
         AND j.created_at < corte.ts

      UNION ALL
      SELECT 'HISTORICO', 'NOME', p.updated_at, 'REGULACAO', 'EDITAR', 'PlanejamentoCidade',
             p.id::text, 'Planejamento de cidade atualizado', NULL, ('P' || p.id::text)
        FROM regula_planejamento_cidade p, corte
       WHERE lower(btrim(p.updated_by)) = lower(btrim(${nome}))
         AND p.updated_at < corte.ts

      UNION ALL
      SELECT 'HISTORICO', 'NOME', t.data_atendimento::timestamptz, 'JUNTA', 'OUTRO', 'Atendimento',
             t.id::text, 'Atendimento registrado', NULL, ('T' || t.id::text)
        FROM junta_atendimentos t, corte
       WHERE lower(btrim(t.profissional_responsavel)) = lower(btrim(${nome}))
         AND t.data_atendimento IS NOT NULL AND t.data_atendimento::timestamptz < corte.ts
    )
  `;
}

function filtroPeriodo(dataInicio, dataFim) {
  const partes = [];
  if (dataInicio) partes.push(Prisma.sql`ts >= ${dataInicio}::date`);
  if (dataFim) partes.push(Prisma.sql`ts < (${dataFim}::date + 1)`);
  return partes;
}

function montarWhere(partes) {
  return partes.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(partes, " AND ")}`
    : Prisma.empty;
}

function paraNumero(valor) {
  return Number(valor ?? 0);
}

export async function consultarAuditoriaUsuario({
  cpf,
  modulo,
  dataInicio,
  dataFim,
  page,
  limit,
}) {
  const cpfLimpo = String(cpf || "").replace(/\D/g, "");
  if (!cpfLimpo) throw erro400("Informe o CPF do usuário.");
  if (modulo && !AUDIT_MODULOS.includes(modulo)) throw erro400("Módulo inválido.");
  if (dataInicio && !dataValida(dataInicio)) throw erro400("Data inicial inválida.");
  if (dataFim && !dataValida(dataFim)) throw erro400("Data final inválida.");

  const pagina = Math.max(1, parseInt(page, 10) || 1);
  const tamanho = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  const usuario = await prisma.user.findUnique({
    where: { cpf: cpfLimpo },
    select: {
      cpf: true,
      nome: true,
      username: true,
      cargo: true,
      role: true,
      ativo: true,
    },
  });
  if (!usuario) {
    throw Object.assign(new Error("Usuário não encontrado."), { status: 404 });
  }

  const eventos = montarEventos(usuario.cpf, usuario.nome);
  const partesPeriodo = filtroPeriodo(dataInicio, dataFim);
  const wherePeriodo = montarWhere(partesPeriodo);
  const whereLista = montarWhere(
    modulo
      ? [...partesPeriodo, Prisma.sql`modulo = ${modulo}`]
      : partesPeriodo,
  );

  const [totais, porModulo, porAcao, contagem, itens, primeiroAudit] =
    await Promise.all([
      prisma.$queryRaw`${eventos}
        SELECT count(*) AS total, min(ts) AS primeiro, max(ts) AS ultimo,
               count(*) FILTER (WHERE origem = 'HISTORICO') AS total_historico
          FROM eventos ${wherePeriodo}`,
      prisma.$queryRaw`${eventos}
        SELECT modulo, count(*) AS total FROM eventos ${wherePeriodo}
         GROUP BY modulo ORDER BY total DESC, modulo`,
      prisma.$queryRaw`${eventos}
        SELECT acao, count(*) AS total FROM eventos ${wherePeriodo}
         GROUP BY acao ORDER BY total DESC, acao`,
      prisma.$queryRaw`${eventos}
        SELECT count(*) AS total FROM eventos ${whereLista}`,
      prisma.$queryRaw`${eventos}
        SELECT origem, match_tipo, ts, modulo, acao, entidade, entidade_id,
               descricao, ip, chave
          FROM eventos ${whereLista}
         ORDER BY ts DESC, origem, chave
         LIMIT ${tamanho} OFFSET ${(pagina - 1) * tamanho}`,
      prisma.$queryRaw`SELECT min(created_at) AS primeiro FROM audit_logs`,
    ]);

  const t = totais[0] || {};
  const total = paraNumero(contagem[0]?.total);

  return {
    usuario,
    resumo: {
      total: paraNumero(t.total),
      porModulo: porModulo.map((r) => ({
        modulo: r.modulo,
        total: paraNumero(r.total),
      })),
      porAcao: porAcao.map((r) => ({
        acao: r.acao,
        total: paraNumero(r.total),
      })),
      primeiro: t.primeiro || null,
      ultimo: t.ultimo || null,
      totalHistorico: paraNumero(t.total_historico),
      primeiroRegistroAuditoria: primeiroAudit[0]?.primeiro || null,
    },
    itens: itens.map((r) => ({
      origem: r.origem,
      matchTipo: r.match_tipo || null,
      ts: r.ts,
      modulo: r.modulo,
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidade_id || null,
      descricao: r.descricao || null,
      ip: r.ip || null,
    })),
    paginacao: {
      page: pagina,
      limit: tamanho,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / tamanho)),
    },
  };
}
