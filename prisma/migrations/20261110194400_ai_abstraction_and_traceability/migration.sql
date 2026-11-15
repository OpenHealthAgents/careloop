-- AlterEnum
ALTER TYPE "AIOperation" ADD VALUE 'MATCH_PROVIDER';

-- AlterTable
ALTER TABLE "AIRecommendation" ADD COLUMN     "inputContext" JSONB,
ADD COLUMN     "outputPayload" JSONB,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "resultingAction" TEXT;
