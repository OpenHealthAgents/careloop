# CareLoop Operations Runbook (`OPERATIONS.md`)

## 1. Health Checks & Monitoring

- **Health / Readiness Endpoint:** `GET /api/health` (`Cache-Control: no-store`) executes `SELECT 1` against PostgreSQL and returns:
  - `200 OK`: `{ "status": "ok", "database": "connected", "uptimeSeconds": ..., "timestamp": "..." }`
  - `503 Service Unavailable`: `{ "status": "degraded", "database": "unreachable", ... }`
- **Structured Application Logs (`src/lib/logger.ts`)**: JSON lines written to `stdout` / `stderr` with `timestamp`, `level`, `event`, `tenantId`, `actorId`, `correlationId`, and PHI-redacted `meta` (`[REDACTED_PHI_OR_SECRET]`, `[REDACTED_SSN]`, `[REDACTED_PHONE]`). Route via container log collector (CloudWatch / Datadog / Splunk) and correlate incidents by `correlationId` (`x-correlation-id` header).
- **Recommended Production Alerts:**
  - `GET /api/health != 200` for > 30s
  - Spike in `statusCode >= 500` or `CONFIGURATION_ERROR` (`503`)
  - Spike in `AuditEvent` where `action = "USER_LOGIN_FAILED"` (potential credential stuffing)
  - Elevated `ai.external_call_failed_fallback` warnings (external LLM schema/latency degradation)
  - Growing count of `ESCALATED` cases exceeding tenant `slaHoursExpedited` / `slaHoursRoutine`

---

## 2. Backups & Disaster Recovery

CareLoop itself does not schedule filesystem backups inside the Node.js process. Infrastructure operators must configure:
1. **Automated PostgreSQL Snapshots:** Daily encrypted snapshots retained per organizational policy (`>= 30 days`) + continuous WAL archiving for PITR (`RPO <= 5 minutes`).
2. **Quarterly Restore Drills:** Restore latest snapshot into an isolated staging DB, run `npm run db:migrate`, verify row counts across `Tenant`, `Case`, `Appointment`, and `AuditEvent`, and verify `/api/health`.
3. **Configuration Secret Backups:** Store `AUTH_SECRET` in versioned cloud secret manager; note that rotating `AUTH_SECRET` invalidates existing `careloop_session` cookies (users simply re-authenticate cleanly).

---

## 3. Data Retention & Access Governance

- Tenant administrators configure retention windows in `/settings` (`PATCH /api/settings`):
  - `auditLogRetentionDays` (`365–3650`, default `2555` / 7 years)
  - `clinicalOperationalRetentionDays` (`365–3650`, default `2555`)
  - `aiTraceRetentionDays` (`90–3650`, default `1095`)
  - `communicationRetentionDays` (`90–3650`, default `1095`)
  - `sessionMaxAgeHours` (`1–24`, default `12`)
- **Session Revocation:** Deactivating a user in `/settings` (`PATCH /api/users` with `active: false`) immediately revokes all active `UserSession` rows in PostgreSQL. Signing out (`POST /api/auth/logout`) revokes the current `UserSession` row immediately.

---

## 4. Incident Response Checklist

1. **Suspected Unauthorized Account / Compromise:** Deactivate user via `/api/users` (`active: false`) → query `/api/audit-logs` & `AuditEvent` filtering by `actorId` and `source = "ACCESS_LOG"` → inspect `correlationId` trace in structured logs.
2. **Upstream AI Schema Drift:** Set `AI_PROVIDER_MODE="deterministic"` immediately to route all triage cleanly through deterministic rules without downtime, inspect failed `AI_VALIDATION` alerts, then re-enable once verified.
