import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AuthorizationError, ValidationError } from "@/lib/errors";
import { decryptAtRest, encryptAtRest } from "@/lib/security/encryption";
import { minimizePayloadForLLM, redactSecrets } from "@/lib/security/phi-minimization";
import { assertSecureTransportUrl, assertVendorBaaBoundary } from "@/lib/security/transport";
import { enforceTenantRetentionPolicy } from "@/services/retention-service";

describe("Security Hardening Controls", () => {
  let tenantId = "";
  let adminSession: SessionUser;
  let careManagerSession: SessionUser;
  let testUserId = "";
  let testCaseId = "";
  let testReferralId = "";
  let testMemberId = "";

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = tenant.id;
    const admin = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId, email: "admin@careloop.demo" } },
    });
    const cm = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId, email: "care.manager@careloop.demo" } },
    });

    adminSession = {
      userId: admin.id,
      tenantId,
      tenantSlug: tenant.slug,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    careManagerSession = {
      userId: cm.id,
      tenantId,
      tenantSlug: tenant.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    testUserId = cm.id;

    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-SEC-${Date.now()}`,
        firstName: "Sec",
        lastName: "Tester",
        dobYear: 1990,
        geography: "Central Metro",
        urbanicity: "URBAN",
        preferredLanguage: "English",
        coverageType: "MEDICAID",
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-SEC-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient therapy",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "HorizonCare",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: "NEW",
      },
    });
    testCaseId = careCase.id;
  });

  afterAll(async () => {
    await prisma.aIDecisionTrace.deleteMany({ where: { caseId: testCaseId } });
    await prisma.case.deleteMany({ where: { id: testCaseId } });
    await prisma.referral.deleteMany({ where: { id: testReferralId } });
    await prisma.member.deleteMany({ where: { id: testMemberId } });
  });

  it("encrypts and decrypts at rest using AES-256-GCM and rejects tampered envelopes", () => {
    const testKey = "test-phi-encryption-key-32-chars-min";
    const secretText = "Member outreach preference: morning calls";
    const envelope = encryptAtRest(secretText, testKey);

    expect(envelope.startsWith("v1:")).toBe(true);
    expect(envelope).not.toContain(secretText);
    expect(decryptAtRest(envelope, testKey)).toBe(secretText);

    const parts = envelope.split(":");
    const tampered = [parts[0], parts[1], parts[2], `${parts[3].slice(0, -2)}AA`].join(":");
    expect(() => decryptAtRest(tampered, testKey)).toThrow(ValidationError);
  });

  it("minimizes PHI for LLM payloads and redacts inline identifiers and secrets", () => {
    const rawPayload = {
      caseId: "case-123",
      member: {
        memberId: "mem-1",
        externalMemberId: "EXT-999",
        firstName: "Maria",
        lastName: "Garcia",
        email: "maria@example.com",
        phone: "555-234-5678",
        ssn: "123-45-6789",
        dob: "1990-05-01",
        urbanicity: "URBAN",
        preferredLanguage: "Spanish",
      },
      operationalSummary:
        "Contact via maria@example.com or 555-234-5678 regarding appointment slot.",
      specialty: "Outpatient Therapy",
    };

    const minimized = minimizePayloadForLLM(rawPayload);
    expect(minimized.caseId).toBe("case-123");
    expect(minimized.specialty).toBe("Outpatient Therapy");
    expect(minimized.member.urbanicity).toBe("URBAN");
    expect(minimized.member.preferredLanguage).toBe("Spanish");
    expect((minimized.member as Record<string, unknown>).firstName).toBeUndefined();
    expect((minimized.member as Record<string, unknown>).email).toBeUndefined();
    expect((minimized.member as Record<string, unknown>).ssn).toBeUndefined();
    expect((minimized.member as Record<string, unknown>).externalMemberId).toBeUndefined();
    expect(minimized.operationalSummary).toContain("[REDACTED_EMAIL]");
    expect(minimized.operationalSummary).toContain("[REDACTED_PHONE]");
    expect(minimized.operationalSummary).not.toContain("maria@example.com");

    const scrubbed = redactSecrets(
      "Authorization: Bearer tok_abc123456789 postgresql://admin:supersecret@db.internal:5432/careloop"
    );
    expect(scrubbed).not.toContain("tok_abc123456789");
    expect(scrubbed).not.toContain("supersecret");
  });

  it("enforces HTTPS transport and vendor BAA boundaries", () => {
    expect(() =>
      assertSecureTransportUrl("http://api.external-vendor.com/v1", "AI vendor endpoint")
    ).toThrow(ValidationError);
    expect(
      assertSecureTransportUrl("https://api.openai.com/v1", "AI vendor endpoint").protocol
    ).toBe("https:");

    expect(() =>
      assertVendorBaaBoundary({
        vendorName: "ExternalLLM",
        baaAttested: false,
        enforceAlways: true,
      })
    ).toThrow(AuthorizationError);

    expect(() =>
      assertVendorBaaBoundary({
        vendorName: "ExternalLLM",
        baaAttested: true,
        enforceAlways: true,
      })
    ).not.toThrow();
  });

  it("enforces configurable retention policy with TENANT_MANAGE RBAC", async () => {
    await expect(
      enforceTenantRetentionPolicy({
        session: careManagerSession,
        dryRun: true,
      })
    ).rejects.toThrow(AuthorizationError);

    const expiredDate = new Date(Date.now() - 4000 * 24 * 60 * 60 * 1000);
    const expiredSession = await prisma.userSession.create({
      data: {
        tenantId,
        userId: testUserId,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const oldTrace = await prisma.aIDecisionTrace.create({
      data: {
        tenantId,
        caseId: testCaseId,
        agent: "CareLoopCaseOrchestrator",
        model: "deterministic-orchestrator-v1",
        promptVersion: "v1",
        inputContextHash: "a".repeat(64),
        decision: "Old trace",
        confidence: 0.8,
        policyResult: "ALLOW",
        toolSelected: "search_providers",
        humanApprovalRequired: false,
        createdAt: expiredDate,
      },
    });

    const dryRun = await enforceTenantRetentionPolicy({
      session: adminSession,
      dryRun: true,
    });
    expect(dryRun.counts.expiredSessions).toBeGreaterThanOrEqual(1);
    expect(dryRun.counts.expiredAiTraces).toBeGreaterThanOrEqual(1);

    const enforced = await enforceTenantRetentionPolicy({
      session: adminSession,
      dryRun: false,
    });
    expect(enforced.counts.expiredSessions).toBeGreaterThanOrEqual(1);
    expect(enforced.counts.expiredAiTraces).toBeGreaterThanOrEqual(1);

    const remainingSession = await prisma.userSession.findUnique({
      where: { id: expiredSession.id },
    });
    const remainingTrace = await prisma.aIDecisionTrace.findUnique({
      where: { id: oldTrace.id },
    });
    expect(remainingSession).toBeNull();
    expect(remainingTrace).toBeNull();
  });
});
