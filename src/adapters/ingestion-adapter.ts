import { ParsedCsvReferralRow } from "./csv-referral-parser";

export type IngestionSourceType = "CSV" | "FHIR" | "API" | "HL7";

export interface NormalizedIngestionRow {
  rowNumber: number;
  externalReferralId: string;
  data: ParsedCsvReferralRow;
}

export interface IngestionRowError {
  rowNumber: number;
  externalReferralId?: string;
  errorType: "VALIDATION_ERROR" | "DUPLICATE_IN_FILE" | "DUPLICATE_IN_DATABASE" | "SECURITY_VIOLATION" | "PERSISTENCE_ERROR";
  message: string;
  rawRow?: Record<string, string>;
}

export interface NormalizedIngestionParseResult {
  sourceType: IngestionSourceType;
  fileName: string;
  totalRows: number;
  validRows: NormalizedIngestionRow[];
  errors: IngestionRowError[];
}

/**
 * Unified domain interface for all CareLoop referral ingestion sources.
 * Future FHIR R4 ServiceRequest, HL7 v2 ORM, and REST webhook adapters
 * implement this interface so validation, deduplication, audit logging,
 * and AI triage execute identically across every source.
 */
export interface ReferralIngestionAdapter<TInput> {
  readonly sourceType: IngestionSourceType;
  parseAndValidate(input: TInput): Promise<NormalizedIngestionParseResult>;
}
