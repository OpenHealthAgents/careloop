import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Evidence, EvidenceStore } from "./contracts";

export * from "./contracts";

export function hashEvidencePayload(payload: unknown): string {
  const serialized = JSON.stringify(payload ?? {});
  return createHash("sha256").update(serialized).digest("hex");
}

export class InMemoryEvidenceStore implements EvidenceStore {
  record(
    input: Omit<Evidence, "id" | "payloadHash" | "capturedAt"> & { payload?: unknown }
  ): Evidence {
    return {
      id: randomUUID(),
      caseId: input.caseId,
      tenantId: input.tenantId,
      sourceType: input.sourceType,
      summary: input.summary,
      payloadHash: hashEvidencePayload(input.payload ?? { summary: input.summary }),
      capturedAt: new Date().toISOString(),
      capturedBy: input.capturedBy,
      metadata: input.metadata,
    };
  }

  verifyIntegrity(evidence: Evidence, payload: unknown): boolean {
    return hashEvidencePayload(payload) === evidence.payloadHash;
  }
}

export class PrismaEvidenceStore {
  async record(input: {
    tenantId: string;
    caseId: string;
    agentRunId?: string | null;
    toolExecutionSpanId?: string | null;
    sourceType: string;
    summary: string;
    payload?: Prisma.InputJsonValue;
    capturedBy: string;
  }) {
    const payload = input.payload ?? { summary: input.summary };
    const payloadHash = hashEvidencePayload(payload);
    return prisma.evidence.create({
      data: {
        tenantId: input.tenantId,
        caseId: input.caseId,
        agentRunId: input.agentRunId ?? null,
        toolExecutionSpanId: input.toolExecutionSpanId ?? null,
        sourceType: input.sourceType,
        summary: input.summary,
        payloadHash,
        payload,
        capturedBy: input.capturedBy,
      },
    });
  }

  async listForCase(tenantId: string, caseId: string) {
    return prisma.evidence.findMany({
      where: { tenantId, caseId, deletedAt: null },
      orderBy: { capturedAt: "desc" },
    });
  }

  async softDelete(tenantId: string, id: string) {
    return prisma.evidence.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}

export const evidenceStore = new InMemoryEvidenceStore();
export const prismaEvidenceStore = new PrismaEvidenceStore();
