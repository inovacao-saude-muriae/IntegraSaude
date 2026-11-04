# Implementation Plan — CCZ Esporotricose

Nova subfeature "Esporotricose" do módulo CCZ do IntegraSaude (Next.js 16 App Router, JavaScript, Prisma 7.9.1 + PostgreSQL). Trabalhar direto em `c:\Users\Jefinny\Documents\IntegraSaude` — SEM worktree, NÃO commitar, NÃO rodar `npm run dev`. Toda a feature espelha a feature "Procedimentos" existente (CadastroProcedimento / ProcedimentosLista / getAgendaProcedimentos / TermoInternacao / FichaAnimal).

## Contexto confirmado na exploração

- **Next.js**: v16.3.0, App Router + Turbopack, JavaScript (não TS). AGENTS.md só contém o bloco `nextjs-agent-rules`; docs em `node_modules/next/dist/docs/`. Server actions com `"use server"` no topo do arquivo (`src/app/ccz/actions.js`), componentes com `"use client"`. Nenhuma novidade de API impacta este trabalho (server actions + páginas client com `useSearchParams/useRouter` já são o padrão do repo).
- **Gating**: `ccz/layout.js` já protege o módulo; cada action chama `requireAcessoModulo(MODULOS.CCZ)`. NÃO adicionar novo gating.
- **Schema**: o model `Esporotricose` (tabela `ccz_esporotricose`, PK map `zoonoses_esporotricose_pkey`) JÁ EXISTE com a maioria dos campos (animalId, numeroProtocolo, dataVisita, fiscalResponsavel, apresentaLesoes, descricaoLesoes, emTratamentoContinuo, medicamentosPrescritos, interrupcaoTratamento, retornoVeterinario, isolamentoDomiciliar, observacoesIsolamento, acessoRua, usoEpi, quaisEpis, higienizacaoAmbiente, outrosAnimaisResidencia, outrosAnimaisDescricao, pessoasComLesoes, pessoasLesoesDescricao, conclusaoTecnica, enc* booleans, outrasMedidasDescricao). `Animal.esporotricose Esporotricose[]` já existe. Relação é `onDelete: SetNull`.
- **Helpers em actions.js**: `soDigitos`, `ymdParaDateUTC`, `dateParaYMD`, `requireAcessoModulo(MODULOS.CCZ)`, `buscarAnimaisCCZ` (retorna `{id,nome,especie,sexo,porte,tutorNome}`). Retorno padrão `{success, error?, data?}`. Id gerado: `(idInformado || PREFIXO-${Date.now().toString(36)}).toUpperCase().slice(0,50)`.
- **CSS reutilizável**: `CadastroAnimal.module.css` (grid, field, colXs/colSm/colMd/colLg/colFull, rowComposta, colControle, colAnexo, tableDropdownMenu, tableContainerScroll, patientTableDropdown, boldName, selectedRow, noDataTd, btnPrimary, btnGhost, btnAdicionar, formSectionTitle, camposBloco, formActions, alertErro, cardHeaderRow, cardHeaderTitle, formCard, card, container). `ListaCCZ.module.css` (container, card, listaHeader, cardHeaderTitle, buscaInput, vazio, tableWrapper, table, boldName, subText, acoesCell, btnEditar, btnFicha, statusAgendado/Realizado/Cancelado). `AgendaCCZ.module.css` (card, header, title, subtitle, badgeServico, monthNav, navBtn, monthLabel, legenda, legProc, legRet, weekHeader, weekDay, grid, dayCell, today, emptyCell, dayNumber, events, event, eventRetorno, moreEvents, modalOverlay, modal, modalHeader/Title/Subtitle/Close/Body, diaList, diaItem, diaItemSub, verBtn, vazioModal, loadingBox). `FichaAnimal.module.css` (overlay, modal, header, title, subtitle, closeBtn, body, footer, baixarBtn, fecharBtn, cancelarBtn, info, erro, secao, secaoTitulo, formGrid, campo, dadosGrid, dado, dadoLabel, dadoValor + termo-only: infoTutor, cienciaTexto, assinaturaPreview).
- **PDF**: jsPDF ^4.2.1 + jspdf-autotable ^5.0.8. FichaAnimal usa header retângulo azul `rgb(74,111,165)`, `secao()` com barra cinza `rgb(241,245,249)`, `linha(rotulo,valor)` com splitTextToSize e quebra `if (y>275) addPage`. TermoInternacao usa `MESES` (minúsculas) p/ data por extenso + `doc.line` para assinaturas. `mascararTelefone` em `@/lib/telefone`.
- **Replace-vínculos pattern** (junta): `src/app/junta-reguladora/actions.js` `cadastrarPacienteJunta` usa `prisma.$transaction(async (tx) => { upsert; tx.X.deleteMany({where}); tx.X.createMany({data}); })`.
- **Build**: `npm run build` (next build). Schema: `npm run db:push` (prisma db push) + `npm run db:generate`. Sem framework de teste JS para UI; verificação é build + prisma validate/push + checagem de colunas via psql quando disponível.

## Ambiguidades resolvidas

1. **`emTratamentoVeterinario` vs `emTratamentoContinuo`**: o schema atual tem `emTratamentoContinuo` (default "Sim"). A spec exige NOVO campo `emTratamentoVeterinario` para "Animal em tratamento veterinário?" e manda deixar `emTratamentoContinuo` intacto. Resolução: `emTratamentoContinuo` fica no schema sem uso na UI/form (não remover); a UI usa `emTratamentoVeterinario`. As quatro "Ciências" usam os novos campos `cienteTratamentoContinuo/Contencao/Epi/Residuos`.
2. **Termo: modal vs geração direta**: optar por **geração direta a partir da linha da lista** (botão "Termo" chama `obterEsporotricose(id)` e gera o PDF sem modal), que é mais simples e consistente com o fluxo do botão "Baixar PDF". Evita um 2º componente modal. Decisão registrada aqui.
3. **Agenda — merge**: estender `getAgendaProcedimentos` no mesmo arquivo (mesma função), adicionando uma query a `EsporotricoseVisita` e empurrando eventos `tipoEvento:"ESPORO_VISITA"`. Mantém PROCEDIMENTO/RETORNO intactos. A função já é a única fonte da agenda; evita criar sibling.
4. **Lista de visitas no form**: estado `form.visitas = [{data, observacao}]`; só persistidas quando `encAcompanhamentoCcz` true. Em `obterEsporotricose`, `visitas` vem como `[{data:YMD, observacao}]`.
5. **Guard "Abrir" na agenda**: eventos esporo não têm `procedimentoId`; o botão "Abrir" no modal do dia só aparece quando `e.tipoEvento` é PROCEDIMENTO (ou `e.procedimentoId` presente). Esporo visits não abrem nada.

---

## Itens

- [ ] 1. Estender o schema Prisma (model Esporotricose) e criar o model EsporotricoseVisita.
      No model `Esporotricose` existente, ADICIONAR (sem renomear/recriar nada; deixar `emTratamentoContinuo` como está):
      `emTratamentoVeterinario String? @default("Não") @map("em_tratamento_veterinario") @db.VarChar(10)`,
      `descricaoTratamentoVet String? @map("descricao_tratamento_vet")`,
      `cienteTratamentoContinuo String? @default("Não") @map("ciente_tratamento_continuo") @db.VarChar(10)`,
      `cienteContencao String? @default("Não") @map("ciente_contencao") @db.VarChar(10)`,
      `cienteEpi String? @default("Não") @map("ciente_epi") @db.VarChar(10)`,
      `cienteResiduos String? @default("Não") @map("ciente_residuos") @db.VarChar(10)`,
      `condicoesGeraisAmbiente String? @map("condicoes_gerais_ambiente")`,
      e a relação `visitas EsporotricoseVisita[]`.
      CRIAR novo model `EsporotricoseVisita` (@@map "ccz_esporotricose_visitas"): `id String @id @default(uuid()) @db.VarChar(50)`; `esporotricoseId String @map("esporotricose_id") @db.VarChar(50)`; `data DateTime @db.Date`; `observacao String?`; `createdAt DateTime? @default(now()) @map("created_at") @db.Timestamptz(6)`; relação `esporotricose Esporotricose @relation(fields:[esporotricoseId], references:[id], onDelete: Cascade)`; `@@index([esporotricoseId], map: "idx_esporo_visita")`.
      Files: prisma/schema.prisma
      Verify: `npm run db:push` seguido de `npm run db:generate` — ambos concluem sem erro; (se psql disponível) `psql -c "\d ccz_esporotricose"` mostra as 7 colunas novas e `\d ccz_esporotricose_visitas` mostra a tabela com índice `idx_esporo_visita`.

- [ ] 2. Adicionar as server actions de Esporotricose em actions.js.
      Anexar ao final de `src/app/ccz/actions.js`, mesmo estilo (bloco de cabeçalho com `═`, `requireAcessoModulo(MODULOS.CCZ)`, try/catch com tratamento 401/403 e P2003, retorno `{success,error?,data?}`). Reusar `ymdParaDateUTC`/`dateParaYMD`/`soDigitos` já existentes.
      - `salvarEsporotricose(dados)`: validar `animalId` e `dataVisita` (erros "Selecione o animal." / "Informe a data da visita."); id `(dados.id || `ESP-${Date.now().toString(36)}`).toUpperCase().slice(0,50)`; converter `dataVisita` com `ymdParaDateUTC`; enc* salvos como boolean `Boolean(dados.encX)`; demais Sim/Não como string "Sim"/"Não" (default "Não"); dentro de `prisma.$transaction(async (tx) => { ... })`: `tx.esporotricose.upsert({where:{id}, update:dadosEsporo, create:{id, ...dadosEsporo}})`; se `encAcompanhamentoCcz` true → `tx.esporotricoseVisita.deleteMany({where:{esporotricoseId:id}})` + `tx.esporotricoseVisita.createMany({data: visitasValidas.map(v => ({esporotricoseId:id, data: ymdParaDateUTC(v.data), observacao: v.observacao || null}))})` (apenas visitas com data não vazia); senão `tx.esporotricoseVisita.deleteMany({where:{esporotricoseId:id}})`. `revalidatePath("/ccz")`; retorno `{success, data:{id}}`.
      - `listarEsporotricose()`: `findMany({include:{animal:{include:{tutor:{include:{pessoa:true}}}}, _count:{select:{visitas:true}}}, orderBy:{dataVisita:"desc"}})`; mapear p/ `{id, animalId, animalNome, tutorNome, numeroProtocolo, dataVisita:YMD, apresentaLesoes, visitasCount: r._count.visitas}`.
      - `obterEsporotricose(id)`: `findUnique({where:{id}, include:{animal:{include:{tutor:{include:{pessoa:true}}}}, visitas:{orderBy:{data:"asc"}}}})`; retornar todos os campos do form + `animalLabel = `${animal?.nome?.trim()||"Sem nome"} (${animalId})``, `temTutor = Boolean(animal?.tutor)`, `tutorNome`, `tutor:{nome,cpf,telefone}` (via `animal.tutor.pessoa`), dados do animal (nome,id,especie,sexo "Fêmea"/"Macho",porte,idade), `dataVisita`/datas via `dateParaYMD`, `visitas: [{data:YMD, observacao}]`, enc* como boolean.
      - Estender `getAgendaProcedimentos(ano, mes)`: após montar eventos de PROCEDIMENTO/RETORNO (mantidos intactos), consultar `prisma.esporotricoseVisita.findMany({where:{data:{gte:inicio, lt:fim}}, include:{esporotricose:{include:{animal:{include:{tutor:{include:{pessoa:true}}}}}}}})` e empurrar eventos `{procedimentoId:null, tipoEvento:"ESPORO_VISITA", data: dateParaYMD(v.data), animalId, animalNome, tutorNome, label:`Esporotricose — acompanhamento (${animalNome})`}`. Reusar `inicio`/`fim` já calculados.
      Files: src/app/ccz/actions.js
      Verify: `npm run build` compila sem erro de import/sintaxe; as novas actions são exportadas (checar no build que `src/app/ccz` compila). Fluxo manual não automatizável aqui; confirmar ausência de erro de tipos Prisma via `npm run db:generate` já feito no item 1.

- [ ] 3. Criar o formulário CadastroEsporotricose.js.
      `src/app/ccz/CadastroEsporotricose.js` — espelhar `CadastroProcedimento.js`: `"use client"`, importar `styles from "./CadastroAnimal.module.css"`, `useConfirm/useNotify`, `buscarAnimaisCCZ, salvarEsporotricose`. Props `{registroInicial=null, onSalvo}`; `editando = Boolean(registroInicial?.id)`. `FORM_VAZIO` com todos os campos (dataVisita default hoje, todos Sim/Não default "Não", enc* default false, visitas:[], temTutor:false, tutorNome:""). Dropdown de animal: COPIAR exatamente o markup de CadastroProcedimento (colunas Id/Nome/Espécie/Tutor; `selecionarAnimal` seta `animalId`, input "Nome (Id)", e ADICIONAR `temTutor: Boolean(a.tutorNome)` e `tutorNome: a.tutorNome`). Seções via `styles.formSectionTitle`:
      - Identificação: Animal (dropdown), Data da visita (date → dataVisita), Número do protocolo (text → numeroProtocolo), Fiscal responsável (text → fiscalResponsavel).
      - Condição clínica: apresentaLesoes (select Sim/Não) → se "Sim" input "Qual?" (descricaoLesoes) via rowComposta/colControle/colAnexo; emTratamentoVeterinario (select) → se "Sim" textarea descricaoTratamentoVet.
      - Tratamento: medicamentosPrescritos (textarea); interrupcaoTratamento (select); retornoVeterinario (select).
      - Blocos TUTOR-ONLY (renderizar só se `form.temTutor`): Manejo domiciliar (isolamentoDomiciliar→observacoesIsolamento; acessoRua; usoEpi→quaisEpis; higienizacaoAmbiente); Outros animais e pessoas (outrosAnimaisResidencia→outrosAnimaisDescricao; pessoasComLesoes→pessoasLesoesDescricao); Ciência do responsável (4 selects: cienteTratamentoContinuo, cienteContencao, cienteEpi, cienteResiduos).
      - Avaliação (sempre): condicoesGeraisAmbiente (textarea), conclusaoTecnica (textarea).
      - Encaminhamentos sugeridos (sempre): 4 checkboxes encAcompanhamentoCcz/encNotificacaoTutor/encMinisterioPublico/encOutrasMedidas + textarea outrasMedidasDescricao.
      - Sub-seção AGENDA condicional (só quando encAcompanhamentoCcz marcado): "Agenda de acompanhamento" — input date + botão "Adicionar" (btnAdicionar) que faz append em `form.visitas`; cada linha mostra data dd/mm/aaaa + input opcional de observação + botão remover. Ao desmarcar encAcompanhamentoCcz, limpar `form.visitas`. Campos dependentes limpam/desabilitam quando controlador != "Sim" (padrão `retornoDesabilitado` do CadastroProcedimento).
      `salvar` chama `salvarEsporotricose(form)`; em sucesso `onSalvo()` (edição) ou `limpar()`.
      Files: src/app/ccz/CadastroEsporotricose.js
      Verify: `npm run build` — o componente compila sem erros de JSX/import.

- [ ] 4. Adicionar as classes CSS novas que o form/lista/agenda precisam.
      Apenas APPEND nos módulos existentes (não mexer em classes atuais):
      - `CadastroAnimal.module.css`: grupo de checkboxes dos encaminhamentos (ex. `.checkboxGroup`, `.checkboxItem`) e a mini-lista de visitas da agenda (ex. `.visitaLista`, `.visitaItem`, `.btnRemover`) — só se não houver classe reaproveitável equivalente.
      - `AgendaCCZ.module.css`: cor do novo tipo de evento `ESPORO_VISITA` (ex. `.eventEsporo` teal/verde: `background:#ccfbf1; color:#0f766e`) e entrada de legenda `.legEsporo` (mesmo esquema de legProc/legRet).
      Files: src/app/ccz/CadastroAnimal.module.css, src/app/ccz/AgendaCCZ.module.css
      Verify: `npm run build` — CSS modules compilam; nenhuma classe existente foi alterada (diff só adiciona blocos).

- [ ] 5. Renderizar o novo tipo de evento na AgendaCCZ.js.
      Em `src/app/ccz/AgendaCCZ.js`: adicionar entrada de legenda `.legEsporo` ("Esporotricose"); no `rotuloEvento`/render da célula, usar `e.label` quando `tipoEvento==="ESPORO_VISITA"` e aplicar `styles.eventEsporo`; no modal do dia, listar as visitas esporo com seu rótulo; o botão "Abrir" só deve renderizar quando `onAbrirProcedimento && e.procedimentoId` (eventos esporo têm `procedimentoId=null`, então não mostram "Abrir"). Não alterar o comportamento de PROCEDIMENTO/RETORNO.
      Files: src/app/ccz/AgendaCCZ.js
      Verify: `npm run build` compila; revisão visual do diff confirma que o guard do botão "Abrir" usa `e.procedimentoId`.

- [ ] 6. Criar o utilitário de PDF esporotricosePdf.js (relatório completo + termo).
      `src/app/ccz/esporotricosePdf.js` (módulo utilitário, sem "use client" — importado pelo componente client da lista). Exportar duas funções que recebem o `data` de `obterEsporotricose` e geram PDF com jsPDF (reusar estilo FichaAnimal/TermoInternacao: `secao()` com barra cinza, `linha(rotulo,valor)` com splitTextToSize + quebra `if(y>275) addPage`, `MESES` minúsculas, `mascararTelefone`):
      - `gerarPdfEsporotricose(data)`: relatório completo — header azul "Esporotricose — CCZ", Identificação (data visita, protocolo, fiscal), Dados do animal, Dados do tutor (se temTutor), Condição clínica, Tratamento, blocos tutor-only (Manejo, Outros animais/pessoas, 4 Ciências) só quando temTutor, Avaliação, Encaminhamentos (marcados + outrasMedidas) e datas de visitas agendadas. Filename `esporotricose-${data.id}.pdf`.
      - `gerarTermoEsporotricose(data)`: PDF "TERMO DE VISTORIA / ESPOROTRICOSE" + subtítulo "Centro de Controle de Zoonoses — Muriaé/MG" + data de emissão; TODAS as seções preenchidas do cadastro como documento formal; OMITIR blocos tutor-only quando sem tutor; ÁREA DE ASSINATURA: duas `doc.line` com legendas centralizadas "Assinatura do tutor/responsável" e "Assinatura do médico veterinário"; linha "Muriaé, ____ de __________ de ____" por extenso a partir de `dataVisita` (MESES); quebra de página `doc.addPage` perto do fim; filename `termo-esporotricose-${data.id}.pdf`.
      Files: src/app/ccz/esporotricosePdf.js
      Verify: `npm run build` — compila; funções exportadas sem erro de sintaxe/import.

- [ ] 7. Criar a lista EsporotricoseLista.js.
      `src/app/ccz/EsporotricoseLista.js` — espelhar `ProcedimentosLista.js`, `styles from "./ListaCCZ.module.css"`, importar `listarEsporotricose, obterEsporotricose` e `gerarPdfEsporotricose, gerarTermoEsporotricose` do item 6. Props `{onEditar}`. Colunas: Animal (boldName nome + subText `id · tutor`), Protocolo, Data da visita (dd/mm/aaaa), Lesões (apresentaLesoes Sim/Não), Nº visitas (badge via `visitasCount`), Ações. Busca filtra por animal/tutor/protocolo. Célula `acoesCell`: botão "Editar" (`btnEditar` → `onEditar(id)`), "Baixar PDF" (`btnFicha` → `const r = await obterEsporotricose(id); if (r.success) gerarPdfEsporotricose(r.data)`), "Termo" (`btnFicha` → `const r = await obterEsporotricose(id); if (r.success) gerarTermoEsporotricose(r.data)`).
      Files: src/app/ccz/EsporotricoseLista.js
      Verify: `npm run build` — compila; a lista importa as funções de PDF do item 6 corretamente.

- [ ] 8. Fazer o wiring da página ccz/page.js.
      Em `src/app/ccz/page.js`: importar `CadastroEsporotricose`, `EsporotricoseLista`, e `obterEsporotricose`. Adicionar estado `esporoEdicao`/`carregandoEsporo` (mesma forma de procedimentoEdicao/carregandoProcedimento). Adicionar `editarEsporo(id)` (carrega via `obterEsporotricose`, navega `irPara("ESPOROTRICOSE","CADASTRAR")`) e `voltarListaEsporo()` (`irPara("ESPOROTRICOSE","LISTA")`). No `useEffect` que limpa edição ao sair de CADASTRAR, limpar `esporoEdicao`. Adicionar branch `activeTab === "ESPOROTRICOSE"` com subTab LISTA → `<EsporotricoseLista onEditar={editarEsporo} />`, carregando → mensagem, senão `<CadastroEsporotricose key={esporoEdicao?.id || "novo"} registroInicial={esporoEdicao} onSalvo={voltarListaEsporo} />`. Colocar o branch junto aos demais (ex. antes de PROCEDIMENTOS ou AGENDA), sem alterar os existentes.
      Files: src/app/ccz/page.js
      Verify: `npm run build` — compila; navegação `?tab=ESPOROTRICOSE&subTab=CADASTRAR|LISTA` roteia para os novos componentes.

- [ ] 9. Adicionar o item de menu Esporotricose no Sidebar.
      Em `src/components/Sidebar.js`, dentro de `subItems` do CCZ, INSERIR depois de "Procedimentos" e ANTES do leaf "Agenda":
      `{ name:"Esporotricose", tab:"ESPOROTRICOSE", isNestedDropdown:true, visivelSe:"CCZ", nestedItems:[{name:"Cadastrar",subTab:"CADASTRAR",visivelSe:"CCZ"},{name:"Lista",subTab:"LISTA",visivelSe:"CCZ"}] }`.
      `subIcon(name)` já casa "esporotricose" (triângulo de alerta) — NÃO alterar; não causar regressão nos outros ícones.
      Files: src/components/Sidebar.js
      Verify: `npm run build` — compila; revisão do diff confirma a inserção na posição correta e nenhuma alteração nos outros subItems/ícones.

- [ ] 10. Verificação final completa.
      Rodar a build de produção e garantir árvore limpa de erros. Confirmar que módulos não relacionados (Junta, Regulação, Farmácia, Gerenciamento) não foram tocados e que env/git config não mudaram.
      Files: (nenhum — verificação)
      Verify: `npm run build` conclui com sucesso; `npm run lint` sem novos erros nos arquivos criados/alterados; (se psql disponível) `\d ccz_esporotricose` e `\d ccz_esporotricose_visitas` conferem o schema do item 1.

## Notas de verificação

- Não há suíte de testes de UI em JS; a verificação principal é `npm run build` após cada item que toca código client/server, mais `npm run db:push`/`db:generate` para o schema. Grep não conta como verificação — usar build/prisma.
- Ordem por dependência: schema (1) → actions (2) → form (3) → CSS (4) → agenda render (5) → PDF util (6) → lista (7) → página (8) → menu (9) → build final (10). Cada item deixa o repo compilável — o PDF util (6) é criado antes da lista (7) que o importa; a página (8) importa form e lista já existentes.
