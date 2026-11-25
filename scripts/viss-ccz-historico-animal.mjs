// Validação: histórico da Ficha do Animal (sistema x PDF x PostgreSQL).
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const env={};for(const l of fs.readFileSync(".env.local","utf8").split(/\r?\n/)){const m=l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);if(m)env[m[1]]=m[2];}
const db=new Client({connectionString:env.DATABASE_URL});await db.connect();
const u=(await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token=await new SignJWT({userId:u.cpf,nome:u.nome}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("2h").sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query("INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",[u.cpf,token]);

const out=path.join(process.env.TEMP,"ccz-historico-animal");
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const linhas=[];const log=(t)=>{linhas.push(t);console.log(t);};const ok=(c,m)=>log(`${c?"OK  ":"FALHA"} ${m}`);

// contagens direto do PostgreSQL
const contar = async (id) => {
  const r = await db.query(`
    SELECT
      (SELECT count(*) FROM ccz_esporotricose_visitas v JOIN ccz_esporotricose e ON e.id=v.esporotricose_id WHERE e.animal_id=$1)::int AS visitas,
      (SELECT count(*) FROM ccz_procedimentos WHERE animal_id=$1)::int AS procedimentos,
      (SELECT count(*) FROM ccz_esporotricose WHERE animal_id=$1)::int AS esporo,
      (SELECT count(*) FROM ccz_leishmaniose WHERE animal_id=$1)::int AS leish,
      (SELECT count(*) FROM ccz_denuncias WHERE animal_id=$1)::int AS denuncias
  `,[id]);
  return r.rows[0];
};

const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await ctx.addCookies([{name:"session_token",value:token,domain:"localhost",path:"/"}]);
const page=await ctx.newPage();
let ev=[];
page.on("pageerror",(e)=>ev.push(String(e)));
page.on("console",(m)=>{if(m.type()==="error")ev.push(m.text());});

const abrirFicha = async (termo) => {
  await page.goto("http://localhost:3000/ccz?tab=ANIMAIS",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2000);
  await page.getByRole("button",{name:/Consultar Registros/}).click();await page.waitForTimeout(700);
  await page.locator("input[placeholder*='animal']").first().fill(termo);
  await page.getByRole("button",{name:/Filtrar/}).click();await page.waitForTimeout(2000);
  await page.locator("button", { hasText: termo }).first().click({ force: true });
  await page.waitForTimeout(2600);
};

for (const [id, rotulo] of [["ANM-MW0VGH4F","joaquim"],["161/26","luna"]]) {
  const esperado = await contar(id);
  log(`== ${rotulo} (${id}) — PostgreSQL: visitas ${esperado.visitas}, procedimentos ${esperado.procedimentos}, esporotricose ${esperado.esporo}, leishmaniose ${esperado.leish}, denúncias ${esperado.denuncias}`);
  await abrirFicha(id);
  await page.screenshot({path:path.join(out,`${rotulo}-ficha-1440.png`), fullPage:false});
  const itens = await page.locator("[class*='_itemHistorico']").count();
  const total = esperado.visitas + esperado.procedimentos + esperado.esporo + esperado.leish + esperado.denuncias;
  ok(itens === total, `${rotulo}: ficha mostra ${itens} registros (esperado ${total})`);
  const texto = await page.locator("[class*='_bloco']").last().innerText();
  ok(!/Cadastro do animal no CCZ/i.test(texto), `${rotulo}: sem o evento de cadastro no histórico`);
  ok(ev.length===0, `${rotulo}: console limpo`);
  // PDF
  const [dl] = await Promise.all([page.waitForEvent("download",{timeout:25000}), page.getByRole("button",{name:/Gerar PDF/}).first().click()]);
  const pdf = path.join(out,`${rotulo}.pdf`);
  await dl.saveAs(pdf);
  ok(fs.statSync(pdf).size>10000, `${rotulo}: PDF ${Math.round(fs.statSync(pdf).size/1024)} KB`);
  await page.locator("[class*='_btnFechar']").first().click({force:true}).catch(()=>{});
  await page.waitForTimeout(800);
  ev=[];
}
fs.writeFileSync(path.join(out,"relatorio.txt"),linhas.join("\n"),"utf8");
await db.query("DELETE FROM user_sessions WHERE token=$1",[token]);await db.end();await b.close();
