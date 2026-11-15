import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { evaluateMultiArmExperiment } from "@/services/experimentation-service";

export async function GET(request: Request) {
  try {
    await requireRequestContext(request, "dashboard.read");
    const url = new URL(request.url);

    const popParam = url.searchParams.get("population");
    const durParam = url.searchParams.get("duration");
    const seedParam = url.searchParams.get("seed");

    const totalPopulation = popParam ? parseInt(popParam, 10) : undefined;
    const durationMonths = durParam ? parseInt(durParam, 10) : undefined;
    const seed = seedParam ? parseInt(seedParam, 10) : undefined;

    const result = evaluateMultiArmExperiment({
      totalPopulation,
      durationMonths,
      seed,
    });

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestContext(request, "dashboard.read");
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // default empty body
    }

    const result = evaluateMultiArmExperiment({
      totalPopulation: body.totalPopulation,
      durationMonths: body.durationMonths,
      seed: body.seed,
      armWeights: body.armWeights,
    });

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
