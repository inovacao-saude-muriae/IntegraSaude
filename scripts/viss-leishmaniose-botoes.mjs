// Valida as cores e o comportamento dos botões do encerramento da Leishmaniose.
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
const OUT = path.join(process.env.TEMP, "leishmaniose-botoes");
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const ok = (m) => log.push(`OK   ${m}`);
const falha = (m) => log.push(`FALHA ${m}`);

async function main() {
  await db.connect();
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

  // garante um caso em acompanhamento para o teste
  await db.query(
    "UPDATE ccz_leishmaniose SET situacao_caso='EM_ACOMPANHAMENTO', desfecho=NULL, data_encerramento=NULL, justificativa_encerramento=NULL, encerrado_por_cpf=NULL, encerrado_por_nome=NULL, encerrado_em=NULL WHERE id='LEISH-ZZ-ANT'",
  );

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/i.test(m.text())) erros.push(m.text());
  });

  await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1800);
  await page.locator('table tbody tr:has-text("ZZTESTE Cura")').first().click();
  await page.waitForTimeout(1600);

  // 1. Botão Encerrar Caso verde
  const btnEncerrar = page.getByRole("button", { name: /Encerrar Caso/ });
  const estilo = await btnEncerrar.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, cor: cs.color, borda: cs.borderTopColor };
  });
  if (estilo.bg === "rgb(21, 128, 61)" && estilo.cor === "rgb(255, 255, 255)") {
    ok(`Encerrar Caso verde com texto branco (${estilo.bg} / ${estilo.cor})`);
  } else falha(`cor do Encerrar Caso incorreta: ${JSON.stringify(estilo)}`);
  await page.screenshot({ path: path.join(OUT, "1-encerrar-verde-1440.png") });

  // 2. Modal: botão cinza e desabilitado no estado inicial
  await btnEncerrar.click();
  await page.waitForTimeout(800);
  const modal = page.locator('[role="dialog"][aria-label="Encerrar caso de leishmaniose"]');
  const confirmar = modal.getByRole("button", { name: /Confirmar Encerramento/ });
  const inicial = await confirmar.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    cor: getComputedStyle(el).color,
    disabled: el.disabled,
    aria: el.getAttribute("aria-disabled"),
  }));
  if (inicial.disabled && inicial.aria === "true" && inicial.bg === "rgb(241, 245, 249)") {
    ok(`Confirmar Encerramento cinza e desabilitado no estado inicial (${inicial.bg})`);
  } else falha(`estado inicial incorreto: ${JSON.stringify(inicial)}`);
  await page.screenshot({ path: path.join(OUT, "2-confirmar-desabilitado-1440.png") });

  // 3. Desfecho + data, sem justificativa: continua desabilitado
  await modal.locator("select").selectOption("Curado");
  await modal.locator('input[type="date"]').fill("2026-11-20");
  await page.waitForTimeout(400);
  const semJust = await confirmar.evaluate((el) => el.disabled);
  if (semJust) ok("sem justificativa o botão continua desabilitado");
  else falha("botão habilitou sem justificativa");

  // 4. Justificativa curta (menos de 15): desabilitado
  await modal.locator("textarea").fill("Curou");
  await page.waitForTimeout(400);
  if (await confirmar.evaluate((el) => el.disabled)) ok("justificativa com menos de 15 caracteres mantém o botão desabilitado");
  else falha("botão habilitou com justificativa inválida");
  await page.screenshot({ path: path.join(OUT, "3-justificativa-invalida-1440.png") });

  // 5. Justificativa válida: verde e habilitado
  await modal.locator("textarea").fill("Animal curado, sem lesões ativas após o tratamento completo.");
  await page.waitForTimeout(500);
  const valido = await confirmar.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    cor: getComputedStyle(el).color,
    disabled: el.disabled,
  }));
  if (!valido.disabled && valido.bg === "rgb(21, 128, 61)" && valido.cor === "rgb(255, 255, 255)") {
    ok(`com todos os campos válidos o botão fica verde e habilitado (${valido.bg})`);
  } else falha(`estado válido incorreto: ${JSON.stringify(valido)}`);
  await page.screenshot({ path: path.join(OUT, "4-confirmar-verde-1440.png") });

  // 6. Apagar a justificativa volta ao estado desabilitado
  await modal.locator("textarea").fill("");
  await page.waitForTimeout(400);
  const voltou = await confirmar.evaluate((el) => ({ disabled: el.disabled, bg: getComputedStyle(el).backgroundColor }));
  if (voltou.disabled && voltou.bg === "rgb(241, 245, 249)") ok("apagar a justificativa devolve o botão ao estado cinza/desabilitado");
  else falha(`não voltou ao estado desabilitado: ${JSON.stringify(voltou)}`);

  // 7. Clique duplo durante o salvamento não duplica o registro
  await modal.locator("textarea").fill("Animal curado, sem lesões ativas após o tratamento completo.");
  await page.waitForTimeout(400);
  const antes = (
    await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE entidade_id='LEISH-ZZ-ANT' AND acao='ENCERRAR'")
  ).rows[0].n;
  await confirmar.click();
  await page.waitForTimeout(600);
  // confirma no diálogo de confirmação
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[role="alertdialog"] button, [class*="_overlay"] button')).find((x) =>
      /^(Confirmar|Encerrar)$/i.test(x.textContent.trim()),
    );
    if (b) b.click();
    if (b) b.click();
  });
  await page.waitForTimeout(3000);
  const depois = (
    await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE entidade_id='LEISH-ZZ-ANT' AND acao='ENCERRAR'")
  ).rows[0].n;
  if (depois === antes + 1) ok("clique duplo gera apenas um encerramento (sem duplicidade)");
  else falha(`duplicidade no encerramento: antes ${antes}, depois ${depois}`);

  if (erros.length === 0) ok("console limpo (sem erros)");
  else falha(`erros no console: ${JSON.stringify(erros.slice(0, 2))}`);

  await browser.close();
  await db.end();
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
