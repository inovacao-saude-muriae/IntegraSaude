# Reabrir caso de esporotricose (CCZ) — 2ª passada

**Veredito**: APPROVED

Passada anterior bloqueou (B1) por ausência de evidência de execução. O coder respondeu com `verificacao.md`: declarou explicitamente a impossibilidade da verificação visual e registrou verificação server-side da action com rollback nos casos nomeados. O código continua correto. O bloqueador está resolvido por evidência nova; não há bloqueadores remanescentes.

## Verificação do código (reconfirmada no fonte)

### 1. actions.js — `reabrirEsporotricose` (correto)

`src/app/ccz/actions.js:1794-1835`:

- Mesma guarda de `encerrarEsporotricose`: `requireAcessoModulo(MODULOS.CCZ)`. ✔
- Guard de estado: retorna erro se `!registro.encerrado`. ✔
- `update { encerrado:false, dataEncerramento:null, encerradoPor:null }` — limpa exatamente os 3 campos de encerramento. ✔
- NÃO toca em `incinerado`/`dataIncineracao`. ✔ (incineração intacta ao reabrir)
- `revalidatePath("/ccz")` — mesmo revalidate das actions irmãs (encerrar/excluir usam o mesmo `revalidatePath("/ccz")` único). ✔
- Tratamento de erro 401/403 espelhando as demais actions. ✔
- Sem alteração de schema/migrations. ✔

### 2. FichaEsporotricose.js — import, handler e rodapé (correto)

- Import de `reabrirEsporotricose` adicionado à linha de import de `./actions`. ✔
- `handleReabrir` (`:62-83`) espelha `handleEncerrar`: `confirm({ title: "Reabrir caso de esporotricose", confirmText: "Reabrir" })`, chama `reabrirEsporotricose(esporotricoseId)`, usa `notify`, recarrega via `obterEsporotricose`. ✔
- Rodapé em if/else (`:798-816`): `!dados.encerrado` → "Encerrar caso"/"Encerrando..."; `dados.encerrado` → "Reabrir caso"/"Reabrindo...", `onClick={handleReabrir}`, mesma classe `styles.btnFicha`. ✔
- Demais botões (Baixar Ficha, Excluir, Gerar Termo, Editar) e o `<section>` de incineração com `handleIncineracao` intactos. ✔

### 3. Badge e linha "Encerrado em…" (correto)

Badge usa `dados.encerrado ? "Encerrado" : "Em andamento"`; linha de encerramento é condicional em `dados.encerrado && dados.dataEncerramento`. Como a action limpa ambos, após reabrir o badge volta a "Em andamento" e a linha some. ✔

### 4. Sem libs novas

Nenhuma dependência nova. `useConfirm`/`useNotify` de `@/components/ConfirmDialog` já existiam. Estilo preservado. ✔

## Evidência de execução (B1 resolvido)

`verificacao.md` fornece, conforme o fallback previsto na tarefa:

- **Declaração explícita** de que a verificação visual via browser não foi possível (ficha é modal client-side em `/ccz` sem rota dedicada; senha de login em bcrypt indisponível; sem automação de browser). Isso satisfaz a exigência de "na impossibilidade declarada".
- **Verificação server-side com rollback** contra o Postgres local, replicando o SELECT de `obterEsporotricose` (`encerrado: Boolean(r.encerrado)` — o valor que decide o botão) e o `update` de `reabrirEsporotricose`:
  - ESP-MW2CPCOZ ("Joaquim"): inicial `encerrado=true` → rodapé renderiza "Reabrir caso"; após reabrir `encerrado=false`, `dataEncerramento=null`, `encerradoPor=null`; incineração intacta (`incinerado="Sim"`, data inalterada). ✔
  - ESP-MVSKI0NO: `encerrado=false` → rodapé renderiza "Encerrar caso". ✔
  - Rollback restaurou o estado original de ESP-MW2CPCOZ (confirmado por `psql` direto). ✔
- `npm run lint` → Exit 0; `npm run build` → Exit 0, compilado com sucesso.
- Script temporário `scripts/verify-reabrir.mjs` removido (confirmado: não existe no workspace).

A evidência cobre exatamente os casos e asserts que a tarefa exigiu, incluindo a não-alteração da incineração. Risco do bug anterior ("o botão não aparece") mitigado: o caminho de render depende de `encerrado` vir do banco, e isso foi exercitado nos dois casos reais.

## Bloqueadores

Nenhum.
