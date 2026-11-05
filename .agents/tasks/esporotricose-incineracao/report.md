# Esporotricose — Registro de Incineração

## Resumo
Adicionado ao caso de ESPOROTRICOSE (módulo CCZ) o registro de INCINERAÇÃO do
animal, independente do encerramento do caso. Select na ficha + badge no card do
animal, persistido via server action com nova migration (autorizada pelo usuário).

## Schema / Migration
- `prisma/schema.prisma` — model `Esporotricose` (tabela `ccz_esporotricose`),
  adicionados 2 campos (coexistindo com encerrado/data_encerramento/encerrado_por,
  que NÃO foram tocados):
  - `incinerado String? @default("") @map("incinerado") @db.VarChar(20)`
  - `dataIncineracao DateTime? @map("data_incineracao") @db.Timestamptz(6)`
- Migration criada (NÃO commitada): 
  `prisma/migrations/20261106120000_add_esporotricose_incineracao/migration.sql`
  - `ALTER TABLE "ccz_esporotricose" ADD COLUMN "incinerado" VARCHAR(20) DEFAULT '';`
  - `ALTER TABLE "ccz_esporotricose" ADD COLUMN "data_incineracao" TIMESTAMPTZ(6);`
- Fluxo seguido (SEM migrate dev / reset, por drift pré-existente):
  `prisma db execute --file ...` (aplicado ao banco local) →
  `prisma migrate resolve --applied 20261106120000_add_esporotricose_incineracao` →
  `npx prisma generate` (client v7.9.1 regenerado).
- LEMBRETE: `.gitignore` ignora `*.sql`, então ao commitar será necessário
  `git add -f prisma/migrations/20261106120000_add_esporotricose_incineracao/migration.sql`.
  (Commit NÃO foi feito nesta tarefa, conforme instruções.)

## Arquivos alterados
- `prisma/schema.prisma` — 2 campos novos no model Esporotricose.
- `src/app/ccz/actions.js`:
  - nova action `registrarIncineracaoEsporotricose(id, valor)` — mesma guarda
    `requireAcessoModulo(MODULOS.CCZ)` das outras edições, valores aceitos
    "Sim"/"Não"/"" (qualquer outro vira ""); grava `dataIncineracao = now()` quando
    "Sim", senão `null`; `revalidatePath("/ccz")`.
  - `obterEsporotricose` — retorna `incinerado` e `dataIncineracao`.
  - `listarAnimais` — `select` de esporotricose agora inclui `incinerado`; novo
    campo derivado `esporotricoseIncinerado`.
- `src/app/ccz/FichaEsporotricose.js`:
  - import da nova action; estado `salvandoIncineracao`; handler `handleIncineracao`
    (atualização inline, sem confirm, com `useNotify` de feedback — padrão das
    edições inline); nova seção "Incineração do Animal" com `<select>` (Não
    informado / Sim / Não) e exibição da data quando "Sim".
  - Botão "Encerrar caso" e `handleExcluir` (confirm/notify) preservados.
- `src/app/ccz/AnimaisLista.js` — badge adicional de incineração ao lado do badge
  de Status (Em andamento/Encerrado), que foi mantido.

## Arquivos criados
- `prisma/migrations/20261106120000_add_esporotricose_incineracao/migration.sql`
- `.agents/tasks/esporotricose-incineracao/report.md` (este arquivo)

## Regra do badge no card (múltiplos casos)
Considerando TODOS os casos de esporotricose do animal:
- "🔥 Incinerado" (badgeDanger) se QUALQUER caso tiver `incinerado === "Sim"`;
- senão "Não incinerado" (badgeWarning) se QUALQUER caso tiver `incinerado === "Não"`;
- caso contrário (todos "" / não informado) NÃO mostra badge.
O badge de Status da esporotricose continua independente e inalterado.

## Verificação executada
- `npm run lint` → 0 erros, 5 warnings preexistentes (CadastroTutor, FichaCompletaAnimal,
  login/page, HistoricoPedidoModal, RelatorioAcessos). OK.
- `npm run build` → "Compiled successfully", TypeScript OK, 48 páginas geradas. OK.
- Validação no banco local (script node temporário com adapter PrismaPg, depois
  apagado; sem imprimir segredos):
  - Colunas existem: `data_incineracao` (timestamp with time zone) e
    `incinerado` (character varying).
  - Gravou e leu "Sim" (data preenchida), "Não" (data null), "" (data null),
    dentro de transação com ROLLBACK; valor original preservado ('').
- Verificação visual com navegador/login: NÃO realizada (exigiria credenciais
  que não serão usadas/impressas). O select, a persistência e o badge foram
  validados por lint + build + checagem direta no banco.

## Notas
- Nenhum commit/push/git add executado (restrição). Nenhuma mudança não commitada
  existente foi desfeita.
- Nenhuma lib nova. Estilo mantido (CSS Modules, selects/badges existentes).
- Coluna na tabela de casos NÃO adicionada (fora do escopo pedido: ficha + card).
