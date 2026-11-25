// Compara a Ficha de Fiscalização da Leishmaniose com o PDF do Histórico do
// Animal (mesmo padrão visual) e confirma que o Termo continua em uma página.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

function envLocal() {
  const env = {};
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const env = envLocal();
const db = new Client({ connectionString: env.DATABASE_URL });
const OUT = path.join(process.env.TEMP, "leishmaniose-ficha-padrao");
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const ok = (m) => log.push(`OK   ${m}`);
const falha = (m) => log.push(`FALHA ${m}`);

const NOMES_SECOES = [
  "IDENTIFICAÇÃO DO RESPONSÁVEL PELO ANIMAL",
  "IDENTIFICAÇÃO DO ANIMAL",
  "CONDIÇÃO CLÍNICA E TRATAMENTO",
  "CONDUTA DO TUTOR QUANTO AO MANEJO E BIOSSEGURANÇA",
  "OUTROS ANIMAIS E PESSOAS NA RESIDÊNCIA",
  "CONDIÇÕES DO AMBIENTE",
  "CONHECIMENTO, COMPROMETIMENTO E ORIENTAÇÕES",
  "CONCLUSÃO DA EQUIPE TÉCNICA",
  "ASSINATURAS",
];

async function sessao() {
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", ["00000000000"])).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  await db.query(
    `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
     VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`,
    [u.cpf, token],
  );
  return token;
}

async function baixar(page, clicar, destino) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 25000 }), clicar()]);
  await dl.saveAs(destino);
  return fs.statSync(destino).size;
}

/** Marcas visuais do PDF: cabeçalho, fontes, espessuras e páginas. */
function marcas(arquivo) {
  const b = fs.readFileSync(arquivo).toString("latin1");
  const cab = b.match(/\/F(\d+)\s+([\d.]+)\s+Tf[\s\S]{0,160}?([\d.-]+)\s+([\d.-]+)\s+Td\s*\((PREFEITURA MUNICIPAL DE MURIAÉ)\)/);
  return {
    pagina: (b.match(/\/MediaBox\s*\[[^\]]+\]/) || [""])[0],
    cabecalho: cab ? `F${cab[1]} ${cab[2]}pt x=${Number(cab[3]).toFixed(2)} y=${Number(cab[4]).toFixed(2)}` : "não localizado",
    espessuras: [...new Set([...b.matchAll(/([0-9.]+) w\b/g)].map((m) => Number(m[1]).toFixed(3)))].sort().join("|"),
    paginas: (b.match(/\/Type\s*\/Page[^s]/g) || []).length,
    temFoto: /\/DCTDecode|\/FlateDecode[\s\S]{0,40}\/Image/.test(b) && b.includes("/Subtype/Image"),
  };
}

async function main() {
  await db.connect();
  const token = await sessao();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/i.test(m.text())) erros.push(m.text());
  });

  // ── Ficha de Fiscalização (Gerar PDF) ───────────────────────────────────
  await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2300);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1800);
  await page.locator('table tbody tr:has-text("ZZTESTE Cura")').first().click();
  await page.waitForTimeout(1600);
  await baixar(page, () => page.getByRole("button", { name: /Gerar PDF/ }).first().click(), path.join(OUT, "ficha-leishmaniose.pdf"));
  // Termo continua sendo o mesmo documento de texto corrido.
  await baixar(page, () => page.getByRole("button", { name: /Gerar Termo/ }).first().click(), path.join(OUT, "termo-leishmaniose.pdf"));

  // ── Histórico do Animal (referência do padrão) ──────────────────────────
  await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1400);
  await page.getByRole("button", { name: /^Filtrar$/ }).first().click();
  await page.waitForTimeout(1800);
  await page.locator('button:has-text("ZZTESTE Cura")').first().click({ force: true });
  await page.waitForTimeout(1800);
  // A ficha do animal abre em painel: o botão fica no topo do painel.
  await baixar(page, () => page.getByRole("button", { name: /Gerar PDF/ }).first().click(), path.join(OUT, "historico-animal.pdf"));

  await browser.close();
  await db.end();

  const ficha = marcas(path.join(OUT, "ficha-leishmaniose.pdf"));
  const hist = marcas(path.join(OUT, "historico-animal.pdf"));
  const termo = marcas(path.join(OUT, "termo-leishmaniose.pdf"));

  if (ficha.pagina === hist.pagina) ok(`Ficha: mesmo formato A4 do Histórico (${ficha.pagina})`);
  else falha(`Ficha: formato diferente (${ficha.pagina} × ${hist.pagina})`);
  if (ficha.cabecalho === hist.cabecalho) ok(`Ficha: cabeçalho idêntico ao Histórico (${ficha.cabecalho})`);
  else falha(`Ficha: cabeçalho diferente (${ficha.cabecalho} × ${hist.cabecalho})`);
  if (ficha.espessuras === hist.espessuras) ok(`Ficha: mesmas espessuras de linha (${ficha.espessuras})`);
  else falha(`Ficha: espessuras diferentes (${ficha.espessuras} × ${hist.espessuras})`);
  if (!ficha.temFoto) ok("Ficha: sem fotografia do animal");
  else falha("Ficha: contém imagem/fotografia");

  if (termo.paginas === 1) ok("Termo: continua em uma única página A4 (texto corrido)");
  else falha(`Termo: ${termo.paginas} páginas`);

  // ── Conteúdo preservado na ficha ────────────────────────────────────────
  const texto = fs.readFileSync(path.join(OUT, "ficha-leishmaniose.pdf")).toString("latin1");
  const presentes = NOMES_SECOES.filter((n) => texto.includes(n));
  if (presentes.length === NOMES_SECOES.length) ok(`Ficha: as ${NOMES_SECOES.length} seções da fiscalização estão presentes`);
  else falha(`Ficha: seções ausentes: ${NOMES_SECOES.filter((n) => !texto.includes(n)).join(", ")}`);
  const chaves = [
    "ZZTESTE Cura",
    "ZZTESTE Tutor Encerramento",
    "91000000945",
    "Equipe técnica participante",
    "Muriaé/MG",
    "Encerrado",
    "Curado",
  ];
  const faltando = chaves.filter((c) => !texto.includes(c));
  if (faltando.length === 0) ok("Ficha: dados históricos (animal, tutor, equipe e local) preservados");
  else falha(`Ficha: dados ausentes: ${faltando.join(", ")}`);

  if (erros.length === 0) ok("console limpo (sem erros)");
  else falha(`erros no console: ${JSON.stringify(erros.slice(0, 2))}`);

  const falhas = log.filter((l) => l.startsWith("FALHA")).length;
  log.push("", `${log.filter((l) => l.startsWith("OK")).length} OK / ${falhas} FALHA`);
  fs.writeFileSync(path.join(OUT, "relatorio.txt"), log.join("\n"));
  console.log(log.join("\n"));
  process.exit(falhas ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
