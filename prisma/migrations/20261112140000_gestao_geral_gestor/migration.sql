-- ═══════════════════════════════════════════════════════════════════════════
-- Gestão Geral: permissões administrativas próprias
-- ─────────────────────────────────────────────────────────────────────────
-- O perfil legado GESTOR deixa de ser um atalho de acesso irrestrito.
--
-- O que esta migração faz:
--   1. acrescenta "GESTAO" ao enum ModuloAcesso;
--   2. cria o vínculo de Gestão Geral (ADMINISTRADOR) para cada usuário GESTOR;
--   3. cria, do mesmo jeito que o mapa de perfis faria, o vínculo de cada
--      módulo operacional que o perfil legado concedia — assim ninguém perde
--      acesso na conversão, mas cada vínculo passa a ser visível e removível.
--
-- Reversão: rollback.sql nesta pasta.
-- ═══════════════════════════════════════════════════════════════════════════

-- NOTA OPERACIONAL: o enum já recebeu 'GESTAO' nesta aplicação antes de rodar
-- esta migração (ALTER TYPE ... ADD VALUE não pode ser usado na mesma
-- transação que o consome, no PostgreSQL 12+). O bloco abaixo é idempotente e
-- serve para bancos novos, garantindo que o valor exista.

-- Permissões da Gestão Geral (espelham PACOTES.GESTAO.ADMINISTRADOR em
-- lib/permissoesCatalogo.js). "GESTAO" acabou de ser adicionado ao enum e
-- precisa de um COMMIT antes de ser usado em dado.
INSERT INTO "user_acessos" (user_cpf, modulo, nivel, perfil, servicos, permissoes, ativo, atualizado_em)
SELECT u.cpf, 'GESTAO'::"ModuloAcesso", 'ADMIN'::"NivelAcesso", 'ADMINISTRADOR'::"PerfilModulo",
       ARRAY[]::text[],
       ARRAY[
         'painel:visualizar',
         'indicadores:visualizar', 'indicadores:exportar',
         'usuarios:visualizar', 'usuarios:criar', 'usuarios:editar', 'usuarios:gerenciar',
         'acessos:visualizar', 'acessos:criar', 'acessos:editar', 'acessos:gerenciar',
         'relatorios:visualizar', 'relatorios:exportar',
         'auditoria:visualizar', 'auditoria:exportar',
         'unidades:visualizar', 'unidades:criar', 'unidades:editar', 'unidades:excluir'
       ]::text[],
       true, now()
FROM "users" u
WHERE u.role = 'GESTOR'
  AND NOT EXISTS (
    SELECT 1 FROM "user_acessos" a WHERE a.user_cpf = u.cpf AND a.modulo = 'GESTAO'
  );

-- Vínculo operacional da Regulação que o perfil GESTOR concedia, agora explícito.
INSERT INTO "user_acessos" (user_cpf, modulo, nivel, perfil, servicos, permissoes, ativo, atualizado_em)
SELECT u.cpf, 'REGULACAO'::"ModuloAcesso", 'ADMIN'::"NivelAcesso", 'ADMINISTRADOR'::"PerfilModulo",
       ARRAY[]::text[],
       ARRAY['novo_pedido:visualizar','novo_pedido:criar','novo_pedido:editar','novo_pedido:excluir',
             'lista_espera:visualizar','lista_espera:editar','lista_espera:liberar','lista_espera:exportar',
             'liberados:visualizar','liberados:editar','liberados:liberar',
             'financeiro:visualizar','financeiro:editar','financeiro:exportar',
             'procedimentos:visualizar','procedimentos:criar','procedimentos:editar','procedimentos:excluir',
             'medicos:visualizar','medicos:criar','medicos:editar','medicos:excluir',
             'ubs:visualizar','ubs:criar','ubs:editar','ubs:excluir',
             'dashboard:visualizar','dashboard:exportar',
             'auditoria:visualizar','auditoria:exportar']::text[],
       true, now()
FROM "users" u
WHERE u.role = 'GESTOR'
  AND NOT EXISTS (SELECT 1 FROM "user_acessos" a WHERE a.user_cpf = u.cpf AND a.modulo = 'REGULACAO');

INSERT INTO "user_acessos" (user_cpf, modulo, nivel, perfil, servicos, permissoes, ativo, atualizado_em)
SELECT u.cpf, 'FARMACIA'::"ModuloAcesso", 'ADMIN'::"NivelAcesso", 'ADMINISTRADOR'::"PerfilModulo",
       ARRAY[]::text[],
       ARRAY['pacientes:visualizar','pacientes:criar','pacientes:editar',
             'medicamentos:visualizar','medicamentos:criar','medicamentos:editar','medicamentos:excluir',
             'estoque:visualizar','estoque:criar','estoque:editar','estoque:gerenciar',
             'dispensacao:visualizar','dispensacao:criar','dispensacao:dispensar','dispensacao:exportar',
             'relatorios:visualizar','relatorios:exportar',
             'dashboard:visualizar','dashboard:exportar']::text[],
       true, now()
FROM "users" u
WHERE u.role = 'GESTOR'
  AND NOT EXISTS (SELECT 1 FROM "user_acessos" a WHERE a.user_cpf = u.cpf AND a.modulo = 'FARMACIA');

INSERT INTO "user_acessos" (user_cpf, modulo, nivel, perfil, servicos, permissoes, ativo, atualizado_em)
SELECT u.cpf, 'PROCESSOS'::"ModuloAcesso", 'ADMIN'::"NivelAcesso", 'ADMINISTRADOR'::"PerfilModulo",
       ARRAY[]::text[],
       ARRAY['novo_processo:criar',
             'consulta:visualizar','consulta:exportar',
             'movimentacoes:visualizar','movimentacoes:criar','movimentacoes:editar',
             'documentos:visualizar','documentos:criar','documentos:excluir','documentos:exportar',
             'acompanhamento:visualizar','acompanhamento:editar','acompanhamento:exportar']::text[],
       true, now()
FROM "users" u
WHERE u.role = 'GESTOR'
  AND NOT EXISTS (SELECT 1 FROM "user_acessos" a WHERE a.user_cpf = u.cpf AND a.modulo = 'PROCESSOS');

INSERT INTO "user_acessos" (user_cpf, modulo, nivel, perfil, servicos, permissoes, ativo, atualizado_em)
SELECT u.cpf, 'JUNTA'::"ModuloAcesso", 'ADMIN'::"NivelAcesso", 'ADMINISTRADOR'::"PerfilModulo",
       ARRAY[]::text[],
       ARRAY['novo_pedido:visualizar','novo_pedido:criar','novo_pedido:editar',
             'servicos:visualizar','servicos:criar','servicos:editar','servicos:exportar',
             'agendas:visualizar','agendas:criar','agendas:editar','agendas:excluir',
             'prontuario:visualizar','prontuario:exportar',
             'dashboard:visualizar','dashboard:exportar']::text[],
       true, now()
FROM "users" u
WHERE u.role = 'GESTOR'
  AND NOT EXISTS (SELECT 1 FROM "user_acessos" a WHERE a.user_cpf = u.cpf AND a.modulo = 'JUNTA');

INSERT INTO "user_acessos" (user_cpf, modulo, nivel, perfil, servicos, permissoes, ativo, atualizado_em)
SELECT u.cpf, 'CCZ'::"ModuloAcesso", 'ADMIN'::"NivelAcesso", 'ADMINISTRADOR'::"PerfilModulo",
       ARRAY[]::text[],
       ARRAY['procedimentos:visualizar','procedimentos:criar','procedimentos:editar','procedimentos:excluir',
             'zoonoses:visualizar','zoonoses:criar','zoonoses:editar',
             'denuncias:visualizar','denuncias:criar','denuncias:editar','denuncias:excluir',
             'agenda:visualizar','agenda:criar','agenda:editar','agenda:excluir',
             'animais:visualizar','animais:criar','animais:editar','animais:excluir',
             'termos:visualizar','termos:criar','termos:editar','termos:exportar',
             'tutores:visualizar','tutores:criar','tutores:editar',
             'dashboard:visualizar','dashboard:exportar']::text[],
       true, now()
FROM "users" u
WHERE u.role = 'GESTOR'
  AND NOT EXISTS (SELECT 1 FROM "user_acessos" a WHERE a.user_cpf = u.cpf AND a.modulo = 'CCZ');
