import fs from "node:fs";
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
const OUT = "C:/Users/Jefinny/AppData/Local/Temp/leishmaniose-wizard";
fs.mkdirSync(OUT, { recursive: true });

const CPF = "91000000941";
const ANIMAL = "91000000981";
const CPF_SEM_TUTOR = "91000000942";
const ANIMAL_SEM_TUTOR = "91000000982";
const log = [];

async function limpar() {
  await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id = ANY($1)", [[ANIMAL, ANIMAL_SEM_TUTOR]]);
  await db.query("DELETE FROM ccz_animais WHERE id = ANY($1)", [[ANIMAL, ANIMAL_SEM_TUTOR]]);
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf = ANY($1)", [[CPF, CPF_SEM_TUTOR]]);
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf = ANY($1)", [[CPF, CPF_SEM_TUTOR]]);
  await db.query("DELETE FROM pessoa WHERE cpf = ANY($1)", [[CPF, CPF_SEM_TUTOR]]);
}

async function fixtures() {
  await limpar();
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
     VALUES ($1,'ZZTESTE Tutor Leish Visual','M','1980-05-10','ZZTESTE Mãe','32999990000','ATIVO',true)`,
    [CPF],
  );
  await db.query(
    `INSERT INTO pessoa_endereco (pessoa_cpf,logradouro,numero,bairro,cidade,uf,cep,endereco_atual)
     VALUES ($1,'Rua de Teste','100','São Cristovão','Muriaé','MG','36880000',true)`,
    [CPF],
  );
  await db.query(`INSERT INTO ccz_tutores (pessoa_cpf,created_at) VALUES ($1, now())`, [CPF]);
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,pessoa_cpf,data_cadastro)
     VALUES ($1,'ZZTESTE Rex','Canina','M','Médio','4 anos',$2,now())`,
    [ANIMAL, CPF],
  );
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,idade,data_cadastro)
     VALUES ($1,'ZZTESTE Sem Tutor','Felina','F','Pequeno','2 anos',now())`,
    [ANIMAL_SEM_TUTOR],
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

const passo = (n) => log.push(`${n}`);

async function main() {
  await db.connect();
  await fixtures();
  const token = await sessao();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([
    { name: "session_token", value: token, domain: "localhost", path: "/" },
  ]);
  const page = await context.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/favicon/i.test(t)) erros.push(t);
  });
  page.on("dialog", (d) => d.accept());

  passo("1. Abrir Leishmaniose");
  await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const abas = await page.locator(".paginaAbas .paginaAba").allInnerTexts();
  log.push(`   abas no container: ${JSON.stringify(abas)}`);
  log.push(`   existe "Lista": ${await page.getByRole("button", { name: /^Lista$/ }).count()}`);
  log.push(`   existe "Novo": ${await page.getByRole("button", { name: /^Novo$/ }).count()}`);
  // Geometria da Etapa 1: o bloco unificado substituiu "Informações da
  // Fiscalização" (data/responsável/cargo/equipe não aparecem mais).
  const geo = await page.evaluate(() => {
    const secao = [...document.querySelectorAll("section")].find((s) =>
      [...s.querySelectorAll("h3")].some((h) =>
        /IDENTIFICAÇÃO DO ANIMAL E CONDIÇÃO CLÍNICA/i.test(h.innerText || ""),
      ),
    );
    const r = secao ? secao.getBoundingClientRect() : null;
    const temFiscalizacao = /Informações da Fiscalização/i.test(document.body.innerText);
    return {
      bloco: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) } : null,
      temFiscalizacao,
      titulo: Boolean(secao),
    };
  });
  log.push(`   bloco unificado: ${JSON.stringify(geo)}`);
  passo(geo.titulo && !geo.temFiscalizacao ? "OK" : "FALHA", "1b. bloco unificado e sem Informações da Fiscalização");
  const caixa = await page.evaluate(() => {
    const abas = document.querySelector(".paginaAbas");
    const ra = abas.getBoundingClientRect();
    // container interno = div branca que contém o indicador de etapas
    const ind =
      Array.from(document.querySelectorAll("div")).find((d) => {
        const cs = getComputedStyle(d);
        return d.children.length > 3 && cs.backgroundColor === "rgb(255, 255, 255)" && d.querySelector("form, section, div") &&
          d.innerText.includes("Identificação") && d.innerText.includes("Conclusão") && cs.borderTopWidth === "1px";
      }) || document.querySelector(".paginaAbas").parentElement;
    const rc = ind.getBoundingClientRect();
    const cs = getComputedStyle(ind);
    const tutorInputs = Array.from(document.querySelectorAll("input[readonly]")).map((i) => ({
      v: i.value.slice(0, 18), bg: getComputedStyle(i).backgroundColor, cls: i.className,
    }));
    const camposAnimal = ["ID CCZ", "Espécie", "Sexo", "Idade", "Porte"].filter((t) =>
      Array.from(document.querySelectorAll("label")).some((l) => l.textContent.trim().startsWith(t)) &&
      Array.from(document.querySelectorAll("section")).some((s2) => s2.innerText.startsWith("IDENTIFICAÇÃO DO ANIMAL") && s2.innerText.includes(t)),
    ).filter(() => true);
    const camposAnimalFiltrados = camposAnimal.filter((t) =>
      Array.from(document.querySelectorAll("label")).some((l) => l.textContent.trim().startsWith(t)),
    );
    return {
      abasY: Math.round(ra.y + ra.height),
      containerY: Math.round(rc.y),
      gapAbasContainer: Math.round(rc.y - (ra.y + ra.height)),
      container: { w: Math.round(rc.width), bg: cs.backgroundColor, borda: cs.borderTopWidth + " " + cs.borderTopColor, raio: cs.borderTopLeftRadius, padding: cs.padding },
      tutorInputs,
      camposAnimalRemovidos: camposAnimal,
    };
  });
  log.push(`   caixa: ${JSON.stringify(caixa)}`);
  const etapas = await page.locator("form, div").first().innerText().catch(() => "");
  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[class*="stepLabel"]')).map((e) => e.textContent.trim()),
  );
  log.push(`   etapas visíveis: ${JSON.stringify(labels)}`);
  await page.screenshot({ path: `${OUT}/1-etapa1-1440.png`, fullPage: true });

  passo("2. Validação: Próximo sem animal");
  await page.getByRole("button", { name: /Próximo/ }).click();
  await page.waitForTimeout(600);
  const alerta = await page.locator('[class*="alertErro"]').innerText().catch(() => "(sem alerta)");
  log.push(`   alerta: ${alerta}`);

  const marcar = async (rotuloParcial, opcao) => {
    const rotulos = page.locator("label");
    const total = await rotulos.count();
    for (let i = 0; i < total; i += 1) {
      const t = (await rotulos.nth(i).innerText()).trim();
      if (!t.includes(rotuloParcial)) continue;
      const campo = rotulos.nth(i).locator("xpath=following::select[1]");
      if ((await campo.count()) === 0) continue;
      const valores = await campo.locator("option").allInnerTexts();
      if (!valores.includes(opcao)) return;
      await campo.selectOption({ label: opcao });
      await page.waitForTimeout(200);
      return;
    }
  };

  // Raça/Pelagem e identificação vêm do cadastro central do animal.
  await db.query(
    `UPDATE ccz_animais SET raca_pelagem = 'SRD, pelo curto', possui_identificacao = 'Sim' WHERE id = $1`,
    [ANIMAL],
  );

  passo("3. Selecionar animal com tutor");
  const busca = page.getByPlaceholder("Digite o nome, o ID CCZ ou o tutor do animal...");
  await busca.click();
  await busca.type("ZZTESTE", { delay: 100 });
  await page.waitForTimeout(2200);
  await page.locator("tbody tr").filter({ hasText: "ZZTESTE Rex" }).first().click({ force: true });
  await page.waitForTimeout(800);
  let corpo = await page.locator("body").innerText();
  log.push(`   bloco tutor na Etapa 1: ${corpo.includes("IDENTIFICAÇÃO DO TUTOR")}`);
  log.push(`   tutor: ${corpo.includes("ZZTESTE TUTOR LEISH VISUAL")} | endereço: ${corpo.includes("Rua de Teste")}`);

  passo("4. Bloco 'Informações da Fiscalização' removido");
  corpo = await page.locator("body").innerText();
  passo(
    !/Informações da Fiscalização/i.test(corpo) &&
      !/Adicionar profissional/i.test(corpo) &&
      /IDENTIFICAÇÃO DO ANIMAL E CONDIÇÃO CLÍNICA/i.test(corpo)
      ? "OK"
      : "FALHA",
    "4a. sem fiscalização; bloco unificado presente",
  );
  await page.screenshot({ path: `${OUT}/2-etapa1-preenchida-1440.png`, fullPage: true });

  // Tratamento faz parte da Etapa 1 (Identificação e Tratamento)
  await marcar("Ainda apresenta lesões", "Sim");
  await marcar("tratamento veterinário contínuo", "Sim");
  await marcar("retorno ou revisão", "Sim");
  await page.waitForTimeout(400);
  corpo = await page.locator("body").innerText();
  log.push(`   condicionais abriram: ${corpo.includes("Quais lesões?") && corpo.includes("Medicamentos prescritos")}`);
  await page.screenshot({ path: `${OUT}/2-etapa1-tratamento-1440.png`, fullPage: true });

  passo("5. Próximo → Etapa 2 (Manejo)");
  await page.getByRole("button", { name: /Próximo/ }).click();
  await page.waitForTimeout(800);
  corpo = await page.locator("body").innerText();
  log.push(`   Etapa 2 visível: ${corpo.includes("MANEJO E BIOSSEGURANÇA")}`);
  log.push(`   dados preservados (animal): ${corpo.includes("ZZTESTE Rex")}`);
  await page.screenshot({ path: `${OUT}/3-etapa2-1440.png`, fullPage: true });

  await marcar("coleira repelente", "Sim");
  await marcar("áreas periurbanas", "Não");
  await marcar("outros animais no domicílio", "Não");
  await marcar("Condições sanitárias", "Regulares");
  await marcar("risco de disseminação", "Sim");
  await page.screenshot({ path: `${OUT}/3-etapa2-manejo-1440.png`, fullPage: true });

  passo("6. Voltar para Etapa 1 e conferir preservação");
  await page.getByRole("button", { name: /Anterior/ }).click();
  await page.waitForTimeout(700);
  corpo = await page.locator("body").innerText();
  log.push(`   animal preservado: ${corpo.includes("ZZTESTE Rex")}`);
  log.push(`   profissional preservado: ${corpo.includes("ZZTESTE Profissional Extra")}`);
  log.push(`   tratamento na etapa 1: ${corpo.includes("CONDIÇÃO CLÍNICA E TRATAMENTO")}`);
  log.push(`   campos cadastrais fora da tela: raça=${!corpo.includes("Raça/Pelagem")} identificação=${!corpo.includes("Possui identificação")}`);
  await page.getByRole("button", { name: /Próximo/ }).click();
  await page.waitForTimeout(700);
  corpo = await page.locator("body").innerText();
  log.push(`   voltou para a Etapa 2: ${corpo.includes("MANEJO E BIOSSEGURANÇA")}`);

  passo("7. Etapa 3 (Orientações)");
  await page.getByRole("button", { name: /Próximo/ }).click();
  await page.waitForTimeout(700);
  corpo = await page.locator("body").innerText();
  log.push(`   Etapa 3 visível: ${corpo.includes("ORIENTAÇÕES E COMPROMETIMENTO")}`);
  await marcar("zoonose", "Sim");
  await marcar("demonstra comprometimento", "Parcialmente");
  await page.screenshot({ path: `${OUT}/4-etapa3-orientacoes-1440.png`, fullPage: true });

  passo("8. Etapa 4 (Conclusão) — botão Salvar Registro");
  await page.getByRole("button", { name: /Próximo/ }).click();
  await page.waitForTimeout(700);
  corpo = await page.locator("body").innerText();
  log.push(`   Etapa 4 visível: ${corpo.includes("CONCLUSÃO DA EQUIPE TÉCNICA")}`);
  log.push(`   sem bloco de assinaturas no formulário: ${!corpo.includes("ASSINATURAS E RESPONSÁVEIS TÉCNICOS")}`);
  log.push(`   botão Salvar Registro: ${await page.getByRole("button", { name: /Salvar Registro/ }).count()}`);
  log.push(`   botão Próximo ausente: ${(await page.getByRole("button", { name: /Próximo/ }).count()) === 0}`);
  await marcar("Conduta do tutor", "Parcialmente adequada");
  await marcar("Situação geral", "Risco à saúde pública, encaminhamentos necessários");
  await page.screenshot({ path: `${OUT}/5-etapa4-conclusao-1440.png`, fullPage: true });

  passo("9. Salvar Registro");
  await page.getByRole("button", { name: /Salvar Registro/ }).click();
  await page.waitForTimeout(3500);
  corpo = await page.locator("body").innerText();
  log.push(`   erro na tela: ${await page.locator('[class*="alertErro"]').count() ? await page.locator('[classFor="alertErro"]').innerText().catch(() => "?") : "nenhum"}`);
  log.push(`   voltou para Etapa 1 limpo: ${corpo.includes("INFORMAÇÕES DA FISCALIZAÇÃO") && !corpo.includes("ZZTESTE Rex —")}`);

  const doAnimal = (
    await db.query(
      `SELECT animal_raca_pelagem, animal_identificacao FROM ccz_leishmaniose
        WHERE animal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [ANIMAL],
    )
  ).rows[0];
  log.push(`   snapshot do cadastro do animal: ${JSON.stringify(doAnimal)}`);

  const salvo = (
    await db.query(
      `SELECT l.id, l.animal_id, l.tutor_nome, l.situacao_geral, l.conduta_tutor,
              (SELECT count(*) FROM ccz_leishmaniose_equipe e WHERE e.leishmaniose_id = l.id) AS equipe,
              (SELECT count(*) FROM ccz_leishmaniose_veterinarios v WHERE v.leishmaniose_id = l.id) AS vets
         FROM ccz_leishmaniose l WHERE l.animal_id = $1 ORDER BY l.created_at DESC`,
      [ANIMAL],
    )
  ).rows;
  log.push(`   registro no banco: ${JSON.stringify(salvo)}`);

  passo("10. Consultar Registros");
  await page.getByRole("button", { name: /Consultar Registros/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Filtrar$/i }).click();
  await page.waitForTimeout(2200);
  const tabela = await page.locator("table").last().innerText();
  log.push(`   tabela: ${tabela.replace(/\n/g, " | ")}`);
  await page.screenshot({ path: `${OUT}/8-consulta-1440.png`, fullPage: true });

  passo("11. Detalhe + PDF");
  const linha = page.locator("tbody tr").filter({ hasText: "ZZTESTE Rex" }).first();
  if ((await linha.count()) > 0) {
    await linha.click();
    await page.waitForTimeout(2000);
    const det = await page.locator('[role="dialog"]').innerText().catch(() => "");
    log.push(`   detalhe com seções: ${det.includes("Fiscalização")} | tutor: ${det.includes("ZZTESTE TUTOR")}`);
    await page.screenshot({ path: `${OUT}/9-detalhe-1440.png`, fullPage: true });
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 25000 }).catch(() => null),
      page.getByRole("button", { name: /Gerar PDF/i }).click(),
    ]);
    if (dl) {
      const alvo = `${OUT}/${dl.suggestedFilename()}`;
      await dl.saveAs(alvo);
      log.push(`   PDF: ${dl.suggestedFilename()} (${fs.statSync(alvo).size} bytes)`);
    } else log.push("   PDF: download não capturado");
    const fechar = page.getByRole("button", { name: /^Fechar$/ });
    if (await fechar.count()) await fechar.last().click({ force: true });
    await page.waitForTimeout(900);
  }

  passo("12. Animal sem tutor");
  await page.getByRole("button", { name: /Novo Registro/ }).click();
  await page.waitForTimeout(1000);
  const busca2 = page.getByPlaceholder("Digite o nome, o ID CCZ ou o tutor do animal...");
  await busca2.click();
  await busca2.type("Sem Tutor", { delay: 100 });
  await page.waitForTimeout(2200);
  await page.locator("tbody tr").filter({ hasText: "ZZTESTE Sem Tutor" }).first().click({ force: true });
  await page.waitForTimeout(900);
  corpo = await page.locator("body").innerText();
  log.push(`   bloco de tutor oculto: ${!corpo.includes("IDENTIFICAÇÃO DO TUTOR")}`);
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole("button", { name: /Próximo/ }).click();
    await page.waitForTimeout(700);
  }
  corpo = await page.locator("body").innerText();
  log.push(`   Etapa 3 sem tutor: ${corpo.includes("Animal sem tutor vinculado")}`);
  await page.getByRole("button", { name: /Próximo/ }).click();
  await page.waitForTimeout(700);
  corpo = await page.locator("body").innerText();
  log.push(`   Etapa 4 sem tutor: sem conduta do tutor = ${!corpo.includes("Conduta do tutor")}`);
  await page.screenshot({ path: `${OUT}/10-etapa5-sem-tutor-1440.png`, fullPage: true });
  await page.getByRole("button", { name: /Salvar Registro/ }).click();
  await page.waitForTimeout(3000);
  const salvo2 = (
    await db.query(
      `SELECT animal_id, tutor_nome, conduta_tutor, enc_notificacao, orient_zoonose
         FROM ccz_leishmaniose WHERE animal_id = $1`,
      [ANIMAL_SEM_TUTOR],
    )
  ).rows;
  log.push(`   fiscalização sem tutor: ${JSON.stringify(salvo2)}`);

  passo("13. Mobile 390px");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/11-mobile-390.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  log.push(`   overflow horizontal: ${overflow}`);

  log.push(`Erros de console/página: ${erros.length}${erros.length ? " → " + erros.slice(0, 6).join(" || ") : ""}`);
  await browser.close();
  await db.end();
  fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n"));
  console.log("\n" + log.join("\n"));
}

main().catch(async (e) => {
  fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n") + "\nERRO: " + String(e));
  console.error(e);
  process.exit(1);
});
