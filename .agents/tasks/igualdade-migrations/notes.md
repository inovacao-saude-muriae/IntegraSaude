# Igualdade banco real × migrations — notas (passos 1 a 6a)

Nada foi aplicado no banco REAL neste passo (só pg_dump, SELECTs, `migrate status` e `migrate diff`, todos leitura).

## 1. Backup
- Arquivo: `backups/pre-igualdade-migrations-20261109-161822.sql` (690.096 bytes, dump completo com dados, `--no-owner`).
- Contém `CREATE TABLE public.pessoa (`. `backups/` é ignorado pelo git (`.gitignore:63:/backups/`). NÃO commitar, NÃO apagar.

## Contagens do banco real ANTES (todas as tabelas de public)
```
audit_logs = 4
auditoria_unificacoes = 1
ccz_animais = 3
ccz_denuncias = 4
ccz_esporotricose = 3
ccz_esporotricose_relatorios = 4
ccz_esporotricose_visitas = 7
ccz_procedimentos = 3
ccz_termos_internacao = 0
ccz_tutores = 2
farmacia_ajustes_estoque = 0
farmacia_dispensacoes_medicamentos = 0
farmacia_lotes_medicamentos = 0
farmacia_medicamentos = 0
farmacia_pacientes = 0
farmacia_tratamentos_pacientes = 0
junta_agendamentos = 1
junta_atendimentos = 1
junta_especialidades = 1
junta_pacientes = 1
junta_paciente_servicos = 1
junta_servicos = 1
pessoa = 4
pessoa_endereco = 3
_prisma_migrations = 15
regula_cotas_financeiras = 0
regula_medicos = 0
regula_pedidos_exames = 0
regula_pedidos_historico = 0
regula_planejamento_cidade = 0
regula_procedimentos = 0
regula_tipo_exame = 0
regula_ubs = 0
user_acessos = 1
users = 2
user_sessions = 15
```
(também em `backups/_tmp/counts_before.txt`). `_prisma_migrations` do real: as 15 migrations com finished_at e sem rolled_back_at.

## 2–4. Estrutura e comparação
- Dumps schema-only normalizados (sem linhas `--`, `\restrict`, vazias): `backups/_tmp/real.sql`, `tmp1.sql` (temp só com as 15), `tmp2.sql` (temp com a corretiva). Diffs: `diff1.txt`, `diff2.txt`.
- Banco temporário: `integrasaude_migtest` no container `orion_db` (CREATE DATABASE com `admin` funcionou). AINDA EXISTE (estado: 16 migrations aplicadas). O próximo passo deve fazer `DROP DATABASE integrasaude_migtest`.
- `migrate deploy` ANTES da corretiva (banco vazio): as 15 migrations aplicaram SEM erro (`All migrations have been successfully applied`, EXIT=0). Nenhuma migration antiga depende de objeto que só exista no real.

### Desvios encontrados (real × migrations), lista completa via pg_dump --schema-only
1. REAL: tabela `regula_pedidos_historico` inexistente nas migrations, com:
   - colunas: id integer NOT NULL (default nextval da sequence), pedido_id integer NOT NULL, usuario_cpf varchar(11) NOT NULL, usuario_nome varchar(150) NOT NULL, acao varchar(50) NOT NULL, campo_alterado varchar(100), valor_anterior text, valor_novo text, observacao text, data_hora timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
   - sequence `regula_pedidos_historico_id_seq` (AS integer, OWNED BY id);
   - PK `regula_pedidos_historico_pkey (id)`;
   - índices `idx_historico_data (data_hora)` e `idx_historico_pedido (pedido_id)`;
   - SEM FKs (nem no real nem no model PedidoExameHistorico). Fiel ao model do schema.prisma.
2. Cosmético: `COMMENT ON SCHEMA public IS ''` só no real — o schema public do real está sem o comentário padrão ("standard public schema"), típico de schema recriado (drop/create schema). Sem efeito funcional; NÃO incluído na corretiva (não é objeto do Prisma e o Prisma não o compara).
3. Cosmético: ordem física das colunas em `users` — real tem `primeiro_acesso` antes de `username`; migrations criam `username` antes. Mesmo tipo/default/NOT NULL. Ordem de colunas não é alterável sem recriar a tabela; Prisma não considera isso drift. NÃO corrigido.
- Nenhuma outra diferença em enums, tipos, defaults, NOT NULL, índices, constraints/FKs (ON DELETE/UPDATE), sequences ou funções.

### prisma migrate diff (`--from-config-datasource --to-schema prisma/schema.prisma --script --exit-code`)
- REAL × schema.prisma: vazio ("This is an empty migration", EXIT=0) → schema.prisma NÃO precisa mudar.
- TEMP (15 migrations) × schema.prisma: EXIT=2, faltando CREATE TABLE regula_pedidos_historico + 2 índices.
- `prisma migrate status` real e temp: "Database schema is up to date!" (status não detecta esse drift; só confere a tabela de migrations).

## 5. Migration corretiva
- `prisma/migrations/20261109120000_baseline_alinhar_historico/migration.sql`
- `CREATE TABLE IF NOT EXISTS "regula_pedidos_historico"` (id SERIAL + PK inline) e `CREATE INDEX IF NOT EXISTS` para os 2 índices. Nada de DROP/ALTER.
- É ignorada pelo `.gitignore` (`*.sql`, linha 64): o usuário precisa de `git add -f`. Nada foi commitado.

## 6a. Validação no TEMPORÁRIO
- `DROP DATABASE integrasaude_migtest` + `CREATE DATABASE`, depois `migrate deploy`: 16 migrations encontradas, todas aplicadas, EXIT=0.
- Diff estrutura real × temp (`diff2.txt`): só os 2 desvios cosméticos acima (comentário do schema public, ordem de colunas em users).
- `migrate diff` temp × schema.prisma: vazio (EXIT=0).
- Teste extra de NO-OP (sem tocar no real): clone schema-only do real (`integrasaude_realclone`, restaurado de `real.sql.raw`), aplicado o migration.sql com psql ON_ERROR_STOP → só NOTICEs "already exists, skipping", exit 0; dump depois idêntico ao real.sql (diff vazio). Clone já removido.

## Para o passo 6b (banco REAL)
- Aplicar como no-op e marcar aplicada, p.ex.:
  `npx prisma db execute --file prisma/migrations/20261109120000_baseline_alinhar_historico/migration.sql` e
  `npx prisma migrate resolve --applied 20261109120000_baseline_alinhar_historico`
  (ou simplesmente `npx prisma migrate deploy`, que roda o SQL idempotente e registra; ambos são no-op na estrutura).
- Depois: recontar tabelas e comparar com a lista acima; `migrate status`; `migrate diff` real × schema (vazio).
- Helper (ignorado pelo git): `backups/_tmp/prisma-tmp.ps1 <banco> <arquivo_saida> <args do prisma>` — troca só o nome do banco na URL do .env.local e mascara a URL na saída.
- Limpeza: `DROP DATABASE integrasaude_migtest`; apagar `backups/_tmp/` (manter o backup completo).
