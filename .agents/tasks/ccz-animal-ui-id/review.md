# Review — CCZ Animal: emojis, badge de situação, ID obrigatório/único

Veredito: APPROVED

## Escopo revisado
Diff local não commitado, três mudanças no módulo CCZ (ANIMAL), SÓ código (UI + validação de action):
1. Remover emojis-caractere dos cards da lista de animais.
2. Badge de SITUAÇÃO no card do animal.
3. ID do animal obrigatório no cadastro (cliente + servidor) e único.

Arquivos relevantes à tarefa: `src/app/ccz/AnimaisLista.js`, `src/app/ccz/CadastroAnimal.js`, `src/app/ccz/actions.js`, `src/app/ccz/ListaCCZ.module.css`.

## Evidência de verificação
- `npx eslint src/app/ccz/AnimaisLista.js src/app/ccz/CadastroAnimal.js src/app/ccz/actions.js` → exit 0, sem warnings/erros. Confirma ausência de referências indefinidas e código morto nas mudanças.
- Spot-check por grep: nenhum caractere emoji remanescente em `AnimaisLista.js`.
- `next lint --file` não existe nesta versão (Next 16); por isso o eslint foi invocado diretamente nos arquivos alterados.

## MUDANÇA 1 — Emojis
- Removidos `🦠` (antes de "Esporotricose:") e `🔥` (antes de "Incinerado") dos badges em `AnimaisLista.js`. Busca por code points de emoji no arquivo não retorna matches.
- Textos/labels e badges preservados ("Esporotricose: ...", "Incinerado", "Não incinerado").
- Sem espaço órfão duplo: o emoji e o espaço subsequente foram removidos juntos; o texto renderizado começa direto na palavra.
- Ícones de componente lucide-react não foram tocados (o diff só mexeu em emojis-caractere no JSX).

## MUDANÇA 2 — Badge de situação
- Card renderiza o badge apenas quando `a.situacao` é truthy (`{a.situacao && (...)}`), logo vazio = sem badge. Sem badge duplicado (um único `<span>`).
- Rótulos: "Adotado", "Devolvido" e "No CCZ" para o valor `"CCZ"` (`a.situacao === "CCZ" ? "No CCZ" : a.situacao`).
- Cores sóbrias e distintas: Adotado → `badgeSuccess` (verde), Devolvido → `badgeWarning` (âmbar), CCZ → `badgeInfo` (azul, nova classe `#dbeafe`/`#1e40af`/borda `#93c5fd`). Classes confirmadas em `ListaCCZ.module.css`.
- `listarAnimais` retorna `situacao` (`situacao: a.situacao || ""`), e `obterAnimal` também o expõe para a edição.
- Como `situacao` é restrito a "", "Adotado", "Devolvido", "CCZ" e o vazio é guardado, só "CCZ" cai no ramo `else` (azul). Coerente.

## MUDANÇA 3 — ID obrigatório e único
- Cliente (`CadastroAnimal.js`): `salvar` valida `!form.id || !form.id.trim()` antes de prosseguir, usando `useNotify` (mensagem de campo obrigatório) e `useConfirm` para a confirmação do salvamento. Input de ID: `required`, placeholder "Ex: ANM-001" (não mais "Gerado se vazio"), e `disabled={camposDesabilitados || editando}` (ID é PK, não editável na edição).
- Servidor (`actions.js > salvarAnimal`): geração automática de id removida; agora retorna "O ID do animal é obrigatório." quando vazio/só espaços. Verifica duplicidade via `prisma.animal.findUnique` antes de criar (quando `!editando`) e retorna "Já existe um animal com este ID." O `catch` de `P2002` retorna a mesma mensagem como fallback defensivo.
- Fluxo de edição preservado: o cliente envia `editando: editando || Boolean(animalCarregado)`; no servidor, com `editando === true` o `findUnique` de unicidade é pulado e o `upsert` por `id` (PK) atualiza. Como o input de ID fica desabilitado na edição, a PK não muda.
- Defesa adicional: mesmo se o `findUnique` fosse pulado, o guarda impede a criação com id existente antes do `upsert`, e o `P2002` cobre corrida.

## Restrições
- schema/migrations/.env/dados: o working tree contém alterações em `prisma/schema.prisma` (adição de `situacao` ao Animal e remoção de `numeroProtocolo` do Esporotricose). Essas mudanças pertencem a tarefas anteriores já revisadas neste mesmo tree (`.agents/tasks/add-animal-situacao`, `.agents/tasks/remove-esporotricose-protocolo`) e são pré-requisito desta tarefa (a coluna `situacao` é necessária para a MUDANÇA 2). Esta tarefa de código não introduziu nem desfez schema; preservar o trabalho não commitado preexistente está de acordo com a restrição. Fora do escopo desta revisão.
- Sem libs novas; CSS Modules e padrão de badges/botões existentes mantidos (reuso de `badgeSuccess`/`badgeWarning`/`badgeDanger` e nova `badgeInfo` no mesmo estilo pílula).
- Nenhum commit/stash/checkout/reset executado nesta revisão.

## Conclusão
As três mudanças atendem aos requisitos aprovados, sem comportamento extra indevido e sem falha de correção/segurança alcançável. Nenhum blocker.
