-- CreateEnum
CREATE TYPE "ExecutionActorType" AS ENUM ('AGENT', 'HUMAN', 'SYSTEM', 'TOOL');

-- CreateTable
CREATE TABLE "ExecutionJournalEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorType" "ExecutionActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputReference" TEXT,
    "outputReference" TEXT,
    "policyDecision" TEXT,
    "evidence" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionJournalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutionJournalEvent_tenantId_caseId_timestamp_idx" ON "ExecutionJournalEvent"("tenantId", "caseId", "timestamp");

-- CreateIndex
CREATE INDEX "ExecutionJournalEvent_tenantId_eventType_timestamp_idx" ON "ExecutionJournalEvent"("tenantId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "ExecutionJournalEvent_tenantId_correlationId_idx" ON "ExecutionJournalEvent"("tenantId", "correlationId");

-- AddForeignKey
ALTER TABLE "ExecutionJournalEvent" ADD CONSTRAINT "ExecutionJournalEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionJournalEvent" ADD CONSTRAINT "ExecutionJournalEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
