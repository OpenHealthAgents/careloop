-- CreateEnum
CREATE TYPE "InterventionExecutionMode" AS ENUM ('AUTOMATED', 'HUMAN_ASSISTED', 'HUMAN_ONLY');

-- AlterTable
ALTER TABLE "Intervention" ADD COLUMN     "executionMode" "InterventionExecutionMode" NOT NULL DEFAULT 'HUMAN_ASSISTED',
ADD COLUMN     "isHighRisk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
ADD COLUMN     "requiredHumanInvolvement" TEXT NOT NULL DEFAULT 'Care Manager review and approval required prior to execution.',
ADD COLUMN     "expectedOutcome" TEXT NOT NULL DEFAULT 'Coordinate next step toward confirmed behavioral-health appointment.',
ADD COLUMN     "autoExecuted" BOOLEAN NOT NULL DEFAULT false;
