import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { ingestReferralsFromCsv } from "@/services/ingestion-service";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

const IngestCsvSchema = z.object({
  fileName: z.string().min(1).default("referrals-upload.csv"),
  csvText: z.string().min(10, "CSV content is required").max(MAX_CSV_BYTES, "CSV exceeds 5 MB limit"),
  fileSizeBytes: z.number().int().positive().max(MAX_CSV_BYTES, "CSV file exceeds 5 MB limit").optional(),
});

async function extractUploadPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("Missing CSV file in multipart upload field 'file'");
    }
    if (file.size > MAX_CSV_BYTES) {
      throw new ValidationError("Uploaded CSV file exceeds maximum allowed size of 5 MB");
    }
    return {
      fileName: file.name,
      csvText: await file.text(),
      fileSizeBytes: file.size,
    };
  }

  return IngestCsvSchema.parse(await request.json());
}

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, PERMISSIONS.REFERRALS_READ);
    const batches = await prisma.ingestionBatch.findMany({
      where: { tenantId: session.tenantId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return NextResponse.json({ batches });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(
      request,
      PERMISSIONS.REFERRALS_MANAGE
    );
    const body = await extractUploadPayload(request);
    const result = await ingestReferralsFromCsv({
      session,
      fileName: body.fileName,
      csvText: body.csvText,
      fileSizeBytes: body.fileSizeBytes,
      correlationId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
