# Review — "Usuários" no módulo Regulação

Verdict: **APPROVED**

## Escopo revisado

Alterações da working tree relevantes à tarefa (demais arquivos modificados — ccz, seletor de paciente, docs, docker-compose — são de outras tarefas e fora de escopo):

- `src/components/GerenciarUsuarios/GerenciarUsuarios.js` (novo) — tela completa movida.
- `src/components/GerenciarUsuarios/GerenciarUsuarios.module.css` (novo) — CSS movido.
- `src/app/gerenciamento/usuarios/page.js` (wrapper fino) e `.../AdminUsuarios.module.css` (deletado).
- `src/app/regulacao/UsuariosTab.js` (novo), `src/app/regulacao/page.js`, `src/app/regulacao/layout.js`, `src/app/regulacao/PermissoesRegulacaoContext.js`, `src/components/Sidebar.js`.

## Confirmações

1. **Aba no mesmo padrão e tela completa.** `UsuariosTab.js` espelha `ProcedimentosTab.js` (wrapper fino sobre `GerenciarUsuarios`). Em `regulacao/page.js` é renderizada em `activeTab === "USUARIOS"`, acionada por `?tab=USUARIOS`, junto de `PROCEDIMENTOS`. A tela é a cópia integral da existente: comparação linha-a-linha entre o corpo antigo de `gerenciamento/usuarios/page.js` e o novo componente resulta em 780 vs 780 linhas, com as únicas diferenças reais sendo o nome do export (`AdminUsuariosPage` → `GerenciarUsuarios`) e o caminho do CSS. Não é versão reduzida.

2. **CRUD reutilizado, sem paralelo.** O componente chama exatamente `/api/gerenciamento/usuarios`, `/api/gerenciamento/usuarios/listar`, `/api/gerenciamento/usuarios/[cpf]`, `/alterar-role`, `/desativar`, `/reativar` e `/api/pessoas/[cpf]`. Nenhuma rota de API foi alterada (`git status` em `src/app/api` vazio). Nenhuma biblioteca nova.

3. **Gerenciamento não quebrado.** `gerenciamento/usuarios/page.js` passou a ser wrapper de 3 linhas renderizando `<GerenciarUsuarios />`; `gerenciamento/usuarios/layout.js` permanece exigindo GESTOR. Corpo e CSS migrados sem perda (comparação acima + CSS 4/4 diferenças apenas de encoding em linhas acentuadas).

4. **Controle de acesso — GESTOR replicado EXATAMENTE, não afrouxado** (defesa em profundidade idêntica ao Gerenciamento):
   - Menu: em `Sidebar.js`, item `{ name: "Usuários", tab: "USUARIOS", visivelSe: "GESTOR" }` no dropdown Regulação; `subItemVisivel` resolve `GESTOR → ehGestor` (switch fail-closed). Nome exibido exatamente "Usuários".
   - Conteúdo: `regulacao/layout.js` calcula `const podeGerenciarUsuarios = await usuarioEhGestor(ctx.user);` (server-side) e injeta via `RegulacaoPermProvider` (default `false`, fail-closed). `regulacao/page.js` faz `activeTab === "USUARIOS" && (podeGerenciarUsuarios ? <UsuariosTab/> : <AcessoNegadoModulo modulo="Gerenciar Usuários"/>)`. É a mesma regra de `gerenciamento/usuarios/layout.js` (`usuarioEhGestor` → senão `AcessoNegadoModulo`). Usuário REGULACAO comum que force `?tab=USUARIOS` recebe Acesso Negado.
   - Rotas/actions: inalteradas. `POST /api/gerenciamento/usuarios` e `GET /api/gerenciamento/usuarios/[cpf]` exigem `requireGestor()` server-side; POST mantém `bcrypt.hash('Integr@123', 10)` e validação de role. A criação/leitura de usuário rejeita não-gestor no servidor independentemente da UI.

5. **Sem mudanças em schema/migrations/.env/dados; sem commits.** Arquivos da tarefa não tocam `prisma/schema.prisma`, migrations nem `.env*`. Alterações permanecem uncommitted.

## Observações (não bloqueantes)

- As rotas `/api/gerenciamento/usuarios/listar` e `/alterar-role` não chamam `requireGestor()`. Isso é condição **pré-existente**, idêntica para Gerenciamento e Regulação (as MESMAS rotas são reutilizadas); não foi introduzida nem afrouxada por esta mudança, portanto fora de escopo. O caminho crítico de criação (POST) e a leitura por CPF estão protegidos.
- Não há registro do coder de execução de `npm run lint`/`npm run build`. O projeto não possui runner de testes unitários. Spot-check de resolução de imports confirmou que `AcessoNegadoModulo` (default), `usuarioEhGestor` e `requireGestor` existem e são exportados, e que os caminhos `@/...` do componente são válidos. Nenhuma falha de correção/segurança alcançável foi identificada.
