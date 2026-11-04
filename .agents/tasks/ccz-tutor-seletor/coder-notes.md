# ccz-tutor-seletor – notas do coder

## Achado na comparação
- O `SeletorPaciente.js` em disco NÃO tinha o comportamento descrito (abrir ao focar sem digitar, tabela vazia com mensagem, cabeçalho "Usuário/Nome"); tinha tabela, mas fechada sem texto e com mensagem "Nenhum paciente encontrado". O CCZ tinha o comportamento de abrir vazio, mas com hover azul sólido, "Não informada"/"-" e CSS próprio.
- Solução: `SeletorPaciente` passou a ter o comportamento completo (modelo único) e o CCZ Tutor o reutiliza.

## Alterações
- src/components/SeletorPaciente.js: reescrito; props novas opcionais `texto`/`onTextoChange` (modo controlado), `buscar` (fonte de dados; padrão /api/pessoas/buscar), `buscaAtiva`, `cpfSelecionado`, `minCaracteres`. Busca disparada no digitar (debounce 300ms, ignora respostas antigas), abre ao focar, Esc/clique fora/seleção fecham.
- src/components/SeletorPaciente.module.css: `.linhaSelecionada`.
- src/app/ccz/CadastroTutor.js: removida a lógica inline do dropdown; usa SeletorPaciente com `buscarPessoasCCZ` (rota/ação mantida), `buscaAtiva={!editavel}`.
- src/app/ccz/CadastroTutor.module.css: `.campoSeletor` (padding do caret). Estilos antigos mantidos porque Denúncia/Zoonoses usam o mesmo módulo.
- Junta e PacientesJudiciais: handler ignora `onSelect(null)` chamando handleClear (antes quebrava ao editar o texto após selecionar).

## Verificação
- `npm run lint`: exit 0. `npm run build`: exit 0.
- Verificação visual/navegador: NÃO realizada (sem credenciais de teste disponíveis; não li .env).
