// Consulta do relatório de auditoria da Regulação. USO SOMENTE NO SERVIDOR.
// Fonte principal: audit_logs (modulo = 'REGULACAO'). Em separado, devolve o
// "histórico anterior à auditoria" de regula_pedidos_historico (linhas
// anteriores ao primeiro registro de audit_logs da Regulação).
//
// Convenção de datas: de/ate são datas civis (YYYY-MM-DD) interpretadas em UTC,
// intervalo [de 00:00Z, ate+1 dia 00:00Z). Mesma convenção dos demais
// relatórios (ver auditoriaRelatorio.js e o filtro de ano do CCZ).
import { prisma } from "@/lib/prisma";

export const MODULO_REGULACAO = "REGULACAO";
export const LIMITE_EXPORTACAO = 5000;
const LIMITE_HISTORICO = 200;
const TAMANHOS_PAGINA = [10, 25, 50, 100];
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const ACOES_EDICAO = ["EDITAR", "SALVAR"];

function erro400(mensagem) {
  return Object.assign(new Error(mensagem), { status: 400 });
}

function dataValida(valor) {
  if (!REGEX_DATA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function inicioDia(valor) {
  return new Date(`${valor}T00:00:00.000Z`);
}

function fimExclusivo(valor) {
  const d = new Date(`${valor}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function texto(valor, max) {
  return String(valor ?? "").trim().slice(0, max);
}

function normalizarFiltros(params = {}) {
  const de = texto(params.de, 10);
  const ate = texto(params.ate, 10);
  if (de && !dataValida(de)) throw erro400("Data inicial inválida.");
  if (ate && !dataValida(ate)) throw erro400("Data final inválida.");
  if (de && ate && de > ate) {
    throw erro400("A data inicial não pode ser posterior à data final.");
  }
  const usuario = texto(params.usuario, 150);
  const acao = texto(params.acao, 30).toUpperCase();
  const entidade = texto(params.entidade, 60);
  const q = texto(params.q, 100);
  if (acao && !/^[A-Z_]+$/.test(acao)) throw erro400("Ação inválida.");
  return { de, ate, usuario, acao, entidade, q };
}

// Resolve o filtro de usuário (CPF exato, ou nome/CPF parcial) em condições.
function condicaoUsuario(usuario) {
  if (!usuario) return null;
  const digitos = usuario.replace(/\D/g, "");
  const or = [{ userNome: { contains: usuario, mode: "insensitive" } }];
  if (digitos.length > 0) or.push({ userCpf: { contains: digitos } });
  return { OR: or };
}

function montarWhere(f, { ignorarUsuario = false } = {}) {
  const and = [{ modulo: MODULO_REGULACAO }];
  if (f.de || f.ate) {
    const createdAt = {};
    if (f.de) createdAt.gte = inicioDia(f.de);
    if (f.ate) createdAt.lt = fimExclusivo(f.ate);
    and.push({ createdAt });
  }
  if (!ignorarUsuario) {
    const u = condicaoUsuario(f.usuario);
    if (u) and.push(u);
  }
  if (f.acao) and.push({ acao: f.acao });
  if (f.entidade) and.push({ entidade: f.entidade });
  if (f.q) {
    and.push({
      OR: [
        { descricao: { contains: f.q, mode: "insensitive" } },
        { entidadeId: { contains: f.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

function contagemPorAcao(mapa) {
  const edicoes = ACOES_EDICAO.reduce((s, a) => s + (mapa[a] || 0), 0);
  return {
    cadastros: mapa.CRIAR || 0,
    edicoes,
    exclusoes: mapa.EXCLUIR || 0,
    liberacoes: mapa.LIBERAR || 0,
  };
}

async function consultarHistoricoAnterior(f, corte) {
  // O histórico antigo só descreve pedidos de exame (entidade PedidoExame).
  if (f.acao || (f.entidade && f.entidade !== "PedidoExame")) {
    return { itens: [], total: 0, truncado: false, aplicavel: false };
  }
  const and = [{ dataHora: { lt: corte } }];
  if (f.de || f.ate) {
    const dataHora = { lt: corte };
    if (f.de) dataHora.gte = inicioDia(f.de);
    if (f.ate) {
      const fim = fimExclusivo(f.ate);
      dataHora.lt = fim < corte ? fim : corte;
    }
    and[0] = { dataHora };
  }
  if (f.usuario) {
    const digitos = f.usuario.replace(/\D/g, "");
    const or = [{ usuarioNome: { contains: f.usuario, mode: "insensitive" } }];
    if (digitos.length > 0) or.push({ usuarioCpf: { contains: digitos } });
    and.push({ OR: or });
  }
  if (f.q) {
    const or = [
      { campoAlterado: { contains: f.q, mode: "insensitive" } },
      { observacao: { contains: f.q, mode: "insensitive" } },
    ];
    const idNum = parseInt(f.q.replace(/\D/g, ""), 10);
    if (Number.isInteger(idNum) && idNum <= 2147483647) or.push({ pedidoId: idNum });
    and.push({ OR: or });
  }
  const where = { AND: and };
  const [total, linhas] = await Promise.all([
    prisma.pedidoExameHistorico.count({ where }),
    prisma.pedidoExameHistorico.findMany({
      where,
      orderBy: [{ dataHora: "desc" }, { id: "desc" }],
      take: LIMITE_HISTORICO,
      select: {
        id: true,
        pedidoId: true,
        usuarioCpf: true,
        usuarioNome: true,
        acao: true,
        campoAlterado: true,
        dataHora: true,
      },
    }),
  ]);
  return {
    aplicavel: true,
    total,
    truncado: total > linhas.length,
    itens: linhas.map((h) => ({
      id: h.id,
      ts: h.dataHora,
      userCpf: h.usuarioCpf,
      userNome: h.usuarioNome,
      acao: h.acao,
      entidade: "PedidoExame",
      entidadeId: String(h.pedidoId),
      descricao: [h.acao, h.campoAlterado].filter(Boolean).join(" · "),
    })),
  };
}

/**
 * @param {object} params de, ate, usuario, acao, entidade, q, page, pageSize,
 *   exportar (boolean: sem paginação, teto LIMITE_EXPORTACAO).
 * @param {{nome?: string}} geradoPor usuário que gerou o relatório.
 */
export async function consultarAuditoriaRegulacao(params = {}, geradoPor = null) {
  const f = normalizarFiltros(params);
  const exportar = params.exportar === true;
  const pagina = Math.max(1, parseInt(params.page, 10) || 1);
  const pedido = parseInt(params.pageSize, 10);
  const tamanho = TAMANHOS_PAGINA.includes(pedido) ? pedido : 25;
  const where = montarWhere(f);

  const [
    total,
    porUsuarioAcao,
    itens,
    primeiro,
    usuariosOpcoes,
    entidadesOpcoes,
    acoesOpcoes,
  ] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ["userCpf", "userNome", "acao"],
      where,
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(exportar
        ? { take: LIMITE_EXPORTACAO }
        : { take: tamanho, skip: (pagina - 1) * tamanho }),
      select: {
        id: true,
        userCpf: true,
        userNome: true,
        acao: true,
        entidade: true,
        entidadeId: true,
        descricao: true,
        ip: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.aggregate({
      where: { modulo: MODULO_REGULACAO },
      _min: { createdAt: true },
    }),
    prisma.auditLog.groupBy({
      by: ["userCpf"],
      where: { modulo: MODULO_REGULACAO },
      _max: { createdAt: true, userNome: true },
    }),
    prisma.auditLog.groupBy({
      by: ["entidade"],
      where: { modulo: MODULO_REGULACAO },
    }),
    prisma.auditLog.groupBy({
      by: ["acao"],
      where: { modulo: MODULO_REGULACAO },
    }),
  ]);

  // Resumo por usuário (merge por CPF; nome = snapshot mais recente).
  const mapaUsuarios = new Map();
  const totalPorAcao = {};
  for (const r of porUsuarioAcao) {
    const n = r._count._all;
    totalPorAcao[r.acao] = (totalPorAcao[r.acao] || 0) + n;
    let u = mapaUsuarios.get(r.userCpf);
    if (!u) {
      u = {
        cpf: r.userCpf,
        nome: r.userNome,
        nomeTs: r._max.createdAt,
        total: 0,
        porAcao: {},
        primeiro: r._min.createdAt,
        ultimo: r._max.createdAt,
      };
      mapaUsuarios.set(r.userCpf, u);
    }
    u.total += n;
    u.porAcao[r.acao] = (u.porAcao[r.acao] || 0) + n;
    if (r._min.createdAt < u.primeiro) u.primeiro = r._min.createdAt;
    if (r._max.createdAt > u.ultimo) u.ultimo = r._max.createdAt;
    if (r._max.createdAt > u.nomeTs) {
      u.nomeTs = r._max.createdAt;
      u.nome = r.userNome;
    }
  }

  const cpfs = [...mapaUsuarios.keys()];
  const cadastro = cpfs.length
    ? await prisma.user.findMany({
        where: { cpf: { in: cpfs } },
        select: { cpf: true, nome: true, role: true, cargo: true },
      })
    : [];
  const perfilPorCpf = new Map(cadastro.map((c) => [c.cpf, c]));

  const usuarios = [...mapaUsuarios.values()]
    .map((u) => {
      const c = perfilPorCpf.get(u.cpf);
      return {
        cpf: u.cpf,
        nome: c?.nome || u.nome,
        perfil: c?.role || null,
        cargo: c?.cargo || null,
        total: u.total,
        porAcao: u.porAcao,
        ...contagemPorAcao(u.porAcao),
        primeiro: u.primeiro,
        ultimo: u.ultimo,
      };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

  const maisAtivo = usuarios[0]
    ? { cpf: usuarios[0].cpf, nome: usuarios[0].nome, total: usuarios[0].total }
    : null;

  const primeiroRegistro = primeiro._min.createdAt || null;
  const corte = primeiroRegistro || new Date();
  const historico = await consultarHistoricoAnterior(f, corte);

  return {
    filtros: f,
    geradoEm: new Date().toISOString(),
    geradoPor: geradoPor?.nome || null,
    primeiroRegistroAuditoria: primeiroRegistro,
    indicadores: {
      total,
      usuariosDistintos: usuarios.length,
      ...contagemPorAcao(totalPorAcao),
      usuarioMaisAtivo: maisAtivo,
    },
    usuarios,
    itens: itens.map((r) => ({
      id: r.id,
      ts: r.createdAt,
      userCpf: r.userCpf,
      userNome: r.userNome,
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidadeId || null,
      descricao: r.descricao || null,
      ip: r.ip || null,
    })),
    paginacao: exportar
      ? {
          page: 1,
          pageSize: itens.length,
          total,
          totalPaginas: 1,
          truncado: total > LIMITE_EXPORTACAO,
          limiteExportacao: LIMITE_EXPORTACAO,
        }
      : {
          page: pagina,
          pageSize: tamanho,
          total,
          totalPaginas: Math.max(1, Math.ceil(total / tamanho)),
          truncado: false,
        },
    historicoAnterior: historico,
    opcoes: {
      usuarios: usuariosOpcoes
        .map((u) => ({ cpf: u.userCpf, nome: u._max.userNome || u.userCpf }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      entidades: entidadesOpcoes.map((e) => e.entidade).sort(),
      acoes: acoesOpcoes.map((a) => a.acao).sort(),
    },
  };
}
