# CareLoop Demonstration Guide (`DEMO.md`)

CareLoop includes a deterministic, realistic synthetic dataset designed to showcase the entire behavioral-health referral execution loop immediately on local startup.

---

## 1. One-Command Demo Setup

Ensure PostgreSQL 15+ is running and `.env` is copied from `.env.example`:

```bash
cp .env.example .env
npm install
npm run demo:setup
npm run dev
```

Open `http://localhost:3000`. All data in `horizon-bh` (`Horizon Behavioral Health Plan`) and `pacific-medicare` (`Pacific Medicare Advantage`) is 100% synthetic.

---

## 2. Seeded Dataset Scale

- **60 Synthetic Members** across 5 geographies (`Central Metro`, `East Valley`, `Westside`, `South Harbor`, `Rural North`), Urban/Suburban/Rural strata, multiple coverage types (`MEDICAID`, `MEDICARE`, `DUAL_ELIGIBLE`, `COMMERCIAL`), consent profiles, and transportation/digital access levels.
- **80 Referrals & Cases** across completed visits, active in-progress coordination, `NO_SHOW` missed appointments, unresolved referrals (`CLOSED_UNRESOLVED`), and escalated high-risk cases (`ESCALATED`).
- **22 Network Providers** spanning **6 behavioral-health specialties**, **8 languages** (`English`, `Spanish`, `Vietnamese`, `Hindi`, `Mandarin`, `Arabic`, `Tagalog`, `Portuguese`), **5 networks**, and explicit separation of `VERIFIED_AVAILABILITY` slots vs. stale `DIRECTORY_INFORMATION` vs. `NOT_AVAILABLE`.

---

## 3. Recommended Walkthrough & Showcase Scenarios

Sign in as **Care Manager** (`care.manager@careloop.demo`) or switch roles via the one-click `/login` switcher (password: **`CareLoopDemo2026!`**):

| Scenario | Referral ID | Where to Inspect |
| :--- | :--- | :--- |
| **Interactive Pending Review** | `REF-2026-1001` | Open from **Referral Worklist** (`/worklist`) to inspect pending `LANGUAGE_COMPATIBLE_PROVIDER_SEARCH` intervention, confirm barrier, approve, match Dr. Valeria Rivera, schedule telehealth visit, preview Member Portal (`/member-portal/[caseId]`), and verify completion. |
| **Successful End-to-End Closure** | `REF-DEMO-SUCCESS-01` | Open from **Cases** (`/cases`) to inspect full `NEW → CLOSED` timeline, confirmed provider shortage barrier, alternate psychiatrist match, 3 completion signals (`PROVIDER_CONFIRMATION`, `MEMBER_CONFIRMATION`, `CLAIM_RECEIVED`), and closed audit history. |
| **Failed / Unreachable Escalation** | `REF-DEMO-FAILED-01` | Demonstrates safe `UNKNOWN` (`"Barrier unknown"`) behavior, `HUMAN_ONLY` outreach failure, `ESCALATED` notification, and `CLOSED_UNRESOLVED` referral tracking. |
| **Health Equity Language Match** | `REF-DEMO-EQUITY-01` | Vietnamese-preferred member matched with bilingual Vietnamese verified telehealth clinician resulting in verified visit completion; also inspect cohort comparisons on **Health Equity** (`/health-equity`). |
| **Assisted Scheduling Friction** | `REF-DEMO-SCHED-01` | Shift-work scheduling friction resolved via `ASSISTED_SCHEDULING` into evening verified telehealth visit completion. |
| **No-Show Re-Engagement Recovery** | `REF-DEMO-NOSHOW-01` | Shows initial `NO_SHOW` appointment → `MISSED_APPOINTMENT_REENGAGEMENT` outreach → rescheduled telehealth visit → verified completion. |
| **Executive Outcomes & Filtering** | — | Visit **Executive Dashboard** (`/`) as `exec@careloop.demo` and filter by `Spanish`, `Rural North`, barrier, or provider to verify row-level metric reconciliation. |
| **Multi-Tenant & Audit Controls** | — | Visit **Audit Log** (`/audit-log`) and **Settings** (`/settings`) as `admin@careloop.demo`, or sign into isolated tenant `pacific-medicare` (`admin@pacific.demo`) to confirm zero cross-tenant visibility. |

---

## 4. Demo Login Credentials Reference

Password for all demo accounts: **`CareLoopDemo2026!`**

| Role | Email | Tenant Slug |
| :--- | :--- | :--- |
| `CARE_MANAGER` | `care.manager@careloop.demo` | `horizon-bh` |
| `ADMIN` | `admin@careloop.demo` | `horizon-bh` |
| `HEALTH_EQUITY` | `equity.analyst@careloop.demo` | `horizon-bh` |
| `OPERATIONS` | `ops@careloop.demo` | `horizon-bh` |
| `EXECUTIVE_READ_ONLY` | `exec@careloop.demo` | `horizon-bh` |
| `ADMIN` (Isolated Tenant) | `admin@pacific.demo` | `pacific-medicare` |
