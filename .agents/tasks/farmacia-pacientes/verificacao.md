# Verificação — Aba "Pacientes" na Farmácia Judicial

## Comandos executados (resultados para o revisor, sem reexecutar)

- `npm run lint` → **Exit 0. 0 errors, 5 warnings** (os 5 preexistentes:
  CadastroTutor.js, FichaCompletaAnimal.js, login/page.js, HistoricoPedidoModal.js,
  RelatorioAcessos.js). Nenhum warning novo nos arquivos tocados.
- `npm run build` (`next build`, Next 16.3.0 / Turbopack) → **Exit 0. Compiled
  successfully.** Todas as rotas geradas, incluindo `/camara-tecnica/farmacia-judicial`.

## Verificação visual no navegador

Não foi possível neste ambiente (sem credenciais de login e servidor de longa
duração bloqueado). Validação feita server-side via build + inspeção das 3
camadas de permissão (abaixo).

## Como a Farmácia monta subTabs

`src/app/camara-tecnica/farmacia-judicial/page.js` (client) deriva
`activeTab = requestedSubTab || "PACIENTES"` quando `tab === "FARMACIA_JUDICIAL"`
e faz um switch por `activeTab` (`DASHBOARD`, `PACIENTES`=PacientesJudiciais,
`MEDICAMENTOS`, `DISPENSACAO`, `ESTOQUE`, `RELATORIOS`). A Sidebar envia o item
via `subTab`.

## Escolhas

- **subTab:** `PESSOAS` (distinto de `PACIENTES`, que é PacientesJudiciais /
  "Novo Processo", model `PacienteFarmaciaJudicial`).
- **Rótulo de menu:** `Pacientes`, posicionado logo antes de "Dashboard".
- **Componente/actions reutilizados:** `@/components/CadastroPessoas/CadastroPessoas`
  (mesma tela do Gerenciamento/Regulação), que consome as actions de
  `@/app/gerenciamento/pessoas/actions` — sem CRUD/UI paralela.

## Regra de permissão replicada e camadas

Regra: **GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN** (mesma expressão de
`requireAcessoPessoas` / `regulacao/layout.js`). NÃO inclui FARMACIA — as actions
de pessoa exigem `requireAcessoPessoas`, então gatear por FARMACIA afrouxaria a
visibilidade sem destravar as actions.

1. **Menu:** item `Pacientes` com `visivelSe: "PESSOAS_ACESSO"`; `construirMenu`
   agora recorta nestedItems COM `visivelSe` (os sem `visivelSe` herdam o pai).
   O case `PESSOAS_ACESSO` já é `ehGestor || ehAdminMod("REGULACAO") || ehAdminMod("JUNTA")`.
2. **Conteúdo do subTab:** `PacientesTab.js` lê `podeGerenciarPessoas` do novo
   contexto; se falso, `AcessoNegadoModulo`.
3. **Rotas/actions:** intocadas — já exigem `requireAcessoPessoas` (fail-closed).

Flag injetada server-side em `layout.js` via `FarmaciaJudicialPermProvider`
(novo contexto `PermissoesFarmaciaJudicialContext`), fail-closed sem provider.

## Arquivos (2 criados, 3 modificados)

- Criado: `src/app/camara-tecnica/farmacia-judicial/PermissoesFarmaciaJudicialContext.js`
- Criado: `src/app/camara-tecnica/farmacia-judicial/PacientesTab.js`
- Modificado: `src/app/camara-tecnica/farmacia-judicial/layout.js`
- Modificado: `src/app/camara-tecnica/farmacia-judicial/page.js`
- Modificado: `src/components/Sidebar.js`

Nenhum arquivo de schema/migrations/.env/dados tocado.
