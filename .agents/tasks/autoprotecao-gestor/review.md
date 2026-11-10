# Revisão: autoproteção do Gestor

Veredito: APROVADO. Nenhum bloqueio.

Evidências (diff + report.md; suites não reexecutadas):
- Regras 1-2: `gestorGuard.js` recusa auto-desativar e auto-rebaixar (409), mantém cargo/dados com GESTOR permitido. Recusa de desativar/rebaixar o último GESTOR ativo (length <= 1) vale para qualquer executor.
- Regra 3: `SELECT ... FOR UPDATE` dos gestores ativos via `tx.$queryRaw` antes da decisão, dentro de `prisma.$transaction`. Relatório mostra testes de concorrência (10 rodadas no helper, 8 em HTTP) sempre com 1 gestor restante.
- Regra 4: helper usado em alterar-role, desativar e POST usuarios (upsert que muda role, terceiro caminho). `[cpf]/route.js` só tem GET. alterar-role faz update + deleteMany + createMany numa única transação. reativar intocado.
- Regra 5: `novoRole` validado contra o enum `Role`, 400 pt-BR.
- Regra 6: o guard lança antes de qualquer escrita (rollback); `registrarAuditoria` fica após o sucesso. `GestorGuardError` tratado no catch das 3 rotas.
- Seed: com GESTOR ativo, retorna sem criar/alterar nem imprimir senha. Sem gestor, cria com GESTOR/ativo/primeiroAcesso true/bcrypt, nome padrão "Administrador do Sistema", CPF placeholder mantido. Reativa só se CPF e username coincidem, senão aborta (exit 1). Produção sem variáveis aborta (checagem antes). Cobertura em testes C1-C10.
- `.env.example` comentado. UI: `/api/me` retorna `user.cpf`; Editar/Desativar desabilitados na própria linha; erros seguem para o banner.
- `git status`: schema, migrations, `.env`/`.env.local` intocados; nada staged; sem arquivos tmp. Relatório contém todas as seções pedidas (regras/arquivos, concorrência, seed, mensagens, testes A/B/C, inventário, recuperação, contagens antes/depois, lint/build).
