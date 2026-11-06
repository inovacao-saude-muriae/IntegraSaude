# Relatório de implementação: Auditoria de Alterações (Regulação)

## Aba
- Nome: **Auditoria de Alterações**, `/regulacao?tab=AUDITORIA`.
- Local: menu "Regulação" da Sidebar, logo após "Dashboard".

## Permissão (3 camadas, somente GESTOR)
1. Menu: `Sidebar.js`, item com `visivelSe: "GESTOR"`.
2. Conteúdo: `layout.js` calcula `podeVerAuditoria = usuarioEhGestor(ctx.user)` e injeta no `RegulacaoPermProvider`. `page.js` mostra `<AuditoriaTab/>` ou `<AcessoNegadoModulo/>`. Admin da Regulação não vale.
3. API: `GET /api/regulacao/auditoria` chama `requireGestor()` (401 sem sessão, 403 não gestor). As exportações usam a mesma rota (`export=1`).

## Filtros, indicadores e telas
- Filtros: período (de/ate, com atalhos 7 dias, 30 dias, este mês, este ano), usuário (lista dos que aparecem no log), tipo de ação, objeto (rótulos em pt-BR) e busca por descrição ou ID. Padrão: últimos 30 dias.
- Cards: total de alterações, usuários distintos, cadastros, edições (EDITAR + SALVAR), exclusões, liberações e usuário mais ativo.
- "Quem mexeu nos dados": tabela por usuário (perfil, total, cadastros, edições, exclusões, liberações, primeira e última alteração), ordenável. O botão "Ver alterações" filtra a linha do tempo pelo usuário.
- Linha do tempo paginada no servidor (10/25/50/100), mais recente primeiro: data/hora, usuário, ação, objeto, ID, descrição e IP.
- Cabeçalho com período, data/hora de geração e quem gerou. Aviso "O registro detalhado de auditoria começou em <data>". Estados de carregando, vazio e erro. Tabelas com `caption`, `scope` e `aria-sort`. CSS responsivo.
- Backend: `src/lib/auditoriaRegulacao.js` usa `modulo = 'REGULACAO'` em todas as consultas, com `count`, `groupBy` e `aggregate` no servidor. Datas em UTC, intervalo `[de 00:00Z, ate+1d 00:00Z)`. Modo exportação limitado a 5000 linhas, com `truncado` e aviso.

## Histórico antigo
- O model Prisma `PedidoExameHistorico` (tabela `regula_pedidos_historico`) é lido via ORM.
- Aparece em seção separada, "Histórico anterior à auditoria", só com registros anteriores ao primeiro `audit_logs` da Regulação. Segue os filtros de período, usuário e busca. A seção some se o filtro de ação for aplicado ou se a entidade for diferente de PedidoExame.
- A autoria vem do CPF gravado na própria linha, então não há correspondência por nome. Limite de 200 linhas, com aviso quando truncado.
- Nota: as funções que gravam nessa tabela não têm chamador no código. Hoje a tabela está vazia no banco local.

## Exportações
- **Exportar PDF**: jspdf + jspdf-autotable, A4 paisagem, importados dinamicamente no clique. Contém cabeçalho, filtros, indicadores, tabela por usuário, detalhado e histórico anterior. Rodapé com "Página X de Y" e aviso de confidencialidade.
- **Exportar Excel**: xlsx, com as abas Resumo, Por usuário, Detalhado e Histórico anterior.
- Ambos buscam `export=1` e avisam quando truncado.

## Guardas adicionadas (`src/app/regulacao/actions.js`)
`createPedidoExame`, `updateCommunicationDate`, `releasePaciente`, `updatePedidoExame` e `deletePedidoExame` agora chamam `requireAcessoModulo(MODULOS.REGULACAO)` e passam `user` para `registrarAuditoria`. Usei acesso ao módulo (e não admin) para não quebrar o fluxo dos operadores. Sem sessão, as actions retornam `success:false` e não gravam nada.

## Outras escritas
Inventário feito na leitura de `actions.js`. As demais actions de escrita (pessoas, médicos, UBS, procedimentos, cotas, planejamento, faturamento, `procedimentosActions.js`) já registravam auditoria. Não achei POST, PUT, PATCH ou DELETE em `/api/regulacao/**`. Não instrumentei nada novo além das 5 acima.
- Limitação: cadastro e edição de pessoas feitos pelo Gerenciamento (`/api/pessoas` e `gerenciamento/pessoas/actions.js`) ficam com `modulo = 'GERENCIAMENTO'`, então não entram neste relatório (a tela avisa). Para incluí-los, o filtro seria `modulo='REGULACAO' OR (modulo='GERENCIAMENTO' AND entidade='Pessoa')`. Não alterei isso.

## Arquivos
- Criados: `src/lib/auditoriaRegulacao.js`, `src/app/api/regulacao/auditoria/route.js`, `src/app/regulacao/AuditoriaTab.js`, `src/app/regulacao/AuditoriaTab.module.css`.
- Alterados: `src/app/regulacao/actions.js` (5 guardas + `user`), `layout.js`, `PermissoesRegulacaoContext.js`, `page.js`, `src/components/Sidebar.js`.
- Sem mudança em `schema.prisma`, migrations ou `.env`. Nada commitado.
- Se for preciso otimizar: `audit_logs` já tem os índices `(modulo, createdAt)` e `(createdAt)`. O filtro por `userCpf` dentro de um módulo usa só o primeiro. Nenhum índice novo foi criado.

## Verificação executada
- `npm run lint`: 0 erros, 5 warnings preexistentes.
- `npm run build`: compilou com sucesso, rota `/api/regulacao/auditoria` presente. Rodei de novo ao final, depois de remover o código temporário.
- Teste ponta a ponta com `next start` na porta 3100, `audit_logs` vazia no início. Inseri registros de teste (usuários 999000000xx, uma linha de CCZ, 5100 linhas em massa, 3 linhas no histórico antigo) e sessões temporárias.
  - API: sem sessão 401, token inválido 401, operador 403, gestor 200.
  - Filtros: a linha de CCZ ficou fora (total 5107 de 5108). Usuário por CPF e por nome, ação, entidade, período (resultado esperado = 3), busca por ID, ação inválida, data inválida e de>ate retornaram os valores esperados (400 nos inválidos).
  - Paginação: `page=2&pageSize=50` devolveu 50 itens e 102 páginas.
  - Exportação: `export=1` devolveu 5000 itens com `truncado=true` e total 5107.
  - Resumo por usuário agregou certo (o usuário mais ativo era o de 5100).
  - Histórico anterior: só 2 das 3 linhas apareceram (a de 5 dias atrás, posterior ao corte, ficou fora). Com filtro de ação ele deixa de ser aplicável.
  - 5 guardas: sem sessão as 5 retornam `ok:false` e não gravam nada. Com um operador da Regulação, as 5 funcionam e geram 5 linhas em `audit_logs` com CPF e nome corretos do operador.
  - Renderização no servidor de `/regulacao?tab=AUDITORIA`: o gestor recebe a aba (título, "Carregando", botão Exportar PDF). O operador recebe `AcessoNegadoModulo`.
- Limpeza: rotas e arquivos temporários removidos, servidor da 3100 parado. Banco restaurado: `audit_logs` 0, histórico 0, `user_sessions` 13 (como antes), pedidos, procedimentos e tipos de teste removidos. As sequências (autoincrement) avançaram e não foram revertidas.

## O que não pôde ser verificado
- Visual no navegador (cliques, filtros, ordenação, layout responsivo) e a geração real dos arquivos PDF e Excel: não havia navegador disponível. Só verifiquei a renderização no servidor e a API. A geração de PDF/XLSX roda no cliente e não foi executada, só passou no build e no lint.
- A ocultação do item de menu na Sidebar para não gestores (o menu é montado no cliente a partir de `/api/me`). Está por `visivelSe: "GESTOR"`, o mesmo mecanismo dos outros itens do Gerenciamento, e a proteção real fica nas camadas 2 e 3.
- Guarda de `requireAcessoModulo` para um usuário autenticado sem vínculo à Regulação (só existem um gestor e um operador no banco). A função é a mesma usada em outras actions.
- Atenção: o `npm run build` rodou com o dev server do usuário em outra porta ativo; o `.next` foi regenerado.
