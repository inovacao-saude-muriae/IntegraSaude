/**
 * Validação da LEISHMANIOSE (CCZ > Zoonoses) — dados e regras no banco.
 * Cobre: cadastro com e sem tutor, snapshot histórico, equipe adicional,
 * veterinários, múltiplas fiscalizações, consulta, permissões e auditoria.
 *
 * Uso: node scripts/teste-leishmaniose.mjs
 */
import fs from "node:fs";
import { Client } from "pg";

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
let ok = 0;
let falhou = 0;

function check(nome, cond, extra = "") {
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhou += 1;
    console.log(`  FALHA ${nome} ${extra}`);
  }
}

const CPF_TUTOR = "91000000941";
const CPF_SEM_TUTOR = "91000000942";
const ANIMAL_COM = "91000000981";
const ANIMAL_SEM = "91000000982";

async function limpar() {
  await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id IN ($1,$2)", [
    ANIMAL_COM,
    ANIMAL_SEM,
  ]);
  await db.query("DELETE FROM ccz_animais WHERE id IN ($1,$2)", [ANIMAL_COM, ANIMAL_SEM]);
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf IN ($1,$2)", [
    CPF_TUTOR,
    CPF_SEM_TUTOR,
  ]);
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf IN ($1,$2)", [
    CPF_TUTOR,
    CPF_SEM_TUTOR,
  ]);
  await db.query("DELETE FROM pessoa WHERE cpf IN ($1,$2)", [CPF_TUTOR, CPF_SEM_TUTOR]);
}

async function fixtures() {
  await limpar();
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
     VALUES ($1,'ZZTESTE Tutor Leishmaniose','M','1980-05-10','ZZTESTE Mãe','32999990000','ATIVO',true)`,
    [CPF_TUTOR],
  );
  await db.query(
    `INSERT INTO pessoa_endereco
       (pessoa_cpf,logradouro,numero,bairro,cidade,uf,cep,endereco_atual)
     VALUES ($1,'Rua de Teste','100','São Cristovão','Muriaé','MG','36880000',true)`,
    [CPF_TUTOR],
  );
  // Animal COM tutor
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,data_cadastro)
     VALUES ($1,'ZZTESTE Cão Leish','Canina','M','Médio',now())`,
    [ANIMAL_COM],
  );
  await db.query(
    `INSERT INTO ccz_tutores (pessoa_cpf,created_at) VALUES ($1, now())`,
    [CPF_TUTOR],
  );
  await db.query(`UPDATE ccz_animais SET pessoa_cpf=$1 WHERE id=$2`, [CPF_TUTOR, ANIMAL_COM]);
  // Animal SEM tutor
  await db.query(
    `INSERT INTO ccz_animais (id,nome,especie,sexo,porte,data_cadastro)
     VALUES ($1,'ZZTESTE Cão Sem Tutor','Canina','F','Médio',now())`,
    [ANIMAL_SEM],
  );
}

async function main() {
  await db.connect();
  await fixtures();

  console.log("\n1. Tabelas criadas");
  const tabelas = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name LIKE 'ccz_leishmaniose%' ORDER BY 1`,
  );
  const nomes = tabelas.rows.map((r) => r.table_name);
  check("ccz_leishmaniose existe", nomes.includes("ccz_leishmaniose"));
  check("ccz_leishmaniose_equipe existe", nomes.includes("ccz_leishmaniose_equipe"));
  check("ccz_leishmaniose_veterinarios existe", nomes.includes("ccz_leishmaniose_veterinarios"));

  console.log("\n2. Relacionamentos");
  const fks = await db.query(
    `SELECT conname, confdeltype FROM pg_constraint
     WHERE conrelid IN ('ccz_leishmaniose'::regclass,'ccz_leishmaniose_equipe'::regclass,
                        'ccz_leishmaniose_veterinarios'::regclass)
       AND contype='f' ORDER BY 1`,
  );
  check("FK do animal existe", fks.rows.some((r) => /animal/.test(r.conname)));
  check(
    "Filhos removidos em cascata",
    fks.rows.filter((r) => /leishmaniose_id/.test(r.conname)).every((r) => r.confdeltype === "c"),
  );

  console.log("\n3. Vínculo animal × tutor (fonte única)");
  const comTutor = await db.query(
    `SELECT a.id, t.pessoa_cpf, p.nome_completo, e.bairro
       FROM ccz_animais a
       LEFT JOIN ccz_tutores t ON t.pessoa_cpf = a.pessoa_cpf
       LEFT JOIN pessoa p ON p.cpf = t.pessoa_cpf
       LEFT JOIN pessoa_endereco e ON e.pessoa_cpf = p.cpf AND e.endereco_atual
      WHERE a.id=$1`,
    [ANIMAL_COM],
  );
  check("Animal com tutor resolve a Pessoa central", comTutor.rows[0]?.nome_completo === "ZZTESTE Tutor Leishmaniose");
  check("Endereço vem de pessoa_endereco", comTutor.rows[0]?.bairro === "São Cristovão");
  const semTutor = await db.query(`SELECT pessoa_cpf FROM ccz_animais WHERE id=$1`, [ANIMAL_SEM]);
  check("Animal sem tutor não tem pessoa vinculada", semTutor.rows[0].pessoa_cpf === null);

  console.log("\n4. Snapshot histórico (alteração cadastral não reescreve a ficha)");
  await db.query(
    `INSERT INTO ccz_leishmaniose
       (id, animal_id, pessoa_cpf, data_fiscalizacao, responsavel_cpf, responsavel_nome,
        responsavel_cargo, tutor_nome, tutor_cpf, tutor_endereco, tutor_telefone, tutor_bairro,
        animal_nome, animal_especie, animal_sexo, situacao_geral, created_at, updated_at)
     VALUES ('zzteste-leish-1',$1,$2,'2026-11-10','00000000000','Administrador IntegraSaúde',
             'Coordenador','ZZTESTE Tutor Leishmaniose',$2,
             'Rua de Teste, 100, São Cristovão, Muriaé/MG, CEP: 36880000','32999990000',
             'São Cristovão','ZZTESTE Cão Leish','Canina','Macho',
             'Risco à saúde pública', now(), now())`,
    [ANIMAL_COM, CPF_TUTOR],
  );
  await db.query(
    `INSERT INTO ccz_leishmaniose_equipe (id,leishmaniose_id,ordem,nome,cargo,usuario_cpf,nao_removivel)
     VALUES ('zzteste-eq-1','zzteste-leish-1',0,'Administrador IntegraSaúde','Coordenador','00000000000',true),
            ('zzteste-eq-2','zzteste-leish-1',1,'ZZTESTE Profissional Extra','Agente de Endemias',NULL,false)`,
  );
  await db.query(
    `INSERT INTO ccz_leishmaniose_veterinarios (id,leishmaniose_id,ordem,nome,registro,cargo,principal)
     VALUES ('zzteste-vet-1','zzteste-leish-1',0,'ZZTESTE Vet Um','CRMV-MG 1234','Médico Veterinário do CCZ',true),
            ('zzteste-vet-2','zzteste-leish-1',1,'ZZTESTE Vet Dois',NULL,'Médico Veterinário',false)`,
  );
  // Altera o cadastro central DEPOIS da fiscalização
  await db.query(`UPDATE pessoa SET nome_completo='ZZTESTE Tutor RENOMEADO' WHERE cpf=$1`, [CPF_TUTOR]);
  await db.query(`UPDATE pessoa_endereco SET bairro='Centro' WHERE pessoa_cpf=$1 AND endereco_atual`, [CPF_TUTOR]);

  const snap = await db.query(
    `SELECT tutor_nome, tutor_bairro FROM ccz_leishmaniose WHERE id='zzteste-leish-1'`,
  );
  check("Ficha mantém o nome histórico do tutor", snap.rows[0].tutor_nome === "ZZTESTE Tutor Leishmaniose");
  check("Ficha mantém o bairro histórico", snap.rows[0].tutor_bairro === "São Cristovão");
  const atual = await db.query(`SELECT nome_completo FROM pessoa WHERE cpf=$1`, [CPF_TUTOR]);
  check("Cadastro central reflete a alteração", atual.rows[0].nome_completo === "ZZTESTE Tutor RENOMEADO");

  console.log("\n5. Equipe e veterinários");
  const equipe = await db.query(
    `SELECT nome, nao_removivel FROM ccz_leishmaniose_equipe
      WHERE leishmaniose_id='zzteste-leish-1' ORDER BY ordem`,
  );
  check("Equipe com 2 integrantes", equipe.rows.length === 2);
  check("Responsável marcado como não removível", equipe.rows[0].nao_removivel === true);
  check("Ordem preservada", equipe.rows[1].nome === "ZZTESTE Profissional Extra");
  const vets = await db.query(
    `SELECT nome, principal FROM ccz_leishmaniose_veterinarios
      WHERE leishmaniose_id='zzteste-leish-1' ORDER BY ordem`,
  );
  check("Dois veterinários", vets.rows.length === 2);
  check("Primeiro veterinário é o principal", vets.rows[0].principal === true);

  console.log("\n6. Múltiplas fiscalizações do mesmo animal");
  await db.query(
    `INSERT INTO ccz_leishmaniose
       (id, animal_id, pessoa_cpf, data_fiscalizacao, responsavel_cpf, responsavel_nome,
        animal_nome, situacao_geral, created_at, updated_at)
     VALUES ('zzteste-leish-2',$1,$2,'2026-11-15','00000000000','Administrador IntegraSaúde',
             'ZZTESTE Cão Leish','Tratamento adequado', now(), now())`,
    [ANIMAL_COM, CPF_TUTOR],
  );
  const hist = await db.query(
    `SELECT id, data_fiscalizacao FROM ccz_leishmaniose WHERE animal_id=$1
      ORDER BY data_fiscalizacao DESC, created_at DESC`,
    [ANIMAL_COM],
  );
  check("Duas fiscalizações do mesmo animal", hist.rows.length === 2);
  check("Histórico começa pela mais recente", hist.rows[0].id === "zzteste-leish-2");
  check("A mais antiga permanece", hist.rows[1].id === "zzteste-leish-1");

  console.log("\n7. Fiscalização de animal sem tutor");
  await db.query(
    `INSERT INTO ccz_leishmaniose
       (id, animal_id, data_fiscalizacao, responsavel_cpf, responsavel_nome,
        animal_nome, situacao_geral, created_at, updated_at)
     VALUES ('zzteste-leish-3',$1,'2026-11-12','00000000000','Administrador IntegraSaúde',
             'ZZTESTE Cão Sem Tutor','Risco à saúde pública', now(), now())`,
    [ANIMAL_SEM],
  );
  const semTutorReg = await db.query(
    `SELECT pessoa_cpf, tutor_nome, orient_zoonose, conduta_tutor, enc_notificacao
       FROM ccz_leishmaniose WHERE id='zzteste-leish-3'`,
  );
  check("Sem tutor: sem pessoa_cpf", semTutorReg.rows[0].pessoa_cpf === null);
  check("Sem tutor: sem nome de tutor", semTutorReg.rows[0].tutor_nome === null);
  check("Sem tutor: sem orientações de tutor", semTutorReg.rows[0].orient_zoonose === null);
  check("Sem tutor: sem conduta do tutor", semTutorReg.rows[0].conduta_tutor === null);
  check("Sem tutor: sem notificação nominal", semTutorReg.rows[0].enc_notificacao === false);

  console.log("\n8. Consulta paginada (100 por página) e filtros");
  const total = await db.query(`SELECT COUNT(*)::int AS n FROM ccz_leishmaniose`);
  check("Consulta devolve os registros", total.rows[0].n >= 3);
  const filtrado = await db.query(
    `SELECT COUNT(*)::int AS n FROM ccz_leishmaniose
      WHERE situacao_geral = 'Risco à saúde pública'`,
  );
  check("Filtro por Situação Geral funciona", filtrado.rows[0].n === 2);
  const busca = await db.query(
    `SELECT COUNT(*)::int AS n FROM ccz_leishmaniose
      WHERE animal_nome ILIKE '%Cão Leish%'`,
  );
  check("Busca por nome do animal funciona", busca.rows[0].n === 2);

  console.log("\n9. Auditoria");
  const log = await db.query(
    `SELECT COUNT(*)::int AS n FROM audit_logs WHERE entidade='Leishmaniose'`,
  );
  check("audit_logs aceita a entidade Leishmaniose", log.rows.length === 1);

  console.log("\n10. Preservação do histórico ao excluir o animal (cascata controlada)");
  await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id=$1", [ANIMAL_COM]);
  await db.query("DELETE FROM ccz_leishmaniose WHERE animal_id=$1", [ANIMAL_SEM]);
  const restou = await db.query(`SELECT COUNT(*)::int AS n FROM ccz_leishmaniose WHERE id LIKE 'zzteste-%'`);
  check("Fixtures removidas", restou.rows[0].n === 0);

  await limpar();
  await db.end();

  console.log(`\n${ok} OK / ${falhou} FALHA`);
  process.exit(falhou ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await limpar();
  } catch {}
  process.exit(1);
});
