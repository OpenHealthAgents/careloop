/*
  Warnings:

  - You are about to drop the column `aiTraceId` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `outcome` on the `Intervention` table. All the data in the column will be lost.
  - The `status` column on the `Referral` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `AITrace` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CareCase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CaseBarrier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CaseWorkflowEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OutreachAttempt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProviderSlot` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CARE_MANAGER', 'HEALTH_EQUITY_ANALYST', 'OPERATIONS_USER', 'EXECUTIVE_READ_ONLY');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('RECEIVED', 'TRIAGED', 'IN_CASE', 'APPOINTMENT_SCHEDULED', 'COMPLETED', 'CLOSED_UNRESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'MODIFIED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "WorkflowEventType" AS ENUM ('CASE_CREATED', 'STATUS_TRANSITION', 'RISK_ASSESSED', 'BARRIER_IDENTIFIED', 'BARRIER_CONFIRMED', 'INTERVENTION_RECOMMENDED', 'INTERVENTION_APPROVED', 'INTERVENTION_MODIFIED', 'INTERVENTION_REJECTED', 'INTERVENTION_COMPLETED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_COMPLETED', 'APPOINTMENT_NO_SHOW', 'ESCALATED', 'COMPLETION_VERIFIED', 'CASE_CLOSED');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('SMS', 'PHONE', 'EMAIL', 'PORTAL', 'IN_PERSON_NAVIGATOR');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('DRAFT', 'SENT', 'DELIVERED', 'RESPONDED', 'NO_RESPONSE', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'DISMISSED');

-- DropForeignKey
ALTER TABLE "AITrace" DROP CONSTRAINT "AITrace_caseId_fkey";

-- DropForeignKey
ALTER TABLE "AITrace" DROP CONSTRAINT "AITrace_referralId_fkey";

-- DropForeignKey
ALTER TABLE "AITrace" DROP CONSTRAINT "AITrace_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_caseId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CareCase" DROP CONSTRAINT "CareCase_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "CareCase" DROP CONSTRAINT "CareCase_matchedProviderId_fkey";

-- DropForeignKey
ALTER TABLE "CareCase" DROP CONSTRAINT "CareCase_memberId_fkey";

-- DropForeignKey
ALTER TABLE "CareCase" DROP CONSTRAINT "CareCase_referralId_fkey";

-- DropForeignKey
ALTER TABLE "CareCase" DROP CONSTRAINT "CareCase_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CaseBarrier" DROP CONSTRAINT "CaseBarrier_caseId_fkey";

-- DropForeignKey
ALTER TABLE "CaseBarrier" DROP CONSTRAINT "CaseBarrier_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CaseWorkflowEvent" DROP CONSTRAINT "CaseWorkflowEvent_caseId_fkey";

-- DropForeignKey
ALTER TABLE "CaseWorkflowEvent" DROP CONSTRAINT "CaseWorkflowEvent_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CompletionVerification" DROP CONSTRAINT "CompletionVerification_caseId_fkey";

-- DropForeignKey
ALTER TABLE "Intervention" DROP CONSTRAINT "Intervention_caseId_fkey";

-- DropForeignKey
ALTER TABLE "OutreachAttempt" DROP CONSTRAINT "OutreachAttempt_caseId_fkey";

-- DropForeignKey
ALTER TABLE "OutreachAttempt" DROP CONSTRAINT "OutreachAttempt_interventionId_fkey";

-- DropForeignKey
ALTER TABLE "OutreachAttempt" DROP CONSTRAINT "OutreachAttempt_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderSlot" DROP CONSTRAINT "ProviderSlot_providerId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderSlot" DROP CONSTRAINT "ProviderSlot_tenantId_fkey";

-- AlterTable
ALTER TABLE "Intervention" DROP COLUMN "aiTraceId",
DROP COLUMN "outcome",
ADD COLUMN     "aiRecommendationId" TEXT;

-- AlterTable
ALTER TABLE "Referral" DROP COLUMN "status",
ADD COLUMN     "status" "ReferralStatus" NOT NULL DEFAULT 'RECEIVED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roleId" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL;

-- DropTable
DROP TABLE "AITrace";

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "CareCase";

-- DropTable
DROP TABLE "CaseBarrier";

-- DropTable
DROP TABLE "CaseWorkflowEvent";

-- DropTable
DROP TABLE "OutreachAttempt";

-- DropTable
DROP TABLE "ProviderSlot";

-- DropEnum
DROP TYPE "HumanReviewDecision";

-- DropEnum
DROP TYPE "RiskTier";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" "UserRole" NOT NULL,
    "customCode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'INTAKE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAvailability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "slotStartAt" TIMESTAMP(3) NOT NULL,
    "slotEndAt" TIMESTAMP(3) NOT NULL,
    "modality" TEXT NOT NULL,
    "source" "AvailabilitySource" NOT NULL DEFAULT 'VERIFIED_AVAILABILITY',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "waitDaysEstimate" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "matchedProviderId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'NEW',
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "riskExplanation" TEXT,
    "primaryBarrierCategory" "BarrierCategory",
    "primaryBarrierCode" TEXT,
    "escalationReason" TEXT,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "firstCompletedVisitAt" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barrier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "category" "BarrierCategory" NOT NULL,
    "subBarrier" TEXT NOT NULL,
    "epistemicStatus" "EpistemicStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "evidenceSignals" JSONB NOT NULL DEFAULT '[]',
    "uncertainty" TEXT,
    "confirmedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "confirmedById" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Barrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "uncertainty" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "humanEscalationSuggested" BOOLEAN NOT NULL DEFAULT false,
    "evidenceSignals" JSONB NOT NULL DEFAULT '[]',
    "providerName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "referralId" TEXT,
    "operation" "AIOperation" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "providerName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "inferences" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "uncertainty" TEXT NOT NULL,
    "evidenceSignals" JSONB NOT NULL,
    "humanReviewerId" TEXT,
    "humanReviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionOutcome" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "outcomeStatus" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "barriersResolved" BOOLEAN NOT NULL DEFAULT false,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "evidence" JSONB,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "interventionId" TEXT,
    "consentId" TEXT,
    "aiRecommendationId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "language" TEXT NOT NULL DEFAULT 'English',
    "draftedByAi" BOOLEAN NOT NULL DEFAULT false,
    "humanApprovedById" TEXT,
    "messageSummary" TEXT NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'DRAFT',
    "memberResponseSummary" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" "WorkflowEventType" NOT NULL DEFAULT 'STATUS_TRANSITION',
    "fromStatus" "CaseStatus",
    "toStatus" "CaseStatus" NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "correlationId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquityMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cohortDimension" TEXT NOT NULL,
    "cohortValue" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalReferrals" INTEGER NOT NULL,
    "completedVisits" INTEGER NOT NULL,
    "completionRatePct" DOUBLE PRECISION NOT NULL,
    "avgTimeToCareDays" DOUBLE PRECISION,
    "disparityGapPctPoints" DOUBLE PRECISION NOT NULL,
    "topBarrierCategory" "BarrierCategory",
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquityMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "caseId" TEXT,
    "appointmentId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "notificationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Role_code_idx" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_code_customCode_key" ON "Role"("tenantId", "code", "customCode");

-- CreateIndex
CREATE INDEX "Consent_tenantId_memberId_idx" ON "Consent"("tenantId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_tenantId_memberId_channel_purpose_key" ON "Consent"("tenantId", "memberId", "channel", "purpose");

-- CreateIndex
CREATE INDEX "ProviderAvailability_tenantId_providerId_status_slotStartAt_idx" ON "ProviderAvailability"("tenantId", "providerId", "status", "slotStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "Case_referralId_key" ON "Case"("referralId");

-- CreateIndex
CREATE INDEX "Case_tenantId_status_priorityScore_idx" ON "Case"("tenantId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "Case_tenantId_riskLevel_idx" ON "Case"("tenantId", "riskLevel");

-- CreateIndex
CREATE INDEX "Barrier_tenantId_caseId_idx" ON "Barrier"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "Barrier_tenantId_category_idx" ON "Barrier"("tenantId", "category");

-- CreateIndex
CREATE INDEX "RiskAssessment_tenantId_caseId_assessedAt_idx" ON "RiskAssessment"("tenantId", "caseId", "assessedAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_tenantId_caseId_createdAt_idx" ON "AIRecommendation"("tenantId", "caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_tenantId_operation_status_idx" ON "AIRecommendation"("tenantId", "operation", "status");

-- CreateIndex
CREATE INDEX "InterventionOutcome_tenantId_interventionId_idx" ON "InterventionOutcome"("tenantId", "interventionId");

-- CreateIndex
CREATE INDEX "Communication_tenantId_caseId_idx" ON "Communication"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "Communication_tenantId_memberId_idx" ON "Communication"("tenantId", "memberId");

-- CreateIndex
CREATE INDEX "WorkflowEvent_tenantId_caseId_createdAt_idx" ON "WorkflowEvent"("tenantId", "caseId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowEvent_tenantId_eventType_idx" ON "WorkflowEvent"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_idx" ON "AuditEvent"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_correlationId_idx" ON "AuditEvent"("tenantId", "correlationId");

-- CreateIndex
CREATE INDEX "EquityMetric_tenantId_cohortDimension_computedAt_idx" ON "EquityMetric"("tenantId", "cohortDimension", "computedAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_status_createdAt_idx" ON "Notification"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_recipientUserId_idx" ON "Notification"("tenantId", "recipientUserId");

-- CreateIndex
CREATE INDEX "Referral_tenantId_status_referralDate_idx" ON "Referral"("tenantId", "status", "referralDate");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAvailability" ADD CONSTRAINT "ProviderAvailability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAvailability" ADD CONSTRAINT "ProviderAvailability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_matchedProviderId_fkey" FOREIGN KEY ("matchedProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrier" ADD CONSTRAINT "Barrier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrier" ADD CONSTRAINT "Barrier_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_humanReviewerId_fkey" FOREIGN KEY ("humanReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_aiRecommendationId_fkey" FOREIGN KEY ("aiRecommendationId") REFERENCES "AIRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOutcome" ADD CONSTRAINT "InterventionOutcome_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOutcome" ADD CONSTRAINT "InterventionOutcome_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOutcome" ADD CONSTRAINT "InterventionOutcome_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "Consent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_aiRecommendationId_fkey" FOREIGN KEY ("aiRecommendationId") REFERENCES "AIRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionVerification" ADD CONSTRAINT "CompletionVerification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityMetric" ADD CONSTRAINT "EquityMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
