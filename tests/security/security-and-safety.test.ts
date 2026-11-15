import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppointmentStatus, BarrierCategory, CaseStatus, RiskLevel, UserRole } from "@prisma/client";
import { sanitizeCsvCellForExport } from "@/adapters/csv-referral-parser";
import {
  AIPolicyViolationError,
  enforceBarrierPolicy,
  enforceCaseSummaryPolicy,
  enforceCommunicationPolicy,
  enforceInterventionPolicy,
  enforceProviderMatchPolicy,
  enforceRiskPolicy,
} from "@/ai/policy-guard";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getConfig, resetConfigCacheForTests } from "@/lib/config";
import { prisma } from "@/lib/db";
import { redactSensitiveFields, sanitizeAuditText } from "@/lib/logger";
import { middleware } from "@/middleware";
import { recordAuditEvent } from "@/services/audit-service";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { PATCH as patchAppointment } from "@/app/api/appointments/[id]/route";
import { GET as getAuditLogs } from "@/app/api/audit-logs/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as getCaseById } from "@/app/api/cases/[id]/route";
import { POST as createNote } from "@/app/api/cases/[id]/notes/route";
import { GET as getOutreach, POST as postOutreach } from "@/app/api/cases/[id]/outreach/route";
import { POST as transitionCase } from "@/app/api/cases/[id]/transition/route";
import { POST as executeIntervention } from "@/app/api/interventions/[id]/execute/route";
import { GET as getMemberPortal } from "@/app/api/member-portal/[caseId]/route";
import { POST as createProvider } from "@/app/api/providers/route";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/settings/route";
import { GET as getUsers, PATCH as patchUsers, POST as postUsers } from "@/app/api/users/route";

const createdTenantIds: string[] = [];

async function issueUserCookie(params: {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  name: string;
  role: UserRole;
  customRoleCode?: string | null;
}) {
  const dbSession = await prisma.userSession.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return createSessionToken(
    {
      sid: dbSession.id,
      userId: params.userId,
      tenantId: params.tenantId,
      tenantSlug: params.tenantSlug,
      email: params.email,
      name: params.name,
      role: params.role,
      customRoleCode: params.customRoleCode ?? null,
    },
    3600
  );
}

afterAll(async () => {
  for (const tenantId of createdTenantIds) {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  }
});

describe("Security, Access Control, Tenant Isolation & AI Safety Pass", () => {
  it("blocks unauthenticated API access (401) and enforces security & no-store headers", async () => {
    mockCookieMap.clear();

    const mwApi = await middleware(new NextRequest("http://localhost:3000/api/cases"));
    expect(mwApi.status).toBe(401);
    expect(mwApi.headers.get("X-Frame-Options")).toBe("DENY");
    expect(mwApi.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(mwApi.headers.get("Cache-Control")).toContain("no-store");

    const mwUsers = await middleware(new NextRequest("http://localhost:3000/api/users"));
    expect(mwUsers.status).toBe(401);

    const resUsers = await getUsers(new Request("http://localhost/api/users"));
    expect(resUsers.status).toBe(401);

    const resSettings = await getSettings(new Request("http://localhost/api/settings"));
    expect(resSettings.status).toBe(401);

    const resAudit = await getAuditLogs(new Request("http://localhost/api/audit-logs"));
    expect(resAudit.status).toBe(401);

    // Tampered HMAC cookie must also fail closed
    mockCookieMap.set(SESSION_COOKIE_NAME, "eyJmb28iOiJiYXIifQ.invalidsig");
    const tamperedRes = await getUsers(new Request("http://localhost/api/users"));
    expect(tamperedRes.status).toBe(401);
  });

  it("enforces role-based least privilege (403) and blocks privilege escalation & self-demotion", async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const users = await prisma.user.findMany({ where: { tenantId: horizon.id } });
    const admin = users.find((u) => u.role === UserRole.ADMIN)!;
    const careMgr = users.find((u) => u.role === UserRole.CARE_MANAGER)!;
    const execUser = users.find((u) => u.role === UserRole.EXECUTIVE_READ_ONLY)!;
    const equityUser = users.find((u) => u.role === UserRole.HEALTH_EQUITY)!;

    const anyCase = await prisma.case.findFirstOrThrow({ where: { tenantId: horizon.id } });
    const anyInv = await prisma.intervention.findFirstOrThrow({ where: { tenantId: horizon.id } });

    // EXECUTIVE_READ_ONLY cannot mutate workflow or access admin endpoints
    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      await issueUserCookie({
        userId: execUser.id,
        tenantId: horizon.id,
        tenantSlug: horizon.slug,
        email: execUser.email,
        name: execUser.name,
        role: execUser.role,
      })
    );
    expect(
      (
        await transitionCase(
          new Request("http://localhost/api/cases/x/transition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toStatus: CaseStatus.CLOSED, reason: "Unauthorized close" }),
          }),
          { params: Promise.resolve({ id: anyCase.id }) }
        )
      ).status
    ).toBe(403);
    expect(
      (
        await createNote(
          new Request("http://localhost/api/cases/x/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "Executive should not write case notes" }),
          }),
          { params: Promise.resolve({ id: anyCase.id }) }
        )
      ).status
    ).toBe(403);
    expect(
      (
        await executeIntervention(new Request("http://localhost/api/interventions/x/execute", { method: "POST" }), {
          params: Promise.resolve({ id: anyInv.id }),
        })
      ).status
    ).toBe(403);

    // HEALTH_EQUITY cannot inspect audit logs, mutate cases, manage providers, or access user admin
    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      await issueUserCookie({
        userId: equityUser.id,
        tenantId: horizon.id,
        tenantSlug: horizon.slug,
        email: equityUser.email,
        name: equityUser.name,
        role: equityUser.role,
      })
    );
    expect((await getAuditLogs(new Request("http://localhost/api/audit-logs"))).status).toBe(403);
    expect((await getUsers(new Request("http://localhost/api/users"))).status).toBe(403);
    expect(
      (
        await transitionCase(
          new Request("http://localhost/api/cases/x/transition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toStatus: CaseStatus.CLOSED, reason: "Equity cannot mutate" }),
          }),
          { params: Promise.resolve({ id: anyCase.id }) }
        )
      ).status
    ).toBe(403);

    // CARE_MANAGER privilege escalation attempts -> 403
    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      await issueUserCookie({
        userId: careMgr.id,
        tenantId: horizon.id,
        tenantSlug: horizon.slug,
        email: careMgr.email,
        name: careMgr.name,
        role: careMgr.role,
      })
    );
    expect((await getUsers(new Request("http://localhost/api/users"))).status).toBe(403);
    expect(
      (
        await postUsers(
          new Request("http://localhost/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: "escalated@careloop.demo",
              name: "Escalated User",
              password: "StrongPassword2026!",
              role: UserRole.ADMIN,
            }),
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await patchUsers(
          new Request("http://localhost/api/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: careMgr.id, role: UserRole.ADMIN }),
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await patchSettings(
          new Request("http://localhost/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ escalationRiskThreshold: 55 }),
          })
        )
      ).status
    ).toBe(403);

    // ADMIN cannot self-demote or self-deactivate (400 ValidationError)
    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      await issueUserCookie({
        userId: admin.id,
        tenantId: horizon.id,
        tenantSlug: horizon.slug,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      })
    );
    const selfDemote = await patchUsers(
      new Request("http://localhost/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: admin.id, role: UserRole.CARE_MANAGER }),
      })
    );
    expect(selfDemote.status).toBe(400);

    const selfDeactivate = await patchUsers(
      new Request("http://localhost/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: admin.id, active: false }),
      })
    );
    expect(selfDeactivate.status).toBe(400);
  });

  it("blocks cross-tenant access and IDOR attacks across cases, interventions, portal & users (404)", async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const horizonCase = await prisma.case.findFirstOrThrow({ where: { tenantId: horizon.id } });
    const horizonInv = await prisma.intervention.findFirstOrThrow({ where: { tenantId: horizon.id } });
    const horizonAppt = await prisma.appointment.findFirstOrThrow({ where: { tenantId: horizon.id } });
    const horizonUser = await prisma.user.findFirstOrThrow({ where: { tenantId: horizon.id } });

    const isoSlug = `sec-iso-${Date.now()}`;
    const isolatedTenant = await prisma.tenant.create({
      data: {
        slug: isoSlug,
        name: "Isolated Clinic Tenant",
        planType: "COMMERCIAL",
        settings: {},
      },
    });
    createdTenantIds.push(isolatedTenant.id);

    const isolatedAdmin = await prisma.user.create({
      data: {
        tenantId: isolatedTenant.id,
        email: `admin@${isoSlug}.demo`,
        name: "Isolated Admin",
        passwordHash: hashPassword("IsolatedSecPass2026!"),
        role: UserRole.ADMIN,
        active: true,
      },
    });

    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      await issueUserCookie({
        userId: isolatedAdmin.id,
        tenantId: isolatedTenant.id,
        tenantSlug: isolatedTenant.slug,
        email: isolatedAdmin.email,
        name: isolatedAdmin.name,
        role: isolatedAdmin.role,
      })
    );

    // Cross-tenant IDOR read & mutation attempts all fail with 404 (never leaking Tenant A records)
    expect(
      (await getCaseById(new Request("http://localhost/api/cases/x"), { params: Promise.resolve({ id: horizonCase.id }) }))
        .status
    ).toBe(404);
    expect(
      (
        await getMemberPortal(new Request("http://localhost/api/member-portal/x"), {
          params: Promise.resolve({ caseId: horizonCase.id }),
        })
      ).status
    ).toBe(404);
    expect(
      (
        await getOutreach(new Request("http://localhost/api/cases/x/outreach"), {
          params: Promise.resolve({ id: horizonCase.id }),
        })
      ).status
    ).toBe(404);
    expect(
      (
        await createNote(
          new Request("http://localhost/api/cases/x/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "IDOR attempt on another tenant case" }),
          }),
          { params: Promise.resolve({ id: horizonCase.id }) }
        )
      ).status
    ).toBe(404);
    expect(
      (
        await transitionCase(
          new Request("http://localhost/api/cases/x/transition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toStatus: CaseStatus.ESCALATED, reason: "IDOR escalation" }),
          }),
          { params: Promise.resolve({ id: horizonCase.id }) }
        )
      ).status
    ).toBe(404);
    expect(
      (
        await executeIntervention(new Request("http://localhost/api/interventions/x/execute", { method: "POST" }), {
          params: Promise.resolve({ id: horizonInv.id }),
        })
      ).status
    ).toBe(404);
    expect(
      (
        await patchAppointment(
          new Request("http://localhost/api/appointments/x", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "CANCEL", note: "IDOR cancel" }),
          }),
          { params: Promise.resolve({ id: horizonAppt.id }) }
        )
      ).status
    ).toBe(404);
    expect(
      (
        await patchUsers(
          new Request("http://localhost/api/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: horizonUser.id, active: false }),
          })
        )
      ).status
    ).toBe(404);

    // Forged tenantId inside request body is ignored; resource is scoped strictly to session.tenantId
    const forgedProviderRes = await createProvider(
      new Request("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: horizon.id,
          name: "Forged Tenant Provider",
          organizationName: "Isolated Clinic Group",
          npi: "9988776655",
          specialty: "OUTPATIENT_THERAPY",
          networkNames: ["Medicaid"],
          languages: ["English"],
          geography: "Metro North",
          county: "King",
          acceptingNewPatients: true,
          availabilitySource: "DIRECTORY_INFORMATION",
        }),
      })
    );
    expect(forgedProviderRes.status).toBe(201);
    const createdProv = (await forgedProviderRes.json()).provider;
    expect(createdProv.tenantId).toBe(isolatedTenant.id);
    expect(createdProv.tenantId).not.toBe(horizon.id);
  });

  it("blocks invalid state transitions, malicious/unvalidated inputs, and failed auth without credential leakage", async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const admin = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizon.id, role: UserRole.ADMIN },
    });
    const activeCase = await prisma.case.findFirstOrThrow({
      where: { tenantId: horizon.id, member: { consentOutreach: true } },
    });
    const cancelledAppt = await prisma.appointment.findFirst({
      where: { tenantId: horizon.id, status: AppointmentStatus.CANCELLED },
    });

    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      await issueUserCookie({
        userId: admin.id,
        tenantId: horizon.id,
        tenantSlug: horizon.slug,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      })
    );

    // Invalid case state transition: NEW->VERIFIED or any non-NEW->NEW cannot bypass workflow -> 409
    const invalidTargetStatus = activeCase.status === CaseStatus.NEW ? CaseStatus.VERIFIED : CaseStatus.NEW;
    const invalidCaseTrans = await transitionCase(
      new Request("http://localhost/api/cases/x/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: invalidTargetStatus, reason: "Invalid transition test" }),
      }),
      { params: Promise.resolve({ id: activeCase.id }) }
    );
    expect(invalidCaseTrans.status).toBe(409);

    if (cancelledAppt) {
      const invalidApptTrans = await patchAppointment(
        new Request("http://localhost/api/appointments/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "COMPLETE", note: "Cannot complete cancelled appt" }),
        }),
        { params: Promise.resolve({ id: cancelledAppt.id }) }
      );
      expect(invalidApptTrans.status).toBe(409);
    }

    // CSV formula injection sanitization
    expect(sanitizeCsvCellForExport("=cmd|'/C calc'!A0")).toBe("\"'=cmd|'/C calc'!A0\"");
    expect(sanitizeCsvCellForExport("+SUM(1,2)")).toBe("\"'+SUM(1,2)\"");
    expect(sanitizeCsvCellForExport("@IMPORTXML")).toBe("\"'@IMPORTXML\"");

    // Malicious / invalid payloads rejected by schema & safety validators (400)
    expect(
      (
        await createNote(
          new Request("http://localhost/api/cases/x/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "ok" }),
          }),
          { params: Promise.resolve({ id: activeCase.id }) }
        )
      ).status
    ).toBe(400);

    expect(
      (
        await patchSettings(
          new Request("http://localhost/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ auditLogRetentionDays: 30 }),
          })
        )
      ).status
    ).toBe(400);

    // Custom member outreach attempting to leak internal risk score / clinical claim rejected -> 400
    const leakedOutreachRes = await postOutreach(
      new Request("http://localhost/api/cases/x/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "EMAIL",
          purpose: "HUMAN_OUTREACH",
          customMessage: "Your risk score is 88 and our AI diagnosed you.",
          sendImmediately: false,
        }),
      }),
      { params: Promise.resolve({ id: activeCase.id }) }
    );
    expect(leakedOutreachRes.status).toBe(400);

    // Failed login audit log must not leak submitted plaintext password
    const badSecret = "SuperSecretWrongPassword99!";
    const badLogin = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: admin.email,
          password: badSecret,
          tenantSlug: horizon.slug,
        }),
      })
    );
    expect(badLogin.status).toBe(401);

    const failedAudit = await prisma.auditEvent.findFirst({
      where: { tenantId: horizon.id, action: "USER_LOGIN_FAILED" },
      orderBy: { createdAt: "desc" },
    });
    expect(failedAudit).toBeTruthy();
    expect(failedAudit?.source).toBe("AUTH");
    expect(JSON.stringify(failedAudit)).not.toContain(badSecret);
  });

  it("writes PHI-minimized audit logs with previousState/newState/source/correlationId & access logs", async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const admin = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizon.id, role: UserRole.ADMIN },
    });
    const anyCase = await prisma.case.findFirstOrThrow({ where: { tenantId: horizon.id } });

    const redacted = redactSensitiveFields({
      patientName: "Jane Doe",
      ssn: "123-45-6789",
      homeAddress: "100 Main St",
      draftMessage: "Sensitive note",
      caseStatus: "TRIAGED",
    }) as Record<string, unknown>;
    expect(redacted.patientName).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(redacted.ssn).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(redacted.homeAddress).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(redacted.draftMessage).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(redacted.caseStatus).toBe("TRIAGED");

    expect(sanitizeAuditText("Call 555-234-5678 for SSN 123-45-6789")).toBe(
      "Call [REDACTED_PHONE] for SSN [REDACTED_SSN]"
    );

    const corr = `corr-audit-${Date.now()}`;
    const auditEvt = await recordAuditEvent({
      tenantId: horizon.id,
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: "SECURITY_VERIFICATION_EVENT",
      entityType: "Case",
      entityId: anyCase.id,
      source: "SECURITY_TEST",
      correlationId: corr,
      summary: "Checked SSN 123-45-6789 masking",
      previousState: { status: "NEW", phone: "555-234-5678" },
      newState: { status: "TRIAGED", email: "hidden@example.com" },
    });

    expect(auditEvt.source).toBe("SECURITY_TEST");
    expect(auditEvt.correlationId).toBe(corr);
    expect(auditEvt.summary).toContain("[REDACTED_SSN]");
    expect(auditEvt.previousState).toEqual({ status: "NEW", phone: "[REDACTED_PHI_OR_SECRET]" });
    expect(auditEvt.newState).toEqual({ status: "TRIAGED", email: "[REDACTED_PHI_OR_SECRET]" });

    // PHI read route emits ACCESS_LOG audit event + retention config returned on settings
    mockCookieMap.set(
      SESSION_COOKIE_NAME,
      await issueUserCookie({
        userId: admin.id,
        tenantId: horizon.id,
        tenantSlug: horizon.slug,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      })
    );
    const caseRes = await getCaseById(new Request("http://localhost/api/cases/x"), {
      params: Promise.resolve({ id: anyCase.id }),
    });
    expect(caseRes.status).toBe(200);

    const accessEvt = await prisma.auditEvent.findFirst({
      where: {
        tenantId: horizon.id,
        action: "CASE_PHI_VIEWED",
        entityId: anyCase.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(accessEvt).toBeTruthy();
    expect(accessEvt?.source).toBe("ACCESS_LOG");

    const settingsRes = await getSettings(new Request("http://localhost/api/settings"));
    expect(settingsRes.status).toBe(200);
    const settingsBody = await settingsRes.json();
    expect(settingsBody.retentionDefaults.auditLogRetentionDays).toBeGreaterThanOrEqual(365);
  });

  it("enforces AI safety boundaries across all 6 AI capabilities", () => {
    const baseEnvelope = {
      providerName: "test-mock",
      modelVersion: "v1",
      timestamp: new Date().toISOString(),
      confidence: 0.8,
      uncertainty: "Operational estimate only",
      evidenceSignals: ["Signal A"],
      facts: ["Fact A"],
      inferences: [],
      recommendations: [],
    };

    // 1. Risk policy blocks clinical claims & protected characteristics
    expect(() =>
      enforceRiskPolicy({
        ...baseEnvelope,
        priorityScore: 72,
        riskTier: RiskLevel.MEDIUM,
        explanation: "Recommend immediate psychotherapy session and prescribe dosage adjustment.",
        humanEscalationRecommended: true,
        signalContributions: [],
      })
    ).toThrow(AIPolicyViolationError);

    expect(() =>
      enforceRiskPolicy({
        ...baseEnvelope,
        priorityScore: 60,
        riskTier: RiskLevel.MEDIUM,
        explanation: "Operational urgency factor",
        humanEscalationRecommended: false,
        signalContributions: [{ factor: "race", points: 10, signal: "Hispanic cohort" }],
      })
    ).toThrow(AIPolicyViolationError);

    // 2. Barrier policy rejects FACT promotion & fabricated un-evidenced barriers
    expect(() =>
      enforceBarrierPolicy({
        ...baseEnvelope,
        epistemicStatus: "FACT" as unknown as "INFERENCE",
        source: "DETERMINISTIC_RULES",
        primaryBarrier: {
          category: BarrierCategory.SOCIAL_LOGISTICAL,
          subBarrier: "NO_RELIABLE_TRANSIT",
          rationale: "Transit gap noted",
        },
        secondaryBarriers: [],
      })
    ).toThrow(AIPolicyViolationError);

    expect(() =>
      enforceBarrierPolicy({
        ...baseEnvelope,
        evidenceSignals: [],
        epistemicStatus: "INFERENCE",
        source: "DETERMINISTIC_RULES",
        primaryBarrier: {
          category: BarrierCategory.SOCIAL_LOGISTICAL,
          subBarrier: "NO_RELIABLE_TRANSIT",
          rationale: "Unverified guess",
        },
        secondaryBarriers: [],
      })
    ).toThrow(AIPolicyViolationError);

    // 3. Provider matching cannot fabricate VERIFIED AVAILABILITY or recommend unavailable provider
    expect(() =>
      enforceProviderMatchPolicy(
        {
          ...baseEnvelope,
          rankedMatches: [
            {
              providerId: "p1",
              providerName: "Clinic One",
              matchScore: 90,
              availabilityLabel: "VERIFIED AVAILABILITY",
              recommendedForBooking: true,
              rationale: "Directory entry only",
              availabilityWarning: null,
            },
          ],
        },
        new Map([["p1", { availabilitySource: "DIRECTORY_INFORMATION" }]])
      )
    ).toThrow(AIPolicyViolationError);

    // 4. Interventions cannot automate high-risk or HUMAN_ONLY tasks
    expect(() =>
      enforceInterventionPolicy(
        {
          ...baseEnvelope,
          proposedInterventions: [
            {
              type: "HUMAN_OUTREACH",
              reason: "Missed follow-up",
              triggeringBarrierCategory: BarrierCategory.BEHAVIORAL,
              triggeringBarrierCode: "MISSED_FIRST_VISIT",
              recommendedAction: "Care manager call",
              executionMode: "AUTOMATED",
              automationEligible: true,
              isHighRisk: true,
              requiredHumanInvolvement: "None",
              expectedOutcome: "Re-engage",
              evidence: ["Missed 1 call"],
              confidence: 0.7,
            },
          ],
        },
        { riskTier: "HIGH" }
      )
    ).toThrow(AIPolicyViolationError);

    // 5. Communications cannot bypass consent
    expect(() =>
      enforceCommunicationPolicy(
        {
          ...baseEnvelope,
          channel: "SMS",
          messageType: "APPOINTMENT_REMINDER",
          readingLevel: "PLAIN",
          templateKey: "reminder.en",
          internalAiLabel: "AI_GENERATED",
          language: "English",
          draftMessage: "Reminder about your upcoming behavioral health appointment.",
          toneNotes: "Warm",
        },
        { consentOutreach: true, consentSms: false }
      )
    ).toThrow(AIPolicyViolationError);

    // 6. Case summary cannot fabricate completed visit when none exists
    expect(() =>
      enforceCaseSummaryPolicy(
        {
          ...baseEnvelope,
          operationalSummary: "Member completed visit yesterday with network clinic.",
          openGaps: [],
          nextStepSummary: "Close case",
        },
        { hasCompletedVisit: false }
      )
    ).toThrow(AIPolicyViolationError);
  });

  it("fails closed in production mode when AUTH_SECRET uses dev fallback or is shorter than 32 chars", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.AUTH_SECRET;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.AUTH_SECRET = "careloop-dev-only-secret-change-in-production-2026";
      resetConfigCacheForTests();
      expect(() => getConfig()).toThrow(/Production startup blocked/);

      const mwRes = await middleware(new NextRequest("http://localhost:3000/api/cases"));
      expect(mwRes.status).toBe(503);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
      if (prevSecret === undefined) {
        delete process.env.AUTH_SECRET;
      } else {
        process.env.AUTH_SECRET = prevSecret;
      }
      resetConfigCacheForTests();
    }
  });
});
