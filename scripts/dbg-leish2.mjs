import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", ["00000000000"])).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(`INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`, [u.cpf, token]);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 400)));
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 400)); });
page.on("download", (d) => console.log("download iniciado:", d.suggestedFilename()));
await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /^Filtrar$/ }).click();
await page.waitForTimeout(1800);
console.log("linhas:", (await page.locator("table tbody tr").allInnerTexts()).map(t=>t.replace(/\s+/g," ").slice(0,70)));
await page.locator('table tbody tr:has-text("ZZTESTE Cura")').first().click();
await page.waitForTimeout(1800);
console.log("dialogos:", await page.locator('[role="dialog"]').count());
const btn = page.getByRole("button", { name: /Gerar PDF/ });
console.log("btn Gerar PDF:", await btn.count());
try {
  const [d] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), btn.click()]);
  const p = "C:/Users/Jefinny/AppData/Local/Temp/dbg-cura.pdf";
  await d.saveAs(p);
  console.log("PDF:", Math.round(fs.statSync(p).size / 1024), "KB");
} catch (e) {
  console.log("erro download:", String(e).slice(0, 200));
  await page.screenshot({ path: "C:/Users/Jefinny/AppData/Local/Temp/dbg-gerarpdf.png" });
}
await browser.close();
await db.end();
