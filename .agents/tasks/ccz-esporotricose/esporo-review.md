# CCZ Esporotricose — vistoria, agenda de acompanhamento, relatório e termo PDF

Adds a new "Esporotricose" sub-feature to the CCZ module, mirroring the existing "Procedimentos" pattern end to end: an extended Prisma model plus a new `EsporotricoseVisita` table, three server actions (`salvarEsporotricose`, `listarEsporotricose`, `obterEsporotricose`), the `getAgendaProcedimentos` extension that pushes `ESPORO_VISITA` events, a client form, a list with Editar/Baixar PDF/Termo actions, a PDF utility (full report + formal signed term), and the page/sidebar wiring. The approach reuses existing CSS modules and the animal-dropdown markup verbatim from `CadastroProcedimento`, so the surface area of genuinely new code is small and consistent with the module. The schema extension is additive — every pre-existing column (including the unused `emTratamentoContinuo` and `profissionalServicoRef`) is left untouched.

Watch for: nothing blocking. The feature's new files are untracked (`git diff main` only shows the 7 modified files; the 3 new files surface via `git status`), which is expected for an uncommitted work tree and not a defect — confirmed confidence. The schema default for `apresentaLesoes` stays `"Sim"` while the form defaults to `"Não"`, but every save path normalizes through `simNao()`, so there is no behavioral inconsistency for records created by this feature — confirmed.

**Verdict**: APPROVED

## High-level view

The schema change is purely additive. The existing `Esporotricose` model gains the seven new fields with correct snake_case `@map` and the `visitas` relation, and a new `EsporotricoseVisita` model carries the `idx_esporo_visita` index and `ccz_esporotricose_visitas` map. The `emTratamentoContinuo`/`profissionalServicoRef` ambiguity was resolved by leaving them in place and unused, exactly as the plan dictated.

Server actions faithfully follow the module's conventions: `requireAcessoModulo(MODULOS.CCZ)` gating, `{success,error?,data?}` returns, 401/403 and P2003 handling, the `ESP-${Date.now().toString(36)}` id pattern, `enc*` persisted as booleans and every other Sim/Não normalized to a string defaulting to "Não". Visits use the junta-style replace pattern inside a `$transaction` (upsert, then `deleteMany` + conditional `createMany`), and are only persisted when `encAcompanhamentoCcz` is set.

The agenda extension adds `ESPORO_VISITA` events alongside the untouched PROCEDIMENTO/RETORNO events, with a distinct teal color, a legend entry, a day-modal row, and — importantly — the "Abrir" button guarded on `e.procedimentoId`, which esporo events deliberately set to null so they never try to open a procedure.

The form defaults every Sim/Não select to "Não", clears dependent fields when the controller leaves "Sim", renders the three tutor-only blocks only when `temTutor`, and reveals the agenda-of-visits sub-section only when the acompanhamento checkbox is checked (clearing the visit list when unchecked). The list filters by animal/tutor/protocolo and exposes Editar/Baixar PDF/Termo. The term PDF carries all filled sections, omits tutor-only blocks without a tutor, and ends with the two signature lines and the Muriaé date-by-extenso line.

<details>
<summary>Issues (0)</summary>

No blocking or actionable issues. The two items in "Watch for" are confirmed non-issues (untracked new files; benign schema-vs-form default divergence that is normalized on save).

</details>

<details>
<summary>Details</summary>

## Schema extension is additive and matches the plan

The `Esporotricose` model gained exactly the seven required fields — `emTratamentoVeterinario`, `descricaoTratamentoVet`, `cienteTratamentoContinuo`, `cienteContencao`, `cienteEpi`, `cienteResiduos`, `condicoesGeraisAmbiente` — each with the snake_case `@map` the plan specified, and the `visitas EsporotricoseVisita[]` relation. The pre-existing `emTratamentoContinuo` (default "Sim") and `profissionalServicoRef` are left in place and unused by the UI, which is the resolution the plan recorded for the `emTratamentoVeterinario` vs `emTratamentoContinuo` ambiguity. The PK map `zoonoses_esporotricose_pkey` and the `onDelete: SetNull` animal relation are unchanged.

The new `EsporotricoseVisita` model carries `id` (uuid, VarChar(50)), `esporotricoseId` (`@map("esporotricose_id")`), `data` (`@db.Date`), `observacao`, `createdAt`, the `onDelete: Cascade` relation, the `@@index([esporotricoseId], map: "idx_esporo_visita")`, and `@@map("ccz_esporotricose_visitas")`. The `verification.md` psql `\d` output confirms the seven columns and the table + index landed in Postgres, and `db:push`/`db:generate` both reported success.

## Save path: validation, normalization, and replace-vínculos transaction

`salvarEsporotricose` validates `animalId` ("Selecione o animal.") and `dataVisita` ("Informe a data da visita."), generates the id with `(id || ESP-${Date.now().toString(36)}).toUpperCase().slice(0,50)`, and additionally verifies the animal exists before writing. Every `enc*` is stored via `Boolean(...)`; every other Sim/Não goes through `simNao()` which collapses anything that isn't exactly "Sim" to "Não". Dependent text fields are nulled unless their controller is "Sim" (e.g. `descricaoLesoes` only persists when `apresentaLesoes === "Sim"`), which keeps the DB clean of stale dependent values even if the client sent them.

The visit replace runs inside `prisma.$transaction`: upsert the record, `deleteMany` the visits, then `createMany` only when `encAcompanhamentoCcz` is set and only for visits with a non-empty parsed date. Unchecking the acompanhamento encaminhamento therefore wipes previously stored visits on the next save, matching the plan's intent. `revalidatePath("/ccz")` fires on success.

## Agenda: new event type is isolated from procedure events

`getAgendaProcedimentos` keeps the PROCEDIMENTO/RETORNO construction intact and appends a second query over `esporotricoseVisita` within the same `inicio`/`fim` window, pushing events with `procedimentoId: null`, `tipoEvento: "ESPORO_VISITA"`, and a `label`. In `AgendaCCZ.js`, `classeEvento` maps the type to `styles.eventEsporo` (teal), a `legEsporo` legend entry is rendered, and the day modal prints "Esporotricose · acompanhamento" plus the optional observação. The "Abrir" button in the modal is now guarded by `onAbrirProcedimento && e.procedimentoId`; because esporo events carry a null `procedimentoId`, they never render the button — this is the specific guard the plan called out, and it reads correctly. The empty-day copy was broadened from "Nenhum procedimento neste dia" to "Nenhum evento neste dia", a sensible consequence of the modal now showing more than procedures.

## Form: defaults, dependent-field clearing, tutor-only gating, agenda reveal

`FORM_VAZIO` defaults every Sim/Não to "Não", `dataVisita` to today, all `enc*` to false, and `visitas` to `[]`. The animal dropdown markup is copied from `CadastroProcedimento` and `selecionarAnimal` sets `animalId`, the display label, and the plan-required `temTutor`/`tutorNome` derived from `a.tutorNome`. `handleCondicional` clears the dependent field when the controller leaves "Sim", and the dependent inputs are additionally `disabled` while the controller isn't "Sim", so the UI and the stored data stay in agreement. The three tutor-only sections (Manejo domiciliar, Outros animais e pessoas, Ciência do responsável) render only inside `{form.temTutor && (...)}`, so without a tutor they are neither shown nor required. `toggleEnc` clears `form.visitas` when `encAcompanhamentoCcz` is unchecked, and the agenda sub-section (date input + "Adicionar" + per-row observação + "Remover") renders only when that checkbox is set.

## PDF: shared report/term builder, tutor-only omission, signatures

`esporotricosePdf.js` has no `"use client"` and is imported by the client list, as planned. A shared `preencherSecoes` builds Identificação, Dados do animal, Dados do tutor (only when `temTutor && tutor`), Condição clínica, Tratamento, the three tutor-only blocks (only when `temTutor`), Avaliação, Encaminhamentos (marked items plus the outras-medidas text), and the agenda of visits (only when `encAcompanhamentoCcz`). `criarDocumento` reuses the FichaAnimal visual language — gray section bar, bold-label `linha` with `splitTextToSize`, and the `if (y > limite) addPage` page-break helper applied before each section and line.

`gerarPdfEsporotricose` adds the blue header "Esporotricose — CCZ" and saves `esporotricose-${data.id}.pdf`. `gerarTermoEsporotricose` renders the "TERMO DE VISTORIA / ESPOROTRICOSE" title, the "Centro de Controle de Zoonoses — Muriaé/MG" subtitle, the full sections (tutor-only omitted without a tutor), the "Muriaé, dd de <mês> de aaaa" line built from `dataVisita` via lowercase `MESES`, and the two centered signature lines "Assinatura do tutor/responsável" and "Assinatura do médico veterinário", with a page break guard before the signature block. Filename is `termo-esporotricose-${data.id}.pdf`. Both signature lines and the date-by-extenso line are present as the spec required.

## List and wiring

`EsporotricoseLista` mirrors `ProcedimentosLista`: columns Animal (bold name + `id · tutor` subtext), Protocolo, Data da visita, Lesões, Nº visitas (via the `visitasCount` badge; the `.badge` class exists in `ListaCCZ.module.css`), and Ações. Search filters by animal name, animal id, tutor, and protocolo. The three action buttons call `onEditar`, `obterEsporotricose` + `gerarPdfEsporotricose`, and `obterEsporotricose` + `gerarTermoEsporotricose`, with a `gerando` flag disabling the PDF/Termo buttons while a document is being produced. `page.js` adds `esporoEdicao`/`carregandoEsporo` state, `editarEsporo`/`voltarListaEsporo`, clears `esporoEdicao` when leaving CADASTRAR, and routes the `ESPOROTRICOSE` tab to list/loading/form exactly as the Procedimentos branch does. `Sidebar.js` inserts the "Esporotricose" nested dropdown after Procedimentos and before the Agenda leaf, leaving the other subItems and icons untouched.

## Scope and unrelated modules

The change touches only CCZ files plus the shared `prisma/schema.prisma` and `src/components/Sidebar.js`. No Junta, Regulação, Farmácia, or Gerenciamento code is modified, and no env or git config files appear in the diff or status. CSS changes are append-only blocks in `CadastroAnimal.module.css` and `AgendaCCZ.module.css`; no existing class was altered.

## Verification evidence

`verification.md` records `db:push` ("Your database is now in sync"), `db:generate` ("Generated Prisma Client (v7.9.1)"), the psql `\d` output for both tables, and `npm run build` ("Compiled successfully", exit 0). Per the review constraints these suites were not re-run; the recorded evidence is complete and internally consistent with the diff.

</details>

<details>
<summary>File map</summary>

- `prisma/schema.prisma` — `Esporotricose` extended (+7 fields, `visitas` relation); new `EsporotricoseVisita` model with index + `@@map`.
- `src/app/ccz/actions.js` — `salvarEsporotricose`, `listarEsporotricose`, `obterEsporotricose`; `getAgendaProcedimentos` extended with `ESPORO_VISITA` events.
- `src/app/ccz/CadastroEsporotricose.js` — new form (reuses `CadastroAnimal.module.css`).
- `src/app/ccz/EsporotricoseLista.js` — new list with Editar/Baixar PDF/Termo.
- `src/app/ccz/esporotricosePdf.js` — PDF utility (full report + signed term).
- `src/app/ccz/AgendaCCZ.js` + `AgendaCCZ.module.css` — `ESPORO_VISITA` rendering, legend, modal row, `procedimentoId`-guarded "Abrir".
- `src/app/ccz/CadastroAnimal.module.css` — appended checkbox-group and visit-list classes.
- `src/app/ccz/page.js` — `ESPOROTRICOSE` tab wiring.
- `src/components/Sidebar.js` — "Esporotricose" nested dropdown after Procedimentos.

Full tracked diff: `git diff main`. New files (`CadastroEsporotricose.js`, `EsporotricoseLista.js`, `esporotricosePdf.js`) are untracked — see `git status`.

</details>
