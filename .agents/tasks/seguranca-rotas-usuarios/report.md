# Segurança das rotas de usuários — relatório

## Arquivos alterados (só estes; nada de git add/commit)
- `src/app/api/gerenciamento/usuarios/listar/route.js`
- `src/app/api/gerenciamento/usuarios/alterar-role/route.js`
- `src/app/api/gerenciamento/usuarios/desativar/route.js`
- `src/app/api/gerenciamento/usuarios/reativar/route.js`
- `src/components/GerenciarUsuarios/GerenciarUsuarios.js` (só `carregarUsuarios`)

As outras mudanças no working tree vêm da varredura anterior e não foram tocadas.

## Guarda aplicada (mesmo padrão de `api/gerenciamento/auditoria` e `api/regulacao/auditoria`)
- `import { requireGestor } from '@/lib/auth';`
- Primeira linha dentro do `try` de cada handler, antes de `request.json()` e de qualquer acesso ao banco:
  - `listar`: `await requireGestor();`
  - `alterar-role`, `desativar`, `reativar`: `const gestor = await requireGestor();`
- No `catch`, antes do log/500: `if ([401, 403].includes(error?.status)) return NextResponse.json({ error: error.message }, { status: error.status });`
  Resultado: 401 "Sessão inválida ou expirada." e 403 "Acesso negado: requer Gestor."
- `registrarAuditoria({ user: gestor, ... })` nas 3 rotas de escrita. O comentário "a rota não tem guarda própria" foi trocado por um que diz que o gestor autenticado é quem fica registrado.
- O `Pool` e o `PrismaClient` criados em cada arquivo foram trocados por `import { prisma } from '@/lib/prisma'`. Os imports de `PrismaClient`, `PrismaPg` e `pg` saíram.
- A lógica de negócio não mudou: `mapearRoleParaAcessos`, `user.update`, `userAcesso.deleteMany/createMany`, `session.deleteMany` ao desativar, as respostas 400/404/500 e as mensagens de sucesso estão iguais. O diff só mexe em imports, guarda, catch, comentário e `user: gestor`.

## Chamadores (front)
Todos estão em `src/components/GerenciarUsuarios/GerenciarUsuarios.js`: `listar` (l.208), `alterar-role` (l.281), `desativar` (l.320), `reativar` (l.351). São `fetch` relativos (same-origin), sem a opção `credentials`. Então o padrão `same-origin` envia o cookie `session_token`, e não há nenhum `credentials: 'omit'`.
- `alterar-role`, `desativar`, `reativar`: quando `!res.ok`, já mostram `data.error` no banner `setMensagem({tipo:'erro'})`. Um 401/403 aparece como mensagem amigável e a tela não quebra. Não precisou mudar.
- `listar`: antes, quando `!res.ok`, falhava em silêncio (lista vazia, sem aviso). Adicionei um `else` que mostra `data.error` ou "Erro ao carregar usuarios." no mesmo banner. É a única mudança no front.

## Testes reais (next start -p 3100 após o build, banco local)
Método igual ao de `.agents/tasks/auditoria-regulacao`. Um script temporário inseriu 3 usuários de teste (`99900000001` GESTOR, `99900000002` REGULACAO_COMUM, `99900000003` alvo REGULACAO_COMUM) e sessões temporárias em `user_sessions`, com tokens aleatórios que nunca foram impressos. Um JWT não foi necessário: as rotas API não passam pelo proxy, e a guarda valida o token pela tabela `user_sessions`. Nenhum segredo, URL ou token foi impresso.

| Rota | sem cookie | token inválido | não-gestor | gestor |
|---|---|---|---|---|
| GET listar | 401 | 401 | 403 | 200 |
| PUT alterar-role | 401 | 401 | 403 | 200 |
| PUT desativar | 401 | 401 | 403 | 200 |
| PUT reativar | 401 | 401 | 403 | 200 |

- Depois de todos os 401/403, o alvo ficou inalterado (role, ativo e cargo iguais).
- `alterar-role` (gestor): o alvo passou a `role=JUNTA_SAUDE` e `user_acessos` ficou `[JUNTA/OPERADOR/AMBULATORIO]`.
- `desativar` (gestor): `ativo=false` e as sessões do alvo caíram para 0.
- `reativar` (gestor): `ativo=true`.
- `audit_logs`: 3 linhas, `EDITAR`, `DESATIVAR` e `REATIVAR`, módulo GERENCIAMENTO, `user_cpf=99900000001`, `user_nome="TESTE GESTOR TMP"`, `entidade_id=99900000003`. Nenhuma linha foi gravada para o não-gestor.

### Contagens do banco
| tabela | antes | depois |
|---|---|---|
| users | 2 | 2 |
| user_sessions | 15 | 15 |
| user_acessos | 1 | 1 |
| audit_logs | 4 | 4 |

Os dados de teste (usuários, sessões, acessos e audit_logs) foram apagados. As sequências autoincrement de `user_acessos` e `audit_logs` avançaram e não foram revertidas. O servidor da 3100 foi parado e os scripts temporários (`tmp-*.mjs`, `tmp-resultado.txt`) foram apagados. Schema, migrations, .env e Docker não foram tocados.

## Inventário rotas × guarda (33 `route.js`)
| Rota | Métodos | Guarda |
|---|---|---|
| admin/acessos | GET | requireGestor |
| admin/metrics | GET | requireAdminDeAlgumModulo |
| auth/trocar-senha | POST | sessão própria (cookie `session_token`) |
| ccz/agenda/criar | POST | requireAcessoModulo |
| ccz/animais | GET | requireAcessoModulo |
| ccz/animais/[id] | GET, DELETE | requireAcessoModulo |
| ccz/dashboard | GET | requireAcessoModulo |
| ccz/denuncias | GET, POST | requireAcessoModulo |
| ccz/denuncias/[id] | GET, PUT, DELETE | requireAcessoModulo |
| ccz/tutores/[cpf] | GET, DELETE | requireAcessoModulo |
| farmacia/medicamentos | GET | requireAcessoModulo |
| gerenciamento/auditoria | GET | requireGestor |
| gerenciamento/auditoria/usuarios | GET | requireGestor |
| gerenciamento/relatorios | GET | requireAdminDeAlgumModulo |
| gerenciamento/usuarios | POST | requireGestor |
| gerenciamento/usuarios/[cpf] | PUT | requireGestor |
| gerenciamento/usuarios/alterar-role | PUT | requireGestor (novo) |
| gerenciamento/usuarios/desativar | PUT | requireGestor (novo) |
| gerenciamento/usuarios/listar | GET | requireGestor (novo) |
| gerenciamento/usuarios/reativar | PUT | requireGestor (novo) |
| junta-reguladora/dashboard | GET | requireAcessoModulo |
| junta-reguladora/servicos | GET | requireAcessoModulo |
| me | GET | sessão própria (cookie `session_token`) |
| pessoas | GET, POST | requireAcessoPessoas |
| pessoas/buscar | GET | requireAcessoPessoas |
| pessoas/[cpf] | GET | requireAcessoPessoas |
| regulacao/auditoria | GET | requireGestor |
| regulacao/dashboard | GET | requireAcessoModulo |
| regulacao/medicos | GET | requireAcessoModulo |
| regulacao/procedimentos | GET | requireAcessoModulo |
| regulacao/tipos-exame | GET | requireAcessoModulo |
| regulacao/ubs | GET | requireAcessoModulo |
| ubs | GET | sessão própria (`carregarContextoAcesso()` → 401; lista só id/nome de UBS para qualquer logado) |

Depois da correção, nenhuma rota fica sem guarda. As 3 com "sessão própria" (`me`, `auth/trocar-senha`, `ubs`) fazem a checagem dentro do handler. Não existe rota API de login: o login não passa por `/api/**` (nenhum `fetch('/api/login'...)` em `src`). Não encontrei outra rota sensível sem guarda.

## Recomendações (não implementadas, porque mudariam regra de negócio)
1. Autoproteção / último GESTOR: hoje não existe proteção. Um gestor pode desativar a si mesmo (`desativar` apaga as próprias sessões, e ele perde o acesso na hora) ou rebaixar o próprio role em `alterar-role`. Também é possível desativar ou rebaixar o último GESTOR ativo e deixar o sistema sem ninguém para administrar usuários. A recomendação é recusar com 400/409 quando `cpf === gestor.cpf` em desativar/alterar-role (para role ≠ GESTOR), e/ou quando a operação deixaria `count(users where role=GESTOR and ativo)` = 0. Precisa da decisão do produto.
2. `alterar-role` não valida `novoRole` contra o enum `Role`. Um valor inválido vira 500 em vez de 400. A rota irmã `usuarios` (POST) já tem `ROLES_VALIDAS`, e vale reutilizar.
3. `alterar-role` faz update, deleteMany e createMany fora de transação. Se falhar no meio, o usuário pode ficar sem acessos. Vale considerar `prisma.$transaction`.

## Verificação executada
- `npm run lint` → 0 erros, 4 warnings, os mesmos preexistentes (CadastroTutor, FichaCompletaAnimal, login/page, RelatorioAcessos).
- `npm run build` → passou, com a mesma lista de rotas (as 4 continuam `ƒ` dinâmicas).
- Teste HTTP real em `next start -p 3100`: os 16 casos acima. O servidor foi parado no final.
