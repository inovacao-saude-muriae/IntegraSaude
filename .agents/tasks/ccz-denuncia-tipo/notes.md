# CCZ — Denúncia em dois tipos (AGRESSIVO / DOENTE)

## Mensagem de commit preparada (NÃO commitada — o usuário commita)

```
feat: separa denúncia CCZ em Animais agressivos e Animais doentes

- Schema: DenunciaCaoAgressivo ganha campo `tipo` VARCHAR(20) NOT NULL
  DEFAULT 'AGRESSIVO' (ccz_denuncias). Nenhum outro model alterado.
- Migration 20261106150000_add_denuncia_tipo (ADD COLUMN, não destrutiva):
  aplicada via `prisma db execute`, marcada com `prisma migrate resolve
  --applied`, `prisma generate` ok. LEMBRETE: migration.sql é git-ignored
  (*.sql) → usar `git add -f` ao commitar.
- Actions: listarDenuncias(tipo) filtra no where; salvarDenuncia grava tipo
  (default AGRESSIVO). Rota GET /api/ccz/denuncias aceita ?tipo=; POST grava
  tipo. CRUD reutilizado (sem CRUD paralelo).
- CadastroDenuncia parametrizado por prop `tipo` (rótulo "Descrição do Cão"
  vs "Descrição do animal"; mesmos campos). DenunciasLista parametrizada por
  `tipo` (título + filtro ?tipo=).
- page.js: tabs DENUNCIA_AGRESSIVO e DENUNCIA_DOENTE, cada uma com subTabs
  LISTA/CADASTRAR (reaproveitando a barra Lista/Novo existente).
- Sidebar: "Denúncias" vira nested dropdown (padrão Zoonoses) com
  "Animais agressivos" e "Animais doentes", ambos visivelSe: "CCZ".

Verificação (rodada neste commit — não re-rodar):
- npm run lint: 0 erros, 5 warnings preexistentes (CadastroTutor,
  FichaCompletaAnimal, login/page, HistoricoPedidoModal, RelatorioAcessos).
- npm run build: sucesso (Next.js 16.3.0).
- DB local (orion_db / integrasaude): coluna `tipo` = VARCHAR NOT NULL
  default 'AGRESSIVO'; 4 denúncias existentes ficaram AGRESSIVO; criada
  denúncia DOENTE e confirmada listagem só no filtro DOENTE (ausente em
  AGRESSIVO); rollback do registro de teste OK.
- prisma migrate status: "Database schema is up to date!" (12 migrations).
```

## Não verificado via navegador
Validação visual com login no navegador não foi feita: não disponho das
credenciais e não as adivinho. A verificação foi feita server-side (coluna,
defaults, criar/listar por tipo com rollback) + lint + build.

## Correção de review (review.json: CHANGES_REQUESTED → findings)

1. **Migration ignorada pelo git** — confirmado via `git check-ignore`:
   `.gitignore:64:*.sql` captura `prisma/migrations/20261106150000_add_denuncia_tipo/migration.sql`,
   que não aparece em `git status`. É lembrete de entrega, não mudança de
   código: ao commitar, usar `git add -f` nesse arquivo (como as migrations
   anteriores). Nenhuma alteração de código necessária.
2. **Destaque do item aninhado some fora da aba Lista** — corrigido em
   `src/components/Sidebar.js`: removido `&subTab=LISTA` dos paths de
   "Animais agressivos" (`/ccz?tab=DENUNCIA_AGRESSIVO`) e "Animais doentes"
   (`/ccz?tab=DENUNCIA_DOENTE`). Agora `nestedQuerySubTab` é null, então o
   item destaca em qualquer sub-aba (igual ao Esporotricose). A aterrissagem
   na aba Lista é preservada porque `page.js` tem DENUNCIA_AGRESSIVO/DOENTE
   em `tabsComLista`, que faz `activeSubTab` cair para "LISTA" quando o
   subTab está ausente.

Verificação desta correção (rodada neste commit — não re-rodar):
- npm run lint: 0 erros, 5 warnings preexistentes (inalterados).
- npm run build: sucesso (Next.js 16.3.0).
- DB não re-validado: esta correção só mexe em paths de menu; schema,
  migration e comportamento de banco não mudaram (já validados no pass anterior).
