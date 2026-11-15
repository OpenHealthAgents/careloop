# CareLoop System Architecture

CareLoop is a multi-tenant behavioral-health care coordination platform structured as a layered TypeScript architecture built on **Next.js 15 (App Router)**, **React 19**, **Tailwind CSS v4**, **Prisma ORM**, and **PostgreSQL**.

---

## Critical Architectural Rule: AI Autonomy vs. System Autonomy

> **Never confuse AI autonomy with system autonomy.**
>
> CareLoop is designed to be **highly autonomous in coordinating routine execution** while remaining **tightly governed**.

### The Canonical Architecture Hierarchy

```
                 CARELOOP
                     |
             CASE ORCHESTRATOR
                     |
       ┌─────────────┼─────────────┐
       |             |             |
   STATE MACHINE   POLICY        MEMORY
       |           ENGINE           |
       └─────────────┼─────────────┘
                     |
                TOOL REGISTRY
                     |
        ┌────────────┼────────────┐
        |            |            |
     PROVIDER    SCHEDULING   COMMUNICATION
        |            |            |
        └────────────┼────────────┘
                     |
              HUMAN APPROVAL
                     |
              EXECUTION JOURNAL
                     |
                  EVIDENCE
                     |
             OUTCOME VERIFICATION
                     |
                  LEARNING
```

### The 7 Authority & Separation Principles

| Component | Role | Architectural Definition |
| :--- | :--- | :--- |
| **The Agent** | **Execution Intelligence** | Reasons, synthesizes clinical context, identifies barriers, formulates plans, and proposes next steps. It never commands state or mutates policies directly. |
| **The State Machine** | **Workflow Authority** | The single source of truth for case progression. Prevents invalid lifecycle jumps, enforces state invariants, and deterministically governs state transitions. |
| **The Policy Engine** | **Safety Authority** | The non-bypassable guard evaluating safety, clinical guidelines, consent, privacy (HIPAA/PHI), and authorization boundaries for every proposed action. |
| **The Tool Registry** | **Action Boundary** | Strictly typed, sandboxed execution environment. Tools cannot execute arbitrary side-effects; all inputs and outputs conform to validated Zod schemas. |
| **The Human** | **Judgment & Exception Layer** | Human-in-the-loop oversight. Clinical supervisors and care coordinators review high-risk actions, handle escalations, and resolve edge cases. |
| **The Evidence Layer** | **Truth Layer** | Cryptographic integrity ledger (SHA-256 payload hashing) anchoring every claim to documented facts (EHR encounters, member attestations). |
| **The Learning Layer** | **Improvement & Defensibility Layer** | Continuous counterfactual evaluation and policy optimization. Generates advisory proposals that must pass simulation before human review. |

> **"That is CareLoop."**

---

> **Canonical Architecture Documentation:** For the complete, detailed architecture specification covering all 12 core components, please see:  
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## The 12 Core Architectural Components

| Component | Status | Summary |
| :--- | :---: | :--- |
| **1. Agent** | **IMPLEMENTED** | Orchestrator, specialized multi-agents (`ReferralAgent`, `BarrierAgent`, `ProviderAgent`, `SchedulingAgent`, `EngagementAgent`, `VerificationAgent`, `EquityAgent`), agent runtime loop, and event-driven reactions. |
| **2. State Machine** | **IMPLEMENTED** | Deterministic 10-state + 4-exception case lifecycle, with linked state machines for referrals, appointments, interventions, and communications. |
| **3. Policy Engine** | **IMPLEMENTED** | Centralized evaluator (`ALLOW`, `DENY`, `REQUIRE_APPROVAL`, `REQUIRE_HUMAN`), clinical advice guards, BAA/consent checks, and 8-stage policy optimization framework. |
| **4. Tool Registry** | **IMPLEMENTED** | Typed tool specifications with Zod validation, risk levels, RBAC permissions, idempotency strategies, and centralized execution bottleneck. |
| **5. Approval Engine** | **IMPLEMENTED** | Persistent human approval requests, 24h TTL, supervisor review gates, execution resume without state loss, and strict anti-self-approval guards. |
| **6. Case Memory** | **IMPLEMENTED** | Structured relational memory enforcing `STRUCTURED_RELATIONAL_ONLY_NO_RAW_LLM_TRANSCRIPTS`, separating member/referral facts, epistemic barrier observations, and action logs. |
| **7. Evidence Layer** | **IMPLEMENTED** | SHA-256 payload hashing, tamper-evident cryptographic integrity verification, and dual-source visit completion verifier. |
| **8. Execution Journal** | **IMPLEMENTED** | Append-only event stream tracking 27 lifecycle event types, AI decision traces (context hash, confidence, signals) without raw chain-of-thought leakage. |
| **9. Audit Layer** | **IMPLEMENTED** | Multi-tenant append-only audit ledger with PHI minimization and automatic redaction of sensitive identifiers. |
| **10. Analytics** | **IMPLEMENTED** | Health equity analytics (4/5ths disparity rule, $N < 10$ suppression), executive KPIs, token cost optimization, pilot measurement, and least-friction historical query. |
| **11. Evaluation** | **IMPLEMENTED** | 10-case golden benchmark evaluation suite, 15-scenario trace evaluator, and offline candidate policy safety harness (100% critical safety pass required). |
| **12. Simulation** | **IMPLEMENTED** | 10,000 synthetic member demo environment, healthcare operational simulator, 7-act founder demo runner, and 4-arm randomized pilot trial simulator. |

---

## Anti-Autonomous Policy Mutation Invariant
> *"Never allow the agent to rewrite its own production policy autonomously."*  
All learning outputs and policy optimizations are strictly advisory proposals (`ADVISORY_PROPOSAL_ONLY`). Candidate changes must traverse an 8-stage verification pipeline and require human clinical supervisor sign-off.
