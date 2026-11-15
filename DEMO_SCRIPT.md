# CareLoop 10-Minute Live Product Demo Script (`DEMO_SCRIPT.md`)

**Core Narrative:** A health plan knows a member needs behavioral healthcare — yet referrals routinely fail to become completed visits. CareLoop closes that execution loop end-to-end:

**`IDENTIFY → UNDERSTAND → DECIDE → EXECUTE → VERIFY → LEARN`**

---

## Pre-Demo Reset & Sign-In (2 minutes before going live)

1. Reset cleanly to the deterministic demonstration dataset:
   ```bash
   npm run demo:setup
   npm run dev
   ```
2. Open `http://localhost:3000`.
3. Sign in once as **Care Manager** via the `/login` quick sign-in card (`care.manager@careloop.demo` / `CareLoopDemo2026!`) so you have full access across Executive Dashboard, Worklist, Case Workspace, Member Experience Preview, and Health Equity Analytics in **one browser session** (no unnecessary admin/settings switches during the 10-minute story).

**Screens to intentionally skip during the 10-minute executive narrative:** `/settings`, raw CSV uploads (`/referrals`), standalone `/audit-log` admin table, and User Management.

---

## Minute-by-Minute 10-Minute Walkthrough

### 0:00 – 1:15 | Step 1 — Executive Dashboard (`/` — Establish the Gap & Baseline)
- **Action:** Land on `/` (**Executive Dashboard**).
- **Point out:**
  1. The **`IDENTIFY → UNDERSTAND → DECIDE → EXECUTE → VERIFY → LEARN`** loop ribbon across the top.
  2. The **North-Star Metric** (*Percentage of referrals resulting in a verified first completed behavioral-health visit*) across **80 real synthetic referrals / 60 members**, alongside conversion rates, time-to-care, and equity disparities across languages and geographies.
  3. Point to the Spanish vs. English or Rural North disparity right on the summary card: *"Sending a referral is not care delivery. Let's inspect who is at risk of falling through the cracks right now."*
- **Click:** **Open High-Risk Worklist** button (`/worklist?riskTier=HIGH`) → transitions visually to **`1. IDENTIFY`**.

---

### 1:15 – 2:30 | Step 2 — High-Risk Referral Worklist (`/worklist?riskTier=HIGH` — IDENTIFY)
- **Action:** Look at **Row #1 (`REF-2026-1001` — Elena Navarro, HIGH Risk 96)**.
- **Point out:**
  1. Elena's signal breakdown is expanded automatically right in the queue: *Referral aging (9 days)*, *Spanish preferred language*, *Transportation access: NONE*, *1 prior missed appointment*.
  2. Explicitly note the ethical guardrail banner: **Protected characteristics are never used as individual risk predictors**; urgency reflects operational bottlenecks and access friction.
- **Click:** **Open Case** on Elena Navarro (`REF-2026-1001`).

---

### 2:30 – 4:15 | Steps 3–6 — Case Detail, Barrier Explanation, Evidence & Intervention (`UNDERSTAND → DECIDE`)
- **Action:** Pause at the top of `/cases/[id]` (**Case Workspace**).
- **Point out:**
  1. Notice the **live 6-stage loop stepper** at the top highlights `UNDERSTAND` / `DECIDE` cleanly.
  2. Walk quickly across the **10-Point Care Coordination Brief** right above the fold:
     - **Who is she?** Elena Navarro (`MEM-9001`), Spanish-speaking, Central Metro, Medicaid, no transit.
     - **What care?** Outpatient Behavioral Health (Depression & Adjustment Support).
     - **Why might it fail + Evidence?** Risk 96 (`HIGH`), inferred barrier `COMMUNICATION / language` backed by observed signals (`INFERENCE` badge — explicitly *not* marked `FACT` until a human confirms it; when evidence is missing, CareLoop outputs `UNKNOWN / Barrier unknown`).
     - **What should we do & What does the human need to do?** Pending `LANGUAGE_COMPATIBLE_PROVIDER_SEARCH` intervention (`HUMAN_ASSISTED` + `HIGH-RISK HUMAN GATE`). Expand **Decision Support Basis** briefly only if someone asks to verify observed `FACT` vs `INFERENCE` vs `RECOMMENDATION` and confidence/uncertainty.
- **Live Interactions:**
  - Scroll or jump (`#barriers`) to **Barrier Identification & Human Confirmation** → click **Confirm Barrier as FACT** (`epistemicStatus` flips to `FACT`).
  - Under **Recommended & Active Interventions** (`#interventions`) → click **Approve** on `LANGUAGE_COMPATIBLE_PROVIDER_SEARCH`.
  - Point out: *AI assisted the workflow, never bypassed human authority, and logged prompt version + human approval automatically.*

---

### 4:15 – 6:15 | Steps 7–9 — Provider Matching & Assisted Scheduling (`EXECUTE`)
- **Action:** Scroll/jump (`#appointments`) to **Provider Matching & Assisted Scheduling**.
- **Point out:**
  1. Providers are ranked with explicit matching rationale (*In-network Horizon Medicaid*, *Spanish-speaking*, *Central Metro*).
  2. Contrast **VERIFIED AVAILABILITY** (green badge on **Dr. Valeria Rivera, PsyD** — live EHR slot within 3 days) against **DIRECTORY DATA (UNVERIFIED)** (amber stale warning — *"Directory data refreshed 21 days ago; never assume an appointment exists"*).
  3. *(Optional 20-second beat)* Click **Preview Member Experience →** (`/member-portal/[caseId]`) to show what **Elena** experiences: plain-language Spanish-friendly support without risk scores, AI labels, or medical claims — *"You were referred to behavioral healthcare. We found providers near you..."* — then click back (`← Care Workspace`).
- **Live Interaction:** Select **Dr. Valeria Rivera**'s verified telehealth slot → click **Schedule Appointment** (`SCHEDULED`).

---

### 6:15 – 8:00 | Steps 10–11 — Confirmation, Visit Completion Verification & Audit Timeline (`VERIFY`)
- **Action:** Move directly into **Case Outcome, Appointments & Completion Verification** (`#outcome`).
- **Point out:**
  1. Scheduling the visit intentionally creates an evidence signal with **0% completion confidence** (*"Scheduling only — NOT care completion"*).
  2. Execute the real operational progression in 3 clicks:
     - Click **Mark Confirmed** on Dr. Rivera's appointment (`CONFIRMED`).
     - Click **Mark Completed** (`COMPLETED`).
     - In **Record Completion Verification**, keep **APPOINTMENT_COMPLETED** (or choose **PROVIDER_CONFIRMATION / CLAIM_RECEIVED**), ensure **Close Case on Verify** is checked, and click **Verify Visit Completion**.
  3. Point to the status flipping to **`CLOSED`** and `First Completed Visit` populating live, plus point briefly to `#timeline` and `#audit-history` on the right column: every transition (`CASE_STATUS_TRANSITION`, `BARRIER_ACCEPT`, `INTERVENTION_APPROVE`, `APPOINTMENT_COMPLETE`, `COMPLETION_VERIFIED`) carries actor, state diff, timestamp, and correlation ID.

---

### 8:00 – 10:00 | Steps 12–13 — Updated Outcome Dashboard & Equity Learning (`LEARN`)
- **Action:** Click **View Updated Outcome Dashboard →** (`/`) right from the verified completion bar.
- **Point out:**
  1. Look at the **North-Star Metric**, **Referrals → Completed Visits**, and **Intervention Effectiveness** right on `/` — Elena Navarro's verified visit updated the population counts immediately and reconciles row-for-row in the bottom traceability table.
- **Click:** **6. LEARN (`Outcomes & equity`)** in the stage bar (or **Equity & Learning** button → `/health-equity`).
- **Point out:**
  1. Show **Lowest Referral Completion Cohorts**, **Longest Time-to-Care**, and **Interventions Reducing Disparities** (`+pts lift` for `LANGUAGE_COMPATIBLE_PROVIDER_SEARCH` and `ASSISTED_SCHEDULING` within trailing cohorts, complete with explicit sample-size `n` badges and small-sample caution guardrails).
  2. Close with the loop summary: *"This closes CareLoop's operational loop: identify who is at risk, understand why with evidence, decide with human accountability, execute through verified provider availability, verify actual visit completion, and feed every outcome back into measurable health equity."*

---

## Backup Showcase Cases (If Questions Arise During Q&A)

| Question / Edge Case | Search in `/cases` | What It Proves |
| :--- | :--- | :--- |
| *What happens when AI doesn't know?* | `REF-DEMO-FAILED-01` | Shows `UNKNOWN / Barrier unknown` (zero hallucinated barrier), failed `HUMAN_ONLY` outreach after 3 unreachable attempts, and clean escalation. |
| *What happens after a No-Show?* | `REF-DEMO-NOSHOW-01` | Shows initial `NO_SHOW` appointment → `MISSED_APPOINTMENT_REENGAGEMENT` → rescheduled telehealth appointment → verified visit completion. |
| *What about shift-work friction?* | `REF-DEMO-SCHED-01` | Shows `ACCESS / work schedule` resolved via `ASSISTED_SCHEDULING` evening telehealth visit. |
