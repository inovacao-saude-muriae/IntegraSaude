# Esporotricose — Encerramento de caso (notas do coder)

## Resumo
Implementado o encerramento de casos de esporotricose no módulo CCZ: status
"Em andamento" (padrão) / "Encerrado", botão de encerrar na ficha, coluna
"Status" na lista de casos e badge de status no card do animal.

## Schema / Migration
- `prisma/schema.prisma` — model `Esporotricose` (tabela `ccz_esporotricose`),
  adicionados:
  - `encerrado Boolean @default(false)`
  - `dataEncerramento DateTime? @map("data_encerramento") @db.Timestamptz(6)`
  - `encerradoPor String? @map("encerrado_por") @db.VarChar(150)`
- Migration criada: `prisma/migrations/20261105124331_add_esporotricose_encerramento/migration.sql`
  (apenas `ALTER TABLE ... ADD COLUMN` para as 3 colunas).

### Por que NÃO usei `prisma migrate dev`
`npx prisma migrate dev` detectou **drift pré-existente** (tabela
`regula_pedidos_historico` existe no banco e no schema, mas não está no
histórico de migrations) e quis rodar `migrate reset`, o que é proibido pela
tarefa. Para não resetar nem tocar em migrations/dados existentes:
1. Criei o diretório/arquivo da migration manualmente (SQL só com as 3 colunas).
2. Apliquei com `npx prisma db execute --file <migration.sql>` (só ADD COLUMN).
3. Marquei como aplicada com `npx prisma migrate resolve --applied 20261105124331_add_esporotricose_encerramento`.
4. Rodei `npx prisma generate`.
O drift de `regula_pedidos_historico` é pré-existente e foi deixado intacto.

### LEMBRETE git add -f
O `.gitignore` tem `*.sql`, então o arquivo
`prisma/migrations/20261105124331_add_esporotricose_encerramento/migration.sql`
precisa ser adicionado com **`git add -f`** quando for commitado.
**Nenhum commit foi feito nesta tarefa.**

## Action de encerramento
`src/app/ccz/actions.js`:
- Nova action `encerrarEsporotricose(id)`: valida acesso ao módulo CCZ
  (`requireAcessoModulo(MODULOS.CCZ)` — retorna o usuário logado), bloqueia se o
  caso já estiver encerrado, e grava `encerrado=true`,
  `dataEncerramento=now()`, `encerradoPor=user.nome` (até 150 chars).
  `revalidatePath("/ccz")`. Retorno padrão `{ success, error? }`.
- `listarEsporotricose` agora retorna `encerrado` (boolean) por registro.
- `obterEsporotricose` agora retorna `encerrado`, `dataEncerramento` (ISO) e
  `encerradoPor`.
- `listarAnimais` agora seleciona `esporotricose { id, encerrado }` (sem
  `take:1`) e expõe `esporotricoseEncerrada`.

## Regra de status no card do animal (múltiplos casos)
`esporotricoseEncerrada = (há casos) ? todos encerrados : false`.
Ou seja: **"Em andamento"** se existir ao menos um caso NÃO encerrado;
**"Encerrado"** apenas quando TODOS os casos do animal estão encerrados.
O badge só aparece quando o animal tem ao menos um caso de esporotricose.

## Arquivos alterados
- `prisma/schema.prisma` (model Esporotricose: +3 campos)
- `prisma/migrations/20261105124331_add_esporotricose_encerramento/migration.sql` (novo)
- `src/app/ccz/actions.js` (nova action + ajustes de retorno)
- `src/app/ccz/EsporotricoseLista.js` (coluna "Status" ao lado de "Nº visitas",
  badge verde "Em andamento" / vermelho "Encerrado")
- `src/app/ccz/FichaEsporotricose.js` (botão "Encerrar caso" com confirmação via
  useConfirm/useNotify, badge de status no cabeçalho, info de data/responsável
  quando encerrado; botão some quando já encerrado — não duplica encerramento;
  reabrir NÃO foi implementado)
- `src/app/ccz/AnimaisLista.js` (badge "Esporotricose: Encerrado/Em andamento")

## Verificação executada
- `npm run lint` → **0 erros, 5 warnings** (os 5 são pré-existentes:
  CadastroTutor.js, FichaCompletaAnimal.js, login/page.js,
  HistoricoPedidoModal.js, RelatorioAcessos.js).
- `npm run build` → **sucesso** (Next.js 16.3.0, compilou e gerou páginas).
- Verificação no banco local (script node temporário com adapter PrismaPg,
  depois removido; sem imprimir segredos):
  - Colunas encontradas: `data_encerramento, encerrado, encerrado_por`.
  - Round-trip dentro de transação: `encerrado=true`, data gravada,
    `encerradoPor="TESTE_VERIFICACAO"` lido de volta.
  - Transação revertida (rollback) → nenhum dado de teste persistido
    (`encerrado` voltou a `false`). Script temporário apagado.

## Não verificado
- Validação visual no navegador (servidor + login) NÃO foi executada —
  requer autenticação. A cobertura foi feita via lint + build + round-trip no
  banco. Fluxo de UI (botão/badge/coluna/card) validado por leitura de código.

---

## Correção da revisão (CHANGES_REQUESTED → re-verificação)

Finding confirmado: `const confirm = useConfirm()` no topo de
`FichaEsporotricose.js` sombreava o `window.confirm` nativo ainda usado em
`handleExcluir` (`if (!confirm("..."))`), que, por receber um Promise sempre
truthy, nunca cancelava — a exclusão ocorria sem confirmação. Além disso,
`handleExcluir` usava `alert()` nativo para feedback.

Correção aplicada em `src/app/ccz/FichaEsporotricose.js`:
- `handleExcluir` migrado para o mesmo padrão de `handleEncerrar`:
  `const ok = await confirm({ title, message, confirmText: "Excluir" }); if (!ok) return;`
- Os dois `alert()` restantes de `handleExcluir` trocados por
  `await notify({ tipo, message })` (sucesso/erro), consistente com a ficha.
- Confirmado por grep que não restam chamadas a `confirm(`/`alert(` nativas no
  arquivo; ambos os handlers (`handleEncerrar`, `handleExcluir`) usam os hooks.
- API dos hooks conferida em `src/components/ConfirmDialog.js`:
  `useConfirm()` retorna `Promise<boolean>` e aceita
  `{ title, message, confirmText, cancelText }`; `useNotify()` aceita
  `{ title, message, tipo, okText }` ou uma string.

### Re-verificação executada
- `npm run lint` → **0 erros, 5 warnings** (os mesmos 5 pré-existentes).
- `npm run build` → **sucesso** (Next.js 16.3.0, 49 páginas geradas).
- Verificação no banco local (script node temporário, depois apagado; sem
  imprimir segredos): as 3 colunas continuam presentes
  (`data_encerramento, encerrado, encerrado_por`).

### Ainda não verificado em runtime
- Fluxo de UI no navegador (botão Encerrar + botão Excluir com o novo diálogo)
  NÃO foi exercitado em runtime: não há automação de navegador/login disponível
  neste ambiente. A correção é um alinhamento direto de `handleExcluir` ao
  padrão já funcional de `handleEncerrar`, usando os mesmos hooks cuja API foi
  conferida no provider.
