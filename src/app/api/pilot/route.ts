import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { evaluatePilotStudy } from "@/services/pilot-service";

export async function GET(request: Request) {
  try {
    await requireRequestContext(request, "dashboard.read");
    const url = new URL(request.url);

    const populationParam = url.searchParams.get("population");
    const durationParam = url.searchParams.get("duration");
    const seedParam = url.searchParams.get("seed");

    const totalPopulation = populationParam ? parseInt(populationParam, 10) : undefined;
    const durationMonths = durationParam ? parseInt(durationParam, 10) : undefined;
    const seed = seedParam ? parseInt(seedParam, 10) : undefined;

    const result = evaluatePilotStudy({
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

    const result = evaluatePilotStudy({
      totalPopulation: body.totalPopulation,
      durationMonths: body.durationMonths,
      seed: body.seed,
    });

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
