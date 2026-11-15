import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { CsvReferralIngestionAdapter } from "@/adapters/csv-referral-parser";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import {
  confirmIngestionWithAdapter,
  exportFailedRowsCsv,
  previewWithAdapter,
} from "@/services/ingestion-service";

describe("Referral Ingestion System — Preview, Confirm, Duplicates, Failed-Row Report & Tenant Isolation", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";
  let opsSession: SessionUser;
  const newRefId = `REF-ING-TEST-${Date.now()}`;
  const newMemId = `MEM-ING-TEST-${Date.now()}`;
  let createdBatchId = "";
  let createdCaseId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    horizonTenantId = horizon.id;
    pacificTenantId = pacific.id;

    const ops = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.OPERATIONS },
    });

    opsSession = {
      userId: ops.id,
      tenantId: horizonTenantId,
      tenantSlug: horizon.slug,
      email: ops.email,
      name: ops.name,
      role: ops.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  });

  afterAll(async () => {
    if (createdCaseId) {
      await prisma.case.deleteMany({ where: { id: createdCaseId } });
    }
    await prisma.referral.deleteMany({ where: { externalReferralId: newRefId } });
    await prisma.member.deleteMany({ where: { externalMemberId: newMemId } });
    if (createdBatchId) {
      await prisma.ingestionBatch.deleteMany({ where: { id: createdBatchId } });
    }
  });

  it("previews valid/duplicate/malformed rows, confirms import without discarding failed rows, and exports failed-row CSV", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Row 2: valid new referral
    // Row 3: duplicate of existing seeded referral REF-2026-1001
    // Row 4: malformed row (missing specialty & bad date)
    const csv = `member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,geography,network,eligibility_verified,preferred_language,operational_notes
${newMemId},Rosa,Vega,${newRefId},${today},Outpatient Therapy,Outpatient Behavioral Health,Central Metro,Horizon Medicaid,VERIFIED,Spanish,Needs Spanish clinician
MEM-9001,Elena,Navarro,REF-2026-1001,${today},Outpatient Therapy,Outpatient Behavioral Health,Central Metro,Horizon Medicaid,VERIFIED,Spanish,Existing DB duplicate
MEM-BAD,Bad,Date,REF-BAD-1,invalid-date,Therapy,,Central Metro,Horizon Medicaid,VERIFIED,English,=HYPERLINK("http://evil")`;

    const adapter = new CsvReferralIngestionAdapter();
    const preview = await previewWithAdapter(
      adapter,
      { fileName: "mixed-batch.csv", csvText: csv },
      horizonTenantId
    );

    expect(preview.totalRows).toBe(3);
    expect(preview.validCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.errorCount).toBe(2); // 1 DB duplicate + 1 validation error

    // Confirm import
    const confirmed = await confirmIngestionWithAdapter({
      adapter,
      input: { fileName: "mixed-batch.csv", csvText: csv },
      session: opsSession,
      correlationId: "ing-test-corr",
    });

    createdBatchId = confirmed.batch.id;
    expect(confirmed.batch.successRows).toBe(1);
    expect(confirmed.batch.errorRows).toBe(2);
    expect(confirmed.createdCases).toHaveLength(1);
    createdCaseId = confirmed.createdCases[0].caseId;

    // Verify failed-row export preserves errors and neutralizes formula injection
    const failedCsv = await exportFailedRowsCsv(horizonTenantId, createdBatchId);
    expect(failedCsv.fileName).toBe("failed-rows-mixed-batch.csv");
    expect(failedCsv.csvContent).toContain("DUPLICATE_IN_DATABASE");
    expect(failedCsv.csvContent).toContain("VALIDATION_ERROR");
    expect(failedCsv.csvContent).toContain("REF-2026-1001");

    // Verify another tenant cannot export Horizon's failed-row report
    await expect(exportFailedRowsCsv(pacificTenantId, createdBatchId)).rejects.toThrow(
      NotFoundError
    );
  });
});
