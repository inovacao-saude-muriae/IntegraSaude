# FASE 1 - ALTA PRIORIDADE
## IntegraSaúde - Correções em Lote (2025-01-20)

**Objetivo:** Completar funcionalidades essenciais e melhorar UX  
**Estimativa:** 3 semanas  
**Prioridade:** ALTA

---

## #4 - Paginação Server-Side

**Descrição:**  
Implementar paginação em todas as listas do sistema (20 itens/página) com controles de navegação e indicador "Mostrando X de Y".

**Esforço:** 5 dias  
**Impacto:** ALTO  
**Módulos Afetados:**
- Regulação (Lista de Espera, Liberados)
- Farmácia Judicial (Pacientes, Medicamentos, Estoque)
- CCZ (Tutores, Animais, Procedimentos, Esporotricose, Zoonoses, Denúncias)
- Junta Reguladora (Pacientes por serviço)
- Gerenciamento (Pessoas, Usuários, Médicos, UBS)

**Problema Original:** REG-001, GER-006, UX-006  
**Criticidade:** Sistema apresenta performance ruim com muitos registros

---

## #6 - Prontuário PDF (Junta Reguladora)

**Descrição:**  
Gerar PDF completo do prontuário unificado incluindo todos os atendimentos e serviços do paciente.

**Esforço:** 2 dias  
**Impacto:** ALTO  
**Módulo:** Junta Reguladora  
**Problema Original:** JR-001  
**Criticidade:** Funcionalidade incompleta - prontuário só visualiza na tela

---

## #7 - Alertas de Estoque (Farmácia Judicial)

**Descrição:**  
- Notificação de medicamentos próximos ao vencimento (30 dias)
- Alerta de estoque baixo (< 20% do mínimo)
- Dashboard com alertas pendentes

**Esforço:** 4 dias  
**Impacto:** ALTO  
**Módulo:** Farmácia Judicial  
**Problema Original:** FJ-001, FJ-002  
**Criticidade:** Risco de perda de medicamentos e falta no estoque

---

## #8 - Busca e Filtros de Usuários (Gerenciamento)

**Descrição:**  
Implementar:
- Input de busca por nome/CPF
- Filtro por perfil
- Filtro por status (ativo/inativo)

**Esforço:** 2 dias  
**Impacto:** ALTO  
**Módulo:** Gerenciamento  
**Problema Original:** GER-001  
**Criticidade:** Difícil gerenciar muitos usuários sem busca

---

## #9 - Navegação por Teclado (Acessibilidade)

**Descrição:**  
Implementar navegação completa por teclado:
- Focus trapping em modais
- Focus visible em todos os elementos interativos
- Tab order lógico
- Atalhos de teclado (Ctrl+S, Esc, etc)

**Esforço:** 4 dias  
**Impacto:** ALTO  
**Módulos:** Global (todos)  
**Problema Original:** A11Y-001  
**Criticidade:** Sistema inacessível para usuários com deficiência motora

---

## #10 - Suporte a Leitores de Tela (Acessibilidade)

**Descrição:**  
Implementar suporte completo a leitores de tela:
- aria-labels em botões de ícone
- aria-describedby em formulários
- roles semânticos (navigation, main, complementary)
- aria-live para mensagens dinâmicas

**Esforço:** 5 dias  
**Impacto:** ALTO  
**Módulos:** Global (todos)  
**Problema Original:** A11Y-002  
**Criticidade:** Sistema inacessível para usuários cegos - não atende WCAG 2.1

---

## RESUMO DA FASE 1

**Total de Correções:** 6 itens (#4, #6-10)  
**Esforço Total:** 22 dias (4.4 semanas)  
**Impacto:** ALTO - Funcionalidades essenciais e acessibilidade  
**Status:** PENDENTE
