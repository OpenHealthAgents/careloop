# CareLoop Deployment Guide (`DEPLOYMENT.md`)

## 1. Runtime Topology & Requirements

- **Application Tier:** Stateless Next.js 15 Node.js runtime (`npm run build && npm run start`). Terminate TLS/HTTPS 1.2+ at an upstream load balancer or reverse proxy (ALB / Nginx / Cloudflare / Cloud Run).
- **Database Tier:** Managed PostgreSQL 15+ with TLS enforced (`sslmode=require`), automated encrypted daily snapshots, point-in-time recovery (PITR), and connection pooling (`PgBouncer` / RDS Proxy) for multi-instance deployments.
- **Secret Management:** Inject `AUTH_SECRET`, `DATABASE_URL`, and optional `OPENAI_API_KEY` via cloud secret manager / runtime environment variables — never commit `.env` secrets to Git.

---

## 2. Production Environment Variables

| Variable | Required in Prod | Safe Production Setting |
| :--- | :---: | :--- |
| `NODE_ENV` | Yes | `"production"` |
| `DATABASE_URL` | Yes | Encrypted PostgreSQL URI with `sslmode=require` |
| `AUTH_SECRET` | Yes | Randomly generated `>= 32` byte secret (`openssl rand -base64 32`). App blocks startup (`503`) in production if omitted or left at dev default |
| `APP_DEMO_MODE` | Yes | `"false"` (disables quick-login demo cards and prefilled demo passwords on `/login`) |
| `AI_PROVIDER_MODE` | Yes | `"deterministic"` (offline rules engine) or `"openai"` |
| `OPENAI_API_KEY` | When `openai` | Secret manager reference; requires executed BAA before sending any PHI/derived summaries |
| `COMMUNICATION_DELIVERY_MODE` | Yes | `"mock"` until Twilio/SES BAAs & adapter credentials are provisioned; `"live"` requires `ALLOW_LIVE_COMMUNICATIONS="true"` |
| `LOG_LEVEL` | No | `"info"` or `"warn"` |

---

## 3. Release & Migration Sequence

```bash
# 1. Install locked production dependencies
npm ci

# 2. Generate Prisma Client
npm run db:generate

# 3. Apply pending SQL migrations (zero schema push in prod)
npm run db:migrate

# 4. Build optimized production bundle
npm run build

# 5. Start server & verify /api/health returns 200
npm run start
```

- **Zero-Downtime Migration Practice:** Expand-and-contract additive columns first (`prisma/migrations/*`), deploy application code, then drop deprecated columns in a follow-up release.
- **Staging Verification:** Always run `npm run demo:setup` on an isolated staging DB (never run `db:seed` against production customer data, as seed resets `horizon-bh` & `pacific-medicare`).

---

## 4. Production Readiness Risk Register (Remaining Infra / Legal / Operational Controls)

| Severity | Area | Status & Required Action Beyond Application Code |
| :--- | :--- | :--- |
| **CRITICAL** | **Vendor BAAs & PHI Egress** | Application enforces deterministic offline mode by default; **do not** enable external `AI_PROVIDER_MODE="openai"` or live SMS/email adapters until signed Business Associate Agreements (BAAs) and zero-data-retention policies are executed. |
| **CRITICAL** | **DB Encryption at Rest & Column KMS** | PostgreSQL schema stores operational/PHI columns cleanly scoped by tenant, but **disk-level AES-256 encryption + KMS / `pgcrypto` field encryption + TLS DB transport** must be provisioned by infrastructure. |
| **HIGH** | **Gateway Rate Limiting & WAF** | Login/API endpoints audit `USER_LOGIN_FAILED`, but distributed brute-force rate limiting, IP throttling, and Web Application Firewall (WAF) rules must be enabled at the ingress proxy/CDN. |
| **HIGH** | **Immutable Off-Site SIEM & WORM Audits** | Application writes PHI-masked `AuditEvent` rows to PostgreSQL; production healthcare operations require shipping structured logs to an immutable SIEM and restricting PostgreSQL roles (`INSERT`-only on `AuditEvent` / `AIExecution`). |
| **HIGH** | **Automated Data Retention Purge Job** | Tenant retention policies (`365–3650` days) are configurable and audited in `Tenant.settings`, but an external scheduled worker must enforce retention purging + legal holds. |
| **MEDIUM** | **Multi-Instance Connection Pooling & Caching** | Configure `PgBouncer` transaction pooling and monitor `prisma` connection limits across horizontally scaled containers. |
| **LOW** | **Member Self-Authentication (OTP / Magic Link)** | Member portal currently operates via tenant-scoped review routes; external public member sign-in requires SMS/email OTP + MFA token adapter integration. |
