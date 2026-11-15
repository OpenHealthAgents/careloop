/**
 * ============================================================================
 * BATCH EXECUTION PROCESSOR
 * ============================================================================
 * Executes bulk operations (e.g. referral triage, risk evaluations) in
 * controlled concurrent batches to optimize network throughput and prevent
 * connection pool exhaustion.
 * ============================================================================
 */

export interface BatchItemResult<T> {
  index: number;
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

export interface BatchExecutionSummary<T> {
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  results: BatchItemResult<T>[];
}

export async function batchExecute<TItem, TResult>(
  items: TItem[],
  processor: (item: TItem, index: number) => Promise<TResult>,
  options?: { concurrency?: number }
): Promise<BatchExecutionSummary<TResult>> {
  const startedAt = Date.now();
  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 5, 20));
  const results: BatchItemResult<TResult>[] = new Array(items.length);

  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const idx = currentIndex;
      currentIndex += 1;

      const itemStart = Date.now();
      try {
        const data = await processor(items[idx], idx);
        results[idx] = {
          index: idx,
          success: true,
          data,
          durationMs: Date.now() - itemStart,
        };
      } catch (err) {
        results[idx] = {
          index: idx,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error in batch worker",
          durationMs: Date.now() - itemStart,
        };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;

  return {
    total: items.length,
    succeeded,
    failed,
    durationMs: Date.now() - startedAt,
    results,
  };
}
