import { appEnv } from "./env";
import { createClientId } from "./id";
import { requestSignature } from "./web3";
import type { AgentExecutionInput, ExecutionRecord } from "../types/domain";

export type IntelligenceProvider = "mock" | "openai" | "gemini" | "anthropic" | "claude" | "custom-openai";

export interface ByokCredentialInput {
  userId: string;
  agentId?: string;
  provider: IntelligenceProvider;
  apiKey: string;
  endpointUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface IntelligenceRunInput {
  userId: string;
  agentId: string;
  provider: IntelligenceProvider;
  model?: string;
  taskType?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  fallbackProviders?: IntelligenceProvider[];
  metadata?: Record<string, unknown>;
}

// ---------- Gateway Auth ----------
// Cached session tokens per wallet (in-memory, cleared on page reload).
const sessionCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Returns a valid gateway session token for the given wallet address.
 * Performs the full nonce → sign → verify handshake on first call (or after expiry),
 * then caches the result for the lifetime of the session.
 */
export async function getOrCreateGatewayToken(walletAddress: string): Promise<string> {
  const now = Date.now();
  const key = walletAddress.toLowerCase();
  const cached = sessionCache.get(key);
  // Treat token as valid if it has more than 60 s left.
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token;
  }

  // 1. Fetch a one-time nonce from the gateway.
  const nonceRes = await fetch(`${appEnv.gatewayUrl}/auth/nonce`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: walletAddress }),
  });
  if (!nonceRes.ok) throw new Error(`Gateway nonce request failed (${nonceRes.status})`);
  const { message, nonce } = (await nonceRes.json()) as { message: string; nonce: string };

  // 2. Ask the wallet to sign the nonce message (triggers MetaMask popup).
  const signature = await requestSignature(message);

  // 3. Exchange address + nonce + signature for a session token.
  const verifyRes = await fetch(`${appEnv.gatewayUrl}/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: walletAddress, nonce, signature }),
  });
  if (!verifyRes.ok) throw new Error(`Gateway auth verification failed (${verifyRes.status})`);
  const { token, expiresAt } = (await verifyRes.json()) as { token: string; expiresAt: number };

  sessionCache.set(key, { token, expiresAt });
  return token;
}

/** Clears the cached session for a wallet (call on disconnect). */
export function clearGatewaySession(walletAddress?: string) {
  if (walletAddress) {
    sessionCache.delete(walletAddress.toLowerCase());
  } else {
    sessionCache.clear();
  }
}

/** Returns Authorization + Content-Type headers for protected gateway routes. */
async function authedHeaders(walletAddress: string): Promise<Record<string, string>> {
  const token = await getOrCreateGatewayToken(walletAddress);
  return { "content-type": "application/json", authorization: `Bearer ${token}` };
}

async function parseGatewayError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(payload?.error || `${fallback} (${response.status})`);
}

// ---------- Public API ----------

export async function executeAgentDirective(input: AgentExecutionInput & {
  tbaAddress: string;
  agentNftAddress: string;
  skillNftAddress: string;
}): Promise<ExecutionRecord> {
  const response = await fetch(`${appEnv.gatewayUrl}/agent/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tbaAddress: input.tbaAddress,
      message: input.message,
      agentNftAddress: input.agentNftAddress,
      skillNftAddress: input.skillNftAddress,
      action: input.action || "post",
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Agent execution failed");
  }

  const payload = (await response.json()) as {
    selectedSkill?: { name?: string };
    response?: { content?: string };
  };

  return {
    id: createClientId(),
    agentId: input.agentId,
    prompt: input.message,
    action: input.action || "post",
    status: "success",
    createdAt: new Date().toISOString(),
    response:
      payload.response?.content ||
      JSON.stringify(payload.response ?? payload, null, 2),
    selectedSkillName: payload.selectedSkill?.name,
  };
}

export async function fetchMemeAlpha(context?: string, keywords?: string[], signals?: any) {
  const response = await fetch(`${appEnv.gatewayUrl}/meme/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ context, keywords, signals }),
  });
  if (!response.ok) throw new Error("Failed to scan for alpha");
  return response.json();
}

export async function generateMemeConcept(thesis: any) {
  const response = await fetch(`${appEnv.gatewayUrl}/meme/concept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ thesis }),
  });
  if (!response.ok) throw new Error("Failed to generate concept");
  return response.json();
}

export async function generateMemeImage(prompt: string, name?: string, ticker?: string) {
  const response = await fetch(`${appEnv.gatewayUrl}/meme/image`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, name, ticker }),
  });
  if (!response.ok) throw new Error("Failed to generate image");
  return response.json();
}

export async function launchMemeToken(name: string, symbol: string, supply?: string, seedLiquidity?: boolean) {
  const response = await fetch(`${appEnv.gatewayUrl}/meme/launch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, symbol, supply, seedLiquidity }),
  });
  if (!response.ok) throw new Error("Failed to launch token");
  return response.json();
}

export async function generateFeedPost(agentName: string, roleLabel: string, context?: string) {
  const response = await fetch(`${appEnv.gatewayUrl}/feed/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentName, roleLabel, context }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Failed to generate feed post (${response.status})`);
  }
  return response.json();
}

export async function saveByokCredential(input: ByokCredentialInput) {
  const response = await fetch(`${appEnv.gatewayUrl}/intelligence/credentials`, {
    method: "POST",
    headers: await authedHeaders(input.userId),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseGatewayError(response, "Failed to save BYOK credential");
  }
  return response.json() as Promise<{
    credential: {
      id: string;
      userId: string;
      agentId?: string | null;
      provider: string;
      endpointUrl?: string | null;
      apiKey: string;
      createdAt: string;
      updatedAt: string;
    };
  }>;
}

export async function saveAgentIntelligenceConfig(input: {
  userId: string;
  agentId: string;
  provider: IntelligenceProvider;
  model?: string;
}) {
  const response = await fetch(
    `${appEnv.gatewayUrl}/intelligence/agents/${encodeURIComponent(input.agentId)}/config`,
    {
      method: "POST",
      headers: await authedHeaders(input.userId),
      body: JSON.stringify({
        userId: input.userId,
        mode: "BYOK",
        primaryProvider: input.provider,
        model: input.model,
        allowedTaskTypes: [
          "agent-execute",
          "defi-yield-analysis",
          "defi-risk-review",
          "prediction-market-thesis",
          "prediction-market-risk-review",
          "social-post",
        ],
      }),
    }
  );
  if (!response.ok) {
    throw await parseGatewayError(response, "Failed to save agent intelligence config");
  }
  return response.json();
}

export async function checkIntelligenceProviderHealth(input: {
  userId: string;
  agentId?: string;
  provider: IntelligenceProvider;
  mode?: "BYOK" | "MANAGED";
}) {
  const response = await fetch(
    `${appEnv.gatewayUrl}/intelligence/providers/${encodeURIComponent(input.provider)}/health`,
    {
      method: "POST",
      headers: await authedHeaders(input.userId),
      body: JSON.stringify({
        userId: input.userId,
        agentId: input.agentId,
        mode: input.mode || "BYOK",
      }),
    }
  );
  if (!response.ok) {
    throw await parseGatewayError(response, "Provider health check failed");
  }
  return response.json() as Promise<{ health: Record<string, unknown> }>;
}

export async function runAgentByokInference(input: IntelligenceRunInput) {
  const response = await fetch(`${appEnv.gatewayUrl}/intelligence/run`, {
    method: "POST",
    headers: await authedHeaders(input.userId),
    body: JSON.stringify({
      providerMode: "BYOK",
      taskType: input.taskType || "agent-execute",
      fallbackProviders: input.fallbackProviders ?? [],
      ...input,
    }),
  });
  if (!response.ok) {
    throw await parseGatewayError(response, "Agent intelligence run failed");
  }
  return response.json() as Promise<{
    output: unknown;
    provider: string;
    model: string;
    proofURI?: string;
    traceId?: string;
    usage?: Record<string, unknown>;
  }>;
}
