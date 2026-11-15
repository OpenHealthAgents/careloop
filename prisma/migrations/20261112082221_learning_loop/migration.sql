-- CreateTable
CREATE TABLE "ExecutionLearningRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "populationSegment" TEXT NOT NULL,
    "urbanicity" TEXT NOT NULL,
    "coverageType" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL,
    "digitalAccessLevel" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "primaryBarrier" TEXT,
    "barrierSubCategory" TEXT,
    "primaryAction" TEXT,
    "interventionTypes" JSONB NOT NULL DEFAULT '[]',
    "executionStrategy" TEXT NOT NULL,
    "executionPath" JSONB NOT NULL DEFAULT '[]',
    "humanApprovalCount" INTEGER NOT NULL DEFAULT 0,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "humanIntervention" BOOLEAN NOT NULL DEFAULT false,
    "timeToResolutionMs" DOUBLE PRECISION,
    "agentRunCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "outreachAttempts" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUnits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalStatus" TEXT NOT NULL,
    "outcomeStatus" TEXT NOT NULL,
    "verifiedCompletion" BOOLEAN NOT NULL DEFAULT false,
    "barrierResolved" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionLearningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionLearningRecord_caseId_key" ON "ExecutionLearningRecord"("caseId");

-- CreateIndex
CREATE INDEX "ExecutionLearningRecord_tenantId_populationSegment_primaryB_idx" ON "ExecutionLearningRecord"("tenantId", "populationSegment", "primaryBarrier");

-- CreateIndex
CREATE INDEX "ExecutionLearningRecord_tenantId_primaryBarrier_executionSt_idx" ON "ExecutionLearningRecord"("tenantId", "primaryBarrier", "executionStrategy", "outcomeStatus");

-- CreateIndex
CREATE INDEX "ExecutionLearningRecord_tenantId_outcomeStatus_recordedAt_idx" ON "ExecutionLearningRecord"("tenantId", "outcomeStatus", "recordedAt");

-- AddForeignKey
ALTER TABLE "ExecutionLearningRecord" ADD CONSTRAINT "ExecutionLearningRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLearningRecord" ADD CONSTRAINT "ExecutionLearningRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
