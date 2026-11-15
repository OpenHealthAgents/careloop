# CareLoop AI Safety & Architecture (`AI.md`)

CareLoop uses AI to assist human care coordination, **never** to replace human accountability or deliver clinical care. Every AI operation runs behind [`AIProvider`](file:///d:/Kalyan/CareLoop/src/ai/provider.ts) and must pass schema validation and deterministic safety policy guards before application code acts on any result.

---

## 1. Pluggable Providers & Versioned Prompts

- **Interfaces (`src/ai/provider.ts`)**:
  1. `calculateRisk`
  2. `classifyBarrier`
  3. `recommendIntervention`
  4. `summarizeCase`
  5. `generateMemberCommunication`
  6. `matchProvider`
- **Implementations**:
  - [`DeterministicAIProvider`](file:///d:/Kalyan/CareLoop/src/ai/deterministic-provider.ts) (`AI_PROVIDER_MODE="deterministic"`, default): offline, zero-external-API rules engine producing reproducible structured envelopes for development, testing, and fallback.
  - [`ExternalOpenAIProvider`](file:///d:/Kalyan/CareLoop/src/ai/external-provider.ts) (`AI_PROVIDER_MODE="openai"`): calls an OpenAI-compatible chat-completions API, validates JSON strictly via `parseAndValidateModelJson`, and automatically falls back safely to deterministic behavior on malformed responses or upstream errors.
- **Prompt Registry (`src/ai/prompts/registry.ts`)**: Versioned prompt artifacts tracked by `promptVersion` and persisted alongside `providerName`, `modelVersion`, `timestamp`, `inputContext`, `outputPayload`, `confidence`, `uncertainty`, `evidenceSignals`, `resultingAction`, and `humanReviewerId` on `AIRecommendation`.

---

## 2. Strict Schemas & Epistemic Separation (`src/ai/schemas.ts`)

Every AI output extends `BaseAIEnvelopeSchema` with mandatory separation of:
- `facts`: Observed structured database records only.
- `inferences`: Probabilistic interpretations clearly marked as non-facts with per-item `uncertainty`.
- `recommendations`: Actionable non-binding proposals with `requiresHumanReview`.

**Hallucination Guard:** `ClassifyBarrierResultSchema` enforces `.refine()` so any barrier classification other than `UNKNOWN` **must** cite at least one concrete entry in `evidenceSignals`. Insufficient intake signals produce `BarrierCategory.UNKNOWN` / `"Barrier unknown"`.

---

## 3. Policy Guards (`src/ai/policy-guard.ts`)

Every AI output passes through application policy enforcement before storage or execution:

| Function | Policy Guard | Enforced Invariant |
| :--- | :--- | :--- |
| Risk Scoring | `enforceRiskPolicy` | Rejects clinical diagnosis/prescribing/dosage language AND rejects protected demographic attributes (`race`, `ethnicity`, `gender`, etc.) inside individual risk signals |
| Barrier Classification | `enforceBarrierPolicy` | Rejects `epistemicStatus: "FACT"` (human verification required), rejects un-evidenced non-`UNKNOWN` barriers, blocks clinical advice |
| Provider Matching | `enforceProviderMatchPolicy` | Rejects misrepresenting `DIRECTORY_INFORMATION` or `NOT_AVAILABLE` providers as `VERIFIED AVAILABILITY`; blocks booking unavailable providers |
| Interventions | `enforceInterventionPolicy` | Blocks marking `HIGH`-risk cases or `HUMAN_ONLY` interventions (`HUMAN_OUTREACH`, `ESCALATION`) as `AUTOMATED` or `automationEligible: true` |
| Communications | `enforceCommunicationPolicy` | Enforces `consentOutreach` + `consentSms`, plain-language/reading-level checks, and rejects leaked risk scores or internal AI reasoning (`validateOutboundCommunication`) |
| Case Summaries | `enforceCaseSummaryPolicy` | Rejects clinical claims and rejects asserting completed care/visits when `hasCompletedVisit === false` |
| Case Orchestrator | `enforceOrchestratorDecisionPolicy` | Rejects `policy_check_required === false`, rejects clinical advice, requires `requires_human=true` for high-risk or human-accountability tools, checks outreach consent, verified slots, and verified visit completion before closure |

---

## 4. CareLoop Case Orchestrator (`src/ai/orchestrator.ts`)

`CareLoopCaseOrchestrator` serves as CareLoop's single primary coordinator converting complete case context (`case_id`, `member_context`, `referral_context`, `current_state`, `known_barriers`, `available_evidence`, `previous_actions`, `policy_context`, `human_tasks`) into a strict Zod-validated structured JSON decision (`CaseOrchestratorDecisionSchema` containing `goal`, `current_state`, `proposed_next_state`, `recommended_action`, `tool`, `reason`, `evidence`, `confidence`, `requires_human`, `policy_check_required`, `expected_outcome`, and `fallback_action`). Arbitrary prose decisions are rejected via `parseExternalOrchestratorDecision`, and every decision passes through `enforceOrchestratorDecisionPolicy` backed by the typed [`CARE_LOOP_TOOL_REGISTRY`](file:///d:/Kalyan/CareLoop/src/ai/tool-registry.ts) before reaching CareLoop tools or API consumers (`/api/cases/[id]` and `CaseBriefPanel`).

---

## 5. Typed Tool Registry (`src/ai/tool-registry.ts`)

Every agent-executable action in CareLoop is registered as a strongly-typed definition declaring `name`, `description`, `input_schema`, `output_schema`, `risk_level`, `permissions`, `side_effects`, `idempotency_strategy`, `timeout`, `retry_policy`, `audit_event_type`, and `human_approval_requirement` (`NONE` | `POLICY_DEPENDENT` | `ALWAYS_REQUIRED`).

---

## 6. Unified Tool Execution Contract (`src/services/tool-executor.ts`)

LLMs never invoke external APIs or mutate PostgreSQL directly. Every tool invocation passes through `executeCareLoopTool`, which deterministically runs input validation (`validateToolInput`), RBAC authorization (`requirePermission`), case state & proposed transition checks (`validateAgentProposedTransition`), declarative policy evaluation (`assertCareLoopPolicyAllowed`), member consent/privacy validation (`validateOutboundCommunication`), idempotency replay checks, bounded-timeout execution against existing domain services, output schema validation (`validateToolOutput`), and PHI-minimized `AuditEvent` recording.

---

## 7. Centralized Declarative Policy Engine (`src/ai/policy-engine.ts`)

All orchestrator proposals (`enforceOrchestratorDecisionPolicy`) and live tool invocations (`executeCareLoopTool`) evaluate against a single centralized declarative policy rule table (`CARE_LOOP_POLICY_RULES`) via `evaluateCareLoopPolicy` and `assertCareLoopPolicyAllowed`. Rules enforce `DENY`, `REQUIRE_HUMAN_APPROVAL`, and `ALLOW` outcomes across `policy_check_required` enforcement, non-clinical scope boundaries (`PROHIBITED_CLINICAL_PATTERNS`), member outreach and SMS consent, provider selection/availability for scheduling, verified visit completion for case closure, and risk-tier / sensitive-communication human approval requirements.

---

## 8. Human Approval Engine (`src/services/approval-service.ts`)

Actions gated by `REQUIRE_HUMAN_APPROVAL` persist an `ApprovalRequest` (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`) containing `approval_id`, `case_id`, `action`, `reason`, `risk_level`, `requested_by`, `requested_at`, `status`, `approved_by`, `approved_at`, `decision`, and `comments`, alongside persisted `toolInputJson` and `proposedNextState`. Once a human reviewer records an `APPROVED` decision via `decideHumanApproval` (`/api/approvals/[approvalId]/decide`), `resumeAgentFromApproval` (`/api/approvals/[approvalId]/resume`) resumes execution from the persisted state through `executeCareLoopTool` and computes the next `CareLoopCaseOrchestrator` decision.

---

## 9. Execution Journal (`src/services/execution-journal-service.ts`)

Every meaningful agent, tool, human-approval, and system step persists an append-only `ExecutionJournalEvent` (`event_id`, `case_id`, `actor_type`, `actor_id`, `event_type`, `timestamp`, `input_reference`, `output_reference`, `policy_decision`, `evidence`, `correlation_id`) as the canonical source of truth for case execution history, queryable via `listCaseExecutionJournal` and `GET /api/cases/[id]/journal`.

---

## 10. AI Decision Trace (`src/services/decision-trace-service.ts`)

Every `CareLoopCaseOrchestrator` decision persists a structured `AIDecisionTrace` (`decision_id`, `case_id`, `agent`, `model`, `prompt_version`, `input_context_hash`, `decision`, `confidence`, `evidence`, `policy_result`, `tool_selected`, `human_approval_required`, `created_at`) computed via deterministic SHA-256 context hashing (`computeInputContextHash`). Raw chain-of-thought or scratchpad tags are stripped by `sanitizeConciseDecisionExplanation` so only concise, auditable explanations and evidence are stored and queryable via `GET /api/cases/[id]/decision-traces`.

---

## 11. Observability & Telemetry (`src/services/observability-service.ts`)

Every agent run (`AgentRun`) and tool invocation (`ToolExecutionSpan`) records latency, token usage, retries, policy decisions, and failure diagnostics. `getCaseExecutionTrace` (`GET /api/cases/[id]/trace`) reconstructs the end-to-end chain (`Case → Agent Run → Decision → Policy Check → Tool Call → Tool Result → Evidence → State Transition`), while `getObservabilityMetrics` (`GET /api/analytics/observability`) aggregates agent latency, token usage, per-tool latency, failures, retries, approval wait time, completion rate, agent success rate, and intervention success rate.

---

## 12. Learning Loop (`src/services/learning-loop-service.ts`)

`ExecutionLearningRecord` captures the causal execution asset `population/context → barrier → intervention/action → execution strategy/path → human involvement → time → cost → outcome` via `recordCaseLearningOutcome` (`POST /api/cases/[id]/learning` and automatic capture on `verify_completion`, `close_verified_case`, and `escalate_to_human`). `getLearningInsights` and `recommendExecutionStrategy` (`GET /api/analytics/learning`) aggregate completion rates, resolution times, and operational cost units across context/barrier/strategy cohorts to guide future execution strategies.
