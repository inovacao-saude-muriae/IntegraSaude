-- A "Situação geral" da ficha de Leishmaniose é uma das três frases da equipe
-- técnica; a mais longa tem 57 caracteres. A coluna nasceu com 40 e truncava.
ALTER TABLE "ccz_leishmaniose" ALTER COLUMN "situacao_geral" TYPE VARCHAR(80);
