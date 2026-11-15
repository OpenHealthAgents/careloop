/**
 * ============================================================================
 * AGENT REGISTRY IMPLEMENTATION
 * ============================================================================
 * Central registry cataloging all specialized agents and their capabilities.
 * Enforces task assignment validation and non-negotiable case goal integrity:
 * "No agent may independently redefine the case goal."
 * ============================================================================
 */

import {
  AgentRegistry,
  AgentTask,
  SpecializedAgentSpec,
} from "./contracts";
import { assertCaseGoalImmutable } from "./shared-invariants";
import { DEFAULT_SPECIALIZED_AGENTS } from "./specialized-agents";

export class CareLoopAgentRegistry implements AgentRegistry {
  private readonly agents = new Map<string, SpecializedAgentSpec>();

  constructor(initialAgents: readonly SpecializedAgentSpec[] = DEFAULT_SPECIALIZED_AGENTS) {
    for (const agent of initialAgents) {
      this.register(agent);
    }
  }

  /**
   * Registers a specialized agent.
   */
  public register(agent: SpecializedAgentSpec): void {
    if (!agent.name || !agent.name.trim()) {
      throw new Error("Cannot register an agent with an empty name.");
    }
    this.agents.set(agent.name.toLowerCase(), agent);
  }

  /**
   * Unregisters an agent by name.
   */
  public unregister(agentName: string): boolean {
    return this.agents.delete(agentName.toLowerCase());
  }

  /**
   * Retrieves an agent specification by name.
   */
  public getAgent(name: string): SpecializedAgentSpec | undefined {
    return this.agents.get(name.toLowerCase());
  }

  /**
   * Checks whether an agent is registered.
   */
  public hasAgent(name: string): boolean {
    return this.agents.has(name.toLowerCase());
  }

  /**
   * Returns all agents that support a specific capability.
   */
  public getAgentsByCapability(capabilityId: string): readonly SpecializedAgentSpec[] {
    const matches: SpecializedAgentSpec[] = [];
    const target = capabilityId.toLowerCase();

    for (const agent of this.agents.values()) {
      if (agent.capabilities.some((c) => c.id.toLowerCase() === target)) {
        matches.push(agent);
      }
    }

    return matches;
  }

  /**
   * Lists all registered agents.
   */
  public listAgents(): readonly SpecializedAgentSpec[] {
    return Array.from(this.agents.values());
  }

  /**
   * Validates that an incoming task is validly structured and can be handled
   * by the assigned agent.
   */
  public validateTaskAssignment(task: AgentTask): { valid: boolean; reason?: string } {
    if (!task.caseGoal || !task.caseGoal.trim()) {
      return {
        valid: false,
        reason: "Task missing required canonical caseGoal. All tasks must operate under shared case goal.",
      };
    }

    const agent = this.getAgent(task.assignedAgent);
    if (!agent) {
      return {
        valid: false,
        reason: `Assigned agent '${task.assignedAgent}' is not registered in the AgentRegistry.`,
      };
    }

    const hasCapability = agent.capabilities.some(
      (c) => c.id.toLowerCase() === task.capabilityRequired.toLowerCase()
    );
    if (!hasCapability) {
      return {
        valid: false,
        reason: `Agent '${task.assignedAgent}' does not support required capability '${task.capabilityRequired}'. Available capabilities: [${agent.capabilities.map((c) => c.id).join(", ")}].`,
      };
    }

    return { valid: true };
  }

  /**
   * Verifies that an agent result or task acknowledges the immutable canonical case goal.
   * Throws CaseGoalInvariantViolationError if goal mutation is attempted.
   */
  public verifyGoalIntegrity(
    canonicalGoal: string,
    agentProposedGoal?: string,
    agentName = "UnknownAgent"
  ): void {
    assertCaseGoalImmutable(canonicalGoal, agentProposedGoal, agentName);
  }
}

/**
 * Singleton AgentRegistry instance.
 */
export const agentRegistry = new CareLoopAgentRegistry();
