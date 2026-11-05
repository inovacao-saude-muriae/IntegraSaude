# Diálogo personalizado nas exclusões do CCZ (Procedimentos, Animais, Tutor)

O diff substitui os popups nativos do navegador (`window.confirm`/`alert`) pelos diálogos personalizados via hooks `useConfirm`/`useNotify` de `@/components/ConfirmDialog`, seguindo o padrão de `FichaEsporotricose.js`. A confirmação de exclusão vive nos modais de detalhe (`Ficha*`), que é onde fica o botão "Excluir"; as listas (`*Lista.js`) apenas recebem o `handleExcluir` via prop `onExcluir` e passaram a usar `await notify(...)` para o feedback de erro. A lógica de exclusão (action chamada e recarga da lista) não mudou — só a camada de confirmação/feedback. O bug de sombreamento (`const confirm = useConfirm()` sombra `window.confirm`, tornando qualquer `confirm(...)` síncrono sempre truthy) foi eliminado: todas as chamadas viraram `await confirm({...})` com `if (!ok) return;` em handlers `async`.

Watch for: nenhuma chamada nativa `window.confirm`/`confirm(`/`alert(` restou em `src/app/ccz/**` (confirmado por grep); o `ConfirmProvider` envolve toda a árvore via `ClientLayout`, então os hooks usam o diálogo personalizado e não o fallback nativo (confirmado); a verificação visual/manual não foi registrada por nenhum artefato do coder (possível) — o diretório da tarefa está vazio, sem log de lint/build/visual.

**Verdict**: APPROVED

## High-level view

As três telas exigidas pela tarefa estão cobertas corretamente. Em `FichaAnimal.js`, `FichaProcedimento.js` e `FichaTutor.js` o import de `useConfirm` (e `useNotify` onde há aviso) foi adicionado, o hook instanciado no componente, e o `onClick` do botão Excluir virou `async () => { const ok = await confirm({ title, message, confirmText: "Excluir" }); if (!ok) return; onExcluir?.(...); onFechar(); }`. Cancelar retorna sem excluir.

O sombreamento de `window.confirm` está resolvido na raiz: não existe mais nenhum `confirm(...)` síncrono tratado como boolean — grep case-insensitive por `window.confirm`, `confirm(` e `alert(` em `src/app/ccz/**` só retorna chamadas `await confirm({...})` e nenhum `alert(`.

O diálogo personalizado realmente aparece em runtime porque o `ConfirmProvider` embrulha a aplicação inteira em `ClientLayout` (caminhos de login e não-login). Sem o provider montado, `useConfirm`/`useNotify` cairiam no fallback `window.confirm`/`window.alert` e o bug persistiria; não é o caso aqui.

O diff traz duas mudanças além das exclusões das três telas: a tela de Denúncias (`DenunciasLista.js`/`FichaDenuncia.js`) teve a mesma correção de exclusão aplicada — coerente com "nem em outras exclusões do CCZ" — e um `alert` de sucesso ao salvar denúncia foi trocado por `notify` em `FichaDenuncia.js`. Essa última é feedback, não exclusão; é consistente com o objetivo de remover nativos, mas está fora do escopo literal das três telas.

A verificação automatizada e visual não está documentada: o diretório `.agents/tasks/ccz-fix-confirm` está vazio e não há mensagem do coder no histórico comprovando lint/build ou teste visual do diálogo.

<details>
<summary>Issues (2)</summary>

1. **Verificação visual não comprovada** (possible) — Nenhum artefato do coder registra lint/build ou teste visual do diálogo personalizado; a montagem do `ConfirmProvider` foi confirmada por código nesta revisão, o que torna a correção funcional, mas convém uma passada visual rápida nas três telas antes de fechar.
2. **Mudança agregada fora das 3 telas** (confirmed) — `FichaDenuncia.js` troca um `alert` de sucesso ao salvar por `notify` (linha ~66), além da correção de exclusão de Denúncias; coerente com o objetivo, mas não faz parte das três telas nomeadas. Sem impacto, apenas registrar.

</details>

<details>
<summary>Details</summary>

## As três telas: Procedimentos, Animais, Tutor

Cada tela tem a confirmação no modal de detalhe (`Ficha*`), não na lista — que é a localização correta, já que o botão "Excluir" fica no rodapé do modal.

`FichaProcedimento.js`: importa `useConfirm`, instancia `const confirm = useConfirm()`, e o `onClick` virou:

```js
onClick={async () => {
  const ok = await confirm({
    title: "Excluir procedimento",
    message: "Deseja excluir este procedimento? Esta ação não pode ser desfeita.",
    confirmText: "Excluir",
  });
  if (!ok) return;
  onExcluir?.(dados.id);
  onFechar();
}}
```

`FichaAnimal.js`: idêntico em estrutura, com `title: "Excluir animal"` e mensagem interpolando `ficha.nome`.

`FichaTutor.js`: importa `useConfirm` e `useNotify`. Mantém a guarda de vínculo — quando há animais vinculados, agora usa `await notify({ tipo: "erro", ... })` e `return` antes de qualquer confirmação; caso contrário, `await confirm({ title: "Excluir tutor", ... })` com `if (!ok) return;`. O handler inteiro virou `async`.

Nos três casos `onExcluir?.(...)` e `onFechar()` só executam após confirmação, então Cancelar não exclui. A chamada da action e a recarga da lista ficam em `handleExcluir` dentro das `*Lista.js`, inalteradas na lógica (`await excluirProcedimento(id)` / `await excluirAnimal(id)` / `fetch(... DELETE)`), apenas com o feedback de erro migrado de `alert` para `await notify`.

## Sombreamento de `window.confirm` eliminado

O padrão antigo era `if (window.confirm(...)) { onExcluir(); onFechar(); }`. Com `const confirm = useConfirm()` em escopo, um `if (confirm(...))` síncrono passaria a avaliar uma `Promise` (sempre truthy) e excluiria sem perguntar. O diff não deixa nenhuma chamada síncrona: grep case-insensitive por `window.confirm`, `confirm(` e `alert(` em `src/app/ccz/**` retorna apenas ocorrências `await confirm({...})` (FichaProcedimento, FichaDenuncia, FichaAnimal, FichaTutor, FichaEsporotricose, CadastroAnimal, CadastroEsporotricose, CadastroProcedimento, CadastroTutor) e zero `alert(`. Um grep adicional por `confirm(` não-awaited (`= confirm(`, `if (confirm(`) não retornou nada.

## Provider montado — a correção aparece em runtime

`useConfirm`/`useNotify` têm fallback para `window.confirm`/`window.alert` quando o provider não está no contexto. `ClientLayout.js` envolve toda a árvore com `<ConfirmProvider>` nos dois caminhos (página de login e layout padrão), então os hooks resolvem o diálogo personalizado. Sem essa montagem, a correção seria cosmética; está confirmado que não é.

## Verificação não documentada

O diretório `.agents/tasks/ccz-fix-confirm` existe mas está vazio — não há arquivo de review anterior nem log do coder. Não há no histórico uma declaração do coder de que lint/build rodaram nem de teste visual do diálogo. A montagem do provider e a ausência de nativos foram verificadas por leitura de código nesta revisão, o que sustenta o APPROVED; ainda assim, uma passada visual nas três telas (abrir ficha → Excluir → ver diálogo custom → Cancelar não exclui → Confirmar exclui) seria o fechamento ideal.

</details>

<details>
<summary>Arquivos alterados</summary>

- `src/app/ccz/FichaProcedimento.js` — import + hook `useConfirm`; botão Excluir usa `await confirm({...})` / `if (!ok) return`.
- `src/app/ccz/FichaAnimal.js` — import + hook `useConfirm`; botão Excluir usa `await confirm({...})` / `if (!ok) return`.
- `src/app/ccz/FichaTutor.js` — import + hooks `useConfirm`/`useNotify`; guarda de vínculo via `notify`, exclusão via `await confirm({...})`.
- `src/app/ccz/FichaDenuncia.js` — import + hooks; exclusão via `await confirm({...})`; `alert` de sucesso ao salvar trocado por `notify` (fora das 3 telas).
- `src/app/ccz/AnimaisLista.js` — import `useNotify`; feedback de erro de exclusão via `notify`.
- `src/app/ccz/ProcedimentosLista.js` — import `useNotify`; feedback de erro de exclusão via `notify`.
- `src/app/ccz/TutoresLista.js` — import `useNotify`; feedback de erro de exclusão via `notify`.
- `src/app/ccz/DenunciasLista.js` — import `useNotify`; feedback de erro de exclusão via `notify`.

Diff completo: `git -C "c:\Users\Jefinny\Documents\10. IntegraSaude" diff`

</details>
