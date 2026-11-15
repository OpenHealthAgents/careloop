/**
 * Clean external integration adapter contracts.
 * MVP uses CSV ingestion + deterministic development implementations.
 * Production connectors (FHIR, HL7, Claims, EHR Scheduling, SMS gateways)
 * implement these interfaces without modifying domain or service logic.
 */

export interface AdapterDescriptor {
  key: string;
  name: string;
  category:
    | "Claims"
    | "Eligibility"
    | "Provider Directory"
    | "Referral System"
    | "Scheduling"
    | "Care Management"
    | "Communication"
    | "FHIR"
    | "HL7";
  status: "MVP_ACTIVE" | "STUB_ADAPTER" | "PLANNED";
  description: string;
}

export interface ClaimsVerificationCheck {
  externalReferralId: string;
  claimFound: boolean;
  serviceDate?: Date;
  renderingProviderNpi?: string;
  sourceSystem: string;
}

export interface ClaimsAdapter {
  readonly descriptor: AdapterDescriptor;
  checkCompletedVisitClaim(externalReferralId: string): Promise<ClaimsVerificationCheck>;
}

export interface EligibilityCheckResult {
  externalMemberId: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE" | "UNKNOWN";
  networkName: string;
  verifiedAt: Date;
}

export interface EligibilityAdapter {
  readonly descriptor: AdapterDescriptor;
  verifyEligibility(externalMemberId: string): Promise<EligibilityCheckResult>;
}

export interface ProviderDirectorySyncResult {
  syncedCount: number;
  verifiedAvailabilityCount: number;
  directoryOnlyCount: number;
  syncedAt: Date;
}

export interface ProviderDirectoryAdapter {
  readonly descriptor: AdapterDescriptor;
  syncDirectory(tenantId: string): Promise<ProviderDirectorySyncResult>;
}

export interface ExternalReferralPayload {
  externalReferralId: string;
  externalMemberId: string;
  referralDate: string;
  specialty: string;
  behavioralHealthNeed: string;
}

export interface ReferralSystemAdapter {
  readonly descriptor: AdapterDescriptor;
  pullPendingReferrals(tenantId: string): Promise<ExternalReferralPayload[]>;
}

export interface SchedulingBookingRequest {
  providerNpi: string;
  memberExternalId: string;
  slotStartAt: Date;
  modality: "IN_PERSON" | "TELEHEALTH";
  source?: "VERIFIED_AVAILABILITY" | "DIRECTORY_INFORMATION";
}

export interface SchedulingBookingResponse {
  confirmed: boolean;
  externalAppointmentId?: string;
  source: "VERIFIED_AVAILABILITY" | "DIRECTORY_INFORMATION";
  note: string;
}

export interface SchedulingAdapter {
  readonly descriptor: AdapterDescriptor;
  bookSlot(request: SchedulingBookingRequest): Promise<SchedulingBookingResponse>;
}

export interface CareManagementAdapter {
  readonly descriptor: AdapterDescriptor;
  exportCaseSummary(caseId: string, summary: string): Promise<{ exported: boolean; externalId?: string }>;
}

export type SupportedCommunicationChannel = "SMS" | "PHONE" | "EMAIL" | "PORTAL";

export interface CommunicationDispatchRequest {
  channel: SupportedCommunicationChannel;
  language: string;
  subject?: string;
  messageBody: string;
  consentVerified: boolean;
  metadata?: Record<string, unknown>;
}

export interface CommunicationDispatchResult {
  dispatched: boolean;
  deliveryStatus: "SENT" | "DELIVERED" | "FAILED";
  deliveryMode: "MOCK" | "LIVE";
  channel: SupportedCommunicationChannel;
  providerKey: string;
  externalMessageId?: string;
  reason?: string;
}

export interface CommunicationChannelAdapter {
  readonly channel: SupportedCommunicationChannel;
  readonly providerKey: string;
  readonly displayName: string;
  send(request: CommunicationDispatchRequest): Promise<CommunicationDispatchResult>;
}

export interface CommunicationAdapter {
  readonly descriptor: AdapterDescriptor;
  sendMessage(request: CommunicationDispatchRequest): Promise<CommunicationDispatchResult>;
}

export interface FHIRAdapter {
  readonly descriptor: AdapterDescriptor;
  parseServiceRequestBundle(bundleJson: unknown): Promise<ExternalReferralPayload[]>;
}

export interface HL7Adapter {
  readonly descriptor: AdapterDescriptor;
  parseORMMessage(rawHl7: string): Promise<ExternalReferralPayload | null>;
}
