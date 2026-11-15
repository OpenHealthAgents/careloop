import {
  CommunicationAdapter,
  CommunicationChannelAdapter,
  CommunicationDispatchRequest,
  CommunicationDispatchResult,
  SupportedCommunicationChannel,
} from "../contracts";

/**
 * Checks whether live external message delivery is explicitly enabled via config.
 * CareLoop MVP defaults safely to MOCK mode so external SMS/Email never fires accidentally.
 */
export function isLiveCommunicationConfigured(): boolean {
  return (
    process.env.COMMUNICATION_DELIVERY_MODE === "live" &&
    process.env.ALLOW_LIVE_COMMUNICATIONS === "true"
  );
}

/**
 * Development / Mock SMS channel adapter.
 * Records mock delivery cleanly unless explicit live gateway is configured.
 */
export class SmsChannelAdapter implements CommunicationChannelAdapter {
  public readonly channel: SupportedCommunicationChannel = "SMS";
  public readonly providerKey = "careloop-sms-mock";
  public readonly displayName = "SMS Text Messaging";

  async send(request: CommunicationDispatchRequest): Promise<CommunicationDispatchResult> {
    const mode = isLiveCommunicationConfigured() ? "LIVE" : "MOCK";
    if (!request.consentVerified) {
      return {
        dispatched: false,
        deliveryStatus: "FAILED",
        deliveryMode: mode,
        channel: "SMS",
        providerKey: this.providerKey,
        reason: "SMS consent is not enabled; choose Portal, Phone, or Email instead.",
      };
    }

    return {
      dispatched: true,
      deliveryStatus: "DELIVERED",
      deliveryMode: mode,
      channel: "SMS",
      providerKey: this.providerKey,
      externalMessageId: `mock-sms-${Date.now()}`,
      reason: mode === "MOCK" ? "Simulated by MVP mock SMS provider (no live message sent)." : undefined,
    };
  }
}

/**
 * Development / Mock Email channel adapter.
 */
export class EmailChannelAdapter implements CommunicationChannelAdapter {
  public readonly channel: SupportedCommunicationChannel = "EMAIL";
  public readonly providerKey = "careloop-email-mock";
  public readonly displayName = "Email Notification";

  async send(request: CommunicationDispatchRequest): Promise<CommunicationDispatchResult> {
    const mode = isLiveCommunicationConfigured() ? "LIVE" : "MOCK";
    if (!request.consentVerified) {
      return {
        dispatched: false,
        deliveryStatus: "FAILED",
        deliveryMode: mode,
        channel: "EMAIL",
        providerKey: this.providerKey,
        reason: "Outreach consent is paused on member preferences.",
      };
    }

    return {
      dispatched: true,
      deliveryStatus: "SENT",
      deliveryMode: mode,
      channel: "EMAIL",
      providerKey: this.providerKey,
      externalMessageId: `mock-email-${Date.now()}`,
      reason: mode === "MOCK" ? "Simulated by MVP mock Email provider (no live email sent)." : undefined,
    };
  }
}

/**
 * Development / Mock Phone callback adapter.
 */
export class PhoneChannelAdapter implements CommunicationChannelAdapter {
  public readonly channel: SupportedCommunicationChannel = "PHONE";
  public readonly providerKey = "careloop-voice-callback-mock";
  public readonly displayName = "Phone Call / Care Team Callback";

  async send(request: CommunicationDispatchRequest): Promise<CommunicationDispatchResult> {
    const mode = isLiveCommunicationConfigured() ? "LIVE" : "MOCK";
    if (!request.consentVerified) {
      return {
        dispatched: false,
        deliveryStatus: "FAILED",
        deliveryMode: mode,
        channel: "PHONE",
        providerKey: this.providerKey,
        reason: "Phone outreach consent is paused on member preferences.",
      };
    }

    return {
      dispatched: true,
      deliveryStatus: "SENT",
      deliveryMode: mode,
      channel: "PHONE",
      providerKey: this.providerKey,
      externalMessageId: `mock-phone-${Date.now()}`,
      reason: mode === "MOCK" ? "Simulated phone outreach task (mock mode)." : undefined,
    };
  }
}

/**
 * In-App Member Portal messaging channel adapter.
 */
export class PortalChannelAdapter implements CommunicationChannelAdapter {
  public readonly channel: SupportedCommunicationChannel = "PORTAL";
  public readonly providerKey = "careloop-in-app-portal";
  public readonly displayName = "In-App Member Portal";

  async send(): Promise<CommunicationDispatchResult> {
    const mode = isLiveCommunicationConfigured() ? "LIVE" : "MOCK";
    return {
      dispatched: true,
      deliveryStatus: "DELIVERED",
      deliveryMode: mode,
      channel: "PORTAL",
      providerKey: this.providerKey,
      externalMessageId: `portal-${Date.now()}`,
    };
  }
}

/**
 * Extensible channel-agnostic communication dispatcher.
 * Defaults strictly to development/mock provider unless explicitly configured for live delivery.
 */
export class CommunicationDispatcher implements CommunicationAdapter {
  private readonly adapters = new Map<SupportedCommunicationChannel, CommunicationChannelAdapter>();

  public readonly descriptor = {
    key: "communication-dispatcher",
    name: "CareLoop Pluggable Communication Dispatcher",
    category: "Communication" as const,
    status: "MVP_ACTIVE" as const,
    description:
      "Routes outbound/member communications through registered In-App, Email, SMS, and Phone adapters with safe MVP mock mode.",
  };

  constructor(initialAdapters?: CommunicationChannelAdapter[]) {
    const defaults: CommunicationChannelAdapter[] = initialAdapters ?? [
      new SmsChannelAdapter(),
      new EmailChannelAdapter(),
      new PhoneChannelAdapter(),
      new PortalChannelAdapter(),
    ];
    for (const adapter of defaults) {
      this.registerAdapter(adapter);
    }
  }

  registerAdapter(adapter: CommunicationChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  getAdapter(channel: SupportedCommunicationChannel): CommunicationChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  listSupportedChannels(): Array<{
    channel: SupportedCommunicationChannel;
    providerKey: string;
    displayName: string;
  }> {
    return Array.from(this.adapters.values()).map((a) => ({
      channel: a.channel,
      providerKey: a.providerKey,
      displayName: a.displayName,
    }));
  }

  async sendMessage(request: CommunicationDispatchRequest): Promise<CommunicationDispatchResult> {
    const adapter = this.adapters.get(request.channel);
    if (!adapter) {
      return {
        dispatched: false,
        deliveryStatus: "FAILED",
        deliveryMode: isLiveCommunicationConfigured() ? "LIVE" : "MOCK",
        channel: request.channel,
        providerKey: "unregistered",
        reason: `No communication adapter registered for channel ${request.channel}.`,
      };
    }
    return adapter.send(request);
  }
}

export function createDefaultCommunicationDispatcher(): CommunicationDispatcher {
  return new CommunicationDispatcher();
}
