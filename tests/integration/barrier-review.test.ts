import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BarrierCategory, EpistemicStatus, UserRole } from "@prisma/client";
import { BARRIER_UNKNOWN_LABEL } from "@/domain/barriers/taxonomy";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { reviewBarrier } from "@/services/case-service";

describe("Barrier Intelligence Review Workflow & Auditability (PostgreSQL)", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";
  let careManagerSession: SessionUser;
  let pacificAdminSession: SessionUser;
  let testBarrierId = "";
  let testCaseId = "";
  let disposableMemberId = "";
  let disposableReferralId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    horizonTenantId = horizon.id;
    pacificTenantId = pacific.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });
    const pacAdmin = await prisma.user.findFirstOrThrow({
      where: { tenantId: pacificTenantId, role: UserRole.ADMIN },
    });

    careManagerSession = {
      userId: cm.id,
      tenantId: horizonTenantId,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    pacificAdminSession = {
      userId: pacAdmin.id,
      tenantId: pacificTenantId,
      tenantSlug: pacific.slug,
      email: pacAdmin.email,
      name: pacAdmin.name,
      role: pacAdmin.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const stamp = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId: horizonTenantId,
        externalMemberId: `MEM-BAR-${stamp}`,
        firstName: "Barrier",
        lastName: "Tester",
        geography: "Central Metro",
      },
    });
    disposableMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        externalReferralId: `REF-BAR-${stamp}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Support",
        specialty: "Outpatient Behavioral Health",
        geography: "Central Metro",
      },
    });
    disposableReferralId = referral.id;

    const existingCase = await prisma.case.create({
      data: {
        tenantId: horizonTenantId,
        referralId: referral.id,
        memberId: member.id,
      },
    });
    testCaseId = existingCase.id;

    const createdBarrier = await prisma.barrier.create({
      data: {
        tenantId: horizonTenantId,
        caseId: testCaseId,
        category: BarrierCategory.SOCIAL_LOGISTICAL,
        subBarrier: "transportation",
        epistemicStatus: EpistemicStatus.INFERENCE,
        confidence: 0.87,
        evidenceSummary: "Intake note mentioned bus route challenge",
        evidenceSignals: ["Intake note mentioned bus route challenge"],
        uncertainty: "Confirm directly with member",
        source: "DETERMINISTIC_RULES",
        modelVersion: "careloop-barrier-rules-v2",
        reviewStatus: "PENDING_REVIEW",
      },
    });
    testBarrierId = createdBarrier.id;
  });

  afterAll(async () => {
    if (testBarrierId) {
      await prisma.barrier.deleteMany({ where: { id: testBarrierId } });
      await prisma.auditEvent.deleteMany({
        where: { entityType: "Barrier", entityId: testBarrierId },
      });
    }
    if (testCaseId) {
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (disposableReferralId) {
      await prisma.referral.deleteMany({ where: { id: disposableReferralId } });
    }
    if (disposableMemberId) {
      await prisma.member.deleteMany({ where: { id: disposableMemberId } });
    }
  });

  it("supports accept, modify, mark unknown, reject with full audit logging and tenant isolation", async () => {
    // Cross-tenant review attempt fails
    await expect(
      reviewBarrier({
        session: pacificAdminSession,
        barrierId: testBarrierId,
        action: "ACCEPT",
      })
    ).rejects.toThrow(NotFoundError);

    // 1. Accept upgrades INFERENCE -> FACT
    const accepted = await reviewBarrier({
      session: careManagerSession,
      barrierId: testBarrierId,
      action: "ACCEPT",
      notes: "Confirmed with member on intake call",
    });
    expect(accepted.epistemicStatus).toBe(EpistemicStatus.FACT);
    expect(accepted.reviewStatus).toBe("ACCEPTED");
    expect(accepted.confirmedByHuman).toBe(true);

    // 2. Modify updates category & subBarrier and records audit event
    const modified = await reviewBarrier({
      session: careManagerSession,
      barrierId: testBarrierId,
      action: "MODIFY",
      category: BarrierCategory.SOCIAL_LOGISTICAL,
      subBarrier: "work schedule",
      notes: "Member actually has shift conflict, not transit",
    });
    expect(modified.subBarrier).toBe("work schedule");
    expect(modified.reviewStatus).toBe("MODIFIED");
    expect(modified.epistemicStatus).toBe(EpistemicStatus.FACT);

    // 3. Mark Unknown resets to UNKNOWN / Barrier unknown
    const markedUnknown = await reviewBarrier({
      session: careManagerSession,
      barrierId: testBarrierId,
      action: "MARK_UNKNOWN",
      notes: "Need follow-up call to verify",
    });
    expect(markedUnknown.category).toBe(BarrierCategory.UNKNOWN);
    expect(markedUnknown.subBarrier).toBe(BARRIER_UNKNOWN_LABEL);
    expect(markedUnknown.epistemicStatus).toBe(EpistemicStatus.UNKNOWN);
    expect(markedUnknown.reviewStatus).toBe("MARKED_UNKNOWN");

    // 4. Reject marks REJECTED and logs audit event
    const rejected = await reviewBarrier({
      session: careManagerSession,
      barrierId: testBarrierId,
      action: "REJECT",
      notes: "Disproved during member outreach",
    });
    expect(rejected.reviewStatus).toBe("REJECTED");

    const auditTrail = await prisma.auditEvent.findMany({
      where: { tenantId: horizonTenantId, entityType: "Barrier", entityId: testBarrierId },
      orderBy: { createdAt: "asc" },
    });
    expect(auditTrail.map((a) => a.action)).toEqual([
      "BARRIER_ACCEPT",
      "BARRIER_MODIFY",
      "BARRIER_MARK_UNKNOWN",
      "BARRIER_REJECT",
    ]);
  });
});
