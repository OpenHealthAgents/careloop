import { CaseStatus, RiskLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const caseRepository = {
  async listByTenant(
    tenantId: string,
    filters?: {
      status?: CaseStatus;
      riskLevel?: RiskLevel;
      excludeClosed?: boolean;
      assignedToId?: string;
      humanReviewOnly?: boolean;
      search?: string;
      limit?: number;
    }
  ) {
    if (!tenantId) throw new ValidationError("tenantId is required");
    const search = filters?.search?.trim();
    const take = Math.min(Math.max(filters?.limit ?? 250, 1), 500);

    return prisma.case.findMany({
      where: {
        tenantId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.riskLevel ? { riskLevel: filters.riskLevel } : {}),
        ...(filters?.excludeClosed ? { status: { notIn: ["CLOSED", "VERIFIED"] } } : {}),
        ...(filters?.assignedToId ? { assignedToId: filters.assignedToId } : {}),
        ...(filters?.humanReviewOnly ? { humanReviewRequired: true } : {}),
        ...(search
          ? {
              OR: [
                { referral: { externalReferralId: { contains: search, mode: "insensitive" } } },
                { referral: { specialty: { contains: search, mode: "insensitive" } } },
                { member: { firstName: { contains: search, mode: "insensitive" } } },
                { member: { lastName: { contains: search, mode: "insensitive" } } },
                { member: { externalMemberId: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        member: true,
        referral: true,
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        matchedProvider: true,
        _count: {
          select: {
            barriers: true,
            interventions: true,
            appointments: true,
            verifications: true,
            communications: true,
            caseNotes: true,
          },
        },
      },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
      take,
    });
  },

  async findDetailById(tenantId: string, caseId: string) {
    const careCase = await prisma.case.findFirst({
      where: { id: caseId, tenantId },
      include: {
        member: { include: { consents: true } },
        referral: true,
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        matchedProvider: true,
        barriers: { orderBy: { createdAt: "desc" } },
        riskAssessments: { orderBy: { assessedAt: "desc" } },
        aiRecommendations: {
          orderBy: { createdAt: "desc" },
          include: {
            humanReviewer: { select: { id: true, name: true, role: true } },
          },
        },
        interventions: {
          orderBy: { createdAt: "desc" },
          include: {
            assignedOwner: { select: { id: true, name: true, role: true } },
            outcomes: { orderBy: { recordedAt: "desc" } },
          },
        },
        communications: { orderBy: { createdAt: "desc" } },
        appointments: {
          orderBy: { scheduledStartAt: "desc" },
          include: { provider: true, verifications: true },
        },
        verifications: {
          orderBy: { verifiedAt: "desc" },
          include: {
            verifiedBy: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        workflowEvents: { orderBy: { createdAt: "desc" } },
        caseNotes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { id: true, name: true, email: true, role: true } } },
        },
        notifications: { orderBy: { createdAt: "desc" } },
        approvalRequests: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        agentRuns: {
          orderBy: { startedAt: "desc" },
          take: 20,
        },
        executionJournalEvents: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        aiDecisionTraces: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        evidences: {
          where: { deletedAt: null },
          orderBy: { capturedAt: "desc" },
          take: 30,
        },
      },
    });
    if (!careCase) throw new NotFoundError("Case", caseId);

    const relatedEntityIds = [
      careCase.id,
      careCase.referralId,
      ...careCase.barriers.map((b) => b.id),
      ...careCase.interventions.map((i) => i.id),
      ...careCase.appointments.map((a) => a.id),
      ...careCase.communications.map((c) => c.id),
      ...careCase.verifications.map((v) => v.id),
      ...careCase.caseNotes.map((n) => n.id),
      ...careCase.approvalRequests.map((a) => a.id),
      ...careCase.aiRecommendations.map((r) => r.id),
      ...careCase.agentRuns.map((r) => r.id),
      ...careCase.evidences.map((e) => e.id),
    ];

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        tenantId,
        entityId: { in: relatedEntityIds },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      ...careCase,
      auditEvents,
    };
  },

  async recordInterventionOutcome(params: {
    tenantId: string;
    interventionId: string;
    outcomeStatus: string;
    summary: string;
    barriersResolved: boolean;
    followUpRequired: boolean;
    recordedById?: string;
  }) {
    const inv = await prisma.intervention.findFirst({
      where: { id: params.interventionId, tenantId: params.tenantId },
    });
    if (!inv) throw new NotFoundError("Intervention", params.interventionId);

    return prisma.interventionOutcome.create({
      data: {
        tenantId: params.tenantId,
        interventionId: inv.id,
        outcomeStatus: params.outcomeStatus,
        summary: params.summary,
        barriersResolved: params.barriersResolved,
        followUpRequired: params.followUpRequired,
        recordedById: params.recordedById ?? null,
      },
    });
  },
};
