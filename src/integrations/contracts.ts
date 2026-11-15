export type IntegrationMode = "MOCK" | "DETERMINISTIC" | "LIVE";

export interface IntegrationAdapter {
  readonly name: string;
  readonly mode: IntegrationMode;
  healthCheck(): Promise<{ healthy: boolean; details?: string }>;
}

export interface CommunicationIntegration extends IntegrationAdapter {
  send(params: {
    to: string;
    channel: "SMS" | "PHONE" | "EMAIL" | "PORTAL" | "IN_PERSON_NAVIGATOR";
    body: string;
    subject?: string;
  }): Promise<{ delivered: boolean; externalMessageId: string }>;
}

export interface IngestionIntegration<TRecord = unknown> extends IntegrationAdapter {
  parse(payload: string): Promise<TRecord[]>;
}
