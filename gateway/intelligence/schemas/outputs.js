export const outputSchemas = {
  "sleuth-alpha": {
    required: ["thesis", "confidence", "sources", "riskFactors", "suggestedInstrumentType", "proofSummary"],
  },
  "quant-strategy": {
    required: ["strategyName", "instrumentType", "expectedReturn", "riskScore", "allocationPlan", "executionSteps", "exitConditions"],
  },
  "pnl-report": {
    required: ["strategyId", "pnl", "tvl", "drawdown", "performanceSummary", "validationInputs"],
  },
  marketing: {
    required: ["campaignTitle", "posts", "targetAudience", "hooks", "assetsPrompt"],
  },
};

export function schemaForTask(taskType) {
  if (taskType === "meme-launch") return outputSchemas["sleuth-alpha"];
  if (taskType === "lp-yield") return outputSchemas["quant-strategy"];
  if (taskType === "social-post") return outputSchemas.marketing;
  return outputSchemas[taskType] || null;
}

export function validateStructuredOutput(output, schema) {
  if (!schema) return { ok: true, missing: [] };
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { ok: false, missing: schema.required };
  }
  const missing = schema.required.filter((key) => output[key] === undefined || output[key] === null);
  return { ok: missing.length === 0, missing };
}

export function schemaInstruction(taskType) {
  const schema = schemaForTask(taskType);
  if (!schema) return "";
  return `Return a JSON object containing these fields exactly where possible: ${schema.required.join(", ")}.`;
}
