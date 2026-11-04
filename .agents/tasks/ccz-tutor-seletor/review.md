# Revisão: ccz-tutor-seletor

Veredito: APROVADO (sem bloqueadores).

Evidências lidas: diff de CadastroTutor.js, SeletorPaciente.js/.module.css, CadastroPacienteJunta.js, PacientesJudiciais.js, /api/pessoas/buscar/route.js e coder-notes.md (lint e build com exit 0). Não reexecutei as suítes.

- Requisito atendido: o CCZ Tutor agora usa o SeletorPaciente compartilhado. Ele tem tabela CPF/CNS, Usuário/Nome, Nome da mãe e Data nasc., abre ao focar sem digitar com "Nenhuma pessoa encontrada.", mostra caret e fecha com clique fora, Esc ou seleção.
- Seleção no CCZ: `onSelect` chama `selecionarPessoa`, que preenche o form inteiro (CPF, telefone etc.) e passa para o modo leitura. Ela usa `buscarPessoasCCZ`, então a fonte de dados não mudou.
- Tutor novo: o texto digitado fica em `form.nomeCompleto`. `novoCadastro` o reaproveita, como antes pelo `termo`. Em modo novo/edição `buscaAtiva=false` deixa o campo como input simples, sem dropdown. `required` e o fluxo de edição por `cpfInicial` seguem iguais, e as máscaras ficam fora do componente.
- Junta e PacientesJudiciais: o modo padrão continua usando `/api/pessoas/buscar`. O parser aceita `{results}`, `{data}` e array. A rota devolve `{success, results}`, o que corrige o bug original de "não traz ninguém" (a versão antiga fazia `setResultados(data)` com um objeto). O novo tratamento de `onSelect(null)` evita a quebra ao editar o texto depois de selecionar.
- Sem alterações em schema.prisma, migrations ou .env*. Os estilos antigos do CadastroTutor.module.css foram mantidos porque outros componentes usam o mesmo módulo.

Limitações (não bloqueiam):
- A verificação visual no navegador não foi feita (declarado nas notas). A conclusão se baseia na leitura do código.
- O dropdown não fecha ao sair do campo só por Tab. Fecha por clique fora, Esc e seleção, que é o que foi pedido.
