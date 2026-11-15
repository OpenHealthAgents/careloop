import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CARE_LOOP_TOOL_REGISTRY,
  CaseOrchestratorToolSchema,
  getToolDefinition,
  listToolRegistryMetadata,
  requiresHumanApprovalForTool,
  validateToolInput,
  validateToolOutput,
} from "@/ai";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { ValidationError } from "@/lib/errors";
import { CareLoopToolRegistry, ToolRegistry } from "@/tools";

describe("Typed CareLoop Tool Registry", () => {
  it("registers every CaseOrchestratorTool with all required metadata fields", () => {
    const toolNames = CaseOrchestratorToolSchema.options;
    expect(Object.keys(CARE_LOOP_TOOL_REGISTRY).sort()).toEqual([...toolNames].sort());

    const metadataList = listToolRegistryMetadata();
    expect(metadataList).toHaveLength(toolNames.length);

    for (const toolName of toolNames) {
      const def = getToolDefinition(toolName);
      expect(def.name).toBe(toolName);
      expect(def.description.length).toBeGreaterThan(10);
      expect(def.input_schema).toBeDefined();
      expect(def.output_schema).toBeDefined();
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(def.risk_level);
      expect(def.permissions.length).toBeGreaterThanOrEqual(1);
      expect(def.side_effects.kind).toBeDefined();
      expect(def.idempotency_strategy.mode).toBeDefined();
      expect(def.timeout.ms).toBeGreaterThan(0);
      expect(def.retry_policy.maxAttempts).toBeGreaterThanOrEqual(1);
      expect(def.audit_event_type.length).toBeGreaterThan(3);
      expect(["NONE", "POLICY_DEPENDENT", "ALWAYS_REQUIRED"]).toContain(
        def.human_approval_requirement
      );
    }
  });

  it("matches expected risk, side-effect, and policy-dependent human approval profiles", () => {
    const searchTool = getToolDefinition("search_providers");
    expect(searchTool.risk_level).toBe("LOW");
    expect(searchTool.side_effects.kind).toBe("NONE");
    expect(searchTool.human_approval_requirement).toBe("NONE");
    expect(requiresHumanApprovalForTool("search_providers", { riskTier: "HIGH" })).toBe(false);

    const scheduleTool = getToolDefinition("schedule_appointment");
    expect(scheduleTool.risk_level).toBe("MEDIUM");
    expect(scheduleTool.side_effects.kind).toBe("DATABASE_WRITE");
    expect(scheduleTool.human_approval_requirement).toBe("POLICY_DEPENDENT");
    expect(requiresHumanApprovalForTool("schedule_appointment", { riskTier: "LOW" })).toBe(false);
    expect(requiresHumanApprovalForTool("schedule_appointment", { riskTier: "HIGH" })).toBe(true);

    const sensitiveComm = getToolDefinition("send_member_communication");
    expect(sensitiveComm.risk_level).toBe("HIGH");
    expect(sensitiveComm.side_effects.kind).toBe("EXTERNAL_MESSAGE");
    expect(sensitiveComm.human_approval_requirement).toBe("POLICY_DEPENDENT");
    expect(requiresHumanApprovalForTool("send_member_communication", { riskTier: "LOW" })).toBe(
      true
    );

    expect(requiresHumanApprovalForTool("verify_completion", { riskTier: "LOW" })).toBe(true);
    expect(requiresHumanApprovalForTool("escalate_to_human", { riskTier: "LOW" })).toBe(true);
  });

  it("validates tool inputs and outputs strictly using each tool's Zod schemas", () => {
    const validSearchInput = validateToolInput("search_providers", {
      tenantId: "tenant-1",
      specialty: "Outpatient Behavioral Health",
    });
    expect(validSearchInput).toMatchObject({ specialty: "Outpatient Behavioral Health" });

    expect(() =>
      validateToolInput("schedule_appointment", {
        tenantId: "tenant-1",
        caseId: "case-1",
        providerId: "prov-1",
        scheduledStartAt: "not-a-timestamp",
        modality: "TELEHEALTH",
      })
    ).toThrowError(ValidationError);

    expect(() =>
      validateToolOutput("escalate_to_human", {
        caseId: "case-1",
        status: "CLOSED",
        notificationSent: true,
      })
    ).toThrowError(ValidationError);
  });

  it("supports ToolRegistry.register(), get(), list(), and validate() with version & approval metadata", () => {
    const builtInTools = ToolRegistry.list();
    expect(builtInTools.length).toBeGreaterThanOrEqual(8);
    expect(ToolRegistry.get("search_providers").version).toBe("1.0.0");
    expect(ToolRegistry.get("search_providers").approval_requirement).toBe("NONE");
    expect(ToolRegistry.get("search_providers").idempotency.mode).toBe("SAFE_READ");

    const isolated = new CareLoopToolRegistry();
    isolated.register({
      name: "custom_check",
      version: "1.2.0",
      description: "Checks member readiness without mutating database tables.",
      input_schema: z.object({ caseId: z.string().min(1) }),
      output_schema: z.object({ ready: z.boolean() }),
      risk_level: "LOW",
      permissions: [PERMISSIONS.CASES_READ],
      side_effects: { kind: "NONE", summary: "Read-only check", reversible: true },
      idempotency: { mode: "SAFE_READ", description: "Stateless read" },
      approval_requirement: "NONE",
    });

    expect(isolated.get("custom_check").version).toBe("1.2.0");
    expect(isolated.validate("custom_check", { caseId: "c-1" })).toEqual({ caseId: "c-1" });
    expect(() => isolated.validate("custom_check", { caseId: "" })).toThrowError(ValidationError);
    expect(() => isolated.get("non_existent_tool")).toThrowError(ValidationError);
  });
});
