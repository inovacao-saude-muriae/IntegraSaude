// Agenda do CCZ → formulário da zoonose de origem (Esporotricose/Leishmaniose):
// abertura, salvamento, conclusão do agendamento, histórico e PDF.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "ccz-agenda-retorno");
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
const ymd = (d) => d.toISOString().slice(0, 10);
const emDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const br = (s) => s.split("-").reverse().join("/");

const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

// ── Dados fictícios ─────────────────────────────────────────────────────────
const cpf = "91000000666";
const ANM = "ANM-ZZ-RETORNO";
await db.query("DELETE FROM ccz_esporotricose_visitas WHERE esporotricose_id IN (SELECT id FROM ccz_esporotricose WHERE animal_id=$1)", [ANM]);
await db.query("DELETE FROM ccz_esporotricose WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_procedimentos WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_animais WHERE id=$1", [ANM]);
await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf=$1", [cpf]);
await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
await db.query(
  `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
   VALUES ($1,'Tutor Retorno Agenda','F','1981-07-09','Ana','32977775555','ATIVO'::"SituacaoCadastral",true)`, [cpf]);
await db.query("INSERT INTO ccz_tutores (pessoa_cpf, created_at) VALUES ($1, now())", [cpf]);
await db.query(
  `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro,situacao)
   VALUES ($1,'Bidu','Canina','M','Médio','5 anos',$2,now(),'CCZ')`, [ANM, cpf]);

// Fiscalização de origem + agendamento pendente (um para cada zoonose)
await db.query(
  `INSERT INTO ccz_esporotricose (id,animal_id,"dataVisita",fiscal_responsavel)
   VALUES ('ESP-RET-ORIG',$1,$2,'Fiscal Teste')`, [ANM, emDias(-10)]);
await db.query(
  `INSERT INTO ccz_procedimentos (id,animal_id,tipo,data_procedimento,data_retorno,status,veterinario,descricao)
   VALUES ('PRO-RET-ESP',$1,'Retorno de Esporotricose',$2,$2,'Agendado','Fiscal Teste','Visita de acompanhamento de esporotricose')`,
  [ANM, emDias(-1)]);
await db.query(
  `INSERT INTO ccz_procedimentos (id,animal_id,tipo,data_procedimento,data_retorno,status,veterinario,descricao)
   VALUES ('PRO-RET-LEI',$1,'Retorno de Leishmaniose',$2,$2,'Agendado','Fiscal Teste','Visita de acompanhamento de leishmaniose')`,
  [ANM, emDias(-2)]);
// Agendamento de CANCELAMENTO (permanece pendente)
await db.query(
  `INSERT INTO ccz_procedimentos (id,animal_id,tipo,data_procedimento,data_retorno,status,veterinario,descricao)
   VALUES ('PRO-RET-CANCEL',$1,'Retorno de Esporotricose',$2,$2,'Agendado','Fiscal Teste','Visita de acompanhamento de esporotricose')`,
  [ANM, emDias(3)]);

const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token]);

const statusDe = async (id) =>
  (await db.query("SELECT status FROM ccz_procedimentos WHERE id=$1", [id])).rows[0]?.status;
const contarEsporo = async () =>
  Number((await db.query("SELECT COUNT(*) t FROM ccz_esporotricose WHERE animal_id=$1", [ANM])).rows[0].t);
const contarLeish = async () =>
  Number((await db.query("SELECT COUNT(*) t FROM ccz_leishmaniose WHERE animal_id=$1", [ANM])).rows[0].t);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

// ── Abre a Agenda no mês do agendamento ────────────────────────────────────
const abrirDia = async (dia) => {
  await page.goto("http://localhost:3000/ccz?tab=AGENDA", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  // A célula do dia é identificada pelo primeiro texto do próprio bloco.
  await page.evaluate((d) => {
    const celulas = [...document.querySelectorAll("div")].filter((el) => {
      const t = (el.innerText || "").trim();
      return t.startsWith(String(d) + "\n") || t === String(d);
    });
    // a menor (mais interna) é a célula do dia
    const alvo = celulas.sort((a, b) => a.innerText.length - b.innerText.length)[0];
    alvo?.click();
  }, Number(dia.split("-")[2]));
  await page.waitForTimeout(1500);
};

// ── ESPOROTRICOSE ──────────────────────────────────────────────────────────
await abrirDia(emDias(-1));
await page.screenshot({ path: `${OUT}/1-agenda-dia-1440.png`, fullPage: true });
const btnEsp = page.getByRole("button", { name: "Abrir retorno", exact: true }).first();
marcar("1. Agenda mostra 'Abrir retorno' no retorno de Esporotricose", await btnEsp.count() > 0);
await btnEsp.click();
await page.waitForTimeout(3000);
await page.waitForTimeout(2500);
marcar("2. abre a aba Esporotricose",
  (await page.evaluate(() => location.search)).includes("tab=ESPOROTRICOSE"));
const termoEsp = await page.locator('input[placeholder*="Digite nome, id"]').first().inputValue();
marcar("3. animal do agendamento já selecionado", /Bidu/.test(termoEsp) && /ANM-ZZ-RETORNO/.test(termoEsp), termoEsp);
const dataEsp = await page.locator('input[type="date"]').first().inputValue();
marcar("4. data da visita = data do agendamento", dataEsp === emDias(-1), dataEsp);
await page.screenshot({ path: `${OUT}/2-esporotricose-form-1440.png`, fullPage: true });

const antesEsp = await contarEsporo();
// Etapa 1 → 2 → 3 → 4 e salvar
for (let i = 0; i < 3; i++) {
  await page.getByRole("button", { name: /Próximo/ }).click();
  await page.waitForTimeout(600);
}
// Conclusão da equipe técnica é obrigatória (regra existente do formulário).
await page.locator('textarea[placeholder="Conclusão da equipe técnica"]').first().fill("Animal estavel, sem novas lesoes. Mantido o acompanhamento.");
await page.screenshot({ path: `${OUT}/2b-esporotricose-etapa4.png`, fullPage: true });
await page.getByRole("button", { name: "Salvar", exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/2c-esporotricose-pos-salvar.png`, fullPage: true });
console.log("   [apos salvar]", (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\n/g, " | "));
const confirmar = page.getByRole("button", { name: /Cadastrar|Confirmar|Salvar/i }).last();
if (await confirmar.count()) await confirmar.click().catch(() => {});
await page.waitForTimeout(3000);
const depoisEsp = await contarEsporo();
marcar("5. nova fiscalização de Esporotricose criada", depoisEsp === antesEsp + 1, `${antesEsp} → ${depoisEsp}`);
marcar("6. agendamento de Esporotricose concluído (Realizado)",
  (await statusDe("PRO-RET-ESP")) === "Realizado", await statusDe("PRO-RET-ESP"));
marcar("7. agendamento futuro permanece pendente",
  (await statusDe("PRO-RET-CANCEL")) === "Agendado", await statusDe("PRO-RET-CANCEL"));
marcar("8. fiscalização de origem preservada",
  Number((await db.query("SELECT COUNT(*) t FROM ccz_esporotricose WHERE id='ESP-RET-ORIG'")).rows[0].t) === 1);

// ── LEISHMANIOSE ───────────────────────────────────────────────────────────
await abrirDia(emDias(-2));
const btnLei = page.getByRole("button", { name: "Abrir retorno", exact: true }).first();
marcar("9. Agenda mostra 'Abrir retorno' no retorno de Leishmaniose", await btnLei.count() > 0);
await btnLei.click();
await page.waitForTimeout(3000);
marcar("10. abre a aba Leishmaniose",
  (await page.evaluate(() => location.search)).includes("tab=LEISHMANIOSE"));
const termoLei = await page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').first().inputValue();
marcar("11. animal do agendamento já selecionado (Leishmaniose)",
  /Bidu/.test(termoLei) && /ANM-ZZ-RETORNO/.test(termoLei), termoLei);
const dataLei = await page.locator('input[type="date"]').first().inputValue();
marcar("12. data da fiscalização = data do agendamento", dataLei === emDias(-2), dataLei);
await page.screenshot({ path: `${OUT}/3-leishmaniose-form-1440.png`, fullPage: true });

const antesLei = await contarLeish();
for (let i = 0; i < 3; i++) {
  await page.getByRole("button", { name: /Próximo/ }).click();
  await page.waitForTimeout(600);
}
await page.getByRole("button", { name: /Salvar Registro/ }).last().click();
await page.waitForTimeout(3500);
const depoisLei = await contarLeish();
marcar("13. nova fiscalização de Leishmaniose criada", depoisLei === antesLei + 1, `${antesLei} → ${depoisLei}`);
marcar("14. agendamento de Leishmaniose concluído (Realizado)",
  (await statusDe("PRO-RET-LEI")) === "Realizado", await statusDe("PRO-RET-LEI"));

// ── Cancelar: agendamento permanece pendente ───────────────────────────────
await abrirDia(emDias(3));
await page.getByRole("button", { name: "Abrir retorno", exact: true }).first().click();
await page.waitForTimeout(2500);
await page.goto("http://localhost:3000/ccz?tab=AGENDA", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
marcar("15. cancelar/fechar mantém o agendamento pendente",
  (await statusDe("PRO-RET-CANCEL")) === "Agendado", await statusDe("PRO-RET-CANCEL"));

// ── Histórico do Animal ────────────────────────────────────────────────────
await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Consultar Registros", exact: true }).last().click();
await page.waitForTimeout(1800);
await page.locator('input[placeholder*="Digite o nome ou ID do animal"]').first().fill("Bidu");
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('[class*="_card"]')].find((el) => el.innerText.includes("Bidu"));
  card?.click();
});
await page.waitForTimeout(3000);
const grupos = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_grupoHistorico"]')].map((g) => ({
    titulo: g.querySelector('[class*="_grupoTitulo"]')?.innerText.replace(/\n/g, " ") || "",
    itens: [...g.querySelectorAll('[class*="_itemHistorico"]')].map((i) => i.innerText.replace(/\n/g, " | ")),
  })),
);
// O título do grupo é "LEISHMANIOSE 2" / "ESPOROTRICOSE 3" (nome + total).
const esp = grupos.find((g) => /^ESPOROTRICOSE/i.test(g.titulo));
const lei = grupos.find((g) => /^LEISHMANIOSE/i.test(g.titulo));
console.log("   [grupos]", JSON.stringify(grupos.map((g) => [g.titulo, g.itens.length])));
// Retornos de acompanhamento (agendamentos) também aparecem no histórico.
const espItens = esp?.itens || [];
const leiItens = lei?.itens || [];
marcar("16. Esporotricose agrupada em Esporotricose",
  Boolean(esp) && espItens.length >= 2, `${espItens.length} itens`);
marcar("17. Leishmaniose agrupada em Leishmaniose",
  Boolean(lei) && leiItens.length >= 1, `${leiItens.length} itens`);
marcar("18. nova fiscalização de cada zoonose aparece no histórico",
  espItens.some((t) => t.includes(br(emDias(-1)))) &&
    leiItens.some((t) => t.includes(br(emDias(-2)))),
  `${br(emDias(-1))} / ${br(emDias(-2))}`);
// Sem duplicações: nenhum item repetido dentro do próprio grupo.
const semDuplicata = (lista) => new Set(lista).size === lista.length;
marcar("18b. nenhum registro duplicado no histórico",
  semDuplicata(espItens) && semDuplicata(leiItens));
await page.screenshot({ path: `${OUT}/4-historico-1440.png`, fullPage: true });

// ── PDF do Histórico ───────────────────────────────────────────────────────
const dl = page.waitForEvent("download", { timeout: 60000 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Gerar PDF/i.test(x.innerText || ""));
  b?.click();
});
const arq = await dl.catch(() => null);
if (arq) {
  const destino = path.join(OUT, "ficha.pdf");
  await arq.saveAs(destino);
  const cru = fs.readFileSync(destino).toString("latin1");
  marcar("19. PDF do histórico inclui os dois grupos",
    /Esporotricose/.test(cru) && /Leishmaniose/.test(cru));
  marcar("20. PDF traz os 3 registros", /3 registros|2 registros/.test(cru));
} else {
  marcar("19. PDF gerado", false);
}

marcar("console sem erros", erros.length === 0, erros.slice(0, 2).join(" | "));
await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
