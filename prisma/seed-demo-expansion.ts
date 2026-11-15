import {
  AIOperation,
  AppointmentStatus,
  AvailabilitySource,
  BarrierCategory,
  CaseStatus,
  CommunicationChannel,
  CommunicationMessageType,
  DeliveryStatus,
  EpistemicStatus,
  InterventionExecutionMode,
  InterventionStatus,
  InterventionType,
  NotificationStatus,
  PrismaClient,
  ReadingLevel,
  RecommendationStatus,
  ReferralStatus,
  RiskLevel,
  User,
  VerificationSignalType,
  VerificationStatus,
  WorkflowEventType,
} from "@prisma/client";

type ProviderSeedSpec = {
  npi: string;
  name: string;
  organizationName: string;
  specialty: string;
  networkNames: string[];
  languages: string[];
  geography: string;
  county: string;
  telehealthAvailable: boolean;
  acceptingNewPatients: boolean;
  availabilitySource: AvailabilitySource;
  waitDays: number;
  notes: string;
};

const EXTRA_PROVIDERS: ProviderSeedSpec[] = [
  {
    npi: "6001122001",
    name: "Dr. Mei-Ling Zhou, PhD",
    organizationName: "Pacific Harmony Behavioral Clinic",
    specialty: "Outpatient Behavioral Health",
    networkNames: ["Horizon Medicaid", "Beacon Behavioral"],
    languages: ["English", "Mandarin", "Vietnamese"],
    geography: "East Valley",
    county: "Valley County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 2,
    notes: "Direct EHR feed; verified bilingual Mandarin & Vietnamese intake slots.",
  },
  {
    npi: "6001122002",
    name: "Tariq Al-Mansoor, LCSW",
    organizationName: "Harbor Bridge Wellness Center",
    specialty: "Trauma & PTSD Care",
    networkNames: ["Horizon Medicaid", "Horizon Integrated", "Harbor Medicare Advantage"],
    languages: ["English", "Arabic"],
    geography: "South Harbor",
    county: "Harbor County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 3,
    notes: "Verified trauma-informed Arabic & English outpatient therapy slots.",
  },
  {
    npi: "6001122003",
    name: "Dr. Priya Deshmukh, MD",
    organizationName: "Westside Psychiatric Associates",
    specialty: "Medication Management",
    networkNames: ["Horizon Integrated", "Pacific Commercial", "Harbor Medicare Advantage"],
    languages: ["English", "Hindi", "Spanish"],
    geography: "Westside",
    county: "Metro County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 4,
    notes: "Evening telehealth psychiatry & medication follow-up slots.",
  },
  {
    npi: "6001122004",
    name: "Camila Ferreira, LMFT",
    organizationName: "Central Youth & Family Partners",
    specialty: "Child & Adolescent Therapy",
    networkNames: ["Horizon Medicaid", "Beacon Behavioral"],
    languages: ["English", "Spanish", "Portuguese"],
    geography: "Central Metro",
    county: "Metro County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 2,
    notes: "Verified after-school family therapy & adolescent slots.",
  },
  {
    npi: "6001122005",
    name: "Anh Tuan Pham, LCSW",
    organizationName: "Valley Community Counseling",
    specialty: "Outpatient Behavioral Health",
    networkNames: ["Horizon Medicaid", "Horizon Integrated"],
    languages: ["English", "Vietnamese"],
    geography: "East Valley",
    county: "Valley County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 3,
    notes: "Direct scheduling API active; Vietnamese cultural liaison.",
  },
  {
    npi: "6001122006",
    name: "Dr. Hannah Gallagher, PsyD",
    organizationName: "Westside Evening Behavioral Group",
    specialty: "Outpatient Behavioral Health",
    networkNames: ["Horizon Integrated", "Pacific Commercial", "Beacon Behavioral"],
    languages: ["English"],
    geography: "Westside",
    county: "Metro County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 1,
    notes: "Extended weekday evening telehealth slots (5pm–8pm) for working members.",
  },
  {
    npi: "6001122007",
    name: "Marco Santoro, CADC-II",
    organizationName: "South Harbor Recovery Pathways",
    specialty: "Substance Use Recovery",
    networkNames: ["Horizon Medicaid", "Beacon Behavioral"],
    languages: ["English", "Spanish"],
    geography: "South Harbor",
    county: "Harbor County",
    telehealthAvailable: false,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 4,
    notes: "Verified in-person IOP & outpatient SUD intake slots; transit accessible.",
  },
  {
    npi: "6001122008",
    name: "Dr. Kwame Mensah, MD",
    organizationName: "Metro Psychiatry & Behavioral Health",
    specialty: "Outpatient Psychiatry",
    networkNames: ["Horizon Medicaid", "Harbor Medicare Advantage", "Horizon Integrated"],
    languages: ["English"],
    geography: "Central Metro",
    county: "Metro County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 6,
    notes: "Verified Medicare Advantage & Dual Eligible psychiatry intakes.",
  },
  {
    npi: "6001122009",
    name: "Marisol Delgado, LPC",
    organizationName: "Puente Rural Telehealth Hub",
    specialty: "Trauma & PTSD Care",
    networkNames: ["Horizon Medicaid", "Horizon Integrated"],
    languages: ["English", "Spanish", "Tagalog"],
    geography: "Rural North",
    county: "North County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 5,
    notes: "Verified telehealth access tailored for Rural North members.",
  },
  {
    npi: "6001122010",
    name: "Rachel O'Connor, LCSW",
    organizationName: "Clearwater Adolescent Clinic",
    specialty: "Child & Adolescent Therapy",
    networkNames: ["Pacific Commercial", "Horizon Integrated"],
    languages: ["English"],
    geography: "Westside",
    county: "Metro County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION,
    waitDays: 14,
    notes: "Directory-only status; clinic callback needed to confirm real slot.",
  },
  {
    npi: "6001122011",
    name: "Dr. Victor Morales, MD",
    organizationName: "Harbor Geriatric & Adult Psychiatry",
    specialty: "Medication Management",
    networkNames: ["Harbor Medicare Advantage", "Horizon Integrated"],
    languages: ["English", "Spanish"],
    geography: "South Harbor",
    county: "Harbor County",
    telehealthAvailable: false,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION,
    waitDays: 22,
    notes: "Directory refresh 19 days ago; manual verification recommended.",
  },
  {
    npi: "6001122012",
    name: "Farah Siddiqui, LMFT",
    organizationName: "East Valley Family Wellness",
    specialty: "Outpatient Behavioral Health",
    networkNames: ["Horizon Medicaid", "Beacon Behavioral"],
    languages: ["English", "Hindi", "Arabic"],
    geography: "East Valley",
    county: "Valley County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION,
    waitDays: 16,
    notes: "Multi-lingual directory partner; unverified real-time slot inventory.",
  },
  {
    npi: "6001122013",
    name: "Jason Park, PhD",
    organizationName: "Metro Neurobehavioral Institute",
    specialty: "Trauma & PTSD Care",
    networkNames: ["Pacific Commercial", "Harbor Medicare Advantage"],
    languages: ["English"],
    geography: "Central Metro",
    county: "Metro County",
    telehealthAvailable: true,
    acceptingNewPatients: false,
    availabilitySource: AvailabilitySource.NOT_AVAILABLE,
    waitDays: 42,
    notes: "Currently closed to new referrals pending clinician onboarding.",
  },
  {
    npi: "6001122014",
    name: "Grace Navarro, LCSW",
    organizationName: "Northridge Rural Counseling",
    specialty: "Outpatient Behavioral Health",
    networkNames: ["Horizon Medicaid"],
    languages: ["English", "Spanish"],
    geography: "Rural North",
    county: "North County",
    telehealthAvailable: false,
    acceptingNewPatients: false,
    availabilitySource: AvailabilitySource.NOT_AVAILABLE,
    waitDays: 38,
    notes: "Waitlist full (rural clinician shortage).",
  },
  {
    npi: "6001122015",
    name: "Dr. Evelyn Cho, MD",
    organizationName: "Beacon Specialty Psychiatry",
    specialty: "Outpatient Psychiatry",
    networkNames: ["Beacon Behavioral", "Pacific Commercial"],
    languages: ["English", "Mandarin"],
    geography: "Central Metro",
    county: "Metro County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
    waitDays: 3,
    notes: "Verified EHR psychiatry slots with Mandarin translator/clinician support.",
  },
  {
    npi: "6001122016",
    name: "Darnell Brooks, LCSW",
    organizationName: "South Harbor Community Care",
    specialty: "Substance Use Recovery",
    networkNames: ["Horizon Medicaid", "Horizon Integrated"],
    languages: ["English"],
    geography: "South Harbor",
    county: "Harbor County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION,
    waitDays: 12,
    notes: "Directory wait estimate ~12 days; outreach confirms slot availability.",
  },
  {
    npi: "6001122017",
    name: "Sofia Mendoza, LMFT",
    organizationName: "Valley Bilingual Counseling",
    specialty: "Child & Adolescent Therapy",
    networkNames: ["Horizon Medicaid", "Horizon Integrated", "Beacon Behavioral"],
    languages: ["English", "Spanish", "Tagalog"],
    geography: "East Valley",
    county: "Valley County",
    telehealthAvailable: true,
    acceptingNewPatients: true,
    availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION,
    waitDays: 19,
    notes: "Directory-listed bilingual youth therapist; stale verification warning.",
  },
];

const FIRST_NAMES = [
  "Aaliyah", "Mateo", "Nadia", "Devon", "Linh", "Carlos", "Priya", "Omar", "Elena", "Keisha",
  "Samuel", "Mei", "Javier", "Fatima", "Lucas", "Ananya", "Noah", "Camila", "Darius", "Hana",
  "Diego", "Maya", "Tariq", "Grace", "Isaiah", "Sofia", "Rohan", "Zoe", "Gabriel", "Kendra",
  "Thanh", "Mariana", "Malik", "Yuki", "Rafael", "Jasmine", "Hassan", "claire", "Andre", "Leila",
  "Victor", "Nora", "Eduardo", "Amina", "Trevor",
];

const LAST_NAMES = [
  "Martinez", "Washington", "Nguyen", "Patel", "Al-Hassan", "Hernandez", "Kim", "Okafor",
  "Gomez", "Robinson", "Tran", "Singh", "Delgado", "Brooks", "Chen", "Reyes", "Mohamed",
  "Flores", "Jackson", "Lin", "Castillo", "Ibrahim", "Cruz", "Foster", "Bautista", "Sharma",
  " Morales", "Carter", "Pham", "Salazar", "Alvarez", "Bailey", "Zhou", "Mendoza", "Howard",
  "Ramos", "Diaz", "Kulkarni", "Vargas", "Wallace", "Ruiz", "Park", "Dominguez", "Price", "Ortega",
];

export async function seedDemoExpansion(params: {
  prisma: PrismaClient;
  tenantId: string;
  careManager: User;
  adminUser: User;
  existingProviders: {
    drRiveraId: string;
    drKulkarniId: string;
    drNguyenId: string;
    drThorntonId: string;
    drAlvarezId: string;
  };
}) {
  const { prisma, tenantId, careManager, adminUser, existingProviders } = params;
  const now = new Date();
  const daysAgo = (days: number, hour = 11) => {
    const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const inDays = (days: number, hour = 10) => {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  // 1. Seed 17 additional providers (total 22 in horizon-bh)
  const seededProviders: Array<{
    id: string;
    specialty: string;
    languages: string[];
    geography: string;
    networkNames: string[];
    availabilitySource: AvailabilitySource;
  }> = [];

  for (const spec of EXTRA_PROVIDERS) {
    const p = await prisma.provider.create({
      data: {
        tenantId,
        npi: spec.npi,
        name: spec.name,
        organizationName: spec.organizationName,
        specialty: spec.specialty,
        networkNames: spec.networkNames,
        languages: spec.languages,
        geography: spec.geography,
        county: spec.county,
        telehealthAvailable: spec.telehealthAvailable,
        acceptingNewPatients: spec.acceptingNewPatients,
        availabilitySource: spec.availabilitySource,
        nextVerifiedSlotAt:
          spec.availabilitySource === AvailabilitySource.VERIFIED_AVAILABILITY
            ? inDays(spec.waitDays, 11)
            : null,
        directoryWaitDays:
          spec.availabilitySource !== AvailabilitySource.VERIFIED_AVAILABILITY ? spec.waitDays : null,
        availabilityLastVerifiedAt:
          spec.availabilitySource === AvailabilitySource.VERIFIED_AVAILABILITY
            ? daysAgo(0)
            : daysAgo(spec.availabilitySource === AvailabilitySource.DIRECTORY_INFORMATION ? 20 : 35),
        notes: spec.notes,
      },
    });

    if (spec.availabilitySource === AvailabilitySource.VERIFIED_AVAILABILITY) {
      await prisma.providerAvailability.createMany({
        data: [
          {
            tenantId,
            providerId: p.id,
            slotStartAt: inDays(spec.waitDays, 10),
            slotEndAt: inDays(spec.waitDays, 11),
            modality: spec.telehealthAvailable ? "TELEHEALTH" : "IN_PERSON",
            source: AvailabilitySource.VERIFIED_AVAILABILITY,
            status: "AVAILABLE",
            waitDaysEstimate: spec.waitDays,
            verifiedAt: now,
          },
          {
            tenantId,
            providerId: p.id,
            slotStartAt: inDays(spec.waitDays + 2, 17),
            slotEndAt: inDays(spec.waitDays + 2, 18),
            modality: spec.telehealthAvailable ? "TELEHEALTH" : "IN_PERSON",
            source: AvailabilitySource.VERIFIED_AVAILABILITY,
            status: "AVAILABLE",
            waitDaysEstimate: spec.waitDays + 2,
            verifiedAt: now,
          },
        ],
      });
    }

    seededProviders.push(p);
  }

  const drZhou = seededProviders[0];
  const drMansoor = seededProviders[1];
  const drDeshmukh = seededProviders[2];
  const drPham = seededProviders[4];
  const drGallagher = seededProviders[5];
  const drMensah = seededProviders[7];
  const drCho = seededProviders[14];

  const verifiedPool = [
    existingProviders.drRiveraId,
    existingProviders.drKulkarniId,
    existingProviders.drAlvarezId,
    ...seededProviders
      .filter((p) => p.availabilitySource === AvailabilitySource.VERIFIED_AVAILABILITY)
      .map((p) => p.id),
  ];
  const allProviderPool = [
    existingProviders.drRiveraId,
    existingProviders.drKulkarniId,
    existingProviders.drNguyenId,
    existingProviders.drAlvarezId,
    ...seededProviders.map((p) => p.id),
  ];

  // =========================================================================
  // 2. Five Explicit Showcase Scenarios (Full Workflow & Audit Histories)
  // =========================================================================

  async function seedWorkflowChain(caseId: string, transitions: Array<[CaseStatus | null, CaseStatus, string, number]>) {
    for (const [fromStatus, toStatus, reason, dAgo] of transitions) {
      await prisma.workflowEvent.create({
        data: {
          tenantId,
          caseId,
          eventType:
            toStatus === CaseStatus.ESCALATED
              ? WorkflowEventType.ESCALATED
              : WorkflowEventType.STATUS_TRANSITION,
          fromStatus,
          toStatus,
          actorId: careManager.id,
          actorRole: careManager.role,
          reason,
          createdAt: daysAgo(dAgo),
        },
      });
    }
  }

  // Scenario A: SUCCESSFUL CASE
  // Referral -> high risk -> provider access barrier -> provider match -> appointment -> confirmation -> completed visit -> verification -> closed
  {
    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: "MEM-DEMO-01",
        firstName: "Natalie",
        lastName: "Rivera",
        dobYear: 1986,
        preferredLanguage: "English",
        geography: "South Harbor",
        urbanicity: "URBAN",
        coverageType: "MEDICAID",
        networkName: "Horizon Medicaid",
        eligibilityStatus: "ACTIVE",
        preferredContactChannel: "SMS",
        consentOutreach: true,
        consentSms: true,
        raceEthnicityCohort: "Hispanic / Latino",
        ageGroupCohort: "35-49",
        digitalAccessLevel: "HIGH",
        transportationAccess: "PUBLIC_TRANSIT",
        priorNoShowCount: 1,
        historicalEngagementRate: 0.72,
      },
    });
    const consent = await prisma.consent.create({
      data: { tenantId, memberId: member.id, channel: "SMS", purpose: "CARE_OUTREACH", granted: true, source: "DEMO_SCENARIO" },
    });
    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: "REF-DEMO-SUCCESS-01",
        referralDate: daysAgo(15),
        sourceSystem: "EHR_FEED_DEMO",
        behavioralHealthNeed: "Major Depressive Episode Follow-Up",
        specialty: "Outpatient Psychiatry",
        urgency: "PRIORITY",
        geography: "South Harbor",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        referringProviderName: "Dr. Elena Foster, MD",
        operationalNotes: "Original clinic closed waitlist; member requests alternate in-network psychiatrist ASAP.",
        status: ReferralStatus.COMPLETED,
      },
    });
    const c = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        assignedToId: careManager.id,
        matchedProviderId: drMensah.id,
        status: CaseStatus.CLOSED,
        priorityScore: 86,
        riskLevel: RiskLevel.HIGH,
        riskExplanation: "Priority psychiatry referral with prior waitlist blockage and 1 prior missed visit.",
        primaryBarrierCategory: BarrierCategory.ACCESS,
        primaryBarrierCode: "provider shortage",
        firstCompletedVisitAt: daysAgo(2),
        closedAt: daysAgo(1),
        closureReason: "First behavioral-health visit completed and multi-signal verified.",
        createdAt: daysAgo(15),
      },
    });
    await prisma.riskAssessment.create({
      data: {
        tenantId,
        caseId: c.id,
        referralId: referral.id,
        riskLevel: RiskLevel.HIGH,
        score: 86,
        confidence: 0.91,
        uncertainty: "High operational urgency due to waitlisted original clinic.",
        explanation: "Priority psychiatry referral with closed original clinic waitlist.",
        humanEscalationSuggested: true,
        evidenceSignals: ["Waitlist closed at referring clinic", "Priority SLA", "1 prior missed visit"],
        providerName: "CareLoop-Deterministic-Engine",
        modelVersion: "careloop-rules-v1",
      },
    });
    await prisma.barrier.create({
      data: {
        tenantId,
        caseId: c.id,
        category: BarrierCategory.ACCESS,
        subBarrier: "provider shortage",
        epistemicStatus: EpistemicStatus.FACT,
        confidence: 1.0,
        evidenceSignals: ["Initial clinic reported waitlist closed", "Confirmed by coordinator call"],
        uncertainty: "Confirmed access barrier.",
        confirmedByHuman: true,
        confirmedById: careManager.id,
      },
    });
    const rec = await prisma.aIRecommendation.create({
      data: {
        tenantId,
        caseId: c.id,
        referralId: referral.id,
        operation: AIOperation.RECOMMEND_INTERVENTION,
        status: RecommendationStatus.APPROVED,
        providerName: "CareLoop-Deterministic-Engine",
        modelVersion: "careloop-rules-v1",
        facts: ["Original psychiatry clinic waitlist full; member holds active Horizon Medicaid coverage."],
        inferences: [{ statement: "Alternate verified psychiatry match prevents >30d delay.", confidence: 0.91 }],
        recommendations: [{ action: "Match to Dr. Kwame Mensah (verified slot in 6 days).", confidence: 0.91, requiresHumanReview: true }],
        confidence: 0.91,
        uncertainty: "Requires member schedule agreement.",
        evidenceSignals: ["Horizon Medicaid parity verified"],
        humanReviewerId: careManager.id,
        reviewedAt: daysAgo(12),
      },
    });
    const inv = await prisma.intervention.create({
      data: {
        tenantId,
        caseId: c.id,
        type: InterventionType.ALTERNATIVE_PROVIDER_SEARCH,
        reason: "Original provider unavailable / waitlisted.",
        triggeringBarrierCategory: BarrierCategory.ACCESS,
        triggeringBarrierCode: "provider shortage",
        recommendedAction: "Matched member to Dr. Kwame Mensah, MD with verified slot inventory.",
        executionMode: InterventionExecutionMode.HUMAN_ASSISTED,
        isHighRisk: true,
        confidence: 0.91,
        assignedOwnerId: careManager.id,
        status: InterventionStatus.COMPLETED,
        aiRecommendationId: rec.id,
        approvedAt: daysAgo(12),
        completedAt: daysAgo(9),
      },
    });
    await prisma.interventionOutcome.create({
      data: {
        tenantId,
        interventionId: inv.id,
        outcomeStatus: "COMPLETED",
        summary: "Member accepted alternate in-network psychiatrist match and confirmed telehealth intake.",
        barriersResolved: true,
        followUpRequired: false,
        recordedById: careManager.id,
      },
    });
    await prisma.communication.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        interventionId: inv.id,
        consentId: consent.id,
        channel: CommunicationChannel.SMS,
        messageType: CommunicationMessageType.APPOINTMENT_CONFIRMATION,
        readingLevel: ReadingLevel.PLAIN,
        direction: "OUTBOUND",
        language: "English",
        draftedByAi: true,
        humanApprovedById: careManager.id,
        messageSummary: "Confirmed alternate in-network psychiatry appointment with Dr. Kwame Mensah.",
        deliveryStatus: DeliveryStatus.DELIVERED,
        sentAt: daysAgo(8),
      },
    });
    const appt = await prisma.appointment.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        providerId: drMensah.id,
        scheduledStartAt: daysAgo(2, 10),
        modality: "TELEHEALTH",
        status: AppointmentStatus.COMPLETED,
        availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
        reminderSentAt: daysAgo(3),
        reminderChannel: "SMS",
        confirmedAt: daysAgo(7),
        completedAt: daysAgo(2, 11),
      },
    });
    await prisma.completionVerification.createMany({
      data: [
        {
          tenantId,
          caseId: c.id,
          appointmentId: appt.id,
          signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
          confidence: 0.98,
          sourceSystem: "METRO_EHR_FEED",
          evidenceNote: "Provider EHR check-out confirmed completed initial psychiatry evaluation.",
          verifiedById: careManager.id,
          verifiedAt: daysAgo(2),
        },
        {
          tenantId,
          caseId: c.id,
          appointmentId: appt.id,
          signalType: VerificationSignalType.MEMBER_CONFIRMATION,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
          confidence: 0.95,
          sourceSystem: "CARELOOP_MEMBER_PORTAL",
          evidenceNote: "Member confirmed visit completion and requested 2-week follow-up cadence.",
          verifiedById: careManager.id,
          verifiedAt: daysAgo(2),
        },
        {
          tenantId,
          caseId: c.id,
          appointmentId: appt.id,
          signalType: VerificationSignalType.CLAIM_RECEIVED,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
          confidence: 0.99,
          sourceSystem: "CLAIMS_CLEARINGHOUSE",
          evidenceNote: "99204 / behavioral-health intake claim encounter adjudicated.",
          verifiedById: adminUser.id,
          verifiedAt: daysAgo(1),
        },
      ],
    });
    await prisma.caseNote.create({
      data: {
        tenantId,
        caseId: c.id,
        authorId: careManager.id,
        category: "CLOSURE",
        content: "Verified completed first psychiatry visit across provider EHR, member confirmation, and claim signal. Case closed successfully.",
      },
    });
    await seedWorkflowChain(c.id, [
      [null, CaseStatus.NEW, "High-risk psychiatry referral ingested (REF-DEMO-SUCCESS-01)", 15],
      [CaseStatus.NEW, CaseStatus.TRIAGED, "Priority score 86 (HIGH) assessed", 14],
      [CaseStatus.TRIAGED, CaseStatus.BARRIER_IDENTIFIED, "Provider access shortage barrier confirmed", 13],
      [CaseStatus.BARRIER_IDENTIFIED, CaseStatus.INTERVENTION_RECOMMENDED, "Recommended alternate in-network provider search", 12],
      [CaseStatus.INTERVENTION_RECOMMENDED, CaseStatus.INTERVENTION_IN_PROGRESS, "Care manager approved alternate psychiatry match", 11],
      [CaseStatus.INTERVENTION_IN_PROGRESS, CaseStatus.APPOINTMENT_SCHEDULED, "Booked verified telehealth slot with Dr. Kwame Mensah", 9],
      [CaseStatus.APPOINTMENT_SCHEDULED, CaseStatus.APPOINTMENT_CONFIRMED, "Member confirmed visit via SMS & portal", 7],
      [CaseStatus.APPOINTMENT_CONFIRMED, CaseStatus.APPOINTMENT_COMPLETED, "Intake appointment completed", 2],
      [CaseStatus.APPOINTMENT_COMPLETED, CaseStatus.VERIFIED, "Verified via provider + member + claims signals", 2],
      [CaseStatus.VERIFIED, CaseStatus.CLOSED, "Closed after verified care initiation", 1],
    ]);
  }

  // Scenario B: FAILED CASE
  // Referral -> high risk -> unknown barrier -> human outreach -> member unreachable -> escalation -> unresolved
  {
    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: "MEM-DEMO-02",
        firstName: "Raymond",
        lastName: "Keller",
        dobYear: 1969,
        preferredLanguage: "English",
        geography: "Rural North",
        urbanicity: "RURAL",
        coverageType: "DUAL_ELIGIBLE",
        networkName: "Horizon Medicaid",
        eligibilityStatus: "ACTIVE",
        preferredContactChannel: "PHONE",
        consentOutreach: true,
        consentSms: false,
        raceEthnicityCohort: "White / Caucasian",
        ageGroupCohort: "50-64",
        digitalAccessLevel: "LIMITED",
        transportationAccess: "NONE",
        priorNoShowCount: 2,
        historicalEngagementRate: 0.25,
      },
    });
    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: "REF-DEMO-FAILED-01",
        referralDate: daysAgo(21),
        sourceSystem: "EHR_FEED_DEMO",
        behavioralHealthNeed: "Post-ED Behavioral Care Linkage",
        specialty: "Outpatient Behavioral Health",
        urgency: "URGENT",
        geography: "Rural North",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        referringProviderName: "North General ED Care Team",
        operationalNotes: "Minimal intake details; no SMS consent; phone lines frequently unreachable.",
        status: ReferralStatus.CLOSED_UNRESOLVED,
      },
    });
    const c = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        assignedToId: careManager.id,
        status: CaseStatus.ESCALATED,
        priorityScore: 89,
        riskLevel: RiskLevel.HIGH,
        riskExplanation: "High-urgency post-ED referral aged 21 days with unknown barrier and 3 failed outreach attempts.",
        primaryBarrierCategory: BarrierCategory.UNKNOWN,
        primaryBarrierCode: "Barrier unknown",
        humanReviewRequired: true,
        escalationReason: "Member unreachable across 3 telephone attempts & certified mail; escalated for health-plan field case review.",
        createdAt: daysAgo(21),
      },
    });
    await prisma.barrier.create({
      data: {
        tenantId,
        caseId: c.id,
        category: BarrierCategory.UNKNOWN,
        subBarrier: "Barrier unknown",
        epistemicStatus: EpistemicStatus.UNKNOWN,
        confidence: 0.42,
        evidenceSignals: ["Insufficient member contact data; phone disconnected/unanswered"],
        uncertainty: "AI intentionally returned UNKNOWN rather than fabricating a specific barrier.",
        confirmedByHuman: true,
        confirmedById: careManager.id,
      },
    });
    const inv = await prisma.intervention.create({
      data: {
        tenantId,
        caseId: c.id,
        type: InterventionType.HUMAN_OUTREACH,
        reason: "Unknown barrier + high-risk post-ED member requires direct human outreach.",
        triggeringBarrierCategory: BarrierCategory.UNKNOWN,
        triggeringBarrierCode: "Barrier unknown",
        recommendedAction: "Conduct manual phone outreach + mailed outreach letter + alternate contact check.",
        executionMode: InterventionExecutionMode.HUMAN_ONLY,
        isHighRisk: true,
        confidence: 0.78,
        assignedOwnerId: careManager.id,
        status: InterventionStatus.FAILED,
        approvedAt: daysAgo(19),
      },
    });
    await prisma.interventionOutcome.create({
      data: {
        tenantId,
        interventionId: inv.id,
        outcomeStatus: "FAILED",
        summary: "Phone line disconnected; emergency contact outdated; escalated as unresolved outreach.",
        barriersResolved: false,
        followUpRequired: true,
        recordedById: careManager.id,
      },
    });
    await prisma.communication.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        interventionId: inv.id,
        channel: CommunicationChannel.PHONE,
        messageType: CommunicationMessageType.HUMAN_OUTREACH,
        readingLevel: ReadingLevel.SIMPLE,
        direction: "OUTBOUND",
        language: "English",
        draftedByAi: false,
        humanApprovedById: careManager.id,
        messageSummary: "3 coordinator outreach attempts unanswered; line out of service.",
        deliveryStatus: DeliveryStatus.NO_RESPONSE,
        sentAt: daysAgo(16),
      },
    });
    await prisma.notification.create({
      data: {
        tenantId,
        recipientUserId: careManager.id,
        caseId: c.id,
        notificationType: "HUMAN_REVIEW_ALERT",
        title: "Escalated Unresolved Referral: REF-DEMO-FAILED-01",
        message: "Member unreachable after 3 human outreach attempts; escalated for clinical supervisor review.",
        status: NotificationStatus.SENT,
        sentAt: daysAgo(5),
      },
    });
    await prisma.caseNote.create({
      data: {
        tenantId,
        caseId: c.id,
        authorId: careManager.id,
        category: "ESCALATION",
        content: "Attempted 3 calls across 10 days and mailed outreach packet. Referring PCP notified of unreachable status; escalated.",
      },
    });
    await seedWorkflowChain(c.id, [
      [null, CaseStatus.NEW, "High-risk ED follow-up referral received (REF-DEMO-FAILED-01)", 21],
      [CaseStatus.NEW, CaseStatus.TRIAGED, "Scored HIGH risk (89); flagged for unknown intake barrier", 20],
      [CaseStatus.TRIAGED, CaseStatus.BARRIER_IDENTIFIED, "AI marked Barrier unknown due to absent member response", 19],
      [CaseStatus.BARRIER_IDENTIFIED, CaseStatus.INTERVENTION_RECOMMENDED, "Assigned HUMAN_ONLY outreach", 19],
      [CaseStatus.INTERVENTION_RECOMMENDED, CaseStatus.INTERVENTION_IN_PROGRESS, "Care manager initiated manual phone calls & mail", 18],
      [CaseStatus.INTERVENTION_IN_PROGRESS, CaseStatus.ESCALATED, "Member unreachable after 3 attempts; escalated as unresolved", 5],
    ]);
  }

  // Scenario C: EQUITY CASE
  // Referral -> language barrier -> language-compatible provider -> successful appointment -> completed visit
  {
    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: "MEM-DEMO-03",
        firstName: "Hoa",
        lastName: "Phan",
        dobYear: 1974,
        preferredLanguage: "Vietnamese",
        geography: "East Valley",
        urbanicity: "SUBURBAN",
        coverageType: "MEDICAID",
        networkName: "Horizon Medicaid",
        eligibilityStatus: "ACTIVE",
        preferredContactChannel: "SMS",
        consentOutreach: true,
        consentSms: true,
        raceEthnicityCohort: "Asian / Pacific Islander",
        ageGroupCohort: "50-64",
        digitalAccessLevel: "MODERATE",
        transportationAccess: "LIMITED",
        priorNoShowCount: 0,
        historicalEngagementRate: 0.78,
      },
    });
    const consent = await prisma.consent.create({
      data: { tenantId, memberId: member.id, channel: "SMS", purpose: "CARE_OUTREACH", granted: true, source: "DEMO_SCENARIO" },
    });
    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: "REF-DEMO-EQUITY-01",
        referralDate: daysAgo(12),
        sourceSystem: "EHR_FEED_DEMO",
        behavioralHealthNeed: "Culturally Concordant Grief & Adjustment Counseling",
        specialty: "Outpatient Behavioral Health",
        urgency: "PRIORITY",
        geography: "East Valley",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "Vietnamese",
        eligibilityVerified: "VERIFIED",
        referringProviderName: "Valley Primary Care Group",
        operationalNotes: "Member paused previous referral because only English clinics were offered.",
        status: ReferralStatus.COMPLETED,
      },
    });
    const c = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        assignedToId: careManager.id,
        matchedProviderId: drPham.id,
        status: CaseStatus.VERIFIED,
        priorityScore: 76,
        riskLevel: RiskLevel.HIGH,
        riskExplanation: "Vietnamese language concordance gap caused prior referral drop-off risk.",
        primaryBarrierCategory: BarrierCategory.COMMUNICATION,
        primaryBarrierCode: "language",
        firstCompletedVisitAt: daysAgo(3),
        createdAt: daysAgo(12),
      },
    });
    await prisma.barrier.create({
      data: {
        tenantId,
        caseId: c.id,
        category: BarrierCategory.COMMUNICATION,
        subBarrier: "language",
        epistemicStatus: EpistemicStatus.FACT,
        confidence: 1.0,
        evidenceSignals: ["Preferred language: Vietnamese", "Previous English-only clinic declined"],
        uncertainty: "Confirmed linguistic mismatch barrier.",
        confirmedByHuman: true,
        confirmedById: careManager.id,
      },
    });
    const inv = await prisma.intervention.create({
      data: {
        tenantId,
        caseId: c.id,
        type: InterventionType.LANGUAGE_COMPATIBLE_PROVIDER_SEARCH,
        reason: "Prioritize bilingual Vietnamese-speaking verified provider in East Valley.",
        triggeringBarrierCategory: BarrierCategory.COMMUNICATION,
        triggeringBarrierCode: "language",
        recommendedAction: "Match with Anh Tuan Pham, LCSW (Vietnamese, verified telehealth slot).",
        executionMode: InterventionExecutionMode.HUMAN_ASSISTED,
        confidence: 0.94,
        assignedOwnerId: careManager.id,
        status: InterventionStatus.COMPLETED,
        approvedAt: daysAgo(10),
        completedAt: daysAgo(8),
      },
    });
    await prisma.interventionOutcome.create({
      data: {
        tenantId,
        interventionId: inv.id,
        outcomeStatus: "COMPLETED",
        summary: "Matched Vietnamese-speaking therapist; member scheduled same day.",
        barriersResolved: true,
        followUpRequired: false,
        recordedById: careManager.id,
      },
    });
    await prisma.communication.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        interventionId: inv.id,
        consentId: consent.id,
        channel: CommunicationChannel.SMS,
        messageType: CommunicationMessageType.PROVIDER_OPTIONS,
        readingLevel: ReadingLevel.SIMPLE,
        direction: "OUTBOUND",
        language: "Vietnamese",
        draftedByAi: true,
        humanApprovedById: careManager.id,
        messageSummary: "Sent plain-language Vietnamese provider option with verified telehealth slot.",
        deliveryStatus: DeliveryStatus.DELIVERED,
        sentAt: daysAgo(9),
      },
    });
    const appt = await prisma.appointment.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        providerId: drPham.id,
        scheduledStartAt: daysAgo(3, 14),
        modality: "TELEHEALTH",
        status: AppointmentStatus.COMPLETED,
        availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
        reminderSentAt: daysAgo(4),
        reminderChannel: "SMS",
        confirmedAt: daysAgo(6),
        completedAt: daysAgo(3, 15),
      },
    });
    await prisma.completionVerification.create({
      data: {
        tenantId,
        caseId: c.id,
        appointmentId: appt.id,
        signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
        verified: true,
        verificationStatus: VerificationStatus.VERIFIED,
        confidence: 0.96,
        sourceSystem: "VALLEY_EHR_DIRECT",
        evidenceNote: "Bilingual Vietnamese therapy visit completed successfully.",
        verifiedById: careManager.id,
        verifiedAt: daysAgo(3),
      },
    });
    await seedWorkflowChain(c.id, [
      [null, CaseStatus.NEW, "Equity showcase referral ingested (REF-DEMO-EQUITY-01)", 12],
      [CaseStatus.NEW, CaseStatus.TRIAGED, "Identified Vietnamese concordance need", 11],
      [CaseStatus.TRIAGED, CaseStatus.BARRIER_IDENTIFIED, "Confirmed language barrier", 11],
      [CaseStatus.BARRIER_IDENTIFIED, CaseStatus.INTERVENTION_IN_PROGRESS, "Matched Vietnamese-speaking clinician Anh Tuan Pham, LCSW", 10],
      [CaseStatus.INTERVENTION_IN_PROGRESS, CaseStatus.APPOINTMENT_CONFIRMED, "Member confirmed telehealth visit", 6],
      [CaseStatus.APPOINTMENT_CONFIRMED, CaseStatus.VERIFIED, "Completed visit verified", 3],
    ]);
  }

  // Scenario D: SCHEDULING CASE
  // Referral -> scheduling barrier -> assisted scheduling -> appointment -> completion
  {
    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: "MEM-DEMO-04",
        firstName: "Brianna",
        lastName: "Coleman",
        dobYear: 1992,
        preferredLanguage: "English",
        geography: "Westside",
        urbanicity: "URBAN",
        coverageType: "COMMERCIAL",
        networkName: "Pacific Commercial",
        eligibilityStatus: "ACTIVE",
        preferredContactChannel: "SMS",
        consentOutreach: true,
        consentSms: true,
        raceEthnicityCohort: "Black / African American",
        ageGroupCohort: "18-34",
        digitalAccessLevel: "HIGH",
        transportationAccess: "RELIABLE",
        priorNoShowCount: 0,
        historicalEngagementRate: 0.85,
      },
    });
    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: "REF-DEMO-SCHED-01",
        referralDate: daysAgo(10),
        sourceSystem: "EHR_FEED_DEMO",
        behavioralHealthNeed: "Workplace Stress & Generalized Anxiety Therapy",
        specialty: "Outpatient Behavioral Health",
        urgency: "ROUTINE",
        geography: "Westside",
        networkRequired: "Pacific Commercial",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        referringProviderName: "Westside Medical Group",
        operationalNotes: "Works 8am–5pm retail shifts; cannot book daytime slots or navigate phone tree.",
        status: ReferralStatus.COMPLETED,
      },
    });
    const c = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        assignedToId: careManager.id,
        matchedProviderId: drGallagher.id,
        status: CaseStatus.VERIFIED,
        priorityScore: 64,
        riskLevel: RiskLevel.MEDIUM,
        riskExplanation: "Shift-work scheduling friction caused 10-day self-scheduling delay.",
        primaryBarrierCategory: BarrierCategory.ACCESS,
        primaryBarrierCode: "work schedule",
        firstCompletedVisitAt: daysAgo(1),
        createdAt: daysAgo(10),
      },
    });
    await prisma.barrier.create({
      data: {
        tenantId,
        caseId: c.id,
        category: BarrierCategory.ACCESS,
        subBarrier: "work schedule",
        epistemicStatus: EpistemicStatus.FACT,
        confidence: 0.95,
        evidenceSignals: ["Shift schedule conflicts with 9am-4pm clinics"],
        uncertainty: "Resolved via evening telehealth option.",
        confirmedByHuman: true,
        confirmedById: careManager.id,
      },
    });
    const inv = await prisma.intervention.create({
      data: {
        tenantId,
        caseId: c.id,
        type: InterventionType.ASSISTED_SCHEDULING,
        reason: "Member needs evening telehealth slot outside shift hours.",
        triggeringBarrierCategory: BarrierCategory.ACCESS,
        triggeringBarrierCode: "work schedule",
        recommendedAction: "Coordinator warmly booked 6:00 PM verified telehealth slot with Dr. Hannah Gallagher.",
        executionMode: InterventionExecutionMode.HUMAN_ASSISTED,
        confidence: 0.89,
        assignedOwnerId: careManager.id,
        status: InterventionStatus.COMPLETED,
        approvedAt: daysAgo(8),
        completedAt: daysAgo(5),
      },
    });
    await prisma.interventionOutcome.create({
      data: {
        tenantId,
        interventionId: inv.id,
        outcomeStatus: "COMPLETED",
        summary: "Booked evening 6pm slot on member's behalf and sent confirmation.",
        barriersResolved: true,
        followUpRequired: false,
        recordedById: careManager.id,
      },
    });
    const appt = await prisma.appointment.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        providerId: drGallagher.id,
        scheduledStartAt: daysAgo(1, 18),
        modality: "TELEHEALTH",
        status: AppointmentStatus.COMPLETED,
        availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
        reminderSentAt: daysAgo(2),
        reminderChannel: "SMS",
        confirmedAt: daysAgo(4),
        completedAt: daysAgo(1, 19),
      },
    });
    await prisma.completionVerification.create({
      data: {
        tenantId,
        caseId: c.id,
        appointmentId: appt.id,
        signalType: VerificationSignalType.APPOINTMENT_COMPLETED,
        verified: true,
        verificationStatus: VerificationStatus.VERIFIED,
        confidence: 0.93,
        sourceSystem: "SCHEDULING_WEBHOOK",
        evidenceNote: "Completed evening telehealth session verified.",
        verifiedById: careManager.id,
        verifiedAt: daysAgo(1),
      },
    });
    await seedWorkflowChain(c.id, [
      [null, CaseStatus.NEW, "Scheduling showcase referral ingested (REF-DEMO-SCHED-01)", 10],
      [CaseStatus.NEW, CaseStatus.BARRIER_IDENTIFIED, "Shift-work scheduling friction identified", 9],
      [CaseStatus.BARRIER_IDENTIFIED, CaseStatus.INTERVENTION_IN_PROGRESS, "Initiated assisted evening telehealth booking", 8],
      [CaseStatus.INTERVENTION_IN_PROGRESS, CaseStatus.APPOINTMENT_SCHEDULED, "Booked 6:00 PM slot with Dr. Hannah Gallagher", 6],
      [CaseStatus.APPOINTMENT_SCHEDULED, CaseStatus.VERIFIED, "Completed evening visit verified", 1],
    ]);
  }

  // Scenario E: NO-SHOW CASE
  // Referral -> appointment -> no-show -> re-engagement -> rescheduled appointment -> completion
  {
    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: "MEM-DEMO-05",
        firstName: "Derrick",
        lastName: "Holloway",
        dobYear: 1988,
        preferredLanguage: "English",
        geography: "Central Metro",
        urbanicity: "URBAN",
        coverageType: "MEDICAID",
        networkName: "Horizon Medicaid",
        eligibilityStatus: "ACTIVE",
        preferredContactChannel: "SMS",
        consentOutreach: true,
        consentSms: true,
        raceEthnicityCohort: "Black / African American",
        ageGroupCohort: "35-49",
        digitalAccessLevel: "MODERATE",
        transportationAccess: "LIMITED",
        priorNoShowCount: 1,
        historicalEngagementRate: 0.62,
      },
    });
    const consent = await prisma.consent.create({
      data: { tenantId, memberId: member.id, channel: "SMS", purpose: "CARE_OUTREACH", granted: true, source: "DEMO_SCENARIO" },
    });
    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: "REF-DEMO-NOSHOW-01",
        referralDate: daysAgo(18),
        sourceSystem: "EHR_FEED_DEMO",
        behavioralHealthNeed: "Depression & Stress Recovery Care",
        specialty: "Outpatient Behavioral Health",
        urgency: "PRIORITY",
        geography: "Central Metro",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        referringProviderName: "Metro Community Health Clinic",
        operationalNotes: "Missed initial in-person appointment due to bus delay; re-engaged into telehealth.",
        status: ReferralStatus.COMPLETED,
      },
    });
    const c = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        assignedToId: careManager.id,
        matchedProviderId: existingProviders.drRiveraId,
        status: CaseStatus.VERIFIED,
        priorityScore: 79,
        riskLevel: RiskLevel.HIGH,
        riskExplanation: "Initial in-person appointment resulted in NO_SHOW; re-engagement restored completion.",
        primaryBarrierCategory: BarrierCategory.BEHAVIORAL,
        primaryBarrierCode: "prior missed appointments",
        firstCompletedVisitAt: daysAgo(2),
        createdAt: daysAgo(18),
      },
    });
    await prisma.barrier.create({
      data: {
        tenantId,
        caseId: c.id,
        category: BarrierCategory.BEHAVIORAL,
        subBarrier: "prior missed appointments",
        epistemicStatus: EpistemicStatus.FACT,
        confidence: 1.0,
        evidenceSignals: ["Initial scheduled appointment recorded as NO_SHOW", "Transit delay noted"],
        uncertainty: "Resolved via re-engagement + telehealth switch.",
        confirmedByHuman: true,
        confirmedById: careManager.id,
      },
    });
    const inv = await prisma.intervention.create({
      data: {
        tenantId,
        caseId: c.id,
        type: InterventionType.MISSED_APPOINTMENT_REENGAGEMENT,
        reason: "First appointment ended in NO_SHOW; immediate supportive re-engagement needed.",
        triggeringBarrierCategory: BarrierCategory.BEHAVIORAL,
        triggeringBarrierCode: "prior missed appointments",
        recommendedAction: "Send empathetic re-engagement outreach and switch rescheduled slot to TELEHEALTH.",
        executionMode: InterventionExecutionMode.HUMAN_ASSISTED,
        isHighRisk: true,
        confidence: 0.88,
        assignedOwnerId: careManager.id,
        status: InterventionStatus.COMPLETED,
        approvedAt: daysAgo(8),
        completedAt: daysAgo(5),
      },
    });
    await prisma.interventionOutcome.create({
      data: {
        tenantId,
        interventionId: inv.id,
        outcomeStatus: "COMPLETED",
        summary: "Member responded within 4 hours and rescheduled via telehealth.",
        barriersResolved: true,
        followUpRequired: false,
        recordedById: careManager.id,
      },
    });
    await prisma.communication.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        interventionId: inv.id,
        consentId: consent.id,
        channel: CommunicationChannel.SMS,
        messageType: CommunicationMessageType.RE_ENGAGEMENT,
        readingLevel: ReadingLevel.PLAIN,
        direction: "OUTBOUND",
        language: "English",
        draftedByAi: true,
        humanApprovedById: careManager.id,
        messageSummary: "Supportive no-show check-in offering easy telehealth rescheduling.",
        deliveryStatus: DeliveryStatus.DELIVERED,
        sentAt: daysAgo(8),
      },
    });
    // First missed appointment (NO_SHOW)
    await prisma.appointment.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        providerId: existingProviders.drRiveraId,
        scheduledStartAt: daysAgo(9, 9),
        modality: "IN_PERSON",
        status: AppointmentStatus.NO_SHOW,
        availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
        reminderSentAt: daysAgo(10),
        reminderChannel: "SMS",
      },
    });
    // Rescheduled & completed appointment
    const secondAppt = await prisma.appointment.create({
      data: {
        tenantId,
        caseId: c.id,
        memberId: member.id,
        providerId: existingProviders.drRiveraId,
        scheduledStartAt: daysAgo(2, 14),
        modality: "TELEHEALTH",
        status: AppointmentStatus.COMPLETED,
        availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
        reminderSentAt: daysAgo(3),
        reminderChannel: "SMS",
        confirmedAt: daysAgo(5),
        completedAt: daysAgo(2, 15),
      },
    });
    await prisma.completionVerification.createMany({
      data: [
        {
          tenantId,
          caseId: c.id,
          appointmentId: secondAppt.id,
          signalType: VerificationSignalType.MEMBER_CONFIRMATION,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
          confidence: 0.94,
          sourceSystem: "CARELOOP_MEMBER_PORTAL",
          evidenceNote: "Member reported completing rescheduled telehealth intake after earlier no-show.",
          verifiedById: careManager.id,
          verifiedAt: daysAgo(2),
        },
        {
          tenantId,
          caseId: c.id,
          appointmentId: secondAppt.id,
          signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
          verified: true,
          verificationStatus: VerificationStatus.VERIFIED,
          confidence: 0.97,
          sourceSystem: "PUENTE_EHR_DIRECT",
          evidenceNote: "Dr. Valeria Rivera confirmed completed rescheduled intake visit.",
          verifiedById: careManager.id,
          verifiedAt: daysAgo(2),
        },
      ],
    });
    await seedWorkflowChain(c.id, [
      [null, CaseStatus.NEW, "No-show recovery referral ingested (REF-DEMO-NOSHOW-01)", 18],
      [CaseStatus.NEW, CaseStatus.APPOINTMENT_SCHEDULED, "Initial in-person slot booked", 14],
      [CaseStatus.APPOINTMENT_SCHEDULED, CaseStatus.REQUIRES_HUMAN_REVIEW, "Initial appointment marked NO_SHOW; flagged for re-engagement", 9],
      [CaseStatus.REQUIRES_HUMAN_REVIEW, CaseStatus.INTERVENTION_IN_PROGRESS, "Supportive re-engagement outreach launched", 8],
      [CaseStatus.INTERVENTION_IN_PROGRESS, CaseStatus.APPOINTMENT_CONFIRMED, "Rescheduled to telehealth and confirmed by member", 5],
      [CaseStatus.APPOINTMENT_CONFIRMED, CaseStatus.VERIFIED, "Completed rescheduled visit verified", 2],
    ]);
  }

  // =========================================================================
  // 3. 45 Additional Members & 65 Additional Referrals / Cases (Total 60 Members, 80 Referrals/Cases)
  // =========================================================================

  const geographies = ["Central Metro", "East Valley", "Westside", "South Harbor", "Rural North"] as const;
  const urbanicityByGeo: Record<string, string> = {
    "Central Metro": "URBAN",
    "East Valley": "SUBURBAN",
    "Westside": "URBAN",
    "South Harbor": "URBAN",
    "Rural North": "RURAL",
  };
  const languages = ["English", "English", "Spanish", "Vietnamese", "Hindi", "Arabic", "Mandarin"] as const;
  const races = [
    "Hispanic / Latino",
    "Black / African American",
    "White / Caucasian",
    "Asian / Pacific Islander",
    "Multiracial / Other",
  ] as const;
  const coverages = ["MEDICAID", "MEDICAID", "MEDICARE", "DUAL_ELIGIBLE", "COMMERCIAL"] as const;
  const networks = [
    "Horizon Medicaid",
    "Horizon Integrated",
    "Beacon Behavioral",
    "Harbor Medicare Advantage",
    "Pacific Commercial",
  ] as const;
  const specialties = [
    "Outpatient Behavioral Health",
    "Outpatient Psychiatry",
    "Substance Use Recovery",
    "Child & Adolescent Therapy",
    "Trauma & PTSD Care",
    "Medication Management",
  ] as const;

  const createdCohortMembers: Array<{
    id: string;
    preferredLanguage: string;
    geography: string;
    networkName: string;
    consentId: string | null;
    consentSms: boolean;
  }> = [];

  for (let i = 0; i < 45; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length].trim();
    const geography = geographies[i % geographies.length];
    const urbanicity = urbanicityByGeo[geography];
    const preferredLanguage = languages[i % languages.length];
    const raceEthnicityCohort =
      preferredLanguage === "Spanish"
        ? "Hispanic / Latino"
        : preferredLanguage === "Vietnamese" || preferredLanguage === "Hindi" || preferredLanguage === "Mandarin"
          ? "Asian / Pacific Islander"
          : races[i % races.length];
    const coverageType = coverages[i % coverages.length];
    const networkName = networks[i % networks.length];
    const consentSms = i % 5 !== 0;

    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-SYN-${String(i + 1).padStart(3, "0")}`,
        firstName,
        lastName,
        dobYear: 1962 + (i % 42),
        preferredLanguage,
        geography,
        urbanicity,
        coverageType,
        networkName,
        eligibilityStatus: i % 9 === 0 ? "PENDING" : "ACTIVE",
        preferredContactChannel: consentSms ? "SMS" : "PHONE",
        consentOutreach: true,
        consentSms,
        raceEthnicityCohort,
        ageGroupCohort: i % 4 === 0 ? "18-34" : i % 4 === 1 ? "35-49" : i % 4 === 2 ? "50-64" : "65+",
        digitalAccessLevel: geography === "Rural North" ? "LIMITED" : i % 3 === 0 ? "HIGH" : "MODERATE",
        transportationAccess: geography === "Rural North" || i % 4 === 0 ? "NONE" : "RELIABLE",
        priorNoShowCount: i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0,
        historicalEngagementRate: geography === "Rural North" ? 0.45 : 0.78,
      },
    });

    const smsConsent = await prisma.consent.create({
      data: {
        tenantId,
        memberId: member.id,
        channel: CommunicationChannel.SMS,
        purpose: "CARE_OUTREACH",
        granted: consentSms,
        source: "INTAKE_SYNTHETIC",
      },
    });

    createdCohortMembers.push({
      id: member.id,
      preferredLanguage,
      geography,
      networkName,
      consentId: smsConsent.id,
      consentSms,
    });
  }

  // Create 65 referrals/cases: first 45 map 1:1 to members above, next 20 map to secondary specialty referrals
  for (let r = 0; r < 65; r++) {
    const m = createdCohortMembers[r % createdCohortMembers.length];
    const specialty = specialties[(r + 1) % specialties.length];
    const referralDaysAgo = 4 + (r % 25);

    // Choose realistic lifecycle outcomes:
    // ~24 completed visits, ~8 no-show/recovery cases, ~6 escalated, ~10 unresolved, rest active funnel
    let caseStatus: CaseStatus;
    let referralStatus: ReferralStatus = ReferralStatus.IN_CASE;
    let barrierCategory: BarrierCategory;
    let barrierCode: string;
    let interventionType: InterventionType;
    let interventionStatus: InterventionStatus = InterventionStatus.IN_PROGRESS;
    let apptStatus: AppointmentStatus | null = null;
    let addMissedAppt = false;
    let completedDaysAgo: number | null = null;
    let escalationReason: string | null = null;
    let priorityScore = 52 + ((r * 7) % 42);

    if (r % 3 === 0 || r % 11 === 0) {
      // Completed visits (~26)
      caseStatus = r % 2 === 0 ? CaseStatus.CLOSED : CaseStatus.VERIFIED;
      referralStatus = ReferralStatus.COMPLETED;
      completedDaysAgo = Math.max(1, (r % 4) + 1);
      apptStatus = AppointmentStatus.COMPLETED;
      interventionStatus = InterventionStatus.COMPLETED;
      if (m.preferredLanguage !== "English") {
        barrierCategory = BarrierCategory.COMMUNICATION;
        barrierCode = "language";
        interventionType = InterventionType.LANGUAGE_COMPATIBLE_PROVIDER_SEARCH;
      } else if (m.geography === "Rural North") {
        barrierCategory = BarrierCategory.SOCIAL_LOGISTICAL;
        barrierCode = "transportation";
        interventionType = InterventionType.TRANSPORTATION_SUPPORT;
      } else {
        barrierCategory = BarrierCategory.ACCESS;
        barrierCode = "work schedule";
        interventionType = InterventionType.ASSISTED_SCHEDULING;
      }
      if (r % 9 === 0) {
        addMissedAppt = true;
        interventionType = InterventionType.MISSED_APPOINTMENT_REENGAGEMENT;
      }
    } else if (r % 10 === 1) {
      // Escalated high-risk cases (~6)
      caseStatus = CaseStatus.ESCALATED;
      referralStatus = r % 20 === 1 ? ReferralStatus.CLOSED_UNRESOLVED : ReferralStatus.IN_CASE;
      barrierCategory = r % 20 === 1 ? BarrierCategory.UNKNOWN : BarrierCategory.ACCESS;
      barrierCode = r % 20 === 1 ? "Barrier unknown" : "provider shortage";
      interventionType = InterventionType.ESCALATION;
      interventionStatus = r % 20 === 1 ? InterventionStatus.FAILED : InterventionStatus.IN_PROGRESS;
      priorityScore = 84 + (r % 12);
      escalationReason = "High-risk aging case with repeated barrier blockage requiring supervisor intervention.";
    } else if (r % 10 === 4) {
      // Unresolved LOST_TO_FOLLOW_UP or BLOCKED (~7)
      caseStatus = r % 20 === 4 ? CaseStatus.LOST_TO_FOLLOW_UP : CaseStatus.BLOCKED;
      referralStatus = ReferralStatus.CLOSED_UNRESOLVED;
      barrierCategory = r % 20 === 4 ? BarrierCategory.COMMUNICATION : BarrierCategory.ADMINISTRATIVE;
      barrierCode = r % 20 === 4 ? "digital access" : "incomplete referral";
      interventionType =
        r % 20 === 4 ? InterventionType.HUMAN_OUTREACH : InterventionType.REFERRAL_COMPLETION_ASSISTANCE;
      interventionStatus = InterventionStatus.FAILED;
    } else if (r % 10 === 7) {
      // Active missed-appointment re-engagement in progress (~6)
      caseStatus = CaseStatus.REQUIRES_HUMAN_REVIEW;
      addMissedAppt = true;
      barrierCategory = BarrierCategory.BEHAVIORAL;
      barrierCode = "prior missed appointments";
      interventionType = InterventionType.MISSED_APPOINTMENT_REENGAGEMENT;
      interventionStatus = InterventionStatus.RECOMMENDED;
      priorityScore = 77 + (r % 10);
    } else if (r % 5 === 2) {
      caseStatus = CaseStatus.APPOINTMENT_CONFIRMED;
      referralStatus = ReferralStatus.APPOINTMENT_SCHEDULED;
      apptStatus = AppointmentStatus.CONFIRMED;
      barrierCategory = BarrierCategory.FINANCIAL;
      barrierCode = "copay concern";
      interventionType = InterventionType.BENEFIT_NETWORK_EXPLANATION;
      interventionStatus = InterventionStatus.COMPLETED;
    } else if (r % 5 === 4) {
      caseStatus = CaseStatus.APPOINTMENT_SCHEDULED;
      referralStatus = ReferralStatus.APPOINTMENT_SCHEDULED;
      apptStatus = AppointmentStatus.SCHEDULED;
      barrierCategory = BarrierCategory.ACCESS;
      barrierCode = "scheduling friction";
      interventionType = InterventionType.ASSISTED_SCHEDULING;
      interventionStatus = InterventionStatus.COMPLETED;
    } else {
      caseStatus = r % 2 === 0 ? CaseStatus.INTERVENTION_RECOMMENDED : CaseStatus.TRIAGED;
      barrierCategory = BarrierCategory.ACCESS;
      barrierCode = "provider shortage";
      interventionType = InterventionType.ALTERNATIVE_PROVIDER_SEARCH;
      interventionStatus = r % 2 === 0 ? InterventionStatus.RECOMMENDED : InterventionStatus.IN_PROGRESS;
    }

    const riskLevel =
      priorityScore >= 75 ? RiskLevel.HIGH : priorityScore >= 45 ? RiskLevel.MEDIUM : RiskLevel.LOW;
    const providerId = verifiedPool[r % verifiedPool.length] ?? allProviderPool[0];
    const extRefId = `REF-2026-S${String(r + 1).padStart(3, "0")}`;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: m.id,
        externalReferralId: extRefId,
        referralDate: daysAgo(referralDaysAgo),
        sourceSystem: "EHR_SYNTHETIC_COHORT",
        behavioralHealthNeed: `${specialty} Evaluation`,
        specialty,
        urgency: riskLevel === RiskLevel.HIGH ? "PRIORITY" : "ROUTINE",
        geography: m.geography,
        networkRequired: m.networkName,
        preferredLanguage: m.preferredLanguage,
        eligibilityVerified: m.geography === "Rural North" && r % 7 === 0 ? "PENDING" : "VERIFIED",
        referringProviderName: "Horizon Regional Primary Care",
        operationalNotes: `Synthetic population cohort case (${m.preferredLanguage}, ${m.geography}).`,
        status: referralStatus,
      },
    });

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: m.id,
        assignedToId: careManager.id,
        matchedProviderId: providerId,
        status: caseStatus,
        priorityScore,
        riskLevel,
        riskExplanation: `${barrierCode} identified in ${m.geography} (${m.preferredLanguage}) cohort.`,
        primaryBarrierCategory: barrierCategory,
        primaryBarrierCode: barrierCode,
        humanReviewRequired:
          caseStatus === CaseStatus.ESCALATED ||
          caseStatus === CaseStatus.REQUIRES_HUMAN_REVIEW ||
          caseStatus === CaseStatus.INTERVENTION_RECOMMENDED,
        escalationReason,
        firstCompletedVisitAt: completedDaysAgo ? daysAgo(completedDaysAgo) : null,
        closedAt: caseStatus === CaseStatus.CLOSED ? daysAgo(1) : null,
        createdAt: daysAgo(referralDaysAgo),
      },
    });

    await prisma.barrier.create({
      data: {
        tenantId,
        caseId: careCase.id,
        category: barrierCategory,
        subBarrier: barrierCode,
        epistemicStatus:
          barrierCategory === BarrierCategory.UNKNOWN
            ? EpistemicStatus.UNKNOWN
            : completedDaysAgo
              ? EpistemicStatus.FACT
              : EpistemicStatus.INFERENCE,
        confidence: barrierCategory === BarrierCategory.UNKNOWN ? 0.4 : 0.86,
        evidenceSignals: [`${barrierCode} detected in cohort intake (${m.geography})`],
        uncertainty: "Cohort execution trace.",
        confirmedByHuman: Boolean(completedDaysAgo),
        confirmedById: completedDaysAgo ? careManager.id : null,
      },
    });

    const inv = await prisma.intervention.create({
      data: {
        tenantId,
        caseId: careCase.id,
        type: interventionType,
        reason: `Address ${barrierCode} for ${m.preferredLanguage} member.`,
        triggeringBarrierCategory: barrierCategory,
        triggeringBarrierCode: barrierCode,
        recommendedAction: `Execute ${interventionType} within ${m.networkName}.`,
        executionMode:
          interventionType === InterventionType.HUMAN_OUTREACH ||
          interventionType === InterventionType.ESCALATION
            ? InterventionExecutionMode.HUMAN_ONLY
            : InterventionExecutionMode.HUMAN_ASSISTED,
        isHighRisk: riskLevel === RiskLevel.HIGH,
        confidence: 0.85,
        assignedOwnerId: careManager.id,
        status: interventionStatus,
        approvedAt: interventionStatus !== InterventionStatus.RECOMMENDED ? daysAgo(Math.max(2, referralDaysAgo - 2)) : null,
        completedAt: interventionStatus === InterventionStatus.COMPLETED ? daysAgo(2) : null,
      },
    });

    if (
      interventionStatus === InterventionStatus.COMPLETED ||
      interventionStatus === InterventionStatus.FAILED
    ) {
      await prisma.interventionOutcome.create({
        data: {
          tenantId,
          interventionId: inv.id,
          outcomeStatus: interventionStatus,
          summary:
            interventionStatus === InterventionStatus.COMPLETED
              ? `Barrier '${barrierCode}' resolved and next care step completed.`
              : `Intervention could not overcome '${barrierCode}'.`,
          barriersResolved: interventionStatus === InterventionStatus.COMPLETED,
          followUpRequired: interventionStatus !== InterventionStatus.COMPLETED,
          recordedById: careManager.id,
        },
      });
    }

    await prisma.workflowEvent.create({
      data: {
        tenantId,
        caseId: careCase.id,
        eventType:
          caseStatus === CaseStatus.ESCALATED
            ? WorkflowEventType.ESCALATED
            : WorkflowEventType.STATUS_TRANSITION,
        fromStatus: CaseStatus.NEW,
        toStatus: caseStatus,
        actorId: careManager.id,
        actorRole: careManager.role,
        reason: `Cohort journey transitioned to ${caseStatus}`,
      },
    });

    await prisma.communication.create({
      data: {
        tenantId,
        caseId: careCase.id,
        memberId: m.id,
        interventionId: inv.id,
        consentId: m.consentSms ? m.consentId : null,
        channel: m.consentSms ? CommunicationChannel.SMS : CommunicationChannel.PHONE,
        messageType: CommunicationMessageType.REFERRAL_NOTIFICATION,
        readingLevel: ReadingLevel.PLAIN,
        direction: "OUTBOUND",
        language: m.preferredLanguage,
        draftedByAi: true,
        humanApprovedById: careManager.id,
        messageSummary: `Outreach sent in ${m.preferredLanguage}.`,
        deliveryStatus:
          caseStatus === CaseStatus.LOST_TO_FOLLOW_UP
            ? DeliveryStatus.NO_RESPONSE
            : DeliveryStatus.DELIVERED,
        sentAt: daysAgo(Math.max(1, referralDaysAgo - 1)),
      },
    });

    if (addMissedAppt) {
      await prisma.appointment.create({
        data: {
          tenantId,
          caseId: careCase.id,
          memberId: m.id,
          providerId,
          scheduledStartAt: daysAgo(6, 9),
          modality: "IN_PERSON",
          status: AppointmentStatus.NO_SHOW,
          availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
          reminderSentAt: daysAgo(7),
          reminderChannel: "SMS",
        },
      });
    }

    if (apptStatus) {
      const appt = await prisma.appointment.create({
        data: {
          tenantId,
          caseId: careCase.id,
          memberId: m.id,
          providerId,
          scheduledStartAt: completedDaysAgo ? daysAgo(completedDaysAgo, 11) : inDays(3, 14),
          modality: "TELEHEALTH",
          status: apptStatus,
          availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
          reminderSentAt: daysAgo(2),
          reminderChannel: "SMS",
          confirmedAt:
            apptStatus === AppointmentStatus.CONFIRMED || apptStatus === AppointmentStatus.COMPLETED
              ? daysAgo(2)
              : null,
          completedAt: completedDaysAgo ? daysAgo(completedDaysAgo, 12) : null,
        },
      });

      if (completedDaysAgo) {
        await prisma.completionVerification.create({
          data: {
            tenantId,
            caseId: careCase.id,
            appointmentId: appt.id,
            signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
            verified: true,
            verificationStatus: VerificationStatus.VERIFIED,
            confidence: 0.95,
            sourceSystem: "CARELOOP_SYNTHETIC_EHR",
            evidenceNote: "Initial behavioral-health visit verified completed.",
            verifiedById: careManager.id,
            verifiedAt: daysAgo(completedDaysAgo),
          },
        });
      }
    }

    if (caseStatus === CaseStatus.ESCALATED) {
      await prisma.notification.create({
        data: {
          tenantId,
          recipientUserId: careManager.id,
          caseId: careCase.id,
          notificationType: "HUMAN_REVIEW_ALERT",
          title: `Escalated Case: ${extRefId}`,
          message: escalationReason ?? "High-risk escalation requires human action.",
          status: NotificationStatus.SENT,
          sentAt: now,
        },
      });
    }
  }

  // Superset check for Dr. Cho & Dr. Deshmukh unused refs (already persisted via seededProviders)
  void drZhou;
  void drMansoor;
  void drDeshmukh;
  void drCho;

  // Refresh EquityMetric snapshots dynamically across all seeded cases for Horizon BH
  await prisma.equityMetric.deleteMany({ where: { tenantId } });
  const allCases = await prisma.case.findMany({
    where: { tenantId },
    include: { member: true },
  });
  const totalRate =
    allCases.length > 0
      ? (allCases.filter((c) => c.firstCompletedVisitAt !== null).length / allCases.length) * 100
      : 0;

  const byLang = new Map<string, typeof allCases>();
  for (const c of allCases) {
    const lang = c.member.preferredLanguage;
    const arr = byLang.get(lang) ?? [];
    arr.push(c);
    byLang.set(lang, arr);
  }

  await prisma.equityMetric.createMany({
    data: Array.from(byLang.entries()).map(([cohortValue, list]) => {
      const completed = list.filter((c) => c.firstCompletedVisitAt !== null).length;
      const rate = list.length > 0 ? Number(((completed / list.length) * 100).toFixed(1)) : 0;
      const avgDays =
        completed > 0
          ? Number(
              (
                list
                  .filter((c) => c.firstCompletedVisitAt !== null)
                  .reduce(
                    (sum, c) =>
                      sum +
                      Math.max(
                        1,
                        (c.firstCompletedVisitAt!.getTime() - c.createdAt.getTime()) /
                          (1000 * 60 * 60 * 24)
                      ),
                    0
                  ) / completed
              ).toFixed(1)
            )
          : 0;
      return {
        tenantId,
        cohortDimension: "preferredLanguage",
        cohortValue,
        periodStart: daysAgo(30),
        periodEnd: now,
        totalReferrals: list.length,
        completedVisits: completed,
        completionRatePct: rate,
        avgTimeToCareDays: avgDays,
        disparityGapPctPoints: Number((rate - totalRate).toFixed(1)),
        topBarrierCategory: list[0]?.primaryBarrierCategory ?? BarrierCategory.ACCESS,
      };
    }),
  });
}
