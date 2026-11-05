# Farmácia Judicial opens on Dashboard by default

Clicking "Farmácia Judicial" in the sidebar was landing on the Pacientes/Novo Processo screen instead of the Dashboard. The nested submenu lists "Novo Processo" (`subTab=PACIENTES`) first and "Dashboard" (`subTab=DASHBOARD`) last, and both the sidebar navigation (`toggleNested` picked `nestedItems[0]`) and the page default (`requestedSubTab || "PACIENTES"`) keyed off the first item. The fix targets both layers: `toggleNested` now finds the `DASHBOARD` nestedItem before falling back to index 0, and the page default resolves to `DASHBOARD`. The submenu ordering is untouched, so Pacientes stays where it was in the list. Only `Sidebar.js` and `farmacia-judicial/page.js` were modified.

Watch for: nothing blocking. The sidebar fix is scoped to `toggleNested` (the path exercised for Farmácia Judicial since its module click only expands the nested dropdown), and the page-level default is the authoritative fallback for direct URLs — both now resolve to DASHBOARD (confirmed).

**Verdict**: APPROVED

## High-level view

The bug had two independent entry points and the fix addresses both. When a user clicks "Farmácia Judicial", the parent module click only expands the group (its first subItem is a nestedDropdown), so the real navigation happens in `toggleNested`, which previously pushed `nestedItems[0]` — "Novo Processo" (PACIENTES). It now prefers the `DASHBOARD` nestedItem and keeps `nestedItems[0]` only as a fallback for other nested dropdowns that have no Dashboard entry. The CCZ nested dropdowns (Esporotricose/Denúncias) use `path`-based items with no `subTab === "DASHBOARD"`, so they keep their existing first-item behavior.

The page component is the second layer. For a sidebar module link (`tab=FARMACIA_JUDICIAL`), `activeTab` was `requestedSubTab || "PACIENTES"` and is now `requestedSubTab || "DASHBOARD"`. This is both the fallback when the sidebar sends no subTab and the direct-URL default, so even a bare `?tab=FARMACIA_JUDICIAL` lands on the Dashboard. The two layers agree.

The remaining tabs resolve unchanged: the render block still switches on DASHBOARD, PACIENTES, PESSOAS, MEDICAMENTOS, DISPENSACAO, ESTOQUE (with SALDO/ENTRADA/CADASTRAR subStates) and RELATORIOS, and the submenu order (Novo Processo, Medicamentos, Estoque, Dispensação, Relatórios, Pacientes, Dashboard) is preserved.

The constraint about not reverting the CCZ `useConfirm` work is satisfied trivially: there are no uncommitted CCZ/Procedimentos/Animais/Tutor source changes in the working tree. The only CCZ artifact present is an untracked `.agents/tasks/ccz-fix-confirm/` review directory, which is review metadata, not code.

<details>
<summary>Issues (1)</summary>

1. **No CCZ code in working tree (informational)** — the "don't revert CCZ `useConfirm` work" constraint references changes that aren't present as uncommitted source. If that work was expected to be in the working tree, confirm it was already committed on a prior step; nothing here touches or reverts it, so no action for this fix.

</details>

<details>
<summary>Details</summary>

### Two resolution layers, both redirected to DASHBOARD

The module click for Câmara Técnica never navigates directly, because its first subItem (`Farmácia Judicial`) is an `isNestedDropdown`. The module toggle only expands. Navigation for Farmácia Judicial therefore flows entirely through `toggleNested`, which builds the URL from a chosen nestedItem:

```js
const primeiro =
  sub.nestedItems?.find((n) => n.subTab === "DASHBOARD") ||
  sub.nestedItems?.[0];
...
router.push(`${base}?tab=${sub.tab}&subTab=${primeiro.subTab}`);
```

For Farmácia Judicial this resolves to `?tab=FARMACIA_JUDICIAL&subTab=DASHBOARD`. The `.find` is gated on `subTab === "DASHBOARD"`; the CCZ nested dropdowns use `path`-based items (`/ccz?tab=...`) with no matching `subTab`, so they fall through to `nestedItems?.[0]` exactly as before. The full-query-string branch (`base.includes('?tab=') && base.includes('&subTab=')`) is also unaffected.

The page component is the authoritative fallback. `isSidebarModuleLink` is true when `tab=FARMACIA_JUDICIAL`, and `activeTab` is now `requestedSubTab || "DASHBOARD"`. This covers both the sidebar link (which now always sends `subTab=DASHBOARD`) and a direct `?tab=FARMACIA_JUDICIAL` with no subTab. The two layers agree on DASHBOARD, so the fix is robust whether entry is via menu click or a stale/partial URL.

### Submenu ordering and other tabs preserved

The nestedItems array is unchanged — Novo Processo (PACIENTES), Medicamentos, Estoque, Dispensação, separator, Relatórios, Pacientes (PESSOAS, gated by `PESSOAS_ACESSO`), Dashboard. The task required Pacientes to stay where it is in the menu; it does. The render switch in the page still handles every tab: DASHBOARD, PACIENTES (PacientesJudiciais/Novo Processo), PESSOAS (PacientesTab), MEDICAMENTOS, DISPENSACAO, the three ESTOQUE subStates keyed on `activeSubTab`, and RELATORIOS. None of these branches changed, so the other tabs resolve as before once selected.

One asymmetry worth noting, not a regression: a `PESSOAS_ACESSO`-less user won't see the Pacientes nestedItem (it's filtered by `construirMenu`), but that gating predates this change and the DASHBOARD `.find` is independent of it, so the default still resolves to Dashboard for every FARMACIA profile.

</details>

<details>
<summary>File map</summary>

- `src/components/Sidebar.js` — `toggleNested` now prefers the `DASHBOARD` nestedItem over `nestedItems[0]` when building the subgroup's initial URL; comment added explaining the Farmácia Judicial intent.
- `src/app/camara-tecnica/farmacia-judicial/page.js` — module-link `activeTab` default changed from `PACIENTES` to `DASHBOARD`.

Full diff: `git diff` (2 files, +8/−3). CCZ/Procedimentos/Animais/Tutor source: untouched (verified via `git status`/`git diff --name-only`).

</details>
