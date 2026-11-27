// Tarefa 68 — Leishmaniose: busca de animal filtrada (mesma da Esporotricose)
// e agendamento de retorno ÚNICO por data na Agenda do CCZ.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "leishmaniose-busca-agenda");
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

const cpf = "91000000995";
const A1 = "ANM-ZZ-BU-1";
const A2 = "ANM-ZZ-BU-2";
await db.query("DELETE FROM ccz_procedimentos WHERE animal_id = ANY($1::varchar[])", [[A1, A2]]);
await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id = ANY($1::varchar[])", [[A1, A2]]);
await db.query("DELETE FROM ccz_animais WHERE id = ANY($1::varchar[])", [[A1, A2]]);
await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf=$1", [cpf]);
await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
await db.query(
  `INSERT INTO pessoa (cpf, nome_completo, sexo, data_nascimento, nome_mae, telefone, situacao, ativo)
   VALUES ($1,'José Antônio Busca','M','1985-04-12','Maria','32988887777','ATIVO'::"SituacaoCadastral",true)`,
  [cpf],
);
await db.query("INSERT INTO ccz_tutores (pessoa_cpf, created_at) VALUES ($1, now())", [cpf]);
await db.query(
  `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro,situacao)
   VALUES ($1,'Bolinha Zé','Canina','M','Médio','4 anos',$2,now(),'CCZ')`,
  [A1, cpf],
);
await db.query(
  `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro,situacao)
   VALUES ($1,'Pipoca','Felina','F','Pequeno','2 anos',$2,now(),'CCZ')`,
  [A2, cpf],
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

const campoBusca = page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').first();
const linhas = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[class*="_tableDropdownMenu"] tbody tr')].map((t) => t.innerText.trim()),
  );

// 1. nome parcial
await campoBusca.click();
await page.waitForTimeout(500);
await campoBusca.fill("boli");
await page.waitForTimeout(1800);
const parcial = await linhas();
marcar(
  "1. nome parcial filtra e mostra só os correspondentes",
  parcial.length >= 1 && parcial.every((l) => /Bolinha Zé/i.test(l)),
  JSON.stringify(parcial.map((l) => l.split("\t")[0])),
);

// 2. nome completo
await campoBusca.fill("Bolinha Zé");
await page.waitForTimeout(1800);
const completo = await linhas();
marcar(
  "2. nome completo mostra somente o animal correspondente",
  completo.length === 1 && /Bolinha Zé/.test(completo[0]),
  JSON.stringify(completo.map((l) => l.split("\t")[0])),
);

// 2b. sem acento encontra com acento (e minúsculas)
await campoBusca.fill("bolinha ze");
await page.waitForTimeout(1800);
const semAcento = await linhas();
marcar(
  "2b. sem acento e minúsculas encontram o mesmo animal",
  semAcento.length === 1 && /Bolinha Zé/.test(semAcento[0]),
  JSON.stringify(semAcento.map((l) => l.split("\t")[0])),
);

// 3. ID CCZ — o resultado do ID pesquisado é o primeiro da lista (outros
// registros de ID parecido podem vir depois, sem invalidar a busca exata).
await campoBusca.fill(A2);
await page.waitForTimeout(1800);
const porId = await linhas();
marcar(
  "3. busca por ID CCZ",
  porId.length >= 1 && porId[0].includes(A2),
  JSON.stringify(porId.map((l) => l.split("\t")[0])),
);

// 4. sem correspondência
await campoBusca.fill("zzzz-inexistente");
await page.waitForTimeout(1800);
const vazio = await linhas();
marcar(
  "4. sem correspondência mostra 'Nenhum animal encontrado'",
  vazio.length === 1 && /Nenhum animal encontrado/i.test(vazio[0]),
  JSON.stringify(vazio),
);

// 5. seleção preenche animal e tutor
await campoBusca.fill("Bolinha");
await page.waitForTimeout(1800);
const caixa = await page.evaluate(() => {
  const l = [...document.querySelectorAll('[class*="_tableDropdownMenu"] tbody tr')].find((t) =>
    t.innerText.includes("Bolinha Zé"),
  );
  const r = l?.getBoundingClientRect();
  return r ? { x: r.x + 40, y: r.y + r.height / 2 } : null;
});
if (caixa) await page.mouse.click(caixa.x, caixa.y);
await page.waitForTimeout(1200);
const aposSelecionar = await page.evaluate(() => {
  const inp = document.querySelector('input[placeholder*="Digite o nome, o ID CCZ"]');
  const tutor = [...document.querySelectorAll("label")].find((l) =>
    /Nome completo/i.test(l.innerText),
  );
  return {
    termo: inp?.value || "",
    dropAberto: Boolean(document.querySelector('[class*="_tableDropdownMenu"]')),
    tutor: tutor?.parentElement?.querySelector("input")?.value || "",
  };
});
marcar(
  "5. seleção fecha a lista e preenche animal + tutor",
  /Bolinha Zé/.test(aposSelecionar.termo) &&
    !aposSelecionar.dropAberto &&
    /José Antônio Busca/.test(aposSelecionar.tutor),
  JSON.stringify(aposSelecionar),
);
await page.screenshot({ path: `${OUT}/1-busca-1440.png`, fullPage: true });

// 6/7/8. retorno: uma data -> um agendamento; várias datas -> vários
for (let i = 0; i < 4; i++) {
  const naEtapa = await page.evaluate(() =>
    [...document.querySelectorAll("h3")].some((h) => /MANEJO E BIOSSEGURAN/i.test(h.innerText)),
  );
  if (naEtapa) break;
  await page.getByRole("button", { name: /Próximo/ }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1100);
}
for (let i = 0; i < 2; i++) {
  await page.getByRole("button", { name: /Próximo/ }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1100);
}
const naConclusao = await page.evaluate(() =>
  [...document.querySelectorAll("h3")].some((h) => /CONCLUSÃO DA EQUIPE/i.test(h.innerText)),
);
marcar("etapa Conclusão aberta", naConclusao);

await page.locator('[class*="_checkboxItem"]').first().locator("input").check();
await page.waitForTimeout(700);
const hoje = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const d1 = ymd(new Date(hoje.getTime() + 9 * 86400000));
const d2 = ymd(new Date(hoje.getTime() + 23 * 86400000));
for (const d of [d1, d2]) {
  await page.locator('[class*="_rowComposta"] input[type="date"]').fill(d);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.waitForTimeout(400);
}
await page.getByRole("button", { name: /Salvar Registro/ }).first().click({ force: true });
await page.waitForTimeout(1200);
const dialogo = page.locator('[role="dialog"]');
if (await dialogo.count()) {
  await dialogo.getByRole("button", { name: /Cadastrar|Salvar|Confirmar/ }).last().click({ force: true });
  await page.waitForTimeout(2600);
}
const proc = (
  await db.query(
    "SELECT id, tipo, data_procedimento::text dp, data_retorno::text dr, status FROM ccz_procedimentos WHERE animal_id=$1 ORDER BY data_procedimento",
    [A1],
  )
).rows;
marcar(
  "6/8. uma linha por data de retorno (sem duplicar)",
  proc.length === 2 && proc.every((p) => p.tipo === "Retorno de Leishmaniose"),
  JSON.stringify(proc),
);
marcar(
  "6. identificação 'Retorno de Leishmaniose' e vínculo data/animal",
  proc.every((p) => p.tipo === "Retorno de Leishmaniose" && p.dp === p.dr),
);

// re-salvar a MESMA fiscalização não duplica
const antes = proc.map((p) => p.id).sort().join(",");
await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page.evaluate(() => {
  const aba = [...document.querySelectorAll(".paginaAbas .paginaAba, [class*='paginaAba']")].find(
    (b) => /Novo Registro/i.test(b.innerText),
  );
  aba?.click();
});
await page.waitForTimeout(1400);
const inp2 = page.locator('input[placeholder*="Digite o nome, o ID CCZ"]').first();
await inp2.click();
await page.waitForTimeout(400);
await inp2.fill("Bolinha");
await page.waitForTimeout(1800);
const caixa2 = await page.evaluate(() => {
  const l = [...document.querySelectorAll('[class*="_tableDropdownMenu"] tbody tr')].find((t) =>
    t.innerText.includes("Bolinha Zé"),
  );
  const r = l?.getBoundingClientRect();
  return r ? { x: r.x + 40, y: r.y + r.height / 2 } : null;
});
if (caixa2) await page.mouse.click(caixa2.x, caixa2.y);
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  await page.getByRole("button", { name: /Próximo/ }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
}
await page.locator('[class*="_checkboxItem"]').first().locator("input").check();
await page.waitForTimeout(600);
for (const d of [d1, d2]) {
  await page.locator('[class*="_rowComposta"] input[type="date"]').fill(d);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.waitForTimeout(400);
}
await page.getByRole("button", { name: /Salvar Registro/ }).first().click({ force: true });
await page.waitForTimeout(1000);
const dialogo2 = page.locator('[role="dialog"]');
if (await dialogo2.count()) {
  await dialogo2.getByRole("button", { name: /Cadastrar|Salvar|Confirmar/ }).last().click({ force: true });
  await page.waitForTimeout(2400);
}
const depois = (
  await db.query("SELECT id FROM ccz_procedimentos WHERE animal_id=$1 ORDER BY id", [A1])
).rows.map((p) => p.id).sort().join(",");
marcar("6. re-salvar não duplica", antes === depois, `${antes} vs ${depois}`);

// A Agenda abre no mês corrente; as datas de retorno da fixture podem cair no
// mês seguinte, então navega até o mês da 1ª data antes de conferir.
const alvo = new Date(d1 + "T12:00:00");
const mesLabel = () =>
  page.evaluate(() => {
    const el = document.querySelector('[class*="_monthLabel"]');
    return el ? el.innerText.trim() : "";
  });
for (let i = 0; i < 12; i++) {
  const mesAtual = await mesLabel();
  if (!mesAtual) {
    await page.waitForTimeout(1500);
    continue;
  }
  const nomes = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
  ];
  const mesAlvo = `${nomes[alvo.getMonth()]} ${alvo.getFullYear()}`;
  if (mesAtual.toUpperCase() === mesAlvo) break;
  await page.evaluate(() => {
    const prox = [...document.querySelectorAll("button")].find(
      (b) => (b.innerText || "").trim() === "›",
    );
    prox?.click();
  });
  // espera o rótulo do mês mudar de fato antes de seguir
  await page
    .waitForFunction(
      (anterior) =>
        (document.querySelector('[class*="_monthLabel"]')?.innerText || "").trim() !==
        anterior,
      mesAtual,
      { timeout: 8000 },
    )
    .catch(() => {});
}
// espera os eventos do mês alvo carregarem (a grade nasce vazia e preenche)
await page
  .waitForFunction(
    () =>
      [...document.querySelectorAll('[class*="_event"]')].some((e) =>
        /Bolinha/i.test(e.innerText || ""),
      ),
    null,
    { timeout: 20000 },
  )
  .catch(() => {});
await page.waitForTimeout(800);

// 7. Agenda: um único evento por data — conferido no banco (fonte da Agenda)
const agendaDb = (
  await db.query(
    "SELECT count(*)::int n FROM ccz_procedimentos WHERE animal_id=$1 AND tipo='Retorno de Leishmaniose'",
    [A1],
  )
).rows[0].n;
marcar("7. um único agendamento por data no banco", agendaDb === 2, `n=${agendaDb}`);

// 7. Agenda mostra um único evento por data
// As datas de retorno são criadas a partir de hoje (hoje+9 e hoje+23), o que
// pode cair no mês seguinte: avança a Agenda até o mês que contém os eventos.
// A Agenda fica dentro da aba "Agenda" da página do CCZ.
await page.goto("http://localhost:3000/ccz?tab=AGENDA", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
// O CCZ é uma página cliente: se o router ainda não aplicou o ?tab, a URL
// fica na aba anterior — garante a aba Agenda antes de seguir.
for (let i = 0; i < 6 && !page.url().includes("tab=AGENDA"); i++) {
  await page.goto("http://localhost:3000/ccz?tab=AGENDA", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
}
// A Agenda é renderizada no cliente: espera o calendário do mês aparecer.
await page
  .waitForFunction(() => Boolean(document.querySelector('[class*="_monthLabel"]')), {
    timeout: 25000,
  })
  .catch(() => {});
await page.waitForTimeout(2000);
marcar("7. página da Agenda carregada", !page.url().includes("/login"), page.url());
// O calendário abre no mês corrente e os retornos podem cair no mês seguinte:
// navega até o mês do 1º retorno (comparando só mês e ano do rótulo).
{
  const nomes = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  const alvoMes = `${nomes[alvo.getMonth()]} ${alvo.getFullYear()}`.toUpperCase();
  const normal = (t) => t.toUpperCase().normalize("NFC");
  for (let i = 0; i < 4; i++) {
    const atual = normal(await page.evaluate(
      () => (document.querySelector('[class*="_monthLabel"]')?.innerText || "").trim(),
    ));
    console.log("   [mes]", JSON.stringify(atual), "alvo", JSON.stringify(normal(alvoMes)));
    if (atual.includes(normal(alvoMes))) break;
    await page.evaluate(() => {
      const prox = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "›");
      prox?.click();
    });
    await page.waitForTimeout(1800);
  }
}

const agenda = await page.evaluate(() => {
  // Cada evento da grade é um [class*="_event"]; conta as ocorrências da
  // fixture em TODOS os eventos (inclusive os recolhidos por dia).
  const eventos = [...document.querySelectorAll('[class*="_event"]')].map((el) =>
    (el.innerText || "").replace(/\s+/g, " ").trim(),
  );
  // Eventos recolhidos: "N mais" por dia (a grade mostra no máximo 4 por célula).
  const mais = [...document.querySelectorAll('[class*="_moreEvents"]')].map((el) =>
    (el.innerText || "").replace(/\s+/g, " ").trim(),
  );
  // Só as células do mês exibido: a grade mantém os meses já carregados em
  // cache, portanto a contagem parte do rótulo do mês corrente.
  // A grade renderiza um único mês por vez: todas as células são do mês atual.
  const visiveis = [...document.querySelectorAll('[class*="_dayCell"]')].flatMap((c) =>
    [...c.querySelectorAll('[class*="_event"]')].map((el) =>
      (el.innerText || "").replace(/\s+/g, " ").trim(),
    ),
  );
  const celulas = [...document.querySelectorAll('[class*="_dayCell"]')].map((c) => ({
    vis: c.getClientRects().length > 0,
    dia: (c.querySelector('[class*="_dayNumber"]')?.innerText || "").trim(),
    ev: [...c.querySelectorAll('[class*="_event"]')].map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()),
  }));
  return { textos: eventos.filter((t) => /Retorno de Leishmaniose/i.test(t)), eventos, mais, visiveis, celulas: celulas.length, amostra: celulas.slice(0, 3) };
});
const retornosBolinha = agenda.textos.filter((t) => /Bolinha/i.test(t));
marcar(
  "7. Agenda não rotula 'Retorno · Retorno de Leishmaniose'",
  !agenda.eventos.some((t) => /Retorno · Retorno/.test(t)),
  JSON.stringify(agenda.eventos.filter((t) => /Retorno/i.test(t))),
);
// Só os eventos do mês exibido contam (um mês por vez na grade).
const eventosBolinha = agenda.visiveis.filter((t) => /Bolinha/i.test(t));
console.log("   [visiveis]", JSON.stringify(agenda.visiveis.filter((t) => /Leishmaniose/i.test(t))));

marcar(
  "7. Agenda exibe uma única ocorrência por data para o animal",
  eventosBolinha.length === 2 &&
    eventosBolinha.every((t) => t === "Retorno de Leishmaniose — Bolinha Zé"),
  JSON.stringify(eventosBolinha),
);
await page.screenshot({ path: `${OUT}/2-agenda-1440.png`, fullPage: true });

// A sessão criada pela suíte continua válida (nunca é revogada aqui).
await db.query("UPDATE user_sessions SET expires_at = now() + interval '2 hours' WHERE token=$1", [token]);

// 9. visita realizada entra UMA vez no Histórico, no grupo Leishmaniose
await db.query("UPDATE ccz_procedimentos SET status='Realizado' WHERE animal_id=$1 AND data_procedimento=$2", [
  A1,
  d1,
]);
await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page.getByRole("button", { name: "Consultar Registros", exact: true }).last().click();
await page.waitForTimeout(2400);
const buscaHist = page.locator('input[placeholder*="Digite o nome ou ID do animal"]').first();
if (await buscaHist.count()) {
  await buscaHist.fill("Bolinha Zé");
}
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2400);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('[class*="_card"]')].find((el) => el.innerText.includes("Bolinha Zé"));
  card?.click();
});
await page.waitForTimeout(2800);
const grupos = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_grupoHistorico"]')].map((g) => ({
    titulo: g.querySelector('[class*="_grupoTitulo"]')?.innerText.trim(),
    itens: g.querySelectorAll('[class*="_itemHistorico"]').length,
  })),
);
const grupoLeish = grupos.find((g) => /leishmaniose/i.test(g.titulo || ""));
const itensLeish = await page.evaluate(() =>
  [
    ...document.querySelectorAll(
      '[class*="_grupoHistorico"] [class*="_itemHistorico"]',
    ),
  ]
    .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim())
    .filter((t) => /Retorno/i.test(t)),
);
marcar(
  "9. visita realizada aparece uma única vez no grupo Leishmaniose",
  Boolean(grupoLeish) && itensLeish.length === 1,
  `${JSON.stringify(grupos)} | retornos=${JSON.stringify(itensLeish)}`,
);
marcar("9. sem categoria 'Visitas de Acompanhamento'", !grupos.some((g) => /visitas de acompanhamento/i.test(g.titulo || "")));
await page.screenshot({ path: `${OUT}/3-historico-1440.png`, fullPage: true });

marcar("console sem erros", erros.length === 0, erros.slice(0, 3).join(" | "));
await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
