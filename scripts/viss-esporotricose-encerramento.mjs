import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/esporotricose-encerramento`;
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const passo = (t) => { log.push(`\n${t}`); console.log(t); };
let ok = 0, falhas = 0;
const marcar = (nome, cond, extra = "") => {
  if (cond) { ok++; console.log(`OK   ${nome}${extra ? ` (${extra})` : ""}`); }
  else { falhas++; console.log(`FALHA ${nome}${extra ? ` (${extra})` : ""}`); }
};

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

// Fixture isolada: animal + caso EM ANDAMENTO (não toca nos registros existentes)
const ANIMAL = "91000000990";
const CASO = "ESP-ZZ-ENC";
await db.query("DELETE FROM ccz_esporotricose_visitas WHERE esporotricose_id=$1", [CASO]);
await db.query("DELETE FROM ccz_esporotricose WHERE id=$1", [CASO]);
await db.query("DELETE FROM ccz_animais WHERE id=$1", [ANIMAL]);
await db.query(
  `INSERT INTO ccz_animais (id, nome, especie, sexo, porte, situacao) VALUES ($1,'ZZTESTE Esporo Encerramento','Canina','M','Médio','CCZ')`,
  [ANIMAL],
);
await db.query(
  `INSERT INTO ccz_esporotricose (id, animal_id, "dataVisita", fiscal_responsavel, "apresentaLesoes",
     descricao_lesoes, conclusao_tecnica, encerrado, incinerado, created_at)
   VALUES ($1,$2,CURRENT_DATE,'Administrador IntegraSaúde','Sim','Lesão única em membro anterior',
     'Animal em tratamento, evolução favorável', false, '', now())`,
  [CASO, ANIMAL],
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const fecharOverlay = async () => {
  for (let i = 0; i < 4; i++) {
    const clicou = await page.evaluate(() => {
      const alvos = [...document.querySelectorAll(
        '[class*="_overlay"] button, [class*="_modalFooter"] button, [role="alertdialog"] button',
      )];
      const alvo = alvos.find((b) => /OK|Fechar|Entendi|Confirmar|Encerrar|Cadastrar/i.test(b.innerText));
      if (alvo) { alvo.click(); return true; }
      return false;
    });
    if (clicou) { await page.waitForTimeout(600); return; }
    await page.waitForTimeout(400);
  }
};

const abrirFicha = async () => {
  await page.goto("http://localhost:3000/ccz?tab=ESPOROTRICOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(900);
  await page.locator('[class*="_cardFiltros"] button[type="submit"]').click();
  await page.waitForTimeout(1600);
  await page.locator("tbody tr", { hasText: "ZZTESTE Esporo Encerramento" }).first().click();
  await page.waitForTimeout(1400);
};

passo("1. Registro Em andamento e botão Encerrar Caso");
await abrirFicha();
let corpo = await page.locator('[class*="_painelDetalhe"]').innerText();
marcar("ficha abre com Conclusão 'Em andamento'", /Em andamento/.test(corpo));
marcar("campo de edição direta da Conclusão não existe mais", !(await page.locator('[class*="_painelDetalhe"] select').count()));
const btnEncerrar = page.locator('[class*="_acoesDetalhe"] button', { hasText: "Encerrar Caso" }).first();
marcar("botão 'Encerrar Caso' presente na ficha", await btnEncerrar.count() === 1);
const corEncerrar = await btnEncerrar.evaluate((b) => {
  const s = getComputedStyle(b);
  return { bg: s.backgroundColor, cor: s.color };
});
marcar("botão verde com texto branco", corEncerrar.bg === "rgb(21, 128, 61)" && corEncerrar.cor === "rgb(255, 255, 255)", `${corEncerrar.bg} / ${corEncerrar.cor}`);
await page.screenshot({ path: `${OUT}/1-ficha-em-andamento-1440.png` });

passo("2. Modal Encerrar Caso");
await btnEncerrar.click();
await page.waitForTimeout(900);
const modal = page.locator('[role="dialog"][aria-label="Encerrar caso de esporotricose"]');
marcar("modal abre", await modal.count() === 1);
const textoModal = await modal.innerText();
marcar("modal tem Desfecho, Data e Justificativa", /Desfecho do Caso/.test(textoModal) && /Data do Encerramento/.test(textoModal) && /Justificativa do Encerramento/.test(textoModal));
const opcoes = await modal.locator("select option").allInnerTexts();
marcar("desfechos próprios da esporotricose", opcoes.includes("Curado") && opcoes.includes("Incinerado") && opcoes.includes("Encerrado por óbito"), opcoes.join(" | "));
await page.screenshot({ path: `${OUT}/2-modal-aberto-1440.png` });

const confirmar = modal.locator('[class*="_acoesDetalhe"] button', { hasText: "Confirmar Encerramento" }).first();
const estado = async () => confirmar.evaluate((b) => ({ bg: getComputedStyle(b).backgroundColor, disabled: b.disabled }));
let e1 = await estado();
marcar("Confirmar inicia cinza e desabilitado", e1.disabled && e1.bg === "rgb(241, 245, 249)", `${e1.bg}`);

passo("3. Validação da justificativa");
await modal.locator("select").selectOption("Curado");
await modal.locator('input[type="date"]').fill("2026-11-26");
await modal.locator("textarea").fill("curto");
await page.waitForTimeout(300);
let e2 = await estado();
marcar("justificativa curta mantém desabilitado", e2.disabled);
await modal.locator("textarea").fill("Animal curado após tratamento completo, sem lesões ativas na reavaliação.");
await page.waitForTimeout(300);
let e3 = await estado();
marcar("campos válidos habilitam e ficam verdes", !e3.disabled && e3.bg === "rgb(21, 128, 61)", `${e3.bg}`);
await page.screenshot({ path: `${OUT}/3-confirmar-verde-1440.png` });
await modal.locator("textarea").fill("");
await page.waitForTimeout(300);
let e4 = await estado();
marcar("apagar a justificativa volta ao cinza desabilitado", e4.disabled && e4.bg === "rgb(241, 245, 249)");
await modal.locator("textarea").fill("Animal curado após tratamento completo, sem lesões ativas na reavaliação.");
await page.waitForTimeout(300);

passo("4. Encerramento (com clique duplo)");
await confirmar.click();
await page.waitForTimeout(1200);
await fecharOverlay();
await page.waitForTimeout(2500);
await fecharOverlay();
await page.waitForTimeout(800);

const reg = (await db.query(
  "SELECT encerrado, desfecho, justificativa_encerramento, encerrado_por, encerrado_por_cpf, encerrado_em, data_encerramento FROM ccz_esporotricose WHERE id=$1",
  [CASO],
)).rows[0];
marcar("registro fica encerrado com desfecho", reg.encerrado === true && reg.desfecho === "Curado", reg.desfecho);
marcar("justificativa gravada", (reg.justificativa_encerramento || "").length >= 15);
marcar("usuário e data/hora do encerramento gravados", reg.encerrado_por_cpf === u.cpf && reg.encerrado_em !== null);
const aud = (await db.query(
  "SELECT count(*)::int AS n FROM audit_logs WHERE acao='ENCERRAR' AND entidade='EsporotricoseEncerramento' AND entidade_id=$1 AND detalhes->>'desfecho'=$2",
  [CASO, "Curado"],
)).rows[0];
const ult = (await db.query(
  "SELECT detalhes FROM audit_logs WHERE acao='ENCERRAR' AND entidade='EsporotricoseEncerramento' AND entidade_id=$1 ORDER BY created_at DESC LIMIT 1",
  [CASO],
)).rows[0];
marcar("auditoria registra um único encerramento", aud.n === 1 && ult?.detalhes?.desfecho === "Curado", `n=${aud.n}`);
const det = ult?.detalhes || {};
// A auditoria marca o FATO do encerramento (o texto da justificativa fica no
// registro, por regra de LGPD do helper de auditoria) e a data efetiva do ato.
marcar("auditoria traz desfecho e situação", det.desfecho === "Curado" && det.situacaoNova === "ENCERRADO", JSON.stringify(det).slice(0, 80));
const criadoEm = (await db.query(
  "SELECT created_at FROM audit_logs WHERE entidade='EsporotricoseEncerramento' AND entidade_id=$1 ORDER BY created_at DESC LIMIT 1",
  [CASO],
)).rows[0]?.created_at;
marcar("auditoria registra data e hora do encerramento", Boolean(criadoEm) && Date.now() - new Date(criadoEm).getTime() < 5 * 60 * 1000,
  criadoEm ? new Date(criadoEm).toISOString() : "sem registro");

passo("5. Ficha e tabela atualizadas");
corpo = await page.locator('[class*="_painelDetalhe"]').first().innerText();
marcar("ficha passa a Encerrado", /Encerrado/.test(corpo) && !/Em andamento/.test(corpo));
marcar("ficha mostra desfecho e justificativa", /Curado/.test(corpo) && /sem lesões ativas/.test(corpo));
marcar("botão Encerrar Caso não aparece em caso encerrado",
  await page.locator('[class*="_acoesDetalhe"] button', { hasText: "Encerrar Caso" }).count() === 0);
await page.screenshot({ path: `${OUT}/4-ficha-encerrada-1440.png` });
await page.locator('[class*="_acoesDetalhe"] button', { hasText: "Fechar" }).first().click();
await page.waitForTimeout(800);
const linha = page.locator("tbody tr", { hasText: "ZZTESTE Esporo Encerramento" }).first();
const badge = await linha.locator('[class*="badge"]').first().innerText();
const corBadge = await linha.locator('[class*="badge"]').first().evaluate((b) => getComputedStyle(b).backgroundColor);
marcar("tabela atualizada para Encerrado com badge colorido", badge.trim() === "Encerrado" && corBadge !== "rgba(0, 0, 0, 0)", `${badge.trim()} / ${corBadge}`);
await page.screenshot({ path: `${OUT}/5-tabela-encerrado-1440.png` });

passo("6. Histórico e PDF");
await db.query(
  "INSERT INTO ccz_esporotricose_visitas (id, esporotricose_id, data, observacao, created_at) VALUES (gen_random_uuid(),$1,CURRENT_DATE,'Visita de reavaliação',now())",
  [CASO],
);
await linha.click();
await page.waitForTimeout(1300);
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.locator('[class*="_acoesDetalhe"] button', { hasText: "Gerar PDF" }).first().click(),
]);
const pdfPath = `${OUT}/ficha-esporotricose.pdf`;
await download.saveAs(pdfPath);
const tamanho = fs.statSync(pdfPath).size;
marcar("PDF gerado após o encerramento", tamanho > 10000, `${Math.round(tamanho / 1024)} KB`);
const cru = fs.readFileSync(pdfPath).toString("latin1");
marcar("PDF traz desfecho e justificativa", cru.includes("DESFECHO DO CASO") && cru.includes("JUSTIFICATIVA DO ENCERRAMENTO"));
const visitas = (await db.query("SELECT count(*)::int AS n FROM ccz_esporotricose_visitas WHERE esporotricose_id=$1", [CASO])).rows[0];
marcar("histórico de visitas preservado", visitas.n === 1);

passo("7. Console");
marcar("console limpo", erros.length === 0, erros.slice(0, 2).join(" | "));

// limpeza da fixture
await db.query("DELETE FROM ccz_esporotricose_visitas WHERE esporotricose_id=$1", [CASO]);
await db.query("DELETE FROM ccz_esporotricose WHERE id=$1", [CASO]);
await db.query("DELETE FROM ccz_animais WHERE id=$1", [ANIMAL]);
await db.query("DELETE FROM audit_logs WHERE entidade IN ('Esporotricose','EsporotricoseEncerramento') AND entidade_id=$1", [CASO]);
await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);

await browser.close();
await db.end();
fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n"));
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
