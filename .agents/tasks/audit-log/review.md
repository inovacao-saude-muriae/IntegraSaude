# Log de auditoria e linha do tempo do usuário (Relatórios Gerais)

Adiciona a tabela `audit_logs`, o helper `registrarAuditoria` e chamadas em ~60 pontos de escrita (AUTH, CCZ, Regulação, Farmácia, Junta, Gerenciamento). Também adiciona a aba "Auditoria de usuário", só para GESTOR, que une a auditoria nova ao histórico antigo. Confrontado com o plan.md e com as evidências dos findings das FEAT-001 a 003 e do final-report. Não reexecutei as suítes.

Watch for: (1) rotas `usuarios/alterar-role`, `desativar` e `reativar` continuam sem guarda de autorização. Isso já existia e a auditoria depende da sessão (confirmed, fora do escopo, recomendar `requireGestor`). (2) Boa parte das actions só foi validada por revisão de diff, não ao vivo (confirmed, ver findings da FEAT-002). (3) A aba não foi validada em navegador (confirmed, findings da FEAT-003).

**Verdict**: APPROVED

## High-level view

O helper é best-effort. Tudo fica em try/catch, não relança, não grava sem usuário e sanitiza `detalhes`. Ele filtra chaves sensíveis, aceita só primitivos e limita o tamanho. A falha do helper foi provada ao vivo, com `audit_logs` renomeada e a action ainda retornando success.

As chamadas ficam após o sucesso, fora de catch. As linhas removidas do diff são só `await requireX(...)` trocadas por `const user = await requireX(...)` e `create` trocados por `const x = await ... create` para capturar o id. Não vi mudança de lógica nem de retorno.

A API de auditoria usa `requireGestor` (401/403 verificados ao vivo) e a aba só aparece para GESTOR via `/api/me`. Os demais perfis renderizam `RelatorioPacienteView` como antes. A rota não retorna `senhaHash`, porque as seleções são explícitas, e a auditoria nunca grava senha.

O schema só ganhou `AuditLog`. A migration existe em disco e bate com o model. O histórico legado vem de um CTE parametrizado com `Prisma.sql`, limitado a `ts < corte` (primeiro registro de `audit_logs`), então não duplica. Aparece com os selos "Histórico anterior à auditoria" e "correspondência por nome".

<details>
<summary>Issues (4)</summary>

1. **Rotas de usuário sem guarda (possible → confirmed, pré-existente)** — `alterar-role`, `desativar` e `reativar` não autenticam. A auditoria só grava se houver sessão. Tratar em outra mudança com `requireGestor`.
2. **Cobertura ao vivo parcial (confirmed)** — Esporotricose, dispensação, ajuste de estoque, pedidos de exame e outras só foram validadas por diff. Fazer um teste de fumaça depois do deploy.
3. **Aba sem validação visual (confirmed)** — Conferir no navegador, com um GESTOR e com um admin de módulo.
4. **Cosmético no schema (confirmed)** — Falta linha em branco antes de `model AuditLog`. Pode ser ignorado.

</details>

<details>
<summary>Details</summary>

## Guardas e permissão
`GET /api/gerenciamento/auditoria` e `/usuarios` chamam `requireGestor()` e mapeiam 400/401/403/404 para JSON. A aba é condicionada a `role === "GESTOR"`, então a UI nunca é mais permissiva que a API. O ganho de segurança contra a regra do plan é real: admins de módulo recebem 403 (testado ao vivo).

## Rotas de gerenciamento de usuário sem guarda própria
`alterar-role`, `desativar` e `reativar` não têm guarda (pré-existente, criam PrismaClient próprio). A auditoria deles resolve o usuário pela sessão e não grava se não houver. Isso é coerente com "sem mudança de lógica", mas o risco de segurança continua aberto (confirmed).

## Histórico legado
A junção por CPF vem de sessões, acessos e `regula_pedidos_historico`, sem valores anteriores/novos. A junção por nome cobre 6 colunas e é marcada, porque homônimos podem gerar falso positivo. É uma varredura sem índice, aceitável nas tabelas pequenas. Se `audit_logs` estiver vazia, `corte = now()` e todo o histórico aparece. Quando a auditoria começa, o histórico posterior ao corte some, o que evita duplicação (testado ao vivo).

</details>

<details>
<summary>File map</summary>

Schema e migration: `prisma/schema.prisma`, `migrations/20261107130000_add_audit_log/migration.sql`.
Lib: `src/lib/audit.js`, `src/lib/auditoriaRelatorio.js`.
API: `api/gerenciamento/auditoria/**` (novos) e 11 rotas/actions existentes com chamadas de auditoria.
UI: `AuditoriaUsuario.js` e seu CSS module, `RelatoriosAbas.module.css`, `relatorios/page.js`.
Actions: `ccz`, `regulacao`, `farmacia-judicial`, `junta-reguladora`, `gerenciamento/pessoas`, `actions/auth.js`.

</details>
