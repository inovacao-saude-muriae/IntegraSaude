# Filtro server-side por situação na lista de animais do CCZ

Adiciona um dropdown de filtro por situação à lista de animais do CCZ (Todos / Adotados / Devolvidos / Com tutor / Sem tutor / Incinerados), com critério único por vez, e move a busca textual (antes client-side) para o servidor. A action `listarAnimais` passou a aceitar `{ termo, filtroSituacao }`, monta o `where` do Prisma combinando busca textual e filtro por `AND`, e preserva `orderBy`, `include` e o mapeamento de saída. O dropdown dispara recarga server-side; o termo usa debounce de 300ms. O mapeamento de filtros segue exatamente o especificado.

Watch for: a busca deixou de ser client-side e passou a ser server-side — mudança de comportamento maior que o filtro em si, porém coerente com o pedido (confirmed). Os filtros `ADOTADO`/`DEVOLVIDO` dependem da coluna `situacao`, introduzida por uma mudança irmã no `schema.prisma` presente no mesmo working tree (confirmed). O diff empacota trabalho não relacionado (remoção de protocolo da esporotricose, campo de situação) — fora do escopo desta tarefa (confirmed).

**Verdict**: APPROVED

## High-level view

O filtro é resolvido no servidor por uma tabela de mapeamento `WHERE_FILTRO_SITUACAO` que traduz a chave do dropdown para a cláusula Prisma exata do spec. As cláusulas de busca textual e de situação entram numa lista `condicoes` combinada por `AND`, e um `where` vazio (`{}`) é usado quando não há critério — mantendo "Todos" sem cláusula. A ordenação por `dataCadastro desc`, o `include` de tutor/esporotricose e o `select` da relação permanecem idênticos ao base.

A busca textual, que no base era feita no cliente sobre a lista completa, agora é feita no banco via `OR` (nome, id, espécie, nome do tutor e CPF por dígitos). É uma ampliação em relação ao comportamento anterior (o cliente não buscava por CPF), mas não quebra callers existentes: `DashboardCCZ.js` ainda chama `listarAnimais()` sem argumentos e o parâmetro default cobre esse caso.

A contagem no cabeçalho e a mensagem de estado vazio passaram a refletir o resultado do servidor (`animais.length`) em vez da lista filtrada localmente, o que é a consequência correta de mover o filtro para o servidor. O badge de situação no card e o campo `situacao` em `salvarAnimal`/`obterAnimal` pertencem a uma tarefa irmã (mensagem do usuário sobre adotado/devolvido/CCZ), assim como a remoção do `numeroProtocolo`; ambos aparecem no mesmo diff mas estão fora do escopo deste filtro.

<details>
<summary>Issues (2)</summary>

1. **Diff empacota trabalho não relacionado** — remoção de `numeroProtocolo` da esporotricose e campo `situacao`/badge estão no mesmo working tree, fora do escopo do filtro. Não é um defeito do filtro; ao commitar, separar por tarefa ajuda o histórico. Não desfazer (restrição explícita).
2. **Dependência de schema entre tarefas** — `ADOTADO`/`DEVOLVIDO` filtram por `Animal.situacao`, coluna adicionada por mudança irmã no `schema.prisma`. O filtro só funciona enquanto essa coluna existir no tree/BD; garantir que as duas tarefas sejam commitadas/migradas juntas.

</details>

<details>
<summary>Details</summary>

### Mapeamento do filtro e montagem do where

O coração da tarefa é a tabela `WHERE_FILTRO_SITUACAO`, que reproduz literalmente o contrato pedido:

```js
const WHERE_FILTRO_SITUACAO = {
  ADOTADO: { situacao: "Adotado" },
  DEVOLVIDO: { situacao: "Devolvido" },
  COM_TUTOR: { pessoaCpf: { not: null } },
  SEM_TUTOR: { pessoaCpf: null },
  INCINERADO: { esporotricose: { some: { incinerado: "Sim" } } },
};
```

A chave `INCINERADO` usa `esporotricose: { some: ... }` — o nome da relação bate com o `include`/`select` usados logo abaixo (`esporotricose`), então a cláusula resolve a relação certa. "Com tutor" / "Sem tutor" mapeiam para `pessoaCpf` not-null / null, que é a FK do tutor no modelo `Animal`, coerente com como `tutorNome` é derivado de `tutor.pessoa`. Chave desconhecida ou vazia simplesmente não adiciona cláusula (o `if (WHERE_FILTRO_SITUACAO[filtro])` protege contra chave inválida), o que satisfaz o caso "Todos".

A combinação por `AND` é feita acumulando em `condicoes` e produzindo `{ AND: condicoes }` apenas quando há pelo menos uma cláusula; caso contrário o `where` fica `{}`. Isso preserva a semântica de "sem filtro = todos" e evita um `AND: []` desnecessário. `orderBy`, `include` e o `.map` de saída são idênticos ao base, atendendo à exigência de preservar ordenação/select/include.

### Busca textual movida para o servidor

No base, `listarAnimais()` não recebia argumentos e não tinha `where`; a filtragem por texto acontecia em `AnimaisLista.js` via `animais.filter(...)`. Agora a busca é uma cláusula `OR` no banco:

```js
condicoes.push({
  OR: [
    { nome: { contains: termoLimpo, mode: "insensitive" } },
    { id: { contains: termoLimpo, mode: "insensitive" } },
    { especie: { contains: termoLimpo, mode: "insensitive" } },
    { tutor: { pessoa: { nomeCompleto: { contains: termoLimpo, mode: "insensitive" } } } },
    ...(termoDigitos ? [{ pessoaCpf: { contains: termoDigitos } }] : []),
  ],
});
```

`mode: "insensitive"` é suportado pelo provider `postgresql` do schema, então a busca case-insensitive é válida. A cláusula adiciona busca por CPF (só dígitos) que o filtro client-side anterior não tinha; é uma ampliação aditiva e segue o mesmo padrão já usado em `listarAnimaisDoTutor` no arquivo. O termo é limpo com `trim()` e, quando vazio, nenhuma cláusula de texto é adicionada, preservando o retorno completo.

A contagem do cabeçalho e o ramo de estado vazio passaram de `filtrados.length` para `animais.length`; como `animais` é agora o resultado já filtrado pelo servidor, a contagem e a mensagem "Nenhum animal encontrado." continuam corretas. Não há referências órfãs a `filtrados`/`termoLimpo` no componente. A assinatura `({ termo = "", filtroSituacao = "" } = {})` tem default de objeto, então o caller `DashboardCCZ.js`, que chama `listarAnimais()` sem argumentos, continua gerando `where = {}` e não quebra.

### Ciclo de vida e UI do dropdown

O `useEffect` reage a `termo` e `filtroSituacao` com debounce de 300ms, aplicando-o também à troca de filtro: um clique no select só dispara a consulta após 300ms, então o dropdown não é instantâneo. `excluirAnimal` recarrega com `(termo, filtroSituacao)` atuais, mantendo o filtro ativo após a exclusão.

### Mudanças empacotadas fora do escopo

O mesmo working tree inclui a remoção de `numeroProtocolo` (schema, `salvarEsporotricose`, `listarEsporotricose`, `obterEsporotricose`, `obterHistoricoCompleto`, PDFs e `relatorios/route.js`) e a introdução de `Animal.situacao` (schema, `salvarAnimal`, `obterAnimal`, badge no card). Essas mudanças correspondem a outras mensagens do usuário na mesma sessão e não fazem parte da tarefa do filtro. A restrição desta tarefa proíbe desfazê-las, então permanecem. A única nota é operacional: os filtros `ADOTADO`/`DEVOLVIDO` só funcionam porque a coluna `situacao` foi adicionada por essa tarefa irmã — as duas precisam ser commitadas e migradas juntas para o filtro não falhar em produção.

</details>

<details>
<summary>Arquivos no diff do filtro</summary>

- `src/app/ccz/AnimaisLista.js` — dropdown de situação, debounce, recarga server-side, contagem/estado vazio sobre `animais`.
- `src/app/ccz/actions.js` — `listarAnimais({ termo, filtroSituacao })` com `WHERE_FILTRO_SITUACAO` e busca textual combinada por `AND`.
- `src/app/ccz/ListaCCZ.module.css` — `.listaToolbar`, `.filtroSelect`, `.filtroSelect:focus` (e `.badgeInfo`, da tarefa irmã).

Demais arquivos do diff (`schema.prisma`, `CadastroAnimal.js`, `CadastroEsporotricose.js`, `FichaEsporotricose.js`, `FichaCompletaAnimal.js`, `esporotricosePdf.js`, `historicoAnimalPdf.js`, `relatorios/route.js`) pertencem às tarefas irmãs de situação e de remoção de protocolo.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff`.

</details>
