# Relatório final: log de auditoria + linha do tempo do usuário

Nada foi commitado nem adicionado ao índice (`git add`). O `migration.sql` é ignorado pelo `.gitignore` (`*.sql`) e precisa de `git add -f` no commit.

## Migration
- Arquivo: `prisma/migrations/20261107130000_add_audit_log/migration.sql` (existe; ignorado pelo git).
- Cria `audit_logs` e 3 índices: `idx_audit_user_data`, `idx_audit_modulo_data`, `idx_audit_data`.
- Aplicada com `prisma db execute` + `migrate resolve --applied` (sem `migrate dev/reset`).
- O schema só ganhou o model `AuditLog`. Nenhum outro model, migration ou `.env` foi alterado.

## Design
- Model `AuditLog` (`audit_logs`): `id` Int autoincrement, `userCpf` (sem FK, para que excluir usuário não apague histórico), `userNome` (snapshot), `acao`, `modulo`, `entidade`, `entidadeId`, `descricao`, `detalhes` (Json), `ip`, `createdAt`.
- Helper `src/lib/audit.js`: exporta `registrarAuditoria`, `AUDIT_ACOES` e `AUDIT_MODULOS`.
  - Best-effort: tudo em try/catch, nunca relança e nunca muda o retorno da action.
  - Resolve o usuário pela sessão quando `user` não é passado. Sem usuário, não grava (nunca grava anônimo).
  - Trunca campos e sanitiza `detalhes`: remove chaves como senha, hash, token, secret, foto, base64 e jwt, e limita o tamanho.
  - É chamado só após o sucesso da operação.

## Pontos instrumentados
- AUTH: `loginAction` (LOGIN) e `api/auth/trocar-senha` (alteração de senha).
- CCZ (`ccz/actions.js`): animal, tutor, procedimento, termo de internação, esporotricose (incluindo encerrar, reabrir e incineração), relatório de visita e denúncia. Rotas: `agenda/criar`, `denuncias` (POST, PUT e DELETE), `animais/[id]` DELETE, `tutores/[cpf]` DELETE.
- Regulação: `regulacao/actions.js` (pedidos, pessoas, médicos, UBS, procedimentos, liberação, cotas, planejamento e faturamento) e `procedimentosActions.js`.
- Farmácia judicial: paciente, medicamento, lote, ajuste de estoque e dispensação.
- Junta: `actions.js` (paciente, atendimento e agendamento) e `servicosActions.js`.
- Gerenciamento: `pessoas/actions.js`, `api/pessoas` POST e `api/gerenciamento/usuarios` (POST, alterar-role, desativar e reativar).

## Excluídos, com motivos
- Leituras e listagens: não alteram dados.
- Logout: não existe no servidor (`Header` só faz `router.push`).
- Falha de login: evita ruído e abuso da tabela.
- `actions/users.js`: código morto, sem chamadores.
- `regulacao/actions/auditoria.js` (`regula_pedidos_historico`): rastro antigo próprio. Entra apenas na junção do histórico.
- `api/admin/metrics` e `api/admin/acessos`: somente leitura.
- Achado pré-existente: 5 actions de Regulação não têm guarda de autenticação (`createPedidoExame`, `updateCommunicationDate`, `releasePaciente`, `updatePedidoExame`, `deletePedidoExame`). Não foi adicionada guarda, para não mudar o comportamento. O helper resolve o usuário pela sessão e não grava se não houver.

## Tela
- Gerenciamento > Relatórios Gerais ganhou a aba "Auditoria de usuário", em `components/admin/AuditoriaUsuario.js` com seu CSS module.
- A aba traz busca de usuário (nome, username ou CPF), resumo, filtros de período e módulo, linha do tempo paginada e aviso sobre a data do primeiro registro de auditoria.
- A linha do tempo junta o histórico antigo (sessões, acessos, `regula_pedidos_historico` e colunas de responsável por nome), marcado como "histórico" e "correspondência por nome" quando aplicável.
- API: `GET /api/gerenciamento/auditoria/usuarios` e `GET /api/gerenciamento/auditoria`. A consulta fica em `src/lib/auditoriaRelatorio.js`.

## Permissão
- A API usa `requireGestor()`, igual ao relatório de acessos.
- A aba só é exibida para `role === "GESTOR"`. Admins de módulo continuam vendo o relatório do paciente exatamente como antes.

## Validação (nesta integração)
- `npm run lint`: 0 erros e 5 warnings, os mesmos preexistentes.
- `npm run build`: concluído com sucesso (exit 0), com a rota `/gerenciamento/relatorios` compilada.
- `git status` e `git diff --stat`: só arquivos desta feature (21 modificados e novos de auditoria). Nada em `.env` nem em migrations existentes.
- Sem rota ou arquivo temporário (`_tmp-audit` ausente).
- `audit_logs` está vazia (0 linhas, 0 suspeitas de teste).
- Os testes ao vivo das FEATs 1 a 3 ficaram a cargo de cada FEAT. Esta etapa não os repetiu.

## Lembretes
- Nada foi commitado. No commit, use `git add -f prisma/migrations/20261107130000_add_audit_log/migration.sql`.
- Inclua `.agents/tasks/audit-log/` ou ignore-o, conforme a sua preferência.
