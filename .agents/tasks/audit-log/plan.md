# Implementation Plan — Log de auditoria + linha do tempo do usuário (Relatórios Gerais)

Projeto: Next.js 16 + React 19 + Prisma 7.9 + PostgreSQL (Docker `orion_db`, porta 5433), JS, CSS Modules. Windows/PowerShell: usar `;`, nunca `&&`. Sem worktree. NÃO commitar (nem `git add`), NÃO usar `migrate dev/reset`, sem libs novas, só o model `AuditLog` muda no schema.

## Achados da investigação (que mudam o desenho)

1. **Guarda atual do relatório.** `src/app/gerenciamento/relatorios/layout.js` libera `usuarioEhAdminDeAlgumModulo` (GESTOR ou admin de qualquer módulo) e `GET /api/gerenciamento/relatorios` usa `requireAdminDeAlgumModulo()`. A página atual é um *relatório unificado do PACIENTE* (Pessoa), não de usuários do sistema. O relatório de acessos de usuários (`src/components/admin/RelatorioAcessos.js`, `/admin/acessos`, `/api/admin/acessos`) usa `requireGestor()`. **Decisão:** auditoria de usuário é dado sensível sobre outros usuários → a API de auditoria usa `requireGestor()` (igual ao relatório de acessos; mais estrita ou igual à guarda da tela, nunca mais frouxa). Na página, a aba "Auditoria de usuário" só aparece para `role === "GESTOR"` (via `/api/me`); admins de módulo continuam vendo exatamente o que veem hoje. Documentar no relatório final.
2. **Obtenção do usuário nas actions.** `requireAcessoModulo/requireAdminModulo/requireGestor/requireAcessoPessoas` (`src/lib/auth.js`) retornam o `user` completo (`cpf`, `nome`, `role`, `acessos`) lido de `Session` pelo cookie `session_token`. Muitas actions fazem `await requireX(...)` **sem atribuir** → trocar por `const user = await requireX(...)` (sem alterar lógica).
3. **Actions de Regulação SEM guarda alguma** (pré-existente): `createPedidoExame`, `updateCommunicationDate`, `releasePaciente`, `updatePedidoExame`, `deletePedidoExame` (src/app/regulacao/actions.js). NÃO adicionar guarda (mudaria comportamento). O helper deve, quando `user` não é passado, resolver o usuário sozinho pela sessão (cookie → `prisma.session` → `user`), e se não achar usuário, **não grava** (nunca grava anônimo). Reportar como achado.
4. **Logout não existe no servidor**: `Header.js#handleLogout` só faz `router.push("/login")` (a `Session` nem é apagada). LOGOUT fica FORA (documentar). Não criar rota nova para isso. Falha de login: FORA (evita ruído/abuso da tabela; opcional no pedido).
5. `src/app/actions/users.js` (`criarUsuarioAction`) é código morto (sem chamadores, schema antigo `pessoaCpf`) → FORA. `src/app/regulacao/actions/auditoria.js` (`registrarHistoricoPedido`, tabela `regula_pedidos_historico`, importa `@/lib/db`) é rastro antigo próprio → não mexer; entra na junção do histórico por CPF.
6. `server-only` NÃO está instalado → não importar; comentar no topo do helper que é só-servidor (importa `next/headers` e Prisma, o que já impede uso no client).
7. Padrão de PK no schema: `Int @id @default(autoincrement())` (UserAcesso, AjusteEstoque, PedidoExameHistorico) → `AuditLog.id` Int autoincrement. Migrations manuais existentes têm só o SQL cru (ex.: `20261107120000_add_animal_data_devolucao`); última é `20261107120000_...` → nova: `20261107130000_add_audit_log`.
8. `.gitignore` ignora `*.sql` → `migration.sql` precisa de `git add -f` NO COMMIT FUTURO (feito pelo usuário). Apenas avisar.

## Design

### Model (prisma/schema.prisma, ao final do arquivo; não tocar em mais nada)
```prisma
model AuditLog {
  id         Int      @id @default(autoincrement())
  userCpf    String   @map("user_cpf") @db.VarChar(11)      // referência lógica a users.cpf, SEM FK (excluir usuário não apaga histórico)
  userNome   String   @map("user_nome") @db.VarChar(150)    // snapshot do nome
  acao       String   @db.VarChar(30)
  modulo     String   @db.VarChar(40)
  entidade   String   @db.VarChar(60)
  entidadeId String?  @map("entidade_id") @db.VarChar(100)
  descricao  String?  @db.VarChar(500)
  detalhes   Json?
  ip         String?  @db.VarChar(60)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([userCpf, createdAt], map: "idx_audit_user_data")
  @@index([modulo, createdAt], map: "idx_audit_modulo_data")
  @@index([createdAt], map: "idx_audit_data")
  @@map("audit_logs")
}
```
`migration.sql` (SQL cru equivalente): `CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "user_cpf" VARCHAR(11) NOT NULL, "user_nome" VARCHAR(150) NOT NULL, "acao" VARCHAR(30) NOT NULL, "modulo" VARCHAR(40) NOT NULL, "entidade" VARCHAR(60) NOT NULL, "entidade_id" VARCHAR(100), "descricao" VARCHAR(500), "detalhes" JSONB, "ip" VARCHAR(60), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"));` + 3 `CREATE INDEX` com os nomes acima.

Vocabulário: `acao` ∈ CRIAR | EDITAR | EXCLUIR | LOGIN | ENCERRAR | REABRIR | LIBERAR | DISPENSAR | AJUSTAR | DESATIVAR | REATIVAR | SALVAR | OUTRO. `SALVAR` só para `upsert` cujo código existente NÃO distingue criar/editar sem query extra (não adicionar queries só para auditar). Quando o código já sabe (ex.: `dados.id`, `findUnique` prévio, `isEdicao`), usar CRIAR/EDITAR. `modulo` ∈ CCZ | REGULACAO | FARMACIA_JUDICIAL | JUNTA | GERENCIAMENTO | AUTH. Constantes exportadas pelo helper (`AUDIT_ACOES`, `AUDIT_MODULOS`) e reutilizadas pela API/UI.

### Helper `src/lib/audit.js`
`export async function registrarAuditoria({ user, acao, modulo, entidade, entidadeId, descricao, detalhes, ip })`:
- `user` opcional (`{cpf, nome}`); se ausente → resolver pela sessão (`cookies()` async + `prisma.session.findUnique` incluindo `user {cpf,nome,ativo}`); sem usuário → retorna sem gravar.
- `ip` opcional; se ausente, `await headers()` → `x-forwarded-for` (1º item) / `x-real-ip` / `"127.0.0.1"` (mesma lógica de `getClientIP` em `src/app/actions/auth.js`, copiada porque lá não é exportável — `"use server"` só exporta async actions; NÃO alterar auth.js para isso). `headers()` pode falhar fora de request → try/catch → ip null.
- Sanitização: trunca `descricao` (500), `entidade` (60), `entidadeId` (100), `acao`(30), `modulo`(40); `detalhes` → copia rasa só de primitivos, descarta chaves que casem `/senha|hash|token|secret|foto|base64|imagem|jwt/i`, strings >200 chars truncadas, JSON final ≤ 2 KB (senão `null`). Nunca receber objetos de formulário inteiros: o chamador passa só ids/resumo.
- BEST-EFFORT: corpo inteiro em `try/catch` → `console.error("[audit] ...")`, nunca relança, sempre retorna (`true/false`). Um único `INSERT` (+ 1 query de sessão só quando `user` não vem). Sempre `await` (fire-and-forget pode ser abortado no runtime), mas sem retry.
- Chamado SEMPRE depois do sucesso (após o `await prisma...` principal, antes do `return { success: true }`), nunca no `catch`, e sem mudar retorno/lógica.

### Convenção de pontos de chamada
`await registrarAuditoria({ user, acao: "EDITAR", modulo: "CCZ", entidade: "Animal", entidadeId: String(id), descricao: "Animal 'Rex' atualizado" })`. Descrição pt-BR curta, sem dados clínicos/pessoais além de nome do cadastro já visível (nome do animal, nome do medicamento, nome da pessoa; CPF só em `entidadeId` quando a entidade é Pessoa/Tutor/Usuário). Ações em lote → 1 entrada com contagem em `detalhes`.

## Inventário de pontos a instrumentar (grep + leitura)

**AUTH**
- `src/app/actions/auth.js#loginAction` → LOGIN (após `cookieStore.set`, antes do `return { success: true }`; `user` = registro do login, `ip` já calculado).
- `src/app/api/auth/trocar-senha/route.js` POST (após `user.update` e `session.update`) → EDITAR, entidade "Senha", descrição "Senha alterada" (sem detalhes).
- FORA: logout (inexistente no servidor), falha de login.

**CCZ** — `src/app/ccz/actions.js` (guarda `requireAcessoModulo(MODULOS.CCZ)`; só `encerrarEsporotricose` já guarda `user`): `excluirAnimal`, `salvarTutor`, `salvarAnimal`, `salvarProcedimento`, `excluirProcedimento`, `salvarTermoInternacao`, `salvarEsporotricose`, `excluirEsporotricose`, `encerrarEsporotricose` (ENCERRAR), `reabrirEsporotricose` (REABRIR), `registrarIncineracaoEsporotricose` (OUTRO "Incineração registrada" sem valor), `salvarRelatorioVisita`, `salvarDenuncia`. Rotas: `api/ccz/agenda/criar` POST (CRIAR Procedimento), `api/ccz/denuncias` POST (CRIAR), `api/ccz/denuncias/[id]` PUT (EDITAR) e DELETE (EXCLUIR), `api/ccz/animais/[id]` DELETE (EXCLUIR), `api/ccz/tutores/[cpf]` DELETE (EXCLUIR). Atenção: `salvarAnimal` pode devolver/adotar (situação) → registrar como EDITAR/CRIAR com `detalhes.situacao` curta; se a action distinguir devolução/adoção, ação própria `OUTRO` com descrição "Animal devolvido/adotado".

**REGULAÇÃO** — `src/app/regulacao/actions.js`: `createPedidoExame`(CRIAR), `updateCommunicationDate`(EDITAR), `releasePaciente`(LIBERAR), `createPessoa`(CRIAR Pessoa), `createMedico`, `createUbs`, `createProcedimento`, `updateProcedimento`, `deleteProcedimento`, `saveCotaFinanceira`(SALVAR), `savePlanejamentoCidade`(SALVAR; já tem `user`), `updateBillingDate`(EDITAR), `updatePedidoExame`(EDITAR), `deletePedidoExame`(EXCLUIR), `updateMedico`, `deleteMedico`(EXCLUIR — é soft via update; descrever "desativado"), `updatePessoa`, `deletePessoa`, `updateUbs`, `deleteUbs`(soft). `src/app/regulacao/procedimentosActions.js`: `createRegistro`, `updateRegistro`, `deleteRegistro` (inclui criação de TipoExame auxiliar na linha ~23: cobrir dentro da entrada do registro, sem entrada separada). Ver pontos 3: 5 actions sem guarda → helper resolve o usuário pela sessão. FORA: `actions/auditoria.js` (rastro próprio).

**FARMÁCIA JUDICIAL** — `src/app/camara-tecnica/farmacia-judicial/actions.js`: `createPacienteJudicial`(SALVAR; ler a função para ver se distingue), `createMedicamento`, `updateMedicamento`, `deleteMedicamento`, `createLoteMedicamento`, `updateLoteMedicamento`, `ajustarEstoque`(AJUSTAR; `session` = user; detalhes: saldoAnterior/saldoNovo/delta, SEM justificativa livre), `registrarDispensacao`(DISPENSAR; var `usuario`; detalhes: medicamentoId/qtd; SEM dados clínicos do paciente além do número de pasta em `entidadeId`).

**JUNTA** — `src/app/junta-reguladora/actions.js`: `cadastrarPacienteJunta`(SALVAR/CRIAR), `registrarAtendimentoServico`(CRIAR/EDITAR conforme `update` vs `create` já existente no código; descrição genérica, sem observação clínica), `criarAgendamentoJunta`(CRIAR), `excluirAgendamentoJunta`(EXCLUIR). `servicosActions.js`: `createRegistro`, `updateRegistro`, `deleteRegistro`. As guardas lá são `requireEscritaServicoJuntaPorNome/requireAdminModulo/requireAcessoModulo` — capturar o retorno. `usuário criado on-the-fly` (`prisma.servico.create` em helper ~linha 693): coberto pela entrada da action chamadora.

**GERENCIAMENTO** — `src/app/gerenciamento/pessoas/actions.js`: `criarPessoa`, `atualizarPessoa`, `excluirPessoa`. `src/app/api/pessoas/route.js` POST (CRIAR Pessoa). `src/app/api/gerenciamento/usuarios/route.js` POST (`requireGestor`; upsert → CRIAR se novo, EDITAR/REATIVAR se existia: ler o código; ACESSOS em `detalhes`: role + lista de módulos/níveis, nunca senha/hash), `usuarios/alterar-role` PUT (EDITAR "Perfil/acessos alterados"), `usuarios/desativar` PUT (DESATIVAR), `usuarios/reativar` PUT (REATIVAR). Médicos/UBS/Procedimentos do Gerenciamento usam as actions de Regulação (já cobertas).

**FORA (documentar):** leituras/listagens; `actions/users.js` (morto); `regulacao/actions/auditoria.js`; `api/admin/metrics` e `api/admin/acessos` (somente leitura — confirmar com grep de escrita); logout; falha de login.

## Desenho da tela / consulta

**API** (novos, `requireGestor()`; erro 401/403 → JSON com `error.status`, como `api/admin/acessos`):
- `GET /api/gerenciamento/auditoria/usuarios?q=` → até 20 usuários: `where OR [nome contains (insensitive), username contains (insensitive), cpf contains (apenas dígitos de q, se houver)]` (min 2 caracteres). Retorna `{cpf, nome, username, cargo, role, ativo}`. NUNCA retorna `senhaHash`.
- `GET /api/gerenciamento/auditoria?cpf=&modulo=&dataInicio=&dataFim=&page=&limit=` → `{ usuario, resumo, itens, paginacao }`.
Lógica de consulta em `src/lib/auditoriaRelatorio.js` (importada pela rota).

**Consulta (servidor, `prisma.$queryRaw` com `Prisma.sql`, parametrizado, sem concatenar entrada):** um CTE `eventos` com `UNION ALL`:
1. `audit_logs WHERE user_cpf = $cpf` → origem `AUDITORIA`.
2. Histórico anterior à auditoria (origem `HISTORICO`, só linhas com `ts < corte`, onde `corte = COALESCE((SELECT MIN(created_at) FROM audit_logs), now())`, para não duplicar o que a nova auditoria já cobre):
   - `user_sessions` (user_id = cpf, created_at) → AUTH/LOGIN "Sessão iniciada" — correspondência por CPF;
   - `user_acessos` (user_cpf = cpf, created_at) → GERENCIAMENTO/OUTRO "Permissão recebida: módulo X (nível Y)" — por CPF;
   - `regula_pedidos_historico` (usuario_cpf = cpf, data_hora) → REGULACAO, ação `OUTRO`/mapeada, descrição `acao` + `campo_alterado` (sem valor_anterior/valor_novo) — por CPF (**confirmar a tabela no banco antes**; há drift pré-existente; se não existir, omitir a fonte);
   - por NOME (`lower(btrim(col)) = lower(btrim($nome))`, marcado `matchTipo = 'NOME'`): `ccz_esporotricose.encerrado_por` (ts `data_encerramento`, ENCERRAR), `ccz_esporotricose.fiscal_responsavel` (ts `data_visita`, OUTRO "Visita como fiscal responsável"), `ccz_esporotricose_relatorios.profissional_responsavel` (ts `data_relatorio`), `farmacia_ajustes_estoque.responsavel` (ts `created_at`, AJUSTAR), `regula_planejamento_cidade.updated_by` (ts `updated_at`, EDITAR), `junta_atendimentos.profissional_responsavel` (ts `data_atendimento`, OUTRO "Atendimento registrado"). Descrições genéricas, sem dados clínicos/paciente. Cada coluna já guarda só o nome; tabelas pequenas → sem índice novo (anotar que a junção por nome é varredura).
3. Campos devolvidos: `origem`, `matchTipo` (`CPF`|`NOME`|null), `ts`, `modulo`, `acao`, `entidade`, `entidadeId`, `descricao`, `ip`.
- Filtros: `ts >= dataInicio` e `ts < dataFim + 1 dia` (datas `YYYY-MM-DD` validadas por regex; inválida → 400); `modulo` em whitelist (`AUDIT_MODULOS`), senão 400.
- **Resumo** (respeita período; ignora o filtro de módulo para continuar mostrando a distribuição): `total`, `porModulo[]`, `porAcao[]`, `primeiro`, `ultimo`, `totalHistorico` (quantos vindos do histórico antigo). Um `GROUP BY` sobre o CTE (ou 3 queries curtas).
- **Linha do tempo:** `ORDER BY ts DESC, origem, id`, `LIMIT $limit OFFSET $offset`, limit padrão 25 (máx. 100), + `COUNT(*)` com os mesmos filtros (módulo+período) para `paginacao {page, limit, total, totalPaginas}`. Índices usados: `idx_audit_user_data` (cpf+data). `BigInt` do `COUNT` convertido com `Number()`.

**UI:** `src/app/gerenciamento/relatorios/page.js` hoje é um componente único (relatório do paciente). Renomear internamente para `RelatorioPacienteView` (corpo inalterado) e novo `export default function RelatoriosGeraisPage()` que: busca `/api/me`; se `role === "GESTOR"`, mostra abas "Relatório do paciente" | "Auditoria de usuário"; senão renderiza só `RelatorioPacienteView` (comportamento atual idêntico). Nova aba: `src/components/admin/AuditoriaUsuario.js` + `AuditoriaUsuario.module.css` (CSS Module, mesmos tokens/visual de `RelatoriosGerais.module.css`/`RelatorioAcessos.module.css`, sem libs): busca (debounce 300 ms, min. 2 chars) com dropdown de usuários (CPF, nome, username); ao selecionar: cartões de resumo (total, por módulo, por ação, primeiro/último), filtros (data inicial/final, select de módulo, botão limpar), tabela da linha do tempo (data/hora pt-BR, módulo, ação, entidade/ID, descrição, IP) com selo "Histórico anterior à auditoria" e "correspondência por nome" quando aplicável, paginação Anterior/Próxima, estados carregando/vazio/erro. Aviso fixo: "Registros de auditoria existem a partir de <data do primeiro registro>; antes disso, apenas rastros do histórico".

## Etapas e validação (cada uma deixa o repo buildável)

- [ ] 1. **Schema + migration + helper + LOGIN/trocar-senha** (FEAT-001). Adicionar `AuditLog` ao schema; criar `prisma/migrations/20261107130000_add_audit_log/migration.sql`; aplicar: `npx prisma db execute --file prisma/migrations/20261107130000_add_audit_log/migration.sql` ; `npx prisma migrate resolve --applied 20261107130000_add_audit_log` ; `npx prisma generate` (não imprimir DATABASE_URL). Criar `src/lib/audit.js`; instrumentar `loginAction` e `trocar-senha`.
  Verify: `docker exec orion_db psql -U admin -d integrasaude -c "\d audit_logs"` mostra colunas e 3 índices + PK; `npx prisma generate` ok; `npm run lint` (0 erros, 5 warnings pré-existentes); `npm run build` ok. Teste do helper (rota temporária `src/app/api/_tmp-audit/route.js` em servidor de teste na porta 3100, removida ao fim): grava 1 linha; payload inválido (detalhes circular/BigInt, `user` sem cpf) não lança e não grava; `detalhes` com `senha`/`token` sai filtrado. Apagar as linhas de teste de `audit_logs` (identificar por `descricao` de teste) e a rota temporária.
- [ ] 2. **Instrumentação por módulo** (FEAT-002), na ordem CCZ → Regulação → Farmácia → Junta → Gerenciamento, conforme o inventário. Regras: chamar só após sucesso, `const user = await requireX(...)` onde faltar, não mudar lógica/retornos. Rodar `npm run lint` e `npm run build` ao fim de cada módulo.
  Verify: lint 0 erros; build ok; com servidor em porta 3100 e sessão de teste (inserir `Session` temporária de um GESTOR, assinar JWT com `jose` usando `JWT_SECRET` do `.env` sem imprimir — o `proxy.js` faz `jwtVerify`), exercitar via API/curl ao menos: 1 rota de cada módulo que seja viável (ex.: `POST /api/ccz/denuncias`, `POST /api/pessoas`, `PUT /api/gerenciamento/usuarios/desativar`+`reativar` num usuário de teste criado por script) e conferir 1 linha em `audit_logs`. Para actions (server actions não são chamáveis por curl simples), validar por leitura de diff + script node temporário que replique a chamada do helper; registrar quais foram testadas ao vivo e quais só por revisão. Provar que falha do helper não quebra a action (ex.: temporariamente `audit_logs` inacessível via nome de coluna inválido num `detalhes` inválido → action segue retornando `success`). Remover TODOS os dados/arquivos de teste (linhas em `audit_logs`, usuário/pessoa/denúncia de teste, `Session` temporária, scripts).
- [ ] 3. **API + tela do relatório** (FEAT-003). `src/lib/auditoriaRelatorio.js`, rotas `api/gerenciamento/auditoria/usuarios` e `api/gerenciamento/auditoria`, `components/admin/AuditoriaUsuario.js(+.module.css)`, edição de `relatorios/page.js` (abas).
  Verify: lint/build ok; com dados de teste inseridos por script (linhas em `audit_logs` para um CPF de teste, em módulos e datas variados): busca por nome, username e CPF (com e sem máscara); filtros período/módulo; paginação (limit=2); resumo coerente; junção do histórico antigo para um usuário real que tenha sessões/`encerrado_por` (conferir `HISTORICO`/`matchTipo`) e que linhas `HISTORICO` posteriores ao corte não apareçam; 401 sem cookie, 403 com sessão de usuário comum e de admin de módulo não-gestor; resposta nunca contém `senhaHash`. Validação visual em `next dev`/`next start` na porta 3100 (ex.: `npx next dev -p 3100`, nunca derrubar a 3000). Limpar dados/arquivos de teste.
- [ ] 4. **Convergência final** (loop): build completo + lint, checar `git status` (só arquivos desta feature + migration.sql ignorado), conferir que nenhum outro model/migration/.env mudou, e preparar o relatório final (migration, design, pontos instrumentados/de fora, tela, permissão, resultados, lembrete `git add -f` do `migration.sql`).

## Digest

Comandos reais: build `npm run build`; lint `npm run lint` (esperado 0 erros, 5 warnings pré-existentes); Prisma `npx prisma generate`, `npx prisma db execute --file <sql>`, `npx prisma migrate resolve --applied <nome>`; testes automatizados do projeto: só `npm run test:ccz` (`scripts/test-ccz.mjs`, não cobre auditoria) — validação é por scripts/rotas temporárias. Banco: `docker exec orion_db psql -U admin -d integrasaude`. Verificado nesta investigação: container `orion_db` listado pelo `docker ps`; `server-only` ausente de node_modules; `.agents/` existe; árvore limpa no início (`git status` sem saída).

| Arquivo | Bloco a mudar | Teste/verificação |
|---|---|---|
| prisma/schema.prisma | novo `model AuditLog` ao final | `prisma generate`, `\d audit_logs` |
| prisma/migrations/20261107130000_add_audit_log/migration.sql | novo (CREATE TABLE + 3 índices) | `db execute`, `migrate resolve` |
| src/lib/audit.js | novo: `registrarAuditoria`, `AUDIT_ACOES`, `AUDIT_MODULOS`, `getClientIPAudit` | rota temporária |
| src/app/actions/auth.js | `loginAction` (após `cookieStore.set`, ~l.190) | login real em 3100 |
| src/app/api/auth/trocar-senha/route.js | POST após `prisma.session.update` (l.126) | revisão + build |
| src/app/ccz/actions.js | 13 funções (linhas: excluirAnimal 228, salvarTutor 281, salvarAnimal 504, salvarProcedimento 958, excluirProcedimento 1151, salvarTermoInternacao 1404, salvarEsporotricose 1472, excluirEsporotricose 1790, encerrar 1826, reabrir 1868, incineração 1912, salvarRelatorioVisita 1959, salvarDenuncia 2150) | build + revisão |
| src/app/api/ccz/{agenda/criar,denuncias,denuncias/[id],animais/[id],tutores/[cpf]}/route.js | POST/PUT/DELETE | curl com sessão de teste |
| src/app/regulacao/actions.js | 20 funções (create/update/delete Pedido, Pessoa, Medico, Ubs, Procedimento; release; cotas; planejamento; billing) | build + revisão |
| src/app/regulacao/procedimentosActions.js | createRegistro 89, updateRegistro 109, deleteRegistro 142 | build + revisão |
| src/app/camara-tecnica/farmacia-judicial/actions.js | 8 funções (57, 184, 200, 226, 249, 274, 400, 523) | build + revisão |
| src/app/junta-reguladora/actions.js | cadastrarPacienteJunta 110, registrarAtendimentoServico 333, criarAgendamentoJunta 809, excluirAgendamentoJunta 840 | build + revisão |
| src/app/junta-reguladora/servicosActions.js | createRegistro 85, updateRegistro 108, deleteRegistro 143 | build + revisão |
| src/app/gerenciamento/pessoas/actions.js | criarPessoa 107, atualizarPessoa 146, excluirPessoa 171 | build + revisão |
| src/app/api/pessoas/route.js | POST (l.65) | curl |
| src/app/api/gerenciamento/usuarios/{route,alterar-role,desativar,reativar}/route.js | POST/PUT | curl com usuário de teste |
| src/lib/auditoriaRelatorio.js | novo (CTE UNION ALL + resumo + paginação) | script/rotas |
| src/app/api/gerenciamento/auditoria/route.js e auditoria/usuarios/route.js | novos, `requireGestor` | curl: 401/403/200 |
| src/components/admin/AuditoriaUsuario.js + .module.css | novos | visual 3100 |
| src/app/gerenciamento/relatorios/page.js | renomear export default → `RelatorioPacienteView`; novo wrapper com abas (gestor-only) | build + visual |
