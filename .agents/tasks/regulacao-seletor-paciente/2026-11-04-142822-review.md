# Regulação Novo Pedido adopts shared SeletorPaciente for patient search

The inline table-dropdown in `NovoPedido.js` (its own `isOpen`/`useRef`/click-outside, local filtering, and the `noDataTd` / "Nenhum paciente encontrado." / "Buscando pacientes..." strings) is replaced by the shared `SeletorPaciente` component, so Regulação now gets the same focus-to-open empty table, "Nenhuma pessoa encontrada." message, bold name, masked CPF, `dd/mm/aaaa` dates, hover/selection, debounce and a11y as Junta / CCZ Tutor / Farmácia Judicial. `SeletorPaciente` was extended with an optional controlled contract (`texto` / `onTextoChange` / `buscar` / `buscaAtiva` / `cpfSelecionado` / `minCaracteres`) whose defaults keep the original `value`/`onSelect` mode intact. Patient selection in Regulação still routes through the untouched `handleSelectPatientSuggestion` hook, so every dependent field continues to populate.

Watch for: the new `if (!p) return handleClear()` guard added to Junta and Farmácia (confirmed) is not cosmetic — the component already called `onSelect(null)` on edit, so this guard repairs a latent null-deref rather than changing contract. CadastroTutor was rewritten (not just contract-adjusted) to consume the shared component (likely belongs to the prior ccz-tutor task); traced as behavior-preserving but larger than "íntegro" implies.

**Verdict**: APPROVED

## High-level view

Selection wiring in Regulação is preserved end to end. `NovoPedido.handleSelectPerson` now just forwards the chosen pessoa to `handleSelectPatientSuggestion` (and ignores `null`), and that hook in `useRegulacaoData.js` — which is not in the diff — still sets `patientSearch`, `patientName`, `motherName`, `cpf`, `cns`, `susCard`, `sexo`, `dataNascimento`, `telefone`, `ubsReferencia`, `ubsResponsavelId` and the full address block. The old NovoPedido handler's extra `setNewRequest({ patientSearch })` was dropped safely because the hook already sets `patientSearch`; no field is lost.

The empty-on-focus requirement is met by construction: focus only flips `dropAberto`, while results are fetched only on change past `minCaracteres` (2). So focusing shows the header row plus "Nenhuma pessoa encontrada." until the user types. In Regulação the `buscar` source is the local `auxData.pessoas` list (same source as before), filtered by name / mother / clean-CPF.

`SeletorPaciente`'s extension is backward compatible. `texto === undefined` selects the original uncontrolled mode used by Junta and Farmácia, so those two files keep passing only `value`/`onSelect` and behave as before. The date formatter now parses ISO strings textually instead of `new Date(...).toLocaleDateString()`, which removes the timezone shift the task called out. Request races are guarded with a sequence ref, and the debounce timer is cleared on unmount and on selection.

The two consumer edits to Junta and Farmácia are a single defensive line each (`if (!p) return handleClear()`). This is required by the component's existing behavior of emitting `onSelect(null)` when a selected name is edited; without the guard the old handlers would dereference `p`. CadastroTutor is a full rewrite onto the shared component — functionally traced as equivalent across its leitura/edição/novo modes, but it is a much larger change than the task's "continuam íntegros" wording suggests and most likely lands here from the sibling ccz-tutor task.

No prohibited changes: the diff touches no `prisma/schema.prisma`, migrations or `.env*`, and nothing was staged/committed/stashed/reset as part of this work.

<details>
<summary>Issues (3)</summary>

1. **CadastroTutor is a rewrite, not a contract tweak** — the file was substantially rewritten to consume `SeletorPaciente` (removed local `termo`/`pessoas`/`dropAberto`/`dropdownRef` and the inline table). Traced as behavior-preserving, but confirm it is intended to ride along in this task vs. the prior ccz-tutor task before shipping.
2. **Junta/Farmácia onSelect(null) guard** — the added `if (!p) return handleClear()` is correct and fixes a latent null-deref, but verify `handleClear` fully resets the same state the old flow reset (it does: clears pessoa/form and dependent lists). Confirmed present in both files.
3. **Regulação dropdown lists all pessoas once typing starts** — `buscarPessoas('')` returns the entire `auxData.pessoas` list; harmless because fetch only runs after `minCaracteres` on change, but worth a glance if `auxData.pessoas` can grow large (client-side filter, no pagination). Possible.

</details>

<details>
<summary>Details</summary>

### Selection still populates every dependent field

The task's primary concern is that selecting a patient keeps filling CPF/CNS, SUS card, UBS and quota rules. In the new code `NovoPedido.handleSelectPerson` reduces to:

```js
const handleSelectPerson = (pessoa) => {
  if (!pessoa) return;
  handleSelectPatientSuggestion(pessoa);
};
```

`handleSelectPatientSuggestion` lives in `useRegulacaoData.js`, which is absent from the diff (confirmed via `git diff --stat`), and still performs the full population:

```js
setNewRequest((prev) => ({
  ...prev,
  patientSearch: pessoa.nomeCompleto,
  patientName: pessoa.nomeCompleto,
  motherName: pessoa.nomeMae || "",
  cpf: pessoa.cpf, cns: pessoa.cns || "", susCard: pessoa.cns || "",
  sexo: pessoa.sexo || "", dataNascimento: pessoa.dataNascimento || "",
  telefone: pessoa.telefone || "",
  ubsReferencia: pessoa.ubsReferencia || "",
  ubsResponsavelId: pessoa.ubsReferenciaId ? String(pessoa.ubsReferenciaId) : "",
  cep, logradouro, numero, complemento, bairro, cidade, uf, ...
}));
```

The old NovoPedido handler additionally did `setNewRequest({ patientSearch: pessoa.nomeCompleto })`; dropping it is safe because the hook already sets `patientSearch`. Quota rules key off `cpf`, which is still set. No `setFormData`/field was lost (confirmed).

### Controlled-vs-uncontrolled contract keeps Junta/Farmácia intact

`SeletorPaciente` chooses its mode by `const controlado = texto !== undefined`. Junta and Farmácia still pass only `value={pessoa}` + `onSelect={handleSelectPessoa}` (confirmed), so `texto` is `undefined`, `controlado` is false, and the component keeps its own `termoInterno`, syncs from `value.nomeCompleto`, and emits `onSelect(null)` when the name is edited away from the selection — exactly the prior behavior. Regulação and CCZ pass `texto`/`onTextoChange` and own the field text. Defaults (`buscar = buscarPadrao`, `buscaAtiva = true`, `minCaracteres = 2`) reproduce the original API-backed behavior, so the contract extension is backward compatible (confirmed).

### Empty-on-focus and the "Nenhuma pessoa encontrada." path

Focus runs `onFocus={() => buscaAtiva && !disabled && setDropAberto(true)}` and nothing else; `agendarBusca` only fires from `handleChange`. With `resultados` initially `[]`, `mostrarDropdown` renders the header row and the single `semDados` cell showing "Nenhuma pessoa encontrada." (or "Buscando pessoas..." while `buscando`). This matches the required click/focus-opens-empty-table behavior across all four modules (confirmed).

### Date formatting avoids the timezone bug

The task explicitly flags the `dd/mm/aaaa` "sem bug de fuso" requirement. The old item rendered `new Date(paciente.dataNascimento).toLocaleDateString()`, which shifts by timezone for date-only values. The replacement parses textually:

```js
const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
```

and also passes through values already in `dd/mm/aaaa`, falling back to the em dash. No `Date` object is constructed, so the shift is gone (confirmed).

### Debounce, race protection, and lifecycle

`agendarBusca` clears any pending timer, increments a sequence ref (`reqRef`), and applies results only when `req === reqRef.current`, so a slow earlier request cannot overwrite a newer one. The debounce timer is cleared on unmount and `handleSelect` cancels pending work and bumps the ref before applying the selection. Switching `buscaAtiva` to false closes the dropdown and clears the timer. These address the stale-result and double-fetch failure modes (confirmed).

### Consumer guard against onSelect(null)

Junta and Farmácia each gain one line: `if (!p) return handleClear();`. Because `SeletorPaciente` already calls `onSelect(null)` when a selected name is edited, the pre-existing `handleSelectPessoa(null)` would have dereferenced `p` (e.g. `p.tipoDeficiencia`, `p.cpf`). The guard routes `null` to the existing `handleClear`, which resets pessoa/form/dependent lists (confirmed both files). This is a backward-compatible fix, not a contract change.

### CadastroTutor rewrite

`CadastroTutor.js` is the largest consumer change: it removes local `termo`/`pessoas`/`buscando`/`dropAberto`/`dropdownRef`, the click-outside effect, and the inline table, replacing them with `<SeletorPaciente buscaAtiva={!editavel} texto={form.nomeCompleto} .../>`. In edit mode (`buscaAtiva={false}`) the component degrades to a plain input whose `handleChange` updates `form.nomeCompleto` and returns early — matching the old `editavel` branch. In leitura mode it searches via `buscarPessoasCCZ` and selects through `selecionarPessoa`. Traced as behavior-preserving across novo/edição/leitura, but this is a rewrite rather than the "altered only by the new backward-compatible contract" the task describes, and most plausibly originates in the sibling ccz-tutor task (likely).

### Not tested

No automated tests accompany the change (none exist for these components). Not verified by this review: the actual rendered timezone output against real DB date strings, and the quota-rule recomputation after selection (depends on `cpf`, which is confirmed set, but the downstream quota effect was not traced). Per instructions, lint/build were not re-run here.

</details>

<details>
<summary>File map</summary>

- `src/components/SeletorPaciente.js` — extended with controlled contract (`texto`/`onTextoChange`/`buscar`/`buscaAtiva`/`cpfSelecionado`/`minCaracteres`), table dropdown, timezone-safe date, race/debounce guards, a11y roles.
- `src/components/SeletorPaciente.module.css` — dropdown restyled as sticky-header table (`.tabela`, `.linha`, `.linhaSelecionada`, `.semDados`); removed `.dropdownHeader`/`.dropdownItem` styles.
- `src/app/regulacao/NovoPedido.js` — removed inline dropdown/state; renders `SeletorPaciente` in controlled mode; `handleSelectPerson` forwards to `handleSelectPatientSuggestion`.
- `src/app/ccz/CadastroTutor.js` — rewritten to consume `SeletorPaciente` (controlled, `buscaAtiva={!editavel}`).
- `src/app/ccz/CadastroTutor.module.css` — minor styling for the seletor field.
- `src/app/junta-reguladora/CadastroPacienteJunta.js` — one line: `if (!p) return handleClear()`.
- `src/app/camara-tecnica/farmacia-judicial/PacientesJudiciais.js` — one line: `if (!p) return handleClear()`.
- Other files in `git status` (docs, docker-compose, scripts, auth, usuarios, many ccz lists) are pre-existing unrelated changes, out of scope for this review.

Full diff: `git -C "c:/Users/Jefinny/Documents/10. IntegraSaude" diff`.

</details>
