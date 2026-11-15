# CareLoop REST API Reference (`API.md`)

All endpoints under `/api/*` enforce JSON `Cache-Control: no-store`, strict Zod schema validation, uniform error serialization (`toErrorResponse`), and server-derived `session.tenantId` scoping. Except `/api/health`, `/api/auth/login`, `/api/auth/logout`, and `/api/auth/me`, every endpoint requires an active `careloop_session` cookie verified by middleware and DB-backed `UserSession` lookup.

---

## 1. Authentication & System Health

| Method & Path | Permission | Purpose |
| :--- | :--- | :--- |
| `GET /api/health` | Public | Liveness & PostgreSQL connectivity (`SELECT 1`); returns `200 ok` or `503 degraded` |
| `POST /api/auth/login` | Public | Authenticates email/password/tenantSlug (`scryptSync`), creates `UserSession` row, sets `HttpOnly` cookie, logs `USER_LOGIN` or `USER_LOGIN_FAILED` |
| `POST /api/auth/logout` | Session | Revokes active `UserSession` (`revokedAt`) and clears cookie |
| `GET /api/auth/me` | Session | Returns authenticated user profile, tenant slug, and granted permissions |

---

## 2. Referral Intake & Member Directory

| Method & Path | Permission | Purpose |
| :--- | :--- | :--- |
| `GET /api/referrals` | `referrals.read` | Lists tenant referrals (`take: 250`) ordered by `referralDate desc` |
| `POST /api/referrals` | `referrals.manage` | Validates single referral payload (`CsvReferralRowSchema`) and initiates case + AI triage |
| `POST /api/referrals/ingest/preview` | `referrals.manage` | Parses & validates CSV (`<= 5 MB`) into `readyRows`, `duplicateRows`, and `errors` without writing DB |
| `POST /api/referrals/ingest` | `referrals.manage` | Confirms CSV batch (`<= 5 MB`), preserves valid rows, records `IngestionBatch`, emits `REFERRAL_BATCH_INGESTED` |
| `GET /api/referrals/ingest/[batchId]/failed-rows` | `referrals.read` | Exports formula-sanitized CSV of failed/duplicate ingestion rows; writes `ACCESS_LOG` audit event |
| `GET /api/members` | `members.read` | Lists tenant members (`take: 250`); writes `MEMBER_DIRECTORY_VIEWED` `ACCESS_LOG` audit event |

---

## 3. Care Manager Case Workspace

| Method & Path | Permission | Purpose |
| :--- | :--- | :--- |
| `GET /api/cases` | `cases.read` | Filterable case worklist (`status`, `riskTier`, `humanReviewOnly`, `search`, default `take: 250`) |
| `GET /api/cases/[id]` | `cases.read` | Central case workspace payload + ranked providers + allowed transitions + `orchestratorDecision` + structured `caseMemory`; logs `CASE_PHI_VIEWED` `ACCESS_LOG` |
| `POST /api/cases/[id]/transition` | `cases.manage` (plus `cases.escalate` for `ESCALATED`) | Enforces valid state transitions (`409` if invalid); writes `WorkflowEvent` & `AuditEvent` |
| `POST /api/cases/[id]/ai-assess` | `ai.run` | Re-runs non-binding AI risk, barrier, provider match & intervention recommendations |
| `GET/POST /api/cases/[id]/barriers` | `cases.read` / `cases.manage` | Lists barriers or records human-confirmed barrier (`FACT`) |
| `POST /api/barriers/[id]/review` | `cases.manage` | Care team accepts, rejects, modifies, or marks barrier `UNKNOWN` |
| `GET/POST /api/cases/[id]/notes` | `cases.read` / `cases.manage` | Lists or appends coordination/escalation/closure notes (`content` 3–4000 chars) |
| `GET/POST /api/cases/[id]/outreach` | `cases.read` / `outreach.send` | Generates consent-checked supportive outreach (`SIMPLE`/`PLAIN`/`STANDARD`) or dispatches mock/configured delivery |

---

## 4. Interventions, Providers, Appointments & Verification

| Method & Path | Permission | Purpose |
| :--- | :--- | :--- |
| `GET /api/interventions` | `interventions.read` | Lists tenant interventions (`take: 250`) with outcomes and `AIRecommendation` origin |
| `POST /api/interventions/[id]/review` | `interventions.approve` / `interventions.execute` | Approves, modifies, rejects, starts, completes, or fails interventions with `AuditEvent` state diffs |
| `POST /api/interventions/[id]/execute` | `interventions.execute` | Executes eligible low/medium-risk `AUTOMATED` intervention; blocks `HIGH` risk or `HUMAN_ONLY` (`400`) |
| `GET/POST /api/interventions/[id]/outcomes` | `interventions.read` / `interventions.execute` | Records structured outcome (`barriersResolved`, `followUpRequired`, notes) |
| `GET/POST /api/providers` | `providers.read` / `providers.manage` | Lists or adds network providers with NPI & availability classification |
| `POST /api/providers/search` | `providers.read` | Ranks in-network candidates (`MatchProviderResult`) separating `VERIFIED AVAILABILITY` from `DIRECTORY DATA` |
| `POST /api/providers/[id]/availability` | `providers.manage` | Publishes verified `ProviderAvailability` slots or updates directory refresh timestamps |
| `GET /api/appointments` | `appointments.read` | Lists tenant appointments (`take: 250`) with verification linkage |
| `POST /api/cases/[id]/appointments` | `appointments.manage` | Schedules appointment; rejects `NOT_AVAILABLE` / closed providers (`400`) |
| `PATCH /api/appointments/[id]` | `appointments.manage` | State-machine transitions (`SCHEDULE`, `CONFIRM`, `RESCHEDULE`, `COMPLETE`, `NO_SHOW`, `CANCEL`, `MARK_UNKNOWN`, `SEND_REMINDER`) |
| `GET/POST /api/cases/[id]/verifications` | `cases.read` / `completion.verify` | Records completion verification signal (`PROVIDER_CONFIRMATION`, `MEMBER_CONFIRMATION`, `CLAIM_RECEIVED`, etc.) and optional close |

---

## 5. Member Experience, Analytics & Administration

| Method & Path | Permission | Purpose |
| :--- | :--- | :--- |
| `GET /api/member-portal/[caseId]` | `cases.read` | Supportive plain-language portal payload (strips internal risk scores & AI reasoning); logs `ACCESS_LOG` |
| `POST /api/member-portal/[caseId]/actions` | `cases.manage` / `appointments.manage` | Handles member provider selection, scheduling request, rescheduling, communication preferences, and assistance requests |
| `GET /api/dashboard` | `dashboard.read` | Executive dashboard volume, conversion, efficiency, outcome & equity KPIs with row-level reconciliation |
| `GET /api/analytics/equity` | `equity.read` | Disparity metrics across demographic cohorts, small-sample (`n < 5`) cautions & cohort comparison |
| `GET /api/audit-logs` | `audit.read` | Lists up to 150 PHI-redacted `AuditEvent` rows; logs `AUDIT_LOG_VIEWED` `ACCESS_LOG` |
| `GET/PATCH /api/settings` | `settings.read` / `tenant.manage` | Reads/updates thresholds, data retention days (`365–3650`), and `sessionMaxAgeHours` (`1–24`) |
| `GET/POST/PATCH /api/users` | `users.manage` | Tenant user directory & role lifecycle (blocks admin self-demotion/self-deactivation; revokes sessions on deactivate) |

---

## 6. Standard Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR | AUTHENTICATION_ERROR | AUTHORIZATION_ERROR | NOT_FOUND | INVALID_STATE_TRANSITION | CONFLICT | INTERNAL_ERROR",
    "message": "Human-readable safe error explanation (no stack trace in production)",
    "correlationId": "request-correlation-uuid"
  }
}
```
HTTP mappings: `400` (`VALIDATION_ERROR`), `401` (`AUTHENTICATION_ERROR`), `403` (`AUTHORIZATION_ERROR`), `404` (`NOT_FOUND`), `409` (`INVALID_STATE_TRANSITION`, `CONFLICT`), `500` (`INTERNAL_ERROR`), `503` (`CONFIGURATION_ERROR` / degraded health).
