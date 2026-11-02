# Fase 2 - Correções de MÉDIA PRIORIDADE (#11-20)

## Status: EM ANDAMENTO

### ✅ Implementadas

1. **#11 - Validação de CNS Correta** [CONCLUÍDO]
   - Criado algoritmo oficial do CNS em `src/lib/validations/cns.js`
   - Suporte para CNS definitivo (1/2) e provisório (7/8/9)
   - Validação inline em `pessoas/page.js`
   - Commit: 0ac30de

2. **#12 - Modal de Liberação Mais Compacto** [CONCLUÍDO]
   - Layout reorganizado em 2 colunas
   - Redução de textareas de 3 para 2 rows
   - Ajuste de grid compacto em `LiberarPedido.js`
   - Commit: a901a7f

3. **#13 - Navegação por Teclado em Modais** [CONCLUÍDO]
   - Criado hook `useModalKeyboard`
   - Focus trapping (Tab fica dentro)
   - ESC fecha modal
   - Auto-focus no primeiro campo
   - Aplicado em ConfirmDialog, ModalConfirmacaoExclusao, Pessoas
   - Commit: 172c82e

4. **#14 - Suporte a Leitores de Tela (Básico)** [CONCLUÍDO]
   - aria-labels em botões de ícone
   - aria-describedby em campos com erro
   - aria-invalid em validações
   - aria-required em campos obrigatórios
   - Roles semânticos (dialog, alertdialog, listbox)
   - Aplicado em Header e formulário de Pessoas
   - Commit: 0b7294b

5. **#15 - Contraste de Cores WCAG AA** [CONCLUÍDO]
   - Ajustado text-muted: #94a3b8 → #64748b (4.63:1)
   - Documentação de conformidade WCAG AA
   - Verificação de todos os textos (mínimo 4.5:1)
   - Commit: 938c68d

6. **#16 - Rate Limiting no Login** [CONCLUÍDO]
   - 5 tentativas por minuto por IP
   - Bloqueio após 10 falhas consecutivas (30min)
   - In-memory tracking com auto-cleanup
   - Mensagens de erro com contadores
   - Implementado em `actions/auth.js`
   - Commit: f2d8d56

### 🔄 Em Implementação

7. **#17 - Recuperação de Senha**
   - TODO: Criar fluxo "Esqueci minha senha"
   - TODO: Sistema de token com expiração (30min)
   - TODO: Envio por email/SMS (mock inicial)

8. **#18 - Breadcrumbs e Indicador de Página Ativa**
   - TODO: Breadcrumbs no Header
   - TODO: Highlight na Sidebar

9. **#19 - Validação Inline em Formulários**
   - PARCIAL: Já implementado em Pessoas (CNS)
   - TODO: Aplicar em outros formulários principais

10. **#20 - Loading Spinners Consistentes**
    - TODO: Componente global de loading
    - TODO: Skeleton loaders em listas
    - TODO: Desabilitar botões durante carregamento

## Próximos Passos

1. Implementar recuperação de senha (#17)
2. Adicionar breadcrumbs (#18)
3. Expandir validação inline (#19)
4. Padronizar loading states (#20)
5. Executar build para validação
6. Documentar testes realizados

## Notas Técnicas

- Next.js 16.3.0 com React 19
- Server Actions para auth
- Hooks personalizados para modals
- In-memory rate limiting (considerar Redis em produção)
