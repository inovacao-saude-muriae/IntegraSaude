# Resultados: filtro de ano global no dashboard CCZ

## Implementado
- Filtro de ano em toolbar acima dos KPIs (fora dos gráficos), padrão = ano atual, opção "Todos os anos". Afeta KPIs, "Procedimentos por Tipo" e os 2 gráficos mensais.
- Nova action `estatisticasDashboardCCZ(ano)` (count/groupBy no servidor). Actions `listar*` não foram alteradas (outras telas intactas). As actions mensais aceitam `ano` (número | "todos" | null; undefined = ano atual). "Todos" nos gráficos mensais soma todos os anos por mês do calendário.
- Regras de data: Tutores = Tutor.createdAt; Animais/com/sem tutor = Animal.dataCadastro; Procedimentos e por Tipo = dataProcedimento; Esporotricose = dataVisita; Denúncias = dataDenuncia; Entradas = COALESCE(dataDevolucao, dataCadastro) para Adotado/Devolvido, dataCadastro para CCZ/vazio; Devolvidos = dataDevolucao. Datas nulas ficam fora quando há filtro.
- Devolvidos: só situacao="Devolvido" E pessoaCpf nulo, série única "Sem tutor" (cinza), título "(sem tutor)". Entradas continua empilhado.
- Números: empilhado mostra valor de cada segmento (>0) + total acima da barra; devolvidos mostra valor acima da barra; Procedimentos por Tipo mostra a contagem absoluta (sem %).

## Verificação
- `npm run lint`: 0 erros, 5 warnings preexistentes.
- `npm run build`: compilado com sucesso.
- Server-side (script temporário Prisma, replicando os where das actions, banco integrasaude, removido): 2026 -> tutores 2, animais 3 (2 com/1 sem), proc 3 (Castração 1, Vacinação 2), espo 3, denúncias 4; 2025 -> tudo 0; Todos -> igual a 2026 (todos os dados são de 2026). Devolvidos sem tutor = 0, embora exista 1 devolvido (com tutor), confirmando o filtro por pessoaCpf nulo.
- NÃO verificado: visual em navegador/login (não executado); as actions reais exigem sessão, então a validação foi feita com as mesmas consultas fora do app.
- Nenhum commit feito; nenhum dado alterado.
