// CCZ > Animais > Ficha do Animal > Histórico de Atendimento
// Situação e desfecho do acompanhamento (Leishmaniose e Esporotricose) na lista
// cronológica, no detalhe do atendimento e no PDF da Ficha Completa do Animal.
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/ccz-historico-encerramento`;
fs.mkdirSync(OUT, { recursive: true });
let ok = 0, falhas = 0;
const log = [];
const passo = (t) => { log.push(`\n${t}`); console.log(t); };
const marcar = (nome, cond, extra = "") => {
  console.log(`  -> ${nome}: ${cond} [${extra}]`);
  if (cond) { ok++; console.log(`OK   ${nome}${extra ? ` (${extra})` : ""}`); }
  else { falhas++; console.log(`FALHA ${nome}${extra ? ` (${extra})` : ""}`); }
};

const e = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) e[m[1]] = m[2];
}
const db = new Client({ connectionString: e.DATABASE_URL });
await db.connect();
const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(e.JWT_SECRET));
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
page.on("pageerror", (x) => erros.push("pageerror: " + x.message));

const fecharFicha = async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[class*="_fichaTopo"] button')].find((x) =>
      (x.getAttribute("aria-label") || "").toLowerCase().includes("fechar"),
    );
    if (b) b.click();
  });
  await page.waitForTimeout(500);
};

const abrirFicha = async (termo) => {
  await fecharFicha();
  await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  // Passo 1: aba de consulta.
  await page.locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  // Passo 2: consultar (a tabela só carrega após Filtrar).
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page.waitForTimeout(2400);
  // Passo 3: abrir o card do animal.
  const abriu = await page.evaluate((t) => {
    const card = [...document.querySelectorAll('[class*="_card"]')].find((el) => el.innerText.includes(t));
    if (!card) return false;
    card.click();
    return true;
  }, termo);
  await page.waitForTimeout(2600);
  await esperarHistorico();
  const ficha = await page.locator('[class*="_ficha"]').first().innerText().catch(() => "");
  marcar(`ficha de "${termo}" aberta`, abriu && ficha.includes(termo), ficha.slice(0, 60).replace(/\n/g, " | "));
};

const fichaAtual = () => page.locator('[class*="_ficha"]').first().innerText();

const esperarHistorico = async () => {
  await page.waitForFunction(
    () => {
      const corpo = document.querySelector('[class*="_fichaCorpo"]');
      return Boolean(corpo && !/HISTÓRICO DE ATENDIMENTOS\s*$/.test(corpo.innerText));
    },
    { timeout: 15000 },
  ).catch(() => {});
  await page.waitForTimeout(500);
  console.log("   [debug] itens no DOM:", await page.evaluate(() => document.querySelectorAll('[class*="_itemHistorico"]').length),
    "| fim da ficha:", (await page.locator('[class*="_fichaCorpo"]').first().innerText().catch(() => "")).replace(/\n/g, " | ").slice(-160));
};

let ultimoTexto = "";

const lerItens = async () => {
  // Espera o histórico sair do estado "vazio" (o placeholder também casa com _itemHistorico).
  for (let volta = 0; volta < 20; volta++) {
    const st = await page.evaluate(() => ({
      qtd: document.querySelectorAll('[class*="_itemHistorico"]').length,
      corpo: document.querySelector('[class*="_fichaCorpo"]')?.innerText || "",
    }));
    const vazio = /Nenhum registro de acompanhamento/i.test(st.corpo);
    if (st.qtd > 0 && !vazio && st.corpo === ultimoTexto) break;
    ultimoTexto = st.corpo;
    await page.waitForTimeout(400);
  }
  const r = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_itemHistorico"]')].map((el, n) => {
    const badge = el.querySelector('[class*="_situacaoBadge"]');
    return {
      idx: Number((el.id.match(/item-(\d+)$/) || [0, n])[1]),
      texto: el.innerText.replace(/\n/g, " | "),
      situacao: badge ? badge.innerText.trim() : "",
      cor: badge ? getComputedStyle(badge).backgroundColor : "",
    };
  }));
  console.log("   [itens lidos]", JSON.stringify(r.map((x) => [x.idx, x.situacao, x.texto.slice(0, 40)])));
  return r;
};

const clicarItem = async (i) => {
  // Playwright rola o item até a viewport antes de clicar (o corpo da ficha
  // tem rolagem própria), mas a posição é sempre recalculada após o scroll.
  await page.locator(`#item-${i}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator(`#item-${i}`).click();
  await page.waitForSelector('[class*="_detalheCorpo"]', { timeout: 15000 });
  await page.waitForTimeout(700);
};

passo("1. Leishmaniose — Em acompanhamento");
await abrirFicha("ZZTESTE Rex");
let itens = await lerItens();
const leish = itens.filter((i) => i.texto.includes("leishmaniose"));
marcar("histórico tem fiscalização de leishmaniose", leish.length > 0, `${leish.length}`);
const leishEmAndamento = leish.find((i) => /^EM ACOMPANHAMENTO$/i.test(i.situacao));
marcar("badge 'Em acompanhamento' em verde", Boolean(leishEmAndamento) && leishEmAndamento.cor === "rgb(220, 252, 231)",
  leishEmAndamento ? leishEmAndamento.cor : "sem badge");

passo("2. Leishmaniose — Encerrado");
await abrirFicha("ZZTESTE Incineração");
itens = await lerItens();
const encLeish = itens.filter((i) => /^ENCERRADO$/i.test(i.situacao));
marcar("badge 'Encerrado' em vermelho", encLeish.length > 0 && encLeish[0].cor === "rgb(254, 226, 226)",
  encLeish.length ? encLeish[0].cor : "sem badge");
marcar("desfecho aparece junto da situação", encLeish.some((i) => /Incinerado/.test(i.texto)),
  encLeish.map((i) => i.texto.slice(0, 50)).join(" || "));
console.log("   [debug encLeish]", JSON.stringify(encLeish));

passo("3. Detalhe da leishmaniose encerrada");
await clicarItem(encLeish[0].idx);
let det = await page.locator('[class*="_detalheCorpo"]').first().innerText();
console.log("   [debug det]", det.replace(/\n/g, " | ").slice(0, 400));
marcar("Situação do caso", /SITUAÇÃO DO CASO/i.test(det) && /Encerrado/.test(det));
marcar("Desfecho do caso", /DESFECHO DO CASO/i.test(det) && /Incinerado/.test(det));
marcar("Data do encerramento", /DATA DO ENCERRAMENTO/i.test(det));
marcar("Observação / justificativa", /JUSTIFICATIVA DO ENCERRAMENTO/i.test(det));
const posTecnica = det.search(/CONDI[ÇC][ÕO]ES SANIT[ÁA]RIAS|COMPROMETIMENTO DO TUTOR/i);
marcar("conclusão/dados clínicos da visita continuam separados do encerramento",
  posTecnica >= 0 && /SITUA[ÇC][ÃA]O DO CASO/i.test(det),
  `dados clínicos:${posTecnica >= 0 ? "presentes" : "ausentes"}`);
await page.screenshot({ path: `${OUT}/1-detalhe-leish-encerrada-1440.png` });
await page.locator('[class*="_detalheTopo"] button').first().click({ force: true });
await page.waitForTimeout(600);

passo("4. Esporotricose — Encerrado (dados reais do banco)");
const espEnc = (await db.query(
  `SELECT id, desfecho, encerrado_em FROM ccz_esporotricose WHERE encerrado ORDER BY encerrado_em DESC`,
)).rows;
console.log("   banco:", JSON.stringify(espEnc));
await abrirFicha("Joaquim");
itens = await lerItens();
const espVisitas = itens.filter((i) => /Visita de acompanhamento/.test(i.texto));
const espFisc = itens.filter((i) => /esporotricose/i.test(i.texto) && !/Visita/.test(i.texto));
marcar("fiscalização de esporotricose com badge 'Encerrado'",
  espFisc.some((i) => /^ENCERRADO$/i.test(i.situacao)), espFisc.map((i) => i.situacao).join(","));
marcar("visitas não herdam o encerramento posterior",
  espVisitas.length > 0 && espVisitas.every((i) => !i.situacao), `${espVisitas.length} visita(s)`);
marcar("visita informa a fiscalização de origem",
  espVisitas.every((i) => /Fiscalização\s+ESP-[A-Z0-9]+/.test(i.texto)),
  espVisitas.map((i) => i.texto.slice(0, 60)).join(" || "));

const fiscEsp = espFisc.find((i) => /^ENCERRADO$/i.test(i.situacao));
if (fiscEsp) {
  await clicarItem(fiscEsp.idx);
  det = await page.locator('[class*="_detalheCorpo"]').first().innerText();
  marcar("esporotricose: Situação do caso", /SITUAÇÃO DO CASO/i.test(det) && /Encerrado/.test(det));
  marcar("esporotricose: desfecho conforme o banco",
    espEnc[0]?.desfecho ? new RegExp(espEnc[0].desfecho, "i").test(det) : /DESFECHO DO CASO/i.test(det),
    espEnc[0]?.desfecho || "—");
  marcar("esporotricose: data do encerramento", /DATA DO ENCERRAMENTO/i.test(det));
  await page.screenshot({ path: `${OUT}/2-detalhe-esporo-encerrada-1440.png` });
  await page.locator('[class*="_detalheTopo"] button').first().click({ force: true });
  await page.waitForTimeout(600);
} else {
  marcar("esporotricose encerrada no histórico", false, "item não encontrado");
}

passo("5. PDF da Ficha Completa do Animal");
const [dl] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("button", { hasText: "Gerar PDF" }).first().click(),
]);
const pdf = `${OUT}/ficha-completa-animal.pdf`;
await dl.saveAs(pdf);
const tam = fs.statSync(pdf).size;
marcar("PDF gerado", tam > 10000, `${Math.round(tam / 1024)} KB`);
await page.screenshot({ path: `${OUT}/3-historico-com-badges-1440.png` });

passo("6. Mobile 390px");
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(800);
marcar("mobile sem overflow horizontal",
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await page.screenshot({ path: `${OUT}/4-historico-mobile-390.png` });

passo("7. Console");
marcar("console limpo", erros.length === 0, erros.slice(0, 2).join(" | "));

await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
await browser.close();
await db.end();
fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n"));
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
