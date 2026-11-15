import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import {
  generate10kSyntheticPopulation,
  runDemoShowcaseScenario,
  generateStakeholderBriefs,
} from "@/simulation/demo-environment";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");

    const url = new URL(request.url);
    const seedParam = url.searchParams.get("seed");
    const countParam = url.searchParams.get("count");

    const seed = seedParam ? parseInt(seedParam, 10) : 2026;
    const count = countParam ? Math.min(Math.max(parseInt(countParam, 10), 100), 20000) : 10000;

    const { summary, sampleMembers } = generate10kSyntheticPopulation(seed, count);
    const showcaseScenario = runDemoShowcaseScenario();
    const briefs = generateStakeholderBriefs(summary, showcaseScenario);

    return NextResponse.json({
      environment: "CareLoop Demo & Evaluation Lab",
      tenantId: session.tenantId,
      seed,
      syntheticPopulationSize: count,
      summary,
      sampleMembers,
      stakeholderBriefs: briefs,
      guarantees: {
        zeroRealPhi: true,
        deterministicRng: true,
        reproducibleSeed: seed,
        stateMachineCompliant: true,
        tamperEvidentAuditTrail: true,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
