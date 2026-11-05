# Registro de incineração no caso de esporotricose (CCZ)

Adiciona ao caso de esporotricose o registro de incineração do animal, independente do encerramento. A ficha (`FichaEsporotricose.js`) ganhou um `<select>` "Não informado / Sim / Não" que persiste inline via uma nova server action `registrarIncineracaoEsporotricose`, o schema ganhou `incinerado` e `dataIncineracao`, uma migration manual foi criada e aplicada via `db execute` + `migrate resolve --applied`, e o card do animal (`AnimaisLista.js`) recebeu um badge de incineração ao lado do badge de Status já existente. A abordagem reaproveita os padrões do módulo: guarda `requireAcessoModulo(MODULOS.CCZ)`, `revalidatePath("/ccz")` e edição inline com `useNotify`.

Watch for: a migration tem timestamp no futuro (`20261106120000`, nov/2026) — inofensivo porque já foi resolvida como applied, mas foge da convenção (possible). O `<select>` da incineração usa estilos inline em vez de CSS Modules; isso está alinhado ao resto dessa ficha, que é toda inline, mas diverge dos selects de formulário do projeto (likely, intencional).

**Verdict**: APPROVED

## High-level view

A persistência fica isolada em `registrarIncineracaoEsporotricose(id, valor)`, com a mesma guarda de acesso das demais edições de esporotricose, allow-list de valores (`"" | "Sim" | "Não"`, qualquer outro vira `""`) e `dataIncineracao` derivada do valor (agora quando "Sim", `null` caso contrário). Não toca em nenhum campo de encerramento, então o botão Encerrar e `handleExcluir` continuam intactos.

O schema recebe exatamente os dois campos pedidos (`incinerado String? @default("") @db.VarChar(20)` e `dataIncineracao DateTime? @db.Timestamptz(6)`), coexistindo com os campos de encerramento (que vieram da tarefa anterior, não desta). A migration manual faz os dois `ADD COLUMN` corretos e foi aplicada pelo fluxo correto para um banco com drift (`db execute` + `migrate resolve --applied` + `generate`), sem `migrate dev`/`reset`.

O badge do card segue uma regra clara para múltiplos casos: "🔥 Incinerado" se qualquer caso for "Sim"; "Não incinerado" se algum for "Não" e nenhum "Sim"; nada quando todos estão em branco. A derivação mora em `listarAnimais` (`esporotricoseIncinerado`) e o badge de Status de esporotricose permanece independente e inalterado.

<details>
<summary>Issues (2)</summary>

1. **Timestamp de migration no futuro** — a pasta `20261106120000_...` usa data de nov/2026; já resolvida como applied, então não quebra nada, mas o ideal seria um timestamp real. Avaliar renomear antes de commitar para não confundir ordenação futura.
2. **Select com estilo inline** — o `<select>` da incineração usa `style={{...}}` em vez de classe CSS Module. Coerente com essa ficha (toda inline), mas diverge dos selects de formulário. Opcional: extrair para o CSS Module se quiser uniformizar.

</details>

<details>
<summary>Details</summary>

### Persistência isolada em `registrarIncineracaoEsporotricose`

A action aplica `requireAcessoModulo(MODULOS.CCZ)` antes de qualquer leitura — a mesma guarda de `encerrarEsporotricose`, `excluirEsporotricose` e das demais edições. Valida `id`, normaliza o valor contra uma allow-list (`["", "Sim", "Não"]`, caindo para `""` em qualquer entrada inesperada, o que fecha a porta para gravar lixo vindo do cliente), confirma que o registro existe e só então grava:

```js
data: {
  incinerado: novoValor,
  dataIncineracao: novoValor === "Sim" ? new Date() : null,
}
```

A `dataIncineracao` é sempre derivada do valor, nunca do cliente, e é limpa quando o estado deixa de ser "Sim". `revalidatePath("/ccz")` garante que o badge do card e a ficha reflitam a mudança. O tratamento de erro espelha o restante do arquivo (401/403 propagados como mensagem, log + mensagem genérica no resto). Nenhum campo de encerramento é lido ou escrito aqui, então o requisito de independência do encerramento está cumprido no nível da persistência.

### Schema e migration

O model `Esporotricose` recebe exatamente os dois campos especificados, sem alterar os demais:

```prisma
incinerado      String?   @default("") @map("incinerado") @db.VarChar(20)
dataIncineracao DateTime? @map("data_incineracao") @db.Timestamptz(6)
```

Os campos `encerrado/dataEncerramento/encerradoPor` que aparecem no mesmo diff vieram da tarefa de encerramento anterior; esta tarefa não os tocou. A migration (`20261106120000_add_esporotricose_incineracao/migration.sql`) faz os dois `ADD COLUMN` corretos com os tipos e default certos:

```sql
ALTER TABLE "ccz_esporotricose" ADD COLUMN "incinerado" VARCHAR(20) DEFAULT '',
ADD COLUMN "data_incineracao" TIMESTAMPTZ(6);
```

O report registra o fluxo correto para um banco com drift: `prisma db execute --file ...` → `migrate resolve --applied ...` → `npx prisma generate`, sem `migrate dev` nem `reset`. A validação direta no banco (script temporário com rollback, depois apagado) confirmou que as colunas existem e que "Sim"/"Não"/"" gravam e leem como esperado, com a data preenchida só no "Sim". O único detalhe é o timestamp no futuro (nov/2026): como a migration já está resolvida como applied, não há efeito prático, mas o nome foge da convenção de timestamps reais.

### Badge no card e regra de múltiplos casos

A derivação está em `listarAnimais`, que agora inclui `incinerado` no `select` dos casos e expõe `esporotricoseIncinerado`:

```js
esporotricoseIncinerado:
  a.esporotricose && a.esporotricose.some((e) => e.incinerado === "Sim") ? "Sim"
  : a.esporotricose && a.esporotricose.some((e) => e.incinerado === "Não") ? "Não"
  : "",
```

"Sim" vence sobre "Não", e ausência de ambos não gera badge — regra sensata quando um animal tem mais de um caso. Em `AnimaisLista.js` o badge de incineração (`badgeDanger` "🔥 Incinerado" / `badgeWarning` "Não incinerado") fica ao lado do badge de Status de esporotricose, que continua derivado de `esporotricoseEncerrada` e não foi alterado. As classes `badgeDanger`/`badgeWarning`/`badgeSuccess` existem no `ListaCCZ.module.css`.

### Ficha: select inline e handlers preservados

`handleIncineracao` segue o padrão de edição inline da ficha: persiste direto (sem `confirm`), recarrega via `obterEsporotricose` e dá feedback com `useNotify` — coerente com as demais interações inline. `obterEsporotricose` passou a devolver `incinerado` e `dataIncineracao`, então o select reflete o estado salvo e a data aparece quando "Sim". O botão "Encerrar caso" e o `handleExcluir` permanecem funcionais no diff. O `<select>` usa estilos inline; essa ficha inteira já é construída com estilos inline (dezenas de `style={{...}}`), então a escolha é internamente consistente, ainda que divirja dos selects de formulário do projeto que usam `styles.field`.

</details>

<details>
<summary>Arquivos alterados</summary>

- `prisma/schema.prisma` — dois campos novos (`incinerado`, `dataIncineracao`) no model `Esporotricose`.
- `prisma/migrations/20261106120000_add_esporotricose_incineracao/migration.sql` — `ADD COLUMN` das duas colunas (novo, ignorado pelo `.gitignore` de `*.sql`).
- `src/app/ccz/actions.js` — nova action `registrarIncineracaoEsporotricose`; `obterEsporotricose` retorna os dois campos; `listarAnimais` deriva `esporotricoseIncinerado`.
- `src/app/ccz/FichaEsporotricose.js` — seção "Incineração do Animal" com `<select>` e handler inline.
- `src/app/ccz/AnimaisLista.js` — badge de incineração ao lado do badge de Status.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff` (também inclui a remoção de zoonoses e o encerramento, de tarefas anteriores).

</details>
