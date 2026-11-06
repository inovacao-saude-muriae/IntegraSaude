# Filtro de ano nos dashboards (Regulação, Farmácia Judicial, Junta Reguladora)

## Componente compartilhado
- `src/components/FiltroAno/FiltroAno.js` + `FiltroAno.module.css`: toolbar idêntica à do CCZ (label "Ano", select, "Todos os anos", dica "Indicadores referentes a: …"). Props: `valor`, `onChange` (número ou `"todos"`), `anos` (opcional; padrão ano atual + 5 anteriores), `incluirTodos` (padrão true), `dica` (texto extra).
- CCZ NÃO foi refatorado (mantido como está, sem risco de regressão). Nenhum arquivo do CCZ foi alterado.

## Convenção de ano / fuso (igual ao CCZ)
Número = ano; `"todos"`/null = sem filtro; janela UTC `[1º jan, 1º jan do ano seguinte)`.

## Regulação
Arquivos: `src/app/regulacao/actions.js`, `src/app/regulacao/Dashboard.js`.
- Nova action `getPedidosDashboard(ano)` (guarda `requireAcessoModulo(REGULACAO)`; undefined = ano atual) filtra no servidor com Prisma por `PedidoExame.dataSolicitacao`. `getPedidosExames()` continua igual (agora delega ao helper interno `buscarPedidosMapeados(where)`), sem impacto nas outras telas.
- Regra única: todo o dashboard (total, taxa de liberação, valor autorizado, tempo médio, fila, cancelados/devolvidos, auditoria, financeiro por cota, produtividade, fila por risco/tipo) considera os pedidos cuja **data de solicitação** está no ano, para que taxa/valores/fila fiquem coerentes entre si. Nenhum card ficou como "posição atual".
- Dashboard carrega via `getPedidosDashboard(ano)` em `useEffect([anoSelecionado])` (setState só após await, sem eslint-disable necessário). A prop `requests` deixou de ser usada pelo Dashboard (page.js inalterado).

## Farmácia Judicial
Arquivos: `farmacia-judicial/actions.js`, `farmacia-judicial/Dashboard.js`.
- `getDashboardMetrics(ano)`: undefined/null/"todos" = sem filtro (compatível com `page.js`, que segue chamando sem parâmetro). O Dashboard chama com o ano selecionado (padrão ano atual). Sem guarda nova (a action já não tinha).
- Regras: Pacientes ativos/inativos/óbito/base e painel de status → `created_at` do paciente (cadastrados no ano, status atual); **novos cards** "Entradas de Lotes" → `data_entrada` (unidades e nº de lotes) e "Dispensações" → `data_dispensacao` (unidades e nº). **Posição atual (não filtram):** Catálogo de Medicamentos, Estoque Físico Total, alertas de vencimento/estoque baixo e tabela de estoque — sinalizado na UI (rodapé "· posição atual" nos cards e dica na toolbar).

## Junta Reguladora
Arquivos: `src/app/api/junta-reguladora/dashboard/route.js`, `src/app/junta-reguladora/Dashboard.js`.
- Rota aceita `?ano=2026|todos`; sem parâmetro mantém o comportamento anterior (totais gerais, gráfico dos últimos 6 meses). O Dashboard sempre envia `?ano=`. Guarda `requireAcessoModulo(JUNTA)` preservada.
- Regras: Total de Pacientes → `PacienteJunta.createdAt`; Atendimentos e Atendimentos por Serviço → `dataAtendimento`; Agendamentos Ativos → `AgendamentoJunta.data` futuros (>= hoje) dentro do ano (anos passados dão 0); Pacientes por Serviço → `createdAt` do paciente vinculado (vínculo ativo); Atendimentos Mensais → 12 meses do ano (em "todos", soma por mês do calendário). **Posição atual:** Serviços Ativos (novo campo `totalServicosAtivos`) e Próximos Agendamentos (7 dias) — sinalizados na UI.
- A toolbar fica visível também durante carregamento/erro.

## Verificação
- `npm run lint`: 0 erros, 5 warnings (preexistentes). `npm run build`: sucesso.
- Validação server-side (scripts temporários com Prisma, já apagados; credenciais não impressas):
  - Regulação (pedidos de teste criados numa transação com rollback): ano atual=1, 2020=2 (inclui borda 31/12 23:30Z), 2021=1 (1º/jan 00:00Z), 1990=0, todos=4.
  - Farmácia (mesmo SQL da action, dados de teste em transação com rollback): ano atual → entradas 100un/1 lote, dispensações 5un/1, pacientes ATIVO 1; 2020 → 40un/1, 7un/1, 0; 1990 → tudo 0; todos → 140un/2, 12un/2, 1. Rollback confirmado (pessoa de teste remanescente: 0).
  - Junta (dados reais, somente leitura): ano atual → pacientes 1, atendimentos 1, agendamentos 1, pacientes por serviço 1 grupo; 1990 → tudo 0; todos → igual ao ano atual.
- NÃO verificado: navegador/login (UI visual: posição da toolbar e troca de ano nos 3 dashboards, e CCZ idêntico — CCZ não foi tocado). As actions/rota foram validadas replicando as consultas, não via HTTP autenticado (guardas de permissão não exercitadas). Nenhum servidor foi iniciado; nenhum git add/commit.
