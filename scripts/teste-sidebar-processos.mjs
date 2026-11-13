/**
 * REORGANIZAÇÃO DA SIDEBAR — Processos Judiciais (grupo) e
 * Gerenciamento → Especialidades e Procedimentos.
 *
 * Cobre os 14 itens pedidos, com o servidor REAL no ar:
 *   1. expansão/recolhimento do grupo (estado derivado do pathname)
 *   2. abertura do item Novo Processo
 *   3. as duas abas (Consultar Processos / Novo Processo)
 *   4. consulta de processos            5. cadastro          6. edição
 *   7. exclusão autorizada              8. catálogo fora da tela operacional
 *   9. catálogo acessível pelo Gerenciamento
 *  10. cadastro/edição no catálogo      11. permissões do catálogo
 *  12. proteção de rotas (proxy + página)
 *  13. navegação mobile (CSS/responsivo)
 *  14. sem links duplicados ou quebrados
 *
 * Uso: node scripts/teste-sidebar-processos.mjs   (com o servidor no ar)
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const segredo = new TextEncoder().encode(env.JWT_SECRET);

const PROC = { rota: "/camara-tecnica/processos", arquivo: "camara-tecnica/processos/actions" };
const CAT = { rota: "/camara-tecnica/processos/especialidades", arquivo: "camara-tecnica/processos/especialidades/actions" };

let ok = 0;
let falhou = 0;
const falhas = [];
function check(nome, cond, extra = "") {
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhou += 1;
    falhas.push(nome);
    console.log(`  FALHA ${nome} ${extra}`);
  }
}
const ler = (p) => fs.readFileSync(p, "utf8");

// ── Sessões reais ──────────────────────────────────────────────────────────
const sessoes = new Map();
async function tokenDe(cpf) {
  if (sessoes.has(cpf)) return sessoes.get(cpf);
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", [cpf])).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now() + interval '1 hour', now())`,
    [u.cpf, token],
  );
  sessoes.set(cpf, token);
  return token;
}

// ── Server actions (mesmo protocolo do navegador) ─────────────────────────
let manifest = null;
function actionId(nome, arquivo) {
  if (!manifest) {
    manifest = JSON.parse(ler(".next/server/server-reference-manifest.json"));
  }
  for (const [id, info] of Object.entries(manifest.node || {})) {
    if (info?.exportedName === nome && String(info?.filename || "").includes(arquivo)) {
      return id;
    }
  }
  return null;
}

const ROUTER_STATE = () =>
  encodeURIComponent(JSON.stringify(["", { children: ["__PAGE__", {}] }, null, null, true]));

async function chamar(cpf, nome, args, { rota, arquivo }) {
  const token = await tokenDe(cpf);
  const id = actionId(nome, arquivo);
  if (!id) throw new Error(`server action "${nome}" não encontrada no manifest`);
  const form = new FormData();
  form.append("0", JSON.stringify(args));
  const r = await fetch(`${BASE}${rota}`, {
    method: "POST",
    headers: {
      cookie: `session_token=${token}`,
      "Next-Action": id,
      "Next-Router-State-Tree": ROUTER_STATE(),
      accept: "text/x-component",
    },
    body: form,
  });
  const texto = await r.text();
  for (const linha of texto.split("\n")) {
    if (!/^1:/.test(linha)) continue;
    try {
      const valor = JSON.parse(linha.slice(2));
      if (valor && typeof valor === "object") return valor;
    } catch {}
  }
  try {
    return JSON.parse(texto);
  } catch {
    return { success: false, error: `resposta não-JSON (${r.status})`, bruto: texto.slice(0, 160) };
  }
}
const proc = (cpf, nome, args) => chamar(cpf, nome, args, PROC);
const cat = (cpf, nome, args) => chamar(cpf, nome, args, CAT);

async function pagina(rota, cpf, { seguir = false } = {}) {
  const headers = cpf ? { cookie: `session_token=${await tokenDe(cpf)}` } : {};
  const r = await fetch(`${BASE}${rota}`, { headers, redirect: seguir ? "follow" : "manual" });
  const corpo = r.status >= 300 && r.status < 400 ? "" : await r.text();
  return { status: r.status, corpo, local: r.headers.get("location") || "" };
}

async function main() {
  await db.connect();
  const GESTOR = "00000000000"; // PROCESSOS ADMINISTRADOR (catálogo completo)
  const JEFINNY = "12912453674"; // REGULACAO SUPERVISOR — sem PROCESSOS
  const CCZ = "12345678912";

  console.log("\nPreparando…");
  await db.query("DELETE FROM processos_judiciais WHERE numero_processo LIKE 'TSTSB-%'");
  await db.query("DELETE FROM processos_especialidade_procedimento WHERE especialidade_id IN (SELECT id FROM processos_especialidades WHERE nome LIKE 'TSTSB%')");
  await db.query("DELETE FROM processos_procedimentos WHERE nome LIKE 'TSTSB%'");
  await db.query("DELETE FROM processos_especialidades WHERE nome LIKE 'TSTSB%'");

  // ── 1. Grupo Processos Judiciais na Sidebar ─────────────────────────────
  console.log("\n1. Grupo expansível Processos Judiciais");
  const sidebar = ler("src/components/Sidebar.js");
  check(
    "Processos Judiciais é dropdown aninhado (expande/recolhe)",
    /name: "Processos Judiciais"[\s\S]{0,300}isNestedDropdown: true/.test(sidebar),
  );
  check(
    "itens Novo Processo, Realizar Bloqueio e Dashboard",
    /nestedItems: \[[\s\S]{0,600}name: "Novo Processo"[\s\S]{0,300}name: "Realizar Bloqueio"[\s\S]{0,300}name: "Dashboard"/.test(sidebar),
  );
  check(
    "grupo abre sozinho quando a rota ativa pertence a ele",
    /rotaPertenceAoItem\(pathname, item\)/.test(sidebar) && /const estaAberto = \(item\)/.test(sidebar),
  );
  check(
    "fechar de propósito é respeitado (gruposFechados)",
    /gruposFechados/.test(sidebar),
  );
  check(
    "nada de setState dentro de useEffect (lint limpo)",
    !/useEffect\(\(\) => \{\s*setOpenGroup/.test(sidebar),
  );

  // ── 2/3. Novo Processo e as duas abas ──────────────────────────────────
  console.log("\n2-3. Novo Processo e as duas abas");
  const pg = await pagina("/camara-tecnica/processos", GESTOR);
  check("Novo Processo abre (200)", pg.status === 200, String(pg.status));
  const paginaProcessos = ler("src/app/camara-tecnica/processos/ProcessosJudiciaisPage.js");
  check(
    "página tem exatamente as abas Consultar Processos e Novo Processo",
    /Consultar Processos/.test(paginaProcessos) && /Novo Processo/.test(paginaProcessos),
  );
  check(
    "não há uma terceira aba",
    (paginaProcessos.match(/className=\{aba === "[a-z]+" \? styles\.abaAtiva : styles\.aba\}/g) || []).length === 2,
  );

  // ── 4-7. Consulta, cadastro, edição e exclusão ─────────────────────────
  console.log("\n4-7. Consulta, cadastro, edição e exclusão");
  const esp = await cat(GESTOR, "criarEspecialidadeProcesso", [{ nome: "TSTSB Especialidade" }]);
  check("catálogo aceita especialidade", esp.success === true, esp.error);
  const pro = await cat(GESTOR, "criarProcedimentoProcesso", [
    { nome: "TSTSB Procedimento", especialidadeIds: [esp.data.id] },
  ]);
  check("catálogo aceita procedimento", pro.success === true, pro.error);

  const pessoa = (
    await db.query("SELECT cpf, nome_completo FROM pessoa WHERE ativo = true ORDER BY cpf LIMIT 1")
  ).rows[0];

  const criado = await proc(GESTOR, "criarProcesso", [
    {
      numeroProcesso: "TSTSB-0001",
      numeroPasta: "P-TSTSB-1",
      pacienteCpf: pessoa.cpf,
      especialidadeId: esp.data.id,
      procedimentoId: pro.data.id,
      observacoes: "registro de teste",
    },
  ]);
  check("cadastro de processo", criado.success === true, JSON.stringify(criado).slice(0, 160));
  const id = criado.data?.id;

  const lista = await proc(GESTOR, "listarProcessos", [{ termo: "TSTSB-0001" }]);
  check(
    "consulta encontra o processo",
    lista.success === true && lista.data.some((p) => p.id === id),
  );

  const editado = await proc(GESTOR, "editarProcesso", [
    id,
    {
      numeroProcesso: "TSTSB-0001",
      numeroPasta: "P-TSTSB-2",
      pacienteCpf: pessoa.cpf,
      especialidadeId: esp.data.id,
      procedimentoId: pro.data.id,
    },
  ]);
  check("edição do processo", editado.success === true, JSON.stringify(editado).slice(0, 160));

  const dependencias = await proc(GESTOR, "verificarDependenciasProcesso", [id]);
  check(
    "verificação de dependências responde antes de excluir",
    dependencias.success === true && dependencias.data?.podeExcluir === true,
  );

  const semConfirmar = await proc(GESTOR, "excluirProcesso", [id, { confirmado: false }]);
  check("exclusão sem confirmação é recusada", semConfirmar.success === false);

  const excluido = await proc(GESTOR, "excluirProcesso", [id, { confirmado: true }]);
  check("exclusão autorizada", excluido.success === true, JSON.stringify(excluido).slice(0, 160));
  const depois = await proc(GESTOR, "listarProcessos", [{ termo: "TSTSB-0001" }]);
  check("processo não aparece mais na lista", depois.success === true && !depois.data.some((p) => p.id === id));

  // ── 8. Catálogo fora da navegação operacional ──────────────────────────
  console.log("\n8. Especialidades fora da tela operacional");
  check(
    "link do catálogo removido da página de Processos",
    !/processos\/especialidades/.test(paginaProcessos),
  );
  check(
    "tela operacional não renderiza o catálogo",
    !/CatalogoProcessosPage/.test(paginaProcessos),
  );
  const processosRender = await pagina("/camara-tecnica/processos", GESTOR);
  check(
    "HTML de Processos não traz o link de Especialidades",
    !/Especialidades e Procedimentos<\/a>/.test(processosRender.corpo),
  );

  // ── 9. Catálogo pelo Gerenciamento ─────────────────────────────────────
  console.log("\n9. Catálogo pelo Gerenciamento");
  const catPg = await pagina("/gerenciamento/especialidades-procedimentos", GESTOR);
  check("Gerenciamento → Especialidades e Procedimentos abre (200)", catPg.status === 200, String(catPg.status));
  check(
    "menu Gerenciamento contém o item",
    /name: "Especialidades e Procedimentos"/.test(sidebar) &&
      /path: "\/gerenciamento\/especialidades-procedimentos"/.test(sidebar),
  );
  check(
    "rota antiga redireciona (compatibilidade)",
    /redirect\("\/gerenciamento\/especialidades-procedimentos"\)/.test(
      ler("src/app/camara-tecnica/processos/especialidades/page.js"),
    ),
  );
  const antiga = await pagina("/camara-tecnica/processos/especialidades", GESTOR);
  check(
    "rota antiga responde com redirect",
    antiga.status === 307 || antiga.status === 308,
    String(antiga.status),
  );

  // ── 10. Cadastro e edição no catálogo ──────────────────────────────────
  console.log("\n10. Cadastro e edição no catálogo");
  const ed = await cat(GESTOR, "editarEspecialidadeProcesso", [
    esp.data.id,
    { nome: "TSTSB Especialidade Editada" },
  ]);
  check("edição de especialidade", ed.success === true, ed.error);
  const inativada = await cat(GESTOR, "alterarSituacaoEspecialidadeProcesso", [esp.data.id, { ativo: false }]);
  check("inativação de especialidade", inativada.success === true, inativada.error);
  const reativada = await cat(GESTOR, "alterarSituacaoEspecialidadeProcesso", [esp.data.id, { ativo: true }]);
  check("reativação de especialidade", reativada.success === true, reativada.error);
  const vinculo = await cat(GESTOR, "definirProcedimentosDaEspecialidade", [esp.data.id, { procedimentoIds: [pro.data.id] }]);
  check("vínculo procedimento ↔ especialidade", vinculo.success === true, vinculo.error);

  // ── 11. Permissões do catálogo ─────────────────────────────────────────
  console.log("\n11. Permissões do catálogo");
  const semModulo = await cat(JEFINNY, "listarCatalogoProcessos", []);
  check("sem vínculo com PROCESSOS: catálogo negado", semModulo.success === false, JSON.stringify(semModulo).slice(0, 120));
  const ccz = await cat(CCZ, "criarEspecialidadeProcesso", [{ nome: "TSTSB Proibida" }]);
  check("outro módulo não cria especialidade", ccz.success === false);
  const pgNegada = await pagina("/gerenciamento/especialidades-procedimentos", JEFINNY);
  check(
    "Gerenciamento NÃO concede o catálogo (proxy/página negam)",
    pgNegada.status === 403 ||
      /Acesso negado|AcessoNegado|sem permiss/i.test(pgNegada.corpo),
    String(pgNegada.status),
  );

  // ── 12. Proteção de rotas ──────────────────────────────────────────────
  console.log("\n12. Proteção de rotas");
  const bloqueio = await pagina("/camara-tecnica/processos/bloqueio", GESTOR);
  check("Realizar Bloqueio abre (200) para quem tem PROCESSOS", bloqueio.status === 200, String(bloqueio.status));
  check("Realizar Bloqueio não oferece operação fictícia", !/<form/i.test(bloqueio.corpo));
  const dash = await pagina("/camara-tecnica/processos/dashboard", GESTOR);
  check("Dashboard abre (200)", dash.status === 200, String(dash.status));
  const adm = await pagina("/camara-tecnica/processos-administrativos", GESTOR);
  check("Processos Administrativos abre (200)", adm.status === 200, String(adm.status));

  const semSessao = await pagina("/camara-tecnica/processos/bloqueio", null);
  check("sem sessão: redireciona para login", semSessao.status === 307 || semSessao.status === 308, String(semSessao.status));

  const negadoJefinny = await pagina("/camara-tecnica/processos/bloqueio", JEFINNY);
  check(
    "sem vínculo com PROCESSOS: acesso negado",
    negadoJefinny.status === 403 ||
      /Acesso negado|AcessoNegado|sem permiss/i.test(negadoJefinny.corpo),
    String(negadoJefinny.status),
  );

  const mapa = ler("src/lib/mapaRotasModulos.js");
  check(
    "proxy mapeia as novas rotas para PROCESSOS",
    /\/camara-tecnica\/processos-administrativos", modulo: MODULOS.PROCESSOS/.test(mapa) &&
      /\/gerenciamento\/especialidades-procedimentos",[\s\S]{0,80}modulo: MODULOS.PROCESSOS/.test(mapa),
  );

  // ── 13. Mobile ─────────────────────────────────────────────────────────
  console.log("\n13. Navegação mobile");
  const css = ler("src/components/Sidebar.module.css");
  check("há breakpoint mobile na Sidebar", /@media[^{]*max-width:\s*768px/.test(css));
  check(
    "clique em item fecha a sidebar no mobile",
    /window\.innerWidth <= 768/.test(sidebar) && /onClose\(\)/.test(sidebar),
  );
  check(
    "submenu aninhado tem estilo próprio (rolagem/indentação)",
    /\.nestedMenuList/.test(css) && /\.nestedBtn/.test(css),
  );

  // ── 14. Sem links duplicados ou quebrados ──────────────────────────────
  console.log("\n14. Links da Sidebar");
  const rotas = [...sidebar.matchAll(/path: "(\/[^"]*)"/g)].map((m) => m[1]);
  const repetidas = rotas.filter((r, i) => rotas.indexOf(r) !== i);
  // Única repetição aceita: o path do GRUPO Processos Judiciais é o mesmo do
  // item "Novo Processo" (o grupo navega para a página já existente).
  const repeticaoAceita = repetidas.every((r) => r === "/camara-tecnica/processos");
  check(
    "nenhuma rota duplicada na Sidebar (exceto grupo→Novo Processo)",
    repetidas.length === 0 || repeticaoAceita,
    repetidas.join(", "),
  );
  // Nomes que legitimamente aparecem em mais de um módulo (mesmo rótulo,
  // destinos diferentes). O que não pode existir é item duplicado no MESMO
  // grupo — isso é o que gera confusão na navegação.
  const ROTULOS_POR_MODULO = new Set([
    "Dashboard",
    "separator",
    "Novo Processo",
    "Novo Pedido",
    "Procedimentos",
  ]);
  const linksRepetidos = [...sidebar.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
  const nomesRepetidos = linksRepetidos.filter(
    (n, i) => linksRepetidos.indexOf(n) !== i && !ROTULOS_POR_MODULO.has(n),
  );
  check(
    "nenhum item de menu repetido (fora rótulos por módulo)",
    nomesRepetidos.length === 0,
    nomesRepetidos.join(", "),
  );

  const comArquivo = new Set();
  const SEM_PAGINA = new Set(["/admin/gerenciamento"]); // path do grupo, não navega
  for (const rota of new Set(rotas)) {
    const base = rota.split("?")[0];
    if (comArquivo.has(base) || SEM_PAGINA.has(base)) continue;
    comArquivo.add(base);
    const candidatos = [
      `src/app${base}/page.js`,
      `src/app${base}/page.jsx`,
      `src/app${base === "/" ? "" : base}/page.js`,
    ];
    const existe = candidatos.some((p) => fs.existsSync(p));
    check(`rota da Sidebar existe: ${base}`, existe);
  }

  // ── Limpeza ────────────────────────────────────────────────────────────
  await db.query("DELETE FROM processos_especialidade_procedimento WHERE especialidade_id = $1", [esp.data.id]);
  await db.query("DELETE FROM processos_procedimentos WHERE id = $1", [pro.data.id]);
  await db.query("DELETE FROM processos_especialidades WHERE id = $1", [esp.data.id]);
  await db.query("DELETE FROM user_sessions WHERE token = ANY($1::text[])", [[...sessoes.values()]]);
  await db.end();

  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log("Falhas:\n - " + falhas.join("\n - "));
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
