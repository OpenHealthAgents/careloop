# CareLoop — Current State Architecture Audit

**Audit Date:** 2026-11-12  
**Repository:** `d:\Kalyan\CareLoop` (`careloop@0.1.0`)

---

## 1. Technology Stack Summary

| Dimension | Current Implementation |
| :--- | :--- |
| **Framework** | Next.js `^15.3.2` (App Router, React `^19.1.0`) |
| **Language** | TypeScript `^5.8.3` (`tsc --noEmit` strict typecheck) |
| **Frontend** | Next.js Server Components + React Client Components (`src/app/**`, `src/components/**`), Tailwind CSS `^4.1.7`, `lucide-react` `^0.511.0` |
| **Backend** | Next.js App Router Route Handlers (`src/app/api/**/route.ts`) backed by Service Layer (`src/services/*`), Repository Layer (`src/repositories/*`), and Pure Domain Layer (`src/domain/*`) |
| **Database** | PostgreSQL with Prisma ORM (`@prisma/client` / `prisma` `^6.8.2`), schema in `prisma/schema.prisma`, 16 SQL migrations in `prisma/migrations/*` |
| **Authentication & RBAC** | Signed HMAC-SHA256 session cookie (`careloop_session`, 12h TTL) + database-backed `UserSession` (`src/lib/auth/session.ts`, `edge-token.ts`), Edge `middleware.ts`, and permission-based RBAC (`src/lib/auth/rbac.ts`, `request-context.ts`, `page-session.ts`) |
| **API Architecture** | RESTful JSON HTTP endpoints under `/api/**` (47 `route.ts` files), Zod input validation, centralized `toErrorResponse` error handling (`src/lib/errors.ts`) |
| **Agent / AI Infrastructure** | Dual-mode `AIProvider` (`DeterministicAIProvider` and `ExternalOpenAIProvider` with BAA/key fallback), `CareLoopCaseOrchestrator`, declarative `policy-engine.ts` + `policy-guard.ts`, typed `tool-registry.ts`, `tool-executor.ts`, versioned `prompts/registry.ts`, `evaluation.ts` |
| **Testing Framework** | Vitest `^3.1.4` (`vitest.config.ts`, `environment: "node"`, `fileParallelism: false`): 42 test files / 102 tests across `tests/unit`, `tests/integration`, `tests/api`, `tests/security`, and `tests/e2e` |
| **Deployment Infrastructure** | Stateless Node.js runtime (`npm run build && npm run start`), `DEPLOYMENT.md` topology (upstream TLS reverse proxy, managed PostgreSQL 15+ with `sslmode=require`, `PgBouncer`, `npm run db:migrate`); no Dockerfile/IaC committed in repo |
| **Environment Configuration** | Validated at startup via Zod in `src/lib/config.ts` (`DATABASE_URL`, `AUTH_SECRET`, `PHI_ENCRYPTION_KEY`, `AI_PROVIDER_MODE`, `AI_MODEL_NAME`, `AI_VENDOR_NAME`, `AI_BAA_EXECUTED`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LOG_LEVEL`, `NODE_ENV`, `COMMUNICATION_DELIVERY_MODE`, `ALLOW_LIVE_COMMUNICATIONS`, `APP_DEMO_MODE`) |
| **Existing Integrations** | Adapter-based boundaries: CSV & FHIR referral ingestion (`src/adapters/csv-referral-parser.ts`, `fhir-ingestion-adapter.ts`), communication channel registry (`src/adapters/communication/channel-registry.ts`) with mock/dev delivery (`src/adapters/dev-adapters.ts`), and OpenAI-compatible HTTP provider (`src/ai/external-provider.ts`) gated by `AI_BAA_EXECUTED` |

---

## 2. Existing Domain Models (`prisma/schema.prisma`)

CareLoop's PostgreSQL schema defines **30 models** across tenant isolation, identity, care execution, governance, observability, and learning:

- **Multi-Tenancy & Identity:** `Tenant`, `Role`, `User`, `UserSession`
- **Member & Consent:** `Member`, `Consent`
- **Referral & Provider Network:** `IngestionBatch`, `Referral`, `Provider`, `ProviderAvailability`
- **Case Execution:** `Case`, `Barrier`, `RiskAssessment`, `AIRecommendation`, `Intervention`, `InterventionOutcome`, `Communication`, `Appointment`, `CompletionVerification`, `CaseNote`
- **Governance, Audit & Agentic Telemetry:** `WorkflowEvent`, `AuditEvent`, `EquityMetric`, `Notification`, `ApprovalRequest`, `ExecutionJournalEvent`, `AIDecisionTrace`, `AgentRun`, `ToolExecutionSpan`, `ExecutionLearningRecord`

---

## 3. Existing Agent / AI Infrastructure (`src/ai/*`, `src/services/*`)

- **Typed Tool Registry (`src/ai/tool-registry.ts`):** Defines typed tools with `name`, `description`, `input_schema`, `output_schema`, `risk_level`, `permissions`, `side_effects`, `idempotency_strategy`, `timeout`, `retry_policy`, `audit_event_type`, and `human_approval_requirement`.
- **Tool Execution Contract (`src/services/tool-executor.ts`):** Enforces input validation → RBAC authorization → case state validation → policy engine → consent/privacy checks → idempotency → execution → output validation → evidence & audit recording → observability span → execution journal → state transition.
- **Declarative Policy Engine (`src/ai/policy-engine.ts`, `src/ai/policy-guard.ts`):** Evaluates declarative rules (`ALLOW`, `DENY`, `REQUIRE_HUMAN_APPROVAL`) before any tool execution or orchestrator state transition.
- **Human Approval Engine (`src/services/approval-service.ts`, `/api/approvals/[approvalId]/decide`, `/api/approvals/[approvalId]/resume`):** Persists `ApprovalRequest` (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`) and supports resuming agent execution from persisted state after approval.
- **Execution Journal (`src/services/execution-journal-service.ts`, `ExecutionJournalEvent`):** Records structured step-by-step execution events with `correlationId`, `actorType`, `policyDecision`, and `evidence`.
- **AI Decision Trace (`src/services/decision-trace-service.ts`, `AIDecisionTrace`):** Stores `agent`, `model`, `promptVersion`, `inputContextHash`, `decision`, `confidence`, `evidence`, `policyResult`, `toolSelected`, and `humanApprovalRequired` without storing raw chain-of-thought.
- **Observability (`src/services/observability-service.ts`, `AgentRun`, `ToolExecutionSpan`):** Tracks `latencyMs`, `promptTokens`, `completionTokens`, `totalTokens`, `retryCount`, tool spans, approval wait time, and success rates.
- **Learning Loop (`src/services/learning-loop-service.ts`, `ExecutionLearningRecord`):** Captures `context → barrier → intervention → execution strategy → outcome` records.
- **Agent Evaluation Framework (`src/ai/evaluation.ts`, `src/services/evaluation-service.ts`, `/api/analytics/evaluation`, `AgentEvaluationPanel.tsx`):** Runs a 10-case golden benchmark suite across orchestration, policy safety, barrier classification, risk scoring, and intervention recommendations alongside live tenant telemetry.

---

## 4. API Architecture (`src/app/api/**`)

47 Next.js App Router route handlers grouped by domain:
- **Auth & Users:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/users`, `/api/settings`, `/api/settings/retention/enforce`
- **Ingestion & Network:** `/api/referrals`, `/api/referrals/ingest`, `/api/referrals/ingest/preview`, `/api/referrals/ingest/[batchId]/failed-rows`, `/api/members`, `/api/providers`, `/api/providers/search`, `/api/providers/[id]/availability`
- **Cases & Agentic Execution:** `/api/cases`, `/api/cases/[id]`, `/api/cases/[id]/ai-assess`, `/api/cases/[id]/transition`, `/api/cases/[id]/barriers`, `/api/cases/[id]/interventions`, `/api/cases/[id]/appointments`, `/api/cases/[id]/outreach`, `/api/cases/[id]/verifications`, `/api/cases/[id]/notes`, `/api/cases/[id]/approvals`, `/api/cases/[id]/journal`, `/api/cases/[id]/decision-traces`, `/api/cases/[id]/trace`, `/api/cases/[id]/learning`
- **Human Gates & Reviews:** `/api/approvals/[approvalId]/decide`, `/api/approvals/[approvalId]/resume`, `/api/barriers/[id]/review`, `/api/interventions`, `/api/interventions/[id]/review`, `/api/interventions/[id]/execute`, `/api/interventions/[id]/outcomes`, `/api/appointments`, `/api/appointments/[id]`
- **Member Portal & Analytics:** `/api/member-portal/[caseId]`, `/api/member-portal/[caseId]/actions`, `/api/dashboard`, `/api/analytics/equity`, `/api/analytics/observability`, `/api/analytics/learning`, `/api/analytics/evaluation`, `/api/audit-logs`, `/api/health`
