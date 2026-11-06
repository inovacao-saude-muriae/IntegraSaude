# Revisão: filtro de ano nos dashboards

Veredito: APROVADO, sem bloqueadores.

Evidências:
- Regulação: `getPedidosDashboard(ano)` mantém a guarda `requireAcessoModulo(REGULACAO)`. O filtro é feito no servidor com Prisma por `dataSolicitacao`. `getPedidosExames` segue igual.
- Farmácia Judicial: `getDashboardMetrics(ano)` aceita chamada sem parâmetro (sem filtro), então o `page.js` continua compatível. Pacientes, entradas e dispensações são filtrados. Catálogo, estoque e alertas aparecem como "posição atual" na UI.
- Junta: a rota aceita `?ano=`. Sem o parâmetro, o comportamento anterior é mantido. A guarda `requireAcessoModulo(JUNTA)` está preservada. Serviços ativos e próximos agendamentos aparecem como posição atual. O nome da relação `pacientePacienteJunta` existe no schema.
- UI: o componente `FiltroAno` fica acima dos KPIs. O padrão é o ano atual e há a opção "Todos os anos".
- Lint dos arquivos alterados: 0 erros (conferido de novo). Nenhum eslint-disable foi necessário. O build e a validação das consultas constam no registro do coder.
- Sem mudanças em schema, migrations, .env ou CCZ. Sem libs novas. Não encontrei commits no diff.

Limitação: a UI não foi testada no navegador e as guardas não foram exercitadas via HTTP (informado pelo coder).
