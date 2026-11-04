# Implementation Plan — Aba "Pacientes" na Farmácia Judicial

Adicionar um item/aba "Pacientes" ao módulo **Farmácia Judicial** (Câmara Técnica), no mesmo submenu onde fica "Dashboard", renderizando a MESMA tela geral de pessoas já compartilhada (`CadastroPessoas`) usada na Regulação e no Gerenciamento. Reusar o componente e as actions existentes — sem CRUD nem UI paralela.

## Decisões de design (fixadas, não deixar para o implementador)

- **subTab escolhido: `PESSOAS`** / **rótulo de menu: `Pacientes`**. Distinto do subTab `PACIENTES`, que já é usado pelo item "Novo Processo" → `PacientesJudiciais.js` (pacientes judiciais, model `PacienteFarmaciaJudicial`). Não confundir os dois.
- **Posição no submenu:** logo antes de "Dashboard" (último item do `nestedItems` da Farmácia Judicial), espelhando o pedido "onde está Dashboard".
- **Regra de permissão (as 3 camadas): GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN** — exatamente `requireAcessoPessoas` (`src/lib/auth.js`), idêntica à aba Pacientes da Regulação. **Não usar a regra do módulo Farmácia (`usuarioTemAcessoModulo(FARMACIA)`)**: as actions de pessoa já exigem `requireAcessoPessoas`, que NÃO inclui FARMACIA. Gatear a aba por FARMACIA deixaria um admin-FARMACIA ver a tela e tomar 403 em toda action — inconsistente e, do outro lado, afrouxaria a visibilidade. A regra server-side a aplicar é a de pessoas, intocada.

Motivo da escolha (vs. alternativas): poderíamos (a) gatear por FARMACIA e afrouxar `requireAcessoPessoas` para incluir FARMACIA/ADMIN — rejeitado, a tarefa proíbe afrouxar; ou (b) gatear a aba exatamente pela regra de pessoas — escolhido, mantém as 3 camadas coerentes e fail-closed sem tocar na guarda das actions.

## Como o acesso funciona hoje (verificado)

- **Menu (apresentação):** `src/components/Sidebar.js` → `construirMenu(me)` recorta `menuSections`. O grupo "Farmácia Judicial" é um `isNestedDropdown` com `visivelSe: "FARMACIA"` e `nestedItems` (Novo Processo/Medicamentos/Estoque/Dispensação/Relatórios/Dashboard). Para nested dropdowns, só o grupo "Serviços" da Junta (`sub.visivelSe === "JUNTA"`) tem os `nestedItems` filtrados individualmente; para os demais (Farmácia) os `nestedItems` herdam a visibilidade do pai (todos mantidos). O switch `subItemVisivel` já tem o case `"PESSOAS_ACESSO"` → `ehGestor || ehAdminMod("REGULACAO") || ehAdminMod("JUNTA")` (criado na aba Pacientes da Regulação). O switch é fail-closed (`default: false`).
- **Conteúdo (gate server-side):** `src/app/camara-tecnica/farmacia-judicial/layout.js` gateia o MÓDULO por `usuarioTemAcessoModulo(FARMACIA)` e envolve `children`. Não existe ainda contexto de permissão da Farmácia (diferente da Regulação, que tem `PermissoesRegulacaoContext` populado por `regulacao/layout.js`).
- **Switch por subTab:** `src/app/camara-tecnica/farmacia-judicial/page.js` (client). Quando `tab === "FARMACIA_JUDICIAL"`, deriva `activeTab = requestedSubTab || "PACIENTES"`; depois renderiza por `activeTab === "DASHBOARD" | "PACIENTES" | "MEDICAMENTOS" | "DISPENSACAO" | "ESTOQUE" | "RELATORIOS"`. Logo, `subTab=PESSOAS` chega como `activeTab === "PESSOAS"`.
- **Rotas/actions de pessoa:** `src/app/gerenciamento/pessoas/actions.js` (+ `src/app/api/pessoas/**`, `src/app/regulacao/actions.js` escritas de Pessoa) já chamam `requireAcessoPessoas()` no início e tratam 401/403 → `{ success:false }`. **Não serão tocadas.**

## Restrições (registrar e respeitar)

- NÃO alterar `prisma/schema.prisma`, migrations, `.env*` nem dados.
- NÃO fazer `git add/commit/push`; NÃO desfazer mudanças não commitadas (SeletorPaciente, remoção do Supabase, lint, aba Pacientes da Regulação, componente `CadastroPessoas`) — nada de `git stash/checkout/reset`.
- Manter CSS Modules; não adicionar libs novas.
- Windows/PowerShell: encadear comandos com `;` (não `&&`). Sem worktree.
- App Router Next 16 / React 19: os padrões usados (layout Server Component que injeta flags via Client Context, page client com switch) já existem na base (Regulação). Nenhuma API nova do Next é necessária. Referência, se preciso: `node_modules/next/dist/docs/01-app`.

---

## Itens

- [ ] 1. Criar o contexto de permissões da Farmácia Judicial (espelhando `PermissoesRegulacaoContext`), expondo a flag `podeGerenciarPessoas` (fail-closed: `false` sem provider).
      Client Component com `createContext`, `FarmaciaJudicialPermProvider({ podeGerenciarPessoas = false, children })` e hook `usePermissoesFarmaciaJudicial()`. Estrutura idêntica a `src/app/regulacao/PermissoesRegulacaoContext.js`, porém só com `podeGerenciarPessoas`.
      Files: `src/app/camara-tecnica/farmacia-judicial/PermissoesFarmaciaJudicialContext.js` (criar)
      Verify: `npm run lint` — sem novos erros no arquivo.

- [ ] 2. No `layout.js` da Farmácia Judicial, após o gate de módulo existente, calcular `podeGerenciarPessoas` com a MESMA expressão de `requireAcessoPessoas` e injetar via o provider do item 1, envolvendo `children`.
      Manter o gate `usuarioTemAcessoModulo(FARMACIA)` intacto (quem não tem FARMACIA continua vendo `AcessoNegadoModulo`). Adicionar imports `usuarioEhGestor`, `usuarioEhAdminModulo` de `@/lib/permissions` e o provider. `podeGerenciarPessoas = (await usuarioEhGestor(ctx.user)) || (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO)) || (await usuarioEhAdminModulo(ctx.user, MODULOS.JUNTA))`. Envolver o retorno: `<FarmaciaJudicialPermProvider podeGerenciarPessoas={podeGerenciarPessoas}>{children}</FarmaciaJudicialPermProvider>`.
      Files: `src/app/camara-tecnica/farmacia-judicial/layout.js` (modificar)
      Verify: `npm run build` — compila sem erro; o módulo continua bloqueado para quem não tem FARMACIA.

- [ ] 3. Criar o wrapper fino `PacientesTab` da Farmácia Judicial (análogo a `src/app/regulacao/PacientesTab.js`), que renderiza `CadastroPessoas` quando `podeGerenciarPessoas` é verdadeiro e `AcessoNegadoModulo` caso contrário.
      Client Component: lê `usePermissoesFarmaciaJudicial()`; se `!podeGerenciarPessoas` retorna `<AcessoNegadoModulo modulo="Cadastro de Pessoas" />`; senão `<CadastroPessoas />`. Isso dá o gate de conteúdo do subTab (a Regulação faz o gate em `page.js` via `podeGerenciarPessoas`; aqui concentramos no wrapper para não espalhar lógica no switch). Imports: `CadastroPessoas` de `@/components/CadastroPessoas/CadastroPessoas`, `AcessoNegadoModulo` de `@/components/AcessoNegadoModulo`, o hook do item 1.
      Files: `src/app/camara-tecnica/farmacia-judicial/PacientesTab.js` (criar)
      Verify: `npm run lint` — sem novos erros.

- [ ] 4. Adicionar o case do novo subTab `PESSOAS` ao switch de `page.js`, renderizando o wrapper do item 3.
      Importar `PacientesTab` de `./PacientesTab` e adicionar, junto aos demais blocos, `{activeTab === "PESSOAS" && <PacientesTab />}`. Não passar props de dados da Farmácia (ele consome as actions de pessoa diretamente via `CadastroPessoas`, como a Regulação). Não alterar a derivação de `activeTab`/`activeSubTab` existente — `subTab=PESSOAS` já resolve para `activeTab === "PESSOAS"`.
      Files: `src/app/camara-tecnica/farmacia-judicial/page.js` (modificar)
      Verify: `npm run build` — compila; navegar a `?tab=FARMACIA_JUDICIAL&subTab=PESSOAS` renderiza `CadastroPessoas` (ou Acesso Negado conforme perfil).

- [ ] 5. Inserir o item de menu "Pacientes" (subTab `PESSOAS`) nos `nestedItems` da Farmácia Judicial no Sidebar, posicionado imediatamente antes de "Dashboard", e marcá-lo com `visivelSe: "PESSOAS_ACESSO"`.
      No array `menuSections`, grupo "Câmara Técnica" → sub "Farmácia Judicial" → `nestedItems`, adicionar `{ name: "Pacientes", subTab: "PESSOAS", visivelSe: "PESSOAS_ACESSO" }` antes de `{ name: "Dashboard", subTab: "DASHBOARD" }`. (O `subIcon` já cobre "paciente".)
      Files: `src/components/Sidebar.js` (modificar)
      Verify: `npm run build` — compila. Visibilidade validada pelo item 6.

- [ ] 6. Fazer o `construirMenu` filtrar os `nestedItems` da Farmácia Judicial por `visivelSe` (hoje só os da Junta são filtrados), para que "Pacientes" apareça apenas para GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN, e os demais nestedItems da Farmácia (sem `visivelSe`) continuem visíveis para quem tem FARMACIA.
      Em `src/components/Sidebar.js`, na Camada 2 do `construirMenu`, o bloco atual pula o filtro quando `sub.visivelSe !== "JUNTA"` e mantém todos os nestedItems. Ajustar para: nos nested dropdowns, filtrar `nestedItems` mantendo os que NÃO têm `visivelSe` (herdam o pai) e aplicando `subItemVisivel` apenas aos que têm `visivelSe` definido. Assim "Pacientes" (com `PESSOAS_ACESSO`) é recortado pela regra de pessoas, e Novo Processo/Medicamentos/etc. (sem `visivelSe`) permanecem para todo FARMACIA. Manter a Camada 3.1 (nested dropdown que zera nestedItems é podado) — não aplicável aqui porque os itens sem `visivelSe` sempre ficam.
      Files: `src/components/Sidebar.js` (modificar)
      Verify: `npm run build` + `npm run lint`. Conferência de lógica: usuário só-FARMACIA (não gestor, não admin REGULACAO/JUNTA) NÃO vê "Pacientes" mas vê os demais itens da Farmácia; GESTOR/admin-REGULACAO/admin-JUNTA vê "Pacientes".

- [ ] 7. Verificação final consolidada.
      Rodar o build e o lint do projeto e confirmar que o diff toca somente os 5 arquivos previstos (2 criados, 3 modificados) e nenhum arquivo de schema/migrations/.env/dados.
      Files: (nenhum — verificação)
      Verify: `npm run build` ; `npm run lint` — ambos sem erros novos.

---

## Digest

Comandos do projeto (de `package.json`): build = `npm run build` (`next build`); lint = `npm run lint` (`eslint`). Não há framework de testes unitários; a verificação é build + lint. Hoje o build passa (base verde declarada pela tarefa).

### `src/app/camara-tecnica/farmacia-judicial/PermissoesFarmaciaJudicialContext.js` (criar)
Novo Client Component, modelado 1:1 em `src/app/regulacao/PermissoesRegulacaoContext.js`:
- `createContext({ podeGerenciarPessoas: false })`
- `export function FarmaciaJudicialPermProvider({ podeGerenciarPessoas = false, children })`
- `export function usePermissoesFarmaciaJudicial()` → `useContext(...)`
Teste que cobre: build (compilação do provider/hook) + lint. Nada mais.

### `src/app/camara-tecnica/farmacia-judicial/layout.js` (modificar)
Bloco atual (Server Component):
```
const permitido = ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.FARMACIA));
if (!permitido) return <AcessoNegadoModulo modulo="Farmácia Judicial" />;
return children;
```
Alterar: manter o gate; depois dele calcular `podeGerenciarPessoas` (GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN — mesma expressão de `requireAcessoPessoas` em `src/lib/auth.js` e de `regulacao/layout.js`) e `return <FarmaciaJudicialPermProvider podeGerenciarPessoas={...}>{children}</...>`. Novos imports: `usuarioEhGestor`, `usuarioEhAdminModulo` (já há `MODULOS`, `carregarContextoAcesso`, `usuarioTemAcessoModulo`) e o provider do novo contexto.
Teste que cobre: `npm run build` (layout é async Server Component; falha de import/sintaxe quebra o build).

### `src/app/camara-tecnica/farmacia-judicial/PacientesTab.js` (criar)
Novo Client Component, análogo a `src/app/regulacao/PacientesTab.js` (hoje: `"use client"` + `return <CadastroPessoas />`), acrescido do gate de conteúdo:
```
const { podeGerenciarPessoas } = usePermissoesFarmaciaJudicial();
if (!podeGerenciarPessoas) return <AcessoNegadoModulo modulo="Cadastro de Pessoas" />;
return <CadastroPessoas />;
```
`CadastroPessoas` (`src/components/CadastroPessoas/CadastroPessoas.js`) já consome `listarPessoas/listarUbs/criarPessoa/atualizarPessoa/excluirPessoa` de `@/app/gerenciamento/pessoas/actions` — as MESMAS props/actions do uso em `PacientesTab.js` da Regulação e no wrapper do Gerenciamento (ambos renderizam `<CadastroPessoas />` sem props).
Teste que cobre: build + lint.

### `src/app/camara-tecnica/farmacia-judicial/page.js` (modificar)
Switch atual por `activeTab` tem os casos `DASHBOARD`, `PACIENTES` (PacientesJudiciais), `MEDICAMENTOS`, `DISPENSACAO`, `ESTOQUE` (+ `activeSubTab`), `RELATORIOS`. A derivação `activeTab = isSidebarModuleLink ? (requestedSubTab || "PACIENTES") : requestedTab` já mapeia `subTab=PESSOAS` → `activeTab === "PESSOAS"`. Adicionar `import PacientesTab from "./PacientesTab";` e o bloco `{activeTab === "PESSOAS" && <PacientesTab />}`. Sem outras mudanças (não mexer na lógica de `activeTab`/`activeSubTab`).
Teste que cobre: build; validação funcional pela rota `?tab=FARMACIA_JUDICIAL&subTab=PESSOAS`.

### `src/components/Sidebar.js` (modificar) — duas edições
1. **Dados do menu:** em `menuSections`, grupo "Câmara Técnica" → "Farmácia Judicial" (`isNestedDropdown`, `visivelSe: "FARMACIA"`) → `nestedItems`, inserir `{ name: "Pacientes", subTab: "PESSOAS", visivelSe: "PESSOAS_ACESSO" }` imediatamente antes de `{ name: "Dashboard", subTab: "DASHBOARD" }`.
2. **Filtro `construirMenu` (Camada 2):** hoje `if (sub.visivelSe !== "JUNTA") return sub;` mantém todos os nestedItems da Farmácia sem filtrar. Trocar por um filtro que, para qualquer nested dropdown, preserve os nestedItems SEM `visivelSe` (herança do pai) e aplique `subItemVisivel(n)` aos que TÊM `visivelSe`. O case `"PESSOAS_ACESSO"` já existe em `subItemVisivel` (`ehGestor || ehAdminMod("REGULACAO") || ehAdminMod("JUNTA")`) e o switch é fail-closed. Com isso "Pacientes" é recortado pela regra de pessoas; Novo Processo/Medicamentos/Estoque/Dispensação/Relatórios/Dashboard (sem `visivelSe`) seguem visíveis para todo FARMACIA; e o grupo "Serviços" da Junta continua recortado por `JUNTA_SUBSERVICO` (seus nestedItems têm `visivelSe`).
Teste que cobre: build + lint; conferência de visibilidade por perfil descrita no item 6.

### Não tocar (já protegido / fora de escopo)
`src/app/gerenciamento/pessoas/actions.js`, `src/app/api/pessoas/**`, `src/app/regulacao/actions.js` (escritas de Pessoa) — todos já exigem `requireAcessoPessoas()` e tratam 401/403. Essa é a barreira real de segurança (server-side, fail-closed); os gates de menu e de conteúdo do subTab são defesa de UX e apenas espelham a mesma regra. Nenhuma guarda é afrouxada.

### Arquivos a alterar/criar (resumo)
- Criar: `src/app/camara-tecnica/farmacia-judicial/PermissoesFarmaciaJudicialContext.js`
- Criar: `src/app/camara-tecnica/farmacia-judicial/PacientesTab.js`
- Modificar: `src/app/camara-tecnica/farmacia-judicial/layout.js`
- Modificar: `src/app/camara-tecnica/farmacia-judicial/page.js`
- Modificar: `src/components/Sidebar.js`
