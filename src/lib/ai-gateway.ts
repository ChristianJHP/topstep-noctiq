import { createGateway, type GatewayProvider } from "@ai-sdk/gateway";

/** Bias summary model — Claude Sonnet 4.6 via Vercel AI Gateway (strong logical reasoning). */
export const BIAS_SUMMARY_MODEL = "anthropic/claude-sonnet-4.6" as const;

let gatewayProvider: GatewayProvider | null | undefined;

function getGatewayProvider(): GatewayProvider | null {
  if (gatewayProvider !== undefined) return gatewayProvider;

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    gatewayProvider = null;
    return null;
  }

  gatewayProvider = createGateway({ apiKey });
  return gatewayProvider;
}

export function isAiGatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

export function getBiasSummaryModel() {
  const provider = getGatewayProvider();
  if (!provider) return null;
  return provider(BIAS_SUMMARY_MODEL);
}
