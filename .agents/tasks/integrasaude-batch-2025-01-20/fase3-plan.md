# FASE 3 - BAIXA PRIORIDADE
## IntegraSaúde - Correções em Lote (2025-01-20)

**Objetivo:** Melhorias adicionais e funcionalidades secundárias  
**Estimativa:** 2 semanas  
**Prioridade:** BAIXA

---

## #21 - Filtros Persistentes (Regulação)

**Descrição:**  
Implementar persistência de filtros ao navegar entre abas de tipos de exame na Lista de Espera e Liberados.

**Esforço:** 1 dia  
**Impacto:** BAIXO  
**Módulo:** Regulação  
**Problema Original:** REG-002  
**Criticidade:** Filtros se perdem ao trocar de aba

---

## #22 - Impressão de Guias (Regulação)

**Descrição:**  
- Template PDF de guia de encaminhamento/autorização
- QR Code de verificação
- Dados completos do paciente e procedimento

**Esforço:** 3 dias  
**Impacto:** MÉDIO  
**Módulo:** Regulação  
**Problema Original:** REG-003  
**Criticidade:** Fluxo incompleto - falta documento oficial

---

## #23 - Validação de Datas (Regulação)

**Descrição:**  
- Data de comunicação limitada a hoje ou passado (não futuras)
- Validação de datas em formulários

**Esforço:** 1 dia  
**Impacto:** BAIXO  
**Módulo:** Regulação  
**Problema Original:** REG-004  
**Criticidade:** Permite datas inconsistentes

---

## #24 - Histórico de Dispensações com Filtro (Farmácia)

**Descrição:**  
Adicionar filtro por período no histórico de dispensações de medicamentos.

**Esforço:** 1 dia  
**Impacto:** BAIXO  
**Módulo:** Farmácia Judicial  
**Problema Original:** FJ-004  
**Criticidade:** Histórico sem filtro dificulta análise

---

## #25 - Workflow de Denúncias (CCZ)

**Descrição:**  
Implementar status de tratamento das denúncias:
- Recebido
- Em Investigação
- Resolvido
- Arquivado

**Esforço:** 2 dias  
**Impacto:** MÉDIO  
**Módulo:** CCZ  
**Problema Original:** CCZ-003  
**Criticidade:** Denúncias não têm acompanhamento de status

---

## CORREÇÕES ADICIONAIS IDENTIFICADAS (Não Solicitadas)

As correções abaixo foram identificadas na auditoria mas NÃO foram solicitadas pelo usuário. Documentadas apenas para referência futura.

### Correções Críticas Remanescentes
- **#1-3**: Responsividade crítica (sidebar, tabelas, formulários) - já foram tratadas em tarefas anteriores

### Outras Melhorias Sugeridas
- Agenda CCZ com interface de criação direta
- Relatório de esporotricose por bairro
- Validação de tamanho de upload de fotos
- Cancelamento de agendamentos (Junta Reguladora)
- Validação de CNS com algoritmo oficial
- Dashboard administrativo
- Relatório de acessos ao sistema
- Gráficos de evolução no Dashboard de Regulação
- Ordenação de colunas em tabelas
- Estado de expansão persistente na sidebar
- Sistema de notificações no header
- Relatório de comparecimento (Junta Reguladora)
- Relatório de custo por paciente (Farmácia)

---

## RESUMO DA FASE 3

**Total de Correções:** 5 itens (#21-25)  
**Esforço Total:** 8 dias (1.6 semanas)  
**Impacto:** BAIXO - Funcionalidades secundárias e melhorias pontuais  
**Status:** PENDENTE

---

## OBSERVAÇÃO IMPORTANTE

Esta fase contém correções de menor impacto. Recomenda-se priorizar apenas após conclusão das Fases 1 e 2, ou quando houver capacidade de desenvolvimento disponível.
