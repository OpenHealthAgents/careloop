import { getConfig } from "@/lib/config";
import { DeterministicAIProvider } from "./deterministic-provider";
import { ExternalOpenAIProvider } from "./external-provider";
import { AIProvider } from "./provider";

export function getAIProvider(): AIProvider {
  const config = getConfig();
  if (config.AI_PROVIDER_MODE === "openai" && config.OPENAI_API_KEY) {
    return new ExternalOpenAIProvider({
      modelVersion: config.AI_MODEL_NAME,
      enableCaching: true,
      enableDeterministicShortcuts: true,
      enableTieredRouting: true,
    });
  }
  return new DeterministicAIProvider(config.AI_MODEL_NAME);
}

export * from "./provider";
export * from "./schemas";
export * from "./deterministic-provider";
export * from "./external-provider";
export * from "./policy-engine";
export * from "./policy-guard";
export * from "./orchestrator";
export * from "./tool-registry";
export * from "./prompts/registry";
export * from "./evaluation";
