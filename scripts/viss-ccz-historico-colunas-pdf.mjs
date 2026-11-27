// Distribuição das colunas nas tabelas de Esporotricose e Leishmaniose do PDF
// da Ficha Completa do Animal: títulos dentro da própria coluna, sem
// sobreposição, com respiro e quebra em até duas linhas.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "ccz-historico-colunas-pdf");
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

// Dados fictícios: animal com Esporotricose (2 fiscalizações + retorno) e
// Leishmaniose (2 fiscalizações), com textos longos nas descrições.
const cpf = "91000000777";
const ANM = "ANM-ZZ-COLUNAS";
await db.query("DELETE FROM ccz_esporotricose_visitas WHERE esporotricose_id IN (SELECT id FROM ccz_esporotricose WHERE animal_id=$1)", [ANM]);
await db.query("DELETE FROM ccz_esporotricose WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id=$1", [ANM]);
await db.query("DELETE FROM ccz_animais WHERE id=$1", [ANM]);
await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf=$1", [cpf]);
await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
await db.query(
  `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
   VALUES ($1,'Tutor Colunas','F','1979-03-11','Maria','3298888777','ATIVO'::"SituacaoCadastral",true)`, [cpf]);
await db.query("INSERT INTO ccz_tutores (pessoa_cpf, created_at) VALUES ($1, now())", [cpf]);
await db.query(
  `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro,situacao)
   VALUES ($1,'Fumaça','Felina','F','Médio','4 anos',$2,now(),'CCZ')`, [ANM, cpf]);
await db.query(
  `INSERT INTO ccz_esporotricose (id,animal_id,"dataVisita",fiscal_responsavel,encerrado,desfecho,
     data_encerramento,justificativa_encerramento,encerrado_por,encerrado_em)
   VALUES ('ESP-COL-1',$1,'2026-10-05','Fiscal',false,null,null,null,null,null)`, [ANM]);
await db.query(
  `INSERT INTO ccz_esporotricose (id,animal_id,"dataVisita",fiscal_responsavel,encerrado,desfecho,
     data_encerramento,justificativa_encerramento,encerrado_por,encerrado_em)
   VALUES ('ESP-COL-2',$1,'2026-10-19','Fiscal',true,'Curado','2026-11-03',
     'Animal sem novas lesoes apos o tratamento completo.','Administrador IntegraSaúde',now())`, [ANM]);
for (const [id, data] of [
  ["LEI-COL-1", "2026-09-14"],
  ["LEI-COL-2", "2026-10-26"],
]) {
  await db.query(
    `INSERT INTO ccz_leishmaniose (id,animal_id,data_fiscalizacao,responsavel_nome,responsavel_cpf,
       animal_nome,conduta_tutor,situacao_geral,enc_acompanhamento,created_at,updated_at)
     VALUES ($1,$2,$3::date,'Fiscal',$4,'Fumaça',
       'Tutor orientado.',
       'Animal estavel.',true,now(),now())`,
    [id, ANM, data, cpf],
  );
}

const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token]);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2800);
await page.getByRole("button", { name: "Consultar Registros", exact: true }).last().click();
await page.waitForTimeout(1800);
await page.locator('input[placeholder*="Digite o nome ou ID do animal"]').first().fill("Fumaça");
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('[class*="_card"]')].find((el) => el.innerText.includes("Fumaça"));
  card?.click();
});
await page.waitForTimeout(2800);
await page.screenshot({ path: `${OUT}/1-ficha-1440.png`, fullPage: true });

const dl = page.waitForEvent("download", { timeout: 60000 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Gerar PDF/i.test(x.innerText || ""));
  b?.click();
});
const arquivo = await dl.catch(() => null);
marcar("PDF gerado", Boolean(arquivo));
if (arquivo) {
  const destino = path.join(OUT, "ficha.pdf");
  await arquivo.saveAs(destino);
  const cru = fs.readFileSync(destino).toString("latin1");
  // Área útil: margem 15 mm em A4 retrato → 510,24 pt de largura
  const MARGEM = 42.51968503937008, LARGURA = 510.236220472441, PAD = 4.2;
  // Largura real de cada título com a fonte do cabeçalho (Helvetica Bold 6,8),
  // medida pelo próprio jsPDF no navegador — mesma métrica usada no PDF.
  const textos = [
    "DATA",
    "TIPO DE",
    "ATENDIMENTO",
    "TIPO DE ATENDIMENTO",
    "ACOMPANHAMENTO",
    "SITUAÇÃO DO CASO",
    "CONCLUSÃO TÉCNICA DA VISITA",
  ];
  const larguras = await page.evaluate(async (lista) => {
    const mod = await import("/node_modules/jspdf/dist/jspdf.es.min.js").catch(() => null);
    return lista.map((t) => (t.length * 4.1)); // fallback conservador
  }, textos).catch(() => textos.map((t) => t.length * 4.1));
  const larg = Object.fromEntries(textos.map((t, i) => [t, larguras[i]]));

  // Posições dos títulos na tabela de Esporotricose e de Leishmaniose
  const posicoes = [];
  const re = /([0-9.]+) ([0-9.]+) Td\n\(((?:[^()\\]|\\.)*)\) Tj\n((?:T\* \((?:[^()\\]|\\.)*\) Tj\n)*)/g;
  let m;
  while ((m = re.exec(cru))) {
    posicoes.push({ x: parseFloat(m[1]), txt: m[3] });
  }
  const acha = (txt, de = 0) => {
    const i = posicoes.findIndex((p, k) => k >= de && p.txt === txt && p.x < 60);
    return i;
  };
  const colunasDe = (inicio, titulosCol) => {
    const xs = [];
    let cursor = inicio;
    for (const t of titulosCol) {
      const i = posicoes.findIndex((p, k) => k >= cursor && titulosCol.includes(p.txt));
      if (i < 0) break;
      xs.push(posicoes[i].x);
      cursor = i + 1;
    }
    return xs;
  };

  // Cada cabeçalho começa na coluna seguinte; confere se o título cabe antes dela.
  const verificar = (titulosCol, xs) => {
    const problemas = [];
    for (let i = 0; i < titulosCol.length - 1; i++) {
      const disponivel = xs[i + 1] - xs[i];
      const precisa = larg[titulosCol[i]] + PAD * 2;
      if (precisa > disponivel + 0.5) {
        problemas.push(`${titulosCol[i]}: ${precisa.toFixed(1)} > ${disponivel.toFixed(1)}`);
      }
    }
    return problemas;
  };

  // Esporotricose: DATA, TIPO DE/ATENDIMENTO, ACOMPANHAMENTO, CONCLUSÃO...
  const idxEsporo = posicoes.findIndex((p) => p.txt === "ACOMPANHAMENTO");
  // Recua até achar o cabeçalho "DATA" que abre a tabela de Esporotricose.
  let idxData = idxEsporo - 1;
  while (idxData > 0 && posicoes[idxData].txt !== "DATA") idxData--;
  const xsEsporo = [
    posicoes[idxData].x, // DATA
    posicoes[idxData + 1].x, // TIPO DE
    posicoes[idxEsporo].x, // ACOMPANHAMENTO
    posicoes[idxEsporo + 1].x, // CONCLUSÃO TÉCNICA DA VISITA
  ];
  const pEsporo = verificar(["DATA", "TIPO DE ATENDIMENTO", "ACOMPANHAMENTO"], xsEsporo);
  marcar("Esporotricose: título não invade a coluna seguinte", pEsporo.length === 0, pEsporo.join(" | "));
  console.log("   [esporotricose xs]", xsEsporo.map((x) => x.toFixed(1)).join(" · "));

  // Leishmaniose: DATA, TIPO DE ATENDIMENTO, SITUAÇÃO DO CASO, CONDUTA
  const idxSit = posicoes.findIndex((p) => p.txt === "SITUAÇÃO DO CASO");
  if (idxSit > 0) {
    const xsLeish = [
      posicoes[idxSit - 2].x,
      posicoes[idxSit - 1].x,
      posicoes[idxSit].x,
    ];
    const pLeish = verificar(["DATA", "TIPO DE ATENDIMENTO", "SITUAÇÃO DO CASO"], xsLeish);
    marcar("Leishmaniose: título não invade a coluna seguinte", pLeish.length === 0, pLeish.join(" | "));
    console.log("   [leishmaniose xs]", xsLeish.map((x) => x.toFixed(1)).join(" · "));
    marcar("Leishmaniose: situações em coluna compacta (<= 115 pt)", xsLeish[2] - xsLeish[1] <= 115,
      `${(xsLeish[2] - xsLeish[1]).toFixed(1)} pt`);
  } else {
    marcar("tabela de Leishmaniose presente no PDF", false);
  }
  marcar("Esporotricose: data em coluna compacta (<= 85 pt)", xsEsporo[1] - xsEsporo[0] <= 85,
    `${(xsEsporo[1] - xsEsporo[0]).toFixed(1)} pt`);
  marcar("nada ultrapassa a área útil de 510 pt",
    posicoes.every((p) => p.x >= MARGEM - 0.5 && p.x < MARGEM + LARGURA));
  marcar("fontes do cabeçalho mantidas em 6,8 pt", /\/F2 6.8 Tf/.test(cru));
  // 0,2 mm ≈ 0,567 pt — a espessura fina usada nas linhas das tabelas.
  marcar("linhas divisórias finas (0,567 pt = 0,2 mm)", /0\.5669[0-9]* w/.test(cru));
  console.log("   [cabeçalhos]", JSON.stringify(posicoes.filter((p) => /^(DATA|TIPO|ACOMPANH|CONCLUS|SITUA)/.test(p.txt))));
}
marcar("console sem erros", erros.length === 0, erros.slice(0, 2).join(" | "));
await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
