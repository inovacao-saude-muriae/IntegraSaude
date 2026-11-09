# Unificação de pessoas por CPF provisório (EMPI)

A mudança mantém o CPF como chave primária e dá CPF provisório (`T` + 10 dígitos) a quem chega sem documento. Ao informar o CPF oficial de um cadastro provisório, o sistema troca o CPF (se não houver conflito) ou devolve `CPF_DUPLICADO_CONFLITO` e oferece unificar. A unificação roda numa única transação, move os dependentes para o cadastro oficial, inativa a origem sem apagar nada e grava snapshot e auditoria. A migration é aditiva (colunas, sequence, função, tabela).

Watch for: o fluxo de tela e as server actions não foram exercitados em runtime (nenhum login nem navegador); só o núcleo `unificacaoPessoa.js` foi testado, contra o banco (51 PASS). O overlay do modal pode fechar durante a unificação (possible).

**Verdict**: APPROVED

## High-level view

O núcleo transacional fica em `src/lib/unificacaoPessoa.js`, sem dependência de sessão. As server actions só aplicam a guarda `requireAcessoPessoas` e `registrarAuditoria`. A ordem dentro da transação é: trava as linhas, detecta conflito de módulo, tira o snapshot e só então escreve. Por isso um conflito aborta sem alterar nada.

A migration não recria FKs porque todas já eram ON UPDATE CASCADE no catálogo. As novas FKs seguem o brief, e há um CHECK que impede `unificado_em_cpf` com `ativo = true`. O filtro `ativo: true` foi aplicado nas buscas e listagens operacionais. As consultas históricas que partem de dependentes ficaram sem filtro de propósito, porque os dependentes já foram movidos.

O modal tem `role="dialog"`, `aria-modal`, rótulos, Esc e foco devolvido ao campo CPF. Os textos e botões são os pedidos, e o erro `CONFLITO_MODULO` lista os módulos.

<details>
<summary>Issues (3)</summary>

1. **Overlay fecha durante a unificação** (possible) — `onClick={fecharConflito}` no overlay não verifica `unificando`; o comentário diz que não fecha. Proteger com `if (unificando) return`. Não é bloqueante: a transação é atômica e o resultado continua consistente.
2. **Verificação em runtime ausente** (confirmed) — guarda `requireAcessoPessoas`, `audit_logs` com UNIFICAR e o modal só foram validados por leitura, lint e build. Fazer um teste manual com login antes do deploy.
3. **Checagem de CPF fora da transação** (possible) — em `atualizarPessoaComCpf`, a checagem de conflito e o UPDATE não travam a linha. Uma corrida rara cairia em P2002, que é tratado e não corrompe dados.

</details>

<details>
<summary>Details</summary>

## Atomicidade e ausência de perda de dados
`unificarPessoas` usa `$transaction` com `SELECT ... FOR UPDATE` em alvo e origem. Os erros de controle (`UnificacaoErro`) são lançados dentro da transação e causam rollback. O conflito de módulo (Junta, Farmácia ou CCZ nos dois lados) é verificado antes de qualquer escrita. A origem nunca é excluída, só marcada com `ativo=false`, `unificado_em_cpf`, data e usuário. O CNS da origem é anulado antes de ser repassado ao alvo, para respeitar a unicidade. Campos do alvo só são preenchidos quando estão vazios. O teste de atomicidade com falha simulada confirmou o rollback.

## Snapshot
Inclui alvo e origem (com endereços), pedidos, junta com filhos (agendamentos, atendimentos e serviços), farmácia com filhos (tratamentos e dispensações), tutor, animais (sem a foto base64, com flag `temFoto`) e os dados do formulário. É gravado antes das escritas, na mesma transação da inserção em `auditoria_unificacoes`.

## Guarda de acesso e privacidade
`atualizarPessoa` e `confirmarUnificacaoPessoas` chamam `requireAcessoPessoas` primeiro, e 401/403 viram `{ success:false }`. O payload de conflito expõe só `cpf` e `nome`, o mínimo necessário. A server action recebe os CPFs do cliente, mas a validação é feita no servidor (origem provisória, alvo oficial e ativo).

## Restrições do escopo
`backups/` e `.env` estão ignorados e não aparecem no diff. Não há commit novo: HEAD continua em `fa8e8c3`, e as mudanças estão só no working tree. A migration exige `git add -f`, e `rollback.sql.txt` está ao lado dela. A pasta `empi-etapa1` não foi usada.

</details>

<details>
<summary>File map</summary>

- `prisma/migrations/20261108120000_empi_unificacao_pessoa/` — DDL aditivo e rollback escrito
- `prisma/schema.prisma` — campos, model `AuditoriaUnificacao`, `onUpdate: Cascade`, realinhamento do format
- `src/lib/unificacaoPessoa.js`, `src/lib/cpf.js` — núcleo transacional e helpers de CPF
- `src/lib/pessoa.js`, `src/lib/audit.js` — ajustes e ação UNIFICAR
- `src/app/gerenciamento/pessoas/actions.js` — atualizar com conflito e confirmar unificação
- `src/components/CadastroPessoas/CadastroPessoas.js` — CPF editável se provisório e modal
- Demais arquivos de regulação, junta, farmácia, CCZ, APIs e users — filtro `ativo:true` e rótulo "CPF não informado"

Diff completo: `git diff` no working tree.

</details>
