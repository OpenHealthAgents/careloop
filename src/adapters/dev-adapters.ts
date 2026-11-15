import { createDefaultCommunicationDispatcher } from "./communication/channel-registry";
import {
  AdapterDescriptor,
  CommunicationAdapter,
  CommunicationDispatchRequest,
  CommunicationDispatchResult,
  SchedulingAdapter,
  SchedulingBookingRequest,
  SchedulingBookingResponse,
} from "./contracts";

export class DeterministicCommunicationAdapter implements CommunicationAdapter {
  private readonly dispatcher = createDefaultCommunicationDispatcher();

  public readonly descriptor: AdapterDescriptor = {
    key: "dev-comm",
    name: "CareLoop Dev Communication Simulator",
    category: "Communication",
    status: "MVP_ACTIVE",
    description: "Dispatches SMS, Email, Phone, and Portal messages through pluggable channel adapters while enforcing consent.",
  };

  async sendMessage(request: CommunicationDispatchRequest): Promise<CommunicationDispatchResult> {
    return this.dispatcher.sendMessage(request);
  }
}

export class DeterministicSchedulingAdapter implements SchedulingAdapter {
  public readonly descriptor: AdapterDescriptor = {
    key: "dev-scheduling",
    name: "CareLoop Dev Scheduling Bridge",
    category: "Scheduling",
    status: "MVP_ACTIVE",
    description: "Reserves verified CareLoop slots or logs manual clinic confirmation requests for directory-only providers.",
  };

  async bookSlot(request: SchedulingBookingRequest): Promise<SchedulingBookingResponse> {
    const resolvedSource = request.source ?? "DIRECTORY_INFORMATION";
    return {
      confirmed: true,
      externalAppointmentId: `sim-appt-${Date.now()}`,
      source: resolvedSource,
      note:
        resolvedSource === "VERIFIED_AVAILABILITY"
          ? "Booked directly against verified CareLoop slot inventory."
          : "Booked from directory information — clinic confirmation recommended.",
    };
  }
}

export const INTEGRATION_ADAPTER_REGISTRY: AdapterDescriptor[] = [
  {
    key: "csv-referral-ingestor",
    name: "CSV Population & Referral Ingestor",
    category: "Referral System",
    status: "MVP_ACTIVE",
    description: "Validates and ingests behavioral-health referral batches via CSV upload.",
  },
  new DeterministicCommunicationAdapter().descriptor,
  new DeterministicSchedulingAdapter().descriptor,
  {
    key: "claims-x12-837",
    name: "Claims Verification Adapter (X12 837/835)",
    category: "Claims",
    status: "STUB_ADAPTER",
    description: "Interface defined in src/adapters/contracts.ts for automated post-visit claim verification.",
  },
  {
    key: "eligibility-270-271",
    name: "Real-Time Eligibility Adapter (X12 270/271)",
    category: "Eligibility",
    status: "STUB_ADAPTER",
    description: "Interface defined for payer eligibility & network plan lookup.",
  },
  {
    key: "provider-directory-fhir",
    name: "Provider Directory & Slot Feed",
    category: "Provider Directory",
    status: "STUB_ADAPTER",
    description: "Separates stale directory feeds from real-time verified slot feeds.",
  },
  {
    key: "fhir-r4-servicerequest",
    name: "FHIR R4 ServiceRequest / Appointment Adapter",
    category: "FHIR",
    status: "PLANNED",
    description: "Contract ready for EHR/HIE FHIR R4 referral ingestion and status sync.",
  },
  {
    key: "hl7-v2-orm",
    name: "HL7 v2 ORM/SIU Interface",
    category: "HL7",
    status: "PLANNED",
    description: "Contract ready for legacy hospital/clinic HL7 v2 referral and scheduling messages.",
  },
  {
    key: "care-mgmt-export",
    name: "Care Management Platform Sync",
    category: "Care Management",
    status: "PLANNED",
    description: "Contract ready for bidirectional case sync with enterprise payer care management systems.",
  },
];
