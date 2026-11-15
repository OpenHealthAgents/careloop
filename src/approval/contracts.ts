import type { ApprovalStatus, RiskLevel } from "@prisma/client";

export type { ApprovalStatus };

export interface Approval {
  id: string;
  tenantId: string;
  caseId: string;
  action: string;
  reason: string;
  riskLevel: RiskLevel;
  requestedBy: string;
  requestedAt: Date;
  status: ApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  decision?: string | null;
  comments?: string | null;
}

export interface ApprovalEngine {
  createRequest(params: {
    tenantId: string;
    caseId: string;
    action: string;
    reason: string;
    riskLevel: RiskLevel;
    requestedBy: string;
  }): Promise<Approval>;
}
