/**
 * ============================================================================
 * EVENT IDEMPOTENCY STORE
 * ============================================================================
 * Guarantees at-most-once processing of events:
 * - Prevents duplicate state machine transitions
 * - Prevents repeated outreach to members on duplicate event arrival
 * - Returns cached EventProcessingResult on duplicate redeliveries
 * ============================================================================
 */

import { createHash } from "crypto";
import { EventProcessingResult } from "./contracts";

interface StoredIdempotencyRecord {
  key: string;
  processedAt: number;
  expiresAt: number;
  result: EventProcessingResult;
}

export class EventIdempotencyStore {
  private readonly records = new Map<string, StoredIdempotencyRecord>();
  private readonly defaultTtlMs: number;

  constructor(options?: { defaultTtlMs?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Generates a stable, collision-resistant idempotency key for an event.
   */
  public generateKey(
    tenantId: string,
    eventType: string,
    entityId: string,
    disambiguator?: string | number
  ): string {
    const raw = `${tenantId}:${eventType}:${entityId}:${disambiguator ?? "default"}`;
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 24);
    return `evt-${hash}`;
  }

  /**
   * Checks whether an event key has already been processed.
   */
  public async isProcessed(
    tenantId: string,
    eventType: string,
    idempotencyKey: string
  ): Promise<{ processed: boolean; cachedResult?: EventProcessingResult }> {
    const key = `${tenantId}:${eventType}:${idempotencyKey}`;
    const record = this.records.get(key);

    if (!record) {
      return { processed: false };
    }

    if (Date.now() > record.expiresAt) {
      this.records.delete(key);
      return { processed: false };
    }

    return {
      processed: true,
      cachedResult: {
        ...record.result,
        replayed: true,
      },
    };
  }

  /**
   * Records that an event has been processed successfully.
   */
  public async recordProcessing(
    tenantId: string,
    eventType: string,
    idempotencyKey: string,
    result: EventProcessingResult,
    ttlMs?: number
  ): Promise<void> {
    const key = `${tenantId}:${eventType}:${idempotencyKey}`;
    const now = Date.now();
    this.records.set(key, {
      key,
      processedAt: now,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
      result,
    });
  }

  /**
   * Clears all idempotency records (useful for test isolation).
   */
  public clear(): void {
    this.records.clear();
  }
}

export const eventIdempotencyStore = new EventIdempotencyStore();
