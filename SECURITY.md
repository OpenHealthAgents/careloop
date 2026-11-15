# CareLoop Security & Safety Architecture (`SECURITY.md`)

> **Important Scope Notice:** Technical safeguards documented in this file implement defense-in-depth operational security and AI safety controls for the CareLoop MVP. **Implementation of these controls does not represent HIPAA certification, HITRUST certification, SOC 2 attestation, or legal/regulatory compliance**, which require organizational policies, Business Associate Agreements (BAAs), infrastructure hardening, independent audits, and legal review outside application source code.

---

## 1. Architecture Overview & Trust Boundaries

CareLoop is a multi-tenant, server-rendered Next.js + PostgreSQL + Prisma behavioral-health care coordination platform with four primary trust boundaries:

1. **Edge & HTTP Middleware (`src/middleware.ts`)**
   - Rejects unauthenticated requests to `/api/*` (except `/api/health`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`) with HTTP `401`.
   - Redirects unauthenticated browser page requests to `/login`.
   - Sets defensive HTTP headers across routes (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Cache-Control: no-store, max-age=0` + `Pragma: no-cache` on `/api/*` responses).
2. **Server-Side Session Verification & RBAC (`src/lib/auth/*`)**
   - Cookie tokens (`careloop_session`) use `httpOnly`, `sameSite=lax`, `secure` in production, and HMAC-SHA256 signatures verified via `crypto.timingSafeEqual`.
   - Every authenticated API request resolves against a persistent `UserSession` row (`src/lib/auth/session.ts`) checking `revokedAt === null`, `expiresAt > now`, `user.active === true`, and `user.tenantId === token.tenantId`.
   - Authorization uses explicit least-privilege permissions (`src/lib/auth/rbac.ts`) across `ADMIN`, `CARE_MANAGER`, `OPERATIONS`, `EXECUTIVE_READ_ONLY`, `HEALTH_EQUITY`, and `SYSTEM` service accounts.
3. **Tenant-Isolated Data Access (`src/services/*`, `src/repositories/*`)**
   - Every query, mutation, referral ingestion batch, provider search, equity report, and member-portal lookup scopes strictly by `session.tenantId`. Client-supplied `tenantId` fields are ignored or rejected; cross-tenant IDOR attempts return `404 NotFoundError` without leaking record existence.
4. **Constrained AI Orchestration Boundary (`src/ai/*`)**
   - AI providers cannot read or write the database directly.
   - All outputs must pass Zod strict schema validation (`src/ai/schemas.ts`), deterministic policy guards (`src/ai/policy-guard.ts`), and versioned prompt contracts (`src/ai/prompts/registry.ts`).

---

## 2. Core Security Controls

| Control | Implementation | Files |
|---|---|---|
| **Password Hashing** | Per-user salt `scrypt` via Node `crypto.scryptSync` + constant-time `timingSafeEqual` verification | [`password.ts`](file:///d:/Kalyan/CareLoop/src/lib/auth/password.ts) |
| **Session Revocation** | Server-side `UserSession` records revoked on logout and user deactivation; configurable max session hours (`1–24h`) per tenant | [`session.ts`](file:///d:/Kalyan/CareLoop/src/lib/auth/session.ts), [`login/route.ts`](file:///d:/Kalyan/CareLoop/src/app/api/auth/login/route.ts) |
| **RBAC & Self-Protection** | Permission checks via `requireRequestContext(request, permission)` on all protected routes; admins blocked from self-demotion or self-deactivation | [`request-context.ts`](file:///d:/Kalyan/CareLoop/src/lib/auth/request-context.ts), [`users/route.ts`](file:///d:/Kalyan/CareLoop/src/app/api/users/route.ts) |
| **Audit Trail (`AuditEvent`)** | Persists `actorId`, `actorEmail`, `actorRole`, `action`, `entityType`, `entityId`, `previousState`, `newState`, `source`, `correlationId`, `tenantId`, and timestamp | [`schema.prisma`](file:///d:/Kalyan/CareLoop/prisma/schema.prisma), [`audit-service.ts`](file:///d:/Kalyan/CareLoop/src/services/audit-service.ts) |
| **Access Logging** | Records `source="ACCESS_LOG"` audit events on sensitive PHI reads (`/api/cases/[id]`, `/api/members`, `/api/member-portal/[caseId]`, `/api/audit-logs`, failed-row CSV exports) | [`audit-service.ts`](file:///d:/Kalyan/CareLoop/src/services/audit-service.ts) |
| **PHI-Minimized Logging** | Redacts credentials, cookies, tokens, SSNs, phones, emails, addresses, draft outreach text, and operational notes before writing logs or `AuditEvent` records | [`logger.ts`](file:///d:/Kalyan/CareLoop/src/lib/logger.ts), [`governance-repository.ts`](file:///d:/Kalyan/CareLoop/src/repositories/governance-repository.ts) |
| **Input & Export Sanitization** | Strict Zod schemas on every API route; CSV export formula-injection prefix neutralization (`sanitizeCsvCellForExport`) | [`csv-referral-parser.ts`](file:///d:/Kalyan/CareLoop/src/adapters/csv-referral-parser.ts) |
| **State Machine Integrity** | Explicit valid transitions enforced on `CaseStatus` and `AppointmentStatus`; arbitrary transitions return `409 InvalidStateTransitionError` | [`state-machine.ts`](file:///d:/Kalyan/CareLoop/src/domain/cases/state-machine.ts), [`appointments/state-machine.ts`](file:///d:/Kalyan/CareLoop/src/domain/appointments/state-machine.ts) |
| **Consent & Outbound Guard** | `Member.consentOutreach` and `Member.consentSms` verified before dispatch; outbound text validator strips/rejects clinical diagnoses, prescriptions, internal risk scores, and AI reasoning | [`validator.ts`](file:///d:/Kalyan/CareLoop/src/domain/communications/validator.ts), [`communications.ts`](file:///d:/Kalyan/CareLoop/src/services/case-service.ts) |
| **Data Retention Policy** | Tenant-configurable retention bounds (`auditLogRetentionDays` 365–3650, `clinicalOperationalRetentionDays` 365–3650, `aiTraceRetentionDays` 90–3650, `communicationRetentionDays` 90–3650) with UI management | [`settings/route.ts`](file:///d:/Kalyan/CareLoop/src/app/api/settings/route.ts), [`SettingsClient.tsx`](file:///d:/Kalyan/CareLoop/src/components/SettingsClient.tsx) |

---

## 3. AI Workflow Safety Invariants

Every AI task passes through `src/ai/policy-guard.ts` before application logic can persist an `AIExecution` trace or apply non-binding recommendations:

1. **No Autonomous Clinical Decisions:** `assertNoClinicalAdvice` rejects diagnosis, prescribing, dosage, clinical psychotherapy instructions, or emergency medical triage instructions across risk scores, barriers, interventions, communications, and summaries.
2. **No Fabricated Patient Facts:** `enforceBarrierPolicy` rejects any AI output attempting to assert `epistemicStatus: "FACT"` (only human care managers may verify barriers to `FACT`), and rejects non-`UNKNOWN` barrier classifications lacking concrete `evidenceSignals`.
3. **No Protected Characteristics in Individual Risk Decisions:** `enforceRiskPolicy` rejects risk score inputs/explanations citing protected demographic traits (`race`, `ethnicity`, `gender`, etc.); equity attributes are reserved strictly for aggregate cohort monitoring (`src/services/equity-service.ts`).
4. **No Fabricated Provider Availability:** `enforceProviderMatchPolicy` distinguishes `DIRECTORY DATA` from `VERIFIED AVAILABILITY`, rejecting outputs that misrepresent directory entries or `NOT_AVAILABLE` providers as `VERIFIED AVAILABILITY` or attempt to book unavailable providers.
5. **No Fabricated Care Completion:** Care completion requires explicit verification signals (`CompletionVerification` + appointment state machine); `enforceCaseSummaryPolicy` rejects completion claims when no verified visit exists. `AppointmentStatus.COMPLETED` is never assumed solely from `SCHEDULED`.
6. **Mandatory Human Approval Gate:** High-risk interventions and `HUMAN_ONLY` actions (`HUMAN_OUTREACH`, `ESCALATION`) cannot be classified `AUTOMATED` or `automationEligible: true`; `executeAutomatedIntervention` blocks execution unless `executionMode === "AUTOMATED"` and human approval requirements are satisfied.

---

## 4. Verification Coverage

Security and safety assertions are verified automatically in [`tests/security/security-and-safety.test.ts`](file:///d:/Kalyan/CareLoop/tests/security/security-and-safety.test.ts) and [`tests/unit/`](file:///d:/Kalyan/CareLoop/tests/unit/) / [`tests/api/api-routes.test.ts`](file:///d:/Kalyan/CareLoop/tests/api/api-routes.test.ts), covering:
- Unauthenticated `401` API rejection & tampered session cookies
- Least-privilege RBAC `403` across `EXECUTIVE_READ_ONLY`, `HEALTH_EQUITY`, and `CARE_MANAGER`
- Privilege escalation prevention & admin self-demotion/self-deactivation guards
- Cross-tenant & IDOR `404` isolation across cases, notes, outreach, interventions, appointments, member portal, users, and forged `tenantId` payloads
- Invalid workflow/appointment state transitions (`409`)
- CSV formula injection, Zod bounds rejection, member-message leak rejection, and non-leaky `USER_LOGIN_FAILED` auditing
- PHI redaction in structured logs, access logs (`source: "ACCESS_LOG"`), and `previousState`/`newState` audit diffs
- All 6 AI safety policy guards

---

## 5. Known MVP Limitations

The following architectural items are intentionally scoped for the local/MVP stage and **must** be addressed before production deployment in regulated healthcare environments:

1. **No Automated Data Purge Worker:** Tenant retention intervals are validated, stored, and audited on `Tenant.settings`, but automated scheduled purge/archival jobs (including legal-hold exceptions) are not bundled in the web process.
2. **Database-Level Immutability & KMS Encryption:** PostgreSQL rows for `AuditEvent` and `AIExecution` do not yet enforce WORM triggers/append-only DB roles, encrypted object archival, or customer-managed KMS envelope encryption (`pgcrypto` / cloud KMS) for field-level PHI columns.
3. **Rate Limiting & Brute-Force Lockout:** Authentication endpoints audit failed sign-ins (`USER_LOGIN_FAILED`), but distributed IP/account rate limiting and temporary account lockout require an external gateway (WAF / Redis limiter).
4. **TLS Termination & CSP:** Production TLS termination, HSTS, and strict per-request nonce Content Security Policy headers must be enforced at the reverse proxy / hosting layer.
5. **External Delivery Providers & BAAs:** Development builds default SMS/email adapters to mock/no-op mode; production Twilio/SES/EHR/LLM credentials require signed vendor BAAs and secret manager integration rather than `.env` files.
6. **Direct Member Self-Auth:** Member portal flows currently validate tenant-scoped care-case access via authenticated staff/portal preview sessions; standalone passwordless member magic-link / OTP verification is scoped as a production adapter extension.

---

## Cryptographic, Vendor/BAA, PHI Minimization & Retention Controls

- **Encryption at Rest (`src/lib/security/encryption.ts`):** `encryptAtRest` and `decryptAtRest` implement authenticated AES-256-GCM envelope encryption (`v1:<iv>:<authTag>:<ciphertext>`) keyed via SHA-256 over `PHI_ENCRYPTION_KEY` (or dev/test `AUTH_SECRET`).
- **Encryption in Transit & Vendor/BAA Boundaries (`src/lib/security/transport.ts`, `src/lib/config.ts`):** `assertSecureTransportUrl` enforces HTTPS for external vendor endpoints, and `assertVendorBaaBoundary` blocks external LLM calls when `AI_BAA_EXECUTED` is not attested in production.
- **LLM PHI Minimization (`src/lib/security/phi-minimization.ts`, `src/ai/external-provider.ts`):** `minimizePayloadForLLM` strips direct patient identifiers (`firstName`, `lastName`, `email`, `phone`, `ssn`, `dob`, `externalMemberId`, `memberId`, etc.) and redacts inline emails, phone numbers, and SSNs before external LLM requests. `redactSecrets` scrubs bearer tokens, API keys, and DB credentials from logs/errors.
- **Configurable Retention (`src/services/retention-service.ts`, `POST /api/settings/retention/enforce`):** `enforceTenantRetentionPolicy` enforces per-tenant `aiTraceRetentionDays`, `communicationRetentionDays`, and `sessionMaxAgeHours` while preserving immutable `AuditEvent` logs for `auditLogRetentionDays`.
