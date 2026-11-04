# Aba "Pacientes" (tela geral de Pessoas) na Junta Reguladora

Adiciona um item "Pacientes" ao submenu da Junta Reguladora, ao lado do Dashboard, que renderiza a tela compartilhada de cadastro de Pessoas (`CadastroPessoas`) já usada em Gerenciamento, Regulação e Farmácia Judicial. A implementação é um wrapper fino (`junta-reguladora/PacientesTab.js`) análogo aos de Regulação e Farmácia, um novo `tab` `PESSOAS` no switch da página da Junta, e um item no `Sidebar.js` gateado pelo mesmo mecanismo `PESSOAS_ACESSO`. O controle de acesso replica `requireAcessoPessoas` (GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN) nas três camadas: visibilidade de menu, gate de conteúdo via `podeGerenciarPessoas` injetado pelo `JuntaPermProvider`, e as server actions já protegidas. Nenhum CRUD paralelo é criado — tudo reaproveita o componente e as actions compartilhadas.

Watch for: nenhum concern bloqueante no código. Único ponto aberto é a ausência de um registro de lint/build do coder para esta tarefa (possible) — não há commit nem nota; a mudança não foi verificada por build e as instruções proíbem re-executar as suítes.

**Verdict**: APPROVED

## High-level view

O wrapper da Junta espelha o padrão da Farmácia Judicial: consome a flag `podeGerenciarPessoas` do contexto do módulo e, se falsa, cai em `AcessoNegadoModulo`; caso contrário renderiza `<CadastroPessoas />` sem props. Usa a mesma tela e actions compartilhadas, sem duplicar UI ou persistência.

O novo identificador de aba é `tab: "PESSOAS"`, roteado por `searchParams.get("tab")` como as demais abas de topo da Junta (incluindo Dashboard). Não colide com nenhum identificador existente (`CADASTRO`, `SERVICOS`, `SERVICOS_ESPECIALIDADES`, `RELATORIO`, `DASHBOARD`) e é deliberadamente distinto de `CADASTRO`, que é o cadastro de paciente da Junta (`PacienteJunta`, model diferente de `Pessoa`).

As três camadas de permissão são fiéis a `requireAcessoPessoas` e não afrouxam o acesso. O `PESSOAS_ACESSO` do Sidebar e o `podeGerenciarPessoas` do layout usam a mesma expressão booleana `GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN`; nenhuma inclui `JUNTA` simples nem `FARMACIA`, de forma que a tela não aparece para perfis que não a acessariam no Gerenciamento. As server actions permanecem guardadas por `requireAcessoPessoas` — nada foi alterado nelas.

A única lacuna é de verificação: não há commit nem nota de coder para esta tarefa registrando o resultado de lint/build, então não é possível confirmar que a suíte passou sem re-executá-la (proibido pelas instruções).

<details>
<summary>Issues (1)</summary>

1. **Sem registro de lint/build (possible)** — não existe commit nem nota do coder para `junta-pacientes` com o resultado da suíte; a mudança não tem verificação registrada. Confirmar que o coder rodou lint/build antes de encerrar, ou anexar o log. Não bloqueante dado que a mudança é um espelho aditivo de módulos já revisados e funcionais.

</details>

<details>
<summary>Details</summary>

## Reaproveitamento do componente compartilhado, sem CRUD paralelo

`junta-reguladora/PacientesTab.js` é um wrapper fino sobre `@/components/CadastroPessoas/CadastroPessoas`. Lê `podeGerenciarPessoas` de `usePermissoesJunta()` e, quando falso, retorna `<AcessoNegadoModulo modulo="Cadastro de Pessoas" />`; caso contrário renderiza `<CadastroPessoas />` sem props. Isso é byte-a-byte equivalente ao wrapper da Farmácia Judicial, trocando apenas o hook de contexto (`usePermissoesFarmaciaJudicial` → `usePermissoesJunta`).

O componente `CadastroPessoas` não aceita props (`export default function CadastroPessoas()`), então "as mesmas props dos outros wrappers" se traduz em nenhuma prop em todos os três — Regulação, Farmácia e Junta chamam `<CadastroPessoas />` igual. Toda a persistência vem de `@/app/gerenciamento/pessoas/actions` (`listarPessoas`, `criarPessoa`, `atualizarPessoa`, `excluirPessoa`, `listarUbs`), as mesmas actions importadas pela tela de Gerenciamento. Não há segunda fonte de UI nem de dados.

Nota de assimetria entre wrappers (informativa, não é defeito desta tarefa): o wrapper de Regulação (`regulacao/PacientesTab.js`) não tem gate de conteúdo próprio — apenas retorna `<CadastroPessoas />`. Junta e Farmácia adicionam o gate `podeGerenciarPessoas` + `AcessoNegadoModulo`. A Junta seguiu o padrão mais estrito (Farmácia), que é o correto; a defesa final em qualquer caso continua sendo o `requireAcessoPessoas` nas actions.

## Identificador de aba `PESSOAS` não colide

A página da Junta deriva `activeTab = searchParams.get("tab") || "CADASTRO"`. As abas de topo existentes tratadas no corpo são `DASHBOARD`, `CADASTRO`, `SERVICOS`, `SERVICOS_ESPECIALIDADES` e `RELATORIO`. O novo bloco `{activeTab === "PESSOAS" && <PacientesTab />}` adiciona um ramo independente; não há `case`/`switch` que caia por fallthrough, então nenhum ramo existente é afetado. O comentário no código deixa explícito que `PESSOAS` é distinto de `CADASTRO` (paciente da Junta, model `PacienteJunta`) — exatamente a separação de modelos que a tarefa exigia.

No Sidebar, o item é `{ name: "Pacientes", tab: "PESSOAS", visivelSe: "PESSOAS_ACESSO" }`, declarado como subItem de topo da Junta ao lado de "Dashboard" (`tab: "DASHBOARD"`). Usa `tab`, não `subTab`, coerente com o roteamento da Junta por `tab`. (O `subTab` da Junta é usado apenas pelo grupo nested "Serviços": CAEE/APAE/etc.) Logo não há risco de o item ser confundido com um sub-serviço nem de o filtro de `nestedItems` atingi-lo — ele é um leaf de topo, filtrado pela Camada 1 (`subItemVisivel`).

## Três camadas de permissão espelham `requireAcessoPessoas`

A fonte da verdade é `lib/auth.js::requireAcessoPessoas`:

```
GESTOR ∨ usuarioEhAdminModulo(REGULACAO) ∨ usuarioEhAdminModulo(JUNTA)
```

Camada (a) — menu. O novo case no `construirMenu` do Sidebar:

```
case "PESSOAS_ACESSO":
  return ehGestor || ehAdminMod("REGULACAO") || ehAdminMod("JUNTA");
```

Mesma expressão. Fail-closed preservado (o `default` do switch retorna `false`).

Camada (b) — conteúdo. No `junta-reguladora/layout.js`:

```
const podeGerenciarPessoas =
  (await usuarioEhGestor(ctx.user)) ||
  (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO)) ||
  ehAdminJunta; // = usuarioEhAdminModulo(JUNTA)
```

Idêntica à de Farmácia e a `requireAcessoPessoas`. É injetada via `JuntaPermProvider` (`PermissoesJuntaContext` agora carrega `podeGerenciarPessoas`, default `false` — fail-closed sem provider). O wrapper consome e cai em `AcessoNegadoModulo` quando falso.

Camada (c) — actions. Nenhuma alteração em `gerenciamento/pessoas/actions.js`: as cinco actions continuam chamando `await requireAcessoPessoas()` na primeira linha. A Junta não introduziu actions próprias de Pessoa. Não houve afrouxamento.

Nenhuma das três camadas inclui `JUNTA` simples (operador) nem `FARMACIA`. Um perfil que não veria a tela no Gerenciamento também não a vê aqui — requisito "não expor a tela a perfil que não a acessaria no Gerenciamento" atendido.

## Ausência de registro de verificação

Não há diretório `.agents/tasks/junta-pacientes` pré-existente com nota de coder, nem commit correspondente (as mudanças estão todas em working tree não commitado; o último commit é `chore: relatorios dos workflows`). As instruções mandam ler o resultado de lint/build que o coder registrou e não re-executar as suítes — mas não há tal registro para esta tarefa. Consequência: não é possível afirmar que lint/build passaram. A mudança é aditiva e espelha módulos já revisados (Regulação/Farmácia têm reviews APPROVED nas pastas de tasks), o que mantém o risco baixo, mas o gap de verificação fica registrado.

## Restrições respeitadas

Nenhuma alteração em `prisma/schema.prisma`, migrations ou arquivos `.env*` aparece no diff/status. Nenhuma dependência nova (os imports usam libs e módulos já presentes). CSS Modules mantido — `CadastroPessoas` traz seu próprio `CadastroPessoas.module.css`, e nenhum `.module.css` da Junta foi tocado para esta aba. Nenhum trabalho não commitado foi desfeito; não houve `git add/commit/push`.

</details>

<details>
<summary>Arquivos alterados (escopo Junta)</summary>

- `src/app/junta-reguladora/PacientesTab.js` (novo) — wrapper fino que gateia por `podeGerenciarPessoas` e renderiza `<CadastroPessoas />`.
- `src/app/junta-reguladora/page.js` — importa `PacientesTab` e adiciona o ramo `activeTab === "PESSOAS"`.
- `src/app/junta-reguladora/layout.js` — calcula `podeGerenciarPessoas` e passa ao `JuntaPermProvider`.
- `src/app/junta-reguladora/PermissoesJuntaContext.js` — adiciona `podeGerenciarPessoas` ao contexto/provider (default `false`).
- `src/components/Sidebar.js` — item "Pacientes" (`tab: "PESSOAS"`, `visivelSe: "PESSOAS_ACESSO"`) no submenu da Junta e novo case `PESSOAS_ACESSO`.
- `src/components/CadastroPessoas/CadastroPessoas.js` (+ `.module.css`) (novos, compartilhados) — componente único de UI consumido pelos três wrappers.

Fora do escopo desta tarefa, presentes no mesmo working tree: mudanças de Regulação e Farmácia Judicial (wrappers/contexts/layout/page) e remoção de `regulacao/UsuariosTab.js` e `gerenciamento/pessoas/Pessoas.module.css`. Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff` e `git status`.

</details>
