# Visita Inicial da ficha de esporotricose unificada ao visual das visitas de acompanhamento

A apresentação da "Visita Inicial" em `src/app/ccz/FichaEsporotricose.js` foi reconstruída para usar o mesmo casco visual dos cards de "Visitas de Acompanhamento". As cinco `<section>` soltas que antes compunham a visita inicial (Visita Inicial, Tratamento, Manejo Domiciliar, Conclusão Técnica, Encaminhamentos) viraram um único `div.visitaCard` com cabeçalho no padrão "Visita N" (strong azul `#2563eb` + data em cinza `#64748b`) e sub-blocos em `div.relatorioBox` com subtítulo `#0f766e`. Os campos passaram do formato "rótulo em cima, valor embaixo em cinza" para o inline "Rótulo: valor" com valores em `#0f172a` a `0.875rem`, idêntico ao relatório de acompanhamento. Nenhuma biblioteca nova, nenhuma classe CSS nova: reutiliza `visitaCard` e `relatorioBox` já definidas em `ListaCCZ.module.css`.

Watch for: nada bloqueante. As classes reaproveitadas e as condições de renderização foram verificadas no código (confirmed); o lint/build vêm do registro do coder, não reexecutados (confirmed via relato).

**Verdict**: APPROVED

## High-level view

A mudança é puramente de apresentação e segue exatamente o template do card de acompanhamento que já existia no mesmo arquivo (linha ~680): mesmo wrapper `visitaCard`, mesmo cabeçalho flex com `strong` azul e data cinza, mesmos `relatorioBox` com título teal. Trocar as `section`/`fichaGrid` por essa estrutura é o que uniformiza o visual, e como as classes já existiam no CSS Module não há risco de quebrar outros usos nem necessidade de editar o `.module.css`.

Todo o conteúdo e todas as condições de renderização da visita inicial foram preservados campo a campo: Data/Protocolo/Fiscal/Apresenta lesões, Descrição das lesões (`descricaoLesoes`), Tratamento veterinário (`emTratamentoVeterinario === "Sim"`), bloco Tratamento, Manejo Domiciliar (`temTutor`), Outros animais (`=== "Sim"`), Pessoas com lesões (`=== "Sim"`, mantida em vermelho `#dc2626`), Conclusão Técnica (`conclusaoTecnica`) e Encaminhamentos com os checkboxes ☑/☐.

O escopo ficou contido: a seção "Incineração do Animal", cabeçalho, dados do animal/tutor, rodapé e os ajustes de cor preexistentes (`#64748b` → `#0f172a` nas visitas de acompanhamento) continuam intactos, e a árvore de trabalho não foi commitada, staged nem alterada por git.

<details>
<summary>Issues (0)</summary>

Nenhuma ação necessária. Todos os critérios de aprovação foram atendidos.

</details>

<details>
<summary>Details</summary>

### Casco visual idêntico ao card de acompanhamento

O card de acompanhamento (linha ~680) é a referência: `<div className={styles.visitaCard}>` envolvendo um cabeçalho `flex` com `<strong style={{color: "#2563eb"}}>Visita {idx+1}</strong>` e `Data:` em `#64748b`, seguido de blocos `<div className={styles.relatorioBox}>` cujo título usa `{fontWeight: "600", color: "#0f766e"}` e cujos campos são `<strong style={{display: "inline", marginBottom: 0}}>Rótulo:</strong> valor`. A Visita Inicial reconstruída replica esse template byte a byte: mesmo wrapper, mesmo cabeçalho (`Visita Inicial` + `Data:` em cinza), mesmos `relatorioBox` por subtema. Confirmado por leitura comparada dos dois trechos (confirmed).

As classes `visitaCard` e `relatorioBox` existem em `ListaCCZ.module.css` (linhas 318 e 325) e já eram usadas pelos cards de acompanhamento; a Visita Inicial apenas passa a consumi-las. `git diff --stat` mostra um único arquivo alterado (o `.js`), então o `.module.css` não foi tocado e nenhum outro uso das classes muda (confirmed).

Antes os campos usavam `fichaGrid`/`fichaSecao` com valores em cinza; agora os valores herdam `#0f172a` a `0.875rem` no formato inline. Isso também fecha o pedido original do usuário de respostas em preto, sem introduzir regressão de cor.

### Preservação de campos e condições de renderização

Comparando os blocos `-`/`+` do diff, todos os campos sobrevivem ao redesenho:

- Dados: `Data` (cabeçalho), `Protocolo`, `Fiscal`, `Apresenta lesões`.
- `Descrição das lesões` sob a mesma guarda `dados.descricaoLesoes`.
- `Tratamento veterinário` sob `dados.emTratamentoVeterinario === "Sim"`, com fallback `"Em tratamento"`.
- Bloco Tratamento: `Medicamentos` (fallback `"-"`), `Interrupção`, `Retorno veterinário`.
- Manejo Domiciliar inteiro dentro de `{dados.temTutor && (...)}`: `Isolamento`, `Acesso à rua`, `Uso de EPI`, `Higienização`.
- `Outros animais na residência` sob `dados.outrosAnimaisResidencia === "Sim"`.
- `Pessoas com lesões` sob `dados.pessoasComLesoes === "Sim"`.
- `Conclusão Técnica` sob `dados.conclusaoTecnica`.
- Encaminhamentos: os quatro checkboxes (`encAcompanhamentoCcz`, `encNotificacaoTutor`, `encMinisterioPublico`, `encOutrasMedidas`) com `☑`/`☐`, mais `outrasMedidasDescricao` sob sua guarda.

Nenhuma guarda foi afrouxada ou removida; as expressões de condição são as mesmas dos blocos removidos (confirmed).

### Cores semânticas especiais

O valor de "Pessoas com lesões" permanece em vermelho. No diff o `color: "#dc2626"` migrou do `<p>` antigo para o `<span>` inline, mas o código vermelho é idêntico (confirmed). Os checkmarks de Encaminhamentos continuam como glifos `☑`/`☐` condicionados ao booleano de cada encaminhamento.

### Escopo contido

A seção "Incineração do Animal" (lida na íntegra) continua em `fichaSecao`/`fichaTitle` com o `select` de incineração e o texto "Incinerado em ..." inalterados. O bloco "Visitas de Acompanhamento" também não muda estruturalmente; as únicas linhas tocadas lá são trocas de `#64748b` por `#0f172a` em quatro valores (Observação, Descrição das lesões, Medicamentos atuais, Observações gerais), coerentes com o ajuste de cor preexistente e dentro do espírito da tarefa.

`git status --short` mostra apenas `M src/app/ccz/FichaEsporotricose.js` (não staged) e nada em `git diff --cached`. Não houve add/commit/push/stash/checkout/reset (confirmed).

### Verificação (do registro do coder, não reexecutada)

O coder registrou em `review.json`: `npm run lint` com 0 erros e 5 warnings preexistentes, e `npm run build` compilando com sucesso no Next.js 16.3.0. A verificação visual foi relatada na mensagem final do coder. Conforme instrução, o veredito se baseia no diff e nesse registro, sem reexecução das suítes.

</details>

<details>
<summary>Arquivos alterados</summary>

- `src/app/ccz/FichaEsporotricose.js` — Visita Inicial unificada em um card `visitaCard`/`relatorioBox` no padrão das visitas de acompanhamento; quatro valores das visitas de acompanhamento ajustados de `#64748b` para `#0f172a`.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff -- src/app/ccz/FichaEsporotricose.js`

</details>
