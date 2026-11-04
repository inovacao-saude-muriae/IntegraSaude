# Relatório técnico para VPS: IntegraSaude

Análise somente leitura (node_modules, .next e .git excluídos). Nenhum valor de segredo foi lido ou citado; só nomes de variáveis. A senha do docker-compose está mascarada.

## 1. Resposta resumida

- Linguagem: JavaScript puro (arquivos .js, com JSX dentro). Não há TypeScript: zero arquivos .ts ou .tsx e nenhum tsconfig.json. Existe só um jsconfig.json (alias `@/*` para `./src/*`).
- Stack: Next.js 16.3.0 (App Router, Turbopack em dev), React 19.2.8, Prisma 7.9.1 com `@prisma/adapter-pg` e `pg` 8.23.0, PostgreSQL 16.
- Node: o mínimo real é **20.19 ou superior** (Prisma 7.9 exige `^20.19 || ^22.12 || >=24`; Next 16.3 exige `>=20.9`). Recomendo Node 22 LTS. O desenvolvimento local usa Node v20.20.2 e npm 10.8.2.
- É um único processo Node (`next start`) mais um PostgreSQL. Não há fila, cache externo, e-mail, S3 nem storage de arquivos.
- O Supabase foi removido do código, das dependências e das variáveis. Sobrou só uma menção histórica num relatório de auditoria em .agents/.
- Atenção para a hospedagem:
  - O rate limit de login fica em memória, então só funciona com uma instância.
  - Os scripts de backup são PowerShell e precisam de equivalente bash.
  - A porta 5433 do banco não deve ficar exposta à internet.

## 2. Linguagens e contagem (aproximada)

Contagem de arquivos e linhas fora de node_modules, .next e .git:

| Extensão | Arquivos | Linhas | Observação |
|---|---|---|---|
| .js | 186 | ~42.955 | Código da aplicação: JSX, server actions, rotas API, scripts Prisma. Inclui `src/proxy.js` e `prisma.config.js`. |
| .css | 68 | ~21.054 | CSS Modules (`*.module.css`) |
| .md | 41 | ~11.815 | Documentação interna e relatórios em .agents/ |
| .json | 11 | ~8.713 | package.json, package-lock.json, relatórios |
| .sql | 7 | ~3.236 | 6 migrations Prisma mais um arquivo em scripts/backups, se houver |
| .prisma | 1 | 636 | `prisma/schema.prisma` |
| .ps1 | 3 | 284 | `scripts/backup-database.ps1`, `restore-database.ps1`, `list-backups.ps1` |
| .mjs | 2 | 35 | `next.config.mjs`, `eslint.config.mjs` |
| .png / .ico | 12 / 1 | n/a | Logos e ícones em `public/img` |
| .yml / .toml | 1 / 1 | 16 / 3 | `docker-compose.yml`, `prisma/migrations/migration_lock.toml` |

Notas:
- O package.json cita `scripts/test-ccz.mjs` (`npm run test:ccz`), mas esse arquivo não existe. O `.gitignore` ignora `test-*.mjs`. Não é necessário em produção.
- Não há Python, PHP, Java, Go nem outro backend. O SQL só aparece em migrations geradas pelo Prisma e em dumps de backup.

## 3. Runtime e gerenciador de pacotes

Evidências:
- package.json não tem o campo `engines`, e não existe `.nvmrc`.
- Exigências dos pacotes instalados, lidas em `node_modules/*/package.json`:
  - next 16.3.0 pede `node >=20.9.0`.
  - prisma e @prisma/client 7.9.1 pedem `node ^20.19 || ^22.12 || >=24.0`.
  - pg 8.23.0 pede `node >= 16`.
- `@types/node ^26.2.0` é devDependency e não tem efeito em JS puro.
- O gerenciador é **npm**. O `package-lock.json` está em lockfileVersion 3, então o instalador correto é `npm ci`.
- `react` e `next` estão com versão fixa (19.2.8 e 16.3.0). As demais usam `^`.

Recomendações:
- Node 22 LTS, instalado via NodeSource ou nvm. Node 20 só serve se for 20.19 ou superior.
- Sugerir ao desenvolvedor adicionar `"engines": {"node": ">=22"}` e um `.nvmrc`. Nada foi alterado.

Dependências de execução (package.json):
- `next`, `react`, `react-dom`, `@prisma/client`, `@prisma/adapter-pg`, `pg`
- `bcryptjs` (hash de senha), `jose` (JWT)
- `jspdf` e `jspdf-autotable` (PDF), `xlsx` (Excel)
- `recharts`, `swr`, `lucide-react`

devDependencies: `prisma`, `dotenv`, `eslint`, `eslint-config-next`, `babel-plugin-react-compiler`, `@types/*`.

Atenção: o CLI `prisma` e o `dotenv` ficam em **devDependencies**, e o `prisma.config.js` importa `@prisma/config` e `dotenv`. Por isso, no servidor, use `npm ci` completo (sem `--omit=dev`) para poder rodar `prisma generate` e `prisma migrate deploy`. Alternativa: rodar as migrations a partir de uma máquina de build.

## 4. Banco de dados

- Engine: **PostgreSQL 16**, imagem `postgres:16` no docker-compose.yml.
- docker-compose.yml:
  - serviço `integrasaude`, container `integrasaude_db`, `restart: always`
  - usuário `admin`, banco `integrasaude`, senha `***` (mascarada)
  - porta `5433:5432` (mapeada para todas as interfaces do host)
  - volume nomeado `integrasaude_data`
- ORM: Prisma 7.9.1 (`provider = "prisma-client-js"`, `previewFeatures = ["driverAdapters"]`).
  - `src/lib/prisma.js` cria um `pg.Pool` e passa para `PrismaPg`.
  - O `datasource db` do schema.prisma não tem URL. A URL vem de `prisma.config.js`, que lê `DATABASE_URL` e `DIRECT_URL` de `.env.local` e `.env` via dotenv.
- Models: cerca de 636 linhas de schema, com módulos Regulação, Farmácia Judicial, CCZ (zoonoses, esporotricose, denúncias, animais), Junta Reguladora, Usuários, Sessões e Acessos.
- Migrations em `prisma/migrations` (6, mais o `migration_lock.toml`):
  - 20261028200815_add_esporotricose_relatorios
  - 20261029012505_add_data_agendamento_zoonoses
  - 20261029144626_alterar_campos_endereco_denuncia
  - 20261101183339_add_username_field
  - 20261101202203_add_ccz_comum_role
  - 20261101211759_add_primeiro_acesso_field
- Pegadinha: o `.gitignore` tem `*.sql`. As 6 migrations atuais estão versionadas (confirmado com `git ls-files`). Uma migration nova gerada no futuro seria ignorada pelo git, então deve ser adicionada com `git add -f`.
- Seed: `prisma/seed.js`, via `npm run db:seed` ou `prisma db seed`. Cria o admin com username padrão `admin_integra`. Se faltarem `GESTOR_USERNAME` e `GESTOR_SENHA`, usa **credenciais padrão** e avisa no console. Em produção, defina essas variáveis antes do seed e troque a senha no primeiro acesso.
- Scripts utilitários em `prisma/` (`check-users.js`, `clear-sessions.js`, `delete-user.js`, `fix-primeiro-acesso.js`, `set-primeiro-acesso.js`, `diagnostico-completo.js`, `backfill-acessos.js`). São manutenção manual, não rodam no deploy.
- Comandos de banco no deploy:
  - `npx prisma generate` (obrigatório; gera o client)
  - `npx prisma migrate deploy` (aplica as migrations sem prompt)
  - `npm run db:seed` (só na primeira instalação)
  - `db:reset` (`migrate reset --force`) apaga tudo e **não** deve ser usado em produção.
- Os nomes da migrations têm datas em 2026. Isso não afeta o `migrate deploy`, só a ordem.

## 5. Serviços e dependências externas

Foi feita busca por `fetch(`, URLs e `process.env` em src/, prisma/ e scripts/.

Externos reais:
1. **ViaCEP** (`src/lib/viacep.js`, `https://viacep.com.br/ws/{cep}/json/`). API pública, sem chave. O servidor ou o navegador precisa de saída HTTPS para ela.
2. **Google Fonts** (`src/components/Header.module.css`, `@import url('https://fonts.googleapis.com/css2?family=Inter...')`). É carregada pelo navegador do usuário.

Internos: todos os outros `fetch()` do código chamam rotas `/api/...` da própria aplicação (`/api/me`, `/api/pessoas`, `/api/ubs`, `/api/gerenciamento/...`, `/api/admin/acessos` e outras).

Não encontrei: envio de e-mail (nodemailer ou SMTP), S3, SDK de nuvem, webhooks, Redis, filas, nem `fs` ou `path` no código da aplicação (a busca por `fs`, `writeFile` e `createWriteStream` em src/ só achou `XLSX.writeFile`, que roda no navegador).

Arquivos e imagens:
- **Não há upload em disco.** A foto do animal (CCZ) é comprimida no navegador (`src/lib/imageCompression.js`, `CadastroAnimal.js`, limite de 5 MB antes da compressão, largura máxima de 800 px) e gravada como string/data URL no campo `fotoUrl` (`foto_url`, `String?`) do PostgreSQL. Consequências:
  - O backup do banco já cobre as fotos.
  - O banco cresce com as fotos.
  - Não é preciso volume de arquivos na VPS.
- `public/img` guarda só logos e ícones estáticos (`logo-ccz.png`, `integralogo.png`, `icon.png`, ícones de ação).
- Server actions aceitam corpo de até **8 MB** (`next.config.mjs`).
- PDF: gerado no navegador com `jspdf` e `jspdf-autotable` (`src/app/ccz/*Pdf.js`). Excel: `xlsx` (`XLSX.writeFile` em `regulacao/page.js`, `farmacia-judicial/Relatorios.js` e `SaldoEstoque.js`), também no navegador. Nenhum dos dois grava no servidor.

Supabase:
- Removido. `rg supabase` fora de node_modules, .next, .git e do lockfile só retorna .agents/tasks/auditoria-tecnica-integrasaude.md (linha histórica "Upload de foto, Supabase Storage") e o `review.md` da própria remoção.
- Não há mais a dependência `@supabase/*` no package.json, nem as variáveis `NEXT_PUBLIC_SUPABASE_*` e `SUPABASE_SERVICE_ROLE_KEY` nos arquivos `.env` e `.env.local`.
- O `review.json` da tarefa remove-supabase está com `"verdict":"APPROVED"`.
- As alterações ainda estão **não commitadas** (`git status` mostra `M package.json`, `M package-lock.json`, `M src/lib/env.js` etc. no índice e no working tree). Para a VPS, faça o commit antes do deploy.

## 6. Variáveis de ambiente (apenas nomes)

Obrigatórias, validadas em `src/lib/env.js` (`validateEnv`):
- `DATABASE_URL`: deve começar com `postgresql://`, senão a aplicação lança erro.
- `JWT_SECRET`: mínimo recomendado de 32 caracteres (gera aviso, não erro). Usada para assinar e verificar o JWT em `src/app/actions/auth.js` e `src/proxy.js` (jose).

Encontradas nos arquivos de ambiente:
- `.env`: `PORT`, `DATABASE_URL`
- `.env.local`: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `GESTOR_CPF`, `GESTOR_NOME`, `GESTOR_SENHA`

Outras lidas no código:
- `DIRECT_URL`: usada em `prisma.config.js` (conexão direta para migrations; pode ser igual à `DATABASE_URL` sem pooler).
- `GESTOR_USERNAME`, `GESTOR_NOME`, `GESTOR_SENHA`: lidas por `prisma/seed.js`. Observação: o `.env.local` tem `GESTOR_CPF`, que o seed não lê.
- `NODE_ENV`: define `secure` no cookie de sessão e o nível de log do Prisma.
- `PORT`: lida pelo `next start`.

Observações:
- Os arquivos `.env*` estão no `.gitignore`, então precisam ser criados na VPS. Não há `.env.example` no repositório, embora a mensagem de erro do `env.js` o mencione.
- Na VPS use um `JWT_SECRET` novo e forte (por exemplo `openssl rand -hex 32`), diferente do de desenvolvimento.

## 7. Build e execução em produção

Sequência recomendada (na pasta do projeto, com `.env.local` ou `.env` presente):

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
# primeira instalação apenas:
npm run db:seed
npm run build
npm run start   # next start
```

- Scripts do package.json: `build` = `next build`; `start` = `next start`. O `start` não define porta nem hostname.
- `next start` usa por padrão a porta **3000** (ou `PORT`) e escuta em todas as interfaces. Para escutar só localhost atrás de proxy: `npx next start -H 127.0.0.1 -p 3000`.
- Só o script `dev` usa `--hostname 0.0.0.0 --port 3000 --turbo`.

next.config.mjs:
- `experimental.serverActions.bodySizeLimit: "8mb"`
- `allowedDevOrigins` (localhost, 127.0.0.1, 192.168.0.226 e 0.0.0.0 na porta 3000): vale só para dev.
- `turbopack.root: process.cwd()`
- Não define `output` (sem `standalone`), nem `headers()`, `images` ou `reactCompiler`. O build é o padrão e roda com `next start`.

Autenticação e proxy:
- `src/proxy.js` é o middleware do Next 16 e protege rotas com o cookie `session_token`. Matcher: `/((?!_next/static|_next/image|favicon.ico|img).*)`.
- O login (`loginAction`) emite um JWT de 8 horas e grava o cookie com `httpOnly`, `sameSite: "lax"` e `secure: true` quando `NODE_ENV=production`. Sessões também ficam na tabela `Session` do banco.
- Como o cookie é `secure` em produção, **sem HTTPS o login não persiste**. HTTPS é obrigatório.
- `getClientIP` (`auth.js`) lê `x-forwarded-for` e `x-real-ip`. Atrás de proxy, ele precisa receber esses headers (veja a seção 8). O bug de `headers()` sem `await` já foi corrigido no arquivo (hoje `await headers()`).

## 8. Recomendações de infraestrutura

Dimensionamento (estimativa, não medida):
- SO: Ubuntu Server 22.04 ou 24.04 LTS (ou Debian 12).
- Mínimo: 2 vCPU, 2 GB de RAM, 20 GB de SSD. Recomendado: 2 vCPU, 4 GB de RAM, 40 GB de SSD, porque o `next build` consome bastante memória (com 1 GB pode falhar sem swap) e as fotos ficam no banco.
- Software: Node 22 LTS, PostgreSQL 16 (nativo ou em Docker), Nginx ou Caddy, PM2 ou systemd.

Banco:
- Opção A: PostgreSQL 16 instalado no SO.
- Opção B: Docker com o `docker-compose.yml` existente.
  - Trocar o mapeamento para `127.0.0.1:5433:5432` (hoje fica aberto em todas as interfaces).
  - Trocar a senha por uma forte.
  - O banco não deve ser acessível pela internet.
- Se o banco for novo (o usuário comentou que renomeou o sistema para IntegraSaude), o nome do banco e o usuário devem bater com a `DATABASE_URL`.

Processo e proxy:
- Rodar `npm run start` sob systemd ou PM2 (`pm2 start npm --name integrasaude -- start`), com reinício automático e `NODE_ENV=production`.
- Nginx ou Caddy na frente, com HTTPS (Let's Encrypt), proxy para `127.0.0.1:3000`, repassando `X-Forwarded-For`, `X-Real-IP` e `X-Forwarded-Proto`.
- O Nginx precisa de `client_max_body_size 10m` (as server actions aceitam 8 MB e as fotos viajam como base64).
- Firewall: abrir só 22, 80 e 443.

Backup:
- `scripts/backup-database.ps1`, `restore-database.ps1` e `list-backups.ps1` são **PowerShell para Windows**. Usam `pg_dump` e compactação .zip, e o README-BACKUP.md cita um host e uma porta específicos de rede privada. Não rodam em Linux sem PowerShell.
- É preciso um equivalente em bash, por exemplo `pg_dump -Fc` diário via cron, com retenção e cópia para fora da VPS, e um script de restauração com `pg_restore`.
- O `.gitignore` já ignora `/backups/`, `*.sql`, `*.dump` e `*.sql.gz`.

Pontos de atenção:
1. **Rate limit em memória, só com uma instância.** Existem duas implementações com `Map` no processo: `src/lib/rateLimit.js` (com `setInterval`) e `loginAttempts` em `src/app/actions/auth.js`. Com PM2 em modo cluster ou várias réplicas, cada processo conta separado, e um restart zera os contadores. Rode uma instância só, ou migre para Redis ou para uma tabela no banco.
2. **IP do cliente atrás de proxy.** Só vale se o Nginx sobrescrever `X-Forwarded-For`. Se o cliente puder forjar esse header, o rate limit é burlável. Configure `proxy_set_header X-Forwarded-For $remote_addr;` ou o equivalente no Caddy.
3. **Segredos e sessão.** O JWT é assinado com `JWT_SECRET` (HS256 via jose). Se o segredo mudar, todas as sessões caem. O cookie é `httpOnly`, mas só `secure` com `NODE_ENV=production`. Guarde os `.env` com permissão 600 e fora do git.
4. **Armazenamento local.** Não há uploads em disco, então não precisa de volume persistente além do PostgreSQL. As fotos ficam no banco como base64 e aumentam o tamanho do dump.
5. **Credenciais padrão do seed.** Defina `GESTOR_USERNAME` e `GESTOR_SENHA` antes de rodar o seed; sem elas o admin nasce com senha padrão conhecida do código.
6. **Dependência `xlsx` 0.18.5.** É a última versão publicada no npm e tem avisos de segurança conhecidos (prototype pollution, ReDoS). Aqui ela só gera planilhas no navegador, então o risco é menor. Não foi feito `npm audit` neste relatório.
7. **Logs.** O código usa `console.log` em vários pontos (por exemplo `CadastroAnimal.js`). Em produção, configure rotação de logs (journald ou `pm2-logrotate`).
8. **Alterações não commitadas** (Supabase removido, correção do `headers()`, etc.). Fazer commit antes de clonar na VPS.

## 9. Resumo para copiar e colar para a empresa de VPS

> Sistema web "IntegraSaude" em **JavaScript** (sem TypeScript): Next.js 16.3 + React 19, ORM Prisma 7.9 e banco **PostgreSQL 16**. Exige **Node.js 22 LTS** (mínimo 20.19) e npm. Um único processo Node (`npm run build` e `npm run start`, porta 3000) atrás de Nginx ou Caddy com **HTTPS obrigatório** (cookie de sessão é `secure`). Precisamos de PostgreSQL 16 acessível só localmente, e variáveis de ambiente `DATABASE_URL`, `DIRECT_URL` e `JWT_SECRET`. Sem serviços externos além de saída HTTPS para viacep.com.br; sem e-mail, S3 ou uploads em disco (fotos ficam no banco). Dimensionamento sugerido: Ubuntu 22.04 ou 24.04 LTS, 2 vCPU, 4 GB de RAM (mínimo 2 GB com swap) e 40 GB de SSD. Precisamos de acesso root/sudo, firewall com 22, 80 e 443, e backup diário do PostgreSQL (`pg_dump`) com retenção. Rodar uma única instância da aplicação, pois o rate limit de login é em memória.

## 10. Limites desta análise

Não verifiquei: se o build de produção (`next build`) passa hoje; se o banco atual já tem as 6 migrations aplicadas; o uso real de RAM, CPU e tamanho do banco (os valores acima são estimativas); `npm audit`. Contagens de linhas são aproximadas e incluem arquivos de documentação de .agents/. Nenhum arquivo do projeto foi alterado, só este relatório foi criado.
