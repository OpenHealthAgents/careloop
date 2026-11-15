import { z } from "zod";

const DEV_FALLBACK_SECRET = "careloop-dev-only-secret-change-in-production-2026";

const EnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(16).default(DEV_FALLBACK_SECRET),
    PHI_ENCRYPTION_KEY: z.string().min(32).optional(),
    AI_PROVIDER_MODE: z.enum(["deterministic", "openai"]).default("deterministic"),
    AI_MODEL_NAME: z.string().default("careloop-rules-v1"),
    AI_VENDOR_NAME: z.string().default("OpenAI-Compatible-Provider"),
    AI_BAA_EXECUTED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    COMMUNICATION_DELIVERY_MODE: z.enum(["mock", "live"]).default("mock"),
    ALLOW_LIVE_COMMUNICATIONS: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    APP_DEMO_MODE: z
      .string()
      .optional()
      .transform((val) => val !== "false"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (data.AUTH_SECRET === DEV_FALLBACK_SECRET || data.AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message:
            "Production startup blocked: AUTH_SECRET must be >= 32 chars and cannot use the repository dev secret.",
        });
      }
      if (data.AI_PROVIDER_MODE === "openai" && !data.OPENAI_API_KEY?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["OPENAI_API_KEY"],
          message: "OPENAI_API_KEY is required in production when AI_PROVIDER_MODE='openai'.",
        });
      }
      if (data.AI_PROVIDER_MODE === "openai" && !data.AI_BAA_EXECUTED) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AI_BAA_EXECUTED"],
          message:
            "Production startup blocked: AI_BAA_EXECUTED=true is required before enabling external LLM transmission.",
        });
      }
    }
  });

export type AppConfig = z.infer<typeof EnvSchema>;

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  cachedConfig = parsed.data;
  return cachedConfig;
}

export function resetConfigCacheForTests(): void {
  cachedConfig = null;
}
