# Relatório final: EMPI com CPF provisório (unificação de pessoas)

## Migration
- Nome: `20261108120000_empi_unificacao_pessoa` (aplicada via `prisma db execute --file` e marcada com `prisma migrate resolve --applied`). `prisma migrate status`: "Database schema is up to date". `prisma migrate diff` (banco → schema.prisma): vazio.
- O `.gitignore` ignora `*.sql`. Ao commitar: `git add -f prisma/migrations/20261108120000_empi_unificacao_pessoa/migration.sql` (NÃO commitado nesta tarefa). O `rollback.sql.txt` ao lado não é migration.

## Backup
- `c:\Users\Jefinny\Documents\10. IntegraSaude\backups\pre-empi-20261106-175938.sql` (687.476 bytes), feito com `pg_dump` completo (container `orion_db`) ANTES de qualquer mudança. Contém `CREATE TABLE public.pessoa`. `git check-ignore` confirma que está ignorado. Não foi apagado.
- Observação: o carimbo do nome usa a data do relógio da máquina.

## DDL final (migration.sql)
```sql
BEGIN;
ALTER TABLE "pessoa"
    ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "unificado_em_cpf" VARCHAR(11),
    ADD COLUMN "data_unificacao" TIMESTAMPTZ(6),
    ADD COLUMN "unificado_por_usuario_id" VARCHAR(11);
ALTER TABLE "pessoa"
    ADD CONSTRAINT "fk_pessoa_unificado_em" FOREIGN KEY ("unificado_em_cpf") REFERENCES "pessoa"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "fk_pessoa_unificado_por" FOREIGN KEY ("unificado_por_usuario_id") REFERENCES "users"("cpf") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "chk_pessoa_unificado_inativo" CHECK ("unificado_em_cpf" IS NULL OR "ativo" = false);
CREATE INDEX "idx_pessoa_ativo" ON "pessoa"("ativo");
CREATE INDEX "idx_pessoa_unificado_em" ON "pessoa"("unificado_em_cpf");
CREATE SEQUENCE "seq_cpf_provisorio" START 1;
CREATE FUNCTION "gerar_cpf_provisorio"() RETURNS varchar LANGUAGE sql AS
$$ SELECT 'T' || lpad(nextval('seq_cpf_provisorio')::text, 10, '0') $$;
CREATE TABLE "auditoria_unificacoes" (
    "id" SERIAL NOT NULL,
    "pessoa_principal_cpf" VARCHAR(11) NOT NULL,
    "pessoas_absorvidas_cpfs" JSONB NOT NULL,
    "motivo" TEXT,
    "usuario_id" VARCHAR(11),
    "snapshot_anterior" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_unificacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_auditoria_unif_principal" FOREIGN KEY ("pessoa_principal_cpf") REFERENCES "pessoa"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_auditoria_unif_usuario" FOREIGN KEY ("usuario_id") REFERENCES "users"("cpf") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "idx_auditoria_unif_principal" ON "auditoria_unificacoes"("pessoa_principal_cpf");
CREATE INDEX "idx_auditoria_unif_data" ON "auditoria_unificacoes"("created_at");
COMMIT;
```
**FKs existentes (verificadas no catálogo `pg_constraint`)**: `fk_endereco_pessoa`, `fk_pedidos_pessoa`, `farmacia_pacientes_pessoa_cpf_fkey`, `junta_pacientes_pessoa_cpf_fkey`, `ccz_tutores_pessoa_cpf_fkey` (ON DELETE CASCADE) e `ccz_animais_pessoa_cpf_fkey` → `ccz_tutores` (ON DELETE SET NULL) JÁ eram `ON UPDATE CASCADE`. Por isso nenhuma constraint foi recriada; só o `schema.prisma` ganhou `onUpdate: Cascade` para refletir o banco.

## SQL de rollback (escrito, NÃO executado; arquivo `rollback.sql.txt`)
```sql
BEGIN;
DROP TABLE IF EXISTS "auditoria_unificacoes";
DROP FUNCTION IF EXISTS "gerar_cpf_provisorio"();
DROP SEQUENCE IF EXISTS "seq_cpf_provisorio";
ALTER TABLE "pessoa" DROP CONSTRAINT IF EXISTS "chk_pessoa_unificado_inativo";
DROP INDEX IF EXISTS "idx_pessoa_ativo";
DROP INDEX IF EXISTS "idx_pessoa_unificado_em";
ALTER TABLE "pessoa" DROP CONSTRAINT IF EXISTS "fk_pessoa_unificado_em";
ALTER TABLE "pessoa" DROP CONSTRAINT IF EXISTS "fk_pessoa_unificado_por";
ALTER TABLE "pessoa"
    DROP COLUMN IF EXISTS "ativo", DROP COLUMN IF EXISTS "unificado_em_cpf",
    DROP COLUMN IF EXISTS "data_unificacao", DROP COLUMN IF EXISTS "unificado_por_usuario_id";
COMMIT;
-- Depois: DELETE FROM "_prisma_migrations" WHERE migration_name = '20261108120000_empi_unificacao_pessoa';
```

## Importação de pessoas só com nome (CPF provisório)
`sexo`, `data_nascimento`, `nome_mae` e `telefone` são NOT NULL; use valores neutros (`1900-01-01` é tratado como "data vazia" no merge e no formulário).
```sql
INSERT INTO pessoa (cpf, nome_completo, sexo, data_nascimento, nome_mae, telefone)
VALUES (gerar_cpf_provisorio(), 'FULANO DE TAL', 'Masculino', DATE '1900-01-01', '', '');

-- em lote, a partir de uma tabela de staging
INSERT INTO pessoa (cpf, nome_completo, sexo, data_nascimento, nome_mae, telefone)
SELECT gerar_cpf_provisorio(), nome, 'Masculino', DATE '1900-01-01', '', '' FROM tabela_staging;
```
Verificado em `BEGIN; ... ROLLBACK;` (gerou `T0000000001`, `ativo = true`). A sequence foi devolvida ao início (`setval(..., 1, false)`), então o primeiro CPF provisório real será `T0000000001`.

## Contagens antes / depois (idênticas)
| Tabela | Antes | Depois (migration) | Depois (testes + limpeza) |
|---|---|---|---|
| pessoa | 2 | 2 | 2 |
| pessoa_endereco | 2 | 2 | 2 |
| regula_pedidos_exames | 0 | 0 | 0 |
| junta_pacientes | 1 | 1 | 1 |
| farmacia_pacientes | 0 | 0 | 0 |
| ccz_tutores | 2 | 2 | 2 |
| ccz_animais | 3 | 3 | 3 |
| users | 2 | 2 | 2 |
| audit_logs | 1 | 1 | 1 |
| auditoria_unificacoes | n/a (nova) | 0 | 0 |
| regula_procedimentos / regula_tipo_exame | 0 / 0 | – | 0 / 0 |

## Testes (script temporário, apagado; 51 verificações PASS, 0 FAIL; dados de teste removidos, 0 restantes)
Os testes chamam o núcleo `src/lib/unificacaoPessoa.js` contra o banco local com CPFs de teste fictícios, com limpeza no `finally`. As server actions dependem de cookies/sessão do Next e NÃO foram chamadas diretamente.
1. Migration: 4 colunas novas, 8 FKs de pessoa/tutor com `confupdtype = c` (CASCADE), sequence, função e tabela existem. PASS.
2. CPF provisório → oficial sem conflito: pedido, endereço, junta, farmácia, tutor e animal acompanharam o novo CPF; o provisório deixou de existir; demais dados atualizados. PASS.
3. Conflito: CPF oficial já ativo → `CPF_DUPLICADO_CONFLITO` com `pessoa_conflito {cpf, nome}` (só duas chaves) e a mensagem exigida; nada salvo (registro idêntico antes/depois). CPF de cadastro inativo → erro, nada salvo. CPF oficial não pode ser trocado. CPF inválido rejeitado. Edição sem CPF mantém o provisório. PASS.
4. Unificação feliz: pedidos 1+2=3, endereços 1+2=3 (só o atual do alvo permanece atual), junta movida, farmácia do alvo preservada, origem `ativo=false` com `unificado_em_cpf`, `data_unificacao` e `unificado_por_usuario_id`, origem não excluída, nome e telefone do alvo preservados, campos vazios do alvo preenchidos (mãe, data, CNS; CNS da origem anulado antes), linha em `auditoria_unificacoes` com snapshot completo (alvo, origem, 2 pedidos, 2 endereços, junta). Cenário com tutor: tutor + 2 animais movidos; foto base64 fora do snapshot. PASS.
5. Conflito de módulo (ambos com junta): `CONFLITO_MODULO` com `modulos: ["JUNTA"]`, estado idêntico, nenhuma linha de auditoria. PASS.
6. Rejeições: origem oficial, alvo provisório, origem == alvo, origem já absorvida, alvo inativo, origem inexistente. PASS.
7. Absorvida fora das buscas: no banco a pessoa existe, mas a consulta com `ativo: true` (mesmo `where` das buscas) não a retorna. Validado no nível de consulta Prisma, não via telas.
8. Atomicidade: falha simulada logo após mover os pedidos → rollback total (pedidos na origem, origem ativa, CNS intacto, sem auditoria). PASS. Também: o CHECK `chk_pessoa_unificado_inativo` bloqueia `unificado_em_cpf` com `ativo = true`. PASS.

## Política de conflito por módulo
Esta versão BLOQUEIA a unificação inteira (rollback, sem escrita) quando origem e alvo têm registro no mesmo módulo com unicidade por pessoa: Junta, Farmácia Judicial (um por pessoa) ou CCZ (tutor). Retorna `{ success:false, status:"CONFLITO_MODULO", modulos:[...], mensagem }`. Nada é apagado nem sobrescrito. Pedidos e endereços (N por pessoa) sempre são movidos. Uma versão futura poderia mesclar: mover agendamentos/atendimentos/serviços (Junta), tratamentos/dispensações (Farmácia) e animais (CCZ) para o registro do alvo, com revisão manual e registro no snapshot.

## Decisões e comportamento
- `pessoa_conflito.cpf` vem SEM máscara (só dígitos); o front formata/usa conforme necessário.
- Fonte dos campos vazios do alvo: dados digitados no formulário primeiro (dado mais recente), depois o cadastro absorvido. Nunca sobrescreve campo preenchido do alvo; `nomeCompleto` do alvo nunca muda. "Vazio" = texto em branco, data `1900-01-01`, CNS/UBS nulos. `sexo` é NOT NULL e importado com valor padrão, então só é preenchido se estiver em branco.
- `registrarAuditoria` (acao `UNIFICAR`, módulo `GERENCIAMENTO`, entidade `Pessoa`) é chamado na action após o sucesso; `UNIFICAR` foi adicionado a `AUDIT_ACOES`. A gravação em `audit_logs` NÃO foi exercitada (depende de sessão no Next).
- Não foi criada a rota `POST /api/pessoas/confirmar-unificacao` (opcional no plano): o front usa a server action `confirmarUnificacaoPessoas`.
- Linhas trancadas com `SELECT ... FOR UPDATE` (alvo e origem) para evitar unificações concorrentes.

## Pontos com `ativo: true` aplicado
- `gerenciamento/pessoas/actions.js`: `listarPessoas`; `criarPessoa` (CPF existente inativo → mensagem própria); edição/exclusão bloqueiam cadastro inativo (via núcleo).
- `api/pessoas/route.js` (GET `where`; POST: mensagem para CPF de cadastro unificado), `api/pessoas/buscar/route.js`, `api/pessoas/[cpf]/route.js` (404 se inativo).
- `ccz/actions.js`: `buscarPessoasCCZ`; `salvarAnimal` exige tutor `ativo`.
- `junta-reguladora/actions.js`: `buscarPessoaExistente`, `cadastrarPacienteJunta` (exige `ativo`), listagem por serviço, `getProntuarioUnificado`.
- `regulacao/actions.js`: `getAuxiliaryData`, `searchPessoa`, `searchPessoasAutocomplete`, `createPedidoExame` (bloqueia pessoa inativa).
- `camara-tecnica/farmacia-judicial/actions.js`: `createPacienteJudicial` exige `ativo`.
- `actions/users.js` (`buscarPessoaPorCpfAction`), `api/admin/metrics/route.js` (`pessoa.count`), `api/gerenciamento/relatorios/route.js` (lista de pessoas).

**Sem filtro de propósito:** consultas que partem de registros dependentes (`include: { pessoa: true }` em pedidos, junta, farmácia, CCZ, dashboards e relatórios históricos). Os dependentes são movidos para o cadastro principal, então já apontam para pessoas ativas. `excluirPessoa` não filtra por `ativo`. A lista de pacientes da Farmácia (query SQL crua `getPacientesJudiciais`) também não foi alterada, pelo mesmo motivo.

## CPF provisório na interface
- `isCpfProvisorio`, `normalizarCpfChave`, `formatarCpfExibicao`, `ROTULO_CPF_PROVISORIO`, `DATA_NASC_PLACEHOLDER` em `src/lib/cpf.js`.
- `formatarCpf`/`documentoPaciente` (regulacao/constants.js, usado por SeletorPaciente e listas) mostram "CPF não informado" (ou o CNS, se houver). Os `formatCPF` locais de NovoPedido, FiltersBar, PacientesJudiciais, CadastroPacienteJunta e ProntuarioRelatorio usam `formatarCpfExibicao`. A máscara de CPF oficial é a mesma de antes.
- Dedups por CPF em FiltersBar/Dispensacao tratam provisório como "sem CPF" (não colapsam pessoas distintas).
- CadastroPessoas: campo CPF liberado só ao editar uma pessoa com CPF provisório (com dica), bloqueado para oficial como antes. Em `CPF_DUPLICADO_CONFLITO` abre o modal (`role="dialog"`, `aria-modal`, foco, Esc via `useModalKeyboard`) com o título, o corpo e os botões pedidos. A unificação mostra "Unificando...", trata `CONFLITO_MODULO` listando os módulos, e no sucesso notifica e abre a ficha do cadastro principal com a lista recarregada.

## Arquivos
Criados: `prisma/migrations/20261108120000_empi_unificacao_pessoa/{migration.sql,rollback.sql.txt}`, `src/lib/cpf.js`, `src/lib/unificacaoPessoa.js`, `.agents/tasks/empi-cpf-provisorio/report.md`.
Alterados: `prisma/schema.prisma` (novos campos/relações/model `AuditoriaUnificacao`, `onUpdate: Cascade`; o `prisma format` realinhou o arquivo, então o diff é grande), `src/lib/pessoa.js`, `src/lib/audit.js`, `src/app/gerenciamento/pessoas/actions.js`, `src/components/CadastroPessoas/CadastroPessoas.js`, `src/app/regulacao/{actions.js,constants.js,NovoPedido.js,FiltersBar.js}`, `src/app/junta-reguladora/{actions.js,CadastroPacienteJunta.js,ProntuarioRelatorio.js}`, `src/app/camara-tecnica/farmacia-judicial/{actions.js,PacientesJudiciais.js}`, `src/app/ccz/actions.js`, `src/app/actions/users.js`, `src/app/api/pessoas/{route.js,buscar/route.js,[cpf]/route.js}`, `src/app/api/admin/metrics/route.js`, `src/app/api/gerenciamento/relatorios/route.js`.
Scripts de teste temporários (`scripts/_tmp-*`) apagados. Nenhum servidor foi iniciado.

## Comandos executados e resultado
- `pg_dump` (backup), contagens e catálogo antes/depois: OK.
- Dry-run da migration em `BEGIN; ... ROLLBACK;`: OK, nada persistiu. Aplicação real: `prisma db execute` + `prisma migrate resolve --applied`: OK.
- `npx prisma generate`: OK (v7.9.1). `npx prisma validate`: válido. `npx prisma migrate status`: banco atualizado. `prisma migrate diff`: vazio.
- `npm run lint`: 0 erros, 5 warnings (os mesmos 5 preexistentes).
- `npm run build`: sucesso.
- Testes de banco: 51 PASS, 0 FAIL, limpeza confirmada (0 pessoas de teste, `auditoria_unificacoes` = 0).

## O que NÃO foi verificado
- Validação visual do modal e do fluxo completo na tela: não foi feita. Não há credencial de login conhecida (não criei nem alterei usuários) e nenhum servidor/navegador foi usado. O front foi validado apenas por lint e build.
- As server actions (guarda `requireAcessoPessoas`, `revalidatePath`, `registrarAuditoria` / gravação em `audit_logs` com ação `UNIFICAR`) não foram exercitadas em runtime. O núcleo transacional, que contém toda a lógica de dados, foi testado.
- Buscas/listagens foram verificadas no nível da consulta Prisma (`ativo: true`), não pelas telas.
- Nenhum `git add`/commit/push foi feito. A pasta `.agents/tasks/empi-etapa1/` foi ignorada.
