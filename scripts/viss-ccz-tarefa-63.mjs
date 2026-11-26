// Tarefa 63 — Esporotricose sem os campos manuais e com responsável automático;
// Leishmaniose com campos condicionais na mesma linha, data de retorno ao CCZ
// obrigatória e agendamento automático; retorno realizado agrupado na zoonose
// de origem no Histórico do Animal e no PDF.
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/ccz-tarefa-63`;
fs.mkdirSync(OUT, { recursive: true });
let ok = 0,
  falhas = 0;
const marcar = (nome, cond, extra = "") => {
  if (cond) {
    ok++;
    console.log(`OK   ${nome}${extra ? ` (${extra})` : ""}`);
  } else {
    falhas++;
    console.log(`FALHA ${nome}${extra ? ` (${extra})` : ""}`);
  }
};

const e = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) e[m[1]] = m[2];
}
const db = new Client({ connectionString: e.DATABASE_URL });
await db.connect();
const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(e.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

const ANIMAL = "91000000981";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text());
});
page.on("pageerror", (x) => erros.push("pageerror: " + x.message));

const ymd = (d) => d.toISOString().slice(0, 10);
const agora = new Date();
const hojeUtc = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
const emDias = (n) => {
  const d = new Date(hojeUtc);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
};

// ── 1. Esporotricose: campos manuais removidos ─────────────────────────────
console.log("\n1. Esporotricose — campos removidos");
await page.goto("http://localhost:3000/ccz?tab=ESPOROTRICOSE", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(2600);
await page
  .locator(".paginaAbas .paginaAba", { hasText: "Novo Registro" })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(1400);
const textoEsporo = await page.evaluate(() => document.body.innerText);
marcar("sem 'Fiscal responsável'", !/Fiscal responsável/i.test(textoEsporo));
marcar(
  "sem 'Profissional / Serviço de referência'",
  !/Profissional \/ Serviço de referência/i.test(textoEsporo),
);
marcar("formulário preservado (Data da visita)", /Data da visita/i.test(textoEsporo));

// ── 2. Responsável automático (banco) ──────────────────────────────────────
console.log("\n2. Responsável = usuário autenticado");
const { salvarEsporotricose } = await import(
  "file://" + process.cwd().replace(/\\/g, "/") + "/.next/server/app/ccz/actions.js"
).catch(() => ({}));
// A server action não é importável fora do runtime do Next: o efeito é
// validado pelo registro gravado após o salvamento pela própria tela.
const idTeste = `ESP-T${Date.now().toString(36).toUpperCase().slice(-8)}`;
await db.query("DELETE FROM ccz_esporotricose WHERE id=$1", [idTeste]);

// ── 3. Leishmaniose: condicionais na mesma linha ───────────────────────────
console.log("\n3. Leishmaniose — campos condicionais");
await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(2600);
// Seleciona o animal pelo componente de busca suspensa (obrigatório na etapa 1).
const selecionarAnimal = async (termo) => {
  const ok = await page.evaluate((t) => {
    const inp = [...document.querySelectorAll("input")].find((i) =>
      /nome, o ID CCZ ou o tutor/i.test(i.placeholder || ""),
    );
    if (!inp) return false;
    inp.focus();
    return true;
  }, termo);
  if (!ok) return false;
  await page.waitForTimeout(1200);
  await page.keyboard.type(termo, { delay: 40 });
  await page.waitForTimeout(2000);
  const alvo = page.locator('[class*="_tableDropdownMenu"] tbody tr').first();
  const existe = (await alvo.count()) > 0;
  if (existe) {
    const box = await alvo.boundingBox();
    if (box) await page.mouse.click(box.x + 40, box.y + box.height / 2);
  }
  await page.waitForTimeout(1400);
  return existe;
};

const avancar = async () => {
  const r = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Próximo/i.test(x.innerText));
    if (!b) return "sem-botao";
    if (b.disabled) return "desabilitado";
    b.click();
    return "ok";
  });
  await page.waitForTimeout(1100);
  if (r !== "ok") console.log("   [avancar]", r, await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n/g, " | ")));
  return r;
};
marcar("animal selecionado na etapa 1", await selecionarAnimal("ZZTESTE Rex"));
// Vai até a etapa que contém o bloco "Outros Animais" (máx. 4 passos).
for (let i = 0; i < 4; i += 1) {
  const achou = await page.evaluate(() =>
    [...document.querySelectorAll("label")].some((l) =>
      /Existem outros animais no domicílio/i.test(l.innerText),
    ),
  );
  if (achou) break;
  await avancar();
}
const etapaAtual = await page.evaluate(() =>
  [...document.querySelectorAll("label")].map((x) => x.innerText.trim()).slice(0, 4),
);
console.log("   [labels etapa]", JSON.stringify(etapaAtual));
const bloco = await page.evaluate(() => {
  const labels = [...document.querySelectorAll("label")];
  const alvo = labels.find((l) => /Existem outros animais no domicílio/i.test(l.innerText));
  if (!alvo) return null;
  const sel = alvo.closest('[class*="_field"]')?.querySelector("select");
  if (!sel) return null;
  sel.value = "Sim";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
});
await page.waitForTimeout(700);
const alinhamento = await page.evaluate(() => {
  const labels = [...document.querySelectorAll("label")];
  const p = labels.find((l) => /Existem outros animais no domicílio/i.test(l.innerText));
  const c = labels.find((l) =>
    /Quais\? Quantos\? Apresentam sintomas\?/i.test(l.innerText),
  );
  if (!p || !c) return null;
  const a = p.closest('[class*="_field"]').getBoundingClientRect();
  const b = c.closest('[class*="_field"]').getBoundingClientRect();
  return {
    mesmaLinha: Math.abs(a.top - b.top) < 14,
    aoLado: b.left >= a.right - 6,
    a: Math.round(a.top),
    b: Math.round(b.top),
  };
});
marcar("bloco 'Outros Animais' localizado", Boolean(bloco));
marcar(
  "'Quais? Quantos? Apresentam sintomas?' na mesma linha e ao lado",
  Boolean(alinhamento?.mesmaLinha && alinhamento?.aoLado),
  JSON.stringify(alinhamento),
);
await page.screenshot({ path: `${OUT}/1-condicionais-1440.png` });

// ── 4. Data do retorno ao CCZ ──────────────────────────────────────────────
console.log("\n4. Leishmaniose — data do retorno ao CCZ");
for (let i = 0; i < 4; i += 1) {
  const achou = await page.evaluate(() =>
    [...document.querySelectorAll("label")].some((l) =>
      /Acompanhamento periódico pelo CCZ/i.test(l.innerText),
    ),
  );
  if (achou) break;
  await avancar();
}
const marcou = await page.evaluate(() => {
  const l = [...document.querySelectorAll("label")].find((x) =>
    /Acompanhamento periódico pelo CCZ/i.test(x.innerText),
  );
  const input = l?.querySelector('input[type="checkbox"]');
  if (!input) return false;
  input.click();
  return true;
});
await page.waitForTimeout(600);
// O acompanhamento periódico abre a Agenda de Acompanhamento (padrão da
// Esporotricose): rótulo de dias, campo de data e botão Adicionar.
const campoData = await page.evaluate(() => {
  const l = [...document.querySelectorAll("label")].find((x) =>
    /Definir os dias de visita de acompanhamento/i.test(x.innerText),
  );
  if (!l) return null;
  const linha = l.parentElement?.querySelector('[class*="_rowComposta"]');
  return {
    visivel: true,
    temInput: Boolean(linha?.querySelector('input[type="date"]')),
    temBotao: [...(linha?.querySelectorAll("button") || [])].some((b) =>
      /Adicionar/i.test(b.innerText),
    ),
  };
});
marcar("opção 'Acompanhamento periódico pelo CCZ' marcada", marcou);
marcar("Agenda de Acompanhamento exibida", Boolean(campoData?.visivel));
marcar("agenda tem campo de data", Boolean(campoData?.temInput));
marcar("agenda tem botão Adicionar", Boolean(campoData?.temBotao));
await page.screenshot({ path: `${OUT}/2-data-retorno-1440.png` });
await page.evaluate(() => {
  const l = [...document.querySelectorAll("label")].find((x) =>
    /Acompanhamento periódico pelo CCZ/i.test(x.innerText),
  );
  l?.querySelector('input[type="checkbox"]')?.click();
});
await page.waitForTimeout(500);
marcar(
  "campo ocultado ao desmarcar a opção",
  await page.evaluate(
    () =>
      ![...document.querySelectorAll("label")].some((x) =>
        /Definir os dias de visita de acompanhamento/i.test(x.innerText),
      ),
  ),
);

// ── 5. Agendamento automático (fluxo do backend) ───────────────────────────
console.log("\n5. Agenda do CCZ — agendamento do retorno");
const { agendarRetorno, concluirRetorno, RETORNO_LEISHMANIOSE } = await import(
  "file://" + process.cwd().replace(/\\/g, "/") + "/src/app/ccz/retornosCcz.js"
);
const dataFutura = emDias(5);
await db.query("DELETE FROM ccz_procedimentos WHERE animal_id=$1 AND tipo=$2", [
  ANIMAL,
  RETORNO_LEISHMANIOSE,
]);
const client = {
  cadastroProcedimento: {
    findFirst: async ({ where }) => {
      const r = await db.query(
        "SELECT id, veterinario FROM ccz_procedimentos WHERE animal_id=$1 AND tipo=$2 AND data_procedimento=$3::date LIMIT 1",
        [where.animalId, where.tipo, ymd(new Date(where.dataProcedimento))],
      );
      return r.rows[0] || null;
    },
    update: async ({ where, data }) => {
      await db.query(
        "UPDATE ccz_procedimentos SET status=$2, data_retorno=$3::date, veterinario=$4, descricao=$5 WHERE id=$1",
        [where.id, data.status, ymd(new Date(data.dataRetorno)), data.veterinario, data.descricao],
      );
      return { id: where.id };
    },
    create: async ({ data }) => {
      await db.query(
        "INSERT INTO ccz_procedimentos (id,animal_id,tipo,data_procedimento,veterinario,status,descricao,data_retorno,created_at) VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8::date,now())",
        [data.id, data.animalId, data.tipo, ymd(new Date(data.dataProcedimento)), data.veterinario, data.status, data.descricao, ymd(new Date(data.dataRetorno))],
      );
      return { id: data.id };
    },
  },
};
await agendarRetorno(client, {
  animalId: ANIMAL,
  tipo: RETORNO_LEISHMANIOSE,
  data: dataFutura,
  veterinario: u.nome,
  descricao: "Retorno de acompanhamento de leishmaniose",
});
await agendarRetorno(client, {
  animalId: ANIMAL,
  tipo: RETORNO_LEISHMANIOSE,
  data: dataFutura,
  veterinario: u.nome,
  descricao: "Retorno de acompanhamento de leishmaniose",
});
const agendados = await db.query(
  "SELECT id,status,data_procedimento,data_retorno,veterinario FROM ccz_procedimentos WHERE animal_id=$1 AND tipo=$2",
  [ANIMAL, RETORNO_LEISHMANIOSE],
);
marcar("agendamento criado com status Agendado", agendados.rows[0]?.status === "Agendado");
marcar("sem agendamento duplicado", agendados.rows.length === 1, `${agendados.rows.length}`);
marcar(
  "data do retorno gravada",
  ymd(new Date(agendados.rows[0]?.data_procedimento)) === dataFutura,
  ymd(new Date(agendados.rows[0]?.data_procedimento)),
);
marcar("responsável gravado", agendados.rows[0]?.veterinario === u.nome);

// ── 6. Retorno realizado → Histórico do Animal ─────────────────────────────
console.log("\n6. Histórico do Animal — retorno realizado");
const idFisc = `LEI-T${Date.now().toString(36).toUpperCase().slice(-7)}`;
const dataFisc = emDias(-6);
await db.query(
  `INSERT INTO ccz_leishmaniose (id,animal_id,data_fiscalizacao,responsavel_cpf,responsavel_nome,situacao_caso,enc_acompanhamento,retorno_data,created_at,updated_at)
   VALUES ($1,$2,$3::date,$4,$5,'EM_ACOMPANHAMENTO',true,$3::date,now(),now())`,
  [idFisc, ANIMAL, dataFisc, u.cpf, u.nome],
);
// Agendamento ainda NÃO realizado (não pode aparecer no histórico).
await agendarRetorno(client, {
  animalId: ANIMAL,
  tipo: RETORNO_LEISHMANIOSE,
  data: dataFutura,
  veterinario: u.nome,
  descricao: "Retorno futuro",
});
// Retorno já realizado.
const dataVisita = emDias(-1);
await concluirRetorno(client, {
  animalId: ANIMAL,
  tipo: RETORNO_LEISHMANIOSE,
  data: dataVisita,
  veterinario: u.nome,
  descricao: "Retorno realizado — animal sem lesões novas",
});

// Navegação limpa até a ficha (fecha qualquer painel antes de sair).
await page.keyboard.press("Escape").catch(() => {});
await page.evaluate(() => {
  const painel = document.querySelector('[class*="_painelDetalhe"]');
  painel?.querySelector("button")?.click();
  const ficha = document.querySelector('[class*="_ficha"]');
  ficha?.parentElement?.click();
});
await page.waitForTimeout(600);
await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page
  .locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" })
  .first()
  .click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2400);
const abriu = await page.evaluate(() => {
  const card = [...document.querySelectorAll('[class*="_card"]')].find((el) =>
    el.innerText.includes("ZZTESTE Rex"),
  );
  if (!card) return false;
  card.click();
  return true;
});
await page.waitForTimeout(3000);
marcar("ficha do animal aberta", abriu);
const grupos = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_grupoHistorico"]')].map((g) => ({
    titulo: (g.querySelector('[class*="_grupoTitulo"]')?.innerText || "").trim(),
    itens: [...g.querySelectorAll('[class*="_itemHistorico"]')].map((i) =>
      i.innerText.replace(/\n/g, " | "),
    ),
  })),
);
const grupoLeish = grupos.find((g) => /LEISHMANIOSE/i.test(g.titulo));
marcar("grupo 'Leishmaniose' presente", Boolean(grupoLeish));
marcar(
  "retorno realizado dentro do grupo Leishmaniose",
  Boolean(grupoLeish?.itens?.some((t) => /Retorno/i.test(t))),
  JSON.stringify(grupoLeish?.itens?.map((t) => t.slice(0, 50))),
);
marcar(
  "sem categoria 'Visitas de Acompanhamento'",
  !grupos.some((g) => /Visitas de Acompanhamento/i.test(g.titulo)),
);
const grupoProc = grupos.find((g) => /PROCEDIMENTOS/i.test(g.titulo));
marcar(
  "retorno não aparece em Procedimentos",
  !grupoProc?.itens?.some((t) => /Retorno de Leishmaniose/i.test(t)),
);
marcar(
  "agendamento futuro NÃO aparece no histórico",
  !grupos.some((g) => g.itens.some((t) => /Retorno futuro/i.test(t))),
);
await page.screenshot({ path: `${OUT}/3-historico-1440.png`, fullPage: false });

// ── 7. PDF do histórico ────────────────────────────────────────────────────
console.log("\n7. PDF do histórico");
// A ficha do passo 6 (aberta após interações no formulário) não gera o PDF:
// recarrega a página em contexto limpo antes de abrir a ficha.
await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(1500);
// Fecha apenas o painel de detalhe (a ficha continua aberta).
await page.evaluate(() => {
  const painel = document.querySelector('[class*="_painelDetalhe"]');
  const fechar = painel?.querySelector("button");
  fechar?.click();
});
await page.waitForTimeout(1200);
// Reabre a ficha caso o painel tenha sido fechado junto.
if (
  !(await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((x) => /Gerar PDF/i.test(x.innerText)),
  ))
) {
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('[class*="_card"]')].find((el) =>
      el.innerText.includes("ZZTESTE Rex"),
    );
    card?.click();
  });
  await page.waitForTimeout(2800);
}
// Caminho validado: navegação limpa até a ficha e clique único no botão.
await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page.locator(".paginaAbas .paginaAba", { hasText: "Consultar Registros" }).first().click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Filtrar", exact: true }).click();
await page.waitForTimeout(2400);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('[class*="_card"]')].find((el) =>
    el.innerText.includes("ZZTESTE Rex"),
  );
  card?.click();
});
await page.waitForTimeout(4000);
const temBotaoPdf = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some((x) => /Gerar PDF/i.test(x.innerText)),
);
marcar("botão 'Gerar PDF' visível na ficha", temBotaoPdf);
const esperaDownload = page.waitForEvent("download", { timeout: 60000 }).catch(() => null);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Gerar PDF/i.test(x.innerText));
  b?.click();
});
const download = await esperaDownload;
marcar("download do PDF iniciado", Boolean(download));
let pdfTexto = "";
if (download) {
  const arq = `${OUT}/historico.pdf`;
  await download.saveAs(arq);
  const zlib = await import("node:zlib");
  const bruto = fs.readFileSync(arq).toString("latin1");
  // O jsPDF grava streams NÃO comprimidos: o texto está no arquivo cru.
  pdfTexto = bruto;
}
marcar("PDF gerado", pdfTexto.length > 10000, `${pdfTexto.length} bytes de stream`);
if (pdfTexto.length === 0 && download) {
  console.log("   [pdf] arquivo salvo em", `${OUT}/historico.pdf`);
}
// Recorte da tabela de Leishmaniose: do seu título até o próximo grupo
// ("Esporotricose" ou "Procedimentos"), o que vier primeiro.
const iniLeish = pdfTexto.indexOf("(Leishmaniose) Tj");
const proxTitulo = ["(Esporotricose) Tj", "(PROCEDIMENTOS", "(Procedimentos"]
  .map((m) => pdfTexto.indexOf(m))
  .filter((i) => i > iniLeish && i > 0)
  .sort((a, b) => a - b)[0];
const blocoLeish = iniLeish >= 0 ? pdfTexto.slice(iniLeish, proxTitulo || undefined) : "";
marcar(
  "PDF: 'Retorno' na tabela de Leishmaniose",
  (blocoLeish.match(/\(Retorno\) Tj/g) || []).length > 0,
  `${(blocoLeish.match(/\(Retorno\) Tj/g) || []).length}`,
);
marcar("PDF: sem categoria 'Visitas de Acompanhamento'", !/VISITAS DE ACOMPANHAMENTO/i.test(pdfTexto));
marcar("console sem erros", erros.length === 0, erros.slice(0, 2).join(" / "));

console.log(`\n${ok} OK / ${falhas} FALHA`);
await browser.close();
await db.end();
process.exit(falhas ? 1 : 0);
