import { VerificationSignalType, VerificationStatus } from "@prisma/client";

/**
 * Signals that prove a member actually completed an initial behavioral-health visit
 * (as opposed to merely receiving an outreach message or scheduling/confirming a slot).
 */
export const VISIT_COMPLETION_SIGNALS: ReadonlySet<VerificationSignalType> = new Set([
  VerificationSignalType.APPOINTMENT_COMPLETED,
  VerificationSignalType.CLAIM_RECEIVED,
  VerificationSignalType.PROVIDER_CONFIRMATION,
  VerificationSignalType.MEMBER_CONFIRMATION,
  VerificationSignalType.SUBSEQUENT_TREATMENT_ENGAGEMENT,
]);

export const DEFAULT_SIGNAL_CONFIDENCE: Record<VerificationSignalType, number> = {
  CLAIM_RECEIVED: 0.99,
  PROVIDER_CONFIRMATION: 0.96,
  APPOINTMENT_COMPLETED: 0.92,
  SUBSEQUENT_TREATMENT_ENGAGEMENT: 0.9,
  MEMBER_CONFIRMATION: 0.85,
  APPOINTMENT_CONFIRMED: 0.0,
  APPOINTMENT_SCHEDULED: 0.0,
};

export const NON_COMPLETION_PSEUDO_SIGNALS: ReadonlySet<string> = new Set([
  "MESSAGE_SENT",
  "APPOINTMENT_REQUESTED",
  "APPOINTMENT_SCHEDULED",
  "APPOINTMENT_CONFIRMED",
]);

export interface VerificationRulesConfig {
  acceptedCompletionSignals: VerificationSignalType[];
  minConfidence: number;
  minDistinctSources: number;
}

export const DEFAULT_VERIFICATION_RULES: VerificationRulesConfig = {
  acceptedCompletionSignals: Array.from(VISIT_COMPLETION_SIGNALS),
  minConfidence: 0.75,
  minDistinctSources: 1,
};

/**
 * Resolve tenant-configured verification rules while guaranteeing that
 * non-completion signals (message sent, appointment requested/scheduled/confirmed)
 * can NEVER mark a referral completed.
 */
export function resolveVerificationRules(
  tenantSettings?: unknown,
  override?: Partial<VerificationRulesConfig>
): VerificationRulesConfig {
  const settingsObj =
    tenantSettings && typeof tenantSettings === "object"
      ? (tenantSettings as Record<string, unknown>)
      : {};
  const raw =
    settingsObj.verificationRules && typeof settingsObj.verificationRules === "object"
      ? (settingsObj.verificationRules as Partial<VerificationRulesConfig>)
      : {};

  const mergedAccepted = override?.acceptedCompletionSignals ?? raw.acceptedCompletionSignals;
  const acceptedCompletionSignals = Array.isArray(mergedAccepted)
    ? mergedAccepted.filter((s) => VISIT_COMPLETION_SIGNALS.has(s))
    : DEFAULT_VERIFICATION_RULES.acceptedCompletionSignals;

  const rawMinConfidence = override?.minConfidence ?? raw.minConfidence;
  const minConfidence =
    typeof rawMinConfidence === "number" && Number.isFinite(rawMinConfidence)
      ? Math.max(0, Math.min(1, rawMinConfidence))
      : DEFAULT_VERIFICATION_RULES.minConfidence;

  const rawMinDistinct = override?.minDistinctSources ?? raw.minDistinctSources;
  const minDistinctSources =
    typeof rawMinDistinct === "number" && Number.isFinite(rawMinDistinct) && rawMinDistinct >= 1
      ? Math.floor(rawMinDistinct)
      : DEFAULT_VERIFICATION_RULES.minDistinctSources;

  return {
    acceptedCompletionSignals,
    minConfidence,
    minDistinctSources,
  };
}

export function isVisitCompletionSignal(signalType: VerificationSignalType | string): boolean {
  if (NON_COMPLETION_PSEUDO_SIGNALS.has(String(signalType))) {
    return false;
  }
  return VISIT_COMPLETION_SIGNALS.has(signalType as VerificationSignalType);
}

export function evaluateVerificationSignal(params: {
  signalType: VerificationSignalType;
  verified?: boolean;
  verificationStatus?: VerificationStatus;
  confidence?: number;
  sourceSystem?: string;
  rules?: VerificationRulesConfig;
  existingVerifiedSources?: Array<{
    signalType: VerificationSignalType;
    sourceSystem: string;
  }>;
}): {
  provesCareCompleted: boolean;
  resolvedStatus: VerificationStatus;
  resolvedConfidence: number;
  reason: string;
} {
  const rules = params.rules ?? DEFAULT_VERIFICATION_RULES;
  const isCompletionType = isVisitCompletionSignal(params.signalType);
  const resolvedStatus =
    params.verificationStatus ??
    (params.verified === false
      ? VerificationStatus.INSUFFICIENT_EVIDENCE
      : VerificationStatus.VERIFIED);

  const defaultConf = DEFAULT_SIGNAL_CONFIDENCE[params.signalType] ?? 0.5;
  const resolvedConfidence =
    typeof params.confidence === "number"
      ? Math.max(0, Math.min(1, params.confidence))
      : defaultConf;

  if (!isCompletionType) {
    return {
      provesCareCompleted: false,
      resolvedStatus,
      resolvedConfidence: Math.min(resolvedConfidence, 0.25),
      reason:
        "Scheduling, appointment request, message sent, or appointment confirmation is NOT care completion. Evidence of an attended/completed visit is required.",
    };
  }

  if (!rules.acceptedCompletionSignals.includes(params.signalType)) {
    return {
      provesCareCompleted: false,
      resolvedStatus: VerificationStatus.PENDING_VERIFICATION,
      resolvedConfidence,
      reason: `Configured verification rules do not accept '${params.signalType}' as standalone completion proof.`,
    };
  }

  if (params.verified === false || resolvedStatus !== VerificationStatus.VERIFIED) {
    return {
      provesCareCompleted: false,
      resolvedStatus,
      resolvedConfidence,
      reason: `Verification status '${resolvedStatus}' does not establish completed visit care.`,
    };
  }

  if (resolvedConfidence < rules.minConfidence) {
    return {
      provesCareCompleted: false,
      resolvedStatus: VerificationStatus.INSUFFICIENT_EVIDENCE,
      resolvedConfidence,
      reason: `Signal confidence (${resolvedConfidence.toFixed(2)}) is below configured minimum (${rules.minConfidence.toFixed(2)}).`,
    };
  }

  if (rules.minDistinctSources > 1) {
    const distinctSources = new Set<string>(
      (params.existingVerifiedSources ?? [])
        .filter((s) => rules.acceptedCompletionSignals.includes(s.signalType))
        .map((s) => s.sourceSystem)
    );
    if (params.sourceSystem) {
      distinctSources.add(params.sourceSystem);
    }
    if (distinctSources.size < rules.minDistinctSources) {
      return {
        provesCareCompleted: false,
        resolvedStatus: VerificationStatus.VERIFIED,
        resolvedConfidence,
        reason: `Signal recorded (${distinctSources.size}/${rules.minDistinctSources} distinct verified sources); awaiting additional corroborating evidence per verification rules.`,
      };
    }
  }

  return {
    provesCareCompleted: true,
    resolvedStatus: VerificationStatus.VERIFIED,
    resolvedConfidence,
    reason: `Completed behavioral-health visit verified via ${params.signalType} (confidence ${Math.round(
      resolvedConfidence * 100
    )}%).`,
  };
}

export interface VerificationSummary {
  hasScheduledAppointment: boolean;
  hasConfirmedAppointment: boolean;
  hasCompletedVisit: boolean;
  completedSignals: VerificationSignalType[];
  allSignals: VerificationSignalType[];
  evidenceSourceCount: number;
  highestConfidence: number;
}

export function summarizeVerificationSignals(
  signals: Array<{
    signalType: VerificationSignalType;
    verified: boolean;
    verificationStatus?: VerificationStatus;
    confidence?: number;
  }>
): VerificationSummary {
  const verifiedRows = signals.filter(
    (s) => s.verified && (s.verificationStatus === undefined || s.verificationStatus === "VERIFIED")
  );
  const verifiedSignals = verifiedRows.map((s) => s.signalType);
  const completedRows = verifiedRows.filter((s) => isVisitCompletionSignal(s.signalType));
  const completedSignals = completedRows.map((s) => s.signalType);
  const highestConfidence =
    completedRows.length > 0
      ? Math.max(
          ...completedRows.map(
            (r) => r.confidence ?? DEFAULT_SIGNAL_CONFIDENCE[r.signalType] ?? 0.85
          )
        )
      : 0;

  return {
    hasScheduledAppointment: verifiedSignals.includes(VerificationSignalType.APPOINTMENT_SCHEDULED),
    hasConfirmedAppointment: verifiedSignals.includes(VerificationSignalType.APPOINTMENT_CONFIRMED),
    hasCompletedVisit: completedSignals.length > 0,
    completedSignals,
    allSignals: verifiedSignals,
    evidenceSourceCount: new Set(completedSignals).size,
    highestConfidence,
  };
}

export function calculateReferralToCompletedRate(
  totalReferrals: number,
  completedReferrals: number
): number {
  if (totalReferrals <= 0) return 0;
  return Number(((completedReferrals / totalReferrals) * 100).toFixed(1));
}
