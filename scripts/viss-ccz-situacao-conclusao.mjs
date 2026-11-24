// Validação: Situação da Denúncia (Ativa/Inativa) e Edição da Conclusão da Esporotricose.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

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

const outDir = path.join(process.env.TEMP, "ccz-situacao-conclusao");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
page.on("pageerror", (e) => erros.push(String(e.stack || e)));
page.on("console", (m) => { if (m.type() === "error") erros.push("console: " + m.text() + "\n" + JSON.stringify(m.location())); });

const linhas = [];
const log = (t) => { linhas.push(t); console.log(t); };
const ok = (cond, msg) => log(`${cond ? "OK  " : "FALHA"} ${msg}`);

const abrirConsulta = async (rota) => {
  await page.goto("http://localhost:3000" + rota, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /Consultar Registros/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Filtrar/ }).click();
  await page.waitForTimeout(1800);
};

// ═══ 1. DENÚNCIAS — ATIVA → INATIVA ═══════════════════════════════════════
log("== DENÚNCIAS: situação ==");
await abrirConsulta("/ccz?tab=DENUNCIA_AGRESSIVO");
const idDen = (await db.query("SELECT id FROM ccz_denuncias ORDER BY id LIMIT 1")).rows[0].id;
// estado inicial conhecido: Ativa
await db.query("UPDATE ccz_denuncias SET situacao='Ativa' WHERE id=$1", [idDen]);
const indice = (await db.query("SELECT id FROM ccz_denuncias ORDER BY \"dataDenuncia\" DESC, id").then(r => r.rows.map(x => x.id))).indexOf(idDen);
await page.locator("tbody tr").nth(indice).click();
await page.waitForTimeout(1600);
await page.locator("[class*='_modalFooter'] button", { hasText: /Gerar Termo/ }).first().waitFor();

// abre a edição da situação
await page.getByRole("button", { name: /Alterar situação/ }).click();
await page.waitForTimeout(400);
const select = page.locator("[class*='_modal'] select").first();
await select.selectOption("Inativa");
await page.waitForTimeout(300);
const btnSalvar = page.getByRole("button", { name: /Salvar situação/ });
ok(await btnSalvar.isDisabled(), "Salvar bloqueado sem justificativa");
await page.screenshot({ path: path.join(outDir, "1-denuncia-justificativa-1440.png") });

await page.locator("[class*='_modal'] textarea").first().fill("Denúncia encerrada após vistoria no local, sem risco identificado.");
await page.waitForTimeout(300);
ok(!(await btnSalvar.isDisabled()), "Salvar liberado com justificativa válida");
await btnSalvar.click();
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(outDir, "2-denuncia-inativa-1440.png") });

log(`  id lido: ${JSON.stringify(idDen)}`);
const row = await db.query("SELECT situacao, justificativa_inativacao FROM ccz_denuncias WHERE id=$1", [idDen]);
ok(row.rows[0].situacao === "Inativa", `situação gravada: ${row.rows[0].situacao}`);
ok((row.rows[0].justificativa_inativacao || "").length >= 15, "justificativa persistida");

const audit = await db.query(
  "SELECT acao, detalhes FROM audit_logs WHERE entidade_id=$1 AND acao IN ('DESATIVAR','REATIVAR') ORDER BY created_at DESC LIMIT 1",
  [idDen],
);
ok(audit.rows[0]?.acao === "DESATIVAR", `auditoria: ${audit.rows[0]?.acao}`);

// tabela atualizada
// fecha a ficha (o overlay intercepta os cliques se ela continuar aberta)
await page.locator("[class*='_modalOverlay'] [class*='_modalClose']").first().click({ force: true });
await page.waitForTimeout(600);
// garante que a ficha fechou (overlay bloqueia os cliques seguintes)
if (await page.locator("[class*='_modalOverlay']").count()) {
  await page.locator("[class*='_modalOverlay']").first().evaluate((el) => el.remove());
  await page.waitForTimeout(300);
}
await page.waitForTimeout(600);
// reabre a consulta para refletir a situação gravada
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1800);
await page.waitForTimeout(1500);
const badge = await page.locator("tbody tr").nth(indice).innerText();
ok(/Inativa/.test(badge), "tabela exibe Inativa");

// ═══ 2. REATIVAÇÃO ════════════════════════════════════════════════════════
log("== DENÚNCIAS: reativação ==");
// A consulta ainda carrega o estado anterior (Ativa); reabre a ficha pelo
// próprio backend para não depender da tabela.
await page.goto("http://localhost:3000/ccz?tab=DENUNCIA_AGRESSIVO", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(2000);
await page.locator("tbody tr").nth(indice).click();
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /Alterar situação/ }).waitFor({ timeout: 15000 });
await page.getByRole("button", { name: /Alterar situação/ }).click();
await page.waitForTimeout(400);
await page.locator("[class*='_modal'] select").first().selectOption("Ativa");
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Salvar situação/ }).click();
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(outDir, "3-denuncia-reativada-1440.png") });
const row2 = await db.query("SELECT situacao, justificativa_inativacao FROM ccz_denuncias WHERE id=$1", [idDen]);
ok(row2.rows[0].situacao === "Ativa", `situação após reativação: ${row2.rows[0].situacao}`);
ok(Boolean(row2.rows[0].justificativa_inativacao), "justificativa preservada na reativação");

// ═══ 3. ESPOROTRICOSE — EDIÇÃO DA CONCLUSÃO ═══════════════════════════════
log("== ESPOROTRICOSE: conclusão ==");
const antes = (await db.query("SELECT id, encerrado FROM ccz_esporotricose ORDER BY \"dataVisita\" DESC, id LIMIT 1")).rows[0];
// estado inicial conhecido: Em andamento → a edição deve gravar Encerrado
await db.query("UPDATE ccz_esporotricose SET encerrado=false, data_encerramento=NULL, encerrado_por=NULL WHERE id=$1", [antes.id]);
await abrirConsulta("/ccz?tab=ESPOROTRICOSE");
await page.locator("tbody tr").first().click();
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(outDir, "4-esporotricose-ficha-1440.png") });

const btnEditar = page.getByRole("button", { name: /^Editar$/ });
ok(await btnEditar.isVisible(), "botão Editar disponível na ficha");
await btnEditar.click();
await page.waitForTimeout(900);
const selConclusao = page.locator("[role='dialog'] select").first();
const alvo = "ENCERRADO";
await selConclusao.selectOption(alvo);
await page.screenshot({ path: path.join(outDir, "5-esporotricose-editando-1440.png") });
await page.getByRole("button", { name: /^Salvar$/ }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, "6-esporotricose-apos-salvar-1440.png") });

const dep = await db.query("SELECT encerrado FROM ccz_esporotricose WHERE id=$1", [antes.id]);
ok(Boolean(dep.rows[0].encerrado) === (alvo === "ENCERRADO"), `conclusão gravada: ${dep.rows[0].encerrado}`);
const auditEsp = await db.query(
  "SELECT acao FROM audit_logs WHERE entidade_id=$1 AND acao IN ('ENCERRAR','REABRIR') ORDER BY created_at DESC LIMIT 1",
  [antes.id],
);
ok(Boolean(auditEsp.rows[0]), `auditoria registrada: ${auditEsp.rows[0]?.acao}`);

// PDF reflete a conclusão
const [dl] = await Promise.all([
  page.waitForEvent("download", { timeout: 25000 }),
  page.locator("[role='dialog'] button", { hasText: /Gerar PDF/ }).first().click(),
]);
const pdf = path.join(outDir, "esporotricose.pdf");
await dl.saveAs(pdf);
ok(fs.statSync(pdf).size > 10000, `PDF gerado (${Math.round(fs.statSync(pdf).size / 1024)} KB)`);

log(`erros de console: ${erros.length}`);
erros.slice(0, 6).forEach((e) => log("  ! " + e));
fs.writeFileSync(path.join(outDir, "relatorio.txt"), linhas.join("\n"), "utf8");
await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
await db.end();
await browser.close();
