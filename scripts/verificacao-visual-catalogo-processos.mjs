/**
 * Validação funcional e visual de Especialidades e Procedimentos
 * (Câmara Técnica) contra Exames e Procedimentos (Regulação) e
 * Serviços e Especialidades (Junta).
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SAIDA = path.join(process.env.TEMP || ".", "catalogo-processos-visual");
fs.mkdirSync(SAIDA, { recursive: true });

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const seg = new TextEncoder().encode(env.JWT_SECRET);
const CPF = "91000000897";

let ok = 0, falhou = 0;
const falhas = [];
const check = (nome, cond, extra = "") => {
  if (cond) { ok += 1; console.log(`  OK   ${nome}`); }
  else { falhou += 1; falhas.push(nome); console.log(`  FALHA ${nome} ${extra}`); }
};

await db.connect();
await db.query("DELETE FROM user_sessions WHERE user_id=$1", [CPF]);
await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [CPF]);
await db.query("DELETE FROM users WHERE cpf=$1", [CPF]);
const h = await bcrypt.hash("Fixture@2026", 10);
await db.query(
  `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
   VALUES ($1,'TESTE Visual Catálogo',$2,true,false,now())`,
  [CPF, h],
);
for (const m of ["GESTAO", "JUNTA", "REGULACAO", "PROCESSOS"]) {
  await db.query(
    `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
     VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`,
    [CPF, m],
  );
}
const token = await new SignJWT({ userId: CPF, nome: "TESTE Visual Catálogo" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(seg);
await db.query(
  `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
   VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`,
  [CPF, token],
);
// limpa fixtures de catálogo de Processos
await db.query("DELETE FROM processos_especialidade_procedimento WHERE especialidade_id IN (SELECT id FROM processos_especialidades WHERE nome LIKE 'TSTVIS%') OR procedimento_id IN (SELECT id FROM processos_procedimentos WHERE nome LIKE 'TSTVIS%')");
await db.query("DELETE FROM processos_especialidades WHERE nome LIKE 'TSTVIS%'");
await db.query("DELETE FROM processos_procedimentos WHERE nome LIKE 'TSTVIS%'");
await db.end();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();

const ROTA = "/gerenciamento/especialidades-procedimentos";

// Fecha o aviso de sucesso/erro (role="alertdialog"), que fica por cima da tela.
async function fecharAviso(page) {
  const alerta = page.locator('[role="alertdialog"]');
  if (await alerta.count()) {
    const ok = alerta.locator("button").last();
    if (await ok.count()) await ok.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

// O ConfirmProvider é um modal React: confirma pelo botão do diálogo.
async function confirmarModal(page) {
  // O ConfirmProvider renderiza um diálogo com botões "Cancelar" e o de ação.
  const dialogos = page.locator('[role="dialog"]');
  const alvo = (await dialogos.count()) ? dialogos.last() : page.locator("body");
  // O ConfirmProvider usa role="dialog" para a confirmação e role="alertdialog"
  // para o aviso de sucesso. Aqui só interessa a confirmação.
  const acao = alvo
    .locator("button")
    .filter({ hasText: /^(Cadastrar|Atualizar|Inativar|Reativar|Sim|Confirmar)$/ })
    .last();
  if (await acao.count()) {
    await acao.click().catch(() => {});
  } else {
    await page.keyboard.press("Enter").catch(() => {});
  }
  await page.waitForTimeout(600);
}

async function abrir(rota = ROTA) {
  await p.goto(BASE + rota, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
}

const medir = () =>
  p.evaluate(() => {
    const g = (s) => document.querySelector(s);
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
    const x = (el) => (el ? Math.round(el.getBoundingClientRect().x) : null);
    return {
      temCabecalhoExterno: Boolean(document.querySelector(".cadPaginaCabecalho")),
      card: r(g(".cadCard")),
      cardX: x(g(".cadCard")),
      temBusca: Boolean(g(".cadBuscaBox")),
      temBtnAdicionar: Boolean(g(".cadBtnAdicionar")),
      temFormSecao: Boolean(g(".cadFormSecao")),
      temTabela: Boolean(g(".cadTabela")),
      tituloCard: g(".cadCardTitle")?.textContent?.trim() || "",
      subtituloCard: g(".cadCardSubtitle")?.textContent?.trim() || "",
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      colunas: [...document.querySelectorAll(".cadTabela thead th")].map((t) => t.textContent.trim()),
    };
  });

console.log("\n1) Estrutura das três telas (1440px)");
const telas = [
  ["regulacao", "/regulacao?tab=PROCEDIMENTOS"],
  ["junta", "/gerenciamento/servicos-especialidades"],
  ["processos", ROTA],
];
const medidas = {};
for (const [nome, rota] of telas) {
  await abrir(rota);
  medidas[nome] = await medir();
  await p.screenshot({ path: `${SAIDA}/${nome}-1440.png` });
}
for (const nome of ["regulacao", "junta", "processos"]) {
  const m = medidas[nome];
  check(`${nome}: sem cabeçalho externo`, m.temCabecalhoExterno === false);
  check(`${nome}: tem Buscar no Banco`, m.temBusca);
  check(`${nome}: tem botão Adicionar novo`, m.temBtnAdicionar);
  check(`${nome}: tem Informações do Registro`, m.temFormSecao);
  check(`${nome}: tem tabela Cadastros`, m.temTabela);
  check(`${nome}: sem rolagem horizontal`, m.overflow === false);
}
check(
  "mesma largura de card nas três",
  medidas.regulacao.card === medidas.processos.card && medidas.junta.card === medidas.processos.card,
  JSON.stringify({ r: medidas.regulacao.card, j: medidas.junta.card, p: medidas.processos.card }),
);
check(
  "mesmo x de card nas três",
  medidas.regulacao.cardX === medidas.processos.cardX && medidas.junta.cardX === medidas.processos.cardX,
  JSON.stringify({ r: medidas.regulacao.cardX, j: medidas.junta.cardX, p: medidas.processos.cardX }),
);
check("subtítulo do card da Câmara Técnica", /Ortopedia/.test(medidas.processos.subtituloCard), medidas.processos.subtituloCard);
check(
  "colunas da tabela: Especialidade, Procedimento, Situação, Ações",
  JSON.stringify(medidas.processos.colunas) === JSON.stringify(["Especialidade", "Procedimento", "Situação", "Ações"]),
  JSON.stringify(medidas.processos.colunas),
);

console.log("\n2) Busca, Adicionar novo e campos");
await abrir();
const btn = p.locator('button:has-text("Adicionar novo")').first();
await btn.click();
await p.waitForTimeout(600);
const espSelect = p.locator("select").first();
const procSelect = p.locator("select").nth(1);
check("formulário habilitado ao clicar em Adicionar novo", await espSelect.isEnabled());
await p.screenshot({ path: `${SAIDA}/processos-1440-formulario.png` });
await espSelect.selectOption({ index: 1 }).catch(() => {});
await p.waitForTimeout(400);
await procSelect.selectOption({ label: "+ Novo procedimento..." }).catch(() => {});
await p.waitForTimeout(500);
await p.screenshot({ path: `${SAIDA}/select-procedimento-aberto.png` });
const opcoesEsp = await espSelect.locator("option").allTextContents();
check("campo Especialidade tem '+ Nova especialidade...'", opcoesEsp.some((t) => /Nova especialidade/.test(t)), JSON.stringify(opcoesEsp));
const opcoesProc = await procSelect.locator("option").allTextContents();
check("campo Procedimento tem '+ Novo procedimento...'", opcoesProc.some((t) => /Novo procedimento/.test(t)), JSON.stringify(opcoesProc));

await espSelect.selectOption({ label: "+ Nova especialidade..." });
await p.waitForTimeout(500);
const inputEsp = p.locator('input[placeholder*="Ortopedia"]').first();
check("campo de nome da nova especialidade aparece", await inputEsp.count() > 0);
await p.screenshot({ path: `${SAIDA}/processos-nova-especialidade.png` });
await inputEsp.fill("TSTVIS Ortopedia");
const inputProc = p.locator('input[placeholder*="Artroplastia"]');
await procSelect.selectOption({ label: "+ Novo procedimento..." });
await p.waitForTimeout(400);
await inputProc.first().fill("TSTVIS Artroplastia");
await p.screenshot({ path: `${SAIDA}/processos-formulario-preenchido.png` });

console.log("\n3) Salvar");
await p.locator('button[type="submit"]:has-text("Salvar")').first().click();
await p.waitForTimeout(900);
await confirmarModal(p);
await p.waitForTimeout(2500);
await fecharAviso(p);
const linhas = await p.locator(".cadTabela tbody tr").allTextContents();
check("registro aparece na tabela após salvar", linhas.some((t) => /TSTVIS Ortopedia/.test(t) && /TSTVIS Artroplastia/.test(t)), JSON.stringify(linhas.slice(0, 3)));
await p.screenshot({ path: `${SAIDA}/processos-listagem-apos-salvar.png` });

console.log("\n4) Vínculo de procedimento existente a outra especialidade");
await p.locator('button:has-text("Adicionar novo")').first().click();
await p.waitForTimeout(500);
await p.locator("select").first().selectOption({ label: "+ Nova especialidade..." });
await p.locator('input[placeholder*="Ortopedia"]').first().fill("TSTVIS Fisioterapia");
await p.locator("select").nth(1).selectOption({ label: "+ Novo procedimento..." });
await p.waitForTimeout(300);
await p.locator('input[placeholder*="Artroplastia"]').first().fill("TSTVIS Artroplastia");
await p.locator('button[type="submit"]:has-text("Salvar")').first().click();
await p.waitForTimeout(900);
await confirmarModal(p);
await p.waitForTimeout(2500);
await fecharAviso(p);
const linhas2 = await p.locator(".cadTabela tbody tr").allTextContents();
check(
  "mesmo procedimento vinculado a duas especialidades",
  linhas2.filter((t) => /TSTVIS Artroplastia/.test(t)).length >= 2,
  JSON.stringify(linhas2.filter((t) => /TSTVIS/.test(t))),
);

console.log("\n5) Duplicidade recusada");
await p.locator('button:has-text("Adicionar novo")').first().click();
await p.waitForTimeout(500);
const opcoes2 = await p.locator("select").first().locator("option").allTextContents();
const idOrtopedia = await p.locator("select").first().locator("option", { hasText: "TSTVIS Ortopedia" }).first().getAttribute("value");
await p.locator("select").first().selectOption(idOrtopedia);
const opcoesProc2 = await p.locator("select").nth(1).locator("option").allTextContents();
check(
  "procedimento já vinculado aparece na lista da especialidade",
  opcoesProc2.some((t) => /TSTVIS Artroplastia/.test(t)),
  JSON.stringify(opcoesProc2.slice(0, 8)),
);

console.log("\n6) Filtros");
await abrir();
const filtroEsp = p.locator(".cadFiltroSituacao select").nth(1);
const opcoesFiltro = await filtroEsp.locator("option").allTextContents();
check("filtro por especialidade carregado do banco", opcoesFiltro.some((t) => /TSTVIS Ortopedia/.test(t)), JSON.stringify(opcoesFiltro.slice(0, 6)));
const filtroSit = p.locator(".cadFiltroSituacao select").first();
const opcoesSit = await filtroSit.locator("option").allTextContents();
check("filtro de situação com Ativos/Inativos/Todos", opcoesSit.length >= 3, JSON.stringify(opcoesSit));

console.log("\n7) Inativar e reativar procedimento");
const linhaAlvo = p.locator(".cadTabela tbody tr").filter({ hasText: "TSTVIS" }).first();
await linhaAlvo.locator('button:has-text("Inativar")').first().click();
await p.waitForTimeout(900);
await confirmarModal(p);
await p.waitForTimeout(2500);
await fecharAviso(p);
await p.locator(".cadFiltroSituacao select").first().selectOption("inativos").catch(() => {});
await p.waitForTimeout(1500);
const inativos = await p.locator(".cadTabela tbody tr").allTextContents();
check("registro inativado aparece em Inativos", inativos.some((t) => /TSTVIS/.test(t)), JSON.stringify(inativos.slice(0, 4)));
await p.screenshot({ path: `${SAIDA}/processos-inativos.png` });

console.log("\n8) Responsividade");
for (const largura of [1920, 1440, 1366, 768, 390]) {
  await p.setViewportSize({ width: largura, height: largura < 800 ? 844 : 900 });
  await abrir();
  const m = await medir();
  check(`sem rolagem horizontal em ${largura}px`, m.overflow === false, JSON.stringify(m));
  if ([1920, 768, 390].includes(largura)) {
    await p.screenshot({ path: `${SAIDA}/processos-${largura}.png` });
  }
}

await b.close();

const db2 = new Client({ connectionString: env.DATABASE_URL });
await db2.connect();
await db2.query("DELETE FROM processos_especialidade_procedimento WHERE especialidade_id IN (SELECT id FROM processos_especialidades WHERE nome LIKE 'TSTVIS%') OR procedimento_id IN (SELECT id FROM processos_procedimentos WHERE nome LIKE 'TSTVIS%')");
await db2.query("DELETE FROM processos_especialidades WHERE nome LIKE 'TSTVIS%'");
await db2.query("DELETE FROM processos_procedimentos WHERE nome LIKE 'TSTVIS%'");
await db2.query("DELETE FROM user_sessions WHERE user_id=$1", [CPF]);
await db2.query("DELETE FROM user_acessos WHERE user_cpf=$1", [CPF]);
await db2.query("DELETE FROM users WHERE cpf=$1", [CPF]);
await db2.end();

console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
if (falhou) { console.log("Falhas:\n - " + falhas.join("\n - ")); process.exit(1); }
console.log(`capturas em ${SAIDA}`);
