import { afterEach, describe, expect, it } from "vitest";
import { CommunicationMessageType, ReadingLevel } from "@prisma/client";
import {
  CommunicationDispatcher,
  createDefaultCommunicationDispatcher,
  isLiveCommunicationConfigured,
} from "@/adapters/communication/channel-registry";
import { CommunicationChannelAdapter } from "@/adapters/contracts";
import { AIPolicyViolationError, DeterministicAIProvider, enforceCommunicationPolicy } from "@/ai";
import {
  CANONICAL_MESSAGE_TYPES,
  renderCommunicationTemplate,
} from "@/domain/communications/templates";
import { validateOutboundCommunication } from "@/domain/communications/validator";
import { ValidationError } from "@/lib/errors";

describe("Communication Channel Abstraction, Templates, Reading Levels & Validation", () => {
  afterEach(() => {
    delete process.env.COMMUNICATION_DELIVERY_MODE;
    delete process.env.ALLOW_LIVE_COMMUNICATIONS;
  });

  it("defaults safely to MOCK delivery mode unless explicitly configured for live delivery", async () => {
    expect(isLiveCommunicationConfigured()).toBe(false);
    const dispatcher = createDefaultCommunicationDispatcher();

    expect(dispatcher.listSupportedChannels().map((c) => c.channel)).toEqual([
      "SMS",
      "EMAIL",
      "PHONE",
      "PORTAL",
    ]);

    const smsRes = await dispatcher.sendMessage({
      channel: "SMS",
      language: "English",
      messageBody: "Reminder for Tuesday visit",
      consentVerified: true,
    });
    expect(smsRes.dispatched).toBe(true);
    expect(smsRes.deliveryMode).toBe("MOCK");
    expect(smsRes.providerKey).toBe("careloop-sms-mock");

    const blockedSms = await dispatcher.sendMessage({
      channel: "SMS",
      language: "English",
      messageBody: "Reminder for Tuesday visit",
      consentVerified: false,
    });
    expect(blockedSms.dispatched).toBe(false);
    expect(blockedSms.deliveryStatus).toBe("FAILED");

    process.env.COMMUNICATION_DELIVERY_MODE = "live";
    process.env.ALLOW_LIVE_COMMUNICATIONS = "true";
    expect(isLiveCommunicationConfigured()).toBe(true);
    const liveRes = await dispatcher.sendMessage({
      channel: "EMAIL",
      language: "Spanish",
      subject: "Recordatorio",
      messageBody: "Hola",
      consentVerified: true,
    });
    expect(liveRes.deliveryMode).toBe("LIVE");
  });

  it("renders all 9 message types with language and reading-level adaptation cleanly", () => {
    expect(CANONICAL_MESSAGE_TYPES).toHaveLength(9);

    for (const messageType of CANONICAL_MESSAGE_TYPES) {
      const enSimple = renderCommunicationTemplate({
        messageType,
        language: "English",
        readingLevel: ReadingLevel.SIMPLE,
        memberFirstName: "Elena",
        specialty: "Outpatient Therapy",
        providerName: "Dr. Rivera",
        appointmentDateText: "Tue 10:00 AM",
      });
      const esStandard = renderCommunicationTemplate({
        messageType,
        language: "Spanish",
        readingLevel: ReadingLevel.STANDARD,
        memberFirstName: "Elena",
        specialty: "Outpatient Therapy",
        providerName: "Dr. Rivera",
        appointmentDateText: "Mar 10:00 AM",
      });

      expect(enSimple.body.length).toBeGreaterThan(10);
      expect(esStandard.body).toContain("Hola Elena");
      expect(enSimple.templateKey).toContain(".en.simple");
      expect(esStandard.templateKey).toContain(".es.standard");
    }
  });

  it("blocks internal AI reasoning leakage and clinical claims before delivery", async () => {
    expect(() =>
      validateOutboundCommunication({
        body: "Your priority score is 88 and our AI-generated confidence: 0.91 says schedule today.",
        channel: "PORTAL",
        consentOutreach: true,
        consentSms: false,
      })
    ).toThrow(ValidationError);

    const ai = new DeterministicAIProvider("test-v1");
    const draft = await ai.generateMemberCommunication({
      memberFirstName: "Maya",
      preferredLanguage: "English",
      channel: "EMAIL",
      purpose: CommunicationMessageType.PROVIDER_OPTIONS,
      readingLevel: ReadingLevel.SIMPLE,
      specialty: "Outpatient Behavioral Health",
    });

    expect(draft.internalAiLabel).toBe("AI_GENERATED");
    expect(draft.readingLevel).toBe("SIMPLE");
    expect(() =>
      enforceCommunicationPolicy(draft, { consentSms: false, consentOutreach: true })
    ).not.toThrow();

    draft.draftMessage = "Internal model version 2 flagged your risk tier as HIGH.";
    expect(() =>
      enforceCommunicationPolicy(draft, { consentSms: false, consentOutreach: true })
    ).toThrow(AIPolicyViolationError);
  });

  it("supports registering custom channel implementations cleanly", async () => {
    const customDispatcher = new CommunicationDispatcher([]);
    const customEmail: CommunicationChannelAdapter = {
      channel: "EMAIL",
      providerKey: "sendgrid-prod",
      displayName: "SendGrid Production Email",
      async send() {
        return {
          dispatched: true,
          deliveryStatus: "SENT",
          deliveryMode: "MOCK",
          channel: "EMAIL",
          providerKey: "sendgrid-prod",
          externalMessageId: "sg-123",
        };
      },
    };
    customDispatcher.registerAdapter(customEmail);

    const res = await customDispatcher.sendMessage({
      channel: "EMAIL",
      language: "English",
      messageBody: "Your appointment is confirmed.",
      consentVerified: true,
    });
    expect(res.providerKey).toBe("sendgrid-prod");
    expect(res.externalMessageId).toBe("sg-123");
  });
});
