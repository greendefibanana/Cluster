export const v1TaskTypes = [
  "defi-yield-analysis",
  "defi-risk-review",
  "prediction-market-thesis",
  "prediction-market-risk-review",
];

export const strategyOutputSchema = {
  required: ["recommendation", "confidence", "riskScore", "reasoning", "strategyPlan", "exitConditions", "sources"],
};

export function validateStrategyOutput(output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { ok: false, missing: strategyOutputSchema.required };
  }
  const missing = strategyOutputSchema.required.filter((key) => output[key] === undefined || output[key] === null);
  return { ok: missing.length === 0, missing };
}

export function taskPrompt({ taskType, context }) {
  if (!v1TaskTypes.includes(taskType)) {
    throw new Error(`Unsupported v1 intelligence task: ${taskType}`);
  }
  return [
    "Use only the normalized context below. Do not browse or call tools.",
    "Return a JSON object with recommendation, confidence, riskScore, reasoning, strategyPlan, exitConditions, and sources.",
    "riskScore must be a number from 0 to 100 where 0 is lowest operational risk and 100 is highest operational risk.",
    "Do not include executable transactions. Suggest only policy-checkable actions.",
    `Task: ${taskType}`,
    `Context: ${JSON.stringify(context)}`,
  ].join("\n");
}
