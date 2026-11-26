// Tarefa 67 — etapa Manejo da Leishmaniose: campos complementares SEMPRE
// visíveis ao lado da pergunta, desabilitados até a resposta "Sim".
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "leishmaniose-manejo");
fs.mkdirSync(OUT, { recursive: true });

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}

let ok = 0;
let falhas = 0;
const marcar = (nome, cond, det = "") => {
  if (cond) {
    ok++;
    console.log(`OK   ${nome} ${det}`);
  } else {
    falhas++;
    console.log(`FALHA ${nome} ${det}`);
  }
};

const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const cpf = "91000000994";
const ANIMAL = "ANM-ZZ-LAY";
await db.query("DELETE FROM ccz_procedimentos WHERE animal_id=$1", [ANIMAL]);
await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id=$1", [ANIMAL]);
await db.query("DELETE FROM ccz_animais WHERE id=$1", [ANIMAL]);
await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf=$1", [cpf]);
await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
await db.query(
  `INSERT INTO pessoa (cpf, nome_completo, sexo, data_nascimento, nome_mae, telefone, situacao, ativo)
   VALUES ($1,'ZZTESTE Layout Manejo','M','1990-01-01','Mae','32999990000','ATIVO'::"SituacaoCadastral",true)`,
  [cpf],
);
await db.query("INSERT INTO ccz_tutores (pessoa_cpf, created_at) VALUES ($1, now())", [cpf]);
await db.query(
  `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro,situacao)
   VALUES ($1,'ZZTESTE Layout','Canina','M','Médio','3 anos',$2,now(),'CCZ')`,
  [ANIMAL, cpf],
);

const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text());
});

await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2800);
const inp = page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').first();
await inp.click();
await page.waitForTimeout(500);
await inp.fill("ZZTESTE Layout");
await page.waitForTimeout(2000);
const caixa = await page.evaluate(() => {
  const l = [...document.querySelectorAll('[class*="_tableDropdownMenu"] tbody tr')].find((t) =>
    t.innerText.includes("ZZTESTE Layout"),
  );
  const r = l?.getBoundingClientRect();
  return r ? { x: r.x + 40, y: r.y + r.height / 2 } : null;
});
if (caixa) await page.mouse.click(caixa.x, caixa.y);
await page.waitForTimeout(1200);
for (let i = 0; i < 4; i++) {
  const naEtapa = await page.evaluate(() =>
    [...document.querySelectorAll("h3")].some((h) => /MANEJO E BIOSSEGURAN/i.test(h.innerText)),
  );
  if (naEtapa) break;
  await page.getByRole("button", { name: /Próximo/ }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1100);
}

// Mede todos os grupos condicionais das duas seções
const medir = () =>
  page.evaluate(() => {
    const h3s = [...document.querySelectorAll("h3")];
    const sec = (re) => h3s.find((h) => re.test(h.innerText))?.closest("section");
    const dados = (s) => {
      if (!s) return [];
      const grid = s.children[1];
      const campos = [...(grid?.children || [])].map((c) => {
        const rc = c.getBoundingClientRect();
        const sel = c.querySelector("select");
        const anexo = c.querySelector('[class*="_colAnexo"] input, [class*="_colAnexo"] textarea');
        const rs = sel?.getBoundingClientRect();
        const ra = anexo?.getBoundingClientRect();
        return {
          rotulo: c.querySelector("label")?.innerText.trim().slice(0, 46),
          top: Math.round(rc.top),
          largura: Math.round(rc.width),
          temSelect: Boolean(sel),
          selectW: rs ? Math.round(rs.width) : 0,
          selectH: rs ? Math.round(rs.height) : null,
          anexoVisivel: Boolean(ra) && ra.width > 0,
          anexoLado: ra && rs ? Math.abs(ra.top - rs.top) <= 2 : null,
          anexoDentro: ra ? ra.right <= rc.right + 1 : null,
          anexoDesabilitado: anexo ? anexo.disabled : null,
          anexoFundo: anexo ? getComputedStyle(anexo).backgroundColor : null,
          selectDesabilitado: sel ? sel.disabled : null,
          selectFundo: sel ? getComputedStyle(sel).backgroundColor : null,
        };
      });
      return { cols: getComputedStyle(grid).gridTemplateColumns.split(" ").length, campos };
    };
    return {
      manejo: dados(sec(/MANEJO E BIOSSEGURAN/i)),
      outros: dados(sec(/OUTROS ANIMAIS E PESSOAS/i)),
    };
  });

// ── 1. Sem respostas ───────────────────────────────────────────────────
const vazio = await medir();
await page.screenshot({ path: `${OUT}/1-vazio-1440.png`, fullPage: true });
const gruposVazio = [...vazio.manejo.campos, ...vazio.outros.campos].filter((c) => c.temSelect && c.anexoVisivel !== undefined);
marcar(
  "1. sem resposta: todos os complementares visíveis",
  [...vazio.manejo.campos, ...vazio.outros.campos].filter((c) => c.anexoVisivel).length === 5,
  JSON.stringify([...vazio.manejo.campos, ...vazio.outros.campos].filter((c) => c.anexoVisivel).map((c) => c.rotulo.slice(0, 22))),
);
marcar(
  "1. sem resposta: complementares desabilitados",
  [...vazio.manejo.campos, ...vazio.outros.campos].filter((c) => c.anexoVisivel).every((c) => c.anexoDesabilitado === true),
);
marcar(
  "1. sem resposta: complementar com fundo cinza (leitura)",
  [...vazio.manejo.campos, ...vazio.outros.campos].filter((c) => c.anexoVisivel).every((c) => c.anexoFundo === "rgb(226, 232, 240)"),
  JSON.stringify([...new Set([...vazio.manejo.campos, ...vazio.outros.campos].filter((c) => c.anexoVisivel).map((c) => c.anexoFundo))]),
);
marcar(
  "1. sem resposta: complementar ao lado do select, dentro do grupo",
  [...vazio.manejo.campos, ...vazio.outros.campos].filter((c) => c.anexoVisivel).every((c) => c.anexoLado && c.anexoDentro),
);
marcar("1. sem resposta: campos com 40px", [...vazio.manejo.campos, ...vazio.outros.campos].filter((c) => c.selectH).every((c) => c.selectH === 40));
marcar("1. sem resposta: grid de 12 colunas", vazio.manejo.cols === 12 && vazio.outros.cols === 12);
marcar(
  "1. sem resposta: 'orientação médica' visível e desabilitada",
  (() => {
    const c = vazio.outros.campos.find((x) => /orientadas a procurar/i.test(x.rotulo));
    return c && c.temSelect && c.selectDesabilitado === true && c.selectFundo === "rgb(226, 232, 240)";
  })(),
  JSON.stringify(vazio.outros.campos.map((c) => c.rotulo.slice(0, 20))),
);

// ── 2. Não em todos: continua visível e desabilitado ───────────────────
const responderTodos = async (v) => {
  await page.evaluate((valor) => {
    for (const s of document.querySelectorAll('[class*="_rowComposta"] select')) {
      s.value = valor;
      s.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, v);
  await page.waitForTimeout(600);
};
await responderTodos("Não");
const nao = await medir();
await page.screenshot({ path: `${OUT}/2-todos-nao-1440.png`, fullPage: true });
marcar(
  "2. Não: complementares seguem visíveis",
  [...nao.manejo.campos, ...nao.outros.campos].filter((c) => c.anexoVisivel).length === 5,
);
marcar(
  "2. Não: complementares desabilitados",
  [...nao.manejo.campos, ...nao.outros.campos].filter((c) => c.anexoVisivel).every((c) => c.anexoDesabilitado === true),
);
marcar(
  "2. Não: mesma posição do estado inicial (nada deslocado)",
  nao.manejo.campos.map((c) => c.top - nao.manejo.campos[0].top).join() ===
    vazio.manejo.campos.map((c) => c.top - vazio.manejo.campos[0].top).join(),
);

// ── 3. Sim em todos: habilitados ───────────────────────────────────────
await responderTodos("Sim");
const sim = await medir();
await page.screenshot({ path: `${OUT}/3-todos-sim-1440.png`, fullPage: true });
marcar(
  "3. Sim: complementares habilitados",
  [...sim.manejo.campos, ...sim.outros.campos].filter((c) => c.anexoVisivel).every((c) => c.anexoDesabilitado === false),
);
marcar(
  "3. Sim: complementar com estilo normal (fundo branco)",
  [...sim.manejo.campos, ...sim.outros.campos].filter((c) => c.anexoVisivel).every((c) => c.anexoFundo === "rgb(255, 255, 255)"),
  JSON.stringify([...new Set([...sim.manejo.campos, ...sim.outros.campos].filter((c) => c.anexoVisivel).map((c) => c.anexoFundo))]),
);
marcar(
  "3. Sim: nada deslocado em relação ao estado inicial",
  sim.manejo.campos.map((c) => c.top - sim.manejo.campos[0].top).join() ===
    vazio.manejo.campos.map((c) => c.top - vazio.manejo.campos[0].top).join(),
);
marcar(
  "3. Sim: 'orientação médica' habilitada",
  (() => {
    const c = sim.outros.campos.find((x) => /orientadas a procurar/i.test(x.rotulo));
    return c && c.selectDesabilitado === false;
  })(),
);

// ── 4. Alternância Sim → Não (limpa) → Sim ─────────────────────────────
const primeiro = page.locator('[class*="_rowComposta"]').first();
await primeiro.locator('[class*="_colAnexo"] input').fill("a cada 3 meses");
await primeiro.locator("select").selectOption("Não");
await page.waitForTimeout(500);
const aposNao = await page.evaluate(() => {
  const g = document.querySelector('[class*="_rowComposta"]');
  const i = g.querySelector('[class*="_colAnexo"] input');
  return { valor: i.value, disabled: i.disabled, visivel: i.getBoundingClientRect().width > 0 };
});
marcar(
  "4. Sim→Não: campo visível, desabilitado e valor limpo",
  aposNao.visivel && aposNao.disabled && aposNao.valor === "",
  JSON.stringify(aposNao),
);
await primeiro.locator("select").selectOption("Sim");
await page.waitForTimeout(400);
const voltou = await page.evaluate(() => {
  const i = document.querySelector('[class*="_colAnexo"] input');
  return { disabled: i.disabled, valor: i.value };
});
marcar("4. Não→Sim: reabilitado", voltou.disabled === false, JSON.stringify(voltou));

// ── 5. Vários Sim simultâneos (mantém os demais) ───────────────────────
await page.evaluate(() => {
  const sels = [...document.querySelectorAll('[class*="_rowComposta"] select')];
  sels[1].value = "Não";
  sels[1].dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(500);
const misto = await medir();
marcar(
  "5. Sim/Não simultâneos: habilitados só os Sim",
  [...misto.manejo.campos, ...misto.outros.campos].filter((c) => c.anexoVisivel).filter((c) => c.anexoDesabilitado === false).length === 4,
  JSON.stringify([...misto.manejo.campos, ...misto.outros.campos].filter((c) => c.anexoVisivel).map((c) => c.anexoDesabilitado)),
);
await page.screenshot({ path: `${OUT}/4-misto-1440.png`, fullPage: true });

// ── 6. Navegação entre etapas sem perda ────────────────────────────────
await page.getByRole("button", { name: /Próximo/ }).first().click({ force: true });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Anterior/ }).first().click({ force: true });
await page.waitForTimeout(1200);
const voltouEtapa = await medir();
// o estado do formulário é preservado ao navegar entre etapas
const antesIda = [...misto.manejo.campos, ...misto.outros.campos]
  .filter((c) => c.anexoVisivel)
  .map((c) => c.anexoDesabilitado);
const depoisVolta = [...voltouEtapa.manejo.campos, ...voltouEtapa.outros.campos]
  .filter((c) => c.anexoVisivel)
  .map((c) => c.anexoDesabilitado);
marcar(
  "6. navegação: respostas e estados preservados",
  JSON.stringify(antesIda) === JSON.stringify(depoisVolta) &&
    depoisVolta.filter((d) => d === false).length === 4,
  `${JSON.stringify(antesIda)} vs ${JSON.stringify(depoisVolta)}`,
);

// ── 7. Mobile ──────────────────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(800);
const mobile = await page.evaluate(() => {
  const h3 = [...document.querySelectorAll("h3")].find((h) => /MANEJO E BIOSSEGURAN/i.test(h.innerText));
  const grid = h3.closest("section").children[1];
  const campo = [...grid.children].find((c) => c.querySelector('[class*="_rowComposta"]'));
  const rc = campo.getBoundingClientRect();
  const sel = campo.querySelector("select").getBoundingClientRect();
  const an = campo.querySelector('[class*="_colAnexo"] input').getBoundingClientRect();
  return {
    cols: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
    anexoVisivel: an.width > 0,
    dentroDoCampo: an.right <= rc.right + 1,
    empilhado: an.top >= sel.bottom - 1,
    mesmaLargura: Math.abs(an.width - rc.width) <= 2,
  };
});
await page.screenshot({ path: `${OUT}/5-mobile-390.png`, fullPage: true });
marcar(
  "7. mobile: coluna única, complementar visível e empilhado no mesmo grupo",
  mobile.cols === 1 && mobile.anexoVisivel && mobile.dentroDoCampo && mobile.empilhado,
  JSON.stringify(mobile),
);

marcar("console sem erros", erros.length === 0, erros.slice(0, 3).join(" | "));
await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
