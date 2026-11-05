-- AlterTable
ALTER TABLE "ccz_esporotricose" ADD COLUMN     "encerrado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "data_encerramento" TIMESTAMPTZ(6),
ADD COLUMN     "encerrado_por" VARCHAR(150);
