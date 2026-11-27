// Leishmaniose > Novo Registro: bloco "Informações da Fiscalização" removido e
// identificação do animal reunida com a condição clínica na etapa 1.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "leish-etapa1");
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
const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2800);
await page.getByRole("button", { name: "Novo Registro", exact: true }).first().click();
await page.waitForTimeout(1500);

const texto = await page.evaluate(() => document.body.innerText);
marcar("1. bloco 'Informações da Fiscalização' não aparece", !/Informações da Fiscalização/i.test(texto));
marcar("2. título unificado presente", /Identificação do Animal e Condição Clínica/i.test(texto));
marcar("3. campos de data/responsável/cargo/equipe removidos",
  !/Data da Fiscalização/i.test(texto) && !/Responsável pela Fiscalização/i.test(texto) &&
    !/Cargo\/Função/i.test(texto) && !/Adicionar profissional/i.test(texto));
marcar("4. condição clínica preservada",
  /Ainda apresenta lesões/i.test(texto) && /Está em tratamento veterinário contínuo/i.test(texto) &&
    /Há registro de retorno ou revisão veterinária/i.test(texto));
marcar("5. busca de animal presente", await page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').count() > 0);
marcar("6. quatro etapas mantidas",
  ["Identificação e Tratamento", "Manejo", "Orientações", "Conclusão"].every((e) => texto.includes(e)));
// A etapa 1 exige o animal selecionado para avançar: seleciona a fixture.
const busca = page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').first();
await busca.click();
await page.waitForTimeout(400);
await busca.pressSequentially("Bolinha", { delay: 60 });
await page.waitForTimeout(2200);
const selecionado = await page.evaluate(() => {
  const linha = [...document.querySelectorAll('[class*="_tableDropdownMenu"] tbody tr')].find((t) =>
    t.innerText.includes("Bolinha"),
  );
  if (!linha) return false;
  linha.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  linha.click();
  return true;
});
await page.waitForTimeout(1200);
console.log("   [selecionou]", selecionado);
await page.getByRole("button", { name: /Próximo/ }).click();
await page.waitForTimeout(1000);
const texto2 = await page.evaluate(() => document.body.innerText);
console.log("   [etapa2]", texto2.slice(-400).replace(/\n/g, " | "));
marcar("7. etapa 2 segue com Manejo e Biossegurança", /Manejo e Biossegurança/i.test(texto2));
await page.getByRole("button", { name: /← Anterior/ }).click();
await page.waitForTimeout(900);
const voltou = await page.evaluate(() => /IDENTIFICAÇÃO DO ANIMAL E CONDIÇÃO CLÍNICA/i.test(document.body.innerText));
marcar("7b. navegação entre etapas sem perder o bloco", voltou);

// mesmo container: título do bloco único e a pergunta clínica na mesma seção
const mesmoContainer = await page.evaluate(() => {
  // A seção do bloco é a que contém o título como primeiro heading.
  const secao = [...document.querySelectorAll("section")].find((s) =>
    [...s.querySelectorAll("h3")].some((h) =>
      /IDENTIFICAÇÃO DO ANIMAL E CONDIÇÃO CLÍNICA/i.test(h.innerText || ""),
    ),
  );
  if (!secao) return false;
  // O título e a condição clínica estão no mesmo container (seções internas
  // podem repetir o padrão, então a busca é pela seção mais externa).
  return /Ainda apresenta lesões/i.test(secao.innerText || "");
});
marcar("8. identificação + condição clínica no MESMO container", mesmoContainer);

// condicionais seguem visíveis e desabilitados
const compl = await page.evaluate(() => {
  const inp = [...document.querySelectorAll("input")].find((i) => i.placeholder === "Quais lesões?");
  return inp ? { existe: true, desabilitado: inp.disabled } : { existe: false };
});
marcar("9. complementar visível e desabilitado até responder Sim", compl.existe && compl.desabilitado, JSON.stringify(compl));

await page.screenshot({ path: `${OUT}/etapa1-1440.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/etapa1-390.png`, fullPage: true });
marcar("console sem erros", erros.length === 0, erros.slice(0, 2).join(" | "));

await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
