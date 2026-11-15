import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { runDemoShowcaseScenario } from "@/simulation/demo-environment";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");

    const scenario = runDemoShowcaseScenario();

    return NextResponse.json({
      environment: "CareLoop Demo & Evaluation Lab",
      tenantId: session.tenantId,
      scenario,
      executionStats: {
        totalSteps: scenario.timeline.length,
        totalTokens: scenario.finalOutcome.totalAiTokens,
        totalComputeCostUSD: scenario.finalOutcome.totalComputeCostUSD,
        totalDaysToCare: scenario.finalOutcome.totalDaysToCare,
        traditionalCareDaysToAppointment: scenario.finalOutcome.traditionalIndustryComparison.traditionalCareDaysToAppointment,
        careLoopCareManagerAdminMinutes: scenario.finalOutcome.traditionalIndustryComparison.careLoopCareManagerAdminMinutes,
        traditionalCareManagerAdminMinutes: scenario.finalOutcome.traditionalIndustryComparison.traditionalCareManagerAdminMinutes,
      },
      guarantees: {
        zeroRealPhi: true,
        deterministicRouting: true,
        stateMachineCompliant: true,
        tamperEvidentAuditTrail: true,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
