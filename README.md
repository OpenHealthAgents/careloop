# CareLoop

> **Turning healthcare recommendations into completed care.**

**CareLoop** is an AI-powered healthcare execution platform initially targeting:
- Health plans (Medicaid MCOs, Medicare Advantage, commercial plans)
- Risk-bearing healthcare organizations
- Care-management organizations
- Health-equity teams
- Healthcare operations teams

**Initial Use Case:** Behavioral-health referral and treatment completion across the measurable end-to-end execution chain:
`Referral → Provider Match → Appointment → Multi-Signal Completion Verification → First Completed Visit`

**Long-Term Vision:** An AI-powered healthcare execution layer built to extend over time into preventive screening, specialty care, chronic disease care, post-discharge follow-up, and other healthcare journeys where need is identified but completion remains difficult.

> **Operational Boundary:** CareLoop is a non-clinical care coordination platform. It does **not** diagnose conditions, recommend medication, deliver psychotherapy, manage emergency crisis workflows, or make autonomous clinical decisions.

---

## Quick Start (One-Command Demo Setup)

**Prerequisites:** Node.js 20+ and PostgreSQL 15+.

```bash
cp .env.example .env
npm install
npm run demo:setup
npm run dev
```

Open `http://localhost:3000` (unauthenticated requests redirect cleanly to `/login`).

---

## Demo Credentials

Primary demo tenant: **`horizon-bh`** (`Horizon Behavioral Health Plan`) — password: **`CareLoopDemo2026!`**

| Role | Email | Tenant Slug | Access Summary |
| :--- | :--- | :--- | :--- |
| `CARE_MANAGER` | `care.manager@careloop.demo` | `horizon-bh` | Triage worklist, case workspace, barrier confirmation, intervention approval, scheduling & visit verification |
| `ADMIN` | `admin@careloop.demo` | `horizon-bh` | Full tenant access including Audit Logs, Data Retention Settings, RBAC Matrix, and User Management |
| `HEALTH_EQUITY` | `equity.analyst@careloop.demo` | `horizon-bh` | Cohort disparity analytics, time-to-care gaps, small-sample caution monitoring |
| `OPERATIONS` | `ops@careloop.demo` | `horizon-bh` | CSV referral ingestion, failed-row export, provider directory/slot management, outreach & appointments |
| `EXECUTIVE_READ_ONLY` | `exec@careloop.demo` | `horizon-bh` | Read-only Executive Dashboard KPIs, conversion funnel, analytics & equity views |
| `ADMIN` (Isolated) | `admin@pacific.demo` | `pacific-medicare` | Isolated second tenant demonstrating strict multi-tenant boundary enforcement |

See [`DEMO.md`](DEMO.md) for the **60-member / 80-referral / 22-provider** dataset overview and showcase referral IDs (`REF-2026-1001`, `REF-DEMO-SUCCESS-01`, `REF-DEMO-FAILED-01`, `REF-DEMO-EQUITY-01`, `REF-DEMO-SCHED-01`, `REF-DEMO-NOSHOW-01`).

---

## Key NPM Scripts

- `npm run dev` — Run local Next.js development server
- `npm run demo:setup` — Apply all Prisma migrations (`prisma migrate deploy`) and seed full synthetic demo environment
- `npm run demo:founder` — Run the 7-scene interactive founder demo runner
- `npm run lint` — Run ESLint (`eslint .`)
- `npm run typecheck` — Run strict TypeScript check (`tsc --noEmit`)
- `npm test` — Execute full Vitest unit, integration, security, AI-safety, and API E2E suite (`88` test files, `335` tests)
- `npm run build` — Build optimized production Next.js bundle

---

## Engineering & Operations Documentation Index

| Document | Audience | Contents |
| :--- | :--- | :--- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Software Engineers | Layered modular monolith, dependency rules, request trust boundaries |
| [`API.md`](API.md) | Backend & Integration | All REST API routes, RBAC permissions, request validation, error envelope |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Database & Data Eng | Normalized Prisma schema, ER diagram, tenant-scoped composite indexes |
| [`WORKFLOWS.md`](WORKFLOWS.md) | Product & Clinical Ops | Explicit Case & Appointment state machines, barrier & intervention gates, multi-signal verification |
| [`AI.md`](AI.md) | AI / ML Engineers | Provider abstraction, Zod schemas, prompt registry, epistemic & clinical safety guards |
| [`SECURITY.md`](SECURITY.md) | Security Engineering | Auth, RBAC, tenant isolation, PHI-minimized audit & access logs, security test coverage, MVP limits |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Platform / DevOps | Production env vars, fail-closed secret checks, release sequence & **Production Readiness Risk Register** |
| [`OPERATIONS.md`](OPERATIONS.md) | SRE / Operations | Health endpoint, structured logs, backups/PITR, retention configuration & incident playbooks |
| [`DEMO.md`](DEMO.md) | Sales / QA / Onboarding | One-command setup, seeded cohorts, showcase case IDs, demo credentials |
| [`ANALYTICS_METHODOLOGY.md`](ANALYTICS_METHODOLOGY.md) | Analytics & Equity | Mathematical definitions for conversion, time-to-care, and equity disparity metrics |
