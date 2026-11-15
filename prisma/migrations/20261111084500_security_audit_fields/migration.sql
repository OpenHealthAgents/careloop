-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "previousState" JSONB,
ADD COLUMN     "newState" JSONB,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'API';
