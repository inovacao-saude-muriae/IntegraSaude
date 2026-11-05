# Remoção completa do módulo de Notificação de Zoonoses (CadastroZoonoses)

Esta mudança remove por inteiro a entidade `CadastroZoonoses` (tabela `ccz_zoonoses_notificacoes`) e tudo que a servia: o model Prisma e a relação `Animal.zoonoses`, as telas de lista/formulário/ficha no CCZ, o PDF do termo, o item de menu, as server actions de CRUD e as rotas API `/api/ccz/zoonoses`. As referências a zoonoses em telas compartilhadas (relatórios do gerenciamento, histórico/ficha do animal, termos em branco, DELETE de animal) foram podadas junto. O grep final pelos símbolos específicos (`CadastroZoonoses`, `ZoonosesLista`, `FichaZoonose`, `zoonosesPdf`, `gerarTermoZoonose`, `salvarZoonose`, `listarZoonoses`, `obterZoonose`) dá zero no código da aplicação, e nenhuma chamada de cliente Prisma (`cadastroZoonoses`, relação `.zoonoses`) sobrou. As quatro entidades que só têm "zoonoses" no nome da PK — `Tutor`, `DenunciaCaoAgressivo`, `CadastroProcedimento`, `Esporotricose` — continuam intactas com seus map names originais.

Watch for: a árvore de trabalho também contém, não commitada, a feature `esporotricose-encerramento` (campos novos no model `Esporotricose`, action `encerrarEsporotricose`, coluna Status, badge no card do animal). Essas linhas aparecem neste `git diff main` mas pertencem a outra tarefa já revisada e aprovada — não são alteração acidental desta remoção (confirmed). Fora isso, nenhum model além de `CadastroZoonoses`/`Animal.zoonoses` mudou por conta desta tarefa.

**Verdict**: APPROVED

## High-level view

A remoção está completa e cirúrgica no que diz respeito ao escopo. O model `CadastroZoonoses` e a linha `zoonoses CadastroZoonoses[]` no `Animal` saíram do schema; o `Animal` mantém as relações `denuncias`, `esporotricose`, `procedimentos` e `termos`. Os arquivos exclusivos de zoonoses (`CadastroZoonoses.js`, `ZoonosesLista.js`, `FichaZoonose.js`, `zoonosesPdf.js`, e as duas rotas em `src/app/api/ccz/zoonoses/`) foram deletados, e os pontos de uso em arquivos compartilhados foram editados para remover apenas o trecho de zoonoses, preservando o resto.

As entidades a preservar foram verificadas uma a uma no schema: os quatro map names de PK que contêm "zoonoses" (`tutor_zoonoses_pkey`, `zoonoses_denuncia_pkey`, `zoonoses_procedimento_pkey`, `zoonoses_esporotricose_pkey`) continuam exatamente como estavam. As ocorrências restantes da palavra "Zoonose" no código são o nome próprio do órgão ("Centro de Controle de Zoonoses") em cabeçalhos de PDF/termo e a heurística de ícone do Sidebar — nenhuma delas liga à entidade removida.

O ponto que exige atenção não é um defeito desta tarefa: o `git diff` contra `main` carrega também a feature de encerramento de esporotricose, ainda não commitada, de uma tarefa irmã. É ruído no diff desta revisão, atribuível e já aprovado em `.agents/tasks/esporotricose-encerramento/review.json`, não uma modificação indevida de outro model pela remoção de zoonoses.

<details>
<summary>Issues (1)</summary>

1. **Diff carrega feature de esporotricose não commitada** — as alterações do model `Esporotricose` e da UI de encerramento aparecem neste diff mas são de outra tarefa (`esporotricose-encerramento`), já revisada e aprovada. Não bloqueia; apenas confirme no commit que as duas tarefas vão em commits separados se a intenção for manter o histórico limpo.

</details>

<details>
<summary>Details</summary>

### Schema: model e relação removidos, entidades vizinhas preservadas

O model `CadastroZoonoses` (com `@@map("ccz_zoonoses_notificacoes")` e PK `zoonoses_notificacao_pkey`) foi removido do `schema.prisma`, assim como a linha `zoonoses CadastroZoonoses[]` no model `Animal`. O `Animal` permanece com `denuncias`, `esporotricose`, `procedimentos` e `termos`.

As entidades a preservar carregam todas "zoonoses" no nome da PK e são o alvo clássico de uma remoção por engano. Todas continuam presentes e inalteradas:

```
model Tutor                 @id(map: "tutor_zoonoses_pkey")
model DenunciaCaoAgressivo  @id(map: "zoonoses_denuncia_pkey")
model CadastroProcedimento  @id(map: "zoonoses_procedimento_pkey")
model Esporotricose         @id(map: "zoonoses_esporotricose_pkey")
```

### Remoção de UI, actions e API sem refs órfãs

Os arquivos exclusivos de zoonoses foram deletados: `src/app/ccz/CadastroZoonoses.js`, `ZoonosesLista.js`, `FichaZoonose.js`, `zoonosesPdf.js`, e as rotas `src/app/api/ccz/zoonoses/route.js` e `.../[id]/route.js`. As server actions `salvarZoonose`, `listarZoonoses` e `obterZoonose` saíram de `actions.js`.

Nos arquivos compartilhados a edição foi pontual, removendo só o trecho de zoonoses: o `page.js` perdeu os imports de `CadastroZoonoses`/`ZoonosesLista`/`obterZoonose`, o estado `zoonoseEdicao`, o handler `editarZoonose`, o ramo `activeTab === "ZOONOSES"` e a entrada "ZOONOSES" em `tabsComLista`; o `DashboardCCZ.js` perdeu o import `listarZoonoses`, o KPI "Outras Zoonoses" e a chamada no `Promise.all`; `FichaCompletaAnimal.js` e `historicoAnimalPdf.js` deixaram de desestruturar e iterar `zoonoses` na timeline; `TermosEmBranco.js` perdeu o termo tipo `zoonose`, a função `gerarTermoZoonosePdf` e o modal correspondente; o `Sidebar.js` perdeu o sub-item "Zoonoses"; e os relatórios do gerenciamento (`api/gerenciamento/relatorios/route.js` e `gerenciamento/relatorios/page.js`) deixaram de incluir e somar zoonoses.

O ponto de maior risco de órfão era o `TermosEmBranco.js`, que poderia ter ficado importando de `./zoonosesPdf` (arquivo deletado) ou chamando `gerarTermoZoonosePdf`. O grep confirma que não: tanto a definição interna quanto a chamada foram removidas, e não há import pendente para o módulo apagado. O grep pelos oito símbolos de zoonoses retornou zero em `src/**/*.js`, e `cadastroZoonoses`/`.zoonoses` também não aparecem — ou seja, nenhuma chamada de cliente Prisma quebrada.

As ocorrências de "Zoonose" que sobraram são todas o nome próprio do órgão ("Centro de Controle de Zoonoses") em cabeçalhos/rodapés de PDFs e termos preservados, mais a string da heurística de ícone no `Sidebar.js`. Nenhuma se refere à entidade removida.

### DELETE de animal: contagem de vínculos atualizada

O DELETE de animal (tanto em `actions.js` quanto em `api/ccz/animais/[id]/route.js`) deixou de incluir `zoonoses` no `include`, de somá-las no total de registros vinculados e de mencioná-las na mensagem de erro, que passou a ser "(procedimentos ou esporotricose)".

</details>

<details>
<summary>File map</summary>

- `prisma/schema.prisma` — remove model `CadastroZoonoses` e relação `Animal.zoonoses` (a adição de campos em `Esporotricose` é da tarefa irmã).
- `src/app/ccz/CadastroZoonoses.js` — **deletado** (formulário).
- `src/app/ccz/ZoonosesLista.js` — **deletado** (lista).
- `src/app/ccz/FichaZoonose.js` — **deletado** (ficha/termo).
- `src/app/ccz/zoonosesPdf.js` — **deletado** (PDF do termo).
- `src/app/api/ccz/zoonoses/route.js` — **deletado** (GET lista).
- `src/app/api/ccz/zoonoses/[id]/route.js` — **deletado** (GET/DELETE por id).
- `src/app/ccz/actions.js` — remove `salvarZoonose`/`listarZoonoses`/`obterZoonose` e refs em `excluirAnimal`/`listarAnimais`/`obterHistoricoCompleto` (demais mudanças são de esporotricose).
- `src/app/ccz/page.js` — remove imports, estado, handler, ramo e aba de zoonoses.
- `src/app/ccz/DashboardCCZ.js` — remove KPI e carga de zoonoses.
- `src/app/ccz/FichaCompletaAnimal.js` — remove zoonoses da timeline.
- `src/app/ccz/historicoAnimalPdf.js` — remove zoonoses da timeline do PDF.
- `src/app/ccz/TermosEmBranco.js` — remove termo/função/modal de zoonose.
- `src/components/Sidebar.js` — remove sub-item "Zoonoses".
- `src/app/api/gerenciamento/relatorios/route.js` — remove include/evento/resumo de zoonoses.
- `src/app/gerenciamento/relatorios/page.js` — remove zoonoses das linhas de resumo.
- `src/app/api/ccz/animais/[id]/route.js` — remove zoonoses da checagem de DELETE.
- `src/app/ccz/AnimaisLista.js`, `EsporotricoseLista.js`, `FichaEsporotricose.js` — alterações pertencem à tarefa `esporotricose-encerramento` (não a esta).

Diff completo: `git diff main`.

</details>
