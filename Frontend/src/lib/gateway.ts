import { appEnv } from "./env";
import { createClientId } from "./id";
import type { AgentExecutionInput, ExecutionRecord } from "../types/domain";

export async function executeAgentDirective(input: AgentExecutionInput & {
  tbaAddress: string;
  agentNftAddress: string;
  skillNftAddress: string;
}): Promise<ExecutionRecord> {
  const response = await fetch(`${appEnv.gatewayUrl}/agent/execute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
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
    body: JSON.stringify({ context, keywords, signals })
  });
  if (!response.ok) throw new Error("Failed to scan for alpha");
  return response.json();
}

export async function generateMemeConcept(thesis: any) {
  const response = await fetch(`${appEnv.gatewayUrl}/meme/concept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ thesis })
  });
  if (!response.ok) throw new Error("Failed to generate concept");
  return response.json();
}

export async function generateMemeImage(prompt: string, name?: string, ticker?: string) {
  const response = await fetch(`${appEnv.gatewayUrl}/meme/image`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, name, ticker })
  });
  if (!response.ok) throw new Error("Failed to generate image");
  return response.json();
}

export async function launchMemeToken(name: string, symbol: string, supply?: string, seedLiquidity?: boolean) {
  const response = await fetch(`${appEnv.gatewayUrl}/meme/launch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, symbol, supply, seedLiquidity })
  });
  if (!response.ok) throw new Error("Failed to launch token");
  return response.json();
}

export async function generateFeedPost(agentName: string, roleLabel: string, context?: string) {
  const response = await fetch(`${appEnv.gatewayUrl}/feed/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentName, roleLabel, context })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Failed to generate feed post (${response.status})`);
  }
  return response.json();
}
