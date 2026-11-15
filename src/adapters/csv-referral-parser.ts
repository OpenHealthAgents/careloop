import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import {
  IngestionRowError,
  NormalizedIngestionParseResult,
  ReferralIngestionAdapter,
} from "./ingestion-adapter";

export const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_CSV_ROWS = 2000;

export const CsvReferralRowSchema = z.object({
  externalMemberId: z.string().min(1, "member_id is required"),
  firstName: z.string().min(1, "first_name is required"),
  lastName: z.string().min(1, "last_name is required"),
  dobYear: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : undefined))
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 1900 && v <= 2026), {
      message: "dob_year must be a valid year",
    }),
  externalReferralId: z.string().min(1, "referral_id is required"),
  referralDate: z
    .string()
    .min(1, "referral_date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: "referral_date must be a valid ISO date",
    }),
  behavioralHealthNeed: z.string().min(1, "behavioral_health_need is required"),
  specialty: z.string().min(1, "specialty is required"),
  urgency: z.enum(["ROUTINE", "PRIORITY", "EXPEDITED"]).default("ROUTINE"),
  geography: z.string().min(1, "geography is required"),
  urbanicity: z.enum(["URBAN", "SUBURBAN", "RURAL", "UNKNOWN"]).default("UNKNOWN"),
  networkRequired: z.string().min(1, "network is required"),
  coverageType: z
    .enum(["MEDICAID", "MEDICARE_ADVANTAGE", "COMMERCIAL", "DUAL_ELIGIBLE", "UNKNOWN"])
    .default("UNKNOWN"),
  eligibilityVerified: z.enum(["VERIFIED", "UNVERIFIED", "UNKNOWN"], {
    required_error: "eligibility_verified is required (VERIFIED | UNVERIFIED | UNKNOWN)",
  }),
  preferredLanguage: z.string().min(1, "preferred_language is required"),
  preferredContactChannel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL", "UNKNOWN"]).default("UNKNOWN"),
  consentSms: z
    .string()
    .optional()
    .transform((v) => (v ? v.toLowerCase() === "true" || v === "1" : false)),
  digitalAccessLevel: z.enum(["HIGH", "LIMITED", "NONE", "UNKNOWN"]).default("UNKNOWN"),
  transportationAccess: z.enum(["RELIABLE", "LIMITED", "NONE", "UNKNOWN"]).default("UNKNOWN"),
  priorNoShowCount: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : 0))
    .refine((v) => !Number.isNaN(v) && v >= 0, {
      message: "prior_no_show_count must be >= 0",
    }),
  referringProviderName: z.string().optional(),
  operationalNotes: z.string().optional(),
});

export type ParsedCsvReferralRow = z.infer<typeof CsvReferralRowSchema>;

export interface CsvParseResult {
  validRows: Array<{ rowNumber: number; data: ParsedCsvReferralRow }>;
  errors: IngestionRowError[];
  totalRows: number;
}

export function sanitizeCsvFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "upload.csv";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  if (!cleaned.toLowerCase().endsWith(".csv")) {
    throw new ValidationError("Only .csv files are permitted for referral ingestion.");
  }
  return cleaned;
}

export function validateCsvPayloadSecurity(fileName: string, csvText: string, fileSizeBytes?: number): string {
  const safeName = sanitizeCsvFileName(fileName);
  const actualBytes = fileSizeBytes ?? Buffer.byteLength(csvText, "utf8");
  if (actualBytes > MAX_CSV_BYTES) {
    throw new ValidationError(`Uploaded CSV exceeds maximum allowed size of ${MAX_CSV_BYTES / (1024 * 1024)} MB.`);
  }
  if (csvText.includes("\0")) {
    throw new ValidationError("Uploaded file contains invalid binary/null bytes.");
  }
  return safeName;
}

/**
 * Prevents spreadsheet formula injection when exporting failed-row CSV reports.
 */
export function sanitizeCsvCellForExport(value: unknown): string {
  const str = String(value ?? "");
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  const escaped = neutralized.replace(/"/g, '""');
  return `"${escaped}"`;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

const HEADER_ALIASES: Record<string, string> = {
  member_id: "externalMemberId",
  external_member_id: "externalMemberId",
  member_identifier: "externalMemberId",
  first_name: "firstName",
  last_name: "lastName",
  dob_year: "dobYear",
  referral_id: "externalReferralId",
  external_referral_id: "externalReferralId",
  referral_identifier: "externalReferralId",
  referral_date: "referralDate",
  behavioral_health_need: "behavioralHealthNeed",
  specialty: "specialty",
  urgency: "urgency",
  geography: "geography",
  urbanicity: "urbanicity",
  network: "networkRequired",
  network_required: "networkRequired",
  coverage_type: "coverageType",
  eligibility: "eligibilityVerified",
  eligibility_status: "eligibilityVerified",
  eligibility_information: "eligibilityVerified",
  eligibility_verified: "eligibilityVerified",
  preferred_language: "preferredLanguage",
  language: "preferredLanguage",
  preferred_contact_channel: "preferredContactChannel",
  consent_sms: "consentSms",
  digital_access_level: "digitalAccessLevel",
  transportation_access: "transportationAccess",
  prior_no_show_count: "priorNoShowCount",
  referring_provider_name: "referringProviderName",
  operational_notes: "operationalNotes",
  tenant_id: "__forbiddenTenantId",
  tenantid: "__forbiddenTenantId",
};

export function parseReferralCsv(csvText: string): CsvParseResult {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return {
      validRows: [],
      errors: [
        {
          rowNumber: 1,
          errorType: "VALIDATION_ERROR",
          message: "CSV must include a header row and at least one referral row.",
        },
      ],
      totalRows: 0,
    };
  }

  const dataRowCount = lines.length - 1;
  if (dataRowCount > MAX_CSV_ROWS) {
    throw new ValidationError(
      `CSV contains ${dataRowCount} rows, exceeding the maximum batch size of ${MAX_CSV_ROWS} rows.`
    );
  }

  const rawHeaders = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const mappedHeaders = rawHeaders.map((h) => HEADER_ALIASES[h] ?? h);

  const validRows: CsvParseResult["validRows"] = [];
  const errors: IngestionRowError[] = [];
  const seenReferralIds = new Set<string>();

  for (let idx = 1; idx < lines.length; idx += 1) {
    const rowNumber = idx + 1;
    const values = splitCsvLine(lines[idx]);
    const rawRow: Record<string, string> = {};
    const record: Record<string, string> = {};

    mappedHeaders.forEach((key, colIdx) => {
      const val = values[colIdx];
      if (val !== undefined && val !== "") {
        rawRow[rawHeaders[colIdx] ?? key] = val;
        record[key] = val;
      }
    });

    // Security control: Uploaded CSV rows MUST NOT supply or override tenant_id
    if (record.__forbiddenTenantId !== undefined) {
      errors.push({
        rowNumber,
        externalReferralId: record.externalReferralId,
        errorType: "SECURITY_VIOLATION",
        message: "Uploaded data cannot specify tenant_id; tenant isolation is enforced server-side.",
        rawRow,
      });
      continue;
    }

    const parsed = CsvReferralRowSchema.safeParse(record);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      errors.push({
        rowNumber,
        externalReferralId: record.externalReferralId,
        errorType: "VALIDATION_ERROR",
        message: msg,
        rawRow,
      });
      continue;
    }

    if (seenReferralIds.has(parsed.data.externalReferralId)) {
      errors.push({
        rowNumber,
        externalReferralId: parsed.data.externalReferralId,
        errorType: "DUPLICATE_IN_FILE",
        message: `Duplicate referral_id '${parsed.data.externalReferralId}' within uploaded CSV file.`,
        rawRow,
      });
      continue;
    }

    seenReferralIds.add(parsed.data.externalReferralId);
    validRows.push({ rowNumber, data: parsed.data });
  }

  return {
    validRows,
    errors,
    totalRows: dataRowCount,
  };
}

export interface CsvIngestionInput {
  fileName: string;
  csvText: string;
  fileSizeBytes?: number;
}

export class CsvReferralIngestionAdapter implements ReferralIngestionAdapter<CsvIngestionInput> {
  public readonly sourceType = "CSV" as const;

  async parseAndValidate(input: CsvIngestionInput): Promise<NormalizedIngestionParseResult> {
    const safeFileName = validateCsvPayloadSecurity(
      input.fileName,
      input.csvText,
      input.fileSizeBytes
    );
    const parsed = parseReferralCsv(input.csvText);
    return {
      sourceType: this.sourceType,
      fileName: safeFileName,
      totalRows: parsed.totalRows,
      validRows: parsed.validRows.map((r) => ({
        rowNumber: r.rowNumber,
        externalReferralId: r.data.externalReferralId,
        data: r.data,
      })),
      errors: parsed.errors,
    };
  }
}
