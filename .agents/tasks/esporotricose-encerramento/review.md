# Encerramento de caso de esporotricose no módulo CCZ

Adiciona o ciclo de encerramento de casos de esporotricose: três colunas novas no model `Esporotricose` (`encerrado`, `dataEncerramento`, `encerradoPor`), uma server action `encerrarEsporotricose` que grava o encerramento registrando data e nome do usuário logado, um botão "Encerrar caso" na ficha com confirmação via `useConfirm`/`useNotify`, uma coluna "Status" na lista de casos e um badge de status no card do animal. A migration foi criada manualmente e aplicada via `prisma db execute` + `migrate resolve` porque `migrate dev` detectou drift pré-existente (tabela `regula_pedidos_historico`) e queria resetar o banco — decisão correta dado que reset é proibido. A mudança de schema fica restrita ao model `Esporotricose`, como exigido.

Watch for: a migration é a única porção não rastreada pelo git (gitignore `*.sql`); precisa de `git add -f` no commit — ainda não commitada (confirmed). A validação de UI em runtime não foi exercitada; cobertura é lint + build + round-trip no banco + leitura de código (confirmed, declarado pelo coder).

**Verdict**: APPROVED

## High-level view

O schema ganha exatamente os três campos autorizados no model `Esporotricose`, com os mesmos mapeamentos e tipos de coluna que o resto do schema usa (`@map` snake_case, `@db.Timestamptz(6)`, `@db.VarChar(150)`). O diff do `schema.prisma` não toca nenhum outro model. A migration SQL contém só os três `ADD COLUMN` e o DDL bate com o que o Prisma geraria, então o histórico de migrations e o estado real do banco ficam alinhados sem introduzir o drift que já existia.

A action `encerrarEsporotricose` é um clone fiel de `excluirEsporotricose`: mesma guarda `requireAcessoModulo(MODULOS.CCZ)`, mesma validação de ID, mesma checagem de existência, mesmo tratamento de 401/403 e mesmo `revalidatePath("/ccz")`. A diferença comportamental relevante é a proteção contra duplo encerramento (retorna erro se `encerrado` já for true), que atende o requisito de não duplicar encerramento. O responsável vem de `user.nome` — o `requireAcessoModulo` retorna o user completo, então o campo existe.

A ficha esconde o botão quando o caso já está encerrado e mostra badge de status, data e responsável. O coder também corrigiu um bug pré-existente de confirmação no `handleExcluir` (o `window.confirm` nativo sombreado pelo hook `confirm`, que retornava Promise sempre truthy) — alinhando ambos os handlers aos hooks. Isso vai além do escopo estrito do encerramento mas corrige um defeito real de confirmação na mesma tela e usa a API de hooks que de fato existe no provider.

O card do animal usa a regra "Encerrado somente quando todos os casos estão encerrados; caso contrário Em andamento", o que é uma escolha sensata para múltiplos casos e está documentada no código. O badge só aparece quando há caso de esporotricose.

<details>
<summary>Issues (2)</summary>

1. **Migration não rastreada** — `prisma/migrations/.../migration.sql` está sob gitignore (`*.sql`); exige `git add -f` no commit, senão o histórico de migrations fica incompleto no repositório (confirmed).
2. **UI não validada em runtime** — fluxo de botão/badge/coluna/card não foi exercitado no navegador (sem automação de login no ambiente); cobertura indireta por lint, build, round-trip no banco e leitura de código (confirmed, declarado).

</details>

<details>
<summary>Details</summary>

## Schema e migration restritos ao model autorizado

O diff do `schema.prisma` adiciona apenas três linhas dentro do bloco `model Esporotricose`:

```prisma
encerrado                Boolean               @default(false)
dataEncerramento         DateTime?             @map("data_encerramento") @db.Timestamptz(6)
encerradoPor             String?               @map("encerrado_por") @db.VarChar(150)
```

Nenhum outro model aparece no diff — a restrição "só o model Esporotricose pode mudar" é respeitada (confirmed). Os mapeamentos seguem a convenção do schema: snake_case em `@map`, `@db.Timestamptz(6)` para o timestamp e `@db.VarChar(150)` conforme especificado.

A migration SQL contém exatamente o DDL que o Prisma geraria para essas três colunas, com `encerrado BOOLEAN NOT NULL DEFAULT false` e as outras duas nullable — o que casa com `encerrado Boolean @default(false)` (não-nulo com default) e os campos opcionais. Aplicá-la via `db execute` + `migrate resolve` em vez de `migrate dev` foi a escolha certa: `migrate dev` teria proposto `migrate reset` por causa do drift pré-existente de `regula_pedidos_historico`, e reset é proibido pela tarefa. O drift não foi introduzido por esta mudança.

A migration está sob gitignore (`*.sql`), então não aparece em `git status` e precisa de `git add -f` para ser commitada (confirmed via `file_search includeIgnoredFiles`). O coder registrou isso e não fez commit nesta tarefa.

## Action de encerramento segue o padrão do CCZ

`encerrarEsporotricose(id)` espelha `excluirEsporotricose`: `requireAcessoModulo(MODULOS.CCZ)` como guarda, `String(id).trim()` para validar o ID, `findUnique` para checar existência, o mesmo bloco `catch` que converte 401/403 em `{ success:false, error }` e loga o resto, e `revalidatePath("/ccz")` ao final. O retorno `{ success, error? }` é o contrato padrão das actions do módulo.

A proteção contra duplo encerramento está presente:

```js
if (registro.encerrado) {
  return { success: false, error: "Este caso já está encerrado." };
}
```

Isso atende o requisito de não duplicar o encerramento no servidor, complementando o fato de o botão sumir na UI. O responsável é gravado como `user?.nome ? String(user.nome).slice(0, 150) : null` — `requireAcessoModulo` retorna o user completo (com `cpf/nome/role/acessos`, conforme `carregarUsuarioSessao` em `src/lib/auth.js`), então `user.nome` resolve e o `slice(0,150)` respeita o `VarChar(150)`.

## Confirmação e feedback na ficha + correção de bug colateral

O botão "Encerrar caso" só renderiza quando `!dados.encerrado`, e usa `confirm({ title, message, confirmText })` seguido de `notify({ tipo, message })` — API que confere com `src/components/ConfirmDialog.js` (`useConfirm` retorna `Promise<boolean>`, `useNotify` aceita `{ tipo, message }` com tipos `info|sucesso|erro`). Após sucesso, recarrega via `obterEsporotricose` para refletir o novo estado sem reload de página.

O coder também migrou `handleExcluir` do `window.confirm`/`alert` nativos para os mesmos hooks. Isso corrige um defeito real: com `const confirm = useConfirm()` no topo do componente, a chamada `if (!confirm("..."))` chamava o hook (que retorna uma Promise sempre truthy), então a exclusão nunca era cancelada. É uma correção legítima de confirmação na mesma tela, não um refactor gratuito, e deixa os dois handlers consistentes.

## Regra de status para múltiplos casos no card do animal

`listarAnimais` troca `select:{id} take:1` por `select:{id, encerrado}` (sem `take`) e expõe:

```js
esporotricoseEncerrada: a.esporotricose?.length > 0
  ? a.esporotricose.every((e) => e.encerrado)
  : false
```

Ou seja, o animal só aparece como "Encerrado" quando todos os seus casos estão encerrados; qualquer caso aberto mantém "Em andamento". É uma regra defensável para o cenário de múltiplos casos e está comentada no código. O badge só é exibido quando `temEsporotricose` é true. As classes `badgeDanger`/`badgeSuccess` usadas no card, na lista e na ficha existem em `src/app/ccz/ListaCCZ.module.css`, então não há estilo quebrado.

## Coluna Status na lista de casos

`EsporotricoseLista` adiciona `<th>Status</th>` imediatamente após "Nº visitas" e renderiza um badge verde "Em andamento" / vermelho "Encerrado" por linha, lendo `r.encerrado` que `listarEsporotricose` agora retorna como `Boolean(r.encerrado)`. Posição e semântica batem com o requisito de coluna ao lado de "Visitas".

## Cobertura de verificação

O coder registrou `npm run lint` (0 erros, 5 warnings pré-existentes), `npm run build` com sucesso (Next.js 16.3.0) e um round-trip no banco local confirmando as três colunas (`data_encerramento, encerrado, encerrado_por`) com escrita/leitura revertida por rollback. A re-verificação após a correção do `handleExcluir` repetiu lint e build com os mesmos resultados. A credibilidade é alta: os detalhes conferidos neste review (API dos hooks, retorno do `requireAcessoModulo`, existência das classes CSS, DDL da migration) são todos consistentes com o que foi declarado.

Não testado: fluxo de UI em runtime (requer login/navegador, indisponível no ambiente). É a única lacuna de verificação, honestamente declarada, e não bloqueante dado o nível de cobertura indireta — uma passagem manual no navegador antes do deploy ainda é recomendável.

</details>

<details>
<summary>File map</summary>

- `prisma/schema.prisma` — model `Esporotricose`: +3 campos (`encerrado`, `dataEncerramento`, `encerradoPor`); nenhum outro model tocado.
- `prisma/migrations/20261105124331_add_esporotricose_encerramento/migration.sql` — novo; três `ADD COLUMN`. Gitignored (`*.sql`), precisa `git add -f`.
- `src/app/ccz/actions.js` — nova action `encerrarEsporotricose`; `listarEsporotricose`/`obterEsporotricose`/`listarAnimais` passam a expor campos de encerramento.
- `src/app/ccz/EsporotricoseLista.js` — coluna "Status" com badge.
- `src/app/ccz/FichaEsporotricose.js` — botão "Encerrar caso", badge/data/responsável na ficha; `handleExcluir` migrado para os hooks (correção de bug de confirmação).
- `src/app/ccz/AnimaisLista.js` — badge de status de esporotricose no card.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff` + o arquivo de migration (não rastreado).

</details>
