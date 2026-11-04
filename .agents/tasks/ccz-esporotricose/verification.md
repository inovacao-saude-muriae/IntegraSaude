# Verificação — CCZ Esporotricose

Iteração: primeira (não havia `review.json`). Feature implementada do zero conforme o plano.

## 1. Schema Prisma — `npm run db:push` + `npm run db:generate`

### `npm run db:push`
Saída (texto relevante; exit code 1 é esperado — o Prisma imprime "Loaded Prisma
config from prisma.config.js." em stderr, o que faz o PowerShell marcar
NativeCommandError mesmo em sucesso):

```
Prisma schema loaded from prisma\schema.prisma.
Datasource "db": PostgreSQL database "integrasaude", schema "public" at "localhost:5433"
Your database is now in sync with your Prisma schema. Done in 415ms
```

→ **Sucesso** ("Your database is now in sync with your Prisma schema. Done").

### `npm run db:generate`
```
Prisma schema loaded from prisma\schema.prisma.
warn Preview feature "driverAdapters" is deprecated. ...
✔ Generated Prisma Client (v7.9.1) to .\node_modules\@prisma\client in 496ms
```

→ **Sucesso** ("Generated Prisma Client (v7.9.1)"). O warning de `driverAdapters`
é pré-existente (não relacionado a esta feature).

## 2. Conferência das tabelas (psql via docker)

### `\d ccz_esporotricose` — 7 colunas novas presentes
Confirmadas as colunas adicionadas (mantendo `emTratamentoContinuo` e
`profissional_servico_ref` intactos):

- `em_tratamento_veterinario` varchar(10) default 'Não'
- `descricao_tratamento_vet` text
- `ciente_tratamento_continuo` varchar(10) default 'Não'
- `ciente_contencao` varchar(10) default 'Não'
- `ciente_epi` varchar(10) default 'Não'
- `ciente_residuos` varchar(10) default 'Não'
- `condicoes_gerais_ambiente` text

PK `zoonoses_esporotricose_pkey` preservada; FK para `ccz_animais` com
`ON DELETE SET NULL` preservada; nova FK referenciada por
`ccz_esporotricose_visitas` (`ON DELETE CASCADE`).

### `\d ccz_esporotricose_visitas` — tabela criada
```
 id               varchar(50)  not null  (PK)
 esporotricose_id varchar(50)  not null
 data             date         not null
 observacao       text
 created_at       timestamptz(6) default CURRENT_TIMESTAMP
Indexes:
    "ccz_esporotricose_visitas_pkey" PRIMARY KEY btree (id)
    "idx_esporo_visita" btree (esporotricose_id)
Foreign-key:
    esporotricose_id -> ccz_esporotricose(id) ON DELETE CASCADE
```

→ Tabela e índice `idx_esporo_visita` presentes conforme o plano.

## 3. Build de produção — `npm run build`

```
✓ Compiled successfully in 8.9s
    Running TypeScript ...
```

Exit Code: 0 → **Compiled successfully**. Nenhum erro de import, campo Prisma
inválido ou lint-as-error.

## Resumo dos arquivos tocados

- `prisma/schema.prisma` — model `Esporotricose` estendido (+7 campos, relação
  `visitas`); novo model `EsporotricoseVisita`.
- `src/app/ccz/actions.js` — novas actions `salvarEsporotricose`,
  `listarEsporotricose`, `obterEsporotricose`; `getAgendaProcedimentos`
  estendida com eventos `ESPORO_VISITA`.
- `src/app/ccz/CadastroEsporotricose.js` — novo formulário (reusa
  `CadastroAnimal.module.css`).
- `src/app/ccz/EsporotricoseLista.js` — nova lista (reusa `ListaCCZ.module.css`).
- `src/app/ccz/esporotricosePdf.js` — util de PDF (relatório + termo com
  assinaturas tutor/responsável + médico veterinário e data por extenso).
- `src/app/ccz/AgendaCCZ.js` + `AgendaCCZ.module.css` — tipo de evento
  `ESPORO_VISITA` (cor teal + legenda), modal lista visitas esporo, botão
  "Abrir" guardado por `procedimentoId`.
- `src/app/ccz/CadastroAnimal.module.css` — classes novas (checkboxGroup,
  checkboxItem, visitaLista/visitaItem/visitaData/visitaObs, btnRemover).
- `src/app/ccz/page.js` — wiring da aba `ESPOROTRICOSE`.
- `src/components/Sidebar.js` — item "Esporotricose" (nested dropdown) após
  Procedimentos, antes de Agenda.

Módulos não relacionados (Junta, Regulação, Farmácia, Gerenciamento) não foram
tocados. Arquivos de ambiente/git não foram alterados.
