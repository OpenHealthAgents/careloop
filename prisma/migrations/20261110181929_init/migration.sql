-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CARE_MANAGER', 'HEALTH_EQUITY_ANALYST', 'OPERATIONS_USER', 'EXECUTIVE_READ_ONLY');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('NEW', 'TRIAGED', 'BARRIER_IDENTIFIED', 'INTERVENTION_RECOMMENDED', 'INTERVENTION_IN_PROGRESS', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_COMPLETED', 'VERIFIED', 'CLOSED', 'ESCALATED', 'BLOCKED', 'REQUIRES_HUMAN_REVIEW', 'LOST_TO_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BarrierCategory" AS ENUM ('ACCESS', 'ADMINISTRATIVE', 'FINANCIAL', 'COMMUNICATION', 'BEHAVIORAL', 'SOCIAL_LOGISTICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EpistemicStatus" AS ENUM ('FACT', 'INFERENCE');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('ALTERNATIVE_PROVIDER_SEARCH', 'LANGUAGE_COMPATIBLE_PROVIDER_SEARCH', 'ASSISTED_SCHEDULING', 'TRANSPORTATION_SUPPORT', 'BENEFIT_NETWORK_EXPLANATION', 'REFERRAL_COMPLETION_ASSISTANCE', 'MISSED_APPOINTMENT_REENGAGEMENT', 'HUMAN_OUTREACH', 'ESCALATION');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('RECOMMENDED', 'APPROVED', 'MODIFIED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AvailabilitySource" AS ENUM ('VERIFIED_AVAILABILITY', 'DIRECTORY_INFORMATION', 'NOT_AVAILABLE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PROPOSED', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "VerificationSignalType" AS ENUM ('APPOINTMENT_SCHEDULED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_COMPLETED', 'CLAIM_RECEIVED', 'PROVIDER_CONFIRMATION', 'MEMBER_CONFIRMATION', 'SUBSEQUENT_TREATMENT_ENGAGEMENT');

-- CreateEnum
CREATE TYPE "AIOperation" AS ENUM ('CLASSIFY_BARRIER', 'CALCULATE_RISK', 'RECOMMEND_INTERVENTION', 'SUMMARIZE_CASE', 'GENERATE_COMMUNICATION');

-- CreateEnum
CREATE TYPE "HumanReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'MODIFIED', 'REJECTED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "customRoleCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalMemberId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dobYear" INTEGER,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'English',
    "geography" TEXT NOT NULL,
    "urbanicity" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "coverageType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "eligibilityStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "networkName" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "preferredContactChannel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "consentOutreach" BOOLEAN NOT NULL DEFAULT true,
    "consentSms" BOOLEAN NOT NULL DEFAULT false,
    "raceEthnicityCohort" TEXT,
    "ageGroupCohort" TEXT,
    "digitalAccessLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "transportationAccess" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "priorNoShowCount" INTEGER NOT NULL DEFAULT 0,
    "historicalEngagementRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'CSV',
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL,
    "errorRows" INTEGER NOT NULL,
    "errorsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "ingestionBatchId" TEXT,
    "externalReferralId" TEXT NOT NULL,
    "referralDate" TIMESTAMP(3) NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'CSV_IMPORT',
    "behavioralHealthNeed" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "geography" TEXT NOT NULL,
    "networkRequired" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'English',
    "eligibilityVerified" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "referringProviderName" TEXT,
    "operationalNotes" TEXT,
    "rawPayload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "npi" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "networkNames" TEXT[],
    "languages" TEXT[],
    "geography" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "telehealthAvailable" BOOLEAN NOT NULL DEFAULT false,
    "acceptingNewPatients" BOOLEAN NOT NULL DEFAULT true,
    "availabilitySource" "AvailabilitySource" NOT NULL DEFAULT 'DIRECTORY_INFORMATION',
    "nextVerifiedSlotAt" TIMESTAMP(3),
    "directoryWaitDays" INTEGER,
    "availabilityLastVerifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderSlot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "slotStartAt" TIMESTAMP(3) NOT NULL,
    "slotEndAt" TIMESTAMP(3) NOT NULL,
    "modality" TEXT NOT NULL,
    "source" "AvailabilitySource" NOT NULL DEFAULT 'VERIFIED_AVAILABILITY',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "matchedProviderId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'NEW',
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "riskTier" "RiskTier" NOT NULL DEFAULT 'UNKNOWN',
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

    CONSTRAINT "CareCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseBarrier" (
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

    CONSTRAINT "CaseBarrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "InterventionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeringBarrierCategory" "BarrierCategory",
    "triggeringBarrierCode" TEXT,
    "recommendedAction" TEXT NOT NULL,
    "automationEligible" BOOLEAN NOT NULL DEFAULT false,
    "assignedOwnerId" TEXT,
    "status" "InterventionStatus" NOT NULL DEFAULT 'RECOMMENDED',
    "epistemicOrigin" TEXT NOT NULL DEFAULT 'AI_RECOMMENDATION',
    "aiTraceId" TEXT,
    "outcome" TEXT,
    "evidence" JSONB,
    "notes" TEXT,
    "recommendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "interventionId" TEXT,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "draftedByAi" BOOLEAN NOT NULL DEFAULT false,
    "aiTraceId" TEXT,
    "humanApprovedById" TEXT,
    "messageSummary" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "memberResponseSummary" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "modality" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "availabilitySourceAtBooking" "AvailabilitySource" NOT NULL DEFAULT 'DIRECTORY_INFORMATION',
    "reminderSentAt" TIMESTAMP(3),
    "reminderChannel" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "signalType" "VerificationSignalType" NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "sourceSystem" TEXT NOT NULL,
    "evidenceNote" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseWorkflowEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" "CaseStatus",
    "toStatus" "CaseStatus" NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITrace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "referralId" TEXT,
    "operation" "AIOperation" NOT NULL,
    "providerName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "inferences" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "uncertainty" TEXT NOT NULL,
    "evidenceSignals" JSONB NOT NULL,
    "humanDecision" "HumanReviewDecision" NOT NULL DEFAULT 'PENDING',
    "humanReviewerId" TEXT,
    "humanReviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AITrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
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

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Member_tenantId_geography_idx" ON "Member"("tenantId", "geography");

-- CreateIndex
CREATE INDEX "Member_tenantId_preferredLanguage_idx" ON "Member"("tenantId", "preferredLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "Member_tenantId_externalMemberId_key" ON "Member"("tenantId", "externalMemberId");

-- CreateIndex
CREATE INDEX "IngestionBatch_tenantId_createdAt_idx" ON "IngestionBatch"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_tenantId_status_referralDate_idx" ON "Referral"("tenantId", "status", "referralDate");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_tenantId_externalReferralId_key" ON "Referral"("tenantId", "externalReferralId");

-- CreateIndex
CREATE INDEX "Provider_tenantId_specialty_geography_idx" ON "Provider"("tenantId", "specialty", "geography");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_tenantId_npi_key" ON "Provider"("tenantId", "npi");

-- CreateIndex
CREATE INDEX "ProviderSlot_tenantId_providerId_status_slotStartAt_idx" ON "ProviderSlot"("tenantId", "providerId", "status", "slotStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareCase_referralId_key" ON "CareCase"("referralId");

-- CreateIndex
CREATE INDEX "CareCase_tenantId_status_priorityScore_idx" ON "CareCase"("tenantId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "CareCase_tenantId_riskTier_idx" ON "CareCase"("tenantId", "riskTier");

-- CreateIndex
CREATE INDEX "CaseBarrier_tenantId_caseId_idx" ON "CaseBarrier"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "CaseBarrier_tenantId_category_idx" ON "CaseBarrier"("tenantId", "category");

-- CreateIndex
CREATE INDEX "Intervention_tenantId_caseId_status_idx" ON "Intervention"("tenantId", "caseId", "status");

-- CreateIndex
CREATE INDEX "OutreachAttempt_tenantId_caseId_idx" ON "OutreachAttempt"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_status_scheduledStartAt_idx" ON "Appointment"("tenantId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_caseId_idx" ON "Appointment"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "CompletionVerification_tenantId_caseId_signalType_idx" ON "CompletionVerification"("tenantId", "caseId", "signalType");

-- CreateIndex
CREATE INDEX "CaseWorkflowEvent_tenantId_caseId_createdAt_idx" ON "CaseWorkflowEvent"("tenantId", "caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AITrace_tenantId_caseId_createdAt_idx" ON "AITrace"("tenantId", "caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AITrace_tenantId_operation_idx" ON "AITrace"("tenantId", "operation");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_correlationId_idx" ON "AuditLog"("tenantId", "correlationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionBatch" ADD CONSTRAINT "IngestionBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionBatch" ADD CONSTRAINT "IngestionBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_ingestionBatchId_fkey" FOREIGN KEY ("ingestionBatchId") REFERENCES "IngestionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSlot" ADD CONSTRAINT "ProviderSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSlot" ADD CONSTRAINT "ProviderSlot_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_matchedProviderId_fkey" FOREIGN KEY ("matchedProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseBarrier" ADD CONSTRAINT "CaseBarrier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseBarrier" ADD CONSTRAINT "CaseBarrier_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CareCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CareCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_assignedOwnerId_fkey" FOREIGN KEY ("assignedOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CareCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CareCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionVerification" ADD CONSTRAINT "CompletionVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionVerification" ADD CONSTRAINT "CompletionVerification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CareCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionVerification" ADD CONSTRAINT "CompletionVerification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWorkflowEvent" ADD CONSTRAINT "CaseWorkflowEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseWorkflowEvent" ADD CONSTRAINT "CaseWorkflowEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CareCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITrace" ADD CONSTRAINT "AITrace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITrace" ADD CONSTRAINT "AITrace_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CareCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITrace" ADD CONSTRAINT "AITrace_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
