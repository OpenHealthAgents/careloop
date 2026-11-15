import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AuditActionCategory,
  computeStateDelta,
  recordCompleteAudit,
  verifyAuditLogTamperEvidence,
} from "@/audit";
import { prisma } from "@/lib/db";

describe("Complete Audit and Traceability System", () => {
  let tenantId = "";
  const createdAuditIds: string[] = [];

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (createdAuditIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { id: { in: createdAuditIds } },
      });
    }
  });

  it("calculates state deltas accurately for what changed", () => {
    const prev = { status: "NEW", priorityScore: 20, matchedProviderId: null };
    const next = { status: "TRIAGED", priorityScore: 55, matchedProviderId: "prov-101" };
    const delta = computeStateDelta(prev, next);

    expect(delta).toEqual({
      status: { from: "NEW", to: "TRIAGED" },
      priorityScore: { from: 20, to: 55 },
      matchedProviderId: { from: null, to: "prov-101" },
    });
  });

  it("audits all 8 mandatory domains answering all 8 required audit questions (WHO, WHAT, WHEN, WHY, POLICY, EVIDENCE, HAPPENED, CHANGED)", async () => {
    const categories: AuditActionCategory[] = [
      "HUMAN_ACTION",
      "AGENT_DECISION",
      "TOOL_CALL",
      "POLICY_DECISION",
      "STATE_TRANSITION",
      "APPROVAL",
      "COMMUNICATION",
      "COMPLETION_VERIFICATION",
    ];

    for (const [idx, cat] of categories.entries()) {
      const entry = await recordCompleteAudit({
        tenantId,
        category: cat,
        who: {
          actorId: cat === "HUMAN_ACTION" ? "user-care-manager-1" : "agent-orchestrator-v1",
          actorEmail: cat === "HUMAN_ACTION" ? "care.manager@careloop.demo" : "agent@careloop.internal",
          actorRole: cat === "HUMAN_ACTION" ? "CARE_MANAGER" : "AGENT_SERVICE",
          actorType: cat === "HUMAN_ACTION" ? "USER" : "AGENT",
        },
        what: {
          action: `action_${cat.toLowerCase()}`,
          entityType: "CareCase",
          entityId: `case-audit-${idx}`,
          summary: `Executed ${cat} audit event with verified provenance`,
        },
        why: {
          reason: "Support member behavioral health navigation toward completed initial visit",
          rationale: "Align with non-punitive supportive care model",
          goal: "Attend verified outpatient psychotherapy visit",
        },
        underWhichPolicy: {
          policyRuleId: "POLICY_NON_CLINICAL_COORDINATION",
          policyEffect: "ALLOW",
          policyDetails: "Action adheres to non-clinical care navigation boundary",
          clinicalBoundaryRespected: true,
        },
        basedOnWhichEvidence: {
          evidenceSignals: ["EHR_APPOINTMENT_FEED", "MEMBER_SMS_CONFIRMATION"],
          evidenceSummary: "Confirmed verified appointment attendance via clinical feed",
          provenanceConfidence: 0.95,
          sourceSystems: ["EHR_EPIC_BH", "TWILIO_SMS_LOGS"],
        },
        whatHappened: {
          toolName: cat === "TOOL_CALL" ? "schedule_appointment" : null,
          toolInput: cat === "TOOL_CALL" ? { slotId: "slot-99" } : null,
          toolOutput: cat === "TOOL_CALL" ? { appointmentId: "appt-99" } : null,
          status: "SUCCEEDED",
        },
        whatChanged: {
          previousState: { status: "APPOINTMENT_SCHEDULED" },
          newState: { status: "COMPLETED" },
        },
        correlationId: `corr-audit-${idx}`,
      });

      expect(entry.id).toBeDefined();
      expect(entry.entryHash).toHaveLength(64); // SHA-256 hex
      expect(entry.previousEntryHash).toBeDefined();
      expect(entry.sequenceNumber).toBeGreaterThanOrEqual(1);

      createdAuditIds.push(entry.id);

      // Verify DB persistence retains all 8 questions in structured, queried metadata
      const persisted = await prisma.auditEvent.findUniqueOrThrow({
        where: { id: entry.id },
      });
      const meta = persisted.metadata as Record<string, unknown>;

      expect(persisted.actorRole).toBe(entry.who.actorRole);
      expect(persisted.action).toBe(entry.what.action);
      expect(meta.why).toBeDefined();
      expect(meta.underWhichPolicy).toBeDefined();
      expect(meta.basedOnWhichEvidence).toBeDefined();
      expect(meta.whatHappened).toBeDefined();
      expect(meta.whatChanged).toBeDefined();
      expect(meta.isTamperEvident).toBe(true);
    }
  });

  it("verifies cryptographic tamper-evidence and detects any tampered records in the hash chain", async () => {
    // Audit verification check on untampered log chain
    const verifyResult = await verifyAuditLogTamperEvidence(tenantId);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.totalRecordsChecked).toBeGreaterThanOrEqual(1);

    // Create a temporary record and tamper with it to verify detection
    const tampered = await recordCompleteAudit({
      tenantId,
      category: "HUMAN_ACTION",
      who: {
        actorId: "cm-tamper-tester",
        actorType: "USER",
      },
      what: {
        action: "case.close",
        entityType: "CareCase",
        entityId: "case-tamper-101",
        summary: "Legitimate closing of case",
      },
      why: { reason: "Care verified completed" },
      underWhichPolicy: {
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["EHR_VISIT_FEED"],
      },
      whatHappened: { status: "SUCCEEDED" },
      whatChanged: {
        previousState: { status: "VERIFIED" },
        newState: { status: "CLOSED" },
      },
    });
    createdAuditIds.push(tampered.id);

    // Tamper with the persisted record summary in DB
    await prisma.auditEvent.update({
      where: { id: tampered.id },
      data: { summary: "TAMPERED_FRAUDULENT_MODIFICATION" },
    });

    const tamperedCheck = await verifyAuditLogTamperEvidence(tenantId);
    expect(tamperedCheck.valid).toBe(false);
    expect(tamperedCheck.tamperedRecordId).toBe(tampered.id);
    expect(tamperedCheck.reason).toContain("Hash payload verification failed");
  });
});
