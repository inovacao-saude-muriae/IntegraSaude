# Review: seguranca-rotas-usuarios

Veredito: APPROVED (sem bloqueadores).

Evidência verificada no diff e no report.md (suites não reexecutadas):
- As 4 rotas (listar, alterar-role, desativar, reativar) chamam `await requireGestor()` como primeira instrução do `try`, antes de `request.json()` e de qualquer acesso ao banco. Padrão igual a `gerenciamento/auditoria`.
- O `catch` converte `error.status` 401/403 em resposta JSON com o mesmo status. `requireGestor` em `src/lib/auth.js` lança 401 e 403 com `status`.
- `registrarAuditoria({ user: gestor, ... })` em alterar-role, desativar e reativar. `audit.js` aceita `user.cpf` e `user.nome`. Comentário atualizado.
- `Pool`, `PrismaClient` e `PrismaPg` próprios removidos. Passam a usar o singleton `@/lib/prisma`, que existe.
- Lógica de negócio intacta: o diff só mexe em imports, guarda, catch, comentário e `user`. Nenhuma regra de autoproteção foi adicionada; ela aparece só como recomendação no report.
- Front: a única mudança é um `else` em `carregarUsuarios` que mostra o erro (401/403) no banner. Os fetches são same-origin e enviam o cookie. As 3 chamadas de escrita já exibiam `data.error`.
- Nenhuma alteração em schema, migrations, .env ou Docker nos arquivos da tarefa. Os arquivos do diff são só os 4 routes e o componente.
- O report registra os 16 casos HTTP (sem cookie, token inválido, não-gestor e gestor, para 4 rotas) com 401/401/403/200. Registra também alvo inalterado após negações, efeitos do gestor, 3 linhas de auditoria com o gestor como autor, nenhuma linha para o não-gestor, contagens do banco antes e depois iguais, lint (0 erros) e build ok.
- O inventário de rotas × guarda cobre as 33 rotas. As 3 com "sessão própria" estão justificadas.

Observação não bloqueante: as recomendações (autoproteção, validação de `novoRole`, transação) estão corretamente fora do escopo.
