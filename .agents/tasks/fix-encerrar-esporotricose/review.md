# Restore "Encerrar caso" button in the esporotricose ficha

The regression was that the "Encerrar caso" button vanished from the esporotricose ficha modal. This change restores it in the footer action group, gating it on `!dados.encerrado` so it shows only for open cases, and replaces the old header title with a status badge that reads "Encerrado" (danger) when closed and "Em andamento" (success) when open. The change also carries recently-added work that was already in the uncommitted tree: the incineração `<select>` with its `handleIncineracao` handler wired to `registrarIncineracaoEsporotricose`, and the migration of the excluir flow (and new encerrar flow) from native `alert`/`confirm` to the `useConfirm`/`useNotify` dialogs.

Watch for: nothing blocking. The render condition is correct and in the right place (confirmed). The badge, incineração select, excluir confirm/notify flow, and both new actions are all intact (confirmed).

**Verdict**: APPROVED

## High-level view

The "Encerrar caso" button lives in the footer's right-hand action group (`src/app/ccz/FichaEsporotricose.js:775-784`), wrapped in `{!dados.encerrado && ( ... )}`. The condition is not inverted — the button renders when the case is open — and it sits as a direct sibling of "Gerar Termo" and "Editar", not nested inside the incineração `<select>` or any unrelated conditional. When the case is closed the button is absent and the header badge switches to "Encerrado", which matches the described behavior.

The closed/open state is also surfaced in the modal header as a badge (`:261-265`) plus an "Encerrado em … por …" line in the subtitle (`:271-278`). The incineração `<select>` (`:580-607`) is a separate section driven by `handleIncineracao` → `registrarIncineracaoEsporotricose`, independent of the encerramento gate. The excluir button keeps its await `confirm()`/`notify()` flow (`:81-100`), and both `encerrarEsporotricose` and `registrarIncineracaoEsporotricose` are imported (`:8`) and bound to their handlers. All referenced CSS classes (`btnFicha`, `badgeSuccess`, `badgeDanger`) and the `useConfirm`/`useNotify` hooks exist.

<details>
<summary>Issues (0)</summary>

No actionable issues. All required behavior is present and correct.

</details>

<details>
<summary>Details</summary>

### Render condition for the Encerrar button

The button is in the footer's right action group alongside "Gerar Termo" and "Editar" (`src/app/ccz/FichaEsporotricose.js:775-795`):

```jsx
<div style={{ display: 'flex', gap: '0.5rem' }}>
  {!dados.encerrado && (
    <button
      type="button"
      className={styles.btnFicha}
      onClick={handleEncerrar}
      disabled={encerrando}
    >
      {encerrando ? "Encerrando..." : "Encerrar caso"}
    </button>
  )}
  <button ... onClick={() => setMostrandoTermo(true)}>Gerar Termo</button>
  <button ... onClick={...}>Editar</button>
</div>
```

The gate is `!dados.encerrado`, so the button shows when the case is open (`encerrado === false`/falsy) and disappears when `encerrado === true` — matching the requirement exactly, not inverted. It is a direct sibling of the other footer buttons, not nested inside the incineração select (which is a separate `<section>` in the modal body, `:579-608`) or any other conditional. The `disabled={encerrando}` plus the "Encerrando..." label give the in-flight feedback.

`handleEncerrar` (`:39-60`) awaits `confirm(...)`, calls `encerrarEsporotricose(esporotricoseId)`, then on success notifies and re-fetches via `obterEsporotricose` so the ficha re-renders with `encerrado === true` — which both removes the button and flips the badge without a full reload.

### Encerrado badge and header state

The header title carries the badge (`:261-265`):

```jsx
<span className={dados.encerrado ? styles.badgeDanger : styles.badgeSuccess} ...>
  {dados.encerrado ? "Encerrado" : "Em andamento"}
</span>
```

Both classes resolve in `ListaCCZ.module.css` (`badgeSuccess` :333, `badgeDanger` :353). The subtitle adds "Encerrado em {dataEncerramento} por {encerradoPor}" only when closed (`:271-278`), fed by the fields `encerrarEsporotricose` writes (`actions.js:1773-1779`: `encerrado`, `dataEncerramento`, `encerradoPor`). Note the badge says "Encerrado"/"Em andamento" while the original user request #2 mentioned a table status of "em andamento" when not closed — the ficha badge is consistent with that wording.

### Incineração select intact

The `<select>` section (`:579-608`) is wired to `handleIncineracao` (`:63-77`), which calls `registrarIncineracaoEsporotricose(esporotricoseId, valor)` and re-fetches on success. It is disabled while `salvandoIncineracao` is true and shows the incineration date when `incinerado === "Sim"`. The server action validates the value against `["", "Sim", "Não"]` and sets/clears `dataIncineracao` accordingly (`actions.js:1807-1824`), independent of the encerramento state as intended.

### Excluir confirm/notify flow intact

`handleExcluir` (`:81-100`) now awaits `confirm({ title, message, confirmText: "Excluir" })`, bails on cancel, and uses `notify({ tipo, message })` for both success and error, replacing the former native `alert`/`confirm`. The success path still calls `onFechar()` and `window.location.reload()`. `useConfirm`/`useNotify` are imported from `@/components/ConfirmDialog` (`:9`) and both hooks exist there (`ConfirmDialog.js:128`, `:145`).

### Actions imported and bound

`encerrarEsporotricose` and `registrarIncineracaoEsporotricose` are both added to the import from `./actions` (`:8`) and both are defined as server actions (`actions.js:1755`, `:1799`). `encerrarEsporotricose` refuses to re-close an already-closed case (`actions.js:1766-1768`), so the UI gate and server guard agree.

### Lint/build/visual

Per the task, lint, build, and the dev server were not re-run here; the coder's record is the source of truth for those results. The diff introduces no new imports beyond the two actions and the existing `ConfirmDialog` hooks, and no new libraries.

</details>

<details>
<summary>File map</summary>

- `src/app/ccz/FichaEsporotricose.js` — restored "Encerrar caso" button gated on `!dados.encerrado`; added status badge + encerramento subtitle; added incineração select + `handleIncineracao`; migrated excluir and new encerrar flows to `useConfirm`/`useNotify`.

Full diff: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff -- src/app/ccz/FichaEsporotricose.js`

</details>
