/**
 * ============================================================================
 * FOUNDER DEMO ENGINE (SCRIPTED 7-SCENE HEALTHCARE AI DEMO)
 * ============================================================================
 * Implements a compelling, production-grade scripted founder demo:
 *
 * 1. Population: A referral population enters CareLoop (intake & ingestion).
 * 2. Prioritization: CareLoop identifies cases requiring intervention (risk & triage).
 * 3. Agent Execution: Open a case and show:
 *    - Goal
 *    - State
 *    - Barrier
 *    - Evidence
 *    - Next action
 *    - Tool
 *    - Policy
 *    - Execution
 *    - Result
 * 4. Human Intervention: Case where agent encounters human approval requirement.
 * 5. Completion: Verified appointment completion (dual-source corroboration).
 * 6. Equity: Unequal completion rates and barrier distributions.
 * 7. Learning: Barrier -> Intervention -> Outcome closed-loop optimization.
 * ============================================================================
 */

import { CaseStatus } from "@prisma/client";

// ----------------------------------------------------------------------------
// Types & Contracts
// ----------------------------------------------------------------------------

export type FounderDemoSceneId =
  | "population"
  | "prioritization"
  | "agent_execution"
  | "human_intervention"
  | "completion"
  | "equity"
  | "learning";

export interface FounderDemoScene {
  sceneNumber: number;
  id: FounderDemoSceneId;
  title: string;
  headline: string;
  founderNarration: string;
  liveData: Record<string, any>;
  keyTakeaway: string;
}

export interface AgentExecutionCaseView {
  caseId: string;
  member: {
    name: string;
    syntheticMrn: string;
    age: number;
    coverage: string;
    preferredLanguage: string;
    geography: string;
  };
  goal: string;
  state: CaseStatus;
  barrier: {
    category: string;
    label: string;
    confidence: number;
    description: string;
  };
  evidence: Array<{
    id: string;
    source: string;
    summary: string;
    recordedAt: string;
  }>;
  nextAction: string;
  tool: {
    name: string;
    parameters: Record<string, any>;
    deterministic: boolean;
  };
  policy: {
    ruleId: string;
    verdict: "ALLOW" | "REQUIRE_HUMAN_APPROVAL" | "DENY";
    reason: string;
  };
  execution: {
    invokedAt: string;
    latencyMs: number;
    tokensUsed: number;
    costUSD: number;
    stepResult: string;
  };
  result: {
    newState: CaseStatus;
    slotReserved: string;
    appointmentDate: string;
    confirmationDispatched: boolean;
    auditHash: string;
  };
}

export interface HumanInterventionCaseView {
  caseId: string;
  member: {
    name: string;
    syntheticMrn: string;
    age: number;
    clinicalAcuity: "HIGH" | "CRISIS";
    phq9Score: number;
  };
  stateBefore: CaseStatus;
  pauseReason: string;
  encounteredPolicy: {
    ruleId: string;
    verdict: "REQUIRE_HUMAN_APPROVAL";
    policyText: string;
  };
  careManagerWorkbench: {
    assignedClinician: string;
    reviewQueueUrgency: "HIGH_PRIORITY";
    humanPrompt: string;
    suggestedAction: string;
  };
  humanActionTaken: {
    reviewerName: string;
    reviewerRole: string;
    decision: "APPROVED";
    clinicalRationale: string;
    approvedFundingLimitUSD: number;
    timestamp: string;
    auditProof: string;
  };
  resumption: {
    resumedAgent: string;
    newState: CaseStatus;
    autonomousSafetyInvariant: string;
  };
}

export interface VerifiedCompletionCaseView {
  caseId: string;
  member: {
    name: string;
    referralId: string;
    specialty: string;
  };
  traditionalReferralFailurePoint: string;
  careLoopMultiSourceVerification: {
    signalA_ClinicCheckIn: {
      source: "EHR_ELECTRONIC_ATTENDANCE";
      clinicName: string;
      providerNpi: string;
      timestamp: string;
      status: "ATTENDED_50_MIN_SESSION";
    };
    signalB_AdjudicatedClaim: {
      source: "EDI_837P_CLAIM";
      claimId: string;
      cptCode: "90792";
      diagnosisCode: "F33.1";
      adjudicationStatus: "PAID";
    };
    verificationVerdict: "VERIFIED_COMPLETION";
    deterministicStateTransition: {
      before: CaseStatus;
      after: CaseStatus;
    };
    cryptographicAuditHash: string;
  };
}

export interface EquityDisparityView {
  unadjustedBaseline: {
    medicaidCompletionRate: number;
    commercialCompletionRate: number;
    disparityGapPercent: number;
    ruralDaysToCare: number;
    urbanDaysToCare: number;
  };
  barrierPrevalenceByCohort: Array<{
    cohort: string;
    topBarrier: string;
    barrierRatePercent: number;
    historicalNoShowRatePercent: number;
  }>;
  careLoopRemediationImpact: {
    postInterventionMedicaidCompletion: number;
    postInterventionCommercialCompletion: number;
    disparityGapClosedToPercent: number;
    ruralDaysToCarePostIntervention: number;
  };
}

export interface ClosedLoopLearningView {
  targetBarrier: string;
  experimentTitle: string;
  hypothesis: string;
  variants: [
    {
      id: "CONTROL_A";
      name: "Standard Digital SMS Reminder";
      sampleSize: number;
      completionRatePercent: number;
      noShowRatePercent: number;
    },
    {
      id: "INTERVENTION_B";
      name: "Proactive Rideshare Voucher + Telehealth Fallback Choice";
      sampleSize: number;
      completionRatePercent: number;
      noShowRatePercent: number;
    }
  ];
  statisticalOutcome: {
    relativeLiftPercent: number;
    pValue: string;
    statisticallySignificant: true;
  };
  feedbackLoopAction: string;
}

export interface FounderDemoPayload {
  overview: {
    title: string;
    subtitle: string;
    narratorRole: string;
    targetAudience: string;
  };
  scenes: [
    FounderDemoScene, // 1. Population
    FounderDemoScene, // 2. Prioritization
    FounderDemoScene, // 3. Agent execution
    FounderDemoScene, // 4. Human intervention
    FounderDemoScene, // 5. Completion
    FounderDemoScene, // 6. Equity
    FounderDemoScene  // 7. Learning
  ];
  summaryKpis: {
    totalReferralsIngested: number;
    autonomousResolutionPercent: number;
    humanInterventionPercent: number;
    verifiedCompletionRatePercent: number;
    timeToCareDays: number;
    grossMarginPercent: number;
  };
}

// ----------------------------------------------------------------------------
// Scene 1: Population
// ----------------------------------------------------------------------------

export function getScene1Population(batchSize = 500): FounderDemoScene {
  const validCount = Math.floor(batchSize * 0.984);
  const quarantinedCount = batchSize - validCount;

  return {
    sceneNumber: 1,
    id: "population",
    title: "1. Population Intake & Ingestion",
    headline: "Unstructured Behavioral Health Referrals Ingested at Scale",
    founderNarration:
      "Welcome. Today, we're showing you how CareLoop fundamentally solves the $12B behavioral health referral drop-off crisis. Let's start where every care journey begins: population intake. Watch our ingestion pipeline process 500 real-world behavioral health referrals sent from health plan EHRs and provider clinics. Notice how our ingestion service normalizes clinical notes, catches duplicates, quarantines malformed files with zero data loss, and prepares 492 members for immediate intervention in under 400 milliseconds.",
    liveData: {
      batchId: `BATCH-INGEST-${Date.now().toString(36).toUpperCase()}`,
      totalIngested: batchSize,
      acceptedAndNormalized: validCount,
      quarantinedMalformedOrDuplicates: quarantinedCount,
      processingLatencyMs: 382,
      throughputPerSecond: 1308,
      specialtyBreakdown: {
        "Adult Psychiatry": "38.2%",
        "Psychotherapy & Counseling": "29.4%",
        "Child & Adolescent Behavioral Health": "15.0%",
        "Addiction Medicine": "9.8%",
        "Perinatal & Trauma Navigation": "7.6%",
      },
      payerMix: {
        "Medicaid Managed Care": "58.0%",
        "Commercial PPO/HMO": "28.0%",
        "Medicare Dual-Eligible": "11.0%",
        "Uninsured / Self-Pay": "3.0%",
      },
    },
    keyTakeaway:
      "CareLoop ingests high-volume messy referral streams instantly, standardizing clinical intents and preparing cases for autonomous triage.",
  };
}

// ----------------------------------------------------------------------------
// Scene 2: Prioritization
// ----------------------------------------------------------------------------

export function getScene2Prioritization(): FounderDemoScene {
  return {
    sceneNumber: 2,
    id: "prioritization",
    title: "2. Intelligent Risk Stratification & Prioritization",
    headline: "Triage Engine Surfaces High-Risk & Barrier-Laden Cases First",
    founderNarration:
      "Not all referrals are created equal. In traditional systems, referrals sit in a flat chronological fax queue where urgent cases wait weeks. CareLoop changes that instantly. Our deterministic triage engine scores every case from 0 to 100 based on clinical urgency, Social Determinants of Health (SDOH), and historical drop-off risk. 42 crisis cases are flagged for immediate clinician review, while 188 rising-risk cases are assigned to specialized agents for barrier removal. We never let an urgent member slip through the cracks.",
    liveData: {
      triageMethodology: "Multi-Factor Mathematical Priority Engine (0-100)",
      scoringWeights: {
        clinicalAcuity: "40%",
        sdohBarriers: "30%",
        historicalNoShowRisk: "20%",
        timelinessDecay: "10%",
      },
      tierBreakdown: [
        {
          tier: "Tier 1: High Acuity / Crisis (Score 80-100)",
          count: 42,
          percentage: "8.5%",
          routingAction: "Immediate fast-track provider matching + clinical review flag",
        },
        {
          tier: "Tier 2: Rising Risk / Multiple SDOH Barriers (Score 50-79)",
          count: 188,
          percentage: "38.2%",
          routingAction: "Assigned to Barrier & Engagement Agents for active remediation",
        },
        {
          tier: "Tier 3: Routine / Low Friction (Score 0-49)",
          count: 262,
          percentage: "53.3%",
          routingAction: "Digital scheduling invitation & 1-click self-service booking",
        },
      ],
      samplePrioritizedCases: [
        {
          caseId: "CASE-8821",
          member: "Mateo Vance (29, Medicaid)",
          score: 88,
          reasons: ["Severe MDD diagnosis", "Single parent with 2 toddlers", "History of 2 no-shows"],
        },
        {
          caseId: "CASE-9042",
          member: "Marcus Brody (41, Medicaid)",
          score: 94,
          reasons: ["PHQ-9 score 24", "Crisis escalation flag", "Network access deficit"],
        },
      ],
    },
    keyTakeaway:
      "CareLoop mathematically stratifies cases so high-risk and high-barrier members receive immediate proactive navigation.",
  };
}

// ----------------------------------------------------------------------------
// Scene 3: Agent Execution
// ----------------------------------------------------------------------------

export function getScene3AgentExecution(): FounderDemoScene {
  const caseView: AgentExecutionCaseView = {
    caseId: "CASE-8821",
    member: {
      name: "Mateo Vance",
      syntheticMrn: "SYN-MRN-99210",
      age: 29,
      coverage: "HorizonCare Medicaid",
      preferredLanguage: "English",
      geography: "West Metro",
    },
    goal: "First completed in-network behavioral health outpatient visit within 14 days",
    state: "BARRIER_IDENTIFIED",
    barrier: {
      category: "CHILDCARE_DEFICIT",
      label: "Childcare & Modality Mismatch",
      confidence: 0.97,
      description:
        "Single father with two toddler dependents; lacks weekday daytime childcare to attend standard 9-5 clinic visits.",
    },
    evidence: [
      {
        id: "EVID-01",
        source: "PCP_REFERRAL_CLINICAL_NOTE",
        summary: "Primary care physician referral for major depressive episode and severe fatigue.",
        recordedAt: "2026-11-12T14:30:00Z",
      },
      {
        id: "EVID-02",
        source: "SDOH_STRUCTURED_SCREENER",
        summary: "Member self-reports sole custody of toddlers (ages 1 and 3) with zero local family care support.",
        recordedAt: "2026-11-12T14:32:00Z",
      },
      {
        id: "EVID-03",
        source: "DIRECTORY_AUDIT_LOG",
        summary: "0 in-network outpatient clinics within 20 miles offer on-site childcare services.",
        recordedAt: "2026-11-12T14:35:00Z",
      },
    ],
    nextAction:
      "Execute algorithmic provider search for verified weekend morning telehealth intake slot, resolving the childcare barrier.",
    tool: {
      name: "search_providers",
      parameters: {
        specialty: "Psychotherapy & Counseling",
        modality: "TELEHEALTH",
        dayOfWeek: "SATURDAY",
        timeWindow: "MORNING",
        inNetworkOnly: true,
      },
      deterministic: true,
    },
    policy: {
      ruleId: "POLICY_TELEHEALTH_AND_IN_NETWORK_MATCH",
      verdict: "ALLOW",
      reason:
        "In-network telehealth appointment matching requires no financial subsidy override and complies with Medicaid parity regulations.",
    },
    execution: {
      invokedAt: "2026-11-12T14:36:10Z",
      latencyMs: 34,
      tokensUsed: 0,
      costUSD: 0.0,
      stepResult:
        "Matched Dr. Elena Warren, PsyD (#PROV-4401). Verified open slot #SLOT-7712 on Saturday at 10:00 AM.",
    },
    result: {
      newState: "APPOINTMENT_SCHEDULED",
      slotReserved: "SLOT-7712 (Dr. Elena Warren, PsyD - Saturday 10:00 AM Telehealth)",
      appointmentDate: "Saturday, Nov 15 at 10:00 AM",
      confirmationDispatched: true,
      auditHash: "0x89fc3301ab29e10d",
    },
  };

  return {
    sceneNumber: 3,
    id: "agent_execution",
    title: "3. Transparent Agent Execution",
    headline: "Under the Hood: Goal, State, Barrier, Evidence, Policy & Result",
    founderNarration:
      "Now, let's open up an active case to see what makes CareLoop fundamentally different from generic LLM chatbots. Look at Case 8821 for Mateo Vance. Notice the crystal-clear architecture: The agent has an immutable Goal. It tracks current State. It diagnosed the specific Barrier—a childcare deficit that makes weekday appointments impossible. It holds concrete Evidence. It chooses the Next Action, checks the Policy Engine—which returns ALLOW—and invokes a deterministic Tool. In 34 milliseconds and zero token cost, it locks in a Saturday morning telehealth slot with Dr. Warren, dispatches a confirmation SMS, and transitions the case to APPOINTMENT_SCHEDULED. Fully auditable, zero hallucination.",
    liveData: caseView,
    keyTakeaway:
      "CareLoop executes with medical-grade transparency: every agent action is bound to an immutable goal, verified evidence, and deterministic policy checks.",
  };
}

// ----------------------------------------------------------------------------
// Scene 4: Human Intervention
// ----------------------------------------------------------------------------

export function getScene4HumanIntervention(): FounderDemoScene {
  const caseView: HumanInterventionCaseView = {
    caseId: "CASE-9042",
    member: {
      name: "Marcus Brody",
      syntheticMrn: "SYN-MRN-99342",
      age: 41,
      clinicalAcuity: "HIGH",
      phq9Score: 24,
    },
    stateBefore: "REQUIRES_HUMAN_REVIEW",
    pauseReason:
      "Policy boundary triggered: Severe clinical depression (PHQ-9 = 24) combined with a request for out-of-network provider subsidy ($180) mandates licensed clinician authorization.",
    encounteredPolicy: {
      ruleId: "POLICY_CLINICAL_CRISIS_AND_FINANCIAL_EXCEPTION",
      verdict: "REQUIRE_HUMAN_APPROVAL",
      policyText:
        "High-risk acuity scores (PHQ-9 >= 20) and non-standard financial subsidies (> $150) cannot be approved autonomously by AI agents.",
    },
    careManagerWorkbench: {
      assignedClinician: "Sarah Jenkins, LCSW (Lead Care Manager)",
      reviewQueueUrgency: "HIGH_PRIORITY",
      humanPrompt:
        "Marcus Brody requires urgent psychiatric consultation. In-network wait times exceed 4 weeks. Dr. David Stern (Out-of-Network) has an immediate opening this Friday. CareLoop requests authorization for a $180 one-time network exception subsidy voucher.",
      suggestedAction: "Approve $180 single-case agreement voucher + schedule nurse follow-up check.",
    },
    humanActionTaken: {
      reviewerName: "Sarah Jenkins, LCSW",
      reviewerRole: "CARE_MANAGER",
      decision: "APPROVED",
      clinicalRationale:
        "Acuity necessitates immediate intervention within 48 hours to prevent ED presentation. $180 voucher approved under HorizonCare behavioral health crisis carve-out.",
      approvedFundingLimitUSD: 180.0,
      timestamp: "2026-11-12T15:10:22Z",
      auditProof: "0xcc449911fab09923",
    },
    resumption: {
      resumedAgent: "SchedulingAgent",
      newState: "INTERVENTION_IN_PROGRESS",
      autonomousSafetyInvariant:
        "The agent was blocked from taking financial or clinical action until Sarah explicitly authenticated and signed the approval.",
    },
  };

  return {
    sceneNumber: 4,
    id: "human_intervention",
    title: "4. Human-in-the-Loop Safety Gate",
    headline: "AI Stops at High-Risk Boundaries: Care Manager Oversight in Action",
    founderNarration:
      "No health plan or hospital will ever allow an autonomous AI to spend budget or make clinical crisis decisions unsupervised. That's why CareLoop is engineered with hard policy fences. Look at Marcus Brody: His PHQ-9 score is 24, and the agent wants to book an out-of-network provider requiring a $180 subsidy voucher. Instead of acting autonomously, the Policy Engine immediately triggers REQUIRE_HUMAN_APPROVAL and pauses the case. Sarah Jenkins, our licensed care manager, receives a prioritized prompt with full context. With one click, Sarah reviews the clinical rationale, approves the voucher, and the agent resumes safely. The human remains firmly in the driver's seat.",
    liveData: caseView,
    keyTakeaway:
      "CareLoop guarantees AI safety through hard policy fences: high-risk clinical acuity and financial exceptions strictly mandate human clinician authorization.",
  };
}

// ----------------------------------------------------------------------------
// Scene 5: Completion
// ----------------------------------------------------------------------------

export function getScene5Completion(): FounderDemoScene {
  const caseView: VerifiedCompletionCaseView = {
    caseId: "CASE-8821",
    member: {
      name: "Mateo Vance",
      referralId: "REF-8821-BH",
      specialty: "Psychotherapy & Counseling",
    },
    traditionalReferralFailurePoint:
      "In traditional health systems, a referral is stamped 'complete' when an appointment is booked or faxed, even if the patient no-shows. 78% of referrals vanish into this black hole.",
    careLoopMultiSourceVerification: {
      signalA_ClinicCheckIn: {
        source: "EHR_ELECTRONIC_ATTENDANCE",
        clinicName: "Metro Mind Wellness Center",
        providerNpi: "1922094182",
        timestamp: "2026-11-15T10:48:12Z",
        status: "ATTENDED_50_MIN_SESSION",
      },
      signalB_AdjudicatedClaim: {
        source: "EDI_837P_CLAIM",
        claimId: "CLM-2026-90412",
        cptCode: "90792",
        diagnosisCode: "F33.1",
        adjudicationStatus: "PAID",
      },
      verificationVerdict: "VERIFIED_COMPLETION",
      deterministicStateTransition: {
        before: "APPOINTMENT_COMPLETED",
        after: "VERIFIED",
      },
      cryptographicAuditHash: "0x66f0012bc44e9912",
    },
  };

  return {
    sceneNumber: 5,
    id: "completion",
    title: "5. Multi-Source Verified Completion",
    headline: "Solving the Referral Black Hole with Dual-Source Corroboration",
    founderNarration:
      "Here is the dirty secret of healthcare navigation: traditional vendors claim 'success' the moment an appointment is scheduled. But in Medicaid behavioral health, up to 60% of scheduled appointments result in a no-show. CareLoop refuses to declare victory on scheduling alone. Watch how our Verification Engine proves actual care delivery. We require dual-source corroboration: First, an electronic attendance record directly from the clinic's EHR. Second, an adjudicated 837P healthcare claim matching the NPI, patient ID, and CPT code 90792. Only when both signals corroborate does the state machine transition to VERIFIED. This is the gold standard that enables value-based contracts.",
    liveData: caseView,
    keyTakeaway:
      "CareLoop solves the referral black hole by requiring dual-source corroboration (EHR attendance + adjudicated claim) before verifying care completion.",
  };
}

// ----------------------------------------------------------------------------
// Scene 6: Equity
// ----------------------------------------------------------------------------

export function getScene6Equity(): FounderDemoScene {
  const equityView: EquityDisparityView = {
    unadjustedBaseline: {
      medicaidCompletionRate: 21.4,
      commercialCompletionRate: 59.2,
      disparityGapPercent: 37.8,
      ruralDaysToCare: 46.2,
      urbanDaysToCare: 18.5,
    },
    barrierPrevalenceByCohort: [
      {
        cohort: "Medicaid Managed Care",
        topBarrier: "Transportation Deficit",
        barrierRatePercent: 41.2,
        historicalNoShowRatePercent: 24.8,
      },
      {
        cohort: "Rural Geography",
        topBarrier: "Network Capacity / Distance",
        barrierRatePercent: 38.6,
        historicalNoShowRatePercent: 22.1,
      },
      {
        cohort: "Spanish-Primary Language",
        topBarrier: "Bilingual Provider Shortage",
        barrierRatePercent: 54.0,
        historicalNoShowRatePercent: 26.5,
      },
      {
        cohort: "Commercial PPO",
        topBarrier: "Scheduling / Work Hours Conflict",
        barrierRatePercent: 18.3,
        historicalNoShowRatePercent: 6.2,
      },
    ],
    careLoopRemediationImpact: {
      postInterventionMedicaidCompletion: 63.8,
      postInterventionCommercialCompletion: 65.2,
      disparityGapClosedToPercent: 1.4,
      ruralDaysToCarePostIntervention: 11.8,
    },
  };

  return {
    sceneNumber: 6,
    id: "equity",
    title: "6. Health Equity & Disparity Remediation",
    headline: "Closing the 37.8-Point Medicaid Equity Gap Through Proactive Remediation",
    founderNarration:
      "Health equity is not a buzzword at CareLoop; it's a mathematical reality. Look at the baseline numbers: Medicaid members complete behavioral health referrals at just 21.4%, compared to nearly 60% for commercial members—a massive 37.8-point disparity gap. Why? Because Medicaid members face concrete SDOH barriers: 41% lack reliable transportation, and 54% of non-English speakers can't find a bilingual provider. CareLoop eliminates these drop-offs proactively. By dispatching integrated rideshare vouchers, verified bilingual providers, and telehealth access, we close that 37.8-point gap down to just 1.4 points. Medicaid members complete care at 63.8%. That is true health equity.",
    liveData: equityView,
    keyTakeaway:
      "CareLoop turns health equity from an aspiration into a closed-loop outcome: closing the Medicaid disparity gap from 37.8% down to 1.4%.",
  };
}

// ----------------------------------------------------------------------------
// Scene 7: Learning
// ----------------------------------------------------------------------------

export function getScene7Learning(): FounderDemoScene {
  const learningView: ClosedLoopLearningView = {
    targetBarrier: "TRANSPORTATION_DEFICIT",
    experimentTitle: "EXP-TRANSIT-2026: Standard SMS Reminder vs. Automated Rideshare Voucher + Telehealth",
    hypothesis:
      "Providing an automated zero-cost rideshare voucher with an immediate telehealth alternative will increase referral completion by > 30% for members lacking reliable transportation.",
    variants: [
      {
        id: "CONTROL_A",
        name: "Standard Digital SMS Reminder",
        sampleSize: 1200,
        completionRatePercent: 29.1,
        noShowRatePercent: 18.2,
      },
      {
        id: "INTERVENTION_B",
        name: "Proactive Rideshare Voucher + Telehealth Fallback Choice",
        sampleSize: 1200,
        completionRatePercent: 74.6,
        noShowRatePercent: 4.3,
      },
    ],
    statisticalOutcome: {
      relativeLiftPercent: 156.4,
      pValue: "p < 0.0001",
      statisticallySignificant: true,
    },
    feedbackLoopAction:
      "Policy Engine automatically promoted Variant B to default intervention policy for all members classified with TRANSPORTATION_DEFICIT across HorizonCare.",
  };

  return {
    sceneNumber: 7,
    id: "learning",
    title: "7. Closed-Loop Learning & Optimization",
    headline: "Barrier → Intervention → Outcome: The Engine Gets Smarter With Every Referral",
    founderNarration:
      "Finally, let's look at CareLoop's compounding competitive moat: our closed-loop learning engine. Every referral journey is a clinical experiment. Look at this randomized trial for members with a Transportation Deficit: Variant A, the standard reminder, achieved only 29.1% completion. Variant B, which combined an automated rideshare voucher with a 1-click telehealth fallback, achieved 74.6% completion—a 156% relative lift with p < 0.0001 significance. The moment that threshold was proven, CareLoop's Policy Engine automatically promoted Variant B to the default standard of care across the health plan. With every completed case, CareLoop gets smarter, faster, and more cost-effective.",
    liveData: learningView,
    keyTakeaway:
      "CareLoop compounds value through continuous learning: statistically proven interventions automatically update policy routing, expanding our structural moat.",
  };
}

// ----------------------------------------------------------------------------
// Master Runner: 7-Scene Founder Demo Orchestrator
// ----------------------------------------------------------------------------

export function runFounderDemo(options?: { seed?: number; batchSize?: number }): FounderDemoPayload {
  const batchSize = options?.batchSize ?? 500;

  const scene1 = getScene1Population(batchSize);
  const scene2 = getScene2Prioritization();
  const scene3 = getScene3AgentExecution();
  const scene4 = getScene4HumanIntervention();
  const scene5 = getScene5Completion();
  const scene6 = getScene6Equity();
  const scene7 = getScene7Learning();

  return {
    overview: {
      title: "CareLoop Founder Demonstration Script",
      subtitle: "Autonomous Behavioral Health Referral & Completion Engine",
      narratorRole: "Founder & Chief Executive Officer",
      targetAudience: "Payer Executives, Health Equity Leaders, Care Managers, Investors & Healthcare Operators",
    },
    scenes: [scene1, scene2, scene3, scene4, scene5, scene6, scene7],
    summaryKpis: {
      totalReferralsIngested: batchSize,
      autonomousResolutionPercent: 88.4,
      humanInterventionPercent: 11.6,
      verifiedCompletionRatePercent: 64.6,
      timeToCareDays: 11.2,
      grossMarginPercent: 87.5,
    },
  };
}
