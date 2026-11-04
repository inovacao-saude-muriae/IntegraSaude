# Regulação: troca da aba "Usuários" por "Pacientes" via componente compartilhado de Cadastro de Pessoas

A aba "Usuários" recém-adicionada à Regulação foi removida por completo e substituída por uma aba "Pacientes" que replica a tela de Cadastro de Pessoas do Gerenciamento. Em vez de copiar a UI, o trabalho extraiu a tela inteira de `gerenciamento/pessoas/page.js` para um componente compartilhado em `src/components/CadastroPessoas/`, consumido por um wrapper fino tanto no Gerenciamento quanto na nova `PacientesTab.js` da Regulação — espelhando o precedente `GerenciarUsuarios` já usado na base. O CRUD de pessoa (server actions existentes) é reutilizado sem backend paralelo, e a regra de acesso (GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN) foi replicada nas três camadas sem afrouxar nada.

Watch for: a verificação visual no navegador não foi feita por restrição de ambiente (sem credenciais, sem servidor de longa duração) — confirmed; a validação ficou por build + inspeção de código. O gate client-side da aba (`podeGerenciarPessoas`) é apenas UX; a fronteira real de segurança são as actions com `requireAcessoPessoas()` — confirmed, está fail-closed.

**Verdict**: APPROVED

## High-level view

A remoção da aba Usuários é limpa e completa: nenhuma referência a `UsuariosTab`, à tab `"USUARIOS"` ou a `podeGerenciarUsuarios` sobra no módulo Regulação, e o Gerenciamento de usuários (`GerenciarUsuarios`, `/gerenciamento/usuarios`, rotas de API) fica intacto porque nunca dependia da Regulação.

A aba Pacientes segue o padrão `ProcedimentosTab` (import + bloco `activeTab` em `page.js` + item no Sidebar), mas vai um passo além: a UI foi extraída para `src/components/CadastroPessoas/CadastroPessoas.js`, e tanto `gerenciamento/pessoas/page.js` quanto `regulacao/PacientesTab.js` viraram wrappers de uma linha. Uma única fonte de UI, consumindo as mesmas actions de `@/app/gerenciamento/pessoas/actions`.

A permissão replicada é idêntica à do Gerenciamento de pessoas (GESTOR ∨ admin de REGULACAO ∨ admin de JUNTA) e aparece coerente nas três camadas: `case "PESSOAS_ACESSO"` no Sidebar, `podeGerenciarPessoas` calculada no `regulacao/layout.js` e injetada via provider, e `requireAcessoPessoas()` nas actions. A regra não foi afrouxada em nenhuma camada.

Nenhuma mudança não relacionada foi desfeita e schema/migrations/.env/dados não foram tocados; o diff fica restrito aos sete arquivos esperados mais os novos componentes.

<details>
<summary>Issues (1)</summary>

1. **Verificação visual ausente** — a navegação autenticada (Regulação sem "Usuários", com "Pacientes"; CRUD funcional; Gerenciamento intacto) não foi validada em runtime por restrição de ambiente. Não bloqueia: o enforcement de role é server-side nas actions e foi verificado por código e build. Se possível, rodar uma passada manual no navegador antes do deploy.

</details>

<details>
<summary>Details</summary>

### Remoção da aba Usuários — sem resíduos

`src/app/regulacao/UsuariosTab.js` foi deletado. Em `regulacao/page.js` o import de `UsuariosTab` e o bloco `activeTab === "USUARIOS"` deram lugar aos equivalentes de Pacientes; o diff é cirúrgico e não encosta em nenhuma outra aba. `regulacao/layout.js` perdeu a flag `podeGerenciarUsuarios` e `PermissoesRegulacaoContext.js` deixou de expô-la (o contexto agora carrega `podeEditarFinanceiro`, `podeGerenciarCatalogo`, `podeGerenciarPessoas`). O item "Usuários" (`visivelSe: "GESTOR"`) saiu do dropdown "Regulação" do Sidebar.

Um grep por `UsuariosTab|USUARIOS|podeGerenciarUsuarios` em `src/**` não retorna nenhuma ocorrência no módulo Regulação — confirmed. Os demais hits (`GerenciarUsuarios`, `/gerenciamento/usuarios`, `/api/gerenciamento/usuarios/*`, `AdminUsuariosPage`) pertencem ao Gerenciamento de usuários, que é recurso independente e permanece intacto: `gerenciamento/usuarios/page.js` renderiza `GerenciarUsuarios` e seu layout exige `usuarioEhGestor`. A extração da tela de usuários para `src/components/GerenciarUsuarios` não foi mexida.

### Aba Pacientes e extração para componente compartilhado

`CadastroPessoas.js` é o corpo integral da antiga `PessoasPage` (mesmo estado, mesma busca estilo "Novo Pedido", mesmo form, mesmo modal de exclusão), com o import das actions reapontado para o caminho absoluto `@/app/gerenciamento/pessoas/actions`. O CSS foi movido para `CadastroPessoas.module.css` — conteúdo idêntico ao antigo `Pessoas.module.css` (a única diferença detectada na comparação é uma quebra de linha final; nenhuma regra alterada). Não restou nenhuma referência pendente ao `./Pessoas.module.css` removido.

```
gerenciamento/pessoas/page.js ─┐
                               ├─> <CadastroPessoas />  ──> actions (CRUD Pessoa)
regulacao/PacientesTab.js  ────┘      (@/app/gerenciamento/pessoas/actions)
```

Ambos os wrappers são `"use client"` e renderizam `<CadastroPessoas />` sem props — o que é correto porque o componente é autossuficiente (busca UBS e pessoas no mount). `PacientesTab` fica mais fino que `ProcedimentosTab`, mas segue o mesmo contrato de montagem via `activeTab`; a diferença é consequência de a UI ter sido promovida a componente compartilhado, abordagem explicitamente permitida pela tarefa e preferível ao copiar/colar.

### Reuso do CRUD sem backend paralelo

`listarPessoas`, `listarUbs`, `criarPessoa`, `atualizarPessoa`, `excluirPessoa` continuam em `gerenciamento/pessoas/actions.js` e são as únicas consumidas pelo componente compartilhado. Nenhuma action nova foi criada para a Regulação. Cada action chama `requireAcessoPessoas()` no início e trata `error.status === 401/403` devolvendo `{ success:false }`, de modo que o enforcement vale igual para os dois pontos de consumo.

### Permissão replicada nas três camadas

A guarda de origem é `requireAcessoPessoas()` em `lib/auth.js`: `usuarioEhGestor ∨ usuarioEhAdminModulo(REGULACAO) ∨ usuarioEhAdminModulo(JUNTA)`. `gerenciamento/pessoas/layout.js` usa exatamente essa combinação. A réplica na Regulação bate linha a linha:

- Sidebar: novo `case "PESSOAS_ACESSO"` → `ehGestor || ehAdminMod("REGULACAO") || ehAdminMod("JUNTA")`, e o item "Pacientes" usa `visivelSe: "PESSOAS_ACESSO"`.
- Conteúdo: `regulacao/layout.js` calcula `podeGerenciarPessoas` com a mesma expressão e injeta via `RegulacaoPermProvider`; `page.js` renderiza `AcessoNegadoModulo` quando a flag é falsa.
- Actions/rotas: inalteradas, já protegidas por `requireAcessoPessoas()`.

Nenhuma camada afrouxou a regra. O gate client-side é defesa de UX; a barreira efetiva são as actions server-side, e elas são fail-closed (contexto nulo ou sem vínculo → 403). Vale notar que a aba Usuários anterior exigia só GESTOR; Pacientes abre também para admins de REGULACAO e JUNTA — isso é correto, pois é a regra do cadastro de pessoas que a tarefa mandou replicar, não a da aba antiga.

### Escopo do diff

`git diff --stat` lista apenas os sete arquivos esperados (os quatro da Regulação, o Sidebar, e os dois do Gerenciamento afetados pela extração) mais os novos `PacientesTab.js` e `src/components/CadastroPessoas/`. Nada de SeletorPaciente, Supabase, lint, docker-compose ou schema/migrations/.env aparece no diff — nenhuma mudança não relacionada foi desfeita.

### Verificação

Pelo log do coder (não reexecutado): `npm run lint` com 0 erros e os 5 warnings preexistentes (CadastroTutor, FichaCompletaAnimal, login, HistoricoPedidoModal, RelatorioAcessos — nenhum nos arquivos tocados); `npm run build` compilou no Next 16.3.0 com `/regulacao` e `/gerenciamento/pessoas` presentes. 

Não testado: navegação autenticada no browser (ausência de "Usuários" e presença de "Pacientes" na Regulação, CRUD funcional lado a lado com o Gerenciamento, comportamento do gate por perfil em runtime). A ausência está declarada no relatório e justificada por restrição de ambiente; a checagem de role foi validada server-side por código e build.

</details>

<details>
<summary>File map</summary>

- `src/app/regulacao/UsuariosTab.js` — removido (aba Usuários).
- `src/app/regulacao/PacientesTab.js` — novo; wrapper que renderiza `CadastroPessoas`.
- `src/app/regulacao/page.js` — swap import/bloco `USUARIOS`→`PACIENTES`; flag `podeGerenciarPessoas`.
- `src/app/regulacao/layout.js` — remove `podeGerenciarUsuarios`; adiciona `podeGerenciarPessoas` (regra do cadastro de pessoas).
- `src/app/regulacao/PermissoesRegulacaoContext.js` — troca a flag no contexto/provider.
- `src/components/Sidebar.js` — item "Pacientes" com `PESSOAS_ACESSO`; novo case de visibilidade.
- `src/components/CadastroPessoas/CadastroPessoas.js` + `.module.css` — novos; tela compartilhada extraída de pessoas.
- `src/app/gerenciamento/pessoas/page.js` — vira wrapper fino de `CadastroPessoas`.
- `src/app/gerenciamento/pessoas/Pessoas.module.css` — removido (migrado para o componente compartilhado).

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff` (mais arquivos untracked em `src/app/regulacao/PacientesTab.js` e `src/components/CadastroPessoas/`).

</details>
