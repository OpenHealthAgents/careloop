import { AuthorizationError, ValidationError } from "@/lib/errors";

export interface RetryPolicyOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  operationName?: string;
}

export class OperationTimeoutError extends ValidationError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' exceeded timeout of ${timeoutMs}ms.`);
  }
}

/**
 * Determines whether an error is transient and safe to retry.
 * Non-retryable: validation, authentication, authorization, policy rejections.
 * Retryable: network errors, HTTP 429 rate limits, 503/504 server overloads.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AuthorizationError || error instanceof ValidationError) {
    return false;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("429") || msg.includes("rate limit")) return true;
    if (msg.includes("503") || msg.includes("504") || msg.includes("timeout")) return true;
    if (msg.includes("econnreset") || msg.includes("fetch failed") || msg.includes("network")) return true;
  }
  return false;
}

/**
 * Computes exponential backoff with full randomized jitter to prevent thundering herd.
 */
export function computeJitteredBackoff(attempt: number, baseDelayMs = 100, maxDelayMs = 2000): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  // 50% to 100% jitter
  return Math.round(exponential * (0.5 + 0.5 * Math.random()));
}

/**
 * Executes an asynchronous function with full jitter exponential backoff retry
 * and per-attempt timeout enforcement via AbortController.
 */
export async function executeWithRetryAndTimeout<T>(
  action: (signal: AbortSignal) => Promise<T>,
  options?: RetryPolicyOptions
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 100;
  const maxDelayMs = options?.maxDelayMs ?? 2000;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const opName = options?.operationName ?? "anonymous_operation";

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new OperationTimeoutError(opName, timeoutMs));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([action(controller.signal), timeoutPromise]);
      return result;
    } catch (err) {
      lastError = err;
      const canRetry = attempt < maxAttempts - 1 && isRetryableError(err);
      if (!canRetry) {
        throw err;
      }
      const delay = computeJitteredBackoff(attempt, baseDelayMs, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw lastError;
}
