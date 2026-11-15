import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { addCaseNote } from "@/services/case-service";

const CreateCaseNoteSchema = z.object({
  category: z
    .enum(["COORDINATION", "BARRIER_DISCOVERY", "OUTREACH", "ESCALATION", "CLOSURE"])
    .default("COORDINATION"),
  content: z.string().trim().min(3).max(4000),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const { id } = await context.params;

    const existing = await prisma.case.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Case", id);

    const notes = await prisma.caseNote.findMany({
      where: { caseId: id, tenantId: session.tenantId },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ notes });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.manage");
    const { id } = await context.params;
    const body = CreateCaseNoteSchema.parse(await request.json());

    const note = await addCaseNote({
      session,
      caseId: id,
      category: body.category,
      content: body.content,
      correlationId,
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
