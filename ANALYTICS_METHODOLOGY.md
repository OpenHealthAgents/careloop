# CareLoop Analytics & Health Equity Methodology

This document defines the exact mathematical formulas, inclusion rules, governance guardrails, and statistical caution thresholds used across the CareLoop Executive Dashboard and Health Equity Analytics views. Every metric is strictly reconciled to tenant-isolated PostgreSQL records; CareLoop never invents or extrapolates vanity numbers.

---

## 1. Core Definitions & Invariants

1. **Completed Behavioral-Health Visit (`hasVerifiedVisit`)**:
   - A case is counted as a completed visit **only** when `Case.firstCompletedVisitAt IS NOT NULL` **OR** there exists a `CompletionVerification` record with:
     - `verified = true`
     - `verificationStatus = VERIFIED`
     - `signalType` in `{ APPOINTMENT_COMPLETED, CLAIM_RECEIVED, PROVIDER_CONFIRMATION, MEMBER_CONFIRMATION, SUBSEQUENT_TREATMENT_ENGAGEMENT }`.
   - `APPOINTMENT_SCHEDULED` and `APPOINTMENT_CONFIRMED` **never** count as care completion.

2. **Eligible Referral (`isEligibleReferral`)**:
   - Excludes records explicitly flagged `Referral.eligibilityVerified = "INELIGIBLE"` or `Member.eligibilityStatus = "INACTIVE"`.

---

## 2. North-Star & Operational Funnel Metrics (`src/domain/analytics/executive-metrics.ts`)

| Metric | Formula | Source Tables |
| :--- | :--- | :--- |
| **North-Star Referral Completion Rate** | `(Completed Eligible Cases / Total Eligible Referrals) × 100` | `Case`, `Referral`, `Member`, `CompletionVerification` |
| **Volume: Referrals Received** | Count of cases matching active filters | `Case`, `Referral` |
| **Volume: Members Prioritized** | Count of distinct `memberId` values with a `RiskAssessment` or non-default score/tier | `Case`, `RiskAssessment` |
| **Volume: Interventions Initiated** | Non-rejected interventions transitioned beyond `RECOMMENDED` (`APPROVED`, `MODIFIED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`) | `Intervention` |
| **Conversion: Referrals → Appointments** | `(Cases with ≥1 non-cancelled Appointment or scheduled+ status / Referrals Received) × 100` | `Case`, `Appointment` |
| **Conversion: Appointments → Completed** | `(Verified Completed Cases / Cases with Appointments) × 100` | `Case`, `Appointment`, `CompletionVerification` |
| **Conversion: Completed → Continued Engagement** | `(Cases with SUBSEQUENT_TREATMENT_ENGAGEMENT signal OR ≥2 COMPLETED appointments / Verified Completed Cases) × 100` | `CompletionVerification`, `Appointment` |
| **Time to Appointment (Days)** | Mean `max(0, firstNonCancelledAppointment.scheduledStartAt - referralDate)` in days (`N/A` if 0 scheduled) | `Appointment`, `Referral` |
| **Time to Care (Days)** | Mean `max(0, firstCompletedVisitAt - referralDate)` in days across verified completed cases (`N/A` if 0 completed) | `Case`, `Referral` |
| **Intervention Success Rate** | `(COMPLETED interventions with resolved outcome / All COMPLETED or FAILED interventions) × 100` | `Intervention`, `InterventionOutcome` |
| **Human Hours per Completed Case** | `(0.5h × human-led interventions + 0.25h × (outreach + notes + verifications)) / Verified Completed Cases` across completed cases | `Intervention`, `Communication`, `CaseNote`, `CompletionVerification` |
| **Appointment Completion Rate** | `(COMPLETED appointments / (SCHEDULED + CONFIRMED + COMPLETED + NO_SHOW)) × 100` | `Appointment` |
| **No-Show Rate** | `(NO_SHOW appointments / (SCHEDULED + CONFIRMED + COMPLETED + NO_SHOW)) × 100` | `Appointment` |
| **Re-engagement Rate** | `(Missed/re-engagement cohort cases that achieved scheduled/confirmed/verified care / Total missed cohort) × 100` | `Appointment`, `Intervention`, `Case` |
| **Provider Match Success Rate** | `(Cases with matchedProviderId IS NOT NULL / Referrals Received) × 100` | `Case`, `Provider` |

---

## 3. Health Equity & Disparity Metrics (`src/domain/equity/analytics.ts`)

| Metric | Formula | Purpose |
| :--- | :--- | :--- |
| **Cohort Completion Rate** | `(Completed Cases in Cohort / Total Cases in Cohort) × 100` | Identifies populations experiencing drop-off |
| **Disparity Gap (Percentage Points)** | `Cohort Completion Rate - Overall Filtered Population Completion Rate` | Negative gaps indicate populations trailing overall access |
| **Time-to-Care Disparity Spread** | `max(Cohort Avg Days) - min(Cohort Avg Days)` across cohorts | Measures wait/delay inequities across populations |
| **Disparity Trend Direction** | Compares gap magnitude in **earlier half** vs **recent half** of referrals ordered by `referralDate`: `INCREASING` if gap grew by ≥ +5 pts, `DECREASING` if narrowed by ≥ 5 pts, `STABLE` otherwise, or `INSUFFICIENT_DATA` if sample spans fewer than 4 total or 1 per sub-period | Monitors whether equity interventions are narrowing or widening gaps |
| **Barrier Prevalence** | `(Cases in Cohort with primaryBarrierCategory = B / Cohort Total Cases) × 100` | Reveals structural barriers per population |
| **Intervention Disparity-Reduction Lift** | Within trailing cohorts (`disparityGapPctPoints < 0`): `Completion Rate (With Intervention T) - Completion Rate (Without Intervention T)` | Identifies which interventions close disparities |

---

## 4. Statistical Caution & Sample Size Rules

- **Minimum Reliable Cohort Size (`MIN_RELIABLE_COHORT_SIZE = 5`)**:
  - Every metric always displays the exact sample size **`n`**.
  - Whenever `n < 5`, CareLoop attaches `isSmallSample = true` and displays an explicit **Small Sample** warning badge alongside `sampleCaution`.
  - When ranking lowest-completion cohorts or longest time-to-care cohorts, reliable cohorts (`n >= 5`) are prioritized ahead of tiny preliminary cohorts so small fluctuations do not trigger misleading conclusions.

---

## 5. Equity Governance Guardrail

Protected and sensitive attributes (`raceEthnicityCohort`, `preferredLanguage`, `ageGroupCohort`, `urbanicity`) are strictly segregated from individual risk scoring (`src/domain/risk/risk-engine.ts`) and referral eligibility decisions. They are aggregated **only at cohort level** for:
1. Disparity measurement
2. Cohort analysis & barrier discovery
3. Intervention effectiveness & disparity-reduction evaluation
4. Continuous Health Equity monitoring (`LEARN` loop)
