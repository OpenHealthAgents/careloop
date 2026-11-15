-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('STARTED', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "agent" TEXT NOT NULL DEFAULT 'CareLoopCaseOrchestrator',
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'STARTED',
    "correlationId" TEXT,
    "decisionTraceId" TEXT,
    "approvalRequestId" TEXT,
    "policyResult" TEXT,
    "latencyMs" INTEGER,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolExecutionSpan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "agentRunId" TEXT,
    "tool" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "policyDecision" TEXT,
    "replayed" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolExecutionSpan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRun_tenantId_caseId_startedAt_idx" ON "AgentRun"("tenantId", "caseId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_tenantId_status_startedAt_idx" ON "AgentRun"("tenantId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_tenantId_correlationId_idx" ON "AgentRun"("tenantId", "correlationId");

-- CreateIndex
CREATE INDEX "ToolExecutionSpan_tenantId_caseId_startedAt_idx" ON "ToolExecutionSpan"("tenantId", "caseId", "startedAt");

-- CreateIndex
CREATE INDEX "ToolExecutionSpan_tenantId_tool_startedAt_idx" ON "ToolExecutionSpan"("tenantId", "tool", "startedAt");

-- CreateIndex
CREATE INDEX "ToolExecutionSpan_tenantId_correlationId_idx" ON "ToolExecutionSpan"("tenantId", "correlationId");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecutionSpan" ADD CONSTRAINT "ToolExecutionSpan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecutionSpan" ADD CONSTRAINT "ToolExecutionSpan_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecutionSpan" ADD CONSTRAINT "ToolExecutionSpan_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
