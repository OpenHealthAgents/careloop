import {
  AIOperation,
  AppointmentStatus,
  AvailabilitySource,
  BarrierCategory,
  CaseStatus,
  CommunicationChannel,
  DeliveryStatus,
  InterventionStatus,
  InterventionType,
  NotificationStatus,
  PrismaClient,
  RecommendationStatus,
  ReferralStatus,
  RiskLevel,
  UserRole,
  VerificationSignalType,
  WorkflowEventType,
} from "@prisma/client";
import { getPermissionsForRole, ROLE_LABELS } from "../src/lib/auth/rbac";
import { hashPassword } from "../src/lib/auth/password";
import { seedDemoExpansion } from "./seed-demo-expansion";

export const DEMO_PASSWORD = "CareLoopDemo2026!";

export async function seedDatabase(prisma: PrismaClient) {
  const passwordHash = hashPassword(DEMO_PASSWORD);

  await prisma.tenant.deleteMany({
    where: { slug: { in: ["horizon-bh", "pacific-medicare"] } },
  });

  const tenant = await prisma.tenant.create({
    data: {
      slug: "horizon-bh",
      name: "Horizon Behavioral Health Plan",
      planType: "Medicaid Managed Care & Integrated Payer",
      settings: {
        aiProviderMode: "deterministic",
        autoTriageOnIngest: true,
        escalationRiskThreshold: 75,
        slaHoursExpedited: 24,
        slaHoursRoutine: 120,
      },
    },
  });

  const isolatedTenant = await prisma.tenant.create({
    data: {
      slug: "pacific-medicare",
      name: "Pacific Medicare Advantage",
      planType: "Medicare Advantage",
      settings: { aiProviderMode: "deterministic" },
    },
  });

  // Seed normalized Role entities
  const roleEntities = new Map<UserRole, string>();
  for (const roleCode of Object.values(UserRole)) {
    const roleMeta = ROLE_LABELS[roleCode];
    const createdRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: roleCode,
        name: roleMeta.label,
        description: roleMeta.description,
        permissions: getPermissionsForRole(roleCode),
        isSystem: true,
      },
    });
    roleEntities.set(roleCode, createdRole.id);
  }

  // Demo users for all 5 RBAC roles
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: roleEntities.get(UserRole.ADMIN),
      email: "admin@careloop.demo",
      name: "Jordan Avery (Admin)",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const careManager = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: roleEntities.get(UserRole.CARE_MANAGER),
      email: "care.manager@careloop.demo",
      name: "Maya Lin, LCSW (Care Manager)",
      passwordHash,
      role: UserRole.CARE_MANAGER,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: roleEntities.get(UserRole.HEALTH_EQUITY),
      email: "equity.analyst@careloop.demo",
      name: "Dr. Amara Okafor (Health Equity Analyst)",
      passwordHash,
      role: UserRole.HEALTH_EQUITY,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: roleEntities.get(UserRole.OPERATIONS),
      email: "ops@careloop.demo",
      name: "Carlos Mendez (Operations Coordinator)",
      passwordHash,
      role: UserRole.OPERATIONS,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: roleEntities.get(UserRole.EXECUTIVE_READ_ONLY),
      email: "exec@careloop.demo",
      name: "Claire Sterling (Executive Read-Only)",
      passwordHash,
      role: UserRole.EXECUTIVE_READ_ONLY,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: isolatedTenant.id,
      email: "admin@pacific.demo",
      name: "Pacific Admin",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const now = new Date();
  const inDays = (days: number, hour = 10) => {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const drRivera = await prisma.provider.create({
    data: {
      tenantId: tenant.id,
      npi: "1122334455",
      name: "Dr. Valeria Rivera, PsyD",
      organizationName: "Puente Community Behavioral Health",
      specialty: "Outpatient Behavioral Health",
      networkNames: ["Horizon Medicaid", "Horizon Integrated"],
      languages: ["English", "Spanish"],
      geography: "Central Metro",
      county: "Metro County",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
      nextVerifiedSlotAt: inDays(3, 10),
      availabilityLastVerifiedAt: daysAgo(0),
      notes: "Direct EHR scheduling feed active; bilingual English/Spanish team.",
    },
  });

  const slotRivera1 = await prisma.providerAvailability.create({
    data: {
      tenantId: tenant.id,
      providerId: drRivera.id,
      slotStartAt: inDays(3, 10),
      slotEndAt: inDays(3, 11),
      modality: "TELEHEALTH",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
      status: "AVAILABLE",
      verifiedAt: now,
    },
  });

  await prisma.providerAvailability.create({
    data: {
      tenantId: tenant.id,
      providerId: drRivera.id,
      slotStartAt: inDays(4, 14),
      slotEndAt: inDays(4, 15),
      modality: "IN_PERSON",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
      status: "AVAILABLE",
      verifiedAt: now,
    },
  });

  const drKulkarni = await prisma.provider.create({
    data: {
      tenantId: tenant.id,
      npi: "2233445566",
      name: "Dr. Rohan Kulkarni, MD",
      organizationName: "Harbor Psychiatric Associates",
      specialty: "Outpatient Psychiatry",
      networkNames: ["Horizon Medicaid", "Horizon Integrated"],
      languages: ["English", "Hindi"],
      geography: "Central Metro",
      county: "Metro County",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
      nextVerifiedSlotAt: inDays(5, 11),
      availabilityLastVerifiedAt: daysAgo(1),
      notes: "Verified telehealth intake slots available within 5 days.",
    },
  });

  await prisma.providerAvailability.create({
    data: {
      tenantId: tenant.id,
      providerId: drKulkarni.id,
      slotStartAt: inDays(5, 11),
      slotEndAt: inDays(5, 12),
      modality: "TELEHEALTH",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
      status: "AVAILABLE",
      verifiedAt: now,
    },
  });

  const drNguyen = await prisma.provider.create({
    data: {
      tenantId: tenant.id,
      npi: "3344556677",
      name: "Linh Nguyen, LMFT",
      organizationName: "Valley Counseling Collective",
      specialty: "Outpatient Behavioral Health",
      networkNames: ["Horizon Medicaid"],
      languages: ["English", "Vietnamese", "Spanish"],
      geography: "East Valley",
      county: "Valley County",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: AvailabilitySource.DIRECTORY_INFORMATION,
      directoryWaitDays: 18,
      availabilityLastVerifiedAt: daysAgo(21),
      notes: "Directory data last refreshed 21 days ago; clinic confirmation required before booking.",
    },
  });

  const drThornton = await prisma.provider.create({
    data: {
      tenantId: tenant.id,
      npi: "4455667788",
      name: "Dr. Samuel Thornton, PhD",
      organizationName: "North Ridge Behavioral Clinic",
      specialty: "Outpatient Behavioral Health",
      networkNames: ["Horizon Integrated"],
      languages: ["English"],
      geography: "Rural North",
      county: "North County",
      telehealthAvailable: false,
      acceptingNewPatients: false,
      availabilitySource: AvailabilitySource.NOT_AVAILABLE,
      directoryWaitDays: 45,
      availabilityLastVerifiedAt: daysAgo(35),
      notes: "Waitlist paused per latest directory update.",
    },
  });

  const drAlvarez = await prisma.provider.create({
    data: {
      tenantId: tenant.id,
      npi: "5566778899",
      name: "Mateo Alvarez, LCSW",
      organizationName: "Metro Telehealth Behavioral Group",
      specialty: "Substance Use Recovery",
      networkNames: ["Horizon Medicaid", "Horizon Integrated"],
      languages: ["English", "Spanish"],
      geography: "Central Metro",
      county: "Metro County",
      telehealthAvailable: true,
      acceptingNewPatients: true,
      availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
      nextVerifiedSlotAt: inDays(2, 15),
      availabilityLastVerifiedAt: now,
    },
  });

  await prisma.providerAvailability.create({
    data: {
      tenantId: tenant.id,
      providerId: drAlvarez.id,
      slotStartAt: inDays(2, 15),
      slotEndAt: inDays(2, 16),
      modality: "TELEHEALTH",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
      status: "AVAILABLE",
      verifiedAt: now,
    },
  });

  async function createSeedJourney(opts: {
    externalMemberId: string;
    firstName: string;
    lastName: string;
    dobYear: number;
    preferredLanguage: string;
    geography: string;
    urbanicity: string;
    coverageType: string;
    raceEthnicityCohort: string;
    ageGroupCohort: string;
    digitalAccessLevel: string;
    transportationAccess: string;
    priorNoShowCount: number;
    consentSms: boolean;
    externalReferralId: string;
    referralDaysAgo: number;
    behavioralHealthNeed: string;
    specialty: string;
    urgency: string;
    eligibilityVerified: string;
    operationalNotes: string;
    caseStatus: CaseStatus;
    priorityScore: number;
    riskLevel: RiskLevel;
    riskExplanation: string;
    primaryBarrierCategory: BarrierCategory;
    primaryBarrierCode: string;
    matchedProviderId?: string;
    humanReviewRequired?: boolean;
    escalationReason?: string;
    firstCompletedVisitDaysAgo?: number;
    confirmedBarrier?: boolean;
    intervention?: {
      type: InterventionType;
      status: InterventionStatus;
      reason: string;
      action: string;
      outcome?: string;
    };
    appointment?: {
      providerId: string;
      status: AppointmentStatus;
      scheduledDaysOffset: number;
      modality: string;
      source: AvailabilitySource;
    };
    verifications?: Array<{
      signalType: VerificationSignalType;
      sourceSystem: string;
      evidenceNote: string;
    }>;
  }) {
    const member = await prisma.member.create({
      data: {
        tenantId: tenant.id,
        externalMemberId: opts.externalMemberId,
        firstName: opts.firstName,
        lastName: opts.lastName,
        dobYear: opts.dobYear,
        preferredLanguage: opts.preferredLanguage,
        geography: opts.geography,
        urbanicity: opts.urbanicity,
        coverageType: opts.coverageType,
        eligibilityStatus: opts.eligibilityVerified === "VERIFIED" ? "ACTIVE" : "PENDING",
        networkName: "Horizon Medicaid",
        preferredContactChannel: opts.consentSms ? "SMS" : "PHONE",
        consentOutreach: true,
        consentSms: opts.consentSms,
        raceEthnicityCohort: opts.raceEthnicityCohort,
        ageGroupCohort: opts.ageGroupCohort,
        digitalAccessLevel: opts.digitalAccessLevel,
        transportationAccess: opts.transportationAccess,
        priorNoShowCount: opts.priorNoShowCount,
        historicalEngagementRate: opts.priorNoShowCount > 1 ? 0.35 : 0.8,
      },
    });

    const smsConsent = await prisma.consent.create({
      data: {
        tenantId: tenant.id,
        memberId: member.id,
        channel: CommunicationChannel.SMS,
        purpose: "CARE_OUTREACH",
        granted: opts.consentSms,
        source: "INTAKE_SYNTHETIC",
      },
    });

    await prisma.consent.create({
      data: {
        tenantId: tenant.id,
        memberId: member.id,
        channel: CommunicationChannel.PHONE,
        purpose: "CARE_OUTREACH",
        granted: true,
        source: "INTAKE_SYNTHETIC",
      },
    });

    const referral = await prisma.referral.create({
      data: {
        tenantId: tenant.id,
        memberId: member.id,
        externalReferralId: opts.externalReferralId,
        referralDate: daysAgo(opts.referralDaysAgo),
        sourceSystem: "EHR_FEED_SYNTHETIC",
        behavioralHealthNeed: opts.behavioralHealthNeed,
        specialty: opts.specialty,
        urgency: opts.urgency,
        geography: opts.geography,
        networkRequired: "Horizon Medicaid",
        preferredLanguage: opts.preferredLanguage,
        eligibilityVerified: opts.eligibilityVerified,
        referringProviderName: "Dr. Morgan Primary Care",
        operationalNotes: opts.operationalNotes,
        status:
          opts.firstCompletedVisitDaysAgo !== undefined
            ? ReferralStatus.COMPLETED
            : opts.caseStatus === CaseStatus.LOST_TO_FOLLOW_UP
              ? ReferralStatus.CLOSED_UNRESOLVED
              : ReferralStatus.IN_CASE,
      },
    });

    const careCase = await prisma.case.create({
      data: {
        tenantId: tenant.id,
        referralId: referral.id,
        memberId: member.id,
        assignedToId: careManager.id,
        matchedProviderId: opts.matchedProviderId ?? null,
        status: opts.caseStatus,
        priorityScore: opts.priorityScore,
        riskLevel: opts.riskLevel,
        riskExplanation: opts.riskExplanation,
        primaryBarrierCategory: opts.primaryBarrierCategory,
        primaryBarrierCode: opts.primaryBarrierCode,
        humanReviewRequired: opts.humanReviewRequired ?? false,
        escalationReason: opts.escalationReason ?? null,
        firstCompletedVisitAt:
          opts.firstCompletedVisitDaysAgo !== undefined
            ? daysAgo(opts.firstCompletedVisitDaysAgo)
            : null,
        closedAt: opts.caseStatus === CaseStatus.CLOSED ? daysAgo(1) : null,
        slaDueAt: inDays(3),
      },
    });

    await prisma.riskAssessment.create({
      data: {
        tenantId: tenant.id,
        caseId: careCase.id,
        referralId: referral.id,
        riskLevel: opts.riskLevel,
        score: opts.priorityScore,
        confidence: 0.85,
        uncertainty: "Operational drop-off estimate based on structured intake signals.",
        explanation: opts.riskExplanation,
        humanEscalationSuggested: opts.priorityScore >= 75,
        evidenceSignals: [opts.riskExplanation],
        providerName: "CareLoop-Deterministic-Engine",
        modelVersion: "careloop-rules-v1",
      },
    });

    await prisma.workflowEvent.create({
      data: {
        tenantId: tenant.id,
        caseId: careCase.id,
        eventType:
          opts.caseStatus === CaseStatus.ESCALATED
            ? WorkflowEventType.ESCALATED
            : WorkflowEventType.STATUS_TRANSITION,
        fromStatus: null,
        toStatus: opts.caseStatus,
        actorId: careManager.id,
        actorRole: careManager.role,
        reason: `Initial seeded state: ${opts.caseStatus}`,
      },
    });

    await prisma.barrier.create({
      data: {
        tenantId: tenant.id,
        caseId: careCase.id,
        category: opts.primaryBarrierCategory,
        subBarrier: opts.primaryBarrierCode,
        epistemicStatus: opts.confirmedBarrier ? "FACT" : "INFERENCE",
        confidence: opts.confirmedBarrier ? 1.0 : 0.84,
        evidenceSignals: [opts.riskExplanation],
        uncertainty: opts.confirmedBarrier
          ? "Verified directly during member intake."
          : "Inferred from intake records; confirm during outreach.",
        confirmedByHuman: opts.confirmedBarrier ?? false,
        confirmedById: opts.confirmedBarrier ? careManager.id : null,
      },
    });

    const aiRec = await prisma.aIRecommendation.create({
      data: {
        tenantId: tenant.id,
        caseId: careCase.id,
        referralId: referral.id,
        operation: AIOperation.RECOMMEND_INTERVENTION,
        status:
          opts.intervention?.status === "RECOMMENDED"
            ? RecommendationStatus.PENDING
            : RecommendationStatus.APPROVED,
        providerName: "CareLoop-Deterministic-Engine",
        modelVersion: "careloop-rules-v1",
        facts: [
          `Referral ${opts.externalReferralId} for ${opts.specialty}; preferred language ${opts.preferredLanguage}.`,
          `Eligibility verification status: ${opts.eligibilityVerified}.`,
        ],
        inferences: [
          {
            statement: `Operational risk ${opts.riskLevel} (${opts.priorityScore}/100) driven by ${opts.primaryBarrierCode}.`,
            confidence: 0.84,
            uncertainty: "Confirm barrier with member during coordinator outreach.",
            supportingSignals: [opts.riskExplanation],
          },
        ],
        recommendations: [
          {
            action:
              opts.intervention?.action ?? "Assign to care coordinator for barrier verification.",
            rationale: opts.intervention?.reason ?? opts.riskExplanation,
            confidence: 0.85,
            requiresHumanReview: true,
          },
        ],
        confidence: 0.84,
        uncertainty: "Recommendation awaits or reflects human coordinator review.",
        evidenceSignals: [opts.riskExplanation],
        humanReviewerId: opts.intervention?.status === "RECOMMENDED" ? null : careManager.id,
        reviewedAt: opts.intervention?.status === "RECOMMENDED" ? null : daysAgo(2),
      },
    });

    if (opts.intervention) {
      const inv = await prisma.intervention.create({
        data: {
          tenantId: tenant.id,
          caseId: careCase.id,
          type: opts.intervention.type,
          reason: opts.intervention.reason,
          triggeringBarrierCategory: opts.primaryBarrierCategory,
          triggeringBarrierCode: opts.primaryBarrierCode,
          recommendedAction: opts.intervention.action,
          automationEligible: false,
          assignedOwnerId: careManager.id,
          status: opts.intervention.status,
          epistemicOrigin: "AI_RECOMMENDATION",
          aiRecommendationId: aiRec.id,
        },
      });

      if (opts.intervention.outcome) {
        await prisma.interventionOutcome.create({
          data: {
            tenantId: tenant.id,
            interventionId: inv.id,
            outcomeStatus: opts.intervention.status,
            summary: opts.intervention.outcome,
            barriersResolved: opts.intervention.status === "COMPLETED",
            followUpRequired: opts.intervention.status !== "COMPLETED",
            recordedById: careManager.id,
          },
        });
      }

      await prisma.communication.create({
        data: {
          tenantId: tenant.id,
          caseId: careCase.id,
          memberId: member.id,
          interventionId: inv.id,
          consentId: smsConsent.id,
          aiRecommendationId: aiRec.id,
          channel: opts.consentSms ? CommunicationChannel.SMS : CommunicationChannel.PHONE,
          direction: "OUTBOUND",
          language: opts.preferredLanguage,
          draftedByAi: true,
          humanApprovedById: careManager.id,
          messageSummary: `Initial care coordination outreach (${opts.preferredLanguage})`,
          deliveryStatus:
            opts.caseStatus === CaseStatus.LOST_TO_FOLLOW_UP
              ? DeliveryStatus.NO_RESPONSE
              : DeliveryStatus.DELIVERED,
          sentAt: daysAgo(Math.max(1, opts.referralDaysAgo - 1)),
        },
      });
    }

    let apptId: string | undefined;
    if (opts.appointment) {
      const appt = await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          caseId: careCase.id,
          memberId: member.id,
          providerId: opts.appointment.providerId,
          scheduledStartAt: inDays(opts.appointment.scheduledDaysOffset, 10),
          modality: opts.appointment.modality,
          status: opts.appointment.status,
          availabilitySourceAtBooking: opts.appointment.source,
          confirmedAt:
            opts.appointment.status === "CONFIRMED" || opts.appointment.status === "COMPLETED"
              ? daysAgo(1)
              : null,
          completedAt: opts.appointment.status === "COMPLETED" ? daysAgo(1) : null,
        },
      });
      apptId = appt.id;
    }

    if (opts.verifications) {
      for (const v of opts.verifications) {
        await prisma.completionVerification.create({
          data: {
            tenantId: tenant.id,
            caseId: careCase.id,
            appointmentId: apptId ?? null,
            signalType: v.signalType,
            verified: true,
            sourceSystem: v.sourceSystem,
            evidenceNote: v.evidenceNote,
            verifiedById: careManager.id,
          },
        });
      }
    }

    if (opts.caseStatus === CaseStatus.ESCALATED || opts.caseStatus === CaseStatus.REQUIRES_HUMAN_REVIEW) {
      await prisma.notification.create({
        data: {
          tenantId: tenant.id,
          recipientUserId: careManager.id,
          caseId: careCase.id,
          notificationType: "HUMAN_REVIEW_ALERT",
          title: `Action Needed: ${opts.externalReferralId}`,
          message: opts.escalationReason ?? opts.riskExplanation,
          status: NotificationStatus.SENT,
          sentAt: now,
        },
      });
    }

    return { careCase, member, referral };
  }

  // 1. Hero interactive demo case
  await createSeedJourney({
    externalMemberId: "MEM-9001",
    firstName: "Elena",
    lastName: "Navarro",
    dobYear: 1984,
    preferredLanguage: "Spanish",
    geography: "Central Metro",
    urbanicity: "URBAN",
    coverageType: "MEDICAID",
    raceEthnicityCohort: "Hispanic / Latino",
    ageGroupCohort: "35-49",
    digitalAccessLevel: "LIMITED",
    transportationAccess: "NONE",
    priorNoShowCount: 1,
    consentSms: true,
    externalReferralId: "REF-2026-1001",
    referralDaysAgo: 9,
    behavioralHealthNeed: "Depression & Adjustment Support (Outpatient)",
    specialty: "Outpatient Behavioral Health",
    urgency: "PRIORITY",
    eligibilityVerified: "VERIFIED",
    operationalNotes:
      "Prefers Spanish-speaking provider; no reliable bus route to north clinics; open to telehealth if assisted.",
    caseStatus: CaseStatus.INTERVENTION_RECOMMENDED,
    priorityScore: 96,
    riskLevel: RiskLevel.HIGH,
    riskExplanation:
      "Referral aging (9 days), Spanish language preference, no transportation, 1 prior missed visit.",
    primaryBarrierCategory: BarrierCategory.COMMUNICATION,
    primaryBarrierCode: "language",
    matchedProviderId: drRivera.id,
    humanReviewRequired: true,
    confirmedBarrier: false,
    intervention: {
      type: InterventionType.LANGUAGE_COMPATIBLE_PROVIDER_SEARCH,
      status: InterventionStatus.RECOMMENDED,
      reason:
        "Member prefers Spanish and lacks transportation; Dr. Valeria Rivera has verified Spanish telehealth slots.",
      action: `Approve Spanish-concordant telehealth match with Dr. Valeria Rivera (verified slot ${slotRivera1.slotStartAt.toISOString().slice(0, 10)}) and send Spanish outreach.`,
    },
  });

  // 2. Completed & Verified journey
  await createSeedJourney({
    externalMemberId: "MEM-9002",
    firstName: "Marcus",
    lastName: "Bennett",
    dobYear: 1978,
    preferredLanguage: "English",
    geography: "Central Metro",
    urbanicity: "URBAN",
    coverageType: "MEDICAID",
    raceEthnicityCohort: "Black / African American",
    ageGroupCohort: "35-49",
    digitalAccessLevel: "HIGH",
    transportationAccess: "NONE",
    priorNoShowCount: 0,
    consentSms: true,
    externalReferralId: "REF-2026-1002",
    referralDaysAgo: 16,
    behavioralHealthNeed: "Anxiety Management",
    specialty: "Outpatient Behavioral Health",
    urgency: "ROUTINE",
    eligibilityVerified: "VERIFIED",
    operationalNotes: "No car; requested telehealth or ride voucher.",
    caseStatus: CaseStatus.CLOSED,
    priorityScore: 68,
    riskLevel: RiskLevel.MEDIUM,
    riskExplanation: "Transportation barrier resolved via telehealth conversion.",
    primaryBarrierCategory: BarrierCategory.SOCIAL_LOGISTICAL,
    primaryBarrierCode: "transportation",
    matchedProviderId: drRivera.id,
    confirmedBarrier: true,
    firstCompletedVisitDaysAgo: 4,
    intervention: {
      type: InterventionType.TRANSPORTATION_SUPPORT,
      status: InterventionStatus.COMPLETED,
      reason: "Member lacked transit to clinic.",
      action: "Converted visit to verified telehealth modality and sent onboarding checklist.",
      outcome: "Member attended initial telehealth behavioral-health visit.",
    },
    appointment: {
      providerId: drRivera.id,
      status: AppointmentStatus.COMPLETED,
      scheduledDaysOffset: -4,
      modality: "TELEHEALTH",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
    },
    verifications: [
      {
        signalType: VerificationSignalType.APPOINTMENT_COMPLETED,
        sourceSystem: "EHR_APPOINTMENT_FEED",
        evidenceNote: "Completed initial 50-minute outpatient visit.",
      },
      {
        signalType: VerificationSignalType.CLAIM_RECEIVED,
        sourceSystem: "X12_837_CLAIMS",
        evidenceNote: "Paid outpatient behavioral health claim matched to referral.",
      },
    ],
  });

  // 3. Completed & Verified journey (Admin barrier)
  await createSeedJourney({
    externalMemberId: "MEM-9003",
    firstName: "Sofia",
    lastName: "Morales",
    dobYear: 1991,
    preferredLanguage: "Spanish",
    geography: "Central Metro",
    urbanicity: "SUBURBAN",
    coverageType: "MEDICAID",
    raceEthnicityCohort: "Hispanic / Latino",
    ageGroupCohort: "25-34",
    digitalAccessLevel: "HIGH",
    transportationAccess: "RELIABLE",
    priorNoShowCount: 0,
    consentSms: true,
    externalReferralId: "REF-2026-1003",
    referralDaysAgo: 14,
    behavioralHealthNeed: "Postpartum Behavioral Support",
    specialty: "Outpatient Behavioral Health",
    urgency: "PRIORITY",
    eligibilityVerified: "VERIFIED",
    operationalNotes: "Initial referral lacked prior auth confirmation.",
    caseStatus: CaseStatus.VERIFIED,
    priorityScore: 62,
    riskLevel: RiskLevel.MEDIUM,
    riskExplanation: "Administrative prior authorization resolved by Care Coordinator.",
    primaryBarrierCategory: BarrierCategory.ADMINISTRATIVE,
    primaryBarrierCode: "authorization requirement",
    matchedProviderId: drRivera.id,
    confirmedBarrier: true,
    firstCompletedVisitDaysAgo: 2,
    intervention: {
      type: InterventionType.REFERRAL_COMPLETION_ASSISTANCE,
      status: InterventionStatus.COMPLETED,
      reason: "Prior authorization confirmation was missing from referring clinic.",
      action: "Obtained authorization number and booked verified slot.",
      outcome: "Visit completed and confirmed by provider office.",
    },
    appointment: {
      providerId: drRivera.id,
      status: AppointmentStatus.COMPLETED,
      scheduledDaysOffset: -2,
      modality: "IN_PERSON",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
    },
    verifications: [
      {
        signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
        sourceSystem: "CLINIC_PORTAL",
        evidenceNote: "Clinic confirmed first visit completed.",
      },
    ],
  });

  // 4. Completed & Verified journey (Financial barrier)
  await createSeedJourney({
    externalMemberId: "MEM-9004",
    firstName: "David",
    lastName: "Chen",
    dobYear: 1962,
    preferredLanguage: "English",
    geography: "East Valley",
    urbanicity: "SUBURBAN",
    coverageType: "MEDICARE_ADVANTAGE",
    raceEthnicityCohort: "Asian",
    ageGroupCohort: "50-64",
    digitalAccessLevel: "HIGH",
    transportationAccess: "RELIABLE",
    priorNoShowCount: 0,
    consentSms: false,
    externalReferralId: "REF-2026-1004",
    referralDaysAgo: 12,
    behavioralHealthNeed: "Psychiatry Consultation Referral",
    specialty: "Outpatient Psychiatry",
    urgency: "ROUTINE",
    eligibilityVerified: "VERIFIED",
    operationalNotes: "Member worried about specialist copay amount.",
    caseStatus: CaseStatus.CLOSED,
    priorityScore: 48,
    riskLevel: RiskLevel.MEDIUM,
    riskExplanation: "Copay concern resolved via benefit verification call.",
    primaryBarrierCategory: BarrierCategory.FINANCIAL,
    primaryBarrierCode: "copay concern",
    matchedProviderId: drKulkarni.id,
    confirmedBarrier: true,
    firstCompletedVisitDaysAgo: 1,
    intervention: {
      type: InterventionType.BENEFIT_NETWORK_EXPLANATION,
      status: InterventionStatus.COMPLETED,
      reason: "Member unsure whether $0 behavioral health outpatient copay applied.",
      action: "Reviewed Medicare Advantage benefit tier and confirmed $0 copay in-network.",
      outcome: "Member confirmed visit completion.",
    },
    appointment: {
      providerId: drKulkarni.id,
      status: AppointmentStatus.COMPLETED,
      scheduledDaysOffset: -1,
      modality: "TELEHEALTH",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
    },
    verifications: [
      {
        signalType: VerificationSignalType.MEMBER_CONFIRMATION,
        sourceSystem: "POST_VISIT_OUTREACH",
        evidenceNote: "Member confirmed attending telehealth visit with Dr. Kulkarni.",
      },
    ],
  });

  // 5. Escalated High-Risk Case
  await createSeedJourney({
    externalMemberId: "MEM-9005",
    firstName: "Keisha",
    lastName: "Brooks",
    dobYear: 1989,
    preferredLanguage: "English",
    geography: "Central Metro",
    urbanicity: "URBAN",
    coverageType: "MEDICAID",
    raceEthnicityCohort: "Black / African American",
    ageGroupCohort: "35-49",
    digitalAccessLevel: "LIMITED",
    transportationAccess: "LIMITED",
    priorNoShowCount: 3,
    consentSms: true,
    externalReferralId: "REF-2026-1005",
    referralDaysAgo: 19,
    behavioralHealthNeed: "Trauma-Informed Outpatient Therapy",
    specialty: "Outpatient Behavioral Health",
    urgency: "EXPEDITED",
    eligibilityVerified: "VERIFIED",
    operationalNotes: "3 prior missed appointments; shift-work schedule conflicts.",
    caseStatus: CaseStatus.ESCALATED,
    priorityScore: 91,
    riskLevel: RiskLevel.HIGH,
    riskExplanation: "3 prior missed appointments, 19-day aging, expedited referral, limited transit.",
    primaryBarrierCategory: BarrierCategory.BEHAVIORAL,
    primaryBarrierCode: "prior missed appointments",
    matchedProviderId: drRivera.id,
    humanReviewRequired: true,
    escalationReason:
      "Repeated missed appointments require senior Care Manager outreach for warm handoff.",
    confirmedBarrier: true,
    intervention: {
      type: InterventionType.MISSED_APPOINTMENT_REENGAGEMENT,
      status: InterventionStatus.IN_PROGRESS,
      reason: "Prior missed appointments linked to shift schedule changes.",
      action: "Senior Care Manager conducting warm phone outreach to offer evening telehealth slot.",
    },
    appointment: {
      providerId: drRivera.id,
      status: AppointmentStatus.NO_SHOW,
      scheduledDaysOffset: -3,
      modality: "IN_PERSON",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
    },
  });

  // 6. Unknown Barrier Case
  await createSeedJourney({
    externalMemberId: "MEM-9006",
    firstName: "Thomas",
    lastName: "Alvarez",
    dobYear: 1995,
    preferredLanguage: "English",
    geography: "East Valley",
    urbanicity: "SUBURBAN",
    coverageType: "COMMERCIAL",
    raceEthnicityCohort: "White",
    ageGroupCohort: "25-34",
    digitalAccessLevel: "HIGH",
    transportationAccess: "RELIABLE",
    priorNoShowCount: 0,
    consentSms: false,
    externalReferralId: "REF-2026-1006",
    referralDaysAgo: 6,
    behavioralHealthNeed: "Stress & Burnout Counseling",
    specialty: "Outpatient Behavioral Health",
    urgency: "ROUTINE",
    eligibilityVerified: "VERIFIED",
    operationalNotes: "Referral received without barrier notes.",
    caseStatus: CaseStatus.REQUIRES_HUMAN_REVIEW,
    priorityScore: 34,
    riskLevel: RiskLevel.LOW,
    riskExplanation: "Insufficient evidence to classify a barrier; human discovery outreach needed.",
    primaryBarrierCategory: BarrierCategory.UNKNOWN,
    primaryBarrierCode: "Barrier unknown",
    humanReviewRequired: true,
    confirmedBarrier: false,
    intervention: {
      type: InterventionType.HUMAN_OUTREACH,
      status: InterventionStatus.RECOMMENDED,
      reason: "Structured data shows no clear blocker; do not fabricate a barrier.",
      action: "Call member to clarify preferred appointment modality and scheduling window.",
    },
  });

  // 7. Rural Access / Long Wait Time
  await createSeedJourney({
    externalMemberId: "MEM-9007",
    firstName: "Hannah",
    lastName: "Lindqvist",
    dobYear: 1974,
    preferredLanguage: "English",
    geography: "Rural North",
    urbanicity: "RURAL",
    coverageType: "MEDICAID",
    raceEthnicityCohort: "White",
    ageGroupCohort: "50-64",
    digitalAccessLevel: "LIMITED",
    transportationAccess: "LIMITED",
    priorNoShowCount: 0,
    consentSms: true,
    externalReferralId: "REF-2026-1007",
    referralDaysAgo: 15,
    behavioralHealthNeed: "Outpatient Behavioral Health",
    specialty: "Outpatient Behavioral Health",
    urgency: "PRIORITY",
    eligibilityVerified: "VERIFIED",
    operationalNotes: "Nearest rural clinic waitlist closed (45+ days).",
    caseStatus: CaseStatus.INTERVENTION_IN_PROGRESS,
    priorityScore: 76,
    riskLevel: RiskLevel.HIGH,
    riskExplanation: "Rural provider shortage; local clinic Dr. Thornton unavailable.",
    primaryBarrierCategory: BarrierCategory.ACCESS,
    primaryBarrierCode: "provider shortage",
    matchedProviderId: drThornton.id,
    confirmedBarrier: true,
    intervention: {
      type: InterventionType.ALTERNATIVE_PROVIDER_SEARCH,
      status: InterventionStatus.IN_PROGRESS,
      reason: "Local rural provider not accepting new patients.",
      action: "Match to out-of-county telehealth provider Dr. Valeria Rivera with verified slot.",
    },
  });

  // 8. Appointment Confirmed
  await createSeedJourney({
    externalMemberId: "MEM-9008",
    firstName: "Jamal",
    lastName: "Washington",
    dobYear: 1981,
    preferredLanguage: "English",
    geography: "Central Metro",
    urbanicity: "URBAN",
    coverageType: "MEDICAID",
    raceEthnicityCohort: "Black / African American",
    ageGroupCohort: "35-49",
    digitalAccessLevel: "HIGH",
    transportationAccess: "RELIABLE",
    priorNoShowCount: 1,
    consentSms: true,
    externalReferralId: "REF-2026-1008",
    referralDaysAgo: 7,
    behavioralHealthNeed: "Substance Use Recovery Support",
    specialty: "Substance Use Recovery",
    urgency: "PRIORITY",
    eligibilityVerified: "VERIFIED",
    operationalNotes: "Requested evening telehealth appointment.",
    caseStatus: CaseStatus.APPOINTMENT_CONFIRMED,
    priorityScore: 54,
    riskLevel: RiskLevel.MEDIUM,
    riskExplanation: "1 prior missed visit; reminder confirmed for upcoming telehealth slot.",
    primaryBarrierCategory: BarrierCategory.SOCIAL_LOGISTICAL,
    primaryBarrierCode: "work schedule",
    matchedProviderId: drAlvarez.id,
    confirmedBarrier: true,
    intervention: {
      type: InterventionType.ASSISTED_SCHEDULING,
      status: InterventionStatus.COMPLETED,
      reason: "Work shift conflicts required late-afternoon telehealth slot.",
      action: "Booked verified 3pm telehealth slot with Mateo Alvarez, LCSW.",
      outcome: "Member confirmed appointment via SMS reminder.",
    },
    appointment: {
      providerId: drAlvarez.id,
      status: AppointmentStatus.CONFIRMED,
      scheduledDaysOffset: 2,
      modality: "TELEHEALTH",
      source: AvailabilitySource.VERIFIED_AVAILABILITY,
    },
    verifications: [
      {
        signalType: VerificationSignalType.APPOINTMENT_SCHEDULED,
        sourceSystem: "CARELOOP_SCHEDULING",
        evidenceNote: "Booked against verified slot.",
      },
      {
        signalType: VerificationSignalType.APPOINTMENT_CONFIRMED,
        sourceSystem: "SMS_REMINDER_REPLY",
        evidenceNote: "Member replied YES to confirm attendance.",
      },
    ],
  });

  // 9. Blocked Administrative Case
  await createSeedJourney({
    externalMemberId: "MEM-9009",
    firstName: "Priya",
    lastName: "Patel",
    dobYear: 1993,
    preferredLanguage: "English",
    geography: "East Valley",
    urbanicity: "SUBURBAN",
    coverageType: "MEDICAID",
    raceEthnicityCohort: "Asian",
    ageGroupCohort: "25-34",
    digitalAccessLevel: "HIGH",
    transportationAccess: "RELIABLE",
    priorNoShowCount: 0,
    consentSms: true,
    externalReferralId: "REF-2026-1009",
    referralDaysAgo: 11,
    behavioralHealthNeed: "Outpatient Psychiatry",
    specialty: "Outpatient Psychiatry",
    urgency: "ROUTINE",
    eligibilityVerified: "UNVERIFIED",
    operationalNotes: "Eligibility renewal pending; missing referring provider signature.",
    caseStatus: CaseStatus.BLOCKED,
    priorityScore: 71,
    riskLevel: RiskLevel.HIGH,
    riskExplanation: "Unverified Medicaid eligibility & incomplete referral packet.",
    primaryBarrierCategory: BarrierCategory.ADMINISTRATIVE,
    primaryBarrierCode: "incomplete referral",
    matchedProviderId: drNguyen.id,
    humanReviewRequired: true,
    confirmedBarrier: true,
    intervention: {
      type: InterventionType.REFERRAL_COMPLETION_ASSISTANCE,
      status: InterventionStatus.IN_PROGRESS,
      reason: "Referring clinic must resubmit signed referral and verify active eligibility.",
      action: "Operations Coordinator contacting referring office.",
    },
  });

  // 10. Lost to Follow-Up
  await createSeedJourney({
    externalMemberId: "MEM-9010",
    firstName: "Robert",
    lastName: "Miller",
    dobYear: 1968,
    preferredLanguage: "English",
    geography: "Rural North",
    urbanicity: "RURAL",
    coverageType: "MEDICARE_ADVANTAGE",
    raceEthnicityCohort: "White",
    ageGroupCohort: "50-64",
    digitalAccessLevel: "NONE",
    transportationAccess: "NONE",
    priorNoShowCount: 2,
    consentSms: false,
    externalReferralId: "REF-2026-1010",
    referralDaysAgo: 32,
    behavioralHealthNeed: "Outpatient Behavioral Health",
    specialty: "Outpatient Behavioral Health",
    urgency: "ROUTINE",
    eligibilityVerified: "VERIFIED",
    operationalNotes: "3 outreach calls unanswered; disconnected number noted.",
    caseStatus: CaseStatus.LOST_TO_FOLLOW_UP,
    priorityScore: 85,
    riskLevel: RiskLevel.HIGH,
    riskExplanation:
      "No digital access, no transportation, 2 prior missed visits, unreachable after 3 attempts.",
    primaryBarrierCategory: BarrierCategory.COMMUNICATION,
    primaryBarrierCode: "digital access",
    confirmedBarrier: true,
    intervention: {
      type: InterventionType.HUMAN_OUTREACH,
      status: InterventionStatus.FAILED,
      reason: "Phone number disconnected after 3 outreach attempts.",
      action: "Attempted phone outreach and mailed letter; no response within 30-day window.",
      outcome: "Closed as Lost to Follow-Up pending updated member contact info.",
    },
  });

  // Seed initial EquityMetric snapshots
  await prisma.equityMetric.createMany({
    data: [
      {
        tenantId: tenant.id,
        cohortDimension: "preferredLanguage",
        cohortValue: "English",
        periodStart: daysAgo(30),
        periodEnd: now,
        totalReferrals: 8,
        completedVisits: 2,
        completionRatePct: 25.0,
        avgTimeToCareDays: 11.5,
        disparityGapPctPoints: -5.0,
        topBarrierCategory: BarrierCategory.BEHAVIORAL,
      },
      {
        tenantId: tenant.id,
        cohortDimension: "preferredLanguage",
        cohortValue: "Spanish",
        periodStart: daysAgo(30),
        periodEnd: now,
        totalReferrals: 2,
        completedVisits: 1,
        completionRatePct: 50.0,
        avgTimeToCareDays: 12.0,
        disparityGapPctPoints: 20.0,
        topBarrierCategory: BarrierCategory.COMMUNICATION,
      },
    ],
  });

  // Isolated tenant record
  const isoMember = await prisma.member.create({
    data: {
      tenantId: isolatedTenant.id,
      externalMemberId: "PAC-100",
      firstName: "Isolated",
      lastName: "Member",
      geography: "West Coast",
    },
  });

  const isoReferral = await prisma.referral.create({
    data: {
      tenantId: isolatedTenant.id,
      memberId: isoMember.id,
      externalReferralId: "PAC-REF-001",
      referralDate: daysAgo(2),
      behavioralHealthNeed: "Outpatient Counseling",
      specialty: "Outpatient Behavioral Health",
      geography: "West Coast",
    },
  });

  await prisma.case.create({
    data: {
      tenantId: isolatedTenant.id,
      referralId: isoReferral.id,
      memberId: isoMember.id,
      status: CaseStatus.NEW,
      priorityScore: 30,
      riskLevel: RiskLevel.LOW,
    },
  });

  // Expand dataset to >= 50 members, >= 75 referrals, >= 20 providers, and 5 showcase scenarios
  await seedDemoExpansion({
    prisma,
    tenantId: tenant.id,
    careManager,
    adminUser,
    existingProviders: {
      drRiveraId: drRivera.id,
      drKulkarniId: drKulkarni.id,
      drNguyenId: drNguyen.id,
      drThorntonId: drThornton.id,
      drAlvarezId: drAlvarez.id,
    },
  });

  const firstCase = await prisma.case.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  if (firstCase) {
    await prisma.evidence.create({
      data: {
        tenantId: tenant.id,
        caseId: firstCase.id,
        sourceType: "CLINIC_CONFIRMATION",
        summary: "Verified clinic intake confirmation recorded during demo seed.",
        payloadHash: "seed-verified-intake-confirmation",
        payload: { source: "SEED", verified: true },
        capturedBy: adminUser.id,
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: adminUser.role,
      action: "DEMO_TENANT_SEEDED",
      entityType: "Tenant",
      entityId: tenant.id,
      source: "SEED",
      summary:
        "Seeded CareLoop synthetic demo dataset (60 members, 80 referrals/cases, 22 providers, 5 showcase scenarios, 5 RBAC users).",
    },
  });

  return { tenant, isolatedTenant, adminUser, careManager };
}
