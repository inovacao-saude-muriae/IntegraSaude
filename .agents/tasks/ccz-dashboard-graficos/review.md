# Campo dataDevolucao do animal + gráficos mensais empilhados no Dashboard CCZ

A mudança adiciona a coluna `data_devolucao` (DATE) ao model `Animal` via migration ADD COLUMN autorizada, expõe um campo de data de devolução no formulário do animal que aparece apenas quando a situação é "Devolvido", e faz a action de salvar gravar `dataDevolucao` (null quando a situação não é "Devolvido"). No DashboardCCZ, a porcentagem foi removida das barras do gráfico "Procedimentos por Tipo", o painel saiu do `kpiGrid` para uma nova `chartsSection` (preservando os 4 KPIs por linha) e dois gráficos recharts de barras empilhadas (entradas por mês e devoluções por mês, ambos "Com tutor" x "Sem tutor", 12 meses, dropdown de ano) foram adicionados, alimentados por duas server actions que agregam no servidor sob o guard do módulo CCZ.

Watch for: nenhum relatório do coder (lint/build/verificação de banco) foi encontrado no diretório da tarefa — a confirmação de que a migration foi aplicada e marcada como `--applied` e de que `prisma generate` rodou não pôde ser lida (possible). A agregação de entradas usa `getUTCMonth()` sobre `dataCadastro` (Timestamptz) com janela UTC, coerente entre filtro e bucket (confirmed, sem problema).

**Verdict**: APPROVED

## High-level view

A migration SQL contém exatamente `ALTER TABLE "ccz_animais" ADD COLUMN "data_devolucao" DATE;` e o schema recebeu só a linha `dataDevolucao DateTime? @map("data_devolucao") @db.Date` dentro do model `Animal`. Nenhum outro model, `.env` ou dado foi tocado. O diff não contém `git add`/commit.

No formulário, a troca de situação passa por um handler dedicado que limpa `dataDevolucao` quando a situação deixa de ser "Devolvido", e o input de data só é renderizado nesse estado. A action `salvarAnimal` espelha essa regra no servidor: grava `new Date(dados.dataDevolucao)` apenas quando situação é "Devolvido" e há valor, caso contrário `null`. `obterAnimal` e `listarAnimais` devolvem a data normalizada em `YYYY-MM-DD`, o que casa com o input `type="date"` no modo edição.

O painel "Procedimentos por Tipo" perdeu o rótulo de porcentagem (a barra permanece, dimensionada por `item.count / maxCount`) e perdeu o `grid-column: 1 / -1`; agora vive numa `chartsSection` com grid de 3 colunas (2 em ≤1024px, 1 em ≤640px), separada do `kpiGrid` que mantém `repeat(4, 1fr)`. Os dois gráficos novos compartilham um único dropdown de ano (default ano atual, 6 anos) e são recarregados em `useEffect` quando o ano muda.

As duas server actions fazem um `findMany` cada, selecionando só `pessoaCpf` e a data relevante, e agrupam em JS sobre um esqueleto de 12 meses zerados — sem N+1. Ambas passam por `requireAcessoModulo(MODULOS.CCZ)`, o mesmo e único mecanismo de escopo usado por todas as outras actions do módulo.

<details>
<summary>Issues (2)</summary>

1. **Relatório de verificação ausente** — não há arquivo do coder no diretório da tarefa documentando lint/build e a aplicação/resolução da migration (`db execute` + `migrate resolve --applied` + `generate`). A aplicação no banco não pôde ser confirmada por leitura; convém anexar esse registro antes do merge.
2. **Dropdown de ano fixo em 6 anos** — devoluções/entradas anteriores a `ANO_ATUAL - 5` ficam inacessíveis no filtro. Aceitável para o uso atual; ampliar o range caso haja histórico mais antigo.

</details>

<details>
<summary>Details</summary>

### Migration e schema: escopo contido ao ADD COLUMN

O arquivo `prisma/migrations/20261107120000_add_animal_data_devolucao/migration.sql` contém uma única instrução:

```sql
ALTER TABLE "ccz_animais" ADD COLUMN "data_devolucao" DATE;
```

Corresponde exatamente à migration autorizada. O schema ganhou só a linha dentro do model `Animal`:

```prisma
dataDevolucao          DateTime?              @map("data_devolucao") @db.Date
```

O `git diff --stat` confirma que nenhum outro model, `.env` ou dado foi alterado. A coluna é nullable, então registros existentes não quebram. O diretório de migration é ignorado pelo `.gitignore` (`!! prisma/migrations/...`), consistente com o fluxo descrito na tarefa. O que não foi possível verificar por leitura: se a migration foi de fato aplicada via `prisma db execute`, marcada com `migrate resolve --applied` e se `prisma generate` rodou — nenhum relatório do coder existe no diretório da tarefa (possible).

### Campo de data condicionado à situação "Devolvido"

O `<select>` de situação deixou de chamar `atualizar("situacao", ...)` direto e passa por `handleSituacao`, que além de setar a situação zera `dataDevolucao` quando o novo valor não é "Devolvido":

```js
dataDevolucao: valor === "Devolvido" ? prev.dataDevolucao : "",
```

O input de data só é renderizado sob `form.situacao === "Devolvido"`, marcado como opcional. No modo edição o form é inicializado a partir de `animalInicial`, cujo `dataDevolucao` vem de `obterAnimal`/`listarAnimais` já no formato `YYYY-MM-DD` — formato que o input `type="date"` exige, então a pré-carga da data na edição não quebra.

### Gravação server-side espelha a regra do cliente

`salvarAnimal` grava a data apenas quando a situação é "Devolvido" e há valor; caso contrário, `null`, limpando qualquer valor anterior:

```js
dataDevolucao:
  dados.situacao === "Devolvido" && dados.dataDevolucao
    ? new Date(dados.dataDevolucao)
    : null,
```

Isso garante a invariante mesmo que o cliente envie `dataDevolucao` preenchida junto de outra situação — a decisão não depende de confiança no front. A situação em si já é saneada pela allowlist `["Adotado", "Devolvido", "CCZ"]` logo acima.

### Reposicionamento do painel de procedimentos e remoção da porcentagem

O `<span className={styles.chartBarLabel}>...{pct}%</span>` dentro da barra foi removido; a barra permanece dimensionada por `width: ${percentage}%` onde `percentage = item.count / maxCount * 100` (relativo ao maior valor, não ao total — a barra do tipo mais frequente ocupa 100%). O `.chartPanel` perdeu `grid-column: 1 / -1` e o painel foi movido do `kpiGrid` para uma nova `<section className={styles.chartsSection}>`, fechada corretamente após os três painéis. O `kpiGrid` mantém `grid-template-columns: repeat(4, 1fr)`, então os 4 KPIs por linha não são afetados. A `chartsSection` usa grid de 3 colunas com breakpoints (2 em ≤1024px, 1 em ≤640px).

### Gráficos empilhados e agregação sem N+1

```
ano (dropdown, default atual)
   │
   ├── estatisticaAnimaisEntradaPorMes(ano)   → [{mes, comTutor, semTutor}] x12
   └── estatisticaAnimaisDevolvidosPorMes(ano) → [{mes, comTutor, semTutor}] x12
            │
            └── CCZMensalEmpilhadoChart (Bar stackId="tutor")
```

Cada action faz um único `findMany` com `select` restrito (`pessoaCpf` + a data), filtra pela janela `[1º jan ano, 1º jan ano+1)` em UTC e agrupa em JS sobre `esqueletoMeses()` (12 meses zerados), garantindo os 12 meses sempre presentes. Não há consulta por linha/mês — sem N+1. A separação por tutor usa `a.pessoaCpf ? comTutor : semTutor`, alinhada ao critério pedido (pessoaCpf != null vs null). A action de devoluções filtra `situacao: "Devolvido"` e `dataDevolucao` na janela, exatamente o critério da tarefa.

Entradas agrupam por `getUTCMonth()` sobre `dataCadastro` (Timestamptz) com janela UTC — filtro e bucket no mesmo fuso, sem drift. Devoluções usam `dataDevolucao` (DATE), também UTC. Consistente.

Ambas passam por `requireAcessoModulo(MODULOS.CCZ)` antes de qualquer consulta e tratam 401/403 devolvendo `{ success: false }` em vez de vazar erro. Esse é o mesmo e único mecanismo de escopo que `listarAnimais`, `buscarAnimaisCCZ` e as demais actions do módulo usam — não existe filtro adicional por unidade/tenant em lugar nenhum do módulo, então as agregações respeitam o escopo existente do CCZ.

### Cobertura de testes

Não há testes automatizados no diff. O projeto aparenta não ter suíte de testes para o módulo CCZ (as tarefas anteriores também verificaram por lint/build). Não testado: a aplicação efetiva da migration no banco, o round-trip de `dataDevolucao` (salvar → obter → editar), e a agregação mensal com dados reais — tudo dependeria do relatório do coder, ausente.

</details>

<details>
<summary>Arquivos alterados</summary>

- `prisma/schema.prisma` — adiciona campo `dataDevolucao` ao model `Animal` (única linha).
- `prisma/migrations/20261107120000_add_animal_data_devolucao/migration.sql` — ADD COLUMN `data_devolucao` DATE (arquivo novo, ignorado pelo git).
- `src/app/ccz/CadastroAnimal.js` — handler de situação + input de data condicional a "Devolvido".
- `src/app/ccz/actions.js` — grava/lê `dataDevolucao`; duas server actions de agregação mensal.
- `src/app/ccz/DashboardCCZ.js` — remove rótulo %; move painel para `chartsSection`; dois gráficos + dropdown de ano.
- `src/app/ccz/DashboardCCZ.module.css` — estilos de `chartsSection`/`chartPanelCompact`/`anoFiltro`; remove `grid-column: 1 / -1`.
- `src/components/charts/CCZCharts.js` — novo `CCZMensalEmpilhadoChart`.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff` + o `migration.sql` não rastreado.

</details>
