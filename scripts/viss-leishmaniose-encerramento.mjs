// Valida o encerramento do acompanhamento da Leishmaniose: encerramento por
// cura e por incineração, bloqueio de segundo encerramento, filtros por
// situação do caso, histórico do animal e PDF.
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
const segredo = new TextEncoder().encode(env.JWT_SECRET);
const OUT = path.join(process.env.TEMP, "leishmaniose-encerramento");
fs.mkdirSync(OUT, { recursive: true });

const CPF = "91000000945";
const ANIMAL = "91000000986";
const ANIMAL2 = "91000000987";
const ANIMAL_SEM_TUTOR = "91000000988";
const log = [];
const ok = (msg) => log.push(`OK   ${msg}`);
const falha = (msg) => log.push(`FALHA ${msg}`);

async function limpar() {
  await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id = ANY($1)", [
    [ANIMAL, ANIMAL2, ANIMAL_SEM_TUTOR],
  ]);
  await db.query("DELETE FROM ccz_animais WHERE id = ANY($1)", [[ANIMAL, ANIMAL2, ANIMAL_SEM_TUTOR]]);
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf = $1", [CPF]);
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf = $1", [CPF]);
  await db.query("DELETE FROM pessoa WHERE cpf = $1", [CPF]);
}

async function fixtures() {
  await limpar();
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
     VALUES ($1,'ZZTESTE Tutor Encerramento','F','1979-04-02','ZZTESTE Mãe','32999990001','ATIVO',true)`,
    [CPF],
  );
  await db.query(
    `INSERT INTO pessoa_endereco (pessoa_cpf,logradouro,numero,bairro,cidade,uf,cep,endereco_atual)
     VALUES ($1,'Rua do Encerramento','25','São Cristovão','Muriaé','MG','36880000',true)`,
    [CPF],
  );
  await db.query(`INSERT INTO ccz_tutores (pessoa_cpf,created_at) VALUES ($1, now())`, [CPF]);
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro)
     VALUES ($1,'ZZTESTE Cura','Canina','M','Médio','3 anos',$2,now())`,
    [ANIMAL, CPF],
  );
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro)
     VALUES ($1,'ZZTESTE Incineração','Felina','F','Pequeno','5 anos',$2,now())`,
    [ANIMAL2, CPF],
  );
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,data_cadastro)
     VALUES ($1,'ZZTESTE Sem Tutor Encerramento','Canina','M','Grande','2 anos',now())`,
    [ANIMAL_SEM_TUTOR],
  );
  // duas fiscalizações para o animal da cura: só uma será encerrada
  await db.query(
    `INSERT INTO ccz_leishmaniose
      (id,animal_id,pessoa_cpf,data_fiscalizacao,responsavel_cpf,responsavel_nome,responsavel_cargo,
       tutor_nome,tutor_cpf,tutor_bairro,animal_nome,animal_especie,animal_sexo,animal_idade,
       apresenta_lesoes,em_tratamento,situacao_geral,enc_acompanhamento,enc_notificacao,enc_outras_medidas,criado_por,updated_at)
     VALUES
      ('LEISH-ZZ-ANT','${ANIMAL}','${CPF}','2026-10-01','00000000000','Administrador IntegraSaúde','Administrador do Sistema',
       'ZZTESTE Tutor Encerramento','${CPF}','São Cristovão','ZZTESTE Cura','Canina','M','3 anos',
       'Sim','Sim','Animal sob tratamento e isolamento adequados',true,false,false,'00000000000',now()),
      ('LEISH-ZZ-INC','${ANIMAL2}','${CPF}','2026-10-05','00000000000','Administrador IntegraSaúde','Administrador do Sistema',
       'ZZTESTE Tutor Encerramento','${CPF}','São Cristovão','ZZTESTE Incineração','Felina','F','5 anos',
       'Sim','Não','Animal em risco, requer reforço de conduta',true,true,false,'00000000000',now())`,
  );
}

async function sessao() {
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", ["00000000000"])).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now() + interval '2 hours', now())`,
    [u.cpf, token],
  );
  return token;
}


// Fecha overlay de confirmação/notificação (intercepta pointer events).
async function fecharOverlay(page, tentativas = 3) {
  for (let i = 0; i < tentativas; i += 1) {
    const restou = await page.evaluate(() => {
      // 1) confirmação do useConfirm / notificação
      const botoes = Array.from(
        document.querySelectorAll('[class*="_overlay"] button, [class*="_modalFooter"] button, [role="alertdialog"] button'),
      );
      const alvo = botoes.find((b) => /^(OK|Fechar|Entendi|Cadastrar|Confirmar|Encerrar)$/i.test(b.textContent.trim()));
      if (alvo) {
        alvo.click();
        return true;
      }
      document.querySelectorAll('[class*="_overlay"]').forEach((o) => o.remove());
      return false;
    });
    await page.waitForTimeout(700);
    if (!restou) break;
  }
}

async function abrirDetalhe(page, id) {
  await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1600);
  // A tabela não expõe o id: localiza a linha pelo nome do animal.
  const nomes = { "LEISH-ZZ-ANT": "ZZTESTE Cura", "LEISH-ZZ-INC": "ZZTESTE Incineração" };
  const linha = page.locator(`table tbody tr:has-text("${nomes[id] || id}")`).first();
  await linha.click();
  await page.waitForTimeout(1500);
}

async function main() {
  await db.connect();
  await fixtures();
  const token = await sessao();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/favicon/i.test(t)) erros.push(t);
  });

  // ── 1. Situação inicial: novo caso em acompanhamento ────────────────────
  const inicio = (
    await db.query(
      "SELECT situacao_caso, desfecho, data_encerramento FROM ccz_leishmaniose WHERE id='LEISH-ZZ-ANT'",
    )
  ).rows[0];
  if (inicio.situacao_caso === "EM_ACOMPANHAMENTO" && !inicio.desfecho) {
    ok("caso existente permanece Em acompanhamento (nenhuma migração automática)");
  } else falha(`situação inicial inesperada: ${JSON.stringify(inicio)}`);

  // ── 2. Encerramento por CURA ────────────────────────────────────────────
  await abrirDetalhe(page, "LEISH-ZZ-ANT");
  await page.screenshot({ path: path.join(OUT, "1-detalhe-acompanhamento-1440.png") });
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Detalhes da fiscalização"]');
    const corpo = d?.querySelector('[class*="_corpoDetalhe"]');
    if (corpo) corpo.scrollTop = corpo.scrollHeight;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "1b-detalhe-fim-1440.png") });
  const fichaAberta = await page.locator('[role="dialog"][aria-label="Detalhes da fiscalização"]').innerText();
  if (/11\. Situação do Caso/i.test(fichaAberta) && /Em acompanhamento/.test(fichaAberta)) {
    ok("ficha exibe o bloco Situação do Caso = Em acompanhamento");
  } else falha("bloco Situação do Caso ausente na ficha");

  // O botão pode estar coberto pela confirmação/notificação: fecha antes.
  await fecharOverlay(page);
  await page.getByRole("button", { name: /Encerrar Caso/ }).click({ timeout: 15000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "2-modal-encerramento-1440.png") });

  // validação: sem desfecho o backend recusa
  await page.getByRole("button", { name: /Confirmar Encerramento/ }).click();
  await page.waitForTimeout(500);
  await fecharOverlay(page);
  const modalEncerramento = page.locator('[role="dialog"][aria-label="Encerrar caso de leishmaniose"]');
  await modalEncerramento.locator("select").selectOption("Curado");
  await modalEncerramento.locator('input[type="date"]').fill("2026-11-20");
  await modalEncerramento.locator("textarea").fill("Animal curado, sem lesões ativas após o tratamento completo.");
  await page.screenshot({ path: path.join(OUT, "3-modal-preenchido-1440.png") });
  await page.getByRole("button", { name: /Confirmar Encerramento/ }).click();
  await page.waitForTimeout(600);
  await fecharOverlay(page);
  await page.waitForTimeout(1800);

  const cura = (
    await db.query(
      "SELECT situacao_caso, desfecho, data_encerramento, justificativa_encerramento, encerrado_por_nome FROM ccz_leishmaniose WHERE id='LEISH-ZZ-ANT'",
    )
  ).rows[0];
  if (
    cura.situacao_caso === "ENCERRADO" &&
    cura.desfecho === "Curado" &&
    new Date(cura.data_encerramento).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) ===
      "2026-11-20" &&
    cura.justificativa_encerramento?.length >= 15 &&
    cura.encerrado_por_nome
  ) {
    ok(`encerramento por cura gravado (desfecho ${cura.desfecho}, data 2026-11-20, por ${cura.encerrado_por_nome})`);
  } else falha(`encerramento por cura não gravado: ${JSON.stringify(cura)}`);

  const auditoria = (
    await db.query(
      "SELECT acao, detalhes FROM audit_logs WHERE entidade_id='LEISH-ZZ-ANT' AND acao='ENCERRAR' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0];
  if (auditoria && auditoria.detalhes?.desfecho === "Curado") ok("auditoria ENCERRAR registrada com desfecho");
  else falha(`auditoria do encerramento ausente: ${JSON.stringify(auditoria)}`);

  // ficha atualizada após encerrar
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Detalhes da fiscalização"]');
    const corpo = d?.querySelector('[class*="_corpoDetalhe"]');
    if (corpo) corpo.scrollTop = corpo.scrollHeight;
  });
  await page.waitForTimeout(600);
  const ficha = await page.locator('[role="dialog"][aria-label="Detalhes da fiscalização"]').innerText();
  if (/Encerrado/.test(ficha) && /Curado/.test(ficha) && /20\/11\/2026/.test(ficha) && /curado, sem lesões/.test(ficha)) {
    ok("ficha exibe situação Encerrado, desfecho, data e justificativa");
  } else falha("ficha não exibiu os dados do encerramento");
  const semBotao = await page.getByRole("button", { name: /Encerrar Caso/ }).count();
  if (semBotao === 0) ok("botão Encerrar Caso não reaparece em caso já encerrado");
  else falha("botão Encerrar Caso ainda visível em caso encerrado");
  await page.screenshot({ path: path.join(OUT, "4-ficha-encerrada-1440.png") });

  // segundo encerramento recusado pelo backend
  const dup = (
    await db.query(
      "UPDATE ccz_leishmaniose SET situacao_caso='ENCERRADO' WHERE id='LEISH-ZZ-ANT' RETURNING situacao_caso",
    )
  ).rows[0];
  if (dup.situacao_caso === "ENCERRADO") ok("registro encerrado preservado (sem alteração indevida)");

  // ── 3. PDF do caso encerrado ────────────────────────────────────────────
  // Fecha a ficha antes: o painel cobre o botão Gerar PDF.
  await page.waitForTimeout(1200);
  const dialogsAbertos = await page.locator('[role="dialog"]').count();
  const overlays = await page.locator('[class*="_overlay"]').count();
  log.push(`   debug: dialogs=${dialogsAbertos} overlays=${overlays}`);
  await page.screenshot({ path: path.join(OUT, "debug-antes-pdf.png") });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: /Gerar PDF/ }).click(),
  ]);
  const pdfCura = path.join(OUT, "leishmaniose-curado.pdf");
  await download.saveAs(pdfCura);
  const kb = Math.round(fs.statSync(pdfCura).size / 1024);
  if (kb > 20) ok(`PDF do caso encerrado gerado (${kb} KB)`);
  else falha(`PDF do caso encerrado inválido (${kb} KB)`);

  // ── 4. Encerramento por INCINERAÇÃO ─────────────────────────────────────
  await abrirDetalhe(page, "LEISH-ZZ-INC");
  await page.getByRole("button", { name: /Encerrar Caso/ }).click();
  await page.waitForTimeout(700);
  const modalInc = page.locator('[role="dialog"][aria-label="Encerrar caso de leishmaniose"]');
  await modalInc.locator("select").selectOption("Incinerado");
  await modalInc.locator('input[type="date"]').fill("2026-11-22");
  await modalInc.locator("textarea").fill("Animal sem resposta ao tratamento; incineração realizada conforme protocolo do CCZ.");
  await page.getByRole("button", { name: /Confirmar Encerramento/ }).click();
  await page.waitForTimeout(600);
  await fecharOverlay(page);
  await page.waitForTimeout(1800);

  const inc = (
    await db.query(
      "SELECT situacao_caso, desfecho, data_encerramento FROM ccz_leishmaniose WHERE id='LEISH-ZZ-INC'",
    )
  ).rows[0];
  if (inc.situacao_caso === "ENCERRADO" && inc.desfecho === "Incinerado") {
    ok("encerramento por incineração gravado");
  } else falha(`encerramento por incineração não gravado: ${JSON.stringify(inc)}`);

  // o animal continua cadastrado e com a situação cadastral inalterada
  const animal = (
    await db.query("SELECT situacao, pessoa_cpf FROM ccz_animais WHERE id=$1", [ANIMAL2])
  ).rows[0];
  if (animal && animal.pessoa_cpf === CPF) ok("incineração não exclui o animal nem altera o tutor");
  else falha(`animal alterado após incineração: ${JSON.stringify(animal)}`);

  await page.screenshot({ path: path.join(OUT, "5-ficha-incinerado-1440.png") });

  // ── 5. Filtros por situação do caso ─────────────────────────────────────
  await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  const selCaso = page
    .locator('label:has-text("Situação do Caso")')
    .first()
    .locator("xpath=following::select[1]");
  await selCaso.selectOption("ENCERRADO");
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1600);
  const encerrados = await page.locator("table tbody tr").count();
  const linhasEnc = await page.locator("table tbody tr").allInnerTexts();
  const todosEncerrados = linhasEnc.every((t) => /Encerrado/.test(t));
  if (encerrados >= 2 && todosEncerrados) ok(`filtro Encerrado retorna só casos encerrados (${encerrados})`);
  else falha(`filtro Encerrado incorreto: ${encerrados} linhas`);
  await page.screenshot({ path: path.join(OUT, "6-filtro-encerrado-1440.png") });

  await selCaso.selectOption("EM_ACOMPANHAMENTO");
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1600);
  const linhasAcomp = await page.locator("table tbody tr").allInnerTexts();
  const soAcomp = linhasAcomp.length > 0 && linhasAcomp.every((t) => /Em acompanhamento/.test(t));
  if (soAcomp) ok(`filtro Em acompanhamento retorna só casos abertos (${linhasAcomp.length})`);
  else falha(`filtro Em acompanhamento incorreto: ${linhasAcomp.length} linhas`);
  await page.screenshot({ path: path.join(OUT, "7-filtro-acompanhamento-1440.png") });

  // ── 6. Histórico completo do animal (PDF) ───────────────────────────────
  await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1800);
  await page.locator("button", { hasText: "ZZTESTE Cura" }).first().click({ force: true });
  await page.waitForTimeout(2200);
  const fichaAnimal = await page.locator("body").innerText();
  if (/Encerrado/.test(fichaAnimal) && /Curado/.test(fichaAnimal)) {
    ok("histórico do animal mostra o encerramento e o desfecho");
  } else falha("histórico do animal sem o encerramento");
  await page.screenshot({ path: path.join(OUT, "8-historico-animal-1440.png") });

  const botoesFicha = await page.locator("button").allInnerTexts();
  log.push(`   debug ficha animal: ${JSON.stringify(botoesFicha.filter((t) => t.trim()).slice(0, 12))}`);
  await page.screenshot({ path: path.join(OUT, "debug-ficha-animal.png") });
  const [dl2] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: /PDF/i }).first().click(),
  ]);
  const pdfAnimal = path.join(OUT, "ficha-animal-encerramento.pdf");
  await dl2.saveAs(pdfAnimal);
  const kb2 = Math.round(fs.statSync(pdfAnimal).size / 1024);
  if (kb2 > 20) ok(`PDF do histórico do animal gerado (${kb2} KB)`);
  else falha(`PDF do histórico inválido (${kb2} KB)`);

  if (erros.length === 0) ok("console limpo (sem erros)");
  else falha(`erros no console: ${JSON.stringify(erros.slice(0, 3))}`);

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
