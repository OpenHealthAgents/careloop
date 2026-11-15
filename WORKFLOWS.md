# CareLoop Care Execution Workflows (`WORKFLOWS.md`)

CareLoop models behavioral-health care execution as explicit, auditable state machines and human-in-the-loop accountability gates rather than unstructured ticket statuses or message-sent heuristics.

---

## 1. Case Lifecycle State Machine (`src/domain/cases/state-machine.ts`)

```mermaid
flowchart LR
  NEW --> TRIAGED
  TRIAGED --> BARRIER_IDENTIFIED
  BARRIER_IDENTIFIED --> INTERVENTION_RECOMMENDED
  INTERVENTION_RECOMMENDED --> INTERVENTION_IN_PROGRESS
  INTERVENTION_IN_PROGRESS --> APPOINTMENT_SCHEDULED
  APPOINTMENT_SCHEDULED --> APPOINTMENT_CONFIRMED
  APPOINTMENT_CONFIRMED --> APPOINTMENT_COMPLETED
  APPOINTMENT_COMPLETED --> VERIFIED
  VERIFIED --> CLOSED
```

- **Exception / Side States:** `ESCALATED`, `BLOCKED`, `REQUIRES_HUMAN_REVIEW`, `LOST_TO_FOLLOW_UP` can be entered cleanly with reason tracking and recovered back into active coordination steps.
- **Guardrail:** Arbitrary transitions (e.g., `NEW → CLOSED`, `CLOSED → NEW`, `REQUIRES_HUMAN_REVIEW → APPOINTMENT_COMPLETED`) throw `InvalidStateTransitionError` (`409`). Agents may propose `proposed_next_state`, which must pass `validateAgentProposedTransition` (`assertCaseTransition`) deterministically before persistence. Every transition writes both an immutable `WorkflowEvent` and a PHI-minimized `AuditEvent` (`previousState` → `newState`).

---

## 2. Barrier Verification & Human Epistemic Gate

1. Initial AI triage emits `Barrier` with `epistemicStatus = INFERENCE` (or `UNKNOWN` / `"Barrier unknown"`).
2. Care managers confirm, modify against the canonical taxonomy (`ACCESS`, `ADMINISTRATIVE`, `FINANCIAL`, `COMMUNICATION`, `BEHAVIORAL`, `SOCIAL_LOGISTICAL`, `UNKNOWN`), or mark `UNKNOWN` via `POST /api/barriers/[id]/review`.
3. Only human review promotes a barrier to `epistemicStatus = FACT`.

---

## 3. Intervention Classification & Execution Gate (`src/domain/interventions/`)

- **`AUTOMATED`**: Eligible only for low/medium-risk, non-clinical administrative nudges (`executionMode = AUTOMATED`, `automationEligible = true`, `!isHighRisk`, `case.riskLevel !== "HIGH"`).
- **`HUMAN_ASSISTED`**: Standard operational workflows (`ALTERNATIVE_PROVIDER_SEARCH`, `LANGUAGE_COMPATIBLE_PROVIDER_SEARCH`, `ASSISTED_SCHEDULING`, `TRANSPORTATION_SUPPORT`, `BENEFIT_NETWORK_EXPLANATION`, `REFERRAL_COMPLETION_ASSISTANCE`, `MISSED_APPOINTMENT_REENGAGEMENT`) requiring Care Manager approval or modification.
- **`HUMAN_ONLY`**: `HUMAN_OUTREACH` and `ESCALATION` must **always** remain human-executed and cannot run autonomously (`executeAutomatedIntervention` rejects `400`).

---

## 4. Appointment State Machine & Multi-Signal Verification

- **Appointment States (`src/domain/appointments/state-machine.ts`)**:
  `PROPOSED` / `REQUESTED` → `SCHEDULED` → `CONFIRMED` → `COMPLETED` (with branches for `RESCHEDULED`, `CANCELLED`, `NO_SHOW`, `UNKNOWN`).
- **Safety Guarantees:**
  - Providers marked `NOT_AVAILABLE` or `acceptingNewPatients === false` cannot be scheduled without a verified slot (`400 ValidationError`).
  - **Scheduling ≠ Care Completion:** Creating or confirming an appointment sets `confidence = 0.0` with note `"Scheduling only — NOT care completion"`.
  - Actual visit completion (`Case.firstCompletedVisitAt` + `VERIFIED` / `CLOSED`) requires explicit `CompletionVerification` signals (`PROVIDER_CONFIRMATION`, `MEMBER_CONFIRMATION`, `CLAIM_RECEIVED`, `APPOINTMENT_COMPLETED`, `SUBSEQUENT_TREATMENT_ENGAGEMENT`).
  - Marking `NO_SHOW` sets `Case.humanReviewRequired = true` and transitions to `REQUIRES_HUMAN_REVIEW` without counting completion.
