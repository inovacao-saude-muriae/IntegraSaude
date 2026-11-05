# Verificação — Reabrir caso de esporotricose (CCZ)

Responde ao bloqueador **B1** do review.json (CHANGES_REQUESTED): "sem evidência de que a mudança foi exercitada".

## Código (já implementado na iteração anterior, reconfirmado nesta)

- `src/app/ccz/actions.js` — action `reabrirEsporotricose(id)` (≈ linhas 1796–1835):
  mesma guarda `requireAcessoModulo(MODULOS.CCZ)`, guard "este caso não está encerrado",
  `update { encerrado:false, dataEncerramento:null, encerradoPor:null }`, `revalidatePath("/ccz")`.
  NÃO toca em `incinerado`/`dataIncineracao`.
- `src/app/ccz/FichaEsporotricose.js`:
  - import de `reabrirEsporotricose` (linha 8);
  - `handleReabrir` (linhas 63–84) espelha `handleEncerrar` (confirm title "Reabrir caso de esporotricose",
    message "Deseja reabrir este caso? Ele voltará para Em andamento.", confirmText "Reabrir",
    reutiliza o estado `encerrando` → label "Reabrindo...", recarrega via `obterEsporotricose`);
  - rodapé em if/else (linhas ~798–816): `!dados.encerrado` → "Encerrar caso"; senão → "Reabrir caso"
    (`onClick={handleReabrir}`, `className={styles.btnFicha}`, disabled={encerrando}).
  - demais botões (Baixar Ficha, Excluir, Gerar Termo, Editar) e o bloco de incineração intactos.

## Lint / Build

- `npm run lint` → Exit 0. 0 erros, 5 warnings preexistentes (CadastroTutor, FichaCompletaAnimal,
  login/page, HistoricoPedidoModal, RelatorioAcessos). Nenhum nos arquivos tocados.
- `npm run build` → Exit 0. "Compiled successfully", TypeScript OK, 48 páginas geradas.

## Verificação por execução (server-side, com rollback)

Verificação VISUAL via browser não foi realizada: a ficha é um modal client-side renderizado dentro de
`/ccz` (não há rota dedicada), o login usa senha bcrypt cujo texto-plano não está disponível, e este
ambiente não dispõe de automação de browser para dirigir o clique. Isso é declarado EXPLICITAMENTE,
conforme o fallback previsto na tarefa.

Em vez disso, exercitei o caminho real contra o Postgres local (`orion_db`, banco integrasaude, porta 5433),
com script temporário `scripts/verify-reabrir.mjs` (usando o mesmo `PrismaPg`/`Pool` do app) — já apagado.
O script replica (a) o SELECT de `obterEsporotricose` que mapeia `encerrado: Boolean(r.encerrado)` — exatamente
o valor que decide qual botão o rodapé renderiza — e (b) o `update` de `reabrirEsporotricose`, com asserts e rollback.

Resultado (todos os asserts passaram):

- ESTADO INICIAL
  - `ESP-MW2CPCOZ` (animal "Joaquim"): encerrado=true, dataEncerramento=2026-11-05T16:07:28.891Z,
    encerradoPor="Administrador IntegraSaúde", incinerado="Sim", dataIncineracao=2026-11-05T17:40:36.652Z
    → rodapé renderiza **"Reabrir caso"** ✔
  - `ESP-MVSKI0NO`: encerrado=false → rodapé renderiza **"Encerrar caso"** ✔
- APÓS REABRIR (`ESP-MW2CPCOZ`)
  - encerrado=**false**, dataEncerramento=**null**, encerradoPor=**""/null** → rodapé volta a "Encerrar caso",
    badge do topo volta a "Em andamento", linha "Encerrado em… por…" some (condicional em dataEncerramento) ✔
  - incineração **intacta**: incinerado="Sim", dataIncineracao inalterada ✔
- ROLLBACK: re-encerrado com os valores originais; estado final idêntico ao inicial, confirmado também por
  `psql` direto no container (encerrado=t, data/por/incineração originais). ✔

## Estado em que o caso de teste foi deixado

`ESP-MW2CPCOZ` permanece EXATAMENTE como estava antes (encerrado=true, incinerado="Sim", datas/responsável
originais). `ESP-MVSKI0NO` não foi alterado. Nenhum dado de teste persistido. Script temporário apagado.
