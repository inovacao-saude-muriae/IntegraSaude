#!/usr/bin/env node
/**
 * Converte as permissões gravadas pelos vínculos antigos para o modelo
 * "pacote do perfil + exceções".
 *
 * O QUE FAZ
 *   Para cada vínculo cuja lista `permissoes` é IDÊNTICA ao pacote do perfil
 *   (o que o backfill de 12/11 gravou), limpa `permissoes` e `removidas`:
 *   o vínculo volta a HERDAR o pacote, e passa a acompanhar as mudanças do
 *   catálogo em código.
 *
 *   Para vínculos que já são personalização, nada é tocado.
 *
 * POR QUE
 *   Gravar o pacote inteiro dentro do vínculo congela a configuração: uma
 *   permissão nova no catálogo nunca chega a quem já tem vínculo.
 *
 * Uso:
 *   node scripts/migrar-permissoes-para-pacote.js --dry-run
 *   node scripts/migrar-permissoes-para-pacote.js
 */

require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

// Os pacotes de permissão vivem em código (lib/permissoesCatalogo.js). Para ler
// o catálogo daqui, o script extrai a definição do arquivo-fonte e avalia em
// isolamento — assim nunca há uma segunda cópia dos pacotes para sair de sincronia.
const fs = require("fs");
const path = require("path");

async function carregarCatalogo() {
  const fonte = fs.readFileSync(
    path.join(__dirname, "..", "src", "lib", "permissoesCatalogo.js"),
    "utf8",
  );
  const semImports = fonte
    .split("\n")
    .filter((l) => !l.trim().startsWith("import "))
    .join("\n");
  const tmp = path.join(
    require("os").tmpdir(),
    `integrasaude-catalogo-${process.pid}.mjs`,
  );
  fs.writeFileSync(tmp, semImports, "utf8");
  try {
    const mod = await import(require("url").pathToFileURL(tmp).href);
    return mod;
  } finally {
    fs.unlinkSync(tmp);
  }
}

let permissoesPadraoBruto = null;
function permissoesPadrao(modulo, perfil) {
  return [...permissoesPadraoBruto(modulo, perfil)].sort();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "SIMULAÇÃO (nada será gravado)" : "APLICANDO");

  if (!permissoesPadraoBruto) {
    permissoesPadraoBruto = (await carregarCatalogo()).permissoesPadrao;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
  const { rows: vinculos } = await pool.query(
    `SELECT id, user_cpf AS "userCpf", modulo::text AS modulo, perfil::text AS perfil,
            permissoes, removidas
       FROM user_acessos ORDER BY user_cpf, modulo`,
  );

  let herdando = 0;
  let personalizados = 0;
  let convertidos = 0;

  for (const v of vinculos) {
    const pacote = permissoesPadrao(v.modulo, v.perfil);
    const gravadas = [...(v.permissoes || [])].sort();
    const iguais =
      gravadas.length === pacote.length &&
      gravadas.every((p, i) => p === pacote[i]);

    if (!gravadas.length && !(v.removidas || []).length) {
      herdando++;
      continue; // já é herança pura
    }

    if (iguais && !(v.removidas || []).length) {
      convertidos++;
      console.log(
        `  ${v.userCpf} · ${v.modulo} · ${v.perfil} → herda o pacote (${pacote.length} permissões)`,
      );
      if (!dryRun) {
        await pool.query(
          'UPDATE user_acessos SET permissoes = ARRAY[]::text[], removidas = ARRAY[]::text[], atualizado_em = now() WHERE id = $1',
          [v.id],
        );
      }
    } else {
      personalizados++;
      console.log(
        `  ${v.userCpf} · ${v.modulo} · ${v.perfil} → MANTIDO (personalizado: ${gravadas.length} concedidas, ${(v.removidas || []).length} retiradas)`,
      );
    }
  }

  console.log(`
──────────────────────────────────────────────
Vínculos: ${vinculos.length} | já herdando: ${herdando} | convertidos agora: ${convertidos} | personalizados mantidos: ${personalizados}
──────────────────────────────────────────────`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exitCode = 1;
});
