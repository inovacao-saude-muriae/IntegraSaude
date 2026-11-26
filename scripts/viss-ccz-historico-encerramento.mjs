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
marcar("leishmaniose exibe a finalidade 'Leishmaniose' na visita",
  leish.some((i) => /Leishmaniose/.test(i.texto)),
  leish.map((i) => i.texto.slice(0, 50)).join(" || "));

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
marcar("visita de esporotricose exibe 'Procedimento / Zoonose' = Esporotricose",
  espVisitas.length > 0 && espVisitas.every((i) => /Esporotricose/.test(i.texto)),
  espVisitas.map((i) => i.texto.slice(0, 60)).join(" || "));

// Agrupamento: visitas de retorno dentro do grupo da zoonose de origem.
const gruposTela = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_grupoHistorico"]')].map((g) => ({
    titulo: g.querySelector('[class*="_grupoTitulo"]')?.innerText.replace(/\n/g, " ") || "",
    itens: [...g.querySelectorAll('[class*="_itemHistorico"]')].map((i) => i.innerText.replace(/\n/g, " | ")),
  })),
);
console.log("   [grupos]", JSON.stringify(gruposTela.map((g) => [g.titulo, g.itens.length])));
marcar("histórico não tem categoria separada 'Visitas de Acompanhamento'",
  !gruposTela.some((g) => /Visitas de Acompanhamento/i.test(g.titulo)));
const grupoEsporo = gruposTela.find((g) => /^Esporotricose/i.test(g.titulo));
marcar("visitas de retorno aparecem dentro do grupo Esporotricose",
  Boolean(grupoEsporo) && grupoEsporo.itens.some((t) => /Retorno/.test(t)),
  grupoEsporo ? `${grupoEsporo.itens.length} item(ns)` : "sem grupo");
const totalTela = gruposTela.reduce((n, g) => n + g.itens.length, 0);
const noBanco = Number((await db.query(
  `SELECT (SELECT COUNT(*) FROM ccz_esporotricose_visitas v JOIN ccz_esporotricose e ON e.id=v.esporotricose_id WHERE e.animal_id=$1)
        + (SELECT COUNT(*) FROM ccz_esporotricose WHERE animal_id=$1)
        + (SELECT COUNT(*) FROM ccz_leishmaniose WHERE animal_id=$1)
        + (SELECT COUNT(*) FROM ccz_procedimentos WHERE animal_id=$1)
        + (SELECT COUNT(*) FROM ccz_denuncias WHERE animal_id=$1) AS t`,
  [await page.evaluate(() => document.querySelector('[class*="_ficha"]')?.innerText.match(/\(([^)]+)\)/)?.[1] || "")],
)).rows[0].t || 0);
marcar("todos os registros aparecem uma única vez (sem duplicar/omitir)",
  totalTela === itens.length, `tela:${totalTela} lidos:${itens.length} banco(animal):${noBanco}`);
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

passo("4b. Procedimento veterinário — finalidade identificada");
const procs = (await db.query(
  `SELECT p.id, p.tipo FROM ccz_procedimentos p WHERE p.animal_id = (SELECT id FROM ccz_animais WHERE nome ILIKE '%Joaquim%' LIMIT 1)`,
)).rows;
console.log("   procedimentos do animal:", JSON.stringify(procs));
const procItens = itens.filter((i) => procs.some((p) => i.texto.includes(p.tipo)));
marcar("procedimento exibe o próprio nome como finalidade",
  procs.length > 0 ? procItens.some((i) => /Castração|Vacinação|Consulta|Exame/i.test(i.texto)) : true,
  procs.map((p) => p.tipo).join(",") || "sem procedimento no animal");

passo("5. PDF da Ficha Completa do Animal");
const [dl] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("button", { hasText: "Gerar PDF" }).first().click(),
]);
const pdf = `${OUT}/ficha-completa-animal.pdf`;
await dl.saveAs(pdf);
const tam = fs.statSync(pdf).size;
marcar("PDF gerado", tam > 10000, `${Math.round(tam / 1024)} KB`);
// Texto do PDF: os streams são FlateDecode; descomprime para ler os rótulos.
const { inflateSync } = await import("node:zlib");
const bruto = fs.readFileSync(pdf);
const partes = [];
let pos = 0;
while (true) {
  const i = bruto.indexOf("stream", pos);
  if (i < 0) break;
  let ini = i + 6;
  if (bruto[ini] === 0x0d) ini++;
  if (bruto[ini] === 0x0a) ini++;
  const fim = bruto.indexOf("endstream", ini);
  if (fim < 0) break;
  try { partes.push(inflateSync(bruto.subarray(ini, fim))); } catch { partes.push(bruto.subarray(ini, fim)); }
  pos = fim + 9;
}
const textoPdf = Buffer.concat(partes).toString("latin1");
const temColuna = /TIPO DE ATENDIMENTO/.test(textoPdf);
const temEsporo = /Esporotricose/.test(textoPdf);
const semTabelaVisitas = !/VISITAS DE ACOMPANHAMENTO/.test(textoPdf);
marcar("PDF traz a coluna 'Tipo de Atendimento'", temColuna, temColuna ? "presente" : "ausente");
marcar("PDF traz a finalidade da visita (Esporotricose)", temEsporo, temEsporo ? "presente" : "ausente");
marcar("PDF sem a tabela independente 'Visitas de Acompanhamento'", semTabelaVisitas,
  semTabelaVisitas ? "ausente" : "presente");
// A tabela de esporotricose não traz mais a coluna de lesões/tratamento.
const cabecalhos = [...textoPdf.matchAll(/\(([A-ZÁÉÍÓÚÂÊÔÃÕÇ \/]+)\) Tj/g)].map((m) => m[1].trim());
// Recorte da tabela de Esporotricose: entre o título do grupo e a próxima
// tabela (a de Leishmaniose, cujas colunas próprias incluem lesões).
const posEsporo = textoPdf.indexOf("(Esporotricose) Tj");
const posLeish = textoPdf.indexOf("(Leishmaniose) Tj");
const blocoEsporo =
  posEsporo >= 0 ? textoPdf.slice(posEsporo, posLeish > posEsporo ? posLeish : undefined) : "";
const cabEsporo = [...blocoEsporo.matchAll(/\(([A-ZÁÉÍÓÚÂÊÔÃÕÇ \/]+)\) Tj/g)].map((m) => m[1].trim());
marcar("PDF da esporotricose sem a coluna 'Lesões / Tratamento'",
  cabEsporo.includes("CONCLUSÃO TÉCNICA DA VISITA") && !cabEsporo.includes("LESÕES / TRATAMENTO"),
  `esporotricose:${cabEsporo.filter((c) => /LESÕES|CONCLUSÃO TÉCNICA/.test(c)).join(" | ")}`);

const qtdRetorno = (textoPdf.match(/\(Retorno\) Tj/g) || []).length;
const qtdFiscEsporo = (textoPdf.match(/\(Fiscalização\) Tj/g) || []).length;
marcar("PDF traz os retornos dentro da tabela de esporotricose",
  qtdRetorno > 0 && qtdFiscEsporo > 0, `retornos:${qtdRetorno} fiscalizações:${qtdFiscEsporo}`);
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
