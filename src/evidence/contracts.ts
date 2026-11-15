export type EvidenceSourceType =
  | "TOOL_EXECUTION"
  | "PROVIDER_DIRECTORY"
  | "VERIFIED_AVAILABILITY"
  | "MEMBER_CONSENT"
  | "CLINIC_CONFIRMATION"
  | "HUMAN_REVIEW"
  | "SYSTEM";

export interface Evidence {
  id: string;
  caseId: string;
  tenantId: string;
  sourceType: EvidenceSourceType;
  summary: string;
  payloadHash: string;
  capturedAt: string;
  capturedBy: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceStore {
  record(evidence: Omit<Evidence, "id" | "payloadHash" | "capturedAt"> & { payload?: unknown }): Evidence;
  verifyIntegrity(evidence: Evidence, payload: unknown): boolean;
}
