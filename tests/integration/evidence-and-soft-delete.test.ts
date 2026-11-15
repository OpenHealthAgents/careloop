import { describe, expect, it } from "vitest";
import { CaseStatus } from "@prisma/client";
import { hashEvidencePayload, prismaEvidenceStore } from "@/evidence";
import { prisma } from "@/lib/db";
import { caseWorkflowEngine } from "@/workflow";

describe("Evidence Model, Soft Deletion & Relational Integrity", () => {
  it("supports Evidence CRUD, relational links, tenant isolation, soft deletion, and state/hash integrity", async () => {
    const [horizon, pacific] = await Promise.all([
      prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } }),
      prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } }),
    ]);

    const careCase = await prisma.case.findFirstOrThrow({
      where: { tenantId: horizon.id, deletedAt: null },
      include: { tenant: true, member: true },
    });

    const payload = { clinicId: "clinic-42", attended: true };
    const created = await prismaEvidenceStore.record({
      tenantId: horizon.id,
      caseId: careCase.id,
      sourceType: "CLINIC_CONFIRMATION",
      summary: "Clinic confirmed attendance for integration test",
      payload,
      capturedBy: "integration-test",
    });

    expect(created.tenantId).toBe(horizon.id);
    expect(created.caseId).toBe(careCase.id);
    expect(created.payloadHash).toBe(hashEvidencePayload(payload));
    expect(created.deletedAt).toBeNull();

    // Relationship check
    const loadedWithCase = await prisma.evidence.findUniqueOrThrow({
      where: { id: created.id },
      include: { careCase: true, tenant: true },
    });
    expect(loadedWithCase.careCase.id).toBe(careCase.id);
    expect(loadedWithCase.tenant.slug).toBe("horizon-bh");

    // Tenant isolation check: Pacific cannot list or soft-delete Horizon's evidence
    const pacificList = await prismaEvidenceStore.listForCase(pacific.id, careCase.id);
    expect(pacificList.some((e) => e.id === created.id)).toBe(false);

    const crossTenantDelete = await prismaEvidenceStore.softDelete(pacific.id, created.id);
    expect(crossTenantDelete.count).toBe(0);

    // Owner tenant soft-deletes the evidence
    const ownDelete = await prismaEvidenceStore.softDelete(horizon.id, created.id);
    expect(ownDelete.count).toBe(1);

    const activeList = await prismaEvidenceStore.listForCase(horizon.id, careCase.id);
    expect(activeList.some((e) => e.id === created.id)).toBe(false);

    const softDeletedRow = await prisma.evidence.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(softDeletedRow.deletedAt).toBeInstanceOf(Date);

    // State integrity check
    expect(caseWorkflowEngine.validateTransition(CaseStatus.NEW, CaseStatus.CLOSED).allowed).toBe(
      false
    );
    expect(caseWorkflowEngine.validateTransition(CaseStatus.NEW, CaseStatus.TRIAGED).allowed).toBe(
      true
    );

    // Clean up test row
    await prisma.evidence.delete({ where: { id: created.id } });
  });
});
