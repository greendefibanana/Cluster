export class AgentReputationService {
  constructor({ store = null } = {}) {
    this.store = store || { outcomes: [], reputations: new Map() };
  }

  recordStrategyOutcome(outcome) {
    const row = {
      id: outcome.id || `${outcome.agentId}:${Date.now()}`,
      agentId: outcome.agentId,
      strategyId: outcome.strategyId,
      type: outcome.type || "strategy",
      policyApproved: Boolean(outcome.policyApproved),
      pnlUsd: Number(outcome.pnlUsd || 0),
      predictionCorrect: outcome.predictionCorrect,
      userAdoption: Number(outcome.userAdoption || 0),
      timestamp: outcome.timestamp || new Date().toISOString(),
    };
    this.store.outcomes.push(row);
    return row;
  }

  validatePredictionResult({ market, resolution, thesis }) {
    const expected = thesis?.recommendation || thesis?.outcome || thesis;
    const correct = String(expected || "").toLowerCase().includes(String(resolution || "").toLowerCase());
    return {
      marketId: market?.id || market,
      resolution,
      expected,
      correct,
      validatedAt: new Date().toISOString(),
    };
  }

  updateAgentReputation(agentId) {
    const outcomes = this.store.outcomes.filter((row) => row.agentId === agentId);
    const base = 50;
    const policyScore = average(outcomes.map((row) => row.policyApproved ? 1 : 0)) * 20;
    const performanceScore = Math.max(-15, Math.min(20, average(outcomes.map((row) => row.pnlUsd || 0)) / 10));
    const predictionScore = average(outcomes.filter((row) => row.predictionCorrect !== undefined).map((row) => row.predictionCorrect ? 1 : 0)) * 20;
    const adoptionScore = Math.min(10, average(outcomes.map((row) => row.userAdoption || 0)));
    const score = Math.round(Math.max(0, Math.min(100, base + policyScore + performanceScore + predictionScore + adoptionScore - 10)));
    const reputation = {
      agentId,
      score,
      outcomes: outcomes.length,
      updatedAt: new Date().toISOString(),
      factors: { policyScore, performanceScore, predictionScore, adoptionScore },
    };
    this.store.reputations.set(agentId, reputation);
    return reputation;
  }
}

export function recordStrategyOutcome(serviceOrOutcome, maybeOutcome) {
  const service = serviceOrOutcome instanceof AgentReputationService ? serviceOrOutcome : defaultReputationService;
  return service.recordStrategyOutcome(maybeOutcome || serviceOrOutcome);
}

export function validatePredictionResult(input) {
  return defaultReputationService.validatePredictionResult(input);
}

export function updateAgentReputation(agentId) {
  return defaultReputationService.updateAgentReputation(agentId);
}

export const defaultReputationService = new AgentReputationService();

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}
