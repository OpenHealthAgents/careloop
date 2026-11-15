import { describe, expect, it } from "vitest";
import {
  CANONICAL_VERSION_MANIFESTS,
  computeManifestSignature,
  formatVersionProvenance,
  SystemVersionManifestSchema,
} from "@/domain/versioning";
import {
  getVersionManifest,
  listVersionManifests,
  reproduceDecision,
} from "@/services/version-service";
import { CaseOrchestratorInput } from "@/ai/orchestrator";

describe("Agent Versioning Unit Tests (9-Component Matrix & Reproducibility)", () => {
  it("validates all 9 versioned components in canonical manifests", () => {
    const manifests = listVersionManifests();
    expect(manifests.length).toBeGreaterThanOrEqual(3);

    for (const manifest of manifests) {
      const validated = SystemVersionManifestSchema.safeParse(manifest);
      expect(validated.success).toBe(true);

      const c = manifest.components;
      // 1. Agent
      expect(c.agent.id).toBeDefined();
      expect(c.agent.version).toMatch(/^\d+\.\d+\.\d+$/);

      // 2. Prompt
      expect(c.prompt.id).toBeDefined();
      expect(c.prompt.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.prompt.templateVersions.CALCULATE_RISK).toBeDefined();
      expect(c.prompt.templateVersions.CLASSIFY_BARRIER).toBeDefined();

      // 3. Model
      expect(c.model.name).toBeDefined();
      expect(c.model.version).toBeDefined();
      expect(["DETERMINISTIC", "EXTERNAL_OPENAI", "HYBRID"]).toContain(c.model.providerType);

      // 4. Tool
      expect(c.tool.registryVersion).toBeDefined();
      expect(Object.keys(c.tool.toolVersions).length).toBeGreaterThanOrEqual(10);
      expect(c.tool.toolVersions.schedule_appointment).toBeDefined();

      // 5. Policy
      expect(c.policy.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.policy.rulesCount).toBeGreaterThanOrEqual(6);
      expect(c.policy.rulesHash).toBeDefined();

      // 6. Workflow
      expect(c.workflow.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.workflow.allowedStates.length).toBeGreaterThanOrEqual(10);
      expect(c.workflow.allowedStates).toContain("NEW");
      expect(c.workflow.allowedStates).toContain("CLOSED");

      // 7. Barrier Classifier
      expect(c.barrierClassifier.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.barrierClassifier.taxonomyVersion).toBeDefined();
      expect(c.barrierClassifier.categoriesCount).toBe(7);

      // 8. Risk Model
      expect(c.riskModel.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.riskModel.algorithm).toBeDefined();
      expect(c.riskModel.maxScore).toBe(100);

      // 9. Intervention Strategy
      expect(c.interventionStrategy.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.interventionStrategy.rulesCount).toBeGreaterThanOrEqual(8);
    }
  });

  it("computes deterministic SHA-256 signatures across the 9 components", () => {
    const v21 = CANONICAL_VERSION_MANIFESTS["v2.1.0"];
    const sig1 = computeManifestSignature(v21.components);
    const sig2 = computeManifestSignature(v21.components);
    expect(sig1).toBe(sig2);
    expect(sig1).toBe(v21.signature);

    // Tampering with any single component changes the signature
    const tampered = {
      ...v21.components,
      policy: {
        ...v21.components.policy,
        version: "2.1.1",
      },
    };
    const tamperedSig = computeManifestSignature(tampered);
    expect(tamperedSig).not.toBe(sig1);
  });

  it("formats complete 9-component version provenance answering 'Which version produced this action?'", () => {
    const v20 = getVersionManifest("v2.0.0");
    const prov = formatVersionProvenance(v20);

    expect(prov.manifestId).toBe("manifest-v2.0.0");
    expect(prov.signature).toBe(v20.signature);
    expect(prov.agent).toBe("CareLoopCaseOrchestrator@2.0.0");
    expect(prov.prompt).toBe("careloop-prompts@2.0.0");
    expect(prov.model).toBe("careloop-orchestrator-v2@2.0.0");
    expect(prov.tool).toBe("tool-registry@2.0.0");
    expect(prov.policy).toBe("policy-engine@2.0.0");
    expect(prov.workflow).toBe("workflow@1.5.0");
    expect(prov.barrierClassifier).toBe("barrier-classifier@2.0.0");
    expect(prov.riskModel).toBe("risk-model@2.0.0");
    expect(prov.interventionStrategy).toBe("intervention-strategy@1.5.0");
  });

  it("reproduces deterministic decision outputs given input context and manifest", () => {
    const testInput: CaseOrchestratorInput = {
      case_id: "case-rep-100",
      member_context: {
        preferredLanguage: "English",
        urbanicity: "URBAN",
        digitalAccessLevel: "MEDIUM",
        transportationAccess: "NONE",
        consentOutreach: true,
        consentSms: true,
        priorNoShowCount: 0,
      },
      referral_context: {
        behavioralHealthNeed: "Outpatient therapy",
        specialty: "Psychiatry",
        urgency: "HIGH",
        geography: "West Metro",
        networkRequired: "HorizonCare",
        eligibilityVerified: "VERIFIED",
        matchedProviderId: "p1",
        verifiedAvailableSlotsCount: 2,
      },
      current_state: "NEW",
      known_barriers: [],
      available_evidence: {
        hasRiskAssessment: false,
        hasCompletedAppointment: false,
        hasScheduledAppointment: false,
        hasConfirmedAppointment: false,
        hasNoShowAppointment: false,
        hasVerifiedVisit: false,
        signals: ["Urgent referral"],
      },
      previous_actions: [],
      policy_context: {
        riskTier: "HIGH",
        priorityScore: 85,
        consentOutreach: true,
        consentSms: true,
        humanReviewRequired: false,
      },
      human_tasks: {
        pendingBarrierConfirmations: 0,
        pendingInterventionApprovals: 0,
        openEscalations: 0,
        awaitingCompletionVerification: false,
      },
    };

    const runA = reproduceDecision({ inputContext: testInput, manifestId: "v2.1.0" });
    const runB = reproduceDecision({ inputContext: testInput, manifestId: "v2.1.0" });

    expect(runA.isReproducible).toBe(true);
    expect(runA.provenance.manifestId).toBe("manifest-v2.1.0");
    expect(runA.decision).toEqual(runB.decision);
  });
});
