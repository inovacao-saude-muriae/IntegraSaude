# Remoção completa do campo numeroProtocolo da Esporotricose

A mudança remove o campo `numeroProtocolo` / `numero_protocolo` do módulo de Esporotricose em toda a stack: schema Prisma, formulário de cadastro/edição, ficha de detalhe, PDFs, histórico do animal, relatório de acompanhamento gerencial e a coluna física no banco via migration de `DROP COLUMN`. O escopo ficou contido ao módulo CCZ/Esporotricose — nenhum outro model ou campo "protocolo" de outros módulos foi tocado. Junto vieram, no mesmo diff, mudanças de layout da ficha (reformatação da Visita Inicial em cards no padrão das demais visitas) e ajustes de cor de fonte (cinza → preto), que são de uma tarefa irmã e não fazem parte da remoção do protocolo.

Watch for: o diff mistura a remoção do protocolo com uma reformatação ampla de layout/cor da `FichaEsporotricose` (confirmed) — não é um defeito, mas aumenta a superfície de revisão e deveria idealmente ser commit separado.

**Verdict**: APPROVED

## High-level view

A remoção é consistente de ponta a ponta. A linha do model `Esporotricose` saiu do schema e nenhum outro model foi alterado; a busca global por `numeroProtocolo`/`numero_protocolo` fora de `.agents` e migrations retorna zero ocorrências, e no branch base esses identificadores só existiam nos 8 arquivos efetivamente modificados, o que confirma que nada de outro módulo foi removido por tabela. Protocolos de outros contextos usam nomes distintos (ex.: `numeroPasta` na Farmácia Judicial) e permaneceram intactos.

A camada de dados foi tratada corretamente: existe a migration `20261106130000_remove_esporotricose_protocolo/migration.sql` com `ALTER TABLE "ccz_esporotricose" DROP COLUMN "numero_protocolo";`, o `prisma migrate status` reporta o banco em dia (10 migrations, sem drift nem pendências), e uma consulta direta à coluna retorna `column "numero_protocolo" does not exist` — ou seja, o DROP foi efetivamente aplicado. O backup CSV `backup-numero_protocolo.csv` com os pares (id, numero_protocolo) existe no diretório da tarefa antes do drop.

As exibições não ficaram com rótulos órfãos: o subtítulo da ficha, o campo da Visita Inicial, o PDF da ficha e a descrição do histórico tiveram a linha do protocolo removida por completo, sem "Protocolo:" vazio nem separador `|` pendurado.

O diff carrega junto uma reformatação de layout e cor da ficha que pertence a outra tarefa — ruído de revisão, sem regressão.

<details>
<summary>Issues (1)</summary>

1. **Layout/cor acoplados ao diff** — a reformatação da Visita Inicial em cards e a troca de cor de fonte na `FichaEsporotricose` são de tarefa irmã e vêm no mesmo working tree; sem impacto funcional, mas idealmente separar em outro commit na hora de commitar.

</details>

<details>
<summary>Details</summary>

### Remoção no schema e isolamento do blast radius

A única alteração no `schema.prisma` é a remoção da linha `numeroProtocolo String? @map("numero_protocolo") @db.VarChar(50)` do model `Esporotricose`. Nenhum outro model foi tocado (confirmed — diff de schema tem exatamente uma linha removida). No branch base (`HEAD`), os identificadores `numeroProtocolo`/`numero_protocolo` existiam apenas em `schema.prisma`, `api/gerenciamento/relatorios/route.js`, `CadastroEsporotricose.js`, `FichaCompletaAnimal.js`, `FichaEsporotricose.js`, `ccz/actions.js`, `esporotricosePdf.js` e `historicoAnimalPdf.js` — exatamente os 8 arquivos modificados. Isso confirma que a remoção não atingiu protocolos de outros módulos; a Farmácia Judicial, por exemplo, usa `numeroPasta` (rótulo "Protocolo / Pasta") e ficou intacta (confirmed).

### Migration e estado do banco

A migration `20261106130000_remove_esporotricose_protocolo/migration.sql` contém apenas `ALTER TABLE "ccz_esporotricose" DROP COLUMN "numero_protocolo";`, com comentário apontando para o backup (confirmed). O `prisma migrate status` retorna "Database schema is up to date!" com 10 migrations e sem drift, indicando que a migration foi registrada como aplicada (compatível com o fluxo `db execute` + `migrate resolve --applied`, sem `migrate dev`/`reset`). Uma consulta direta `SELECT numero_protocolo FROM "ccz_esporotricose"` falha com `column "numero_protocolo" does not exist`, provando que o DROP foi efetivamente materializado no banco (confirmed).

O backup `backup-numero_protocolo.csv` está presente no diretório da tarefa com cabeçalho `id,numero_protocolo` e as linhas por registro (valores vazios, pois nenhum protocolo havia sido preenchido) — gerado antes do drop conforme exigido (confirmed).

### Server actions e rota de relatórios

Em `ccz/actions.js`, o campo saiu de `obterHistoricoCompleto` (projeção do histórico), de `salvarEsporotricose` (bloco `dadosEsporo` de create/update, incluindo o truncamento `.slice(0,50)`), de `listarEsporotricose` e de `obterEsporotricose` (mapeamento de retorno) (confirmed). Em `api/gerenciamento/relatorios/route.js`, o `select` do include de esporotricose deixou de pedir `numeroProtocolo` e a `descricao` do feed passou de `` `${nomeAnimal}${... - Protocolo ...}` `` para apenas `nomeAnimal`, sem concatenação condicional pendente (confirmed).

### Exibições sem rótulo órfão

No subtítulo da `FichaEsporotricose`, a linha `Protocolo: {dados.numeroProtocolo || "Sem protocolo"} | ` foi removida inteira, deixando `Animal: ...` como primeiro item — sem separador `|` solto (confirmed). O campo `Protocolo:` da seção Visita Inicial também saiu junto com a reformatação da seção em card. O `esporotricosePdf.js` removeu o `drawCampo(..., "Número do protocolo", ...)` e reposicionou "Fiscal responsável" na coluna anterior, sem lacuna de layout (confirmed). `FichaCompletaAnimal.js` e `historicoAnimalPdf.js` removeram o `descInicial.push("Protocolo: ...")` da montagem da descrição da visita inicial (confirmed). `EsporotricoseLista.js` não referenciava o campo, então não precisou de alteração (confirmed).

### Mudanças de layout/cor acopladas (fora do escopo da remoção)

O grosso do diff de `FichaEsporotricose.js` é a reconversão das `<section>`/`fichaGrid` da Visita Inicial, Tratamento, Manejo, Conclusão e Encaminhamentos para `styles.visitaCard`/`styles.relatorioBox`, mais a troca de cor de `#64748b` para `#0f172a` em descrições, medicamentos e observações. As classes `visitaCard` e `relatorioBox` existem em `ListaCCZ.module.css`, então não há referência a classe inexistente (confirmed). Essas mudanças pertencem às tarefas irmãs "esporotricose-visita-inicial" e de ajuste de cor; não introduzem regressão, mas inflam o diff desta tarefa (confirmed).

</details>

<details>
<summary>Mapa de arquivos</summary>

- `prisma/schema.prisma` — remove a linha `numeroProtocolo` do model `Esporotricose`.
- `prisma/migrations/20261106130000_remove_esporotricose_protocolo/migration.sql` — `DROP COLUMN "numero_protocolo"` (arquivo novo, não rastreado).
- `src/app/ccz/actions.js` — remove o campo de create/update/select/mapeamentos das actions.
- `src/app/api/gerenciamento/relatorios/route.js` — remove do `select` e da `descricao` do feed de relatórios.
- `src/app/ccz/CadastroEsporotricose.js` — remove o campo do form (FORM_VAZIO e input).
- `src/app/ccz/FichaEsporotricose.js` — remove protocolo do subtítulo e da Visita Inicial; + reformatação de layout/cor (tarefa irmã).
- `src/app/ccz/FichaCompletaAnimal.js` — remove `Protocolo:` da descrição da visita inicial.
- `src/app/ccz/esporotricosePdf.js` — remove o campo "Número do protocolo" do PDF.
- `src/app/ccz/historicoAnimalPdf.js` — remove `Protocolo:` da descrição no PDF de histórico.
- `.agents/tasks/remove-esporotricose-protocolo/backup-numero_protocolo.csv` — backup (id, numero_protocolo) antes do drop.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff` + arquivos não rastreados em `git status`.

</details>
