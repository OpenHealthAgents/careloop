import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentSession, SessionUser } from "@/lib/auth/session";
import { Permission, requirePermission } from "@/lib/auth/rbac";
import { AppError, AuthenticationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export interface RequestContext {
  session: SessionUser;
  correlationId: string;
}

export async function requireRequestContext(
  request: Request,
  permission?: Permission
): Promise<RequestContext> {
  const correlationId = request.headers.get("x-correlation-id") || randomUUID();
  const session = await getCurrentSession();
  if (!session) {
    throw new AuthenticationError("Authentication required. Please sign in.");
  }
  if (permission) {
    requirePermission(session, permission);
  }
  return { session, correlationId };
}

export function getCorrelationId(request: Request): string {
  return request.headers.get("x-correlation-id") || randomUUID();
}

export function toErrorResponse(error: unknown, correlationId?: string): NextResponse {
  if (error instanceof AppError) {
    logger.warn(
      "api.app_error",
      { code: error.code, statusCode: error.statusCode, message: error.message },
      { correlationId }
    );
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        correlationId,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Input validation failed",
          details: error.flatten(),
        },
        correlationId,
      },
      { status: 400 }
    );
  }

  logger.error(
    "api.unexpected_error",
    { message: error instanceof Error ? error.message : "Unknown error" },
    { correlationId }
  );
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected internal error occurred",
      },
      correlationId,
    },
    { status: 500 }
  );
}
