# Review: farmacia-menu-fix (commit 9db8c7c)

Verdict: APPROVED (sem blockers).

## Evidência
- Diff: uma linha em `src/components/Sidebar.js`. O `path` do submenu "Farmácia Judicial" deixou de levar `?tab=FARMACIA_JUDICIAL&subTab=DASHBOARD`. Schema Prisma e migrations não foram tocados (`git status` limpo nesses caminhos). O commit contém só o Sidebar.
- Causa raiz confirmada no código. Em `Sidebar.js` ~763-767, quando `basePath` contém `?`, o link vira `${basePath}&subTab=${nested.subTab}`. Com o path antigo isso gerava `...&subTab=DASHBOARD&subTab=X`. `searchParams.get("subTab")` devolve o primeiro valor, então sempre DASHBOARD.
- Com o path sem query, o link vira `/camara-tecnica/farmacia-judicial?tab=FARMACIA_JUDICIAL&subTab=X`. `page.js` (`isSidebarModuleLink`) usa `subTab` como `activeTab`. Os blocos PACIENTES, MEDICAMENTOS, ESTOQUE (com `activeSubTab` SALDO), DISPENSACAO, RELATORIOS e DASHBOARD existem. Os 6 itens resolvem para a tela certa.
- `toggleNested` (~596-611) cai no ramo "monta URL com o primeiro nestedItem", ou seja, PACIENTES. Isso é a mudança de comportamento que o coder declarou: expandir o grupo agora abre Novo Processo, antes abria Dashboard. É consequência direta da correção e foi comunicada.
- `isNestedActive` compara `pathname === sub.path`, que agora é o path puro, então o destaque do item ativo funciona.
- O gate de `layout.js` é server-side, por módulo FARMACIA, e não depende do query string.

## Verificação
- `npm run build` não foi executado com sucesso. Confirmei que `node_modules/recharts` não existe e que o `package.json` o declara. É um problema de ambiente preexistente e não tem relação com esta mudança. O coder relatou isso e não mascarou.
- Não houve teste autenticado nem clique no app. O coder disse isso explicitamente. A checagem das 6 rotas foi por simulação e por leitura do código, e revisei o mesmo caminho por leitura.
- Pendente para o usuário: `npm install`, depois `npm run build` e um teste no navegador com GESTOR ou FARMACIA_ADMIN.
