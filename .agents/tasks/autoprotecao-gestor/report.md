# Autoproteção do Gestor + Gestor inicial (seed) - relatório

Nada foi commitado (git add/commit/push proibidos). Schema, migrations, .env/.env.local e Docker não foram alterados.

## Arquivos
- NOVO `src/lib/gestorGuard.js`: helper `validarAlteracaoGestor(tx, {executorCpf, alvoCpf, novoRole, desativar, alvoObrigatorio})`, `GestorGuardError` (com `status`), `ROLES_VALIDAS` (derivado do enum `Role`) e as mensagens.
- `src/app/api/gerenciamento/usuarios/alterar-role/route.js`: valida `novoRole` (400), guarda + update do usuário + deleteMany/createMany de acessos numa única `prisma.$transaction`.
- `src/app/api/gerenciamento/usuarios/desativar/route.js`: guarda + update `ativo=false` + `session.deleteMany` na mesma transação.
- `src/app/api/gerenciamento/usuarios/route.js` (POST): importa `ROLES_VALIDAS` do helper e chama a guarda dentro da transação existente. Motivo: o `upsert` desta rota altera `role` de um usuário já existente (inclusive o próprio gestor ou o último gestor), então era um terceiro caminho de rebaixamento.
- `src/app/api/gerenciamento/usuarios/[cpf]/route.js` só tem GET (não existe PUT); não altera role/ativo, sem mudança. `reativar` sem regra, como pedido.
- `src/components/GerenciarUsuarios/GerenciarUsuarios.js`: busca `/api/me` e desabilita "Editar" e "Desativar" na linha do próprio usuário (com `title` explicativo). Erros 400/409 já passam por `data.error` no banner (confirmado no código dos três handlers).
- `prisma/seed.js`, `.env.example`, `prisma/README.md` (seção de gestor inicial e recuperação).

## Regras e mensagens
- Desativar a si mesmo: 409 `Você não pode desativar a sua própria conta.`
- Mudar o próprio role para != GESTOR: 409 `Você não pode alterar o seu próprio perfil de acesso.` (alterar cargo/dados mantendo GESTOR continua permitido)
- Desativar/rebaixar o último GESTOR ativo (qualquer executor): 409 `Não é possível: este é o último usuário Gestor ativo. Crie ou promova outro Gestor antes.`
- `novoRole` inválido: 400 `Perfil informado é inválido.` (antes era 500). Alvo inexistente: 404.
- Recusa lança exceção dentro da transação antes de qualquer escrita, então nada é gravado (nem auditoria). Em sucesso, `registrarAuditoria` segue igual.

## Concorrência
Dentro da transação, antes de qualquer decisão, o helper executa `SELECT cpf FROM users WHERE role='GESTOR' AND ativo=true FOR UPDATE`. A 2ª transação concorrente espera o commit da 1ª e, em READ COMMITTED, reavalia a query: o gestor já rebaixado/desativado sai do conjunto, a contagem cai para 1 e a operação é recusada com 409. O alvo é relido depois da trava.

## Seed (prisma/seed.js, execução manual)
CPF mantido: placeholder fixo `00000000000` (o seed antigo já usava isso; `GESTOR_CPF` nunca foi lido). Login honra `primeiroAcesso`: `/api/me` devolve o campo e `src/app/page.js` abre o modal de troca de senha quando é `true`.
- Produção sem `GESTOR_USERNAME`/`GESTOR_SENHA`: aborta (exit 1), como antes. Em dev usa defaults (`admin_integra`/`Admin@123`) e imprime a senha só fora de produção.
- Já existe pelo menos 1 GESTOR ativo: não cria, não altera senha, não sobrescreve nada; só informa a contagem.
- Nenhum GESTOR ativo e sem colisão: cria com `role=GESTOR`, `ativo=true`, `primeiroAcesso=true`, bcrypt, nome padrão "Administrador do Sistema" (se `GESTOR_NOME` ausente).
- Recuperação: se existir exatamente um usuário com o mesmo CPF E o mesmo username das variáveis (inequivocamente o gestor inicial), ele é reativado/promovido com a nova senha e `primeiroAcesso=true`.
- Qualquer outra colisão (mesmo username OU CPF de usuário diferente): aborta (exit 1) com mensagem clara, sem alterar dados, pedindo ação manual. Escolha mais segura.
- `.env.example` e `prisma/README.md` documentam: só cria sem gestor ativo, username escolhido pelo implantador, senha trocada no primeiro acesso.

## Testes
Por segurança, A, B e C rodaram em banco temporário `integrasaude_seedtest` (container `orion_db`, migrations via `prisma migrate deploy`, DATABASE_URL/DIRECT_URL só na sessão do comando). Isso permitiu simular "último gestor" com commit real sem tocar no gestor real. O banco foi apagado ao final.

### A - helper (transações reais no banco temporário, 14/14 OK)
Self desativar 409; self rebaixar 409; self manter GESTOR permitido; 2 gestores desativar outro OK; recusa de desativar e de rebaixar o último gestor por outro executor 409 e estado inalterado; alvo inexistente 404; 2 gestores rebaixar outro OK; falha no meio da troca (role + deleteMany, antes do createMany) => rollback e acessos intactos; CONCORRÊNCIA: 10 rodadas com `Promise.all` de dois gestores rebaixando um ao outro (com atraso de 150 ms dentro da transação): em todas exatamente 1 `ok` e 1 `409`, sobrando 1 gestor ativo; desativação mútua: ok/409, sobra 1.

### B - HTTP real (`next build` + `next start -p 3100`, apontado para o banco temporário, sessões temporárias com tokens aleatórios nunca impressos)
| Caso | Status |
|---|---|
| gestor desativa a si mesmo | 409 (nada gravado) |
| gestor rebaixa o próprio perfil | 409 (nada gravado) |
| POST recriar a si mesmo com outro role | 409 (nada gravado) |
| novoRole inválido / ausente | 400 / 400 (nada gravado) |
| alvo inexistente | 404 (nada gravado) |
| não-gestor | 403 (nada gravado) |
| promover usuário a GESTOR (acessos viram 0) | 200 |
| 2 gestores: rebaixar outro (acessos recriados JUNTA/OPERADOR/AMBULATORIO) | 200 |
| mudar só o próprio cargo mantendo GESTOR | 200 |
| 2 gestores: desativar outro (sessões dele removidas) | 200 |
| reativar | 200 |
| concorrência HTTP, 8 rodadas, dois gestores se rebaixando | 1x 200/403 e 7x 200/409; sempre 1 gestor ativo |

"Nada gravado" = snapshot de users (role/ativo/cargo), user_acessos, audit_logs e user_sessions idêntico antes e depois.
Na 1ª execução `alterar-role` devolveu 500 para o auto-rebaixamento: faltava tratar `GestorGuardError` no catch (o replace do arquivo CRLF não casou). Corrigido, build refeito e o teste repetido com tudo OK. Observação: um servidor antigo na 3100 ficou vivo e mascarou o resultado numa tentativa; todos os processos foram encerrados e a execução válida foi com o servidor novo.

### C - seed (banco temporário vazio, migrations aplicadas)
1. Sem gestor: cria `00000000000 / gestor_teste / Administrador do Sistema / GESTOR / ativo / primeiroAcesso=true`.
2. Rodar de novo: "já existe 1 gestor ativo", linha idêntica (hash e updated_at iguais).
3. Gestor existente + outras variáveis (outro username/senha): nada criado, hash inalterado.
4. NODE_ENV=production sem variáveis: aborta, exit 1, 0 usuários criados.
5. Produção com variáveis e gestor existente: não age e não imprime senha.
6. Gestor inativo, mas username das variáveis diferente (mesmo CPF): aborta exit 1, nada alterado.
7. Recuperação (mesmo CPF e username, inativo): reativado/promovido, senha nova, primeiroAcesso=true.
8. Rebaixado e inativo, mesmo CPF e username: reativado/promovido.
9. Mesmo CPF com username alheio: aborta. 10. Mesmo username com CPF diferente: aborta.

### Contagens do banco real (antes = depois)
| tabela | antes | depois |
|---|---|---|
| users | 2 | 2 |
| user_sessions | 15 | 15 |
| user_acessos | 1 | 1 |
| audit_logs | 4 | 4 |
Gestores ativos reais: 1 antes, 1 depois. O banco real só foi lido (contagens). Servidor 3100 parado, banco `integrasaude_seedtest` apagado, scripts temporários (`tmp-a.mjs`, `tmp-b.mjs`, `tmp-next.log`) removidos.

### Lint e build
`npm run lint`: 0 erros, 4 warnings preexistentes. `npm run build`: sucesso (rodado após a última edição de código).

## Inventário de outros caminhos que removem/rebaixam gestor (não alterados)
- `prisma/delete-user.js`: `user.delete` com CPF fixo, sem verificação de último gestor.
- `prisma/set-primeiro-acesso.js`: `user.update` com CPF fixo (redefine senha e primeiroAcesso; não muda role/ativo).
- `prisma/fix-primeiro-acesso.js`: `updateMany` só em não-GESTOR (não afeta gestores).
- `prisma/clear-sessions.js`: apaga sessões (desloga todos, não remove o gestor).
- SQL direto/Prisma Studio: sem proteção.
- Nenhuma server action ou rota HTTP além de `alterar-role`, `desativar` e `POST usuarios` escreve role/ativo; `reativar` só liga `ativo`. `app/actions/auth.js` e `trocar-senha` só mexem em `ultimoAcesso`/senha.
- Risco residual: `Role`/`ativo` mudados fora da aplicação (scripts, SQL) não passam pela guarda.

## Recuperação se o último gestor perder a senha
1. O gestor continua ativo, então o seed não age. Ajustar o CPF fixo no topo de `prisma/set-primeiro-acesso.js` e rodar `node prisma/set-primeiro-acesso.js`: redefine a senha para a padrão e força a troca no próximo login.
2. Se o gestor foi desativado/rebaixado/removido fora da aplicação (ex.: `delete-user.js`), rodar `npx prisma db seed` com novas `GESTOR_USERNAME`/`GESTOR_SENHA`: cria o gestor inicial, ou reativa o `00000000000` se o username coincidir. Em colisão com outro usuário, o seed aborta e a correção é manual.
3. Em ambos os casos, trocar a senha no primeiro acesso e remover as variáveis temporárias.

## Observações
- Durante um erro de URL inválida no meu script de apoio, a URL do banco local (com senha de desenvolvimento) apareceu duas vezes na saída do terminal. É o banco local de dev; vale rotacionar a senha se isso for um problema.
- Os arquivos alterados estavam em CRLF no working tree (autocrlf); mantive CRLF, um `str_replace` pode ter deixado trechos LF, sem impacto funcional (git normaliza).
