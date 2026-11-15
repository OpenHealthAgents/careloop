import { createHash } from "crypto";
import { PolicyProposal, PolicyVersionRecord } from "./contracts";
import { assertHumanGovernanceAuthority } from "./invariants";

/**
 * Builds an immutable semantic version record for an approved policy proposal.
 */
export function buildPolicyVersionRecord(
  proposal: PolicyProposal,
  publishingUser: { id: string; role: string; name?: string }
): PolicyVersionRecord {
  // Strict invariant: only human supervisors / admins can publish a policy version
  assertHumanGovernanceAuthority(publishingUser.role, "VERSION");

  if (!proposal.humanReview || proposal.humanReview.decision !== "APPROVE") {
    throw new Error("Cannot generate policy version: Human supervisor approval is required.");
  }

  // Parse baseline version to determine semver increment
  const parts = proposal.baselinePolicyVersion.split(".").map(Number);
  const major = parts[0] || 2;
  const minor = (parts[1] || 0) + 1;
  const patch = 0;
  const newVersion = `${major}.${minor}.${patch}`;

  // Compute immutable SHA-256 hash
  const payloadToHash = JSON.stringify({
    version: newVersion,
    tenantId: proposal.tenantId,
    scope: proposal.scope,
    rules: proposal.proposedRules,
    parameters: proposal.parameterAdjustments,
    approvedBy: proposal.humanReview.reviewerUserId,
    approvedAt: proposal.humanReview.reviewedAt,
  });

  const rulesHash = createHash("sha256").update(payloadToHash).digest("hex");
  const manifestId = `manifest-policy-${newVersion}-${rulesHash.slice(0, 8)}`;

  const changelog = [
    `Policy update to version ${newVersion} for scope ${proposal.scope}`,
    `Approved by supervisor ${proposal.humanReview.reviewerName} (${proposal.humanReview.reviewerRole})`,
    `Rules updated: ${proposal.proposedRules.map((r) => r.id).join(", ")}`,
    `Rationale: ${proposal.expectedBenefitsRationale}`,
  ];

  return {
    version: newVersion,
    rulesHash,
    manifestId,
    parentVersion: proposal.baselinePolicyVersion,
    changelog,
    publishedAt: new Date().toISOString(),
    publishedByUserId: publishingUser.id,
  };
}
