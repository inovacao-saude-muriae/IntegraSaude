/*
  Warnings:

  - You are about to drop the column `localizacao` on the `ccz_denuncias` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ccz_denuncias" DROP COLUMN "localizacao",
ADD COLUMN     "bairro" VARCHAR(100),
ADD COLUMN     "cep" VARCHAR(10),
ADD COLUMN     "cidade" VARCHAR(100) DEFAULT 'Muriaé',
ADD COLUMN     "complemento" VARCHAR(100),
ADD COLUMN     "logradouro" VARCHAR(200),
ADD COLUMN     "numero" VARCHAR(20),
ADD COLUMN     "ponto_referencia" TEXT,
ADD COLUMN     "uf" VARCHAR(2) DEFAULT 'MG';
