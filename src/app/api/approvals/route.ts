import { NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { listTenantApprovals } from "@/services/approval-service";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "ai.review");
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const statusFilter =
      statusParam && Object.values(ApprovalStatus).includes(statusParam as ApprovalStatus)
        ? (statusParam as ApprovalStatus)
        : undefined;

    const approvals = await listTenantApprovals(session, statusFilter);
    return NextResponse.json({ approvals });
  } catch (err) {
    return toErrorResponse(err);
  }
}
