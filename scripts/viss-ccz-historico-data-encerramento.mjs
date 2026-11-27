// Data do evento "Encerramento do Caso" no Histórico do Animal (ficha e PDF):
// deve ser exatamente a data escolhida no modal, nas duas zoonoses.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "ccz-data-encerramento");
fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
let ok = 0, falhas = 0;
const marcar = (n, c, d = "") => {
  if (c) { ok++; console.log(`OK   ${n} ${d}`); } else { falhas++; console.log(`FALHA ${n} ${d}`); }
};
const br = (ymd) => ymd.split("-").reverse().join("/");

const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

// ── Fixtures fictícias ─────────────────────────────────────────────────────
const cpf = "91000000777";
const SUF = String(Date.now()).slice(-6);
const ANM = `ANM-ZZ-ENC-${SUF}`;
const DATA_ESP = "2026-09-14"; // bem diferente de hoje
const DATA_LEI = "2026-08-03";
await db.query("DELETE FROM ccz_esporotricose_visitas WHERE esporotricose_id IN (SELECT id FROM ccz_esporotricose WHERE animal_id=$1)", [ANM]);
await db.query("DELETE FROM ccz_esporotricose WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_procedimentos WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_animais WHERE id=$1", [ANM]);
await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf=$1", [cpf]);
await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
await db.query(
  `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
   VALUES ($1,'Tutor Data Encerramento','F','1980-01-05','Rita','32966665555','ATIVO'::"SituacaoCadastral",true)`,
  [cpf],
);
await db.query("INSERT INTO ccz_tutores (pessoa_cpf, created_at) VALUES ($1, now())", [cpf]);
await db.query(
  `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro,situacao)
   VALUES ($1,'Toby','Canina','M','Médio','6 anos',$2,now(),'CCZ')`,
  [ANM, cpf],
);
await db.query(
  `INSERT INTO ccz_esporotricose (id,animal_id,"dataVisita",fiscal_responsavel)
   VALUES ('ESP-ZZ-' || $2,$1,'2026-08-20','Fiscal Teste')`,
  [ANM, SUF],
);
await db.query(
  `INSERT INTO ccz_leishmaniose (id,animal_id,data_fiscalizacao,responsavel_cpf,responsavel_nome,situacao_caso,updated_at)
   VALUES ('LEISH-ZZ-' || $2,$1,'2026-08-10','00000000000','Fiscal Teste','EM_ACOMPANHAMENTO',now())`,
  [ANM, SUF],
);

const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

// Preenche um campo controlado do React (o setter nativo dispara o onChange).
const preencher = async (loc, valor) => {
  await loc.evaluate((el, v) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value").set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, valor);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

// ── Encerrar a Esporotricose pelo modal, com data antiga ───────────────────
await page.goto("http://localhost:3000/ccz?tab=ESPOROTRICOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page.getByRole("button", { name: "Consultar Registros", exact: true }).last().click();
await page.waitForTimeout(1600);
await page.locator('input[placeholder*="nome do animal" i]').first().fill("Toby").catch(() => {});
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2200);
await page.evaluate((id) => {
  const linha = [...document.querySelectorAll("tbody tr")].find((t) => t.innerText.includes(id));
  linha?.click();
}, ANM);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/0-esp-antes.png`, fullPage: true });
console.log("   [tela]", (await page.evaluate(() => document.body.innerText)).slice(0, 900).replace(/\n/g, " | "));
const encerrarEsp = page.getByRole("button", { name: /Encerrar Caso/i }).first();
marcar("1. botão 'Encerrar Caso' disponível (Esporotricose)", (await encerrarEsp.count()) > 0);
await encerrarEsp.click();
await page.waitForTimeout(1200);
const modal = page.locator('[role="dialog"]').last();
await modal.locator("select").first().selectOption({ index: 1 }).catch(() => {});
await page.waitForTimeout(300);
await preencher(modal.locator('input[type="date"]').first(), DATA_ESP);
await preencher(modal.locator("textarea").first(), "Encerramento registrado para validar a data no historico.");
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/0b-esp-modal.png`, fullPage: true });
console.log("   [modal]", (await modal.innerText()).slice(0, 500).replace(/\n/g, " | "));
const conf = modal.getByRole("button", { name: /Confirmar/i }).last();
console.log("   [confirmar disabled]", await conf.isDisabled().catch(() => "n/a"));
await conf.click();
await page.waitForTimeout(3000);
console.log("   [pos-modal]", (await page.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, " | "));
const espDb = (await db.query("SELECT encerrado, desfecho, data_encerramento FROM ccz_esporotricose WHERE animal_id=$1", [ANM])).rows[0];
marcar("2. Esporotricose encerrada no banco", espDb?.encerrado === true);
marcar("3. data gravada = data do modal (dia preservado)",
  String(espDb?.data_encerramento).slice(0, 10) === DATA_ESP,
  String(espDb?.data_encerramento));

// ── Histórico do Animal (ficha) ────────────────────────────────────────────
const abrirHistorico = async () => {
  await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  await page.getByRole("button", { name: "Consultar Registros", exact: true }).last().click();
  await page.waitForTimeout(1600);
  await page.locator('input[placeholder*="Digite o nome ou ID do animal"]').first().fill("Toby");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('[class*="_card"]')].find((el) => el.innerText.includes("Toby"));
    card?.click();
  });
  await page.waitForTimeout(2800);
};
await abrirHistorico();
const lerItens = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[class*="_itemHistorico"]')].map((i) => i.innerText.replace(/\n/g, " | ")),
  );
let itens = await lerItens();
marcar("4. evento 'Encerramento do Caso' no histórico",
  itens.some((t) => /Encerramento do Caso/i.test(t)), JSON.stringify(itens.filter((t) => /Encerramento/i.test(t))));
marcar("5. ficha mostra a data do modal no encerramento",
  itens.some((t) => /Encerramento do Caso/i.test(t) && t.includes(br(DATA_ESP))));
marcar("6. ficha NÃO usa a data de hoje no encerramento",
  !itens.some((t) => /Encerramento do Caso/i.test(t) && t.includes(br(new Date().toISOString().slice(0, 10)))));
marcar("7. fiscalizações anteriores mantidas",
  itens.some((t) => t.includes("20/08/2026")));

// ── PDF do Histórico ───────────────────────────────────────────────────────
const baixarPdf = async (arquivo) => {
  const dl = page.waitForEvent("download", { timeout: 60000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Gerar PDF/i.test(x.innerText || ""));
    b?.click();
  });
  const arq = await dl.catch(() => null);
  if (!arq) return null;
  const destino = path.join(OUT, arquivo);
  await arq.saveAs(destino);
  return destino;
};
const pdfEsp = await baixarPdf("historico-esporotricose.pdf");
if (pdfEsp) {
  const cru = fs.readFileSync(pdfEsp).toString("latin1");
  marcar("8. PDF traz a data do encerramento da Esporotricose", cru.includes(br(DATA_ESP)));
} else {
  marcar("8. PDF gerado", false);
}

// ── Leishmaniose: encerrar com data antiga e conferir ──────────────────────
await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page.getByRole("button", { name: "Consultar Registros", exact: true }).last().click();
await page.waitForTimeout(1600);
await page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').first().fill("Toby").catch(() => {});
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2400);
await page.evaluate((id) => {
  const linha = [...document.querySelectorAll("tbody tr")].find((t) => t.innerText.includes(id));
  linha?.click();
}, ANM);
await page.waitForTimeout(2500);
const encerrarLei = page.getByRole("button", { name: /Encerrar Caso/i }).first();
marcar("9. botão 'Encerrar Caso' disponível (Leishmaniose)", (await encerrarLei.count()) > 0);
await encerrarLei.click();
await page.waitForTimeout(1200);
const modalL = page.locator('[role="dialog"]').last();
await modalL.locator("select").first().selectOption({ index: 1 }).catch(() => {});
await page.waitForTimeout(300);
await preencher(modalL.locator('input[type="date"]').first(), DATA_LEI);
await preencher(modalL.locator("textarea").first(), "Encerramento registrado para validar a data no historico.");
await page.waitForTimeout(500);
await modalL.getByRole("button", { name: /Confirmar/i }).last().click();
await page.waitForTimeout(3000);
const leiDb = (await db.query("SELECT situacao_caso, desfecho, data_encerramento FROM ccz_leishmaniose WHERE animal_id=$1", [ANM])).rows[0];
marcar("10. Leishmaniose encerrada no banco", leiDb?.situacao_caso === "ENCERRADO");
marcar("11. data gravada = data do modal (dia preservado)",
  String(leiDb?.data_encerramento).slice(0, 10) === DATA_LEI,
  String(leiDb?.data_encerramento));

await abrirHistorico();
itens = await lerItens();
marcar("12. ficha mostra a data do modal no encerramento da Leishmaniose",
  itens.some((t) => /Leishmaniose/i.test(t) && t.includes(br(DATA_LEI))), JSON.stringify(itens));
marcar("13. fiscalização anterior da Leishmaniose inalterada",
  itens.some((t) => t.includes("10/08/2026")));
const pdfLei = await baixarPdf("historico-leishmaniose.pdf");
if (pdfLei) {
  const cru = fs.readFileSync(pdfLei).toString("latin1");
  marcar("14. PDF traz a data do encerramento da Leishmaniose", cru.includes(br(DATA_LEI)));
} else {
  marcar("14. PDF gerado", false);
}

// ── Encerramentos já cadastrados: data coerente com o banco ────────────────
const antigos = (await db.query(
  "SELECT id, data_encerramento FROM ccz_esporotricose WHERE encerrado = true AND data_encerramento IS NOT NULL",
)).rows;
const incoerentes = antigos.filter((r) => {
  const dia = new Date(r.data_encerramento);
  // gravados ao meio-dia UTC → o dia é estável em qualquer fuso do Brasil
  return dia.getUTCHours() !== 12 && dia.getUTCHours() !== 3 && dia.getUTCHours() !== 0;
});
marcar("15. encerramentos antigos com data legível (sem horário arbitrário)",
  incoerentes.length === 0, JSON.stringify(incoerentes.map((r) => [r.id, r.data_encerramento])));

marcar("console sem erros", erros.length === 0, erros.slice(0, 2).join(" | "));
await page.screenshot({ path: `${OUT}/historico-1440.png`, fullPage: true });
await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
