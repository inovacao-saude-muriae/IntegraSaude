-- CCZ > Animais: campos de identificação do animal migrados da ficha de
-- Leishmaniose para o cadastro central (não existiam colunas equivalentes).
ALTER TABLE "ccz_animais"
  ADD COLUMN "raca_pelagem" VARCHAR(100),
  ADD COLUMN "possui_identificacao" VARCHAR(10) DEFAULT 'Não';
