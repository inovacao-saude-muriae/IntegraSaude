# Filtro de ano global no DashboardCCZ

Move o filtro de ano para uma toolbar acima dos KPIs (padrão: ano atual, opção "Todos os anos"). Ele passa a controlar os KPIs, "Procedimentos por Tipo" e os dois gráficos mensais, todos agregados no servidor por uma nova `estatisticasDashboardCCZ(ano)` e pelas actions mensais, que aceitam `ano` opcional. As actions `listar*` não foram alteradas, então os outros chamadores continuam intactos. "Devolvidos" ficou restrito a `situacao=Devolvido` e `pessoaCpf` nulo, com série única "Sem tutor"; "Entraram" continua empilhado. Os números estão nos gráficos e a porcentagem saiu de Procedimentos por Tipo.

Watch for: (1) o KPI "Animais" usa `dataCadastro`, mas o gráfico "entraram" usa `COALESCE(dataDevolucao, dataCadastro)`, então a soma do gráfico pode divergir do KPI (confirmed, documentado); (2) a janela do ano é em UTC e não no fuso do Brasil, o que afeta registros Timestamptz perto de 31/12 e 01/01 (likely); (3) não há indicador de loading ao trocar o ano (confirmed).

**Verdict**: APPROVED

## High-level view

O filtro é um único estado `anoSelecionado` que dispara um `useEffect` que recarrega três chamadas em paralelo, com flag de cancelamento contra respostas fora de ordem. Os KPIs usam `count` e `groupBy` no servidor, cada um com uma regra de data documentada em `actions.js`. As regras são Tutor.createdAt, Animal.dataCadastro, dataProcedimento, dataVisita e dataDenuncia, e batem com o pedido.

Os gráficos mensais ficam em `CCZCharts.js`. O empilhado mostra o valor por segmento (>0) e o total acima da barra. O simples mostra o valor acima da barra. Procedimentos por Tipo mostra a contagem absoluta e não tem mais porcentagem. A única mudança em `schema.prisma` é a coluna `dataDevolucao` da feature anterior, que foi preservada. Não há migrations novas, `.env` nem dados alterados, e nada foi commitado.

<details>
<summary>Issues (4)</summary>

1. **Janela de ano em UTC** (likely) — `janelaAno` e `getUTCMonth` usam UTC. Em campos Timestamptz (`dataCadastro`, `createdAt`, `dataDenuncia`), registros entre 21h e 24h de 31/12 no horário local caem no ano ou mês seguinte. Considerar fuso America/Sao_Paulo. Não bloqueante.
2. **KPI Animais x gráfico "entraram"** (confirmed) — datas de referência diferentes (`dataCadastro` x `COALESCE(dataDevolucao, dataCadastro)`), então os totais podem divergir para um mesmo ano. Documentado no código. Considerar um aviso na UI.
3. **Sem loading ao trocar o ano** (confirmed) — `loading` só vale para o carregamento inicial. Se `estatisticasDashboardCCZ` falhar, os KPIs antigos continuam na tela sem aviso de erro. Adicionar um estado de carregando/erro.
4. **Visual não verificado** (confirmed) — o coder não validou no navegador (login). Conferir rótulos e legibilidade manualmente.

</details>

<details>
<summary>Details</summary>

### Regras de data e janela de ano

`janelaAno` devolve `[1/jan, 1/jan seguinte)` em UTC, e `filtroData` vira `{gte, lt}` no Prisma. Para colunas `@db.Date` (`dataProcedimento`, `dataVisita`, `dataDevolucao`) isso é exato. Para as Timestamptz (`Animal.dataCadastro`, `Tutor.createdAt`, `dataDenuncia`) a borda do ano e do mês segue UTC e não o horário de Brasília. O erro só aparece em registros feitos à noite em 31/12 ou no último dia do mês, e é pequeno, mas é inconsistente com o que o usuário veria no calendário local.

### Entradas x KPI Animais

O gráfico "entraram" busca animais com `dataCadastro` ou `dataDevolucao` no ano e reaplica a data efetiva em JS. Um animal cadastrado em 2025 e adotado em 2026 conta como entrada em 2026 mas fica fora do KPI "Animais" de 2026. Com "Todos os anos" o gráfico soma por mês do calendário em todos os anos, o que também está documentado.

### Devolvidos sem tutor

A consulta usa `situacao: "Devolvido"`, `pessoaCpf: null` e `dataDevolucao` no ano (ou `not null` em "Todos"). Atende exatamente ao pedido. O título "(sem tutor)", a série única cinza e as barras simples estão corretos. Devolvidos sem data não aparecem no gráfico, o que é esperado.

### Compatibilidade e escopo

As funções novas são adicionadas, e `listar*` não mudou nos parâmetros. O `dataDevolucao` em `salvarAnimal` e `listarAnimais` vem da feature anterior não commitada, que foi mantida.

</details>

<details>
<summary>Arquivos alterados</summary>

- src/app/ccz/actions.js — `estatisticasDashboardCCZ` e as duas actions mensais com `ano`
- src/app/ccz/DashboardCCZ.js — toolbar do filtro, carga por ano, seção de gráficos
- src/app/ccz/DashboardCCZ.module.css — toolbar e layout dos gráficos
- src/components/charts/CCZCharts.js — gráficos mensais com rótulos
- src/app/ccz/CadastroAnimal.js, prisma/schema.prisma — feature anterior (`dataDevolucao`), preservada

Diff completo: `git diff HEAD`.

</details>