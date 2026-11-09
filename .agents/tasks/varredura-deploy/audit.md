# Auditoria de varredura e prontidão para deploy (Fase 1, somente leitura)

Projeto: IntegraSaude (Next.js 16.3.0 + React 19.2.8 + Prisma 7.9.1 + PostgreSQL 16). Node local: v20.20.2.
Nenhum arquivo do projeto foi alterado. Valores de segredos não são reproduzidos aqui (somente nomes de chaves).

## 0. Resumo executivo

| Item | Resultado |
|---|---|
| Arquivos rastreados (git ls-files) | 445 (+1 pasta não rastreada `.agents/tasks/empi-etapa1/`) |
| `npx prisma generate` | OK (Prisma Client 7.9.1). Aviso: previewFeature `driverAdapters` está obsoleto |
| `npm run lint` | 0 erros, 5 warnings |
| `npm run build` | OK. 51 páginas geradas, 0 erros de compilação |
| Arquivos de código (js/css) em src/ | 259; **20 órfãos** (13 .js + 7 .css; ver seção A.2) |
| Verificações de caixa (import relativo, `@/`, CSS `@import`) | **494 verificadas, 0 divergentes** |
| Refs de imagens `/img/...` em JS/CSS vs `public/` | **19 verificadas, 0 divergentes** |
| Imports não resolvidos | 1 (em arquivo órfão: `@/lib/db` inexistente) |
| Migrations | 16 pastas, todas rastreadas (18 arquivos no total, 0 faltando) |
| Achados | 2 críticos, 8 altos, 10 médios, vários baixos |

Achados mais importantes:

1. **CRÍTICO** 4 rotas de administração de usuários estão sem autenticação (o proxy libera todo `/api`).
2. **CRÍTICO** `next@16.3.0` tem advisory classificado como critical no `npm audit` (correção em 16.4.5).
3. **ALTO** `prisma` e `dotenv` em devDependencies e nenhum `prisma generate` no build. `npm ci --omit=dev` quebra migrate/generate.
4. **ALTO** `.gitignore` bloqueia `.env.example` (`.env*`) e `scripts/test-ccz.mjs` (`test-*.mjs`). O `.env.example` citado por `env.js` não existe.
5. **ALTO** Dumps/backups com dados rastreados em `.agents/` (já no GitHub) e um dump de 680 KB não rastreado.

---

## A) Arquivos desnecessários

### A.1 Inventário por classe (445 rastreados)

| Classe | Qtde | Arquivos |
|---|---|---|
| NECESSÁRIO (runtime/build) | ~270 | 241 arquivos alcançáveis de src/ (js/css) + `src/app/icon.png`, `src/app/apple-icon.png` + `public/favicon.ico`, `public/img/**` em uso (4 imagens + `lupa.png`) + `prisma/schema.prisma`, `prisma/migrations/**` (18) + `package.json`, `package-lock.json`, `next.config.mjs`, `prisma.config.js`, `eslint.config.mjs`, `jsconfig.json`, `.gitignore` |
| FERRAMENTA DE MANUTENÇÃO (mantém; decisão do usuário) | 17 | `prisma/seed.js`, `prisma/backfill-acessos.js` (ambos no package.json), `prisma/check-sessions.js`, `check-users.js`, `clear-sessions.js`, `delete-user.js`, `diagnostico-completo.js`, `fix-primeiro-acesso.js`, `set-primeiro-acesso.js`, `scripts/backup-database.ps1`, `list-backups.ps1`, `restore-database.ps1`, `docker-compose.yml`, `skills-lock.json`, `AGENTS.md`, `prisma/migrations/.../rollback.sql.txt`, `migration_lock.toml` |
| DOCUMENTAÇÃO | 21 | `prisma/README.md`, `public/README.md`, `scripts/README-BACKUP.md`, `src/**/README*.md` (18). Há trechos desatualizados (ver A.7) |
| ARTEFATO DE WORKFLOW (`.agents/**`) | 111 | 36 pastas de tarefa em `.agents/tasks`. Ver A.6 |
| DESNECESSÁRIO | 20 + 6 (+ ver A.5) | 20 órfãos de src/, 6 ícones de `public/img/icon/` sem uso |

(Contagens por grupo são aproximadas; o que importa é a lista de candidatos a remoção abaixo. Fora dos grupos nomeados, os 18 READMEs de src/ entram em DOCUMENTAÇÃO.)

### A.2 Órfãos em src/ (grafo a partir de 67 pontos de entrada; 241 alcançados de 259)

Seguidos: imports relativos, alias `@/`, `import()`, `require`, `export from` e `@import` de CSS. Pontos de entrada: page, layout, route, loading, error, not-found, template, default, icon, apple-icon, proxy, globals.css.

| Arquivo | Observação |
|---|---|
| `src/app/actions/users.js` | Server Actions de usuário (criar/listar) **sem guarda**; substituídas pelas rotas `/api/gerenciamento/usuarios`. Órfão e perigoso |
| `src/app/camara-tecnica/farmacia-judicial/EstoqueMedicamentos.js` + `.module.css` | Tela antiga; substituída por SaldoEstoque |
| `src/app/junta-reguladora/ServicoAtendimento.js` + `.module.css` | Substituída por `AtendimentoServico.js` (tem `console.log` de payload) |
| `src/app/regulacao/HistoricoPedidoModal.js` + `.module.css` | Modal antigo; usa `actions/auditoria.js`. É um dos 5 warnings do lint |
| `src/app/regulacao/Modals/ModalEdicaoPedido.js` + `.module.css` | Modal antigo |
| `src/app/regulacao/actions/auditoria.js` | **Importa `@/lib/db`, que não existe**. Quebrado e órfão (só o órfão `HistoricoPedidoModal` o usa) |
| `src/app/regulacao/hooks/useCrudHandlers.js` | Sem uso |
| `src/app/regulacao/hooks/useRegulacaoDataCached.js` | Sem uso (existe `useRegulacaoData`, esse sim usado) |
| `src/components/LoadingSpinner.js` + `.module.css` | Sem uso |
| `src/components/ModalCadastroPaciente.js` + `.module.css` | Sem uso (substituído por `SeletorPaciente`/`CadastroPessoas`) |
| `src/components/SkeletonLoader.js` + `.module.css` | Sem uso |
| `src/lib/queries.js` | Hooks SWR sem uso. É o **único** uso de `swr` |
| `src/lib/rateLimit.js` | Sem uso. O login tem seu próprio rate limit em memória dentro de `actions/auth.js` |

Total: 20 arquivos (13 `.js` + 7 `.module.css`). Depois de remover, `src/app/regulacao/actions/` fica vazio (a pasta some) e `src/app/regulacao/hooks/` mantém `useRegulacaoData.js`.

Observação: o comparativo foi feito sobre os arquivos rastreados. Importações por string dinâmica montada em runtime não existem no projeto (verificado: todos os `import()` têm literal).

### A.3 CSS não usado dentro de módulos ativos (baixa confiança, só candidatos)

398 classes em 36 CSS Modules não aparecem como `styles.x` / `styles['x']` / `styles[\`prefixo${}\`]` em nenhum importador. Maiores concentrações:
`PacientesJudiciais.module.css` (44/64), `RelatoriosGerais.module.css` (36/72), `page.module.css` da home (34/56), `CadastroPacienteJunta.module.css` (29/47), `ListaCCZ.module.css` (25/96), `DashboardCCZ.module.css` (24/58), `NovoPedido.module.css` (20/43), `FichaAnimal.module.css` (18/42), `CadastroPessoas.module.css` (18/53).
Risco: classes usadas por outro padrão (prop `styles` repassada, concatenação) podem ser falso positivo. **Recomendação: não mexer agora.** Se o usuário quiser, fazer em tarefa separada com revisão visual.

CSS Modules referenciados e **não definidos** (bug de estilo, não de deploy), 7 casos: `stylesForm.checkboxRow`/`checkboxLabel` (RelatorioVisitaEsporotricose.js), `styles.formCard` (TermosEmBranco.js, TutoresLista.js), `styles.textColor`/`fontStyle` (ProntuarioRelatorio.js), `styles.tagPedido` (ModalConfirmacaoExclusao.js).

### A.4 Imagens em `public/`

| Arquivo | Situação |
|---|---|
| `img/logos-integra/icon.png` (1,19 MB) | Usado em `layout.js` metadata |
| `img/logos-integra/integralogo.png` (517 KB) | Usado (login, Sidebar) |
| `img/logo/logo-ccz.png` | Usado (PDFs e termos CCZ) |
| `img/icon/lupa.png` | Usado (FiltersBar) |
| `img/icon/cancelar.png`, `editar.png`, `excluir.png`, `lupa-p.png`, `lupa-preto.png`, `mais.png` | **Sem nenhuma referência** em JS/CSS. DESNECESSÁRIO (6 arquivos, ~43 KB) |
| `favicon.ico`, `src/app/icon.png`, `src/app/apple-icon.png` | **Os três têm o mesmo conteúdo (hash idêntico, 1,18 MB cada)**; `favicon.ico` é na verdade um PNG. Redundância e peso (3,5 MB). `layout.js` ainda declara `icons` apontando para `/img/logos-integra/icon.png`, em conflito com a convenção de arquivos. Sugestão: decidir um só mecanismo e reduzir a imagem (ex.: 512 px) |

### A.5 Scripts

| Arquivo | Referência | Classe |
|---|---|---|
| `prisma/seed.js` | `package.json` (`prisma.seed`) e `prisma.config.js` | NECESSÁRIO (ver B.3 sobre credenciais) |
| `prisma/backfill-acessos.js` | `npm run db:backfill` | FERRAMENTA |
| `prisma/check-sessions.js`, `check-users.js`, `clear-sessions.js`, `diagnostico-completo.js`, `fix-primeiro-acesso.js` | nenhuma | FERRAMENTA (decisão do usuário) |
| `prisma/delete-user.js`, `prisma/set-primeiro-acesso.js` | nenhuma | FERRAMENTA, mas com **CPF de pessoa fixo no código** (PII em repositório). Recomendar receber o CPF por argumento |
| `scripts/backup-database.ps1`, `list-backups.ps1`, `restore-database.ps1` | só `scripts/README-BACKUP.md` | FERRAMENTA, **somente Windows** (ver B.2) |
| `scripts/test-ccz.mjs` | `npm run test:ccz` | **Não existe**, e `.gitignore` (`test-*.mjs`) impediria de versionar. Script npm quebrado: remover do package.json (ou recriar o arquivo e ajustar o .gitignore) |

Defeitos encontrados nas ferramentas: `diagnostico-completo.js` usa `jwt.decode(...)` (linha 162) mas `jwt` nunca é importado (ReferenceError no ramo de ação corretiva). `seed.js` carrega só `.env` (não `.env.local`), ao contrário dos demais scripts e do `prisma.config.js`.

### A.6 `.agents/` e outros resíduos

- 111 arquivos rastreados em 36 pastas (reviews, planos, relatórios de tarefas antigas). Não afetam build/runtime. Classe: ARTEFATO DE WORKFLOW. Candidatos a limpeza se o usuário quiser o repositório enxuto (decisão dele, pois são histórico de trabalho).
- **Dados em artefatos rastreados** (já enviados ao GitHub):
  - `.agents/tasks/remove-zoonoses/backup-ccz_zoonoses_notificacoes.sql` (contém `CREATE TABLE` + `COPY` com linhas de dados). Está rastreado apesar do `*.sql` no .gitignore (adicionado com `-f`).
  - `.agents/tasks/remove-esporotricose-protocolo/backup-numero_protocolo.csv` (id + número de protocolo).
- **Dump não rastreado**: `.agents/tasks/db-rename/backup.sql` (~680 KB), ignorado pelo `*.sql`. É um dump completo de banco; contém dados de pacientes em potencial. Tratar como `backups/` (não commitar). Sugestão para a Fase 2: perguntar ao usuário se pode apagar ou mover para `backups/`.
- Pasta não rastreada `.agents/tasks/empi-etapa1/` (só `brief.md`): resíduo, pode apagar na Fase 2.
- Cruzamento: nenhum `*.bak`, `*.old`, `*.orig`, `*copy*`, `*.tmp`, `*.log`, `_tmp*`, `Thumbs.db` ou `.DS_Store` fora de `node_modules`, `.next`, `backups`.
- `skills-lock.json` (raiz): lock de skills do assistente (prisma). Não é usado no build. Mantém ou remove por decisão do usuário.

### A.7 Documentação desatualizada (baixo risco)

18 READMEs em `src/` + `public/README.md` + `prisma/README.md`. Exemplos de conteúdo que não bate com o código: `src/app/api/me/README.md` cita `POST /api/login` (inexistente); `public/README.md` cita `/logo.png`, `/docs/manual-usuario.pdf`, `/img/icons/home.svg` (inexistentes); `src/lib/README.md` diz que `dotenv` é usado por `env.js` (não é); `scripts/README-BACKUP.md` tem caminho `C:\Users\Jefinny\...` e senha do banco local em texto. Não impedem deploy.

### A.8 Dependências (package.json)

| Pacote | Situação |
|---|---|
| `lucide-react` | **0 usos** em todo o projeto. Remover |
| `swr` | só usado em `src/lib/queries.js` (órfão). Vira não usado após remover o órfão |
| `@types/node`, `@types/bcryptjs` | Projeto é JavaScript (sem `.ts`/`tsconfig`). Sem uso |
| `babel-plugin-react-compiler` | `reactCompiler` **não está habilitado** em `next.config.mjs`. Sem uso |
| `@prisma/config` | Importado diretamente em `prisma.config.js`, mas **não declarado** (vem transitivo de `prisma`). Frágil. Alternativa: `import { defineConfig } from 'prisma/config'` |
| `dotenv` | Usado por `prisma.config.js` e por 8 scripts. Está em devDependencies (ver B.4) |
| `prisma` (CLI) | devDependencies, mas o deploy usa (ver B.4) |
| `eslint`, `eslint-config-next` | Usados pela config (dev) |
| `react-dom`, `next`, `jose`, `pg`, `bcryptjs`, `jspdf`, `jspdf-autotable`, `recharts`, `xlsx`, `@prisma/*` | Em uso |

`npm audit --omit=dev` (consulta ao registry): 10 vulnerabilidades (8 altas, 2 críticas).
- `next` 16.3.0: critical, correção disponível em 16.4.5 (direta).
- `dompurify` (transitivo de `jspdf`): critical, com correção via `npm audit fix`.
- `xlsx` 0.18.5: high (prototype pollution + ReDoS), **sem correção no npm** (a SheetJS mantém versões fora do registry). Usado só para exportar planilhas; o risco é maior ao *ler* arquivos, e o projeto só escreve.
- `prisma`/`@prisma/config`, `sharp`, `source-map-js`, `fast-uri`, `deepmerge-ts`, `mysql2`: high, transitivos, com correção por atualização.

---

## B) Prontidão para deploy em VPS Linux

### B.1 Sensibilidade a maiúsculas/minúsculas (verificação mais importante): OK

- **494** referências verificadas (imports relativos e `@/`, `export from`, `import()`, `require`, CSS `@import`), comparando segmento por segmento com `readdir`. **0 divergentes.**
- **19** referências a `/img/...` em JS/CSS contra `public/`: **0 divergentes**.
- Os scripts Node e o `next.config.mjs` só importam pacotes.
- Resultado coerente com o `next build` e o lint sem erros.

### B.2 Windows e finais de linha

- Não há caminhos absolutos `C:\` no código de runtime. `process.cwd()` em `next.config.mjs` é portável. Nenhum uso de `path.join` com separador fixo.
- `scripts/*.ps1` (PowerShell) são somente Windows e têm host/porta/usuário/senha fixos (host é um IP privado 100.x, faixa de VPN; porta 5433; senha local). **A VPS precisa de equivalentes bash** (`pg_dump` com variáveis de ambiente, sem senha no arquivo). `scripts/README-BACKUP.md` também tem caminho `C:\Users\Jefinny\...`.
- Finais de linha: `core.autocrlf=true` neste PC. O working tree está em CRLF (274 arquivos), mas o **índice do git está 100% LF** (0 `i/crlf`, 0 `i/mixed`), então o clone na VPS vem em LF. Risco só se alguém comitar de outro PC sem autocrlf. **Não existe `.gitattributes`.** Recomendação: criar com `* text=auto eol=lf`, `*.ps1 text eol=crlf` (opcional), `*.sh text eol=lf`, para blindar futuros `.sh`.

### B.3 Configuração e ambiente

Variáveis `process.env.*` encontradas:

| Variável | Onde é usada | Validada em `env.js`? |
|---|---|---|
| `DATABASE_URL` | prisma.config.js, `src/lib/prisma.js`, 4 rotas, scripts | Sim (obrigatória, prefixo `postgresql://`) |
| `JWT_SECRET` | `proxy.js`, `actions/auth.js`, `trocar-senha`, `check-sessions.js` | Sim (obrigatória; só avisa se < 32 caracteres) |
| `DIRECT_URL` | prisma.config.js | Não (opcional) |
| `GESTOR_USERNAME`, `GESTOR_NOME`, `GESTOR_SENHA` | `prisma/seed.js` | Não |
| `NODE_ENV` | auth, prisma.js, env.js | n/a |

Achados:
- **`.env.example` não existe** e **não pode ser versionado** do jeito atual: `.gitignore` tem `.env*` sem exceção `!.env.example`. A mensagem de erro de `env.js` manda copiar um arquivo inexistente. Correção: criar `.env.example` só com nomes de chaves e placeholders + adicionar `!.env.example` ao .gitignore.
- Chaves presentes nos arquivos locais (somente nomes): `.env` tem `PORT`, `DATABASE_URL`; `.env.local` tem `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `GESTOR_CPF`, `GESTOR_NOME`, `GESTOR_SENHA`. Observações: `GESTOR_CPF` e `PORT` não são lidas por nenhum código; `GESTOR_USERNAME` não está definida (o seed cai no username padrão); `DATABASE_URL` está duplicada em dois arquivos (`.env.local` tem prioridade).
- **Nenhum `.env*` rastreado** e nenhum aparece no histórico (175 commits verificados com `git log --all` por `.env`, `.env.local`, `.env.*`, `backups`). `backups/` também nunca foi commitada. OK.
- `prisma/seed.js`: usa username e senha **padrão no código** quando `GESTOR_USERNAME`/`GESTOR_SENHA` faltam, e **imprime a senha no console** no final. Para produção: exigir as variáveis (abortar se faltarem) e não imprimir senha. O usuário seed é criado com `primeiroAcesso: false` (não pede troca de senha). Recomendo `true`.
- `validateEnv()` roda **a cada carga de `src/lib/prisma.js`** e imprime "Variáveis de ambiente validadas" (18 vezes durante o `next build`; em runtime, uma por worker/módulo). Ruído de log em produção; sugerir log só em desenvolvimento.
- Hosts/IPs/portas fixos no código rastreável: `docker-compose.yml` (senha fixa de dev, porta 5433), `.ps1` (IP privado, senha), `next.config.mjs` (`allowedDevOrigins` com IP de LAN `192.168.0.226`), fallback `"127.0.0.1"` em `actions/auth.js`, `lib/audit.js`, `lib/rateLimit.js` (IP "desconhecido" cai todo em um único balde; ver B.8). Nenhuma chave/token/senha de API no `src/`.
- `allowedDevOrigins`: **somente desenvolvimento** (confirmado em `node_modules/next/dist/docs/.../allowedDevOrigins.md`). Sem efeito em `next start`. Detalhe: as entradas têm esquema e porta (`http://...:3000`), enquanto a doc usa só hostnames; talvez nem estejam fazendo efeito. Pode manter ou limpar.
- `dev` script usa `--turbo` e `--hostname 0.0.0.0` (OK para dev; `start` não define porta, usa `PORT` do ambiente ou 3000).

### B.4 Prisma em produção

- `prisma` (CLI) e `dotenv` estão em **devDependencies**. `prisma.config.js` importa `dotenv` e `@prisma/config` no topo. Em `npm ci --omit=dev` (ou `NODE_ENV=production npm ci`): `prisma migrate deploy`/`generate` não existem localmente (o `npx` tentaria baixar a versão mais recente da internet, o que é indesejável com Prisma 7) e, se existissem, `prisma.config.js` quebraria por falta de `dotenv`.
- **Recomendação (melhor opção)**: mover `prisma` e `dotenv` para `dependencies` (peso extra pequeno, evita surpresa na VPS). Alternativa: documentar que o deploy usa `npm ci` completo e só depois `npm prune --omit=dev`.
- `@prisma/client` 7 **não gera o client no postinstall**. Não existe `postinstall` nem `prisma generate` no `build`. Em clone limpo, `next build` falha por client não gerado. Correção sugerida: `"build": "prisma generate && next build"` ou `"postinstall": "prisma generate"`.
- Sequência de deploy sugerida (Fase 2 pode documentar): `npm ci` → `npx prisma migrate deploy` → `npx prisma generate` (ou no build) → `npm run build` → `npm run start`.
- `prisma.config.js` define `migrations.seed`, e `package.json` também tem `"prisma": { "seed": ... }` (config duplicada; em Prisma 7 a do `prisma.config.js` é a válida. A do package.json pode ser removida).
- `generator` usa `previewFeatures = ["driverAdapters"]`, que já gera aviso de obsolescência a cada `generate`. Alterar exige mexer em `schema.prisma` (fora do escopo desta tarefa); só reportar.
- `src/lib/prisma.js`:
  - logs: `["query","error","warn"]` somente em `development`; em produção só `["error"]`. OK.
  - Pool `pg`: `max: 20`, `connectionTimeoutMillis: 10000`, `idleTimeoutMillis: 30000`. Razoável para 1 instância. Verificar `max_connections` do Postgres da VPS (padrão 100).
  - **SSL**: nenhuma configuração. Se o Postgres da VPS ficar na mesma máquina/rede privada, sem problema. Se for externo/gerenciado, precisa `?sslmode=require` na URL ou opção `ssl`.
  - Singleton: o `PrismaClient` é reaproveitado via `globalThis` só fora de produção; em produção o módulo é carregado uma vez por processo, o que é suficiente. Em dev, o `Pool` é recriado a cada reload do módulo (vaza conexões em HMR), pois o `new Pool` fica fora do `globalThis`. Só afeta dev.
  - **4 rotas criam o próprio `Pool` + `PrismaClient`** (`usuarios/listar`, `alterar-role`, `desativar`, `reativar`) lendo `process.env.DATABASE_URL` direto: mais conexões, sem validação de env, sem singleton.

### B.5 `.gitignore` x migrations

- `.gitignore` tem `*.sql`, que ignora `prisma/migrations/**/migration.sql` (`git check-ignore --no-index` confirma a regra da linha `*.sql`).
- **Estado atual: tudo rastreado.** `git ls-files prisma/migrations` = 18 arquivos = os 18 que existem em disco (16 `migration.sql` + `migration_lock.toml` + `rollback.sql.txt`). Nada faltando.
- Risco: toda migration **nova** será ignorada silenciosamente e ficará fora do clone da VPS (`migrate deploy` não a veria).
- Correção proposta (mantendo `backups/`, dumps e outros `.sql` ignorados), após a linha `*.sql`:
  ```
  !prisma/migrations/
  !prisma/migrations/**/
  !prisma/migrations/**/*.sql
  ```
  (Basta a última se nenhuma regra anterior ignorar as pastas; `/backups/` já tem regra própria.)
- Além disso: remover `test-*.mjs` / `test-*.js` do .gitignore se o projeto for ter testes versionados, e acrescentar `!.env.example`.

### B.6 `next.config.mjs` e build

- `experimental.serverActions.bodySizeLimit: "8mb"` (fotos em base64). Atrás de proxy reverso (nginx) é preciso `client_max_body_size` ≥ 8m, senão o upload falha com 413.
- `turbopack.root: process.cwd()`: OK para build local/VPS **desde que o build rode na raiz do projeto**. Alternativa mais robusta: `path.resolve(import.meta.dirname)`. Só reportar.
- `output: 'standalone'` **não está habilitado**. Sem ele, `next start` exige `node_modules` completo na VPS (aceitável para um único app). Com `standalone`, a imagem fica menor, mas exige copiar `public/` e `.next/static` à mão. Recomendação: manter como está, a menos que vá usar Docker.
- Headers de segurança (CSP, X-Frame-Options, HSTS, Referrer-Policy, X-Content-Type-Options, Permissions-Policy) **ausentes**. Pode ser feito no nginx ou em `headers()`. Não impor CSP agora (recharts/jspdf e estilos inline podem quebrar).
- `next build`: sucesso. Rotas geradas (51 páginas estáticas/dinâmicas): estáticas `/`, `/_not-found`, `/acesso-negado`, `/apple-icon.png`, `/icon.png`, `/dashboard`, `/login`, `/trocar-senha`, `/camara-tecnica`; dinâmicas: `/admin/acessos`, `/camara-tecnica/farmacia-judicial`, `/camara-tecnica/processos`, `/ccz`, `/ccz/dashboards`, `/gerenciamento/{medicos,pessoas,relatorios,ubs,usuarios}`, `/junta-reguladora`, `/regulacao`, `/regulacao/dashboards`; **33 rotas `/api/**`** e `Proxy (Middleware)`. Detalhe de rotas API na seção B.7.
- Lint: 0 erros, 5 warnings: `CadastroTutor.js:101` (eslint-disable sem efeito), `FichaCompletaAnimal.js:28` e `HistoricoPedidoModal.js:28` (deps de useEffect; este arquivo é órfão), `RelatorioAcessos.js:121` (deps de useEffect), `login/page.js:72` (`<img>` em vez de `next/image`).

### B.7 Autenticação e exposição

**Modelo**: `src/proxy.js` só exige um JWT válido (assinatura) para páginas e Server Actions; **libera `/api/**` inteiro** ("rota pública" por prefixo) e `/login`, `/acesso-negado`. A autorização está nos `layout.js`/helpers (`requireAcessoModulo`, `requireGestor`, `requireAdminModulo`, etc.). Cada rota API precisa se proteger sozinha.

Rotas `src/app/api/**` (33):

| Rota | Métodos | Guarda |
|---|---|---|
| `admin/acessos` | GET | requireGestor |
| `admin/metrics` | GET | requireAdminDeAlgumModulo |
| `auth/trocar-senha` | POST | Valida o cookie de sessão por conta própria (OK, intencional) |
| `ccz/agenda/criar`, `ccz/animais`, `ccz/animais/[id]`, `ccz/dashboard`, `ccz/denuncias`, `ccz/denuncias/[id]`, `ccz/tutores/[cpf]` | vários | requireAcessoModulo |
| `farmacia/medicamentos`, `junta-reguladora/dashboard`, `junta-reguladora/servicos`, `regulacao/{dashboard,medicos,procedimentos,tipos-exame,ubs}` | GET | requireAcessoModulo |
| `gerenciamento/auditoria`, `.../auditoria/usuarios`, `.../usuarios` (POST), `.../usuarios/[cpf]`, `regulacao/auditoria` | | requireGestor |
| `gerenciamento/relatorios` | GET | requireAdminDeAlgumModulo |
| `pessoas`, `pessoas/[cpf]`, `pessoas/buscar` | | requireAcessoPessoas |
| `ubs` | GET | `carregarContextoAcesso()` (exige login; sem checagem de módulo, aceitável para lista de UBS) |
| `me` | GET | Valida a sessão por conta própria (OK) |
| **`gerenciamento/usuarios/listar`** | GET | **NENHUMA** |
| **`gerenciamento/usuarios/alterar-role`** | PUT | **NENHUMA** |
| **`gerenciamento/usuarios/desativar`** | PUT | **NENHUMA** |
| **`gerenciamento/usuarios/reativar`** | PUT | **NENHUMA** |

**CRÍTICO**: as 4 últimas permitem, sem login, listar todos os usuários (CPF, nome, role, último acesso), **alterar o perfil de qualquer usuário (inclusive para GESTOR)** e desativar/reativar contas. São consumidas por `components/GerenciarUsuarios/GerenciarUsuarios.js`. Correção sugerida: `requireGestor()` no início de cada handler e trocar o Pool/PrismaClient próprio por `@/lib/prisma`. É correção de segurança sem mudança de comportamento para o Gestor (o usuário deve só confirmar que a tela é de uso exclusivo do Gestor; as rotas irmãs de auditoria/usuários já exigem Gestor). Não li cada handler até o fim, só confirmei a ausência de guarda e o uso de Prisma próprio.

**Server Actions** (as de `"use server"`; cada uma é um endpoint POST). O proxy garante apenas "logado", não "tem acesso ao módulo". Sem guarda de módulo (ler dados, severidade MÉDIA, pois exige estar logado):
- `camara-tecnica/farmacia-judicial/actions.js`: `getPacientesJudiciais`, `getMedicamentosEEstoque`, `getCatalogoMedicamentos`, `getCatalogoCompleto`, `getEstoqueAgrupado`, `getAjustesEstoque`, `getMedicamentosDoPaciente`, `getRelatorioEntradas`, `getRelatorioSaidas`, `getRelatorioSaidaPorMedicamento`, `getDashboardMetrics`, `buscarPessoaExistente`.
- `regulacao/actions.js`: `getPedidosExames` (lista **todos** os pedidos de exame com dados de pacientes), `getAuxiliaryData` (inclui lista de pessoas), `searchPessoa`, `searchPessoasAutocomplete`.
- `regulacao/procedimentosActions.js`: `getProcedimentosData`. `junta-reguladora/servicosActions.js`: `getServicosData`. `junta-reguladora/actions.js`: `buscarPessoaPorCpfOuNome`, `buscarPessoaPorNomeOuCpf` (delegam a `buscarPessoaExistente`, que tem guarda; ok).
- `actions/auth.js:loginAction`: pública por definição.
- Órfãs e sem guarda: `actions/users.js` (3 funções) e `regulacao/actions/auditoria.js:registrarAlteracaoCampo`. Serão removidas com os órfãos.
- Todas as ações de escrita relevantes (criar/editar/excluir) têm `requireAcessoModulo`/`requireAdminModulo`/`requireAcessoPessoas`.
**Decisão do usuário**: aplicar guarda de módulo também às leituras (mudaria o comportamento só para quem hoje consegue ler dados de módulo sem permissão) ou aceitar "qualquer usuário logado lê" por ora. O cadastro de pessoas é compartilhado entre módulos, então `searchPessoa*` podem precisar de regra especial.

Rotas/páginas de teste ou debug: **nenhuma** (sem `app/test`, `api/debug`, `_tmp`).

`console.log` com dados pessoais ou ruidosos (todos removíveis):
- `src/app/api/me/route.js:44`: loga **nome do usuário** a cada chamada de `/api/me` (que roda em todas as páginas).
- `src/app/page.js:94,102,109`: "DEBUG - Dados do usuário" (nome, role) no navegador.
- `src/app/api/ccz/animais/[id]/route.js`: 5 logs (`=== GET ... ===`, ids, resultado).
- `src/app/ccz/FichaTutor.js:41,43,52`: loga o **CPF do tutor** e o payload completo recebido (no navegador).
- `src/app/ccz/CadastroAnimal.js:46,106,117,121`: logs de estado e resultados de busca a cada render/digitação.
- `src/app/ccz/esporotricosePdf.js:516` e `junta-reguladora/ServicoAtendimento.js:44` (órfão): debug.
- `src/lib/env.js:43`: ver B.3.
- O log "[Dashboard] Stats carregadas" citado pelo usuário **não existe mais** no código.
- `console.error("[Proxy] ...")` e erros nas rotas: manter.

### B.8 Processo e infraestrutura (somente reporte)

- **Rate limit de login em memória** (`Map` dentro de `actions/auth.js`, com `setInterval`): vale só para 1 instância/processo; reiniciar o processo zera. Se usar PM2 em cluster, fica ineficaz. Com 1 instância, ok. (`src/lib/rateLimit.js` é um segundo rate limit, **órfão**.)
- **IP do cliente**: `x-forwarded-for` / `x-real-ip` são lidos como estão. Atrás do nginx, é preciso repassá-los (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; X-Real-IP $remote_addr`). Sem isso, tudo vira `127.0.0.1` (bucket único no rate limit e auditoria com IP errado); se o nginx não sobrescrever o header, o cliente pode forjá-lo.
- **Cookies**: `httpOnly`, `sameSite: lax`, `secure` quando `NODE_ENV=production`, expiração JWT de 8h. Em produção o `secure: true` **exige HTTPS**; se a VPS for acessada por `http://IP`, o login não grava o cookie e o usuário volta para o login. Planeje TLS (Let's Encrypt) ou ajuste.
- **Uploads em disco**: não há; fotos são base64 no banco (dentro do limite de 8 MB das Server Actions).
- **docker-compose.yml**: serviço/container `integrasaude_db`, volume `integrasaude_data`, senha fixa de dev, porta `5433:5432` publicada em todas as interfaces (`0.0.0.0`). O container em execução localmente chama-se `orion_db` com volume `orion_data` (conforme informado). Rodar `docker compose up` criaria banco/volume novos e vazios. **Não usar o compose na VPS** como está (porta exposta + senha fixa). Nada foi alterado.
- `docker-compose.yml` e `.ps1` têm CRLF no working tree (índice LF).

### B.9 Versão do Node

- `package.json` **sem `engines`** e **sem `.nvmrc`**.
- Exigências: Prisma 7.9 e `@prisma/client` pedem `^20.19 || ^22.12 || >=24`; Next 16.3 pede `>=20.9`. Node local v20.20.2 (atende).
- Recomendação: Node 22 LTS na VPS; adicionar `"engines": { "node": ">=20.19" }` (ou `^22.12`) e `.nvmrc` com `22`.

---

## C) Lista de decisões necessárias do usuário (para a Fase 2)

1. Confirmar proteção `requireGestor` nas 4 rotas de usuários (esperado: sim).
2. Atualizar `next` para 16.4.5 (mudança de versão; precisa de teste)? E `npm audit fix` em transitivos (jspdf/dompurify)? `xlsx` não tem correção.
3. Mover `prisma` e `dotenv` para `dependencies`; adicionar `prisma generate` ao build/postinstall.
4. Guardas de módulo nas Server Actions de leitura (impacto de comportamento para quem hoje lê sem permissão).
5. Scripts de manutenção em `prisma/` (7 utilitários): manter todos? Recomendo manter e apenas tirar o CPF fixo dos dois que o têm e corrigir o `jwt` do diagnóstico.
6. Apagar `.agents/tasks/*`? E o dump `.agents/tasks/db-rename/backup.sql` (apagar ou mover para `backups/`); remover do repositório os dois backups em `.agents/` (sql e csv).
7. Remover o script `test:ccz` ou recriar o teste; ajustar `.gitignore` (`!.env.example`, `!prisma/migrations/**/*.sql`, rever `test-*`).
8. Ícones `public/img/icon/*` (6 sem uso) e imagem de 1,2 MB triplicada (favicon/icon/apple-icon): consolidar.
9. Remover dependências sem uso: `lucide-react`, `swr`, `@types/node`, `@types/bcryptjs`, `babel-plugin-react-compiler`.
10. Criar `.gitattributes`, `.env.example`, `engines`/`.nvmrc`, scripts bash de backup/restore para a VPS (sem senha no arquivo).

## D) Proposta de escopo seguro para a Fase 2 (sem decisão adicional)

- Apagar os 20 órfãos de src/ e a pasta `.agents/tasks/empi-etapa1/`.
- Apagar os 6 ícones sem uso de `public/img/icon/`.
- Remover `console.log` de debug listados em B.7.
- Proteger as 4 rotas de usuários (`requireGestor` + `@/lib/prisma`).
- `.gitignore`: `!.env.example` e `!prisma/migrations/**/*.sql`; criar `.env.example` e `.gitattributes`.
- `package.json`: remover `test:ccz`, `engines`, mover `prisma` e `dotenv` para `dependencies`, `prisma generate` no build; remover pacotes sem uso; `.nvmrc`.
- `env.js`: log de sucesso só em dev; `seed.js`: exigir `GESTOR_*` em produção e não imprimir senha.
- Rodar `lint` e `build` de novo e comparar com o baseline (0 erros, 5 warnings, 51 páginas).

## E) Baseline (evidência)

- `npx prisma generate`: sucesso (client v7.9.1).
- `npm run lint`: 0 errors, 5 warnings (listados em B.6).
- `npm run build`: "Compiled successfully", 51/51 páginas, `Proxy (Middleware)` presente. Sem erros de TypeScript (projeto JS).
- Os scripts temporários de análise (`.agents/tasks/varredura-deploy/tmp/`) foram apagados ao final.
