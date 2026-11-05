-- Remove the protocol number field from Esporotricose (numeroProtocolo removed from model).
-- Backup of (id, numero_protocolo) saved under .agents/tasks/remove-esporotricose-protocolo/backup-numero_protocolo.csv before dropping.
ALTER TABLE "ccz_esporotricose" DROP COLUMN "numero_protocolo";
