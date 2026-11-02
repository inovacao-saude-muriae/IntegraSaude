# FASE 2 - MÉDIA PRIORIDADE
## IntegraSaúde - Correções em Lote (2025-01-20)

**Objetivo:** Melhorar experiência do usuário e performance  
**Estimativa:** 4 semanas  
**Prioridade:** MÉDIA

---

## #11 - Contraste de Cores (Acessibilidade)

**Descrição:**  
- Ajustar cores para mínimo WCAG AA (ratio 4.5:1)
- Implementar tema de alto contraste opcional

**Esforço:** 2 dias  
**Impacto:** MÉDIO  
**Módulos:** Global (todos)  
**Problema Original:** A11Y-003  
**Criticidade:** Não atende WCAG 2.1 AA

---

## #12 - Formulários com Validação Inline

**Descrição:**  
- Validação realtime (não só no submit)
- Indicador visual de campos obrigatórios (*)
- Mensagens de erro específicas

**Esforço:** 4 dias  
**Impacto:** MÉDIO  
**Módulos:** Todos com formulários  
**Problema Original:** UX-002, UX-003  
**Criticidade:** UX ruim - validações só aparecem no submit

---

## #13 - Feedback Visual Consistente

**Descrição:**  
- Loading spinners em todas operações assíncronas
- Mensagens de sucesso/erro padronizadas
- Toasts em vez de alerts nativos

**Esforço:** 3 dias  
**Impacto:** MÉDIO  
**Módulos:** Global (todos)  
**Problema Original:** UX-014, UX-015, FJ-TEC-002  
**Criticidade:** Feedback inconsistente confunde usuário

---

## #14 - Breadcrumbs e Navegação

**Descrição:**  
- Breadcrumbs em todas as páginas internas
- Indicador de página ativa na sidebar
- Botão voltar funcional

**Esforço:** 2 dias  
**Impacto:** BAIXO  
**Módulos:** Global (todos)  
**Problema Original:** UX-011, UX-012, SIDE-003  
**Criticidade:** Usuário pode se perder na navegação

---

## #15 - Cache de Queries (Performance)

**Descrição:**  
- Implementar React Query ou SWR
- Cache de listas auxiliares (médicos, UBS, etc)
- Invalidação inteligente

**Esforço:** 5 dias  
**Impacto:** MÉDIO  
**Módulos:** Global (todos)  
**Problema Original:** TEC-002, REG-TEC-001  
**Criticidade:** Múltiplas chamadas API desnecessárias

---

## #16 - Lazy Loading (Performance)

**Descrição:**  
- Componentes pesados com React.lazy
- Suspense boundaries
- Skeleton loaders

**Esforço:** 3 dias  
**Impacto:** BAIXO  
**Módulos:** Global (todos)  
**Problema Original:** TEC-004  
**Criticidade:** Carregamento inicial pode ser otimizado

---

## #17 - Otimização de Imagens

**Descrição:**  
- Migrar para next/image
- Compressão automática de uploads
- WebP/AVIF quando suportado

**Esforço:** 2 dias  
**Impacto:** BAIXO  
**Módulos:** CCZ (fotos de animais)  
**Problema Original:** TEC-003, CCZ-TEC-001  
**Criticidade:** Imagens não otimizadas geram arquivos grandes

---

## #18 - Rate Limiting (Segurança)

**Descrição:**  
- Limitar tentativas de login (5/min por IP)
- Rate limiting geral em APIs públicas

**Esforço:** 2 dias  
**Impacto:** MÉDIO  
**Módulos:** Autenticação, APIs  
**Problema Original:** SEG-002  
**Criticidade:** Sistema vulnerável a brute force attacks

---

## #19 - Auditoria e Logs (Segurança)

**Descrição:**  
- Sistema centralizado de logs
- Registro de todas operações sensíveis
- Tela de auditoria para gestores

**Esforço:** 4 dias  
**Impacto:** MÉDIO  
**Módulos:** Global (todos)  
**Problema Original:** TEC-013, REG-006  
**Criticidade:** Falta histórico de alterações para auditoria

---

## #20 - Recuperação de Senha

**Descrição:**  
- Fluxo de reset via email
- Token de recuperação com expiração
- Validação de força de nova senha

**Esforço:** 3 dias  
**Impacto:** BAIXO  
**Módulos:** Autenticação  
**Problema Original:** LOGIN-001, GER-004  
**Criticidade:** Sem recuperação de senha esquecida

---

## RESUMO DA FASE 2

**Total de Correções:** 10 itens (#11-20)  
**Esforço Total:** 30 dias (6 semanas)  
**Impacto:** MÉDIO - UX/UI, Performance e Segurança  
**Status:** PENDENTE
