"use client";

import React, { useState } from "react";
import {
  Bot,
  Brain,
  Cpu,
  FileCheck2,
  GitBranch,
  Layers,
  ShieldCheck,
  UserCheck,
  Wrench,
} from "lucide-react";

interface ObservabilityMetricsProps {
  initialMetrics: any;
}

export function ObservabilityDashboardClient({ initialMetrics }: ObservabilityMetricsProps) {
  const [activeTab, setActiveTab] = useState<
    "agent" | "tool" | "workflow" | "human" | "outcomes"
  >("agent");

  const { dashboards, token_usage } = initialMetrics ?? {};
  const agentRel = dashboards?.agent_reliability ?? {};
  const toolRel = dashboards?.tool_reliability ?? {};
  const workflowRel = dashboards?.workflow_reliability ?? {};
  const humanWorkload = dashboards?.human_workload ?? {};
  const caseOutcomes = dashboards?.case_outcomes ?? {};

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-3 rounded-t-xl shadow-xs">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("agent")}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === "agent"
                ? "border-teal-600 text-teal-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bot className="h-4 w-4" />
            Agent Reliability
          </button>
          <button
            onClick={() => setActiveTab("tool")}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === "tool"
                ? "border-teal-600 text-teal-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wrench className="h-4 w-4" />
            Tool Reliability
          </button>
          <button
            onClick={() => setActiveTab("workflow")}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === "workflow"
                ? "border-teal-600 text-teal-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <GitBranch className="h-4 w-4" />
            Workflow Reliability
          </button>
          <button
            onClick={() => setActiveTab("human")}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === "human"
                ? "border-teal-600 text-teal-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck className="h-4 w-4" />
            Human Workload
          </button>
          <button
            onClick={() => setActiveTab("outcomes")}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === "outcomes"
                ? "border-teal-600 text-teal-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileCheck2 className="h-4 w-4" />
            Case Outcomes
          </button>
        </nav>
      </div>

      {/* 1. AGENT RELIABILITY TAB */}
      {activeTab === "agent" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Agent Runs</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">{agentRel.total_runs ?? 0}</p>
              <span className="text-xs text-slate-400">Tracked in AgentRun ledger</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Success Rate</span>
              <p className="mt-2 text-2xl font-bold text-teal-700">
                {((agentRel.success_rate ?? 0) * 100).toFixed(1)}%
              </p>
              <span className="text-xs text-slate-400">{agentRel.succeeded_runs ?? 0} Succeeded</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Avg / P95 Latency</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {agentRel.avg_latency_ms ?? 0}ms <span className="text-sm font-normal text-slate-500">/ {agentRel.p95_latency_ms ?? 0}ms</span>
              </p>
              <span className="text-xs text-slate-400">Total retries: {agentRel.total_retries ?? 0}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Tokens</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {(agentRel.total_tokens ?? 0).toLocaleString()}
              </p>
              <span className="text-xs text-slate-400">~{agentRel.avg_tokens_per_run ?? 0} tokens/run</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Brain className="h-4 w-4 text-teal-600" />
                Active Agent Models & Versions
              </h3>
              <div className="mt-4 space-y-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Models Deployed:</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(agentRel.active_models?.length ? agentRel.active_models : ["gpt-4o-mini", "Deterministic-CareLoop"]).map((m: string) => (
                      <span key={m} className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-500">Prompt Versions:</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(agentRel.prompt_versions?.length ? agentRel.prompt_versions : ["v1.0", "v2.0.0"]).map((pv: string) => (
                      <span key={pv} className="px-2.5 py-1 text-xs font-medium rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                        {pv}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-teal-600" />
                Token Breakdown & Cost Efficiency
              </h3>
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Prompt / Input Tokens</span>
                  <span className="font-semibold text-slate-900">{(token_usage?.total_prompt_tokens ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Completion / Output Tokens</span>
                  <span className="font-semibold text-slate-900">{(token_usage?.total_completion_tokens ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-600">Failed Agent Runs</span>
                  <span className="font-semibold text-rose-600">{agentRel.failed_runs ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TOOL RELIABILITY TAB */}
      {activeTab === "tool" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Tool Calls</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">{toolRel.total_tool_calls ?? 0}</p>
              <span className="text-xs text-slate-400">Total spans recorded</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Tool Failure Rate</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {((toolRel.tool_failure_rate ?? 0) * 100).toFixed(1)}%
              </p>
              <span className="text-xs text-slate-400">{toolRel.failed_tool_calls ?? 0} failures</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Avg Tool Latency</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">{toolRel.avg_latency_ms ?? 0}ms</p>
              <span className="text-xs text-slate-400">P95: {toolRel.p95_latency_ms ?? 0}ms</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Retries</span>
              <p className="mt-2 text-2xl font-bold text-amber-700">{toolRel.total_retries ?? 0}</p>
              <span className="text-xs text-slate-400">Bounded retry handling</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-teal-600" />
              Granular Tool Performance & Reliability Breakdown
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tool Identifier</th>
                    <th className="px-3 py-2">Invocations</th>
                    <th className="px-3 py-2">Avg Latency</th>
                    <th className="px-3 py-2">Failures</th>
                    <th className="px-3 py-2">Retries</th>
                    <th className="px-3 py-2">Reliability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(toolRel.by_tool ?? {}).map(([name, data]: [string, any]) => {
                    const failRate = data.count > 0 ? (data.failures / data.count) * 100 : 0;
                    return (
                      <tr key={name}>
                        <td className="px-3 py-2 font-mono font-medium text-slate-900">{name}</td>
                        <td className="px-3 py-2">{data.count}</td>
                        <td className="px-3 py-2">{data.avg_latency_ms}ms</td>
                        <td className="px-3 py-2 text-rose-600 font-semibold">{data.failures}</td>
                        <td className="px-3 py-2 text-amber-600">{data.retries}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${
                            failRate === 0
                              ? "bg-emerald-50 text-emerald-700"
                              : failRate < 20
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                          }`}>
                            {(100 - failRate).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. WORKFLOW RELIABILITY TAB */}
      {activeTab === "workflow" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">State Transitions</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">{workflowRel.total_state_transitions ?? 0}</p>
              <span className="text-xs text-slate-400">Workflow events validated</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Active Escalations</span>
              <p className="mt-2 text-2xl font-bold text-amber-700">{workflowRel.active_escalations ?? 0}</p>
              <span className="text-xs text-slate-400">REQUIRES_HUMAN_REVIEW or ESCALATED</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Blocked Cases</span>
              <p className="mt-2 text-2xl font-bold text-rose-600">{workflowRel.blocked_cases ?? 0}</p>
              <span className="text-xs text-slate-400">Terminal or policy-blocked</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                Policy Decisions & Gate Enforcement
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Total evaluated policy checks: {workflowRel.policy_decisions_count ?? 0}
              </p>
              <div className="mt-4 space-y-2">
                {Object.entries(workflowRel.policy_breakdown ?? {}).map(([effect, count]: [string, any]) => (
                  <div key={effect} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <span className="font-semibold text-slate-700">{effect}</span>
                    <span className="font-mono font-bold text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-teal-600" />
                State Transition Distribution
              </h3>
              <div className="mt-4 space-y-2">
                {Object.entries(workflowRel.transitions_by_type ?? {}).slice(0, 6).map(([type, count]: [string, any]) => (
                  <div key={type} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <span className="font-mono text-slate-700">{type}</span>
                    <span className="font-bold text-teal-700">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. HUMAN WORKLOAD TAB */}
      {activeTab === "human" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Approvals Requested</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">{humanWorkload.total_approvals_requested ?? 0}</p>
              <span className="text-xs text-slate-400">Total queued human gates</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Pending Review</span>
              <p className="mt-2 text-2xl font-bold text-amber-700">{humanWorkload.pending_approvals ?? 0}</p>
              <span className="text-xs text-slate-400">Care Manager workbench</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Decided Approvals</span>
              <p className="mt-2 text-2xl font-bold text-teal-700">{humanWorkload.completed_approvals ?? 0}</p>
              <span className="text-xs text-slate-400">Approved or modified</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Avg Wait Time</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {Math.round((humanWorkload.avg_approval_wait_ms ?? 0) / 1000)}s
              </p>
              <span className="text-xs text-slate-400">Max: {Math.round((humanWorkload.max_approval_wait_ms ?? 0) / 1000)}s</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. CASE OUTCOMES TAB */}
      {activeTab === "outcomes" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Cases</span>
              <p className="mt-2 text-2xl font-bold text-slate-900">{caseOutcomes.total_cases ?? 0}</p>
              <span className="text-xs text-slate-400">Active: {caseOutcomes.active_cases ?? 0}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Verified Care Completed</span>
              <p className="mt-2 text-2xl font-bold text-teal-700">{caseOutcomes.verified_completed_cases ?? 0}</p>
              <span className="text-xs text-slate-400">EHR / claim / member verified</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Care Completion Rate</span>
              <p className="mt-2 text-2xl font-bold text-teal-700">
                {((caseOutcomes.completion_rate ?? 0) * 100).toFixed(1)}%
              </p>
              <span className="text-xs text-slate-400">Target: &gt;60%</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Intervention Success</span>
              <p className="mt-2 text-2xl font-bold text-indigo-700">
                {((caseOutcomes.intervention_success_rate ?? 0) * 100).toFixed(1)}%
              </p>
              <span className="text-xs text-slate-400">{caseOutcomes.successful_interventions ?? 0} successful</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
