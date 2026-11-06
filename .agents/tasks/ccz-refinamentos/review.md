# Refinamento CCZ: campo de data para Adotado + COALESCE nas entradas por mês

A mudança estende o campo de data do animal (coluna existente `dataDevolucao`) para aparecer também quando a situação é "Adotado" (além de "Devolvido"), com rótulo adaptado ("Data da adoção" x "Data da devolução"), mantendo o campo opcional. A action `salvarAnimal` passa a gravar `dataDevolucao` quando a situação é "Devolvido" OU "Adotado" (e `null` caso contrário), e a agregação de "entradas por mês" passa a aplicar COALESCE(dataDevolucao, dataCadastro) para Adotado/Devolvido e `dataCadastro` para CCZ/"". O gráfico de devoluções por mês permanece inalterado (filtra `situacao="Devolvido"` por `dataDevolucao`). As features de dashboard/gráficos pré-existentes no working tree foram preservadas.

**Verdict**: APPROVED

## Visão geral

As duas mudanças pedidas estão implementadas e corretas, e as restrições verificáveis foram respeitadas. Não há blockers.

### MUDANÇA 1 — campo de data para "Devolvido" OU "Adotado" (CadastroAnimal.js + actions.js)

- `handleSituacao` preserva `dataDevolucao` quando a nova situação é `"Devolvido"` ou `"Adotado"` e limpa (`""`) para `"CCZ"`/`""`:
  ```js
  dataDevolucao:
    valor === "Devolvido" || valor === "Adotado" ? prev.dataDevolucao : "",
  ```
- O input de data só é renderizado sob `(form.situacao === "Devolvido" || form.situacao === "Adotado")`, com rótulo condicional "Data da adoção" (Adotado) / "Data da devolução" (demais). O input `type="date"` não tem `required` — campo opcional, confirmado. Usa `atualizar("dataDevolucao", ...)` (helper existente) e respeita `camposDesabilitados`, coerente com os demais campos.
- A inicialização do form (`animalInicial || FORM_VAZIO`) traz `dataDevolucao` já normalizado em `YYYY-MM-DD` via `obterAnimal`/`listarAnimais`, formato exigido pelo input — a pré-carga na edição não quebra.
- `salvarAnimal` espelha a regra no servidor num único `upsert` (create e update compartilham `dadosAnimal`):
  ```js
  dataDevolucao:
    (dados.situacao === "Devolvido" || dados.situacao === "Adotado") &&
    dados.dataDevolucao
      ? new Date(dados.dataDevolucao)
      : null,
  ```
  Grava a data só para Devolvido/Adotado com valor; caso contrário `null`, limpando valor anterior ao trocar para CCZ/"" — inclusive no caminho de update. A invariante não depende de confiança no front. Sem coluna nova.

### MUDANÇA 2 — COALESCE na agregação de entradas por mês (actions.js)

`estatisticaAnimaisEntradaPorMes` busca animais com `dataCadastro` OU `dataDevolucao` dentro do ano e decide a data efetiva por animal:
```js
const usaDataSituacao =
  (a.situacao === "Adotado" || a.situacao === "Devolvido") && a.dataDevolucao;
const dataRef = usaDataSituacao
  ? new Date(a.dataDevolucao)
  : a.dataCadastro ? new Date(a.dataCadastro) : null;
if (!dentroDoAno(dataRef)) continue;
```
Isso implementa exatamente COALESCE(dataDevolucao, dataCadastro) para Adotado/Devolvido (cai para `dataCadastro` quando `dataDevolucao` é nula) e `dataCadastro` para CCZ/"". O re-filtro em JS sobre `dataRef` trata corretamente os casos de borda:
- Adotado com `dataDevolucao` fora do ano mas `dataCadastro` no ano → entra na query pelo ramo `dataCadastro`, mas `dataRef` = `dataDevolucao` (fora) → descartado. Correto (a data efetiva é a de devolução).
- Adotado com `dataDevolucao` no ano e `dataCadastro` em ano anterior → entra pelo ramo `dataDevolucao`, `dataRef` no ano → contado. Correto.

Filtro e bucket usam a mesma janela UTC (`[1º jan ano, 1º jan ano+1)`) e `getUTCMonth()`, sem drift de fuso. A separação por tutor usa `pessoaCpf` (com/sem tutor). Sem N+1 (um `findMany` com `select` restrito + agrupamento em JS sobre 12 meses zerados).

`estatisticaAnimaisDevolvidosPorMes` permanece filtrando `situacao: "Devolvido"` por `dataDevolucao` na janela — sem alteração, como pedido.

## Restrições verificáveis

- **Schema/migrations/.env**: a única linha de schema (`dataDevolucao`) e a migration são trabalho PRÉ-EXISTENTE do step `ccz-dashboard-graficos` (documentado no review daquele step) presente no working tree e que esta tarefa manda preservar — não foi criado nada novo por este step. `.env` intocado. Nenhuma coluna nova.
- **Feature de dashboard/gráficos preservada**: `DashboardCCZ.js`, `DashboardCCZ.module.css` e `CCZCharts.js` mantêm os gráficos empilhados, o dropdown de ano e a `chartsSection` do step anterior; nada foi desfeito.
- **Sem libs novas**: `CCZMensalEmpilhadoChart` usa o recharts já em uso no módulo.
- **Sem git add/commit/push/stash/checkout/reset**: `git status` mostra apenas os 6 arquivos modificados do working tree + a pasta não rastreada do step anterior; o diff não contém operações git.
- **Campo opcional**: o input não é `required`; a action aceita `null`.
- **Sem lixo deixado**: nenhum script temporário no working tree.

## Verificação (reportada pelo coder, não re-executada)

Conforme a instrução deste step, as suítes não foram re-executadas. O coder reportou `npm run lint` com 0 erros (5 warnings preexistentes) e `npm run build` com sucesso, além de validação server-side via Prisma no Docker `orion_db` (salvar Adotado+data grava a data; mudar para CCZ grava null; agregação de entradas aplica COALESCE) com limpeza/rollback, e validação visual opcional dos rótulos/visibilidade. A leitura do diff e dos arquivos tocados é consistente com esses resultados. A ausência de validação visual, sendo opcional, não é blocker.

## Não testado por leitura

A aplicação efetiva no banco e o round-trip real (salvar → obter → editar) dependem do ambiente Docker descrito pelo coder; apenas a coerência do código foi verificada por leitura aqui.
