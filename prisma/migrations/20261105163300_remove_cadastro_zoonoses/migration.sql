-- Remove the Zoonoses notification table (CadastroZoonoses model removed).
-- Safe to drop: no other table references ccz_zoonoses_notificacoes.
-- Its own FK to ccz_animais (ON DELETE CASCADE) is dropped together with the table.
DROP TABLE IF EXISTS "ccz_zoonoses_notificacoes";
