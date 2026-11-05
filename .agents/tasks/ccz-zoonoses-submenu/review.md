# Submenu aninhado "Zoonoses" agrupando Esporotricose no dropdown CCZ (v3)

Terceira passada. A v1 apontou `aria-expanded`/`aria-controls` ausentes e cálculo de ativo frouxo (`pathname === nested.path`); ambas foram resolvidas na v2. A v2, por sua vez, flagrou uma regressão introduzida ao fechar o ponto frouxo: `isNestedActive` passou a exigir `currentSubTab === nestedQuerySubTab` com default `""`, de modo que editar um caso (`subTab=CADASTRAR`) tirava o destaque do item "Esporotricose". Esta versão corrige exatamente isso: `nestedQuerySubTab` agora é `null` quando o `path` não traz `subTab`, e o destaque passa a comparar `subTab` só quando o destino o especifica — mantendo a comparação exata de `tab`. A reorganização do menu, o destino `/ccz?tab=ESPOROTRICOSE` e a visibilidade por perfil seguem corretos.

Watch for: nada bloqueante. A lógica de ativo agora cobre as três sub-aba de ESPOROTRICOSE (URL sem `subTab`, `subTab=LISTA`, `subTab=CADASTRAR`), todas mantendo o destaque (confirmed). O relatório de lint/build do coder não foi encontrado no diretório da tarefa; os checks não foram re-executados conforme instruído (possible).

**Verdict**: APPROVED

## High-level view

As três pendências levantadas ao longo das passadas estão fechadas. O botão do sub-dropdown "Zoonoses" expõe `aria-expanded={isNestedOpen}` e `aria-controls="nested-ZOONOSES"`, e o botão de topo do módulo recebeu o mesmo par (`submenu-/ccz`). Como ambos os níveis são `<button>` nativos, o teclado já funcionava; agora o estado expandido é anunciado a leitores de tela, entregando a acessibilidade pedida no novo nível.

A regressão de destaque da v2 foi corrigida na raiz. `nestedQuerySubTab` deixou de ter default `""` e passa a ser `null` quando o `path` do nested item não traz `subTab`; `isNestedActive` usa `(!nestedQuerySubTab || currentSubTab === nestedQuerySubTab)`, então para o Esporotricose — cujo `path` é só `/ccz?tab=ESPOROTRICOSE` — a cláusula de `subTab` é ignorada e o item destaca em qualquer sub-aba daquele `tab`, enquanto `currentTab === "ESPOROTRICOSE"` continua exato (sem destaque cruzado entre abas). Isso cobre a view inicial (URL sem `subTab`), a aba LISTA e a aba CADASTRAR acessada ao editar um caso.

Navegação e visibilidade seguem corretas. "Esporotricose" navega para `/ccz?tab=ESPOROTRICOSE` — o mesmo destino byte a byte do leaf anterior — então a aba aberta e toda a lógica de `page.js` permanecem intactas; a remoção da aba ZOONOSES vista no diff pertence à tarefa de remoção do formulário e não afeta ESPOROTRICOSE. O nested item mantém `visivelSe: "CCZ"`, recortado pela camada de nestedItems de `construirMenu` igual ao leaf anterior (fail-closed). Nenhuma lib nova e nenhuma alteração no CSS: as classes `nestedBtn`/`nestedBtnOpen`/`nestedMenuList`/`activeLink` já existiam.

<details>
<summary>Issues (0)</summary>

Nenhuma pendência bloqueante. Todas as questões das passadas anteriores (acessibilidade, ativo frouxo, regressão de destaque na sub-aba CADASTRAR) foram resolvidas.

</details>

<details>
<summary>Details</summary>

## Correção da regressão de destaque (pendência da v2 fechada)

A v2 havia flagrado que `isNestedActive` ficou exata demais em `subTab` após o conserto do ponto frouxo. O código atual:

```js
const [nestedBasePath, nestedQuery] = (nested.path || "").split("?");
const nestedQueryParams = new URLSearchParams(nestedQuery || "");
const nestedQueryTab = nestedQueryParams.get("tab") || "DASHBOARD";
const nestedQuerySubTab = nestedQueryParams.get("subTab");   // null quando ausente
const isNestedActive = nested.path
  ? pathname === nestedBasePath &&
    currentTab === nestedQueryTab &&
    (!nestedQuerySubTab || currentSubTab === nestedQuerySubTab)
  : pathname === (sub.path || item.path) &&
    currentTab === sub.tab &&
    currentSubTab === nested.subTab;
```

Para o Esporotricose, `nestedBasePath = "/ccz"`, `nestedQueryTab = "ESPOROTRICOSE"` e `nestedQuerySubTab = null`. A cláusula `(!nestedQuerySubTab || ...)` curto-circuita para `true`, então o destaque depende apenas de `pathname === "/ccz"` e `currentTab === "ESPOROTRICOSE"`. `currentTab`/`currentSubTab` em `MenuRender` vêm de `searchParams.get("tab") || "DASHBOARD"` e `searchParams.get("subTab") || ""`, simétricos aos defaults do parse — logo a comparação de `tab` é consistente.

O destaque agora holds nos três estados em que a aba ESPOROTRICOSE aparece na URL:

- Entrada pelo menu — `router.push("/ccz?tab=ESPOROTRICOSE")`, `currentSubTab === ""`, cláusula de subTab ignorada → ativo.
- Aba Lista clicada na página — `irPara("ESPOROTRICOSE", "LISTA")` gera `subTab=LISTA`, `currentSubTab === "LISTA"`, cláusula ignorada → ativo.
- Editar um caso — `editarEsporo` chama `irPara("ESPOROTRICOSE", "CADASTRAR")` → `/ccz?tab=ESPOROTRICOSE&subTab=CADASTRAR`, `currentSubTab === "CADASTRAR"`, cláusula ignorada → ativo.

Isso reproduz o comportamento do leaf anterior (`pathname === item.path && currentTab === sub.tab`, sem comparar `subTab`) mantendo a comparação exata de `tab` que fechou o ponto frouxo da v1 — se o usuário estiver em outra aba do CCZ (`tab=ANIMAIS` etc.), `currentTab !== "ESPOROTRICOSE"` e o item não destaca. O mesmo padrão `(!...SubTab || ...)` já é usado pelo `isSubActive` dos sub-itens com `path`, então a lógica fica coerente entre os dois ramos.

## Posição do link vs. destino (page.js intacta)

O leaf removido era `{ name: "Esporotricose", tab: "ESPOROTRICOSE", visivelSe: "CCZ" }`, que gerava `/ccz?tab=ESPOROTRICOSE`. O novo nested item tem `path: "/ccz?tab=ESPOROTRICOSE"`, usado direto como `nestedLink`. A URL final é a mesma, então a aba aberta e a lógica de `page.js` não dependem da reorganização do menu. A remoção das referências a ZOONOSES em `page.js` (`tabsComLista`, branch `activeTab === "ZOONOSES"`, `editarZoonose`, imports de `CadastroZoonoses`/`ZoonosesLista`) pertence à tarefa de remoção do formulário de zoonoses e está fora do escopo aqui; como o destino do menu é `tab=ESPOROTRICOSE` (ainda em `tabsComLista` com seu branch de render em `page.js`), nenhum link do menu aponta para a aba ZOONOSES morta. O `sub.tab = "ZOONOSES"` serve só como chave de estado (`openNested["ZOONOSES"]`); `toggleNested` navega por `router.push(primeiro.path)` e nunca monta `tab=ZOONOSES`.

## Visibilidade por perfil preservada

`construirMenu` tem uma camada dedicada a recortar `nestedItems`: nested items com `visivelSe` são filtrados por `subItemVisivel` (fail-closed), e um nested dropdown que fica com zero nestedItems é podado. O item "Esporotricose" leva `visivelSe: "CCZ"`, igual ao leaf anterior, então a regra de permissão é a mesma e é aplicada ao item dentro do submenu. O próprio nested dropdown "Zoonoses" também tem `visivelSe: "CCZ"`.

## Navegação do sub-dropdown

`toggleNested` navega pelo `path` do primeiro nestedItem quando ele existe (`if (primeiro.path) router.push(primeiro.path)`), evitando gerar `tab=ZOONOSES&subTab=undefined` ao abrir o grupo. O clique no próprio link "Esporotricose" usa `<Link href={nestedLink}>` com `nestedLink = nested.path`, independente do toggle. Em `toggleGroup`, abrir o módulo CCZ não dispara navegação porque o primeiro subItem do CCZ é `Procedimentos` (leaf), e fechar o CCZ zera `openNested` dos nested dropdowns por `sub.tab`.

## Estilo, dependências e restrições do processo

Nenhuma lib nova; `Sidebar.module.css` não aparece no diff. As classes `nestedBtn`, `nestedBtnOpen`, `nestedMenuList` e `activeLink` já existiam (usadas por Farmácia Judicial e Serviços da Junta), então o sub-dropdown Zoonoses fica coerente com os demais sem adicionar regras. O diff não altera `prisma/schema.prisma` por conta desta tarefa (a alteração de schema presente — remoção do model `CadastroZoonoses` — é da remoção de zoonoses, fora do escopo) nem toca `.env*`. O reflog não registra `stash`/`checkout`/`reset`/`push` ligados a esta tarefa; as mudanças do Sidebar seguem como working tree não commitada e nenhuma alteração pré-existente foi desfeita.

## Observação sobre lint/build

A instrução pedia para ler os resultados de lint/build registrados no relatório final do coder e não re-executar as suítes. Não há relatório do coder no diretório `.agents/tasks/ccz-zoonoses-submenu/` (apenas os arquivos de review), então não foi possível citar números de lint/build; os checks não foram re-executados, conforme instruído. Isso não é bloqueante para o veredito, já que a mudança é localizada e revisada linha a linha.

</details>

<details>
<summary>Arquivos no escopo desta revisão</summary>

- `src/components/Sidebar.js` — leaf "Esporotricose" convertido no único `nestedItem` do nested dropdown "Zoonoses"; `aria-expanded`/`aria-controls` nos botões de topo e nested; `toggleNested` navega pelo `path` do primeiro nestedItem; `isNestedActive` parseia a query do `path` e compara `subTab` só quando o destino o especifica.
- `src/components/Sidebar.module.css` — sem alterações (classes nested reaproveitadas).

Demais arquivos do `git diff` (page.js, actions.js, EsporotricoseLista.js, FichaEsporotricose.js, schema.prisma, deleções de Zoonoses, etc.) pertencem a tarefas anteriores e estão fora do escopo desta revisão. Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff`.

</details>
