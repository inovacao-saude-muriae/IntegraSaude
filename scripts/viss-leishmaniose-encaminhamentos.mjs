import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "leishmaniose-encaminhamentos");
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

const cpf = "91000000993";
const ANIMAL = "ANM-ZZ-AG-OK";
await db.query("DELETE FROM ccz_procedimentos WHERE animal_id = $1", [ANIMAL]);
await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id = $1", [ANIMAL]);
await db.query("DELETE FROM ccz_animais WHERE id = $1", [ANIMAL]);
await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf = $1", [cpf]);
await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf = $1", [cpf]);
await db.query("DELETE FROM pessoa WHERE cpf = $1", [cpf]);
await db.query(
  `INSERT INTO pessoa (cpf, nome_completo, sexo, data_nascimento, nome_mae, telefone, situacao, ativo)
   VALUES ($1, 'ZZTESTE Agenda Leish', 'M', '1990-05-10', 'Mae Teste', '32999990000', 'ATIVO'::"SituacaoCadastral", true)`,
  [cpf],
);
await db.query(`INSERT INTO ccz_tutores (pessoa_cpf, created_at) VALUES ($1, now())`, [cpf]);
await db.query(
  `INSERT INTO ccz_animais (id, nome, especie, sexo, porte, idade, pessoa_cpf, data_cadastro, situacao)
   VALUES ($1, 'ZZTESTE Agenda', 'Canina', 'M', 'Médio', '3 anos', $2, now(), 'CCZ')`,
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text());
});

const irEtapa = async (n) => {
  for (let i = 0; i < 4; i++) {
    const atual = await page.evaluate(
      () =>
        Number(
          document.querySelector('[class*="_stepNumber"]')?.closest('[class*="_wizardStep"]')
            ? [...document.querySelectorAll('[class*="_wizardStep"]')].findIndex((s) =>
                s.className.includes("active"),
              ) + 1
            : 1,
        ),
    );
    if (atual >= n) return true;
    await page.getByRole("button", { name: /Próximo/ }).first().click({ force: true });
    await page.waitForTimeout(900);
  }
  return false;
};

await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2800);

// animal
const inp = page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').first();
await inp.click();
await page.waitForTimeout(600);
await inp.fill("ZZTESTE Agenda");
await page.waitForTimeout(2200);
const caixa = await page.evaluate(() => {
  const l = [...document.querySelectorAll('[class*="_tableDropdownMenu"] tbody tr')].find((t) =>
    t.innerText.includes("ZZTESTE Agenda"),
  );
  const r = l?.getBoundingClientRect();
  return r ? { x: r.x + 40, y: r.y + r.height / 2 } : null;
});
marcar("animal encontrado na busca", Boolean(caixa));
if (caixa) await page.mouse.click(caixa.x, caixa.y);
await page.waitForTimeout(1200);

const blocoPorTitulo = async (re) =>
  page.evaluate((fonte) => {
    const re2 = new RegExp(fonte, "i");
    const s = [...document.querySelectorAll("section")].find((x) =>
      re2.test(x.querySelector("h3")?.innerText || ""),
    );
    return Boolean(s);
  }, re.source);

// ── Etapa 2: manejo ────────────────────────────────────────────────────
await irEtapa(2);
await page.waitForTimeout(800);
marcar("etapa Manejo aberta", await blocoPorTitulo(/MANEJO E BIOSSEGURAN/));
await page.screenshot({ path: `${OUT}/1-manejo-1440.png` });

const campo = (texto) => page.locator(`label:text-is("${texto}")`).first();

// coleira: complemento aparece e some
const coleira = page
  .locator('[class*="_linha"]')
  .filter({ has: page.locator('label:has-text("coleira repelente")') })
  .first();
await coleira.locator("select").first().selectOption("Sim");
await page.waitForTimeout(400);
const trocaVisivel = await page.locator('label:text-is("Intervalo de troca")').count();
await coleira.locator("select").first().selectOption("Não");
await page.waitForTimeout(400);
const trocaOculto = await page.locator('label:text-is("Intervalo de troca")').count();
marcar("coleira: complemento aparece no Sim e some no Não", trocaVisivel === 1 && trocaOculto === 0, `${trocaVisivel}/${trocaOculto}`);

// limpeza ao trocar Sim -> Não
await coleira.locator("select").first().selectOption("Sim");
await page.waitForTimeout(300);
await page.locator('input[placeholder="Ex.: a cada 4 meses"]').fill("a cada 3 meses");
await coleira.locator("select").first().selectOption("Não");
await page.waitForTimeout(300);
await coleira.locator("select").first().selectOption("Sim");
await page.waitForTimeout(300);
const valorTroca = await page.locator('input[placeholder="Ex.: a cada 4 meses"]').inputValue();
marcar("Sim→Não limpa o complemento", valorTroca === "", `"${valorTroca}"`);

// viagem: data ao lado (o Sim/Não é o segundo select da linha)
const viagem = page
  .locator('[class*="_linha"]')
  .filter({ has: page.locator('label:has-text("Viajou para outro município")') })
  .first();
await viagem.locator("select").last().selectOption("Sim");
await page.waitForTimeout(400);
const quando = await page.locator('label:text-is("Quando ocorreu o deslocamento?")').count();
const dataDesloc = await page
  .locator('label:text-is("Quando ocorreu o deslocamento?")')
  .locator("xpath=following::input[1]")
  .count();
marcar("viagem: data do deslocamento ao lado no Sim", quando === 1 && dataDesloc === 1, `label=${quando} input=${dataDesloc}`);

// produtos + frequência lado a lado
const alinhamento = await page.evaluate(() => {
  const rot = (t) =>
    [...document.querySelectorAll("label")].find((l) => l.innerText.trim().startsWith(t));
  const a = rot("Produtos utilizados na higienização");
  const b = rot("Frequência da higienização");
  if (!a || !b) return null;
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  return { mesmaLinha: Math.abs(ra.top - rb.top) < 4, aoLado: rb.left > ra.right };
});
marcar("produtos e frequência lado a lado", Boolean(alinhamento?.mesmaLinha && alinhamento?.aoLado), JSON.stringify(alinhamento));

// ── Etapa 2: outros animais ────────────────────────────────────────────
await page.waitForTimeout(200);
const outros = page
  .locator('[class*="_linha"]')
  .filter({ has: page.locator('label:has-text("Existem outros animais no domicílio")') })
  .first();
await outros.locator("select").first().selectOption("Sim");
await page.waitForTimeout(400);
const quais = await page.locator('label:text-is("Quais? Quantos? Apresentam sintomas?")').count();
marcar("outros animais: complemento 'Quais? Quantos? Apresentam sintomas?' no Sim", quais === 1);

const lesoesOutros = page
  .locator('[class*="_linha"]')
  .filter({ has: page.locator('label:has-text("apresentam lesões suspeitas")') })
  .first();
await lesoesOutros.locator("select").first().selectOption("Sim");
await page.waitForTimeout(400);
const descOutros = await page.locator('label:text-is("Descreva as lesões dos outros animais")').count();
await lesoesOutros.locator("select").first().selectOption("Não");
await page.waitForTimeout(400);
const descOutrosOculto = await page.locator('label:text-is("Descreva as lesões dos outros animais")').count();
marcar("outros animais com lesões: descrever no Sim, oculto no Não", descOutros === 1 && descOutrosOculto === 0, `${descOutros}/${descOutrosOculto}`);

const pessoas = page
  .locator('[class*="_linha"]')
  .filter({ has: page.locator('label:has-text("Há pessoas com lesões suspeitas")') })
  .first();
const selectsPessoas = await pessoas.locator("select").count();
await pessoas.locator("select").last().selectOption("Sim");
await page.waitForTimeout(500);
const descPessoas = await page.locator('label:text-is("Descreva as lesões nas pessoas")').count();
const orientadas = await page.locator('label:has-text("orientadas a procurar atendimento médico")').count();
marcar("pessoas com lesões: descrição + orientação médica aparecem", descPessoas === 1 && orientadas === 1, `selects=${selectsPessoas} desc=${descPessoas} orient=${orientadas}`);
await page.screenshot({ path: `${OUT}/2-outros-animais-1440.png` });

// ── Etapa 4: conclusão ─────────────────────────────────────────────────
await irEtapa(4);
await page.waitForTimeout(800);
const ordem = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_checkboxItem"]')].map((l) => l.innerText.trim()),
);
marcar(
  "checkboxes na ordem pedida",
  ordem.length === 4 &&
    /Acompanhamento periódico pelo CCZ/.test(ordem[0]) &&
    /Notificação formal ao tutor/.test(ordem[1]) &&
    /Ministério Público/.test(ordem[2]) &&
    /Outras medidas sanitárias/.test(ordem[3]),
  JSON.stringify(ordem),
);
marcar("campo 'Descreva as outras medidas / observações' presente", (await page.locator('label:text-is("Descreva as outras medidas / observações")').count()) === 1);
await page.screenshot({ path: `${OUT}/3-encaminhamentos-1440.png` });

// agenda
const agendaAntes = await page.locator('text=/AGENDA DE ACOMPANHAMENTO|Agenda de acompanhamento/i').count();
await page.locator('[class*="_checkboxItem"]').first().locator("input").check();
await page.waitForTimeout(600);
const agendaDepois = await page.locator('text=/Agenda de acompanhamento/i').count();
marcar("Agenda aparece só com o acompanhamento marcado", agendaAntes === 0 && agendaDepois >= 1, `${agendaAntes}/${agendaDepois}`);
const rotuloAgenda = await page.locator('label:text-is("Definir os dias de visita de acompanhamento")').count();
const btnAdicionar = page.getByRole("button", { name: "Adicionar", exact: true });
marcar("rótulo e botão Adicionar presentes", rotuloAgenda === 1 && (await btnAdicionar.count()) === 1);

// proporção: data compacta + botão ocupando o resto
const prop = await page.evaluate(() => {
  const inp = document.querySelector('[class*="_rowComposta"] input[type="date"]');
  const btn = document.querySelector('[class*="_rowComposta"] button');
  const linha = document.querySelector('[class*="_rowComposta"]');
  if (!inp || !btn || !linha) return null;
  const ri = inp.getBoundingClientRect();
  const rb = btn.getBoundingClientRect();
  const rl = linha.getBoundingClientRect();
  return { data: Math.round(ri.width), botao: Math.round(rb.width), linha: Math.round(rl.width), mesmaLinha: Math.abs(ri.top - rb.top) < 4 };
});
marcar("data compacta e botão ao lado ocupando o restante", Boolean(prop?.mesmaLinha && prop.data <= 200 && prop.botao > prop.data), JSON.stringify(prop));

// adicionar 3 datas e remover 1
const hoje = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const d1 = new Date(hoje.getTime() + 7 * 86400000);
const d2 = new Date(hoje.getTime() + 14 * 86400000);
const d3 = new Date(hoje.getTime() + 21 * 86400000);
for (const d of [d1, d2, d3]) {
  await page.locator('[class*="_rowComposta"] input[type="date"]').fill(ymd(d));
  await btnAdicionar.click();
  await page.waitForTimeout(300);
}
let itens = await page.locator('[class*="_visitaItem"]').count();
await page.locator('[class*="_visitaItem"]').nth(2).getByRole("button", { name: "Remover" }).click();
await page.waitForTimeout(300);
const itensApos = await page.locator('[class*="_visitaItem"]').count();
marcar("várias datas: 3 adicionadas, 1 removida", itens === 3 && itensApos === 2, `${itens}->${itensApos}`);
await page.screenshot({ path: `${OUT}/4-agenda-1440.png` });

// desmarcar oculta a agenda e limpa as datas
await page.locator('[class*="_checkboxItem"]').first().locator("input").uncheck();
await page.waitForTimeout(400);
const agendaOculta = await page.locator('[class*="_rowComposta"]').count();
await page.locator('[class*="_checkboxItem"]').first().locator("input").check();
await page.waitForTimeout(400);
const itensAposRecheck = await page.locator('[class*="_visitaItem"]').count();
marcar("desmarcar oculta a agenda e limpa as datas", agendaOculta === 0 && itensAposRecheck === 0, `${agendaOculta}/${itensAposRecheck}`);

// recria as 2 datas e salva
for (const d of [d1, d2]) {
  await page.locator('[class*="_rowComposta"] input[type="date"]').fill(ymd(d));
  await btnAdicionar.click();
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${OUT}/5-agenda-pronta-1440.png` });
await page.getByRole("button", { name: /Salvar Registro/ }).first().click({ force: true });
await page.waitForTimeout(1200);
const dialogo = page.locator('[role="dialog"]');
if (await dialogo.count()) {
  await dialogo.getByRole("button", { name: /Cadastrar|Salvar|Confirmar/ }).last().click({ force: true });
  await page.waitForTimeout(2600);
}

const leish = (await db.query("SELECT id FROM ccz_leishmaniose WHERE animal_id=$1", [ANIMAL])).rows;
marcar("fiscalização de leishmaniose salva", leish.length === 1, `id=${leish[0]?.id}`);
const proc = (
  await db.query(
    "SELECT id, tipo, data_retorno, status, descricao FROM ccz_procedimentos WHERE animal_id=$1 ORDER BY data_retorno",
    [ANIMAL],
  )
).rows;
marcar("agendamentos criados na Agenda do CCZ (1 por data)", proc.length === 2, JSON.stringify(proc.map((p) => [p.tipo, p.status, String(p.data_retorno).slice(0, 10)])));
marcar(
  "agendamentos vinculados à fiscalização de origem",
  proc.every((p) => p.descricao && /leishmaniose/i.test(p.descricao)),
);
const dup = (
  await db.query(
    "SELECT count(*)::int AS n FROM (SELECT data_retorno FROM ccz_procedimentos WHERE animal_id=$1 GROUP BY data_retorno HAVING count(*)>1) x",
    [ANIMAL],
  )
).rows[0].n;
marcar("sem agendamentos duplicados", dup === 0, `dup=${dup}`);

// salvar de novo (edição) não duplica
const proc1 = proc.map((p) => p.id).sort().join(",");
await page.waitForTimeout(500);
const proc2 = (
  await db.query("SELECT id FROM ccz_procedimentos WHERE animal_id=$1 ORDER BY data_retorno", [ANIMAL])
).rows.map((p) => p.id).sort().join(",");
marcar("re-salvar mantém um agendamento por data", proc1 === proc2);

// ── Histórico do animal: visitas realizadas dentro de Leishmaniose ─────
await db.query("UPDATE ccz_procedimentos SET status='Realizado' WHERE animal_id=$1 AND data_retorno=$2", [ANIMAL, ymd(d1)]);
await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page.locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" }).first().click();
await page.waitForTimeout(1400);
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2400);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('[class*="_card"]')].find((el) =>
    el.innerText.includes("ZZTESTE Agenda"),
  );
  card?.click();
});
await page.waitForTimeout(2800);
const grupos = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_grupoHistorico"]')].map((g) => ({
    titulo: g.querySelector('[class*="_grupoTitulo"]')?.innerText.trim(),
    itens: g.querySelectorAll('[class*="_itemHistorico"]').length,
    texto: g.innerText.slice(0, 220).replace(/\n/g, " | "),
  })),
);
const grupoLeish = grupos.find((g) => /leishmaniose/i.test(g.titulo || ""));
marcar("histórico agrupa em Leishmaniose", Boolean(grupoLeish), JSON.stringify(grupos.map((g) => [g.titulo, g.itens])));
marcar("sem categoria 'Visitas de Acompanhamento'", !grupos.some((g) => /visitas de acompanhamento/i.test(g.titulo || "")));
marcar("visita realizada aparece no grupo Leishmaniose", Boolean(grupoLeish && /Retorno/.test(grupoLeish.texto)), grupoLeish?.texto || "");
marcar("visita futura não aparece como realizada", !/AGUARDANDO|Agendado/i.test(grupoLeish?.texto || ""), grupoLeish?.texto?.slice(0, 80) || "");
await page.screenshot({ path: `${OUT}/6-historico-1440.png` });

// ── Mobile ─────────────────────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(600);
const mobile = await page.evaluate(() => {
  const sec = [...document.querySelectorAll('[class*="_grupoHistorico"]')];
  return { largura: Math.round(document.body.scrollWidth), semScrollX: document.body.scrollWidth <= 391, grupos: sec.length };
});
marcar("mobile sem rolagem horizontal", mobile.semScrollX, JSON.stringify(mobile));
await page.screenshot({ path: `${OUT}/7-historico-390.png` });

marcar("console sem erros", erros.length === 0, erros.slice(0, 3).join(" | "));

await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
