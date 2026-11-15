import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { runFounderDemo, FounderDemoSceneId } from "@/simulation/founder-demo";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");

    const url = new URL(request.url);
    const sceneParam = url.searchParams.get("scene") as FounderDemoSceneId | null;
    const batchParam = url.searchParams.get("batchSize");

    const batchSize = batchParam ? parseInt(batchParam, 10) : 500;
    const demo = runFounderDemo({ batchSize });

    if (sceneParam) {
      const matchedScene = demo.scenes.find((s) => s.id === sceneParam || s.title.toLowerCase().includes(sceneParam.toLowerCase()));
      if (matchedScene) {
        return NextResponse.json({
          environment: "CareLoop Founder Demo Lab",
          tenantId: session.tenantId,
          scene: matchedScene,
        });
      }
    }

    return NextResponse.json({
      environment: "CareLoop Founder Demo Lab",
      tenantId: session.tenantId,
      demo,
      guarantees: {
        scriptedFounderNarrative: true,
        zeroRealPhi: true,
        stateMachineCompliant: true,
        tamperEvidentAuditTrail: true,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
