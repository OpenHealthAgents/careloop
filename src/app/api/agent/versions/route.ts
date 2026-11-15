import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import {
  getActiveVersionManifest,
  listVersionManifests,
  rollbackTenantVersion,
} from "@/services/version-service";

const RollbackRequestSchema = z.object({
  targetVersion: z.string().min(1),
  reason: z.string().min(5),
  correlationId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "settings.read");
    const manifests = listVersionManifests();
    const activeManifest = await getActiveVersionManifest(session.tenantId);

    return NextResponse.json({
      tenantId: session.tenantId,
      activeVersion: activeManifest.versionLabel,
      activeManifest,
      availableVersions: manifests.map((m) => ({
        manifestId: m.manifestId,
        versionLabel: m.versionLabel,
        releasedAt: m.releasedAt,
        isCurrentDefault: m.isCurrentDefault,
        signature: m.signature,
      })),
      allManifests: manifests,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "tenant.manage");
    const body = await request.json();
    const parsed = RollbackRequestSchema.parse(body);

    const result = await rollbackTenantVersion({
      session,
      targetVersion: parsed.targetVersion,
      reason: parsed.reason,
      correlationId: parsed.correlationId,
    });

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
