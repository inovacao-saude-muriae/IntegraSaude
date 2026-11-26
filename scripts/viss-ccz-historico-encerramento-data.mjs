// Histórico do Animal — data do encerramento da esporotricose vinda do modal,
// remoção da coluna "Responsável" na Leishmaniose e larguras do PDF.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "ccz-historico-encerramento-data");
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

const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

const cpf = "91000000996";
const ANM = "ANM-ZZ-ENC-DT";
await db.query("DELETE FROM ccz_esporotricose_visitas WHERE esporotricose_id IN (SELECT id FROM ccz_esporotricose WHERE animal_id=$1)", [ANM]);
await db.query("DELETE FROM ccz_esporotricose WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_animais WHERE id=$1", [ANM]);
await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf=$1", [cpf]);
await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
await db.query(
  `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
   VALUES ($1,'Tutor Encerramento Data','M','1980-01-05','Ana','32977776666','ATIVO'::"SituacaoCadastral",true)`,
  [cpf],
);
await db.query("INSERT INTO ccz_tutores (pessoa_cpf, created_at) VALUES ($1, now())", [cpf]);
await db.query(
  `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro,situacao)
   VALUES ($1,'Timão','Felina','M','Médio','3 anos',$2,now(),'CCZ')`,
  [ANM, cpf],
);
const ESP = "ESP-ZZ-ENC-DT";
// Encerrado com data INFORMADA bem diferente da data da operação (hoje).
await db.query(
  `INSERT INTO ccz_esporotricose
     (id, animal_id, "dataVisita", fiscal_responsavel, encerrado, desfecho,
      data_encerramento, justificativa_encerramento, encerrado_por, encerrado_em)
   VALUES ($1,$2,'2026-11-02','Fiscal Teste',true,'Curado','2026-11-10T12:00:00Z',
      'Animal apresentou melhora completa no acompanhamento.','Administrador IntegraSaúde', now())`,
  [ESP, ANM],
);

const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2800);
await page.getByRole("button", { name: "Consultar Registros", exact: true }).last().click();
await page.waitForTimeout(2000);
await page.locator('input[placeholder*="Digite o nome ou ID do animal"]').first().fill("Timão");
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2600);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('[class*="_card"]')].find((el) => el.innerText.includes("Timão"));
  card?.click();
});
await page.waitForTimeout(3000);

const itens = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_itemHistorico"]')].map((el) => ({
    texto: (el.innerText || "").replace(/\s+/g, " ").trim(),
    data: (el.querySelector('[class*="_itemData"]')?.innerText || "").trim(),
  })),
);
const encerramento = itens.find((i) => /Encerramento do Caso/i.test(i.texto));
marcar("1. evento 'Encerramento do Caso' existe no histórico", Boolean(encerramento), JSON.stringify(itens.map((i) => i.data)));
marcar(
  "2. data exibida = data informada no modal (10/11/2026)",
  encerramento?.data === "10/11/2026",
  `data=${encerramento?.data}`,
);
await page.screenshot({ path: `${OUT}/1-historico-1440.png`, fullPage: true });

// PDF: data do encerramento e ausência da coluna Responsável na Leishmaniose
const dl = page.waitForEvent("download", { timeout: 60000 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Gerar PDF/i.test(x.innerText || ""));
  b?.click();
});
const arquivo = await dl.catch(() => null);
if (arquivo) {
  const destino = path.join(OUT, "ficha.pdf");
  await arquivo.saveAs(destino);
  const cru = fs.readFileSync(destino).toString("latin1");
  marcar("3. PDF gerado", cru.length > 10000, `${cru.length} bytes`);
  marcar("3. PDF traz a data do encerramento 10/11/2026", cru.includes("10/11/2026"));
  marcar("3. PDF não traz a data da operação como encerramento", !/Encerramento do Caso[\s\S]{0,80}Encerrado em/.test(cru));
  marcar("4. PDF sem a coluna Responsável na tabela de Leishmaniose", !cru.includes("(Respons\\242vel) Tj") && !/\(Respons.*vel\) Tj/.test(cru.split("LEISHMANIOSE")[1] || ""));
  // Confere os cabeçalhos das tabelas (jsPDF grava em Latin-1, sem compressão).
  // Cabeçalhos das tabelas: o jsPDF codifica os acentos (Conclusão → "Conclus#o").
  // Os cabeçalhos das tabelas são gravados em CAIXA ALTA.
  marcar("5. tabela de Esporotricose com 'TIPO DE ATENDIMENTO'", /TIPO DE ATENDIMENTO/.test(cru));
  marcar("5. tabela de Esporotricose com 'ACOMPANHAMENTO'", /ACOMPANHAMENTO/.test(cru));
  marcar("5. cabeçalho 'CONCLUSÃO TÉCNICA DA VISITA' presente", /CONCLUS/.test(cru));
  marcar("5. coluna Responsável ausente do PDF", !/Respons/.test(cru));
} else {
  marcar("3. PDF gerado", false, "download não ocorreu");
}

marcar("console sem erros", erros.length === 0, erros.slice(0, 2).join(" | "));
await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
