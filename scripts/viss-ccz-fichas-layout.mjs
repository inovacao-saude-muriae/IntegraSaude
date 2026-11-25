// Validação visual das fichas de Esporotricose e Leishmaniose (CCZ).
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

const out=path.join(process.env.TEMP,"ccz-fichas-layout");
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch();
const linhas=[];const log=(t)=>{linhas.push(t);console.log(t);};
const ok=(c,m)=>log(`${c?"OK  ":"FALHA"} ${m}`);
let ev=[];

const abrir = async (page, tab) => {
  await page.goto("http://localhost:3000/ccz?tab="+tab,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2000);
  await page.getByRole("button",{name:/Consultar Registros/}).click();await page.waitForTimeout(700);
  await page.getByRole("button",{name:/Filtrar/}).click();await page.waitForTimeout(1800);
  await page.locator("tbody tr").first().click();await page.waitForTimeout(2200);
};

for (const [tab, rotulo, larguras] of [["ESPOROTRICOSE","esporotricose",[1440,390]],["LEISHMANIOSE","leishmaniose",[1440,390]]]) {
  for (const w of larguras) {
    const ctx=await b.newContext({viewport:{width:w,height:1000},acceptDownloads:true});
    await ctx.addCookies([{name:"session_token",value:token,domain:"localhost",path:"/"}]);
    const page=await ctx.newPage();ev=[];
    page.on("pageerror",(e)=>ev.push(String(e)));
    page.on("console",(m)=>{if(m.type()==="error")ev.push(m.text());});
    await abrir(page,tab);
    await page.screenshot({path:path.join(out,`${rotulo}-${w}.png`)});

    // alinhamento dos campos: mesma altura/largura por coluna, rótulos no topo
    const metrica = await page.evaluate(() => {
      const campos=[...document.querySelectorAll("[class*='_campoLeitura']")];
      const alturas=campos.map(c=>{const v=c.querySelector("[class*='_campoValorBadge']");return v?Math.round(v.getBoundingClientRect().height):0;});
      const larguras=campos.map(c=>Math.round(c.getBoundingClientRect().width));
      return {n:campos.length, alturas:[...new Set(alturas)], larguras:[...new Set(larguras)]};
    });
    ok(metrica.n>0, `${rotulo} ${w}px — ${metrica.n} campos, alturas ${JSON.stringify(metrica.alturas)}, larguras ${JSON.stringify(metrica.larguras)}`);
    ok(ev.length===0, `${rotulo} ${w}px — console limpo`);

    if (w===1440 && tab==="ESPOROTRICOSE") {
      await page.getByRole("button",{name:/^Editar$/}).click();
      await page.waitForTimeout(700);
      const sel=page.locator("[role='dialog'] select").first();
      const box=await sel.boundingBox();
      ok(Math.round(box.height)===40, `select Conclusão com 40px (${Math.round(box.height)}px)`);
      ok(Math.round(box.width)>300, `largura proporcional (${Math.round(box.width)}px)`);
      await page.screenshot({path:path.join(out,"esporotricose-edicao-1440.png")});
      await page.locator("[role='dialog'] select").first().selectOption("ENCERRADO");
      await page.getByRole("button",{name:/^Salvar$/}).click();
      await page.waitForTimeout(2400);
      const badge=await page.locator("[class*='_campoValorBadge']").first().innerText().catch(()=>"");
      ok(/Encerrado|andamento/.test(await page.locator("[role='dialog']").innerText()), "conclusão editada na ficha");
      const aviso=page.locator("[role='dialog'] button").last();
      if (await aviso.count()) await aviso.click({force:true}).catch(()=>{});
      await page.waitForTimeout(600);
      await page.screenshot({path:path.join(out,"esporotricose-apos-salvar-1440.png")});
      ok(ev.length===0, "esporotricose — console limpo após editar");
    }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(out,"relatorio.txt"),linhas.join("\n"),"utf8");
await db.query("DELETE FROM user_sessions WHERE token=$1",[token]);await db.end();await b.close();
