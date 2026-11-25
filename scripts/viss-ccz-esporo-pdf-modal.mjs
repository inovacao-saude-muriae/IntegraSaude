import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/ccz-esporo-pdf-modal`;
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const passo = (t) => { log.push(`\n${t}`); console.log(t); };
let ok = 0, falhas = 0;
const marcar = (nome, cond, extra = "") => {
  if (cond) { ok++; console.log(`OK   ${nome}${extra ? ` (${extra})` : ""}`); }
  else { falhas++; console.log(`FALHA ${nome}${extra ? ` (${extra})` : ""}`); }
};

function envLocal() {
  const e = {};
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
    if (m) e[m[1]] = m[2];
  }
  return e;
}
const env = envLocal();
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const fecharOverlay = async () => {
  for (let i = 0; i < 4; i++) {
    const clicou = await page.evaluate(() => {
      const alvos = [...document.querySelectorAll('[class*="_overlay"] button, [role="alertdialog"] button')];
      const alvo = alvos.find((b) => /OK|Fechar|Entendi|Confirmar|Cadastrar/i.test(b.innerText));
      if (alvo) { alvo.click(); return true; }
      return false;
    });
    if (clicou) { await page.waitForTimeout(500); return; }
    await page.waitForTimeout(300);
  }
};

passo("1. PDF da Esporotricose no padrão do Histórico do Animal");
await page.goto("http://localhost:3000/ccz?tab=ESPOROTRICOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" }).first().click();
await page.waitForTimeout(900);
await page.locator('[class*="_cardFiltros"] button[type="submit"]').click();
await page.waitForTimeout(1600);
await page.locator("tbody tr").first().click();
await page.waitForTimeout(1400);
const [dlEsp] = await Promise.all([
  page.waitForEvent("download"),
  page.locator('[class*="_acoesDetalhe"] button', { hasText: "Gerar PDF" }).first().click(),
]);
const pdfEsporo = `${OUT}/ficha-esporotricose.pdf`;
await dlEsp.saveAs(pdfEsporo);
marcar("PDF de esporotricose gerado", fs.statSync(pdfEsporo).size > 10000, `${Math.round(fs.statSync(pdfEsporo).size / 1024)} KB`);

passo("2. Ficha do Animal e Histórico de Atendimento");
await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" }).first().click();
await page.waitForTimeout(900);
await page.locator('[class*="_cardFiltros"] button[type="submit"]').click();
await page.waitForTimeout(1600);
await page.locator("button", { hasText: "Luna" }).first().click({ force: true });
await page.waitForTimeout(2000);
const ficha = page.locator('[class*="_ficha"]').first();
marcar("Ficha do Animal abre", await ficha.count() === 1);
const corpoFicha = page.locator('[class*="_fichaCorpo"]').first();
// O Playwright rola o container até o item antes de clicar (scrollIntoView);
// fixamos uma posição que mantenha o item do histórico visível.
await corpoFicha.evaluate((el) => { el.scrollTop = 430; });
await page.waitForTimeout(700);
const rolagemAntes = await corpoFicha.evaluate((el) => el.scrollTop);
await page.screenshot({ path: `${OUT}/1-ficha-animal-1440.png` });

passo("3. Modal de detalhe abaixo do header");
// O clique é feito com o mouse sobre o item: assim o Playwright não rola o
// container (scrollIntoView) e a posição da ficha é a definida acima.
const boxItem = await page.locator('[class*="_itemHistorico"]').first().boundingBox();
await page.mouse.click(boxItem.x + 40, boxItem.y + boxItem.height / 2);
await page.waitForTimeout(900);
const detalhe = page.locator('[class*="_detalhe"]').first();
marcar("modal de atendimento abre", await detalhe.count() === 1);
const geo = await page.evaluate(() => {
  const overlay = document.querySelector('[class*="_detalheFundo"]');
  const modal = document.querySelector('[class*="_detalhe"]');
  const topo = document.querySelector('[class*="_detalheTopo"]');
  const corpo = document.querySelector('[class*="_detalheCorpo"]');
  const r = modal.getBoundingClientRect();
  const rt = topo.getBoundingClientRect();
  const rc = corpo.getBoundingClientRect();
  return {
    overlayTop: overlay.getBoundingClientRect().top,
    modalTop: r.top, modalBottom: r.bottom, modalHeight: r.height,
    topoTop: rt.top, topoBottom: rt.bottom,
    corpoAltura: rc.height, corpoScroll: corpo.scrollHeight, corpoVisivel: corpo.clientHeight,
    header: document.querySelector("header")?.getBoundingClientRect().bottom ?? 60,
    viewport: window.innerHeight,
    zOverlay: getComputedStyle(overlay).zIndex,
    zHeader: getComputedStyle(document.querySelector("header")).zIndex,
  };
});
marcar("overlay começa abaixo do header", geo.overlayTop >= geo.header - 1, `overlay=${geo.overlayTop} header=${geo.header}`);
marcar("modal totalmente visível na tela", geo.modalTop >= geo.header && geo.modalBottom <= geo.viewport + 1,
  `top=${Math.round(geo.modalTop)} bottom=${Math.round(geo.modalBottom)} vh=${geo.viewport}`);
marcar("título do modal visível", geo.topoTop >= geo.header, `topoTop=${Math.round(geo.topoTop)}`);
const btnFechar = page.locator('[class*="_btnFechar"]').first();
marcar("botão Fechar visível na tela", await btnFechar.isVisible());
const rolaInterno = await page.evaluate(() => {
  const corpo = document.querySelector('[class*="_detalheCorpo"]');
  const antes = corpo.scrollTop;
  corpo.scrollTop = 60;
  const depois = corpo.scrollTop;
  corpo.scrollTop = antes;
  return { overflowY: getComputedStyle(corpo).overflowY, rolou: depois > antes,
    scrollHeight: corpo.scrollHeight, clientHeight: corpo.clientHeight };
});
marcar("corpo do modal tem rolagem própria (overflow-y auto)",
  rolaInterno.overflowY === "auto" && (rolaInterno.rolou || rolaInterno.scrollHeight <= rolaInterno.clientHeight),
  `overflow=${rolaInterno.overflowY} rolou=${rolaInterno.rolou} ${rolaInterno.scrollHeight}/${rolaInterno.clientHeight}`);
await page.screenshot({ path: `${OUT}/2-modal-atendimento-1440.png` });

passo("4. Fechar o modal mantém a ficha e a rolagem");
await page.locator('[class*="_detalheTopo"] button').first().click({ force: true });
await page.waitForTimeout(800);
marcar("modal fecha", await page.locator('[class*="_detalheFundo"]').count() === 0);
const fichaAberta = await page.evaluate(() => {
  const el = document.querySelector('[class*="_ficha"]');
  if (!el) return { existe: false };
  const r = el.getBoundingClientRect();
  return { existe: true, visivel: r.width > 0 && r.height > 0, titulo: (el.innerText || "").split("\n")[0] };
});
marcar("Ficha do Animal continua aberta", fichaAberta.existe && fichaAberta.visivel, fichaAberta.titulo || "");
await page.waitForTimeout(700);
const rolagemDepois = await page.locator('[class*="_fichaCorpo"]').first().evaluate((el) => el.scrollTop);
marcar("rolagem da ficha preservada", Math.abs(rolagemDepois - rolagemAntes) <= 2, `${rolagemAntes} → ${rolagemDepois}`);

passo("5. Outros tipos de atendimento");
const tipos = await page.locator('[class*="_itemHistorico"]').allInnerTexts();
const rotulos = [...new Set(tipos.map((t) => t.split("\n")[0].trim()))];
for (const rotulo of rotulos.slice(0, 4)) {
  await page.locator('[class*="_itemHistorico"]', { hasText: rotulo }).first().click({ force: true });
  await page.waitForTimeout(700);
  const g = await page.evaluate(() => {
    const m = document.querySelector('[class*="_detalhe"]');
    const h = document.querySelector("header").getBoundingClientRect().bottom;
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, header: h, vh: window.innerHeight };
  });
  marcar(`modal "${rotulo}" abaixo do header`, Boolean(g) && g.top >= g.header - 1 && g.bottom <= g.vh + 1,
    g ? `top=${Math.round(g.top)}` : "sem modal");
  await page.locator('[class*="_detalheTopo"] button').first().click({ force: true });
  await page.waitForTimeout(500);
}

passo("6. Mobile 390px");
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(600);
await page.locator('[class*="_itemHistorico"]').first().click({ force: true });
await page.waitForTimeout(900);
const gm = await page.evaluate(() => {
  const m = document.querySelector('[class*="_detalhe"]');
  const h = document.querySelector("header").getBoundingClientRect().bottom;
  const r = m.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, header: h, vh: window.innerHeight,
    scrollW: document.documentElement.scrollWidth, w: window.innerWidth };
});
marcar("mobile: modal abaixo do header e inteiro na tela", gm.top >= gm.header - 1 && gm.bottom <= gm.vh + 1,
  `top=${Math.round(gm.top)} bottom=${Math.round(gm.bottom)}`);
marcar("mobile: sem overflow horizontal", gm.scrollW <= gm.w + 1, `${gm.scrollW}/${gm.w}`);
await page.screenshot({ path: `${OUT}/3-modal-mobile-390.png` });
await page.locator('[class*="_detalheTopo"] button').first().click({ force: true });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/4-ficha-mobile-390.png` });

passo("7. Console");
marcar("console limpo", erros.length === 0, erros.slice(0, 2).join(" | "));

await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
await browser.close();
await db.end();
fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n"));
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
