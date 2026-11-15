-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "agentRunId" TEXT,
    "toolExecutionSpanId" TEXT,
    "sourceType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "capturedBy" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evidence_tenantId_caseId_capturedAt_idx" ON "Evidence"("tenantId", "caseId", "capturedAt");

-- CreateIndex
CREATE INDEX "Evidence_tenantId_sourceType_idx" ON "Evidence"("tenantId", "sourceType");

-- CreateIndex
CREATE INDEX "Evidence_tenantId_deletedAt_idx" ON "Evidence"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Case_tenantId_deletedAt_idx" ON "Case"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Member_tenantId_deletedAt_idx" ON "Member"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Provider_tenantId_deletedAt_idx" ON "Provider"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Referral_tenantId_deletedAt_idx" ON "Referral"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "User_tenantId_deletedAt_idx" ON "User"("tenantId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
