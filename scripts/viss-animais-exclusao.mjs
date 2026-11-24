/**
 * Validação visual/funcional de CCZ > Animais:
 *  1-2. Ficha do Animal abaixo do header, rolagem interna.
 *  3. Botões Filtrar / Limpar filtros na última linha, à direita.
 *  4-5. Busca de animal existente; botões Editar e Excluir Animal.
 *  6-7. Exclusão bloqueada com vínculos e permitida sem vínculos (com confirmação).
 *  8-10. Listagem atualizada, auditoria registrada e histórico preservado.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { chromium } from "playwright";
import { SignJWT } from "jose";

function envLocal() {
  const e = {};
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
    if (m) e[m[1]] = m[2];
  }
  return e;
}

const env = envLocal();
const OUT = path.join(process.env.TEMP, "animais-exclusao");
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const marcar = (t) => {
  log.push(t);
  fs.writeFileSync(path.join(OUT, "relatorio.txt"), log.join("\n"));
};

const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

const user = (await db.query("SELECT cpf, nome FROM users WHERE cpf = '00000000000'")).rows[0];
const token = await new SignJWT({ userId: user.cpf, nome: user.nome })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id, user_id, token, expires_at, created_at) VALUES (gen_random_uuid(), $1, $2, now() + interval '2 hours', now())",
  [user.cpf, token],
);

// ── Fixtures ────────────────────────────────────────────────────────────────
// Animal SEM vínculo (pode ser excluído) e animal COM vínculo (bloqueado).
const idLivre = "ZZDEL-LIVRE";
const idVinculado = "ZZDEL-VINC";
await db.query("DELETE FROM public.ccz_animais WHERE id = ANY($1)", [[idLivre, idVinculado]]);
await db.query(
  `INSERT INTO public.ccz_animais (id, nome, especie, sexo, porte, idade, situacao, data_cadastro)
   VALUES ($1, 'ZZTESTE Exclusao Livre', 'Canina', 'M', 'Médio', '1 ano', 'CCZ', now()),
          ($2, 'ZZTESTE Exclusao Vinculado', 'Canina', 'F', 'Médio', '3 anos', 'CCZ', now())`,
  [idLivre, idVinculado],
);
await db.query(
  `INSERT INTO public.ccz_procedimentos (id, animal_id, tipo, data_procedimento, status)
   VALUES ('ZZDEL-PROC-1', $1, 'Vacinação', CURRENT_DATE, 'Realizado')`,
  [idVinculado],
);
marcar(`Fixtures: ${idLivre} (sem vínculo) e ${idVinculado} (1 procedimento)`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
page.on("pageerror", (e) => erros.push(String(e)));

await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Consultar Registros/ }).click({ force: true });
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Filtrar/ }).click({ force: true });
await page.waitForTimeout(1800);

// ── 3. Botões de filtro na última linha, à direita ─────────────────────────
const pos = await page.evaluate(() => {
  const card = document.querySelector('[class*="_cardFiltros"]');
  const acoes = card?.querySelector('[class*="_filtrosAcoes"]');
  const botoes = acoes ? [...acoes.querySelectorAll("button")] : [];
  const periodo = card?.querySelector('[class*="_colPeriodo"]');
  const campos = [...card.querySelectorAll('[class*="_fieldGroup"]')];
  const r = (el) => el.getBoundingClientRect();
  return {
    card: r(card),
    acoes: r(acoes),
    periodo: periodo ? r(periodo) : null,
    ultimoCampoTopo: Math.min(...campos.map((c) => r(c).top)),
    acoesTopo: r(acoes).top,
    acoesDireita: Math.round(r(card).right - r(botoes[botoes.length - 1]).right),
    ultimaLinhaCampos: Math.max(...campos.map((c) => Math.round(r(c).bottom))),
  };
});
marcar(`3. Botões de filtro`);
marcar(`   ações abaixo dos campos: ${pos.acoesTopo >= pos.ultimaLinhaCampos - 4}`);
marcar(`   alinhados à direita (distância da borda direita): ${pos.acoesDireita}px`);
marcar(`   botões: ${await page.locator('[class*="_filtrosAcoes"] button').allInnerTexts()}`);
await page.screenshot({ path: path.join(OUT, "1-filtros-1440.png") });

// ── 1-2. Ficha abaixo do header, rolagem interna ───────────────────────────
await page.locator('[class*="_card"]').filter({ hasText: "Joaquim" }).first().click();
await page.waitForTimeout(2200);
const ficha = await page.evaluate(() => {
  const fundo = document.querySelector('[class*="_fichaFundo"]');
  const caixa = fundo?.querySelector('[class*="_ficha"]');
  const topo = fundo?.querySelector('[class*="_fichaTopo"]');
  const corpo = fundo?.querySelector('[class*="_fichaCorpo"]');
  const header = document.querySelector("header") || document.querySelector('[class*="header"]');
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  return {
    fundoTop: Math.round(r(fundo).top),
    headerBottom: Math.round(r(header).bottom),
    caixaTop: Math.round(r(caixa).top),
    caixaBottom: Math.round(r(caixa).bottom),
    viewportH: window.innerHeight,
    topoVisivel: r(topo).top >= r(header).bottom - 1,
    titulo: topo?.querySelector("h3, h4, [class*='Titulo']")?.textContent?.trim() || "",
    botoes: [...topo.querySelectorAll("button")].map((b) => b.textContent.trim()),
    corpoScroll: corpo.scrollHeight > corpo.clientHeight,
    corpoOverflow: getComputedStyle(corpo).overflowY,
    corpoMaxH: getComputedStyle(corpo).maxHeight,
    corpoAltura: Math.round(r(corpo).height),
  };
});
marcar(`1. Ficha`);
marcar(`   fundo.top=${ficha.fundoTop}px / header.bottom=${ficha.headerBottom}px`);
marcar(`   ficha começa abaixo do header: ${ficha.caixaTop >= ficha.headerBottom}`);
marcar(`   topo (título e botões) visível: ${ficha.topoVisivel}`);
marcar(`   título: "${ficha.titulo}" | botões: ${ficha.botoes.join(" / ")}`);
marcar(`2. Rolagem`);
marcar(`   overflow-y: ${ficha.corpoOverflow} | altura do corpo: ${ficha.corpoAltura}px | tem rolagem: ${ficha.corpoScroll}`);
marcar(`   ficha dentro da tela: ${ficha.caixaBottom <= ficha.viewportH + 1}`);
await page.screenshot({ path: path.join(OUT, "2-ficha-1440.png") });

await page.evaluate(() => {
  const c = document.querySelector('[class*="_fichaCorpo"]');
  c.scrollTop = c.scrollHeight;
});
await page.waitForTimeout(600);
const rolou = await page.evaluate(() => document.querySelector('[class*="_fichaCorpo"]').scrollTop > 0);
marcar(`   rolagem interna funciona: ${rolou}`);
await page.screenshot({ path: path.join(OUT, "3-ficha-rolada-1440.png") });
await page.getByRole("button", { name: /Fechar ficha/i }).click().catch(async () => {
  await page.locator('[class*="_fichaTopoAcoes"] button').last().click();
});
await page.waitForTimeout(600);

// ── 4-5. Busca de animal existente e botões Editar / Excluir Animal ────────
await page.getByRole("button", { name: /Novo Registro/ }).click();
await page.waitForTimeout(800);
await page.locator('input[placeholder*="Buscar" i]').first().fill("ZZDEL-VINC");
await page.waitForTimeout(1500);
const linha = page.locator("tbody tr").filter({ hasText: "ZZDEL-VINC" }).first();
marcar(`4. Busca de animal existente: ${await linha.count()} linha(s) para ZZDEL-VINC`);
await linha.click();
await page.waitForTimeout(1500);
const botoes = await page.locator("form button").allInnerTexts();
marcar(`5. Botões do formulário: ${JSON.stringify(botoes.map((b) => b.trim()).filter(Boolean))}`);
marcar(`   Excluir Animal presente: ${botoes.some((b) => /Excluir Animal/.test(b))}`);
await page.screenshot({ path: path.join(OUT, "4-animal-selecionado-1440.png") });

// ── 6. Exclusão bloqueada (animal com procedimento) ────────────────────────
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Excluir Animal/ }).click();
await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 8000 });
await page.locator('[role="dialog"] button', { hasText: /^Excluir$/ }).first().click();
await page.waitForTimeout(2500);
const dialogoErro = await page.evaluate(() => {
  const d = document.querySelector('[role="alertdialog"]');
  return d ? d.innerText : "";
});
marcar(`   diálogo após a tentativa: ${JSON.stringify(dialogoErro.replace(/\s+/g, " ").slice(0, 200))}`);
const msgBloqueio = dialogoErro || (await page.locator("body").innerText()).slice(0, 0);
marcar(`6. Exclusão bloqueada: ${/Não é possível excluir/.test(msgBloqueio)}`);
marcar(`   mensagem: ${msgBloqueio.replace(/\s+/g, " ").slice(0, 180)}`);
await page.screenshot({ path: path.join(OUT, "5-exclusao-bloqueada-1440.png") });
await page.evaluate(() => {
  const d = document.querySelector('[role="alertdialog"]');
  const b = d && d.querySelectorAll("button");
  if (b && b.length) b[b.length - 1].click();
});
await page.waitForTimeout(1200);
const aindaExiste = (await db.query("SELECT 1 FROM public.ccz_animais WHERE id = $1", [idVinculado])).rowCount === 1;
const procPreservado = (await db.query("SELECT 1 FROM public.ccz_procedimentos WHERE id = 'ZZDEL-PROC-1'")).rowCount === 1;
marcar(`   animal preservado: ${aindaExiste} | procedimento preservado: ${procPreservado}`);

// ── 7-8. Exclusão permitida (animal sem vínculo) ───────────────────────────
await page.locator('input[placeholder*="Buscar" i]').first().fill("ZZDEL-LIVRE");
await page.waitForTimeout(1500);
const linhaLivre = page.locator("tbody tr").filter({ hasText: "ZZDEL-LIVRE" }).first();
await linhaLivre.click();
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Excluir Animal/ }).click();
await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 8000 });
await page.waitForTimeout(400);
const textoConfirm = await page.locator('[role="dialog"]').first().innerText();
marcar(`7. Confirmação exibe nome e ID: ${/ZZTESTE Exclusao Livre/.test(textoConfirm) && /ZZDEL-LIVRE/.test(textoConfirm)}`);
await page.screenshot({ path: path.join(OUT, "6-confirmacao-1440.png") });
await page.locator('[role="dialog"] button', { hasText: /^Excluir$/ }).first().click();
await page.waitForTimeout(2200);
const removido = (await db.query("SELECT 1 FROM public.ccz_animais WHERE id = $1", [idLivre])).rowCount === 0;
marcar(`   animal excluído no banco: ${removido}`);
await page.evaluate(() => {
  const d = document.querySelector('[role="alertdialog"]');
  const b = d && d.querySelectorAll("button");
  if (b && b.length) b[b.length - 1].click();
});
await page.waitForTimeout(1200);
const audit = await db.query(
  "SELECT acao, entidade, entidade_id FROM public.audit_logs WHERE entidade_id = $1 AND acao = 'EXCLUIR' ORDER BY id DESC LIMIT 1",
  [idLivre],
);
marcar(`9. Auditoria EXCLUIR registrada: ${audit.rowCount === 1}${audit.rowCount ? ` (${audit.rows[0].entidade} ${audit.rows[0].entidade_id})` : ""}`);

// ── 8. Listagem atualizada ────────────────────────────────────────────────
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const textoGaleria = await page.locator('[class*="_galeria"]').innerText();
marcar(`8. Listagem atualizada: livre sumiu=${!textoGaleria.includes("ZZDEL-LIVRE")} | vinculado permanece=${textoGaleria.includes("ZZDEL-VINC")}`);
await page.screenshot({ path: path.join(OUT, "7-listagem-atualizada-1440.png") });

// ── 10. Integridade referencial ────────────────────────────────────────────
const orfaos = await db.query(
  `SELECT (SELECT COUNT(*) FROM public.ccz_procedimentos p LEFT JOIN public.ccz_animais a ON a.id = p.animal_id WHERE a.id IS NULL)::int AS proc,
          (SELECT COUNT(*) FROM public.ccz_esporotricose e LEFT JOIN public.ccz_animais a ON a.id = e.animal_id WHERE a.id IS NULL)::int AS esporo,
          (SELECT COUNT(*) FROM public.ccz_leishmaniose l LEFT JOIN public.ccz_animais a ON a.id = l.animal_id WHERE a.id IS NULL)::int AS leish`,
);
marcar(`10. Órfãos: ${JSON.stringify(orfaos.rows[0])}`);

// ── Mobile ────────────────────────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(900);
await page.locator('[class*="_card"]').filter({ hasText: "Joaquim" }).first().click();
await page.waitForTimeout(1800);
const mob = await page.evaluate(() => {
  const fundo = document.querySelector('[class*="_fichaFundo"]');
  const topo = fundo?.querySelector('[class*="_fichaTopo"]');
  const corpo = fundo?.querySelector('[class*="_fichaCorpo"]');
  const header = document.querySelector("header");
  return {
    topoVisivel: topo.getBoundingClientRect().top >= header.getBoundingClientRect().bottom - 1,
    semOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    rolagemInterna: corpo.scrollHeight > corpo.clientHeight,
  };
});
marcar(`11. Mobile 390px: topo visível=${mob.topoVisivel} | sem overflow=${mob.semOverflow} | rolagem interna=${mob.rolagemInterna}`);
await page.screenshot({ path: path.join(OUT, "8-mobile-390.png") });

marcar(`Erros de console/página: ${erros.length}`);
if (erros.length) marcar(erros.slice(0, 5).map((e) => `   ${e}`).join("\n"));

// limpeza das fixtures remanescentes
await db.query("DELETE FROM public.ccz_procedimentos WHERE animal_id = ANY($1)", [[idLivre, idVinculado]]);
await db.query("DELETE FROM public.ccz_animais WHERE id = ANY($1)", [[idLivre, idVinculado]]);
await db.end();
await browser.close();

const rel = log.join("\n");
fs.writeFileSync(path.join(OUT, "relatorio.txt"), rel);
console.log(rel);
