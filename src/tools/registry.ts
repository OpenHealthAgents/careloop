import { z } from "zod";
import {
  CARE_LOOP_TOOL_REGISTRY,
  CareLoopToolDefinition,
  ToolHumanApprovalRequirement,
  ToolRiskLevel,
  ToolSideEffectKind,
} from "@/ai/tool-registry";
import type { Permission } from "@/lib/auth/rbac";
import { ValidationError } from "@/lib/errors";

export interface RegisteredToolSpec<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  name: string;
  version: string;
  description: string;
  input_schema: TInput;
  output_schema: TOutput;
  risk_level: ToolRiskLevel;
  permissions: readonly Permission[];
  side_effects: {
    kind: ToolSideEffectKind;
    summary: string;
    reversible: boolean;
  };
  idempotency: {
    mode: "SAFE_READ" | "IDEMPOTENCY_KEY" | "STATE_PRECONDITION" | "UNIQUE_CONSTRAINT";
    description: string;
  };
  approval_requirement: ToolHumanApprovalRequirement;
  audit_event_type?: string;
}

function fromCoreDefinition(def: CareLoopToolDefinition): RegisteredToolSpec {
  return {
    name: def.name,
    version: def.version ?? "1.0.0",
    description: def.description,
    input_schema: def.input_schema,
    output_schema: def.output_schema,
    risk_level: def.risk_level,
    permissions: def.permissions,
    side_effects: def.side_effects,
    idempotency: def.idempotency_strategy,
    approval_requirement: def.human_approval_requirement,
    audit_event_type: def.audit_event_type,
  };
}

export class CareLoopToolRegistry {
  private readonly tools = new Map<string, RegisteredToolSpec>();

  constructor(initialTools: RegisteredToolSpec[] = []) {
    for (const tool of initialTools) {
      this.register(tool);
    }
  }

  register<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
    spec: RegisteredToolSpec<TInput, TOutput>
  ): RegisteredToolSpec<TInput, TOutput> {
    if (!spec.name?.trim()) {
      throw new ValidationError("Tool registration requires a non-empty name.");
    }
    if (!spec.version?.trim()) {
      throw new ValidationError(`Tool '${spec.name}' registration requires a version.`);
    }
    if (!spec.description?.trim()) {
      throw new ValidationError(`Tool '${spec.name}' registration requires a description.`);
    }
    if (!spec.permissions || spec.permissions.length === 0) {
      throw new ValidationError(`Tool '${spec.name}' must declare at least one scoped permission.`);
    }
    this.tools.set(spec.name, spec);
    return spec;
  }

  get(name: string): RegisteredToolSpec {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ValidationError(`Unknown tool '${name}' in ToolRegistry.`);
    }
    return tool;
  }

  list(): RegisteredToolSpec[] {
    return Array.from(this.tools.values());
  }

  validate(name: string, rawInput: unknown): unknown {
    const tool = this.get(name);
    const parsed = tool.input_schema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(`Tool '${name}' input validation failed.`, {
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }
}

export const defaultToolRegistry = new CareLoopToolRegistry(
  Object.values(CARE_LOOP_TOOL_REGISTRY).map(fromCoreDefinition)
);

export const ToolRegistry = {
  register: <TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
    spec: RegisteredToolSpec<TInput, TOutput>
  ) => defaultToolRegistry.register(spec),
  get: (name: string) => defaultToolRegistry.get(name),
  list: () => defaultToolRegistry.list(),
  validate: (name: string, rawInput: unknown) => defaultToolRegistry.validate(name, rawInput),
};
