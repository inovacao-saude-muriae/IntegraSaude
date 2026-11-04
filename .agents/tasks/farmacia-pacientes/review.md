# Aba "Pacientes" na Farmácia Judicial reusando CadastroPessoas

Adiciona o item "Pacientes" ao submenu Farmácia Judicial (Câmara Técnica), ao lado do Dashboard, renderizando a mesma tela geral de pessoas (`CadastroPessoas`) já compartilhada entre Gerenciamento e Regulação, consumindo as mesmas server actions de `gerenciamento/pessoas/actions`. A abordagem evita CRUD/UI paralelos: um novo subTab `PESSOAS` (distinto de `PACIENTES`, que é PacientesJudiciais / Novo Processo), um wrapper fino `PacientesTab` que renderiza `CadastroPessoas`, e um novo contexto de permissão da Farmácia (`FarmaciaJudicialPermProvider`) populado server-side no `layout.js`. O controle de acesso replica literalmente a regra de `requireAcessoPessoas` (GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN) nas três camadas — menu, gate do subTab e actions — sem afrouxar.

Watch for: a mudança está empacotada numa árvore de trabalho que também contém arquivos da tarefa anterior (regulacao-pacientes: `UsuariosTab.js` removido, `Pessoas.module.css` removido, `regulacao/*`, `gerenciamento/pessoas/page.js`), fora de escopo aqui — **possible** ruído de empacotamento, não um defeito desta tarefa.

**Verdict**: APPROVED

## High-level view

A estrutura de subTab foi escolhida com cuidado: `PESSOAS` é um identificador novo que não colide com `PACIENTES` (PacientesJudiciais, model `PacienteFarmaciaJudicial`). A derivação existente em `page.js` (`activeTab = requestedSubTab || "PACIENTES"`) mapeia `subTab=PESSOAS` para o novo bloco sem tocar na lógica de roteamento, e os demais casos (Dashboard/Medicamentos/Estoque/Dispensação/Relatórios/Novo Processo) ficam inalterados.

A regra de permissão é idêntica em todas as camadas: o case `PESSOAS_ACESSO` da Sidebar, a expressão `podeGerenciarPessoas` no `layout.js` e o corpo de `requireAcessoPessoas` em `lib/auth.js` usam a mesma conjunção GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN. Nenhuma inclui FARMACIA, então um admin só-FARMACIA não vê a aba nem passaria pelas actions — fail-closed e consistente com o Gerenciamento/Regulação. A barreira real continua server-side nas actions intocadas; os gates de menu e de conteúdo são espelhos de UX.

O recorte de `nestedItems` em `construirMenu` passou a filtrar por `visivelSe` em qualquer nested dropdown (antes só a Junta era filtrada): itens sem `visivelSe` herdam o pai (Novo Processo/Medicamentos/etc. seguem para todo FARMACIA), itens com `visivelSe` passam por `subItemVisivel`. É a única mudança de comportamento compartilhado e precisa ser conferida contra o grupo Serviços da Junta, que continua recortado por `JUNTA_SUBSERVICO`.

O build e o lint reportados pelo coder (0 erros, 5 warnings preexistentes) são plausíveis: o diff é pequeno, os novos arquivos espelham padrões já existentes e compiláveis, e nenhum import quebrado foi introduzido.

<details>
<summary>Issues (1)</summary>

1. **Mudanças de outra tarefa na mesma árvore** (possible) — `regulacao/*`, `gerenciamento/pessoas/page.js`, remoção de `UsuariosTab.js` e `Pessoas.module.css` aparecem no `git status` mas pertencem à tarefa regulacao-pacientes. Não bloqueia; confirmar no commit que os escopos não sejam misturados indevidamente.

</details>

<details>
<summary>Details</summary>

## subTab PESSOAS distinto de PACIENTES

O menu envia `subTab: "PESSOAS"`; o switch de `page.js` adiciona `{activeTab === "PESSOAS" && <PacientesTab />}` ao lado do já existente `{activeTab === "PACIENTES" && <PacientesJudiciais ... />}` — identificadores diferentes para componentes diferentes (model `Pessoa` vs. model `PacienteFarmaciaJudicial`). A derivação `activeTab = isSidebarModuleLink ? (requestedSubTab || "PACIENTES") : requestedTab` não foi alterada, então `subTab=PESSOAS` resolve para `activeTab === "PESSOAS"` sem efeito nos outros casos.

## Reuso de CadastroPessoas e actions

`PacientesTab` da Farmácia é um wrapper fino que renderiza `<CadastroPessoas />` — o mesmo componente que a Regulação (`regulacao/PacientesTab.js`) e o Gerenciamento usam. `CadastroPessoas.js` importa `listarPessoas/listarUbs/criarPessoa/atualizarPessoa/excluirPessoa` de `@/app/gerenciamento/pessoas/actions`. Não há CRUD nem UI paralelos; nenhuma prop de dados da Farmácia é injetada.

## Permissão replicada nas três camadas

```
requireAcessoPessoas (lib/auth.js):
  ehGestor ∨ adminMod(REGULACAO) ∨ adminMod(JUNTA)

Sidebar  → case "PESSOAS_ACESSO": ehGestor ∨ ehAdminMod("REGULACAO") ∨ ehAdminMod("JUNTA")
layout   → podeGerenciarPessoas = ehGestor ∨ adminMod(REGULACAO) ∨ adminMod(JUNTA)
tab gate → PacientesTab: if (!podeGerenciarPessoas) AcessoNegadoModulo
actions  → requireAcessoPessoas() (intocado, fail-closed 403)
```

As três camadas de UX usam exatamente a mesma conjunção, e nenhuma inclui FARMACIA. A escolha de não gatear por FARMACIA é a correta: as actions de pessoa exigem `requireAcessoPessoas`, que não cobre FARMACIA; gatear a aba por FARMACIA deixaria um admin-FARMACIA ver a tela e tomar 403 em toda ação, além de afrouxar a visibilidade. O novo `FarmaciaJudicialPermProvider` é fail-closed (flag `false` sem provider), espelhando `PermissoesRegulacaoContext`. A flag é calculada no Server Component (`layout.js`) e injetada como boolean serializável — o Client Component não importa a DAL.

## Mudança no recorte de nestedItems do construirMenu

Antes, `construirMenu` só filtrava os `nestedItems` do grupo Serviços da Junta (`if (sub.visivelSe !== "JUNTA") return sub;`); os nestedItems da Farmácia eram mantidos integralmente. A nova versão aplica a qualquer nested dropdown:

```js
const nested = (sub.nestedItems || []).filter(
  (n) => n.visivelSe == null || subItemVisivel(n),
);
```

Itens sem `visivelSe` (Novo Processo, Medicamentos, Estoque, Dispensação, Relatórios, Dashboard) continuam visíveis para todo FARMACIA; "Pacientes" (com `PESSOAS_ACESSO`) é recortado pela regra de pessoas. O grupo Serviços da Junta mantém o comportamento: seus nestedItems têm `visivelSe` (JUNTA_SUBSERVICO), então continuam filtrados por `subItemVisivel`. Essa é a única alteração de lógica compartilhada da mudança; como os itens sem `visivelSe` sempre passam pelo ramo `n.visivelSe == null`, não há regressão na visibilidade dos demais módulos.

## Escopo e restrições

O `git status` mostra que os 5 arquivos previstos foram tocados (2 criados: `PermissoesFarmaciaJudicialContext.js`, `PacientesTab.js`; 3 modificados: `layout.js`, `page.js`, `Sidebar.js`). `prisma/schema.prisma`, migrations, `.env*`, `package.json` e `package-lock.json` não aparecem no status — nenhuma lib nova, nenhum schema tocado. Não houve `git add/commit/push` para esta tarefa (HEAD inalterado). As mudanças de `regulacao/*`, `gerenciamento/pessoas/page.js` e as remoções de `UsuariosTab.js`/`Pessoas.module.css` pertencem à tarefa anterior (regulacao-pacientes) e estão fora do escopo desta revisão.

## Build e lint reportados

O coder reportou `npm run lint` com exit 0 (0 erros, 5 warnings preexistentes nominados) e `npm run build` com exit 0 (Next 16.3.0/Turbopack, rota `/camara-tecnica/farmacia-judicial` gerada). Plausível e suficiente: o diff é pequeno, os dois novos arquivos replicam padrões compiláveis já presentes na base (contexto da Regulação, wrapper da Regulação), e não há imports pendentes nem sintaxe nova. Não reexecutei conforme instruído.

</details>

<details>
<summary>File map</summary>

- `src/app/camara-tecnica/farmacia-judicial/PermissoesFarmaciaJudicialContext.js` (criado) — contexto fail-closed expondo `podeGerenciarPessoas`.
- `src/app/camara-tecnica/farmacia-judicial/PacientesTab.js` (criado) — wrapper fino: gate por `podeGerenciarPessoas` + `CadastroPessoas`.
- `src/app/camara-tecnica/farmacia-judicial/layout.js` (modificado) — calcula `podeGerenciarPessoas` server-side e injeta via provider, mantendo o gate de módulo FARMACIA.
- `src/app/camara-tecnica/farmacia-judicial/page.js` (modificado) — case `activeTab === "PESSOAS"` → `PacientesTab`.
- `src/components/Sidebar.js` (modificado) — item "Pacientes" (subTab PESSOAS, PESSOAS_ACESSO) antes do Dashboard; case `PESSOAS_ACESSO`; filtro de nestedItems por `visivelSe`.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff -- src/app/camara-tecnica/farmacia-judicial src/components/Sidebar.js`

</details>
