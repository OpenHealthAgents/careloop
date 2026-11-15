-- CreateTable
CREATE TABLE "AIDecisionTrace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputContextHash" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "policyResult" TEXT NOT NULL,
    "toolSelected" TEXT NOT NULL,
    "humanApprovalRequired" BOOLEAN NOT NULL,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIDecisionTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIDecisionTrace_tenantId_caseId_createdAt_idx" ON "AIDecisionTrace"("tenantId", "caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIDecisionTrace_tenantId_agent_createdAt_idx" ON "AIDecisionTrace"("tenantId", "agent", "createdAt");

-- CreateIndex
CREATE INDEX "AIDecisionTrace_tenantId_inputContextHash_idx" ON "AIDecisionTrace"("tenantId", "inputContextHash");

-- AddForeignKey
ALTER TABLE "AIDecisionTrace" ADD CONSTRAINT "AIDecisionTrace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIDecisionTrace" ADD CONSTRAINT "AIDecisionTrace_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
