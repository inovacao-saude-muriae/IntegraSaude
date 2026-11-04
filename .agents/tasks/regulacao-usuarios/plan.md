# Implementation Plan — "Usuários" dentro do módulo Regulação

Objetivo: adicionar um item/aba **"Usuários"** no módulo de Regulação, no mesmo lugar onde já ficam "Procedimentos", "Médicos" e "Unidade Básica de Saúde", reaproveitando a MESMA tela completa de gerenciamento de usuários do módulo Gerenciamento (listar, cadastrar, editar/alterar perfil, desativar/reativar) e reaproveitando as MESMAS rotas de CRUD. O item no menu se chama apenas "Usuários".

## Contexto verificado (leia antes de editar)

- Tela de usuários do Gerenciamento: `src/app/gerenciamento/usuarios/page.js` — client component `AdminUsuariosPage` (default export, `'use client'`), autossuficiente: não recebe props, busca os próprios dados via `fetch`. Usa `./AdminUsuarios.module.css`, `@/components/ConfirmDialog` (`useConfirm`), `@/lib/telefone` (`mascararTelefone`), `@/hooks/usePagination` (`usePagination`) e `@/components/Pagination`. Colunas da tabela: Nome (+ `@username`), CPF, Perfil/Cargo (`role` + `cargo`), Status (`ativo`), Ações. Formulário de cadastro: CPF (login), Nome Completo, Data de Nascimento, Telefone, Perfil/Role (enum `Role`).
- Rotas de CRUD reaproveitadas (NÃO criar paralelas):
  - `POST /api/gerenciamento/usuarios` — cria usuário; guarda `requireGestor()`, `bcrypt.hash('Integr@123', 10)`, username único (ver `src/app/api/gerenciamento/usuarios/route.js`).
  - `GET /api/gerenciamento/usuarios/[cpf]` — busca por CPF; guarda `requireGestor()` (`src/app/api/gerenciamento/usuarios/[cpf]/route.js`).
  - `GET /api/gerenciamento/usuarios/listar` — lista (`.../listar/route.js`).
  - `PUT /api/gerenciamento/usuarios/alterar-role` — altera role/cargo + reescreve `UserAcesso` (`.../alterar-role/route.js`).
  - `PUT /api/gerenciamento/usuarios/desativar` e `.../reativar`.
  - Também consome `GET /api/pessoas/[cpf]`.
  Como a tela reusa estas mesmas URLs absolutas, o CRUD e suas validações (hash bcrypt, username único, etc.) permanecem idênticos sem nenhuma duplicação.
- Padrão de aba da Regulação (precedente exato — "Procedimentos"): `src/app/regulacao/page.js` é client component; renderiza `{activeTab === "PROCEDIMENTOS" && <ProcedimentosTab />}`. `ProcedimentosTab` (`src/app/regulacao/ProcedimentosTab.js`) é um wrapper fino que importa um componente e o CSS. A aba é acionada via query string `?tab=PROCEDIMENTOS`. "Médicos" e "Unidade Básica de Saúde" NÃO são abas: são links diretos (`path: "/gerenciamento/medicos"` e `/gerenciamento/ubs"`) no menu. Seguiremos o padrão de ABA (como "Procedimentos"), pois o pedido é "cadastrar usuário direto no módulo da regulação".
- Menu/sidebar: `src/components/Sidebar.js`, array `menuSections`, bloco do dropdown "Regulação" (`moduloRequerido: "REGULACAO"`), lista `subItems`. Itens de aba usam `{ name, tab, visivelSe }`; a visibilidade é decidida por `subItemVisivel` via `visivelSe` (fail-closed). Já existe o caso `"GESTOR": return ehGestor;`.
- Regra de permissão (EXATA): **somente GESTOR** (`role === "GESTOR"`). Enforcada no Gerenciamento em:
  - Menu: sidebar item "Gerenciar Usuários" usa `visivelSe: "GESTOR"`.
  - Conteúdo: `src/app/gerenciamento/usuarios/layout.js` → `usuarioEhGestor(ctx.user)` → senão `<AcessoNegadoModulo/>`.
  - Rotas/actions: `requireGestor()` nas rotas críticas (POST create, GET [cpf]).
- Enforcement do conteúdo na Regulação: `src/app/regulacao/layout.js` só exige acesso ao módulo REGULACAO (qualquer vínculo), e injeta flags via `RegulacaoPermProvider` (`src/app/regulacao/PermissoesRegulacaoContext.js`). A página lê flags com `usePermissoesRegulacao()`. Para replicar "somente GESTOR" no nível do conteúdo, vamos propagar uma flag `podeGerenciarUsuarios` calculada no servidor com `usuarioEhGestor` e usá-la para gate da aba.
- Build/lint: `npm run build` e `npm run lint` (sem runner de testes unitários no projeto; `npm test` não existe). Windows/PowerShell: usar `;` entre comandos.

## Decisão de abordagem

Reaproveitar o componente da tela de usuários em AMBOS os módulos SEM duplicar a UI. O componente atual (`AdminUsuariosPage`) é autossuficiente e não depende de nada específico de `/gerenciamento` (só chama URLs absolutas de API). Portanto, extrair a UI para um componente compartilhado em `src/components/` e consumi-lo tanto no Gerenciamento quanto na Regulação. Isso mantém uma única fonte de UI (editar num lugar reflete nos dois) e não cria CRUD paralelo. A rota/arquivo de API não muda. É o mesmo espírito do `ProcedimentosTab` (wrapper fino sobre um componente).

Permissão replicada idêntica (GESTOR) em três camadas: menu (`visivelSe: "GESTOR"`), conteúdo (flag `podeGerenciarUsuarios` do servidor via provider + bloqueio com `AcessoNegadoModulo`) e rotas (inalteradas — já exigem `requireGestor()`; não quebrar nada).

---

- [ ] 1. Extrair a UI de usuários para um componente compartilhado, preservando a tela do Gerenciamento.
      Criar `src/components/GerenciarUsuarios/GerenciarUsuarios.js` movendo o corpo atual de `src/app/gerenciamento/usuarios/page.js` (todo o componente `AdminUsuariosPage`), renomeando o export para `export default function GerenciarUsuarios()`. Mover também o CSS `src/app/gerenciamento/usuarios/AdminUsuarios.module.css` para `src/components/GerenciarUsuarios/GerenciarUsuarios.module.css` e atualizar o import do CSS no componente para o novo caminho relativo (`./GerenciarUsuarios.module.css`). Manter os imports `@/components/ConfirmDialog`, `@/lib/telefone`, `@/hooks/usePagination`, `@/components/Pagination` (são caminhos absolutos `@/...`, continuam válidos). Em seguida, reescrever `src/app/gerenciamento/usuarios/page.js` para apenas: `'use client'; import GerenciarUsuarios from '@/components/GerenciarUsuarios/GerenciarUsuarios'; export default function AdminUsuariosPage(){ return <GerenciarUsuarios />; }`. NÃO alterar `src/app/gerenciamento/usuarios/layout.js` (continua exigindo GESTOR).
      Files: criar `src/components/GerenciarUsuarios/GerenciarUsuarios.js`, criar `src/components/GerenciarUsuarios/GerenciarUsuarios.module.css`, modificar `src/app/gerenciamento/usuarios/page.js`, deletar `src/app/gerenciamento/usuarios/AdminUsuarios.module.css` (conteúdo migrado).
      Verify: `npm run lint` sem erros nos arquivos tocados; abrir `/gerenciamento/usuarios` como GESTOR e confirmar que a tela continua idêntica (listar/cadastrar/editar). (Confirmação visual via `npm run build` compilando sem erro de import.)

- [ ] 2. Propagar a flag de permissão GESTOR para o conteúdo da Regulação.
      Em `src/app/regulacao/PermissoesRegulacaoContext.js` adicionar a flag `podeGerenciarUsuarios` (default `false`, fail-closed) ao `createContext`, aos props de `RegulacaoPermProvider` e ao `value` do Provider. Em `src/app/regulacao/layout.js`, calcular `const podeGerenciarUsuarios = await usuarioEhGestor(ctx.user);` (import já disponível de `@/lib/permissions`) e passá-la como prop ao `RegulacaoPermProvider`. Não alterar as demais flags.
      Files: `src/app/regulacao/PermissoesRegulacaoContext.js`, `src/app/regulacao/layout.js`.
      Verify: `npm run build` compila; `usePermissoesRegulacao()` passa a expor `podeGerenciarUsuarios`.

- [ ] 3. Criar o wrapper da aba "Usuários" na Regulação (padrão ProcedimentosTab).
      Criar `src/app/regulacao/UsuariosTab.js` como client component fino que importa e renderiza o componente compartilhado: `'use client'; import GerenciarUsuarios from '@/components/GerenciarUsuarios/GerenciarUsuarios'; export default function UsuariosTab(){ return <GerenciarUsuarios />; }`. (Espelha `ProcedimentosTab.js`.)
      Files: `src/app/regulacao/UsuariosTab.js`.
      Verify: `npm run lint`/`npm run build` compilam o novo arquivo.

- [ ] 4. Renderizar a aba "USUARIOS" na página da Regulação, com gate GESTOR no conteúdo.
      Em `src/app/regulacao/page.js`: importar `UsuariosTab` (`import UsuariosTab from "./UsuariosTab";`) e `AcessoNegadoModulo` (`import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";`) e `usePermissoesRegulacao` (`import { usePermissoesRegulacao } from "./PermissoesRegulacaoContext";`). Dentro de `RegulacaoPageContent`, ler `const { podeGerenciarUsuarios } = usePermissoesRegulacao();`. Adicionar, junto aos outros blocos `activeTab === ...`, o bloco: `{activeTab === "USUARIOS" && (podeGerenciarUsuarios ? <UsuariosTab /> : <AcessoNegadoModulo modulo="Gerenciar Usuários" />)}`. Isso replica no conteúdo a mesma regra GESTOR do `layout.js` do Gerenciamento (fail-closed: operador de regulação que forçar `?tab=USUARIOS` vê "Acesso Negado").
      Files: `src/app/regulacao/page.js`.
      Verify: `npm run build` compila. Manual: como GESTOR, `/regulacao?tab=USUARIOS` mostra a tela de usuários; como operador REGULACAO (não-gestor), a mesma URL mostra `AcessoNegadoModulo`.

- [ ] 5. Adicionar o item "Usuários" no menu da Regulação, visível só para GESTOR.
      Em `src/components/Sidebar.js`, no dropdown "Regulação" (o objeto com `moduloRequerido: "REGULACAO"`), acrescentar ao array `subItems`, logo após o item `{ name: "Procedimentos", tab: "PROCEDIMENTOS", visivelSe: "REGULACAO" }` (e antes de "Médicos"), o novo item: `{ name: "Usuários", tab: "USUARIOS", visivelSe: "GESTOR" }`. Usar `tab` (não `path`) para acionar `/regulacao?tab=USUARIOS` pelo mesmo mecanismo de navegação das abas. O `visivelSe: "GESTOR"` já é tratado por `subItemVisivel` (case existente → `ehGestor`), então o item só aparece para GESTOR. O nome exibido é exatamente "Usuários". Não mexer no ícone (o helper `subIcon` já cobre "usuário/usuario").
      Files: `src/components/Sidebar.js`.
      Verify: `npm run build` compila. Manual: logado como GESTOR, o dropdown "Regulação" mostra "Usuários"; como operador de regulação (não-gestor), o item NÃO aparece.

- [ ] 6. Verificação final de regressão.
      Rodar o build e o lint completos. Conferir que `/gerenciamento/usuarios` continua funcionando (não quebrar a tela original) e que a nova aba da Regulação funciona com a MESMA tela.
      Files: nenhum (apenas verificação).
      Verify: na raiz do projeto, `npm run lint ; npm run build` — ambos concluem sem erros. Manual (GESTOR): cadastrar um usuário a partir de `/regulacao?tab=USUARIOS` e confirmar que ele aparece em `/gerenciamento/usuarios` (prova de que o CRUD é o mesmo).

---

## Digest

Comandos do projeto (descobertos em `package.json`): build `npm run build` (`next build`), lint `npm run lint` (`eslint`). NÃO há runner de testes unitários (`npm test` não existe; só `test:ccz` custom). Nenhum teste cobre estes módulos hoje — verificação é build + lint + checagem manual. Windows/PowerShell: encadear com `;`.

Arquivos tocados:

- `src/components/GerenciarUsuarios/GerenciarUsuarios.js` (NOVO) — recebe o corpo integral do atual `AdminUsuariosPage`; `export default function GerenciarUsuarios()`; `'use client'`. Imports: `./GerenciarUsuarios.module.css`, `@/components/ConfirmDialog` (`useConfirm`), `@/lib/telefone` (`mascararTelefone`), `@/hooks/usePagination` (`usePagination`), `@/components/Pagination`, `react` (`useState`, `useEffect`). Cobertura de teste: nenhuma automatizada; verificação por build + checagem manual da tela. Verificado hoje: a tela é autossuficiente e só usa URLs absolutas de API.
- `src/components/GerenciarUsuarios/GerenciarUsuarios.module.css` (NOVO) — conteúdo migrado de `AdminUsuarios.module.css` sem alteração de classes (CSS Modules, variáveis de cor preservadas).
- `src/app/gerenciamento/usuarios/page.js` (MODIFICAR) — passa a ser um wrapper de 3 linhas que renderiza `<GerenciarUsuarios />`. Assinatura mantida: `export default function AdminUsuariosPage()`. Cobertura: build + manual em `/gerenciamento/usuarios`.
- `src/app/gerenciamento/usuarios/AdminUsuarios.module.css` (DELETAR) — migrado no item 1.
- `src/app/gerenciamento/usuarios/layout.js` (NÃO ALTERAR) — guarda GESTOR via `usuarioEhGestor` permanece.
- `src/app/regulacao/PermissoesRegulacaoContext.js` (MODIFICAR) — adicionar `podeGerenciarUsuarios` ao `createContext` default (`false`), aos props de `RegulacaoPermProvider` e ao `value`. Bloco: `const PermissoesRegulacaoContext = createContext({...})` e `export function RegulacaoPermProvider({...})`.
- `src/app/regulacao/layout.js` (MODIFICAR) — após `adminOuGestor`, adicionar `const podeGerenciarUsuarios = await usuarioEhGestor(ctx.user);` e passar como prop ao `RegulacaoPermProvider`. Bloco: `export default async function RegulacaoLayout({ children })`. Import `usuarioEhGestor` já presente.
- `src/app/regulacao/UsuariosTab.js` (NOVO) — wrapper fino `export default function UsuariosTab()` renderizando `<GerenciarUsuarios />`. Espelha `src/app/regulacao/ProcedimentosTab.js`.
- `src/app/regulacao/page.js` (MODIFICAR) — função `RegulacaoPageContent`: novos imports (`UsuariosTab`, `AcessoNegadoModulo`, `usePermissoesRegulacao`), leitura de `podeGerenciarUsuarios`, e novo bloco `{activeTab === "USUARIOS" && (podeGerenciarUsuarios ? <UsuariosTab /> : <AcessoNegadoModulo modulo="Gerenciar Usuários" />)}` próximo ao bloco `activeTab === "PROCEDIMENTOS"`.
- `src/components/Sidebar.js` (MODIFICAR) — array `menuSections`, dropdown "Regulação" (`moduloRequerido: "REGULACAO"`), `subItems`: inserir `{ name: "Usuários", tab: "USUARIOS", visivelSe: "GESTOR" }` após o item "Procedimentos". A função `subItemVisivel` já trata `case "GESTOR": return ehGestor;`.

Rotas de CRUD REUTILIZADAS sem alteração (prova de "não criar CRUD paralelo"): `src/app/api/gerenciamento/usuarios/route.js` (POST, `requireGestor` + bcrypt + username único), `src/app/api/gerenciamento/usuarios/[cpf]/route.js` (GET, `requireGestor`), `.../usuarios/listar/route.js`, `.../usuarios/alterar-role/route.js`, `.../usuarios/desativar/route.js`, `.../usuarios/reativar/route.js`. A tela compartilhada chama as mesmas URLs absolutas, então create/edit continuam exigindo GESTOR e mantêm validações (hash bcrypt, username único). NÃO tocar `prisma/schema.prisma`, migrations, `.env*`, nem dados.

Regra de permissão replicada (EXATA): **somente GESTOR** — no menu (`visivelSe: "GESTOR"`), no conteúdo da Regulação (flag `podeGerenciarUsuarios = usuarioEhGestor()` via `RegulacaoPermProvider` + `AcessoNegadoModulo` quando não-gestor) e nas rotas (inalteradas, já `requireGestor()`), igual ao que o Gerenciamento já faz em `src/app/gerenciamento/usuarios/layout.js`.

Verificado hoje (sem executar; leitura de código): `page.js` do Gerenciamento é autossuficiente; `ProcedimentosTab` é o precedente de aba; sidebar decide visibilidade por `visivelSe` com `case "GESTOR"` existente; `requireGestor` definido em `src/lib/auth.js`; `usuarioEhGestor` em `src/lib/permissions.js`. Build/lint não foram executados nesta fase de planejamento.
