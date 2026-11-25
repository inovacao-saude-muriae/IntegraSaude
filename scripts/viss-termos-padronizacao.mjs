// Compara lado a lado o Termo de Leishmaniose com os termos de Procedimentos e
// Esporotricose: cabeçalho, fonte, margens, espaçamento, assinaturas e rodapé
// devem ser idênticos (o conteúdo textual é o que difere).
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
const OUT = path.join(process.env.TEMP, "termos-padronizacao");
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const ok = (m) => log.push(`OK   ${m}`);
const falha = (m) => log.push(`FALHA ${m}`);

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

/** Assinatura do PDF: tamanho da página + sequência de comandos de traço. */
function assinaturaPdf(arquivo) {
  const b = fs.readFileSync(arquivo).toString("latin1");
  const caixa = (b.match(/\/MediaBox\s*\[[^\]]+\]/) || [""])[0];
  const espessuras = [...b.matchAll(/([0-9.]+) w\b/g)].map((m) => m[1]);
  const fontes = [...new Set([...b.matchAll(/\/BaseFont\s*\/([A-Za-z-]+)/g)].map((m) => m[1]))].sort();
  const paginas = (b.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return { caixa, espessuras, fontes, paginas };
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

  // ── Modelos em branco (mesma tela, mesmo gerador) ───────────────────────
  await page.goto("http://localhost:3000/gerenciamento/termos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, "0-gerenciamento-termos-1440.png"), fullPage: true });

  const baixarModelo = async (texto, nome) => {
    const linha = page.locator("table tbody tr").filter({ hasText: texto });
    return baixar(page, () => linha.getByRole("button", { name: /Baixar/ }).click(), path.join(OUT, nome));
  };
  await baixarModelo("Termo de Procedimento", "branco-procedimento.pdf");
  await baixarModelo("Esporotricose", "branco-esporotricose.pdf");
  await baixarModelo("Protocolo de Monitoramento", "branco-leishmaniose.pdf");

  // ── Termo preenchido da Leishmaniose (com tutor) ────────────────────────
  await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2300);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1800);
  await page.locator('table tbody tr:has-text("ZZTESTE Cura")').first().click();
  await page.waitForTimeout(1600);
  await baixar(page, () => page.getByRole("button", { name: /Gerar Termo/ }).first().click(), path.join(OUT, "leishmaniose-com-tutor.pdf"));

  // ── Termo preenchido de Procedimentos (referência) ──────────────────────
  await page.goto("http://localhost:3000/ccz?tab=PROCEDIMENTOS", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2300);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1800);
  await page.locator("table tbody tr").first().click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(OUT, "1-procedimento-ficha-1440.png") });
  await baixar(page, () => page.getByRole("button", { name: /Gerar Termo/ }).first().click(), path.join(OUT, "procedimento-preenchido.pdf"));

  await browser.close();
  await db.end();

  // ── Comparação estrutural dos PDFs ──────────────────────────────────────
  const arquivos = {
    "branco-procedimento": "branco-procedimento.pdf",
    "branco-esporotricose": "branco-esporotricose.pdf",
    "branco-leishmaniose": "branco-leishmaniose.pdf",
    "procedimento-preenchido": "procedimento-preenchido.pdf",
    "leishmaniose-com-tutor": "leishmaniose-com-tutor.pdf",
  };
  const dados = {};
  for (const [k, f] of Object.entries(arquivos)) dados[k] = assinaturaPdf(path.join(OUT, f));

  const ref = dados["branco-procedimento"];
  for (const [k, v] of Object.entries(dados)) {
    if (v.caixa === ref.caixa) ok(`${k}: mesmo formato A4 (${v.caixa})`);
    else falha(`${k}: formato diferente (${v.caixa} × ${ref.caixa})`);
    if (JSON.stringify(v.fontes) === JSON.stringify(ref.fontes)) ok(`${k}: mesmas fontes (${v.fontes.join(", ")})`);
    else falha(`${k}: fontes diferentes (${v.fontes.join(",")} × ${ref.fontes.join(",")})`);
  }

  // Cabeçalho e linhas divisórias têm espessuras fixas no template. O termo
  // SEM tutor não imprime a linha da assinatura do responsável, por isso a
  // comparação é por presença das espessuras, não pela quantidade.
  const conjunto = (v) => [...new Set(v.espessuras)].sort().join("|");
  const base = conjunto(ref);
  for (const [k, v] of Object.entries(dados)) {
    if (conjunto(v) === base) ok(`${k}: mesmas espessuras de linha do template`);
    else falha(`${k}: espessuras diferentes (${conjunto(v)} × ${base})`);
  }

  // Cabeçalho: mesmo bloco de texto, mesma fonte, mesmo tamanho e mesma posição.
  const cabecalho = (arquivo) => {
    const b = fs.readFileSync(arquivo).toString("latin1");
    // O jsPDF emite Tf, TL, cor e Td em comandos separados: a busca é tolerante.
    const m = b.match(/\/F(\d+)\s+([\d.]+)\s+Tf[\s\S]{0,160}?([\d.-]+)\s+([\d.-]+)\s+Td\s*\((PREFEITURA MUNICIPAL DE MURIAÉ)\)/);
    return m ? `F${m[1]} ${m[2]}pt x=${Number(m[3]).toFixed(2)} y=${Number(m[4]).toFixed(2)}` : "não localizado";
  };
  const cabRef = cabecalho(path.join(OUT, "branco-procedimento.pdf"));
  for (const [k, f] of Object.entries(arquivos)) {
    const c = cabecalho(path.join(OUT, f));
    if (c === cabRef) ok(`${k}: cabeçalho idêntico (${c})`);
    else falha(`${k}: cabeçalho diferente (${c} × ${cabRef})`);
  }

  // Conteúdo textual: cada termo mantém o seu texto.
  const texto = (f) => fs.readFileSync(path.join(OUT, f)).toString("latin1");
  const lei = texto("branco-leishmaniose.pdf").includes("13.317/1999");
  const protocolo = texto("branco-leishmaniose.pdf").includes("PROTOCOLO DE MONITORAMENTO ZOONOSES");
  if (lei && protocolo) ok("modelo em branco da Leishmaniose mantém título e referências legais");
  else falha("conteúdo textual do termo de Leishmaniose incompleto");

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
