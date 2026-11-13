/**
 * Verifica se ainda existe QUALQUER dependência de `users.role` antes de
 * removê-lo do banco.
 *
 * Uso: node scripts/verificar-dependencias-role.js
 *
 * Saída: lista de ocorrências em código (src/, prisma/, scripts/) e, no banco,
 * views/constraints/índices que citem a coluna. Sai com código 1 se achar algo
 * que impeça a remoção.
 */
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

function lerEnv(arquivo) {
  const txt = fs.readFileSync(arquivo, "utf8");
  const out = {};
  for (const linha of txt.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return out;
}

const RAIZES = ["src", "prisma", "scripts"];
const PADROES = [
  /\.role\b/g,
  /\brole\s*:/g,
  /\bRole\b/g,
  /\bisGestor\b/g,
  /roleAcessos/g,
  /gestorGuard/g,
];

function percorrer(dir, achados) {
  for (const nome of fs.readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next" || nome.startsWith(".")) continue;
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      percorrer(p, achados);
      continue;
    }
    if (!/\.(js|jsx|ts|tsx|mjs|cjs|prisma|sql|md)$/.test(nome)) continue;
    // As migrações históricas citam a coluna de propósito — não são dependência.
    if (p.includes(path.join("prisma", "migrations"))) continue;
    if (nome === "verificar-dependencias-role.js") continue;
    const linhas = fs.readFileSync(p, "utf8").split(/\r?\n/);
    linhas.forEach((linha, i) => {
      for (const re of PADROES) {
        re.lastIndex = 0;
        if (re.test(linha)) {
          achados.push(`${p}:${i + 1}: ${linha.trim().slice(0, 120)}`);
          break;
        }
      }
    });
  }
}

(async () => {
  const achados = [];
  for (const r of RAIZES) if (fs.existsSync(r)) percorrer(r, achados);

  const env = lerEnv(".env.local");
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  const coluna = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'`,
  );
  const dependentes = await client.query(
    `SELECT c.conname AS nome, c.contype AS tipo
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'users'
        AND pg_get_constraintdef(c.oid) ILIKE '%role%'`,
  );
  const indices = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE tablename = 'users' AND indexdef ILIKE '%role%'`,
  );
  const views = await client.query(
    `SELECT viewname FROM pg_views
      WHERE schemaname = 'public' AND definition ILIKE '%role%'`,
  );

  console.log("── Código ──────────────────────────────────────────────");
  if (achados.length === 0) console.log("  nenhuma ocorrência");
  else achados.forEach((a) => console.log("  " + a));

  console.log("\n── Banco ───────────────────────────────────────────────");
  console.log(`  coluna users.role: ${coluna.rowCount ? "EXISTE" : "não existe"}`);
  console.log(`  constraints com 'role': ${dependentes.rowCount}`);
  dependentes.rows.forEach((r) => console.log(`    ${r.nome} (${r.tipo})`));
  console.log(`  índices com 'role': ${indices.rowCount}`);
  indices.rows.forEach((r) => console.log(`    ${r.indexname}`));
  console.log(`  views citando 'role': ${views.rowCount}`);
  views.rows.forEach((r) => console.log(`    ${r.viewname}`));

  await client.end();

  const bloqueia = achados.length > 0 || dependentes.rowCount > 0 || views.rowCount > 0;
  console.log(
    `\n${bloqueia ? "NÃO pode remover ainda" : "Pode remover users.role"} ` +
      `(${achados.length} ocorrência(s) em código).`,
  );
  process.exit(bloqueia ? 1 : 0);
})();
