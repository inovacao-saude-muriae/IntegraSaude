# Rótulo e valor inline no Relatório de Acompanhamento de esporotricose

A mudança reposiciona, nos dois componentes do CCZ que exibem o "Relatório de Acompanhamento" de esporotricose, o valor de cada campo para a mesma linha do rótulo, logo após os dois pontos (ex.: "Profissional: Jefinny"), em vez de o valor cair na linha de baixo. O rótulo continua em negrito e o valor passa a peso normal. É puramente apresentação: nenhuma condição de exibição, campo, action ou schema foi alterado. Em `FichaEsporotricose.js` o ajuste é feito via `style` inline em cada `<strong>` (`display: "inline"`, `marginBottom: 0`) e trocando os blocos `<p>` dos textos longos por `<span>` com separador `{" "}`; em `FichaCompletaAnimal.js` o grid já era inline e só o campo "Responsável:" precisou de correção, resolvida com uma regra CSS nova e escopada `.relatorioProf strong`.

Watch for: (confirmed) o campo "Encaminhamentos:" em `FichaEsporotricose.js` continua com rótulo em bloco seguido de lista de bullets — mas é um agregado de itens, não um par rótulo:valor, então está fora do escopo da tarefa. (confirmed) o diretório da tarefa não contém notas de lint/build/verificação visual do coder; não foi possível ler resultados registrados.

**Verdict**: APPROVED

## High-level view

O comportamento inline foi aplicado de duas formas distintas e ambas corretas. Em `FichaEsporotricose.js` cada rótulo recebe `style={{display: "inline", marginBottom: 0}}`, o que vence a regra herdada `.relatorioBox strong { display: block }` que era justamente o que empurrava o valor para a linha de baixo; os textos longos (Descrição das lesões, Medicamentos atuais, Observações gerais, Próxima visita sugerida) deixaram de usar `<p>` em bloco e passaram a `<span>` inline logo após o rótulo, de modo que o valor fica ao lado dos dois pontos e quebra naturalmente.

Em `FichaCompletaAnimal.js` os campos do grid já estavam inline (`<div><strong>Label:</strong> valor</div>`) graças a `.relatorioDetalhesGrid strong { display: inline }`, então não precisaram mudar. O único campo que caía em duas linhas era "Responsável:", porque o `<strong>` herdava `.relatorioBox strong { display: block }`; a correção adiciona `<strong>` ao rótulo e uma regra CSS nova `.relatorioProf strong { display: inline }`, usada em um único lugar no código, sem risco de afetar outros usos do module.

Os badges de Evolução e Adesão permanecem na mesma linha do rótulo: ambos continuam dentro do mesmo `<div>`, com o `<span>` do badge logo após o `<strong>` e `marginLeft` de espaçamento. A lógica de cor dos badges e todas as condições de exibição (`emTratamento === "Sim"`, `apresentaLesoes === "Sim"`, `necessidadeNovaVisita === "Sim"`, etc.) estão intactas.

As demais mudanças não commitadas (encerramento/reabrir, incineração, remoção de Zoonoses, submenu, abas de Pacientes) aparecem no mesmo working tree, mas a tarefa de layout não as desfez nem as tocou: continuam presentes no `git status` e, dentro de `FichaEsporotricose.js`, o código de encerrar/reabrir/incineração convive intacto ao lado dos ajustes de apresentação.

<details>
<summary>Issues (2)</summary>

1. **Notas do coder ausentes** — o diretório `.agents/tasks/esporotricose-relatorio-inline/` não tinha registro de lint/build/verificação visual. Não bloqueia (mudança é CSS/layout verificável pelo diff), mas vale anexar a verificação visual antes de encerrar.
2. **Campo "Encaminhamentos" permanece em bloco** — em `FichaEsporotricose.js` o rótulo "Encaminhamentos:" continua acima de uma lista de bullets. É um agregado, não um par rótulo:valor; está fora do escopo da tarefa e não requer ação.

</details>

<details>
<summary>Details</summary>

### Inline via style nos rótulos de FichaEsporotricose

A regra herdada `.relatorioBox strong { display: block; margin-bottom: 0.5rem }` é o que, antes, fazia o valor pular para a linha seguinte dos campos simples. A correção aplica `style={{display: "inline", marginBottom: 0}}` em cada `<strong>`, que vence a regra do module por especificidade de inline style. Vale para Profissional, Data do relatório, Lesões, Evolução, Tratamento, Adesão, Isolamento, EPI e Higienização.

Para os textos potencialmente longos, o padrão trocou de

```jsx
<strong style={{fontSize: "0.875rem"}}>Medicamentos atuais:</strong>
<p style={{margin: "0.25rem 0 0", ...}}>{visita.relatorio.medicamentosAtuais}</p>
```

para

```jsx
<strong style={{display: "inline", fontSize: "0.875rem", marginBottom: 0}}>Medicamentos atuais:</strong>{" "}
<span style={{fontSize: "0.875rem", color: "#64748b"}}>{visita.relatorio.medicamentosAtuais}</span>
```

O `<span>` inline fica ao lado dos dois pontos e quebra naturalmente quando o conteúdo é comprido — exatamente o pedido. Mesmo tratamento em Descrição das lesões, Observações gerais e Próxima visita sugerida. O `{" "}` garante o espaço após os dois pontos.

### Correção escopada de "Responsável" em FichaCompletaAnimal

O grid de detalhes desse componente já renderizava inline (`.relatorioDetalhesGrid strong { display: inline }`), então Medicamentos atuais, Observações gerais e Orientações repassadas já ficavam ao lado do rótulo — nenhuma mudança necessária e nenhuma feita. O único ponto que caía em duas linhas era "Responsável:", que fica em `.relatorioProf` (fora do grid) e herdava `.relatorioBox strong { display: block }`. A correção envolve o rótulo em `<strong>` e adiciona:

```css
.relatorioProf strong {
  display: inline;
  font-weight: 600;
  color: #64748b;
  margin: 0;
  font-size: 0.75rem;
}
```

`.relatorioProf` aparece em um único lugar no código (confirmado por busca), então a regra não afeta outros usos do module.

### Badges de Evolução e Adesão preservados

Ambos permanecem dentro do mesmo `<div>` do rótulo, com o `<span>` do badge imediatamente após o `<strong>` e `marginLeft: "0.5rem"`. A escolha de classe por valor (`badgeSuccess`/`badgeDanger`/`badgeWarning`) está inalterada, assim como o conteúdo exibido.

### Escopo preservado

Todas as condições de exibição permanecem: medicamentos só com `emTratamento === "Sim" && medicamentosAtuais`, descrição de lesões com `apresentaLesoes === "Sim" && descricaoLesoes` (no FichaCompletaAnimal) / `descricaoLesoes` truthy (no FichaEsporotricose), próxima visita com `necessidadeNovaVisita === "Sim" && dataProximaVisita`, etc. Nenhum campo adicionado ou removido da exibição, nenhuma action/schema tocada por esta tarefa.

As mudanças não commitadas de outras tarefas seguem intactas no working tree (`schema.prisma`, `actions.js`, remoção dos arquivos de Zoonoses, `Sidebar.js`, abas de Pacientes, e o próprio bloco de encerrar/reabrir/incineração dentro de `FichaEsporotricose.js`). A tarefa de layout não as desfez.

</details>

<details>
<summary>Arquivos alterados (relativos a esta tarefa)</summary>

- `src/app/ccz/FichaEsporotricose.js` — rótulos do relatório agora inline via `style`; textos longos migrados de `<p>` para `<span>`. (Arquivo também contém mudanças de encerrar/reabrir/incineração de outras tarefas, não tocadas aqui.)
- `src/app/ccz/FichaCompletaAnimal.js` — campo "Responsável:" agora em `<strong>` inline.
- `src/app/ccz/ListaCCZ.module.css` — nova regra escopada `.relatorioProf strong { display: inline }`.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff -- src/app/ccz/FichaEsporotricose.js src/app/ccz/FichaCompletaAnimal.js src/app/ccz/ListaCCZ.module.css`

</details>
