const allowedProviders = new Set([
  "mock",
  "dgrid",
  "0g-compute",
  "openai",
  "anthropic",
  "claude",
  "gemini",
  "custom-openai",
]);

const allowedTaskTypes = new Set([
  "agent-execute",
  "sleuth-alpha",
  "quant-strategy",
  "pnl-report",
  "marketing",
  "meme-launch",
  "lp-yield",
  "prediction-market",
  "social-post",
  "defi-yield-analysis",
  "defi-risk-review",
  "prediction-market-thesis",
  "prediction-market-risk-review",
]);

export function securityHeaders({ production = false } = {}) {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (production) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  };
}

export function createRateLimiter({
  windowMs = 60_000,
  max = 60,
  keyPrefix = "global",
  keyFn = (req) => req.ip || req.socket?.remoteAddress || "unknown",
} = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${keyFn(req)}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "rate limit exceeded" });
    }
    return next();
  };
}

export function assertAllowedProvider(provider, { production = false, allowProductionMocks = false } = {}) {
  if (!provider) return;
  if (!allowedProviders.has(provider)) {
    throw new Error(`Unsupported intelligence provider: ${provider}`);
  }
  if (production && provider === "mock" && !allowProductionMocks) {
    throw new Error("Mock intelligence provider is disabled in production");
  }
}

export function assertAllowedTaskType(taskType) {
  if (!taskType) return;
  if (!allowedTaskTypes.has(taskType)) {
    throw new Error(`Unsupported intelligence task type: ${taskType}`);
  }
}

export function assertProviderList(providers, options = {}) {
  if (!providers) return;
  if (!Array.isArray(providers)) {
    throw new Error("fallbackProviders must be an array");
  }
  for (const provider of providers) {
    assertAllowedProvider(provider, options);
  }
}

export function assertTaskTypeList(taskTypes) {
  if (!taskTypes) return;
  if (!Array.isArray(taskTypes)) {
    throw new Error("allowedTaskTypes must be an array");
  }
  for (const taskType of taskTypes) {
    assertAllowedTaskType(taskType);
  }
}

export function assertByokCredentialInput({ provider, apiKey, endpointUrl }) {
  if (provider === "mock") {
    throw new Error("Mock provider does not accept stored API keys");
  }
  if (typeof apiKey !== "string" || apiKey.trim().length < 12) {
    throw new Error("apiKey is too short");
  }
  if (apiKey.length > 4096) {
    throw new Error("apiKey is too long");
  }
  if (provider === "custom-openai" && !endpointUrl) {
    throw new Error("endpointUrl is required for custom-openai");
  }
}

export function assertManagedModeAllowed(providerMode, { production = false, managedEnabled = false } = {}) {
  if (providerMode === "MANAGED" && production && !managedEnabled) {
    throw new Error("Managed intelligence is disabled in production");
  }
}

export function publicError(error, { production = false, fallback = "Request failed" } = {}) {
  const message = error instanceof Error ? error.message : String(error || fallback);
  return {
    error: production ? fallback : message,
  };
}

export function securityCatalog() {
  return {
    providers: [...allowedProviders],
    taskTypes: [...allowedTaskTypes],
  };
}
