import { NextResponse } from "next/server";
import { z } from "zod";
import { CsvReferralIngestionAdapter } from "@/adapters/csv-referral-parser";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { ValidationError } from "@/lib/errors";
import { previewWithAdapter } from "@/services/ingestion-service";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

const JsonPreviewSchema = z.object({
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

  return JsonPreviewSchema.parse(await request.json());
}

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, PERMISSIONS.REFERRALS_MANAGE);
    const payload = await extractUploadPayload(request);
    const preview = await previewWithAdapter(
      new CsvReferralIngestionAdapter(),
      payload,
      session.tenantId
    );
    return NextResponse.json({ preview });
  } catch (err) {
    return toErrorResponse(err);
  }
}
