# Relatório final: igualdade banco real × migrations

## Backup
`backups/pre-igualdade-migrations-20261109-161822.sql`, 690.096 bytes, dump completo com dados. A pasta `backups/` está no `.gitignore`. Mantido. (`pre-empi-20261106-175938.sql` também segue na pasta.)

## Desvios encontrados (real × migrations, via pg_dump --schema-only)
| Objeto | Situação | O que foi feito |
|---|---|---|
| Tabela `regula_pedidos_historico` (10 colunas, sequence `_id_seq`, PK `regula_pedidos_historico_pkey`, índices `idx_historico_data` e `idx_historico_pedido`, sem FK) | Existia só no real, fora das migrations. Bate com o model `PedidoExameHistorico` | Criada a migration corretiva (abaixo). No real é no-op |
| `COMMENT ON SCHEMA public IS ''` | Só no real. Cosmético | Não corrigido. O Prisma não compara isso |
| Ordem física de `primeiro_acesso` e `username` em `users` | Invertida no real. Cosmético, tipos e defaults iguais | Não corrigido. Exigiria recriar a tabela e o Prisma não trata como drift |

Enums, tipos, defaults, NOT NULL, demais índices, FKs, sequences e funções: sem diferença.

## Migration corretiva
`prisma/migrations/20261109120000_baseline_alinhar_historico/migration.sql`. Só `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`.
Lembrete: `*.sql` é ignorado pelo git, então use `git add -f prisma/migrations/20261109120000_baseline_alinhar_historico/migration.sql`. Nada foi commitado.

## `migrate deploy` em banco vazio
- Antes da corretiva: as 15 migrations passaram sem erro, mas o banco ficou sem `regula_pedidos_historico` (diff contra o schema mostrava a tabela e 2 índices faltando).
- Depois da corretiva: as 16 migrations passaram sem erro e o `migrate diff` temporário × schema saiu vazio.

## Comparação de estrutura real × temporário (16 migrations)
Sobram só os 2 itens cosméticos acima. O SQL corretivo também foi testado num clone só de estrutura do real: só avisos "already exists, skipping", estrutura idêntica.

## Aplicação no banco REAL
- Dry-run: o SQL dentro de `BEGIN; ... ROLLBACK;` só gerou avisos "already exists, skipping". O pg_dump de estrutura antes e depois ficou igual (a única diferença foi o token aleatório `\restrict` do próprio pg_dump).
- Aplicação: `prisma db execute --file ...` e `prisma migrate resolve --applied 20261109120000_baseline_alinhar_historico` ("marked as applied").
- `_prisma_migrations` do real: 16 linhas, a nova com `finished_at` preenchido e sem `rolled_back_at`.
- Nota: a sessão do shell ainda tinha `DATABASE_URL` apontando para o banco temporário do passo anterior. Por isso a saída do `db execute` não foi capturada. Confirmei no real que a migration está registrada. O SQL é idempotente, então rodar de novo contra qualquer banco é inofensivo. Limpei as variáveis depois.

## `migrate status` e `migrate diff` (banco real)
- `migrate status`: "16 migrations found... Database schema is up to date!"
- `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code`: "This is an empty migration." (EXIT=0). O `schema.prisma` não foi alterado.

## Contagens antes/depois (36 tabelas)
Todas iguais, exceto `_prisma_migrations`: 15 → 16 (esperado). Principais, antes = depois: pessoa 4, pessoa_endereco 3, users 2, user_sessions 15, audit_logs 4, auditoria_unificacoes 1, ccz_tutores 2, ccz_animais 3, ccz_denuncias 4, ccz_esporotricose 3, ccz_esporotricose_relatorios 4, ccz_esporotricose_visitas 7, ccz_procedimentos 3, junta_pacientes 1, junta_agendamentos 1, junta_atendimentos 1, junta_especialidades 1, junta_servicos 1, junta_paciente_servicos 1, user_acessos 1, regula_pedidos_historico 0. Demais tabelas de farmácia e regulação: 0.

## O `migrate dev` ainda pediria reset?
Não. Sem rodar `migrate dev` no real, usei `prisma migrate diff --from-migrations prisma/migrations --to-config-datasource --script --exit-code` com um config temporário apontando para um banco de sombra vazio separado. Resultado: "This is an empty migration." (EXIT=0). O histórico reproduz exatamente o banco real. As migrations estão todas aplicadas e sem rollback, e as migrations antigas não foram editadas, então não há drift de checksum. O `migrate dev` não deve pedir reset.

## Procedimento recomendado para subir o banco na VPS (banco vazio)
Com `DATABASE_URL` e `DIRECT_URL` apontando para o banco novo e vazio:
```
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
```
Se `prisma/seed.js` for necessário: `npx prisma db seed`. Conferência:
```
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code
```
(a segunda deve dizer "empty migration"). Para restaurar dados, use o dump em vez do `migrate deploy` e depois rode `npx prisma migrate status`. Nunca use `migrate reset`, `migrate dev` ou `db push` na produção. Lembre de commitar o `migration.sql` com `git add -f`, senão a VPS não o terá.

## Limpeza e verificação
- `DROP DATABASE` de `integrasaude_migtest` e `integrasaude_shadow`: feito. Só o `integrasaude` resta no container `orion_db`.
- `backups/_tmp/` apagada. Backups completos mantidos.
- `npx prisma generate`: OK. `npm run lint`: 0 erros, 5 warnings (preexistentes). `npm run build`: OK.
- Alterações no repositório: só a nova migration (ignorada pelo git, precisa de `git add -f`) e `.agents/tasks/igualdade-migrations/`. Nada de `schema.prisma`, `src/**` ou `.env` foi tocado.
