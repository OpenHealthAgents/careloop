import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { enforceTenantRetentionPolicy } from "@/services/retention-service";

const EnforceRetentionSchema = z.object({
  dryRun: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "tenant.manage");
    const body = EnforceRetentionSchema.parse(await request.json().catch(() => ({})));
    const result = await enforceTenantRetentionPolicy({
      session,
      dryRun: body.dryRun,
      correlationId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
