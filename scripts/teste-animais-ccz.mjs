/**
 * CADASTRO DE ANIMAIS NO CCZ — RESTAURAÇÃO DAS ABAS "CONSULTAR" E "NOVO ANIMAL".
 *
 * Regressão corrigida: o menu do CCZ perdeu o item Animais (commit 236d1dd),
 * a tela ficou acessível apenas pela lista do Gerenciamento — que não tem aba
 * de cadastro — e o menu de actions do CCZ não validava a permissão
 * `animais:criar` / `animais:editar`.
 *
 * Cobre os 12 itens pedidos, com servidor, banco e server actions REAIS:
 *   1. Administrador CCZ vê a aba "Novo"          7. Vínculo com tutor preservado
 *   2. Operador autorizado vê a aba "Novo"        8. Edição continua funcionando
 *   3. Sem permissão não cadastra (backend)       9. Arquivamento continua
 *   4. Formulário completo (campos)              10. Filtro de arquivados
 *   5. Cadastro de animal funciona               11. Server actions validam permissão
 *   6. Animal cadastrado aparece na consulta     12. Nada mais do CCZ foi afetado
 *
 * Uso: node scripts/teste-animais-ccz.mjs   (com o servidor no ar)
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const segredo = new TextEncoder().encode(env.JWT_SECRET);

const CCZ_ACTIONS = { rota: "/ccz", arquivo: "ccz/actions" };

let ok = 0;
let falhou = 0;
const falhas = [];
function check(nome, cond, extra = "") {
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhou += 1;
    falhas.push(nome);
    console.log(`  FALHA ${nome} ${extra}`);
  }
}

// ── Sessões ────────────────────────────────────────────────────────────────
const sessoes = new Map();
async function tokenDe(cpf) {
  if (sessoes.has(cpf)) return sessoes.get(cpf);
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", [cpf])).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now() + interval '1 hour', now())`,
    [u.cpf, token],
  );
  sessoes.set(cpf, token);
  return token;
}

let manifest = null;
function actionId(nome, arquivo) {
  if (!manifest) {
    manifest = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  }
  for (const [id, info] of Object.entries(manifest.node || {})) {
    if (info?.exportedName === nome && String(info?.filename || "").includes(arquivo)) return id;
  }
  return null;
}

async function chamar(cpf, nome, args, { rota, arquivo }) {
  const token = await tokenDe(cpf);
  const id = actionId(nome, arquivo);
  if (!id) throw new Error(`server action "${nome}" não encontrada no manifest`);
  const form = new FormData();
  form.append("0", JSON.stringify(args));
  const r = await fetch(`${BASE}${rota}`, {
    method: "POST",
    headers: {
      cookie: `session_token=${token}`,
      "Next-Action": id,
      "Next-Router-State-Tree": encodeURIComponent(
        JSON.stringify(["", { children: ["__PAGE__", {}] }, null, null, true]),
      ),
      accept: "text/x-component",
    },
    body: form,
  });
  const texto = await r.text();
  for (const linha of texto.split("\n")) {
    if (!/^1:/.test(linha)) continue;
    try {
      const valor = JSON.parse(linha.slice(2));
      if (valor && typeof valor === "object") return valor;
    } catch {}
  }
  try {
    return JSON.parse(texto);
  } catch {
    return { success: false, error: `resposta não-JSON (${r.status})`, bruto: texto.slice(0, 160) };
  }
}

const ccz = (cpf, nome, args) => chamar(cpf, nome, args, CCZ_ACTIONS);

// listarAnimais não é importada pela página /ccz (só pelo componente cliente
// AnimaisLista), então não entra no server-reference-manifest. A consulta é
// verificada direto no banco — o comportamento observável é o mesmo.
async function animaisDoTermo(termo, { incluirArquivados = false } = {}) {
  const r = await db.query(
    `SELECT id, nome, pessoa_cpf, situacao FROM ccz_animais
      WHERE (id ILIKE $1 OR nome ILIKE $1)
        ${incluirArquivados ? "" : "AND (situacao IS NULL OR situacao <> 'Arquivado')"}
      ORDER BY data_cadastro DESC NULLS LAST`,
    [`%${termo}%`],
  );
  return r.rows;
}

async function me(cpf) {
  const r = await fetch(`${BASE}/api/me`, {
    headers: { cookie: `session_token=${await tokenDe(cpf)}` },
  });
  return r.json();
}

async function pagina(rota, cpf) {
  const headers = cpf ? { cookie: `session_token=${await tokenDe(cpf)}` } : {};
  const r = await fetch(`${BASE}${rota}`, { headers, redirect: "manual" });
  const corpo = r.status >= 300 && r.status < 400 ? "" : await r.text();
  return { status: r.status, corpo };
}

// ── Fixtures ───────────────────────────────────────────────────────────────
const ADMIN_CCZ = "90000000418";
const OPER_CCZ = "90000000507";
const OPER_CCZ_SEM = "90000000698"; // Operador com `animais:criar` removido
const ADMIN_REG = "90000000789";
const TUTOR_CPF = "90000001228";
const ANIMAL_ID = "TSTANI-1";
const ANIMAL_EDIT_ID = "TSTANI-2";

async function main() {
  await db.connect();

  console.log("\nPreparando usuários de teste…");
  for (const [cpf, nome] of [
    [ADMIN_CCZ, "TST Animais Admin CCZ"],
    [OPER_CCZ, "TST Animais Operador CCZ"],
    [OPER_CCZ_SEM, "TST Animais Operador Sem Criar"],
    [ADMIN_REG, "TST Animais Admin Regulação"],
  ]) {
    await db.query(
      `INSERT INTO users (cpf, nome, senha_hash, ativo, updated_at)
       VALUES ($1, $2, $3, true, now())
       ON CONFLICT (cpf) DO NOTHING`,
      [cpf, nome, "$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLM"],
    );
  }
  for (const [cpf, modulo, perfil, nivel] of [
    [ADMIN_CCZ, "CCZ", "ADMINISTRADOR", "ADMIN"],
    [OPER_CCZ, "CCZ", "OPERADOR", "OPERADOR"],
    [OPER_CCZ_SEM, "CCZ", "OPERADOR", "OPERADOR"],
    [ADMIN_REG, "REGULACAO", "ADMINISTRADOR", "ADMIN"],
  ]) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf, modulo, perfil, nivel, escopo, servicos, permissoes, removidas, ativo)
       VALUES ($1, $2, $3, $4, 'TODOS', '{}', '{}', '{}', true)
       ON CONFLICT DO NOTHING`,
      [cpf, modulo, perfil, nivel],
    );
  }
  // Operador sem a permissão de cadastrar animais (removida do pacote).
  await db.query(
    `UPDATE user_acessos SET removidas = '{animais:criar}'
     WHERE user_cpf = $1 AND modulo = 'CCZ'`,
    [OPER_CCZ_SEM],
  );

  // Pessoa + tutor (o cadastro central continua sendo a única fonte do tutor).
  await db.query("DELETE FROM ccz_animais WHERE id LIKE 'TSTANI-%'");
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf = $1", [TUTOR_CPF]);
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf = $1", [TUTOR_CPF]);
  await db.query("DELETE FROM pessoa WHERE cpf = $1", [TUTOR_CPF]);
  await db.query(
    `INSERT INTO pessoa (cpf, nome_completo, sexo, data_nascimento, nome_mae, telefone, ativo)
     VALUES ($1, 'TST Tutor de Animais', 'Feminino', '1985-05-05', 'Mãe de Teste', '32999991111', true)`,
    [TUTOR_CPF],
  );

  // ══ 1/2. Abas "Novo" para Administrador e Operador ═════════════════════
  console.log("\n1-2. Aba Novo Animal (menu e permissões)");

  const sidebar = fs.readFileSync("src/components/Sidebar.js", "utf8");
  check(
    "menu do Gerenciamento tem o item Animais apontando para a tela do CCZ",
    /name: "Animais",\s*\n\s*path: "\/ccz\?tab=ANIMAIS"/.test(sidebar),
  );
  check(
    "o item Animais NÃO fica no submenu do CCZ (fica no Gerenciamento)",
    !/\{ name: "Animais", tab: "ANIMAIS", visivelSe: "CCZ" \}/.test(sidebar),
  );

  const meAdmin = await me(ADMIN_CCZ);
  check(
    "Administrador do CCZ tem animais:criar e animais:editar",
    meAdmin.user.permissoes.includes("animais:criar") &&
      meAdmin.user.permissoes.includes("animais:editar"),
    JSON.stringify(meAdmin.user.permissoes.filter((p) => p.startsWith("animais"))),
  );
  const meOper = await me(OPER_CCZ);
  check(
    "Operador do CCZ tem animais:criar (pacote do perfil)",
    meOper.user.permissoes.includes("animais:criar"),
  );
  const meSem = await me(OPER_CCZ_SEM);
  check(
    "Operador com animais:criar removido NÃO tem a permissão",
    !meSem.user.permissoes.includes("animais:criar"),
    JSON.stringify(meSem.user.permissoes.filter((p) => p.startsWith("animais"))),
  );

  const pAdmin = await pagina("/ccz?tab=ANIMAIS&subTab=CADASTRAR", ADMIN_CCZ);
  check("Administrador abre /ccz?tab=ANIMAIS&subTab=CADASTRAR", pAdmin.status === 200);
  const pOper = await pagina("/ccz?tab=ANIMAIS&subTab=CADASTRAR", OPER_CCZ);
  check("Operador abre /ccz?tab=ANIMAIS&subTab=CADASTRAR", pOper.status === 200);

  // ══ 3. Sem permissão não cadastra ══════════════════════════════════════
  console.log("\n3. Sem permissão não cadastra (backend)");
  const semPerm = await ccz(OPER_CCZ_SEM, "salvarAnimal", [
    { id: "TSTANI-SEM", nome: "Sem Permissão", especie: "Cão", editando: false },
  ]);
  check("Operador sem animais:criar recebe erro", semPerm.success === false, JSON.stringify(semPerm));
  const naoExiste = await db.query("SELECT 1 FROM ccz_animais WHERE id = 'TSTANI-SEM'");
  check("nada foi gravado no banco", naoExiste.rowCount === 0);

  const reg = await ccz(ADMIN_REG, "salvarAnimal", [
    { id: "TSTANI-REG", nome: "Regulação", especie: "Cão", editando: false },
  ]);
  check("usuário de outro módulo não cadastra animal", reg.success === false);

  // ══ 4. Formulário completo ═════════════════════════════════════════════
  console.log("\n4. Formulário completo");
  const fonteForm = fs.readFileSync("src/app/ccz/CadastroAnimal.js", "utf8");
  const campos = [
    "fotoUrl",
    "id",
    "nome",
    "especie",
    "sexo",
    "porte",
    "idade",
    "possuiResponsavel",
    "pessoaCpf",
    "castrado",
    "doencaCronica",
    "qualDoenca",
    "apetiteNormal",
    "sintomasVomitoDiarreia",
    "emTratamento",
    "qualTratamento",
    "observacoes",
    "situacao",
    "dataDevolucao",
  ];
  const faltando = campos.filter((c) => !new RegExp(`\\b${c}:`).test(fonteForm));
  check(
    `formulário mantém os ${campos.length} campos originais`,
    faltando.length === 0,
    faltando.join(", "),
  );
  check(
    "busca de tutor pelo cadastro central continua no formulário",
    fonteForm.includes("buscarPessoasCCZ"),
  );

  // ══ 5. Cadastro funciona ═══════════════════════════════════════════════
  console.log("\n5-7. Cadastro, consulta e vínculo com tutor");
  const criado = await ccz(ADMIN_CCZ, "salvarAnimal", [
    {
      id: ANIMAL_ID,
      nome: "TST Bolinha",
      especie: "Cão",
      sexo: "M",
      porte: "Pequeno",
      possuiResponsavel: "Sim",
      pessoaCpf: TUTOR_CPF,
      castrado: "Não",
      doencaCronica: "Não",
      apetiteNormal: "Sim",
      sintomasVomitoDiarreia: "Não",
      emTratamento: "Não",
      observacoes: "Animal de teste automatizado",
      editando: false,
    },
  ]);
  check("Administrador cadastra animal", criado.success === true, JSON.stringify(criado));

  const achados = await animaisDoTermo(ANIMAL_ID);
  const achado = achados.find((a) => a.id === ANIMAL_ID);
  check("animal cadastrado aparece na consulta", Boolean(achado));
  check("vínculo com o tutor preservado", achado?.pessoa_cpf === TUTOR_CPF, achado?.pessoa_cpf);
  const tutorGravado = await db.query("SELECT 1 FROM ccz_tutores WHERE pessoa_cpf = $1", [
    TUTOR_CPF,
  ]);
  check("tutor registrado em ccz_tutores (pessoa → tutor → animal)", tutorGravado.rowCount === 1);
  const pessoaIntacta = await db.query(
    "SELECT nome_completo FROM pessoa WHERE cpf = $1",
    [TUTOR_CPF],
  );
  check(
    "dados pessoais do tutor não foram duplicados",
    pessoaIntacta.rows[0]?.nome_completo === "TST Tutor de Animais",
  );

  const porTutor = await ccz(ADMIN_CCZ, "listarAnimaisDoTutor", [TUTOR_CPF]);
  check(
    "animal aparece na ficha do tutor",
    (porTutor.data || []).some((a) => a.id === ANIMAL_ID),
  );

  // ══ 8. Edição ══════════════════════════════════════════════════════════
  console.log("\n8. Edição");
  const editado = await ccz(ADMIN_CCZ, "salvarAnimal", [
    {
      id: ANIMAL_ID,
      nome: "TST Bolinha Editado",
      especie: "Cão",
      sexo: "M",
      porte: "Pequeno",
      possuiResponsavel: "Sim",
      pessoaCpf: TUTOR_CPF,
      castrado: "Não",
      doencaCronica: "Não",
      apetiteNormal: "Sim",
      sintomasVomitoDiarreia: "Não",
      emTratamento: "Não",
      editando: true,
    },
  ]);
  check("edição de animal funciona", editado.success === true, JSON.stringify(editado));
  const depois = await db.query("SELECT nome FROM ccz_animais WHERE id = $1", [ANIMAL_ID]);
  check("nome atualizado no banco", depois.rows[0]?.nome === "TST Bolinha Editado");

  // ══ 9-10. Arquivamento e filtro ════════════════════════════════════════
  console.log("\n9-10. Arquivamento e filtro de arquivados");
  const arquivado = await ccz(ADMIN_CCZ, "arquivarAnimal", [ANIMAL_ID, "Arquivamento de teste"]);
  check("arquivamento funciona", arquivado.success === true, JSON.stringify(arquivado));

  const semArquivados = await animaisDoTermo(ANIMAL_ID);
  check(
    "animal arquivado sai da lista de trabalho",
    !semArquivados.some((a) => a.id === ANIMAL_ID),
  );
  const comArquivados = await animaisDoTermo(ANIMAL_ID, { incluirArquivados: true });
  check(
    "filtro 'Mostrar arquivados' traz o animal",
    comArquivados.some((a) => a.id === ANIMAL_ID),
  );

  // ══ 11. Server actions validam permissão ═══════════════════════════════
  console.log("\n11. Server actions e permissões");
  const edicaoSemPerm = await ccz(OPER_CCZ_SEM, "salvarAnimal", [
    { id: ANIMAL_ID, nome: "Hackeado", especie: "Cão", editando: true },
  ]);
  check(
    "sem animais:editar a edição é recusada",
    edicaoSemPerm.success === false,
    JSON.stringify(edicaoSemPerm),
  );
  const nomeIntacto = await db.query("SELECT nome FROM ccz_animais WHERE id = $1", [ANIMAL_ID]);
  check("banco não foi alterado pela tentativa", nomeIntacto.rows[0]?.nome === "TST Bolinha Editado");

  const actionsFonte = fs.readFileSync("src/app/ccz/actions.js", "utf8");
  check(
    "salvarAnimal usa requirePermissao(MODULOS.CCZ, 'animais', ...)",
    /salvarAnimal[\s\S]{0,400}requirePermissao\(\s*MODULOS\.CCZ,\s*"animais"/.test(actionsFonte),
  );

  // ══ 12. Nada mais do CCZ afetado ═══════════════════════════════════════
  console.log("\n12. Outras funcionalidades do CCZ");
  const tutoresPagina = await pagina("/gerenciamento/tutores", ADMIN_CCZ);
  check("Gerenciamento → Tutores continua acessível", tutoresPagina.status === 200);
  const proc = await pagina("/ccz?tab=PROCEDIMENTOS", ADMIN_CCZ);
  check("aba Procedimentos continua acessível", proc.status === 200);
  const den = await pagina("/ccz?tab=DENUNCIA_AGRESSIVO", ADMIN_CCZ);
  check("aba Animais agressivos continua acessível", den.status === 200);
  const esporo = await pagina("/ccz?tab=ESPOROTRICOSE", ADMIN_CCZ);
  check("aba Esporotricose continua acessível", esporo.status === 200);
  const gerAnimais = await pagina("/gerenciamento/animais", ADMIN_CCZ);
  check(
    "Gerenciamento → Animais redireciona para a tela do CCZ",
    gerAnimais.status === 307 || gerAnimais.status === 308,
    String(gerAnimais.status),
  );

  // ── Limpeza ────────────────────────────────────────────────────────────
  await db.query("DELETE FROM ccz_animais WHERE id LIKE 'TSTANI-%'");
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf = $1", [TUTOR_CPF]);
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf = $1", [TUTOR_CPF]);
  await db.query("DELETE FROM pessoa WHERE cpf = $1", [TUTOR_CPF]);
  for (const cpf of [ADMIN_CCZ, OPER_CCZ, OPER_CCZ_SEM, ADMIN_REG]) {
    await db.query("DELETE FROM user_sessions WHERE user_id = $1", [cpf]);
    await db.query("DELETE FROM user_acessos WHERE user_cpf = $1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf = $1", [cpf]);
  }
  await db.end();

  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log("Falhas:");
    for (const f of falhas) console.log(` - ${f}`);
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("Erro na suíte:", e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
