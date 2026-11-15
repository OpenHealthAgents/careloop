# CareLoop — Target Agentic Architecture & Gap Mapping

**Audit Date:** 2026-11-12  
**Companion Document:** [current-state.md](file:///d:/Kalyan/CareLoop/docs/architecture/current-state.md)

---

## 1. Target Agentic Architecture

```text
UI (Next.js App Router + React Client Components)
 ↓
API Gateway / Route Handlers (requireRequestContext + Zod + RBAC)
 ↓
Orchestration & Approval Engine (CareLoopCaseOrchestrator + ApprovalRequest)
 ↓
Declarative Policy Engine (policy-engine.ts + policy-guard.ts)
 ↓
Typed Tool Registry & Executor (tool-registry.ts + tool-executor.ts)
 ↓
Domain Engines & Adapters (Risk, Barrier, Matching, Interventions, Comms, FHIR/CSV)
 ↓
Evidence, Execution Journal, AI Decision Trace, Audit & Observability
 ↓
PostgreSQL (Prisma) + Analytics / Health Equity / Learning Loop / Evaluation
```

---

## 2. Mapping Current Implementation to Target Architecture

| Target Layer | Current Implementation | Status |
| :--- | :--- | :--- |
| **Typed Tool Registry** | `src/ai/tool-registry.ts` (`TOOL_REGISTRY`, Zod input/output schemas, risk, permissions, idempotency, retry, audit event) | **Implemented** |
| **Tool Execution Contract** | `src/services/tool-executor.ts` (`executeCareLoopTool` validates input, auth, state, policy, consent, idempotency, output, evidence, audit, journal, span) | **Implemented** |
| **Declarative Policy Engine** | `src/ai/policy-engine.ts` + `src/ai/policy-guard.ts` | **Implemented** |
| **Human Approval Engine** | `src/services/approval-service.ts`, `ApprovalRequest` model, `/api/approvals/[approvalId]/decide` & `resume` | **Implemented** |
| **Execution Journal** | `src/services/execution-journal-service.ts`, `ExecutionJournalEvent` model, `/api/cases/[id]/journal` | **Implemented** |
| **AI Decision Trace** | `src/services/decision-trace-service.ts`, `AIDecisionTrace` model, `/api/cases/[id]/decision-traces` | **Implemented** |
| **Observability** | `src/services/observability-service.ts`, `AgentRun` & `ToolExecutionSpan` models, `/api/analytics/observability` | **Implemented** |
| **Learning Loop** | `src/services/learning-loop-service.ts`, `ExecutionLearningRecord` model, `/api/analytics/learning` | **Implemented** |
| **Health Equity** | `src/domain/equity/analytics.ts`, `src/services/analytics-service.ts`, `/api/analytics/equity` | **Implemented** |
| **Agent Evaluation** | `src/ai/evaluation.ts`, `src/services/evaluation-service.ts`, `/api/analytics/evaluation`, `AgentEvaluationPanel.tsx` | **Implemented** |
| **Security & PHI Minimization** | `src/lib/auth/*`, `src/lib/security/*` (`encryption.ts`, `phi-minimization.ts`, `transport.ts`), `middleware.ts` | **Implemented (App Tier)** |

---

## 3. Reusable Components (Do Not Rebuild)

- **Domain State Machines & Engines:** `src/domain/cases/state-machine.ts`, `src/domain/appointments/state-machine.ts`, `src/domain/interventions/state-machine.ts`, `src/domain/referrals/state-machine.ts`, `src/domain/risk/risk-engine.ts`, `src/domain/barriers/barrier-engine.ts`, `src/domain/matching/provider-matcher.ts`, `src/domain/completion/verifier.ts`, `src/domain/equity/analytics.ts`.
- **AI & Policy Core:** `src/ai/orchestrator.ts`, `src/ai/tool-registry.ts`, `src/ai/policy-engine.ts`, `src/ai/policy-guard.ts`, `src/ai/deterministic-provider.ts`, `src/ai/external-provider.ts`, `src/ai/evaluation.ts`.
- **Execution & Governance Services:** `src/services/tool-executor.ts`, `src/services/approval-service.ts`, `src/services/execution-journal-service.ts`, `src/services/decision-trace-service.ts`, `src/services/observability-service.ts`, `src/services/learning-loop-service.ts`, `src/services/audit-service.ts`.
- **Auth & Security Helpers:** `src/lib/auth/rbac.ts`, `src/lib/auth/session.ts`, `src/lib/auth/request-context.ts`, `src/lib/security/phi-minimization.ts`, `src/lib/security/encryption.ts`.

---

## 4. Technical Debt, Conflicts, Duplicates & Missing Infrastructure

### Technical Debt
- **Dual Event Trails (`WorkflowEvent` + `ExecutionJournalEvent` + `AuditEvent`):** Legacy `WorkflowEvent` coexists alongside `ExecutionJournalEvent` and `AuditEvent`; newer UI/API paths use `ExecutionJournalEvent` and `AuditEvent`, while older tests and case-detail views still read `WorkflowEvent`.
- **Single-Node In-Memory Rate/Config Patterns:** `src/lib/config.ts` caches env config in-process (`cachedConfig`); horizontal multi-instance deployments need distributed rate limiting and shared caching (Redis) at the ingress/edge.
- **Large Service File (`src/services/case-service.ts`):** Concentrates case CRUD, assessment, scheduling, outreach, and verification in one module; splitting by capability would improve maintainability over time without changing contracts.

### Architectural Conflicts
- **Direct Service Calls vs. Tool Executor Path:** Some legacy UI/API endpoints (e.g., direct `/api/cases/[id]/transition` or `/api/interventions/[id]/execute`) can invoke `case-service.ts` functions directly rather than routing every agent-initiated action exclusively through `executeCareLoopTool` (`tool-executor.ts`). Policy checks exist in both layers, but agent-driven execution should strictly funnel through `tool-executor.ts`.
- **Member Portal Authentication (`src/app/api/member-portal/[caseId]/*`):** Operates via tenant-scoped review routes; external public member access in production requires dedicated member OTP / magic-link authentication rather than staff session cookies.

### Duplicate Implementations
- **Test Coverage Overlap:** Both `tests/unit/health-equity.test.ts` and `tests/unit/health-equity-analytics.test.ts` (and `tests/unit/completion-and-equity.test.ts`) test overlapping equity analytics helpers.
- **Documentation Overlap:** `ARCHITECTURE.md` at repo root and `docs/ARCHITECTURE.md` both exist; `docs/architecture/*` should be treated as the canonical architecture reference going forward.

### Missing Infrastructure (External / Production Ops)
- **Container & IaC Definitions:** No `Dockerfile`, `docker-compose.yml`, or Terraform/Cloud Run manifests are committed in the repository.
- **Background Worker / Queue Runtime:** Retention purging (`src/services/retention-service.ts`), approval expiration (`EXPIRED` status transitions), and asynchronous retry/webhook ingestion currently rely on on-demand API calls rather than a dedicated scheduled worker (e.g., cron/BullMQ/Cloud Scheduler).
- **Live External Vendor Adapters:** `src/adapters/communication/channel-registry.ts` and `src/adapters/dev-adapters.ts` simulate SMS/Voice/Email delivery (`COMMUNICATION_DELIVERY_MODE="mock"`); production Twilio/SES/FHIR EHR adapters require signed BAAs and live credentials.
- **Ingress Security & SIEM:** Distributed WAF/rate limiting, KMS-backed column encryption key rotation, PostgreSQL `INSERT`-only role separation for audit tables, and off-site WORM SIEM shipping are documented in `DEPLOYMENT.md` as infrastructure-level prerequisites.

---

## 5. Implementation Plan (Incremental, Non-Destructive)

1. **Phase 1 — Consolidate Agent Execution Path (Low Risk)**
   - Ensure all agent-initiated actions (including scheduled/automated retries and approval-resumed actions) route exclusively through `executeCareLoopTool` in `src/services/tool-executor.ts`.
   - Keep existing human-operated REST endpoints intact while ensuring both share the same domain/policy validators.
2. **Phase 2 — Background Worker & Scheduling Infrastructure**
   - Add a lightweight worker/cron entrypoint for automated retention enforcement (`retention-service.ts`), `ApprovalRequest` expiration sweeps, and asynchronous outreach/FHIR retry queues.
3. **Phase 3 — Production Deployment & Live Vendor Adapters**
   - Add `Dockerfile` and CI/CD pipeline (`typecheck` → `lint` → `test` → `db:migrate` → `build`).
   - Implement BAA-gated live adapters for Twilio/SES communication delivery and FHIR R4 EHR webhooks behind the existing `src/adapters/contracts.ts` interfaces.
   - Add member-facing OTP/magic-link authentication for `/member-portal/[caseId]`.
4. **Phase 4 — Documentation & Test Cleanup**
   - Consolidate overlapping health-equity unit tests and mark `docs/architecture/` as the single source of truth for system architecture.
