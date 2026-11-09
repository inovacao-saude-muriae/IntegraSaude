# Relatório da varredura e correções para deploy (Fase 2)

Nada foi commitado nem adicionado ao índice (`git add` não foi usado). Use `git status` / `git diff` para revisar.

## 1. MANIFESTO de arquivos removidos

Evidência comum: (a) grafo de imports da auditoria (67 entradas, 241 de 259 arquivos alcançados) e (b) contraprova com `git grep` por nome/caminho em `src`, `public` e configs: nenhuma referência de arquivo alcançável. O `npm run lint` e o `npm run build` passaram depois das remoções, então nenhuma precisou ser restaurada.

| Caminho | Motivo | Evidência |
|---|---|---|
| `src/app/actions/users.js` | Server Actions de usuário sem guarda, substituídas por `/api/gerenciamento/usuarios` | Nenhum import (`actions/users` sem ocorrência) |
| `src/app/camara-tecnica/farmacia-judicial/EstoqueMedicamentos.js` + `.module.css` | Tela antiga (substituída por SaldoEstoque) | Só se auto-referencia |
| `src/app/junta-reguladora/ServicoAtendimento.js` + `.module.css` | Substituída por `AtendimentoServico.js`; tinha console.log | Só se auto-referencia |
| `src/app/regulacao/HistoricoPedidoModal.js` + `.module.css` | Modal antigo; 1 dos warnings de lint | Só se auto-referencia |
| `src/app/regulacao/Modals/ModalEdicaoPedido.js` + `.module.css` | Modal antigo | Só se auto-referencia |
| `src/app/regulacao/actions/auditoria.js` | Importava `@/lib/db`, que não existe; só o órfão acima o usava | Único importador era `HistoricoPedidoModal` |
| `src/app/regulacao/hooks/useCrudHandlers.js` | Sem uso | Só a própria definição |
| `src/app/regulacao/hooks/useRegulacaoDataCached.js` | Sem uso (existe `useRegulacaoData`); único consumidor de `@/lib/queries` | Sem importadores |
| `src/components/LoadingSpinner.js` + `.module.css` | Sem uso | Só README e a própria definição |
| `src/components/ModalCadastroPaciente.js` + `.module.css` | Sem uso (substituído por SeletorPaciente/CadastroPessoas) | Só README e a própria definição |
| `src/components/SkeletonLoader.js` + `.module.css` | Sem uso | Só a própria definição |
| `src/lib/queries.js` | Hooks SWR sem uso | Só o órfão `useRegulacaoDataCached` importava |
| `src/lib/rateLimit.js` | Sem uso (login tem rate limit próprio em `actions/auth.js`) | Nenhum import de `@/lib/rateLimit` |
| `public/img/icon/cancelar.png`, `editar.png`, `excluir.png`, `lupa-p.png`, `lupa-preto.png`, `mais.png` | Imagens sem referência | `git grep` por cada nome: 0 ocorrências em JS/CSS (o único match foi binário do próprio arquivo/ "swr") |
| `.agents/tasks/empi-etapa1/` (só `brief.md`) | Pasta residual NÃO rastreada | Resíduo; **não é restaurável via git** (nunca foi commitada) |

Total: 26 arquivos rastreados + 1 pasta não rastreada. As pastas `src/app/regulacao/actions/` ficou vazia (sumiu).

Restaurar um arquivo: `git restore -- <caminho>` (ou, de um commit específico, `git checkout <hash> -- <caminho>`).

Dependências removidas do `package.json` (contraprova `git grep`: 0 usos): `lucide-react`, `swr` (único uso era `queries.js`; as menções a "SWR" em rotas API são só comentários), `@types/node`, `@types/bcryptjs` (projeto é JS), `babel-plugin-react-compiler` (`reactCompiler` não habilitado). Script `test:ccz` removido (apontava para arquivo inexistente).

## 2. DECISÃO NECESSÁRIA (nada disso foi alterado)

| Item | Por que ficou | Recomendação |
|---|---|---|
| `.agents/**` (exceto empi-etapa1) | Histórico de trabalho, 111 arquivos rastreados | Se quiser repo enxuto, remover `.agents/tasks/*` antigos |
| `.agents/tasks/remove-zoonoses/backup-ccz_zoonoses_notificacoes.sql` e `.agents/tasks/remove-esporotricose-protocolo/backup-numero_protocolo.csv` | Rastreados (já no GitHub), contêm dados | Remover do repositório (`git rm --cached`) e mover para `backups/`; avaliar reescrever histórico se forem dados reais de pacientes |
| `.agents/tasks/db-rename/backup.sql` (~680 KB, não rastreado, ignorado) | Dump completo de banco | Mover para `backups/` ou apagar |
| `prisma/check-sessions.js`, `check-users.js`, `clear-sessions.js`, `diagnostico-completo.js`, `fix-primeiro-acesso.js`, `delete-user.js`, `set-primeiro-acesso.js`, `backfill-acessos.js` | Utilitários de manutenção | Manter. `delete-user.js` e `set-primeiro-acesso.js` têm CPF fixo (PII): passar por argumento. `diagnostico-completo.js` usa `jwt` sem importar |
| `scripts/*.ps1`, `scripts/README-BACKUP.md` | Somente Windows; IP/senha fixos | Manter p/ dev; criar equivalente bash na VPS (ver checklist) |
| `skills-lock.json`, `AGENTS.md`, READMEs, `docker-compose.yml`, `backups/`, migrations | Fora do escopo/regra | Manter. Não usar o compose na VPS (porta 5433 pública, senha fixa) |
| 4 rotas de usuários sem autenticação (seção 5) | Não estava na lista de correções seguras desta fase | **Aplicar `requireGestor()` + `@/lib/prisma` o quanto antes** |
| Guardas de módulo em Server Actions de leitura (seção 5) | Muda comportamento de acesso | Decidir regra por módulo |
| `next` 16.3.0 (advisory critical; correção 16.4.5), `dompurify` via jspdf, `xlsx` sem correção | Upgrades proibidos nesta fase | Atualizar `next` e rodar `npm audit fix` em tarefa separada com teste |
| 3 cópias idênticas de 1,2 MB (`public/favicon.ico`, `src/app/icon.png`, `src/app/apple-icon.png`) | Mudança visual/convenção | Reduzir para ~512 px e usar um só mecanismo |
| Classes CSS não usadas (398) e 7 classes referenciadas sem definição | Baixa confiança | Tarefa separada com revisão visual |
| `previewFeatures = ["driverAdapters"]` obsoleto (aviso no generate) | Exige editar `schema.prisma` (proibido) | Remover quando permitido |
| `package.json` > chave `"prisma": {"seed"}` | Duplicada com `prisma.config.js` | Pode remover depois de testar `db seed` |
| `@prisma/config` não declarado (transitivo de `prisma`) | Funciona (confirmado no `npm ci`) | Trocar import por `prisma/config` |
| `prisma generate` não roda sozinho | Não pedido; checklist cobre | Opcional: `"postinstall": "prisma generate"` |

## 3. Achados de deploy por severidade

**Bloqueia deploy / crítico**
- Build em clone limpo exige `prisma generate` antes: só reportado, coberto no checklist (passo 7).
- `prisma`/`dotenv` em devDependencies quebrariam `migrate deploy` e `prisma.config.js` com `--omit=dev`: **corrigido** (movidos para `dependencies`; `npm ci --omit=dev` em diretório temporário OK, prisma/dotenv/@prisma/config presentes).
- `.env.example` inexistente e ignorado: **corrigido** (criado; `!.env.example` no `.gitignore`; `git check-ignore` confirma que não é ignorado).
- Futuras migrations seriam ignoradas por `*.sql`: **corrigido** (`!prisma/migrations/**/*.sql`). As 18 files de migrations seguem rastreadas, `git check-ignore --no-index` aponta a regra de exceção; `backups/`, `.env`, `.env.local`, `*.sql` avulsos e `*.dump` continuam ignorados.
- 4 rotas de gerenciamento de usuários sem autenticação (listar, alterar-role, desativar, reativar): **precisa de decisão** (recomendo corrigir já; permitem escalar qualquer usuário a GESTOR sem login).
- Seed com credenciais padrão em produção: **corrigido** (aborta com mensagem se faltar `GESTOR_USERNAME`/`GESTOR_SENHA` com `NODE_ENV=production`; não imprime senha em produção; dev inalterado).

**Risco**
- `next@16.3.0` com advisory crítico: precisa de decisão (upgrade).
- Dumps/dados rastreados em `.agents/`: precisa de decisão.
- Cookie `secure` em produção exige HTTPS; sem TLS o login não persiste: só reportado (checklist passo 12).
- Nginx precisa repassar `X-Forwarded-For`/`X-Real-IP` e `client_max_body_size 8m` (Server Actions aceitam 8 MB): só reportado (checklist).
- Rate limit de login em memória: vale só com 1 processo (não usar PM2 cluster): só reportado.
- Server Actions de leitura sem guarda de módulo: precisa de decisão.
- Postgres sem SSL configurado no client: se externo, usar `?sslmode=require`: só reportado.
- Node: **corrigido** (`engines >=20.19`, `.nvmrc` = 22).
- Scripts npm quebrado `test:ccz`: **corrigido** (removido).
- Logs: console.log com nome de usuário, CPF do tutor e payloads removidos (`api/me`, `api/ccz/animais/[id]`, `ccz/FichaTutor`, `ccz/CadastroAnimal`, `ccz/esporotricosePdf`, `page.js`); log "variáveis validadas" só em dev: **corrigido**.
- `src/lib/prisma.js`: logs de query só em `development` (já estava assim); Pool e client agora criados dentro de `createPrismaClient()` e guardados em `globalThis` fora de produção (antes o Pool era recriado a cada reload em dev): **corrigido**.
- 4 rotas API criam o próprio Pool/PrismaClient: só reportado (vai junto com a correção de autenticação).

**Melhoria**
- `.gitattributes` mínimo (`*.sh`, `*.sql`, `*.toml` com LF): **corrigido**. Índice já está 100% LF.
- Headers de segurança ausentes (CSP, HSTS...): só reportado (fazer no Nginx).
- `allowedDevOrigins` com IP de LAN: só dev; só reportado.
- `turbopack.root: process.cwd()`: ok se o build rodar na raiz; só reportado.
- READMEs desatualizados: só reportado.

## 4. Verificação de CAIXA (maiúsculas/minúsculas)

494 referências verificadas (imports relativos, `@/`, `export from`, `import()`, `require`, CSS `@import`), 0 divergentes. 19 referências `/img/...` contra `public/`, 0 divergentes. Nenhuma correção necessária e nenhum arquivo renomeado. (Contagem da auditoria; as remoções desta fase só diminuem o conjunto e o build/lint seguem sem erros de resolução.)

## 5. Rotas/ações sem guarda de autenticação

O `proxy.js` libera `/api/**`; cada rota se protege sozinha.

Rotas API SEM nenhuma guarda (críticas):
- `GET /api/gerenciamento/usuarios/listar`
- `PUT /api/gerenciamento/usuarios/alterar-role`
- `PUT /api/gerenciamento/usuarios/desativar`
- `PUT /api/gerenciamento/usuarios/reativar`

Intencionalmente com autenticação própria: `api/auth/trocar-senha`, `api/me`. Apenas "logado" sem módulo: `api/ubs`.

Server Actions de leitura sem guarda de módulo (exigem só sessão válida via proxy):
- `camara-tecnica/farmacia-judicial/actions.js`: getPacientesJudiciais, getMedicamentosEEstoque, getCatalogoMedicamentos, getCatalogoCompleto, getEstoqueAgrupado, getAjustesEstoque, getMedicamentosDoPaciente, getRelatorioEntradas, getRelatorioSaidas, getRelatorioSaidaPorMedicamento, getDashboardMetrics, buscarPessoaExistente (esta tem guarda segundo a auditoria da junta).
- `regulacao/actions.js`: getPedidosExames, getAuxiliaryData, searchPessoa, searchPessoasAutocomplete.
- `regulacao/procedimentosActions.js`: getProcedimentosData; `junta-reguladora/servicosActions.js`: getServicosData.
- `actions/auth.js: loginAction` é pública por definição.
Removidas nesta fase por serem órfãs: `actions/users.js` (3 funções sem guarda) e `regulacao/actions/auditoria.js`.

## 6. Variáveis de ambiente

| Nome | Obrigatória | Onde é usada |
|---|---|---|
| `DATABASE_URL` | Sim | `prisma.config.js`, `src/lib/prisma.js`, `src/lib/env.js` (valida), 4 rotas de usuários, scripts em `prisma/` |
| `JWT_SECRET` | Sim (≥32 caracteres recomendado) | `src/proxy.js`, `src/app/actions/auth.js`, `api/auth/trocar-senha`, `prisma/check-sessions.js` |
| `DIRECT_URL` | Não | `prisma.config.js` |
| `GESTOR_USERNAME`, `GESTOR_SENHA` | Sim para seed em produção | `prisma/seed.js` |
| `GESTOR_NOME` | Recomendada | `prisma/seed.js` |
| `PORT` | Não (padrão 3000) | `next start` |
| `NODE_ENV` | `production` na VPS | auth (cookie secure), `prisma.js`, `env.js`, `seed.js` |

`GESTOR_CPF` existe no `.env.local` local mas nenhum código a lê (não entrou no `.env.example`).

## 7. CHECKLIST DE DEPLOY NA VPS (Ubuntu/Debian, usuário `deploy`)

```bash
# 1. Pacotes base e firewall
sudo apt update && sudo apt install -y git curl nginx ufw postgresql postgresql-contrib
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable   # não abrir 5432 nem 3000

# 2. Node 22 (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc && nvm install 22 && nvm use 22 && node -v

# 3. PostgreSQL: banco e usuário (troque a senha)
sudo -u postgres psql -c "CREATE USER integra WITH PASSWORD 'SENHA_FORTE';"
sudo -u postgres psql -c "CREATE DATABASE integrasaude OWNER integra;"

# 4. Clonar
sudo mkdir -p /srv/integrasaude && sudo chown $USER /srv/integrasaude
git clone <URL_DO_REPO> /srv/integrasaude && cd /srv/integrasaude && nvm use

# 5. .env (modelo em .env.example)
cp .env.example .env && chmod 600 .env && nano .env
#   NODE_ENV=production, DATABASE_URL, DIRECT_URL, JWT_SECRET (openssl rand -hex 32),
#   GESTOR_USERNAME, GESTOR_NOME, GESTOR_SENHA, PORT=3000

# 6. Dependências e banco
npm ci
npx prisma migrate deploy
npx prisma generate

# 7. Build (precisa do client gerado)
npm run build

# 8. Seed do gestor (aborta se faltar GESTOR_USERNAME/GESTOR_SENHA)
npx prisma db seed

# 9. Processo: systemd (1 instância, por causa do rate limit em memória)
sudo tee /etc/systemd/system/integrasaude.service >/dev/null <<'EOF'
[Unit]
Description=IntegraSaude
After=network.target postgresql.service
[Service]
User=deploy
WorkingDirectory=/srv/integrasaude
EnvironmentFile=/srv/integrasaude/.env
ExecStart=/home/deploy/.nvm/versions/node/v22.x.x/bin/npm run start
Restart=always
[Install]
WantedBy=multi-user.target
EOF
#   ajuste o caminho do npm com: which npm
sudo systemctl daemon-reload && sudo systemctl enable --now integrasaude
#   (alternativa PM2, UMA instância: npm i -g pm2; pm2 start npm --name integrasaude -- start; pm2 save; pm2 startup)

# 10. Nginx (reverse proxy)
sudo tee /etc/nginx/sites-available/integrasaude >/dev/null <<'EOF'
server {
  listen 80;
  server_name SEU_DOMINIO;
  client_max_body_size 8m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF
sudo ln -s /etc/nginx/sites-available/integrasaude /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx

# 11. HTTPS (obrigatório: cookie Secure em produção)
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d SEU_DOMINIO

# 12. Backup diário com cron (pg_dump) - senha via ~/.pgpass (chmod 600)
echo "localhost:5432:integrasaude:integra:SENHA_FORTE" > ~/.pgpass && chmod 600 ~/.pgpass
mkdir -p ~/backups
( crontab -l 2>/dev/null; echo '0 2 * * * pg_dump -h localhost -U integra integrasaude | gzip > $HOME/backups/integrasaude_$(date +\%F).sql.gz && find $HOME/backups -name "*.sql.gz" -mtime +14 -delete' ) | crontab -

# 13. Atualizações futuras
cd /srv/integrasaude && git pull && npm ci && npx prisma migrate deploy && npx prisma generate && npm run build && sudo systemctl restart integrasaude
```

Antes do passo 9, rode `which npm` e use o caminho real no `ExecStart`.

## 8. Lint e build antes / depois

| | Antes (baseline) | Depois |
|---|---|---|
| `npx prisma generate` | OK (v7.9.1) | OK (v7.9.1) |
| `npm run lint` | 0 erros, 5 warnings | 0 erros, 4 warnings (saiu o do `HistoricoPedidoModal`, que foi removido) |
| `npm run build` | OK, 51 páginas | OK (`.next` apagado antes = build limpo), 51/51 páginas, mesmas rotas, `Proxy (Middleware)` presente |
| Dependências | - | `package-lock.json` atualizado com `npm install --package-lock-only` (sem mudar versões; diff só remove pacotes e move `prisma`/`dotenv`); `npm ci --omit=dev --ignore-scripts` em diretório temporário: exit 0, `prisma`, `dotenv` e `@prisma/config` presentes (temp apagado); `npm ls` sem erros (apenas "extraneous" dos pacotes removidos que ainda estão em `node_modules`; `npm prune`/`npm ci` limpa) |
| `node --check prisma/seed.js` | - | OK |

Não executado: `npm ci` completo na pasta do projeto (apagaria `node_modules`), seed contra banco, `migrate deploy` (proibido tocar em dados/SQL).

## 9. Arquivos criados / alterados

Criados: `.env.example`, `.nvmrc`, `.gitattributes`, `.agents/tasks/varredura-deploy/report.md`.

Alterados: `.gitignore`, `package.json`, `package-lock.json`, `prisma/seed.js`, `src/lib/prisma.js`, `src/lib/env.js`, `src/app/page.js`, `src/app/api/me/route.js`, `src/app/api/ccz/animais/[id]/route.js`, `src/app/ccz/CadastroAnimal.js`, `src/app/ccz/FichaTutor.js`, `src/app/ccz/esporotricosePdf.js`.

Removidos: ver seção 1.

Nenhum script temporário ficou no projeto. `schema.prisma`, migrations, `.env*`, Docker/compose, `backups/`, `node_modules/` não foram alterados (`.next` foi apagado e regenerado pelo build).
