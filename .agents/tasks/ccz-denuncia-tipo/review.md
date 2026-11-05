# CCZ denúncia dividida em "Animais agressivos" e "Animais doentes" por discriminador `tipo` (pass 2)

A denúncia do CCZ passa a ter dois tipos — "Animais agressivos" (existente) e "Animais doentes" (novo) — reaproveitando o mesmo model `DenunciaCaoAgressivo` (tabela `ccz_denuncias`) e o mesmo formulário. Um campo discriminador `tipo` (`VARCHAR(20)`, NOT NULL, default `'AGRESSIVO'`) separa os registros; as actions de listar/criar ganham o parâmetro `tipo` sem CRUD paralelo, formulário e lista são parametrizados por prop, e o menu lateral transforma "Denúncias" num sub-dropdown aninhado no mesmo padrão de "Zoonoses → Esporotricose". A migration é uma `ALTER TABLE ADD COLUMN` não destrutiva, aplicada fora do fluxo `migrate dev`. Esta é a segunda passada: as duas pendências da revisão anterior foram endereçadas.

Watch for: nada de bloqueante. O destaque do item aninhado fora da aba Lista — apontado na v1 — foi corrigido (paths sem `subTab=LISTA`, confirmado no diff). A migration.sql continua capturada pelo `*.sql` do `.gitignore` e não aparece em `git status`; isso é lembrete de entrega (`git add -f` no commit, como as migrations anteriores), não uma falha de código. (confirmed)

**Verdict**: APPROVED

## High-level view

O discriminador foi modelado como uma única coluna no model existente, sem tocar em nenhum outro model nem na PK `zoonoses_denuncia_pkey`. A migration contém exatamente o `ADD COLUMN ... NOT NULL DEFAULT 'AGRESSIVO'` que corresponde ao schema, no mesmo estilo não destrutivo das migrations anteriores, aplicada via `db execute` + `migrate resolve --applied`.

As duas vias de leitura (`listarDenuncias(tipo)` e `GET /api/ccz/denuncias?tipo=`) filtram no `where` e, sem o parâmetro, retornam tudo; a escrita grava `tipo` com default `AGRESSIVO`. Não há CRUD duplicado, e obter/excluir por id não são tocados. Formulário e lista recebem a prop `tipo` e ajustam só rótulo/título/placeholder e o filtro de busca.

A correção da v1 no Sidebar removeu o `&subTab=LISTA` dos paths dos itens aninhados; com `nestedQuerySubTab` nulo, o destaque passa a valer em qualquer sub-aba, igual ao item Esporotricose. A aterrissagem na aba Lista continua garantida porque `page.js` mantém `DENUNCIA_AGRESSIVO`/`DENUNCIA_DOENTE` em `tabsComLista`.

A única pendência remanescente não é de runtime: o arquivo de migration está sob regra de ignore do git e precisa de `git add -f` no commit, senão o schema/código entram sem a migration.

<details>
<summary>Issues (1)</summary>

1. **Migration ignorada pelo git** — `prisma/migrations/20261106150000_add_denuncia_tipo/migration.sql` casa com `*.sql` no `.gitignore` e não aparece em `git status`; commitar com `git add` normal publica schema+código sem a migration. Usar `git add -f` nesse arquivo (como as migrations anteriores) antes do commit. Lembrete de entrega, não mudança de código. (confirmed)

</details>

<details>
<summary>Details</summary>

### Pendências da v1: uma corrigida, uma é lembrete de entrega

A revisão anterior (`2026-11-05-165010-review.md`) levantou duas questões confirmadas.

O destaque do item aninhado fora da aba Lista foi corrigido. Os paths em `Sidebar.js` agora são `/ccz?tab=DENUNCIA_AGRESSIVO` e `/ccz?tab=DENUNCIA_DOENTE`, sem `subTab`. A lógica de destaque (`isNestedActive`) resolve `nestedQuerySubTab = nestedQueryParams.get("subTab")` e aplica `(!nestedQuerySubTab || currentSubTab === nestedQuerySubTab)` — com o path sem `subTab`, essa cláusula vira `true` e o item destaca em qualquer sub-aba, exatamente como o item Esporotricose. A aterrissagem em "Lista" não regride: `page.js` mantém as duas tabs em `tabsComLista`, então `activeSubTab` cai para `"LISTA"` quando o subTab está ausente (confirmed).

A migration git-ignored permanece. `git check-ignore -v` confirma `.gitignore:64:*.sql` capturando a nova `migration.sql`; o arquivo existe em disco com o conteúdo esperado mas não é listado por `git status`. Não há mudança de código a fazer — é um passo de commit (`git add -f`), já registrado nas notas do coder. Classificado como item de entrega, não bloqueador de comportamento (confirmed).

### Discriminador numa só coluna, PK e demais models intactos

O model `DenunciaCaoAgressivo` ganha somente `tipo String @default("AGRESSIVO") @map("tipo") @db.VarChar(20)`. Nenhum outro model aparece no diff do schema e a PK `zoonoses_denuncia_pkey` não é tocada. A migration é uma única linha que bate com o schema:

```sql
ALTER TABLE "ccz_denuncias" ADD COLUMN "tipo" VARCHAR(20) NOT NULL DEFAULT 'AGRESSIVO';
```

Por ter default, as denúncias existentes recebem `AGRESSIVO` sem backfill manual, e o `NOT NULL` fica satisfeito na aplicação da coluna (confirmed).

### Leitura e escrita parametrizadas por `tipo`, sem CRUD paralelo

`listarDenuncias(tipo)` e o `GET` da rota aplicam `where: tipo ? { tipo } : undefined`; chamadas sem o argumento retornam todas as denúncias, preservando callers antigos. `salvarDenuncia` e o `POST` gravam `tipo: dados.tipo || "AGRESSIVO"`. Não há funções `obterDenuncia`/`excluirDenuncia` no diff — busca por id e exclusão não são tocadas (confirmed).

Observação de escopo (pré-existente, fora da revisão): o `POST` monta `data: { id: novoId, ...dados, tipo: ... }`, espalhando o payload do cliente direto no `create`. Esse spread já existia antes desta mudança; só a linha `tipo` foi adicionada.

### Formulário e lista reusados, segregação dupla por `tipo`

`CadastroDenuncia({ tipo = "AGRESSIVO" })` escolhe rótulo/placeholder/texto do botão por `ROTULOS_POR_TIPO` e envia `{ ...form, tipo }`; os campos gravados são os mesmos nos dois tipos. `DenunciasLista({ onEditar, tipo = "AGRESSIVO" })` ajusta o título e busca `/api/ccz/denuncias?tipo=...`. A segregação é dupla — filtro do fetch e `where` do servidor — então Agressivos mostra só `AGRESSIVO` e Doentes só `DOENTE`. A barra "Lista / Novo" é genérica, então as novas abas herdam a navegação sem código dedicado (confirmed).

### Sidebar: visibilidade e ARIA dos itens aninhados

Além do destaque corrigido (acima), vale confirmar a visibilidade: o pai "Denúncias" mantém `visivelSe: "CCZ"` e cada nested item repete `visivelSe: "CCZ"`, passando pelo recorte fail-closed de `subItemVisivel` (nestedItem sem `visivelSe` herdaria do pai; com `visivelSe` é recortado). O `aria-expanded`/`aria-controls` vêm do render genérico de nested dropdown (`nestedListId`), sem alteração nesse mecanismo (confirmed).

### Verificações de lint/build/banco (registradas pelo coder — não re-rodadas)

As notas em `notes.md` registram, para a correção desta passada: `npm run lint` com 0 erros e os mesmos 5 warnings pré-existentes; `npm run build` com sucesso (Next.js 16.3.0). O banco não foi re-validado porque a correção só mexeu em paths de menu; schema, migration e comportamento de banco (coluna `VARCHAR NOT NULL default 'AGRESSIVO'`, criação/listagem por tipo com rollback, `migrate status` up to date) já tinham sido validados no pass anterior. Conforme instruções, estas suites não foram re-executadas nesta revisão.

### Sem libs novas, sem commit/push, diff restrito à feature

O diff toca somente schema, rota, actions, formulário, lista, `page.js` e `Sidebar.js` do CCZ, mais a migration e o diretório de notas da task. Não há dependência nova nem alteração de CSS Modules. Nenhum commit/push foi feito (confirmed).

</details>

<details>
<summary>Arquivos alterados</summary>

- `prisma/schema.prisma` — adiciona campo `tipo` ao model `DenunciaCaoAgressivo`.
- `prisma/migrations/20261106150000_add_denuncia_tipo/migration.sql` — `ADD COLUMN tipo` (untracked e git-ignored pelo `*.sql`).
- `src/app/api/ccz/denuncias/route.js` — `GET` aceita `?tipo=`; `POST` grava `tipo`.
- `src/app/ccz/actions.js` — `listarDenuncias(tipo)` filtra no where; `salvarDenuncia` grava `tipo`.
- `src/app/ccz/CadastroDenuncia.js` — prop `tipo` ajusta rótulos; envia `tipo` ao salvar.
- `src/app/ccz/DenunciasLista.js` — prop `tipo` ajusta título e filtro do fetch.
- `src/app/ccz/page.js` — abas `DENUNCIA_AGRESSIVO`/`DENUNCIA_DOENTE` com subTabs Lista/Novo.
- `src/components/Sidebar.js` — "Denúncias" vira nested dropdown; paths sem `subTab=LISTA` (correção v1).

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff` + o `migration.sql` untracked.

</details>
