import { describe, expect, it } from "vitest";
import { redactSensitiveFields } from "@/lib/logger";

describe("PHI-Aware Structured Logger Redaction", () => {
  it("redacts sensitive member identifiers and PHI keys recursively", () => {
    const input = {
      caseId: "case-123",
      riskTier: "HIGH",
      member: {
        firstName: "Elena",
        lastName: "Navarro",
        dobYear: 1984,
        phone: "555-0199",
        raceEthnicityCohort: "Hispanic",
      },
      passwordHash: "secret:hash",
    };

    const output = redactSensitiveFields(input) as Record<string, any>;
    expect(output.caseId).toBe("case-123");
    expect(output.riskTier).toBe("HIGH");
    expect(output.member.firstName).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(output.member.lastName).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(output.member.dobYear).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(output.member.phone).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(output.member.raceEthnicityCohort).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(output.passwordHash).toBe("[REDACTED_PHI_OR_SECRET]");
  });
});
