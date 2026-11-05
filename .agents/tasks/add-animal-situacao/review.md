# Campo de situação do animal (Adotado / Devolvido / CCZ) no módulo CCZ

Adiciona ao model `Animal` (tabela `ccz_animais`) um campo `situacao` com quatro estados: vazio (`""` = "Não informado"), `Adotado`, `Devolvido` e `CCZ` (permanece sob custódia). A mudança percorre todas as camadas: schema Prisma + migration ADD COLUMN não destrutiva, um `<select>` nos formulários de cadastro e edição, as actions de create/update/list carregando o valor com default `""`, e um badge no card do animal que só aparece quando a situação foi informada. O valor é validado no servidor contra uma whitelist, então qualquer entrada fora das quatro opções vira `""`. A mesma `salvarAnimal` atende criação e edição via `upsert`, de modo que o campo é persistido nos dois fluxos sem código duplicado.

Watch for: a migration vive em `prisma/migrations/.../migration.sql`, que está coberta pela regra `*.sql` do `.gitignore` e não aparece em `git status` — confirmado (likely) que o arquivo existe em disco conforme o fluxo autorizado, mas ele não entrará num commit sem `git add -f`.

**Verdict**: APPROVED

## High-level view

O schema ganhou apenas `situacao String? @default("") @map("situacao") @db.VarChar(20)` no model `Animal`, imediatamente após `possuiResponsavel`, seguindo o mesmo padrão de coluna opcional com default. Nenhum outro model ou campo foi tocado nesse diff; a única outra alteração no schema é a remoção de `numeroProtocolo` do model `Esporotricose`, que pertence à tarefa autorizada de remoção de protocolo e não é regressão.

A persistência é centralizada em `salvarAnimal`, que usa `upsert` — o objeto `dadosAnimal` com `situacao` alimenta tanto `create` quanto `update`, cobrindo cadastro e edição com uma validação server-side por whitelist que rebaixa qualquer valor inesperado para `""`. As leituras (`obterAnimal`, `listarAnimais`) devolvem `situacao` com fallback `""`, então o card e o formulário de edição recebem o valor consistentemente.

Na UI, o `<select>` usa `value=""` para "Não informado" e está ligado ao estado via `atualizar("situacao", ...)`, tanto no cadastro quanto na edição (o form é inicializado a partir de `animalInicial`). O badge no card renderiza só quando `a.situacao` é truthy, mapeando Adotado→verde, Devolvido→âmbar e CCZ→azul, reusando a estrutura de badge já existente; a única adição de estilo é `.badgeInfo`, um pill azul sóbrio simétrico aos `.badgeSuccess`/`.badgeWarning`/`.badgeDanger`.

A migration é um `ALTER TABLE ADD COLUMN ... DEFAULT ''` não destrutivo, coerente com o tipo e default do schema. O único ponto de atenção é que o arquivo está sob a regra `*.sql` do `.gitignore`.

<details>
<summary>Issues (2)</summary>

1. **Migration gitignorada** — `prisma/migrations/20261106140000_add_animal_situacao/migration.sql` casa com a regra `*.sql` do `.gitignore`, então não entra em commit sem `git add -f`. Como o fluxo autorizado é `db execute` + `migrate resolve --applied` (sem `migrate dev`), isso não bloqueia a aplicação, mas o arquivo de migration não ficará versionado junto com as migrations existentes (que estão rastreadas). Confirmar se é intencional. (likely)
2. **`@map("situacao")` redundante** — o nome do campo já é igual ao nome da coluna, então o `@map` é desnecessário (os demais campos só usam `@map` para snake_case). É inofensivo e está escrito verbatim na tarefa, mas destoa levemente da convenção do schema. (confirmed, nit)

</details>

<details>
<summary>Details</summary>

### Schema e migration

O campo foi inserido no model `Animal` logo após `possuiResponsavel`:

```prisma
situacao               String?                @default("") @map("situacao") @db.VarChar(20)
```

Tipo opcional, default `""`, `@db.VarChar(20)` — tudo conforme o pedido. O `@map("situacao")` é tecnicamente redundante porque o nome do campo coincide com o da coluna; os outros campos do model só usam `@map` quando há diferença (`possui_responsavel`, `qual_tratamento`). É uma nit estilística e, como o texto da tarefa especifica esse `@map` literalmente, foi mantido. Nenhum outro campo ou model foi alterado neste arquivo além da remoção de `numeroProtocolo` em `Esporotricose`, que é da tarefa de protocolo.

A migration é não destrutiva e bate com o schema:

```sql
ALTER TABLE "ccz_animais" ADD COLUMN "situacao" VARCHAR(20) DEFAULT '';
```

O arquivo está em `prisma/migrations/20261106140000_add_animal_situacao/migration.sql`. `git check-ignore` confirma que a regra `*.sql` (linha 64 do `.gitignore`) o cobre, então ele não aparece em `git status` nem será commitado por `git add` comum. As migrations antigas (`20261028...`, etc.) estão rastreadas via `git ls-files`, provavelmente adicionadas antes da regra ou com `-f`. Para manter a nova migration versionada no mesmo padrão seria preciso `git add -f`. Dado o fluxo autorizado (`db execute` + `migrate resolve --applied`, sem `migrate dev`/`reset`), a aplicação ao banco não depende disso.

### Persistência unificada no upsert

`salvarAnimal` monta `dadosAnimal` com a situação validada e persiste via `upsert`:

```js
situacao: ["Adotado", "Devolvido", "CCZ"].includes(dados.situacao)
  ? dados.situacao
  : "",
```

```js
await tx.animal.upsert({
  where: { id },
  update: dadosAnimal,
  create: { id, ...dadosAnimal },
});
```

O mesmo objeto alimenta `create` e `update`, então criação e edição persistem `situacao` sem divergência. A whitelist server-side é um bom padrão: garante o contrato do dropdown independentemente do que chegar do cliente e normaliza qualquer coisa inesperada para `""`, que é exatamente o estado "Não informado". `obterAnimal` e `listarAnimais` devolvem `situacao: a.situacao || ""`, mantendo o fallback consistente na leitura.

### Select no cadastro e na edição

O `<select>` em `CadastroAnimal.js` usa a opção vazia como "Não informado" e está ligado ao estado:

```jsx
<select
  value={form.situacao}
  onChange={(e) => atualizar("situacao", e.target.value)}
  disabled={camposDesabilitados}
>
  <option value="">Não informado</option>
  <option value="Adotado">Adotado</option>
  <option value="Devolvido">Devolvido</option>
  <option value="CCZ">CCZ</option>
</select>
```

`FORM_VAZIO` recebeu `situacao: ""` e o form é inicializado com `animalInicial || FORM_VAZIO`. Como `obterAnimal`/`listarAnimais` entregam `situacao`, o fluxo de edição pré-popula o select com o valor salvo. O componente é o mesmo para cadastro e edição (distinguidos por `animalInicial?.id`), então o campo cobre os dois cenários pedidos. O `disabled={camposDesabilitados}` acompanha o comportamento dos outros campos do formulário.

### Badge condicional no card

Em `AnimaisLista.js` o badge só renderiza quando `a.situacao` é truthy — string vazia não produz badge nenhum, atendendo ao requisito de "nada quando ''":

```jsx
{a.situacao && (
  <span className={
    a.situacao === "Adotado" ? styles.badgeSuccess
    : a.situacao === "Devolvido" ? styles.badgeWarning
    : styles.badgeInfo
  }>
    {a.situacao}
  </span>
)}
```

A estrutura (`animalCardRow` → `infoLabel` → `animalCardBadges` → `span` com classe de badge + `title`) é idêntica à usada pelos badges de esporotricose/incineração logo abaixo, então o visual fica coerente. A única adição de CSS é `.badgeInfo`, um pill azul (`#dbeafe`/`#1e40af`/borda `#93c5fd`) construído exatamente como `.badgeSuccess`, `.badgeWarning` e `.badgeDanger` (mesmo padding, raio 999px, 0.75rem, peso 600). Cores sóbrias e distintas: verde para Adotado, âmbar para Devolvido, azul para CCZ. O `title` dá contexto extra ("Permanece no CCZ (sob custódia)") para o estado CCZ.

### Trabalho preexistente intacto

O diff carrega, além da situação, a remoção de `numeroProtocolo` (schema, route de relatórios, `FichaCompletaAnimal`, `FichaEsporotricose`, actions, PDFs) e a reformulação visual da Visita Inicial/cores de fonte na `FichaEsporotricose` — tudo pertencente às tarefas autorizadas de esporotricose (remoção de protocolo, visita inicial igual às demais, fontes em preto). Nenhuma dessas alterações foi desfeita ou danificada pela adição de `situacao`; as mudanças são ortogonais (arquivos e trechos distintos). `package.json` e `package-lock.json` estão sem modificação — nenhuma lib nova foi adicionada.

### Cobertura de testes

Não há testes automatizados adicionados para `situacao`. O projeto não aparenta ter suíte de testes para estas server actions/componentes, e a instrução foi explícita em não reexecutar suítes. Não testado: persistência end-to-end do campo, render condicional do badge por estado, normalização da whitelist para valores fora do contrato.

</details>

<details>
<summary>Arquivos alterados</summary>

- `prisma/schema.prisma` — campo `situacao` no model `Animal`; (também) remoção de `numeroProtocolo` de `Esporotricose` (tarefa de protocolo).
- `prisma/migrations/20261106140000_add_animal_situacao/migration.sql` — ADD COLUMN não destrutivo (arquivo gitignorado por `*.sql`).
- `src/app/ccz/CadastroAnimal.js` — `situacao` em `FORM_VAZIO` e `<select>` ligado ao estado.
- `src/app/ccz/actions.js` — `situacao` em `obterAnimal`, `salvarAnimal` (whitelist + upsert) e `listarAnimais`; (também) remoção de `numeroProtocolo`.
- `src/app/ccz/AnimaisLista.js` — badge condicional de situação no card.
- `src/app/ccz/ListaCCZ.module.css` — nova classe `.badgeInfo`.
- `src/app/ccz/CadastroEsporotricose.js`, `FichaCompletaAnimal.js`, `FichaEsporotricose.js`, `esporotricosePdf.js`, `historicoAnimalPdf.js`, `api/gerenciamento/relatorios/route.js` — mudanças das tarefas de esporotricose (protocolo/visita inicial/fontes), fora do escopo desta tarefa.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff`
</details>
