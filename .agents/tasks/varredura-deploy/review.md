# Revisão: varredura-deploy (Fase 3)

Veredito: APROVADO. Nenhum bloqueador.

## (a) Remoções
- `git status`: 26 arquivos rastreados removidos, mais a pasta não rastreada `empi-etapa1` (a única `.agents` apagada, como permitido).
- Contraprova: `git grep` em `src`, `public`, `*.mjs`, `*.js` e `*.json` (exceto o lock) pelos nomes de todos os removidos (actions/users, EstoqueMedicamentos, ServicoAtendimento, HistoricoPedidoModal, ModalEdicaoPedido, auditoria, useCrudHandlers, useRegulacaoDataCached, LoadingSpinner, ModalCadastroPaciente, SkeletonLoader, lib/queries, lib/rateLimit, swr, lucide, 6 PNGs, test:ccz, reactCompiler). Nenhuma referência de código vivo. As únicas ocorrências estão em JSON/MD históricos de `.agents/tasks`.
- O build compila sem erro de resolução, o que confirma que nada necessário foi removido.
- Nada da lista "decisão necessária" foi apagado: `.agents/**` (exceto empi-etapa1), `prisma/*.js`, `scripts/*`, `skills-lock.json`, `AGENTS.md`, READMEs, `backups/` e migrations continuam intactos.

## (b) Correções
- Imports e caixa: 494 referências, 0 divergentes (auditoria). Nada a corrigir. O build confirma.
- `.env.example`: só placeholders, sem segredos reais. `git check-ignore -v` mostra a regra `!.env.example`, então não é ignorado. `.env` e `.env.local` seguem ignorados.
- `.gitignore`: `prisma/migrations/new/migration.sql` está liberado pela regra de exceção. `backups/x.sql`, `foo.sql`, `x.dump`, `.env` e `.env.local` seguem ignorados.
- `package.json`: `test:ccz` removido. `engines >=20.19` e `.nvmrc` = 22. `prisma` e `dotenv` passaram para `dependencies`. `lucide-react`, `swr`, `@types/*` e `babel-plugin-react-compiler` foram removidos, sem uso em `src`. `npm ci --dry-run` aceita o lock (consistente).
- `prisma/seed.js`: em `NODE_ENV=production` sem `GESTOR_USERNAME`/`GESTOR_SENHA` sai com `exit(1)`, e a senha não é impressa em produção. O comportamento em dev não mudou.
- `src/lib/prisma.js`: Pool e client criados em `createPrismaClient()`, singleton via `globalThis`, log de query só em `development`.
- Logs removidos nos 6 arquivos listados. O log de `env.js` só aparece em dev.
- `.gitattributes` mínimo (`*.sh`, `*.sql`, `*.toml` com LF).

## (c) Itens protegidos
`git status` não mostra mudanças em `schema.prisma`, migrations, `.env*` (ignorados) nem `docker-compose.yml`. `git diff --cached` está vazio, então não houve `git add`. Também não houve commit (as mudanças estão todas no working tree).

## (d) Relatório
O `report.md` tem as 9 seções exigidas, com checklist de VPS em comandos exatos.

## Verificação própria
- `npm run lint`: 0 erros, 4 warnings, todos pré-existentes (baseline 5 menos o do arquivo removido).
- `npm run build`: OK, 51/51 páginas. As rotas, incluindo as 33 de `/api` e o `Proxy (Middleware)`, batem com o baseline da auditoria.

## Observações não bloqueantes
- As 4 rotas de usuários sem autenticação seguem abertas. Isso foi declarado em "decisão necessária", fora do escopo seguro desta fase. O usuário deve priorizar a correção.
- `.env.example` traz `NODE_ENV=production`. Se alguém copiá-lo para uso local em dev, vai gerar aviso do Next. O comentário do arquivo já orienta o uso na VPS.
