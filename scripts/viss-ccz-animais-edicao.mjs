// Validação da Tarefa 64 — edição do animal (Cancelar/navegação), exclusão,
// colunas do histórico e layout dos condicionais da Leishmaniose.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const env = {};
for (const linha of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}

const OUT = path.join(process.env.TEMP, "ccz-animais-edicao");
fs.mkdirSync(OUT, { recursive: true });

const CPF = "91000000971";
const ANIMAL_OK = "ANM-ZZ-DEL-OK"; // sem vínculos: pode excluir
const ANIMAL_HIST = "ANM-ZZ-DEL-HIST"; // com fiscalização: bloqueado

let ok = 0;
let falha = 0;
const marcar = (nome, cond, extra = "") => {
  if (cond) {
    ok += 1;
    console.log("OK  ", nome, extra);
  } else {
    falha += 1;
    console.log("FALHA", nome, extra);
  }
};

const db = new Client({ connectionString: env.DATABASE_URL });

async function limpar() {
  await db.query("DELETE FROM ccz_leishmaniose_equipe WHERE leishmaniose_id LIKE 'LEISH-ZZ-ED%'");
  await db.query("DELETE FROM ccz_leishmaniose WHERE id LIKE 'LEISH-ZZ-ED%'");
  await db.query("DELETE FROM ccz_procedimentos WHERE animal_id = ANY($1)", [[ANIMAL_OK, ANIMAL_HIST]]);
  await db.query("DELETE FROM ccz_animais WHERE id = ANY($1)", [[ANIMAL_OK, ANIMAL_HIST]]);
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf = $1", [CPF]);
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf = $1", [CPF]);
  await db.query("DELETE FROM pessoa WHERE cpf = $1", [CPF]);
}

async function fixtures() {
  await limpar();
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
     VALUES ($1,'ZZTESTE Tutor Edicao','M','1980-05-11','ZZTESTE Mãe','32999990111','ATIVO',true)`,
    [CPF],
  );
  await db.query(`INSERT INTO ccz_tutores (pessoa_cpf,created_at) VALUES ($1, now())`, [CPF]);
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,raca_pelagem,possui_identificacao,pessoa_cpf,data_cadastro)
     VALUES ($1,'ZZTESTE Excluivel','Canina','M','Médio','2 anos','SRD','Sim',$2,now())`,
    [ANIMAL_OK, CPF],
  );
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro)
     VALUES ($1,'ZZTESTE Com Historico','Felina','F','Pequeno','4 anos',$2,now())`,
    [ANIMAL_HIST, CPF],
  );
  await db.query(
    `INSERT INTO ccz_leishmaniose (id,animal_id,responsavel_nome,responsavel_cpf,data_fiscalizacao,updated_at)
     VALUES ('LEISH-ZZ-ED1',$1,'ZZTESTE Fiscal','00000000000','2026-11-20',now())`,
    [ANIMAL_HIST],
  );
}

async function sessao() {
  const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  await db.query(
    "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
    [u.cpf, token],
  );
  return token;
}

async function abrirAnimal(page, termo) {
  await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page.waitForTimeout(2400);
  await page.evaluate((t) => {
    const card = [...document.querySelectorAll('[class*="_card"]')].find((el) => el.innerText.includes(t));
    card?.click();
  }, termo);
  await page.waitForTimeout(2800);
}

async function main() {
  await db.connect();
  await fixtures();
  const token = await sessao();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  await context.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/favicon/i.test(t)) erros.push(t);
  });

  // ── 1. Editar e Cancelar ────────────────────────────────────────────────
  await abrirAnimal(page, "ZZTESTE Com Historico");
  await page.screenshot({ path: path.join(OUT, "1-ficha-1440.png") });
  await page.getByRole("button", { name: /^Editar$/ }).first().click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, "2-edicao-1440.png") });
  const emEdicao = await page.evaluate(() => document.body.innerText.includes("Editar animal"));
  marcar("formulário abriu em modo de edição", emEdicao);

  await page.getByRole("button", { name: /^Cancelar$/ }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "3-apos-cancelar-1440.png") });
  const aposCancelar = await page.evaluate(() => {
    const abas = [...document.querySelectorAll(".paginaAbas .paginaAba")].map((b) => b.innerText.trim());
    return {
      emEdicao: document.body.innerText.includes("Editar animal"),
      galeria: Boolean(document.querySelector('[class*="_card"]')),
      abas,
      overlays: document.querySelectorAll('[class*="_fichaFundo"], [class*="_overlay"]').length,
    };
  });
  marcar("Cancelar sai do modo de edição", !aposCancelar.emEdicao);
  marcar("galeria voltou a ser exibida", aposCancelar.galeria);
  marcar("sem overlay invisível após cancelar", aposCancelar.overlays === 0, `(${aposCancelar.overlays})`);

  // ── 2. Navegação para Consultar Registros ───────────────────────────────
  await page.locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  let consultou = 0;
  for (let i = 0; i < 20; i += 1) {
    // A galeria da consulta é uma grade de cards (não uma tabela).
    consultou = await page.evaluate(() => document.querySelectorAll('[class*="_card"]').length);
    if (consultou > 0) break;
    await page.waitForTimeout(500);
  }
  marcar("Consultar Registros acessível após cancelar", consultou > 0, `(${consultou} linhas)`);
  await page.screenshot({ path: path.join(OUT, "4-consulta-apos-cancelar-1440.png") });

  // ── 3. Exclusão bloqueada (animal com histórico) ────────────────────────
  await abrirAnimal(page, "ZZTESTE Com Historico");
  await page.getByRole("button", { name: /^Editar$/ }).first().click();
  await page.waitForTimeout(2200);
  const temExcluirEdicao = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => /Excluir Animal/.test(b.innerText)),
  );
  marcar("botão 'Excluir Animal' presente na edição", temExcluirEdicao);
  await page.getByRole("button", { name: /Excluir Animal/ }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^Excluir$/ }).last().click();
  await page.waitForTimeout(2000);
  const msgBloqueio = await page.evaluate(() => document.body.innerText);
  marcar("exclusão bloqueada por vínculos", /registro\(s\) vinculado\(s\)|vinculados/i.test(msgBloqueio));
  await page.screenshot({ path: path.join(OUT, "5-exclusao-bloqueada-1440.png") });
  const aindaExiste = (await db.query("SELECT 1 FROM ccz_animais WHERE id=$1", [ANIMAL_HIST])).rowCount;
  marcar("animal com histórico preservado no banco", aindaExiste === 1);
  await page.getByRole("button", { name: /^(OK|Entendi|Fechar)$/ }).last().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Cancelar$/ }).first().click().catch(() => {});
  await page.waitForTimeout(1200);

  // ── 4. Exclusão permitida (sem vínculos) ────────────────────────────────
  await abrirAnimal(page, "ZZTESTE Excluivel");
  await page.getByRole("button", { name: /^Editar$/ }).first().click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /Excluir Animal/ }).first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "6-confirmar-exclusao-1440.png") });
  await page.getByRole("button", { name: /^Excluir$/ }).last().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "7-apos-excluir-1440.png") });
  const restou = (await db.query("SELECT 1 FROM ccz_animais WHERE id=$1", [ANIMAL_OK])).rowCount;
  marcar("animal sem vínculos foi excluído", restou === 0);
  const auditoria = (
    await db.query("SELECT acao FROM audit_logs WHERE entidade='Animal' AND entidade_id=$1 ORDER BY created_at DESC LIMIT 1", [ANIMAL_OK])
  ).rows[0];
  marcar("exclusão registrada na auditoria", auditoria?.acao === "EXCLUIR");

  // ── 5. Colunas do histórico (PDF) ───────────────────────────────────────
  await abrirAnimal(page, "ZZTESTE Com Historico");
  const esperaPdf = page.waitForEvent("download", { timeout: 60000 }).catch(() => null);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Gerar PDF/i.test(x.innerText));
    b?.click();
  });
  const download = await esperaPdf;
  let pdf = "";
  if (download) {
    const arq = path.join(OUT, "historico.pdf");
    await download.saveAs(arq);
    pdf = fs.readFileSync(arq).toString("latin1");
  }
  marcar("PDF do histórico gerado", pdf.length > 10000, `(${pdf.length})`);
  const iniLeish = pdf.indexOf("(Leishmaniose) Tj");
  const iniEsporo = pdf.indexOf("(Esporotricose) Tj");
  const blocoLeish = iniLeish >= 0 ? pdf.slice(iniLeish, iniEsporo > iniLeish ? iniEsporo : undefined) : "";
  marcar("PDF: coluna 'Lesões / Tratamento' fora da Leishmaniose", blocoLeish.length > 0 && !/Les[õo]es/.test(blocoLeish));
  const blocoEsporo = iniEsporo >= 0 ? pdf.slice(iniEsporo, iniEsporo + 4000) : "";
  marcar(
    "PDF: coluna 'Fiscal / Responsável' fora da Esporotricose",
    blocoEsporo.length === 0 || !/Fiscal \/ Respons/.test(blocoEsporo),
  );

  // ── 6. Condicionais da Leishmaniose ─────────────────────────────────────
  await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  // seleciona um animal para liberar o "Próximo"
  const campoAnimal = page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').first();
  await campoAnimal.click();
  await page.waitForTimeout(600);
  await campoAnimal.fill("ZZTESTE Com Historico");
  await page.waitForTimeout(2200);
  const caixa = await page.evaluate(() => {
    const linha = [...document.querySelectorAll('[class*="_tableDropdownMenu"] tbody tr')].find((tr) =>
      tr.innerText.includes("ZZTESTE Com Historico"),
    );
    const r = linha?.getBoundingClientRect();
    return r ? { x: r.x + 40, y: r.y + r.height / 2 } : null;
  });
  if (caixa) await page.mouse.click(caixa.x, caixa.y);
  await page.waitForTimeout(1200);
  for (let i = 0; i < 4; i += 1) {
    // O título do bloco é renderizado em CAIXA ALTA pelo CSS.
    const temBloco = await page.evaluate(() => /MANEJO E BIOSSEGURAN/i.test(document.body.innerText));
    if (temBloco) break;
    const proximo = page.getByRole("button", { name: /Próximo/ }).first();
    if ((await proximo.count()) === 0) break;
    await proximo.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  const marcou = await page.evaluate(() => {
    const bloco = [...document.querySelectorAll("section")].find((s) =>
      /OUTROS ANIMAIS E PESSOAS/i.test(s.innerText),
    );
    if (!bloco) return null;
    const selects = [...bloco.querySelectorAll("select")];
    const alvo = selects[0];
    if (!alvo) return null;
    alvo.value = "Sim";
    alvo.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  });
  await page.waitForTimeout(900);
  marcar("bloco 'Outros Animais' localizado", marcou === true);
  const geometria = await page.evaluate(() => {
    const rotulo = (t) =>
      [...document.querySelectorAll("label")].find((l) => l.innerText.includes(t));
    const campo = (t) => [...document.querySelectorAll("label")].find((l) => l.innerText.includes(t));
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const pergunta = rotulo("Existem outros animais no domicílio?");
    const complemento = campo("Espécies e quantidades");
    const a = r(pergunta);
    const b = r(complemento);
    return a && b
      ? {
          mesmaLinha: Math.abs(a.top - b.top) < 8,
          aoLado: b.left > a.right - 4,
          a: Math.round(a.top),
          b: Math.round(b.top),
        }
      : null;
  });
  marcar("'Espécies e quantidades' ao lado da pergunta", Boolean(geometria?.mesmaLinha && geometria?.aoLado), JSON.stringify(geometria));
  await page.screenshot({ path: path.join(OUT, "8-condicionais-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(900);
  const mobile = await page.evaluate(() => {
    const bloco = [...document.querySelectorAll("section")].find((s) =>
      /OUTROS ANIMAIS E PESSOAS/i.test(s.innerText),
    );
    if (!bloco) return null;
    const linha = bloco.querySelector('[class*="_linha"]');
    const cols = linha ? getComputedStyle(linha).gridTemplateColumns.split(" ").length : 0;
    return { cols, largura: Math.round(bloco.getBoundingClientRect().width) };
  });
  marcar("condicionais em 1 coluna no mobile", mobile?.cols === 1, JSON.stringify(mobile));
  // Blocos separados e campos padronizados em 40px.
  const blocos = await page.evaluate(() => {
    // Só os blocos da etapa 2 (seções de 1º nível do formulário).
    const secs = [...document.querySelectorAll("section")].filter((s) =>
      /MANEJO E BIOSSEGURAN|OUTROS ANIMAIS E PESSOAS|CONDIÇÕES DO AMBIENTE/i.test(
        s.querySelector("h3")?.innerText || "",
      ),
    );
    const infos = secs.map((s) => {
      const r = s.getBoundingClientRect();
      const cs = getComputedStyle(s);
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), radius: cs.borderTopLeftRadius, bg: cs.backgroundColor };
    });
    let gaps = [];
    for (let i = 1; i < infos.length; i += 1) gaps.push(infos[i].top - infos[i - 1].bottom);
    const selects = [...document.querySelectorAll("section select")].map((el) => Math.round(el.getBoundingClientRect().height));
    return { qtd: infos.length, gaps, raios: [...new Set(infos.map((i) => i.radius))], fundos: [...new Set(infos.map((i) => i.bg))], selects: [...new Set(selects)] };
  });
  marcar("três blocos separados com espaçamento uniforme", blocos.qtd === 3 && blocos.gaps.every((g) => g >= 8 && g <= 24), JSON.stringify(blocos.gaps));
  marcar("blocos com borda arredondada e fundo claro", blocos.raios.length === 1 && blocos.raios[0] !== "0px", JSON.stringify(blocos.raios));
  marcar("selects padronizados em 40px", blocos.selects.length === 1 && blocos.selects[0] === 40, JSON.stringify(blocos.selects));
  await page.screenshot({ path: path.join(OUT, "9-condicionais-390.png"), fullPage: true });

  marcar("console sem erros", erros.length === 0, erros.slice(0, 2).join(" | "));

  await browser.close();
  await db.end();
  console.log(`\n${ok} OK / ${falha} FALHA`);
  process.exit(falha ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.end().catch(() => {});
  process.exit(1);
});
