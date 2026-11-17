import fs from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
const env={};for(const l of fs.readFileSync(".env.local","utf8").split(/\r?\n/)){const m=l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);if(m)env[m[1]]=m[2];}
const pool=new Pool({connectionString:env.DATABASE_URL});
const pr=new PrismaClient({adapter:new PrismaPg(pool)});
console.log("tipoExame", await pr.tipoExame.findMany());
console.log("procedimento", await pr.procedimento.findMany({select:{id:true,nome:true,tipoExameId:true,ativo:true}}));
await pr.$disconnect(); await pool.end();
