import {
  IngestionRowError,
  NormalizedIngestionParseResult,
  NormalizedIngestionRow,
  ReferralIngestionAdapter,
} from "./ingestion-adapter";

export interface FhirBundleInput {
  bundleId: string;
  entries: Array<{
    resourceType: string;
    id?: string;
    authoredOn?: string;
    subjectReference?: string;
    specialty?: string;
    reasonText?: string;
    geography?: string;
    network?: string;
    eligibilityStatus?: "VERIFIED" | "UNVERIFIED" | "UNKNOWN";
    preferredLanguage?: string;
  }>;
}

/**
 * Clean FHIR R4 ServiceRequest ingestion adapter implementing the shared
 * ReferralIngestionAdapter interface so future FHIR feeds enter the exact
 * same CareLoop deduplication, validation, and AI triage pipeline.
 */
export class FhirServiceRequestIngestionAdapter implements ReferralIngestionAdapter<FhirBundleInput> {
  public readonly sourceType = "FHIR" as const;

  async parseAndValidate(input: FhirBundleInput): Promise<NormalizedIngestionParseResult> {
    const validRows: NormalizedIngestionRow[] = [];
    const errors: IngestionRowError[] = [];

    input.entries.forEach((entry, idx) => {
      const rowNumber = idx + 1;
      if (entry.resourceType !== "ServiceRequest") {
        errors.push({
          rowNumber,
          errorType: "VALIDATION_ERROR",
          message: `Unsupported FHIR resourceType '${entry.resourceType}'; expected ServiceRequest.`,
        });
        return;
      }
      if (!entry.id || !entry.subjectReference || !entry.authoredOn || !entry.specialty) {
        errors.push({
          rowNumber,
          externalReferralId: entry.id,
          errorType: "VALIDATION_ERROR",
          message: "ServiceRequest missing required id, subjectReference, authoredOn, or specialty.",
        });
        return;
      }

      validRows.push({
        rowNumber,
        externalReferralId: entry.id,
        data: {
          externalMemberId: entry.subjectReference.replace(/^Patient\//, ""),
          firstName: "FHIR",
          lastName: "Member",
          externalReferralId: entry.id,
          referralDate: entry.authoredOn,
          behavioralHealthNeed: entry.reasonText ?? entry.specialty,
          specialty: entry.specialty,
          urgency: "ROUTINE",
          geography: entry.geography ?? "UNKNOWN",
          urbanicity: "UNKNOWN",
          networkRequired: entry.network ?? "UNKNOWN",
          coverageType: "UNKNOWN",
          eligibilityVerified: entry.eligibilityStatus ?? "UNKNOWN",
          preferredLanguage: entry.preferredLanguage ?? "English",
          preferredContactChannel: "UNKNOWN",
          consentSms: false,
          digitalAccessLevel: "UNKNOWN",
          transportationAccess: "UNKNOWN",
          priorNoShowCount: 0,
        },
      });
    });

    return {
      sourceType: this.sourceType,
      fileName: `fhir-bundle-${input.bundleId}.json`,
      totalRows: input.entries.length,
      validRows,
      errors,
    };
  }
}
