import { describe, expect, it } from "vitest";
import {
  CsvReferralIngestionAdapter,
  MAX_CSV_BYTES,
  parseReferralCsv,
  sanitizeCsvCellForExport,
  validateCsvPayloadSecurity,
} from "@/adapters/csv-referral-parser";
import { FhirServiceRequestIngestionAdapter } from "@/adapters/fhir-ingestion-adapter";
import { ValidationError } from "@/lib/errors";

describe("CSV & Adapter Referral Ingestion Parser", () => {
  it("parses valid rows with all required fields and reports row-level validation errors", () => {
    const csv = `member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,geography,network,eligibility_verified,preferred_language,operational_notes
MEM-1,Ana,Lopez,REF-1,2026-11-01,Outpatient Therapy,Outpatient Behavioral Health,Central Metro,Horizon Medicaid,VERIFIED,Spanish,"Needs transit, Spanish preferred"
MEM-2,Bad,Row,REF-2,not-a-date,Counseling,Outpatient Behavioral Health,Central Metro,Horizon Medicaid,VERIFIED,English,Missing valid date
MEM-3,Missing,Network,REF-3,2026-11-01,Counseling,Outpatient Behavioral Health,Central Metro,,VERIFIED,English,Missing network
MEM-1,Ana,Lopez,REF-1,2026-11-01,Outpatient Therapy,Outpatient Behavioral Health,Central Metro,Horizon Medicaid,VERIFIED,Spanish,Duplicate referral in file`;

    const result = parseReferralCsv(csv);
    expect(result.totalRows).toBe(4);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].data.externalReferralId).toBe("REF-1");
    expect(result.validRows[0].data.operationalNotes).toBe("Needs transit, Spanish preferred");

    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].errorType).toBe("VALIDATION_ERROR");
    expect(result.errors[1].errorType).toBe("VALIDATION_ERROR");
    expect(result.errors[2].errorType).toBe("DUPLICATE_IN_FILE");
  });

  it("enforces file upload security controls and neutralizes CSV formula injection", async () => {
    expect(() => validateCsvPayloadSecurity("malware.exe", "a,b\n1,2")).toThrow(ValidationError);
    expect(() => validateCsvPayloadSecurity("bad.csv", "a,b\0,c")).toThrow(ValidationError);
    expect(() =>
      validateCsvPayloadSecurity("huge.csv", "a,b\n1,2", MAX_CSV_BYTES + 1)
    ).toThrow(ValidationError);

    expect(validateCsvPayloadSecurity("../../evil/path/batch.csv", "a,b\n1,2")).toBe("batch.csv");

    // Rejects tenant_id injection column in CSV
    const tenantSpoofCsv = `member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,geography,network,eligibility_verified,preferred_language,tenant_id
MEM-9,Eve,Spoof,REF-9,2026-11-01,Therapy,Outpatient Behavioral Health,Metro,Horizon Medicaid,VERIFIED,English,other-tenant-id`;
    const adapter = new CsvReferralIngestionAdapter();
    const parsed = await adapter.parseAndValidate({
      fileName: "spoof.csv",
      csvText: tenantSpoofCsv,
    });
    expect(parsed.validRows).toHaveLength(0);
    expect(parsed.errors[0].errorType).toBe("SECURITY_VIOLATION");

    // Neutralizes formula injection on failed-row export
    expect(sanitizeCsvCellForExport("=CMD|' /C calc'!A0")).toBe('"\'=CMD|\' /C calc\'!A0"');
    expect(sanitizeCsvCellForExport("+1+1")).toBe('"\'+1+1"');
  });

  it("supports shared ReferralIngestionAdapter abstraction for FHIR bundles", async () => {
    const fhir = new FhirServiceRequestIngestionAdapter();
    const res = await fhir.parseAndValidate({
      bundleId: "bnd-1",
      entries: [
        {
          resourceType: "ServiceRequest",
          id: "FHIR-SR-100",
          authoredOn: "2026-11-01",
          subjectReference: "Patient/MEM-888",
          specialty: "Outpatient Behavioral Health",
          network: "Horizon Medicaid",
          eligibilityStatus: "VERIFIED",
          preferredLanguage: "Spanish",
        },
        {
          resourceType: "Observation",
          id: "OBS-1",
        },
      ],
    });
    expect(res.validRows).toHaveLength(1);
    expect(res.validRows[0].externalReferralId).toBe("FHIR-SR-100");
    expect(res.errors).toHaveLength(1);
  });
});
