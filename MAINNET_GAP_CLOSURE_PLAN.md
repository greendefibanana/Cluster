# ClusterFi Mainnet Gap Closure Plan

Target: launch a guarded mainnet release in 36 hours.

Core decision: ship only flows that are authenticated, observable, tested, and reversible. Anything involving real cross-chain settlement must be either disabled, allowlisted to a proven route, or intent-only until settlement verification exists.

## Launch Scope

### Allowed for mainnet launch

- Agent NFT minting and ERC-6551 TBA creation.
- Skill NFT definition, minting, equip, unequip, and capability-gated execution policies.
- Agent / swarm execution through `AgentExecutionHub` only for explicit allowlisted selectors.
- Sovereign Account creation, deposit, pause, revoke, withdraw, emergency exit.
- Strategy execution only through audited, allowlisted single-chain adapters with strict receiver, allocation, slippage, and pause controls.
- Cross-chain intent creation and proof logging.
- Gateway inference only after authenticated wallet ownership checks.

### Not allowed for mainnet launch unless completed and retested

- Generic cross-chain execution.
- Simulated bridges presented as real execution.
- Gateway routes accepting caller-supplied `userId`, `agentId`, `providerMode`, or credits without auth.
- Server-side private-key execution for user strategies.
- Any frontend/backend fallback that reports mock success in production.

## 0. First 2 Hours: Freeze And Branch

- Create a release branch.
- Freeze feature work except security, runtime correctness, and deployment readiness.
- Set production flags:
  - `MOCK_EXECUTION_ENABLED=false`
  - `ACROSS_SIMULATION_MODE=false`
  - `ZERO_G_PROVIDER=real` or disable proof claims that imply real 0G storage.
  - `ZERO_G_DA_PROVIDER=real` or label DA as unavailable.
  - `GATEWAY_REQUIRE_AUTH=true`
  - `DISABLE_CROSSCHAIN_EXECUTION=true` until real settlement is verified.
- Add a deployment runbook and stop-ship checklist.

## 1. Solidity Core Closure

### 1.1 Agent and skill core

- Keep `AgentNFT`, `SkillNFT`, `AgentSkillManager`, `ERC6551AgentAccount`, and `AgentExecutionHub`.
- Do not add broad new execution features before launch.
- Add or verify tests for:
  - transferred agent loses old executor access;
  - equipped skill gates only intended selectors;
  - unequipped skill removes runtime capability;
  - global policy cannot accidentally permit privileged selectors;
  - malicious skill markdown cannot bypass onchain selector policy.

### 1.2 ExecutionHub policy hardening

- Require target policy over global policy for high-risk selectors.
- Create a denylist for admin selectors:
  - ownership transfer;
  - set trusted caller;
  - set manager;
  - pause/unpause unless intentionally controlled by protocol owner;
  - token approvals except through dedicated adapters.
- Emit policy version in `TargetPolicySet` / `GlobalPolicySet`.
- Deployment script must configure policies and then print a policy table.

### 1.3 Sovereign Account safety

- Use Sovereign Account as the only production path for user funds.
- Confirm every execution path enforces:
  - approved executor or valid session key;
  - approved adapter;
  - approved chain;
  - amount <= max allocation;
  - slippage <= max slippage;
  - receiver is owner or account;
  - pause/revoke/withdraw/emergency exit work after failed execution.
- Add mainnet adapter allowlist tests using the exact deployment config.

### 1.4 CrossChainIntentEngine contract

- Keep mainnet cross-chain as intent lifecycle unless execution verification is finished.
- Add status transition checks:
  - only pending can execute/fail/cancel;
  - unknown intent cannot be marked;
  - trusted executor can only mark with non-empty proof/validation hash;
  - account can cancel its own pending intent.

## 2. Gateway Closure

### 2.1 Authentication

Implement wallet auth before any production route:

- `POST /auth/nonce` creates a short-lived nonce.
- `POST /auth/verify` verifies EIP-191/SIWE-style signature.
- Issue short-lived JWT or signed session cookie.
- Middleware sets `req.auth.wallet`.
- All protected routes derive `userId` from wallet, not request body.

Protected routes:

- `/agent/execute`
- `/feed/generate`
- `/meme/*`
- `/intelligence/*`
- any credit, config, credential, usage, or provider route.

### 2.2 Ownership checks

Before `/agent/execute`:

- Verify TBA belongs to the configured Agent NFT.
- Verify current owner of the agent is `req.auth.wallet`, or wallet owns the parent swarm/cluster that owns the agent.
- Ignore caller-supplied `agentNftAddress` and `skillNftAddress` in production; load from server deployment config.
- Ignore caller-supplied `providerMode`, `provider`, and `model` unless the authenticated owner has configured them.

### 2.3 Credit and credential safety

- Remove public `/intelligence/credits/add`; replace with admin-only or payment-webhook-only mutation.
- Encrypt BYOK with mandatory `INTELLIGENCE_ENCRYPTION_KEY`; server must fail boot if missing in production.
- Never return encrypted key material or masked values derived from ciphertext.
- Add per-user and per-agent usage caps.

### 2.4 Production fallback policy

- Remove mock provider fallback in production.
- Failed inference returns failed status, not mock success.
- 0G compute missing key should fail in production, not fall back to mock.
- Store traces without raw secrets or full unredacted prompts.

### 2.5 Rate limits and abuse controls

- Replace in-memory IP limiter with persistent per-wallet + per-IP limiter.
- Add request body size limits.
- Add timeout and retry budget for each provider.
- Add audit log for every execution request.

## 3. Crosschain Runtime Closure

### 3.1 Minimum safe launch mode

For 36-hour launch, default to:

- create cross-chain intent;
- quote route if real quote provider is configured;
- do not execute bridge automatically;
- show intent as pending until settlement proof is verified;
- allow owner to cancel/revoke.

### 3.2 If one real route must ship

Pick one route only, for example Mantle -> Ethereum stablecoin yield.

Requirements:

- hardcoded route allowlist;
- supported source/destination chain IDs;
- supported token addresses per chain;
- max amount cap;
- quote expiry;
- min output / slippage enforcement;
- relayer address allowlist;
- destination settlement verification;
- failure reconciliation and user refund path;
- emergency kill switch.

### 3.3 Bridge adapter changes

- `MockBridgeAdapter` must not be constructible in production.
- `AcrossBridgeAdapter.execute` must either:
  - submit a signed transaction through an explicit wallet/relayer layer; or
  - throw and leave intent pending.
- Store route quote, quote timestamp, bridge request, tx hash, destination tx hash, and verification status.

### 3.4 Chain adapters

- Replace current local `execute()` return objects with protocol-specific adapters.
- Each adapter needs:
  - real calldata builder;
  - simulation/preflight;
  - post-execution verifier;
  - protocol address allowlist;
  - chain ID allowlist;
  - asset allowlist;
  - risk limits.

## 4. Data And Storage

- Move intelligence state from `deployments/intelligence-state.json` to Postgres/Supabase with RLS or server-only access.
- Tables:
  - users;
  - wallet sessions;
  - agent configs;
  - provider credentials;
  - credits;
  - usage events;
  - inference traces;
  - execution requests;
  - cross-chain intents;
  - bridge receipts;
  - proof records.
- Keep JSON state only for local demo mode.

## 5. Deployment And Operations

### 5.1 Contract deployment

- Deploy with a fresh deployer.
- Transfer ownership/admin roles to multisig or hardware wallet before launch.
- Verify contracts on explorers.
- Save deployment addresses for each chain.
- Run policy setup script.
- Run post-deploy readback script that verifies:
  - owners;
  - managers;
  - trusted relayers;
  - skill manager authorization;
  - execution policies;
  - adapter allowlists;
  - chain permissions;
  - pause states.

### 5.2 Gateway deployment

- Production gateway must fail startup if:
  - RPC URL missing;
  - deployment addresses missing;
  - auth secret missing;
  - encryption key missing;
  - production mode still allows mock execution;
  - service role key is accidentally exposed to frontend env.

### 5.3 Monitoring

- Add structured logs with trace IDs.
- Alert on:
  - failed execution rate;
  - credit mutation;
  - repeated auth failures;
  - adapter execution failure;
  - cross-chain intent stuck pending;
  - paused/emergency exit events;
  - unusually high spend per wallet.

## 6. Test Plan

Required before launch:

- `npm test`
- targeted tests for gateway auth and ownership checks;
- targeted tests for production fallback disabled;
- targeted tests for cross-chain intent-only mode;
- deploy to fork/testnet and run full smoke:
  1. mint agent;
  2. mint/equip skill;
  3. execute allowed inference;
  4. reject missing skill;
  5. create Sovereign Account;
  6. deposit;
  7. attempt malicious receiver and confirm revert;
  8. pause and confirm execution blocked;
  9. withdraw;
  10. create cross-chain intent and confirm no simulated execution is shown as real.

## 7. Stop-Ship Criteria

Do not launch mainnet if any are true:

- gateway auth is missing;
- public credit mutation exists;
- mock provider fallback can report success in production;
- cross-chain simulation is labeled or stored as execution;
- user funds can move through a generic adapter;
- owner/revoke/pause/emergency exit is untested on deployed contracts;
- deployment ownership is still on an everyday hot wallet;
- production env contains deployer private key for normal gateway operation.

## 8. 36-Hour Timeline

### Hours 0-4

- Freeze branch.
- Add production config flags.
- Implement gateway auth middleware and route protection.
- Disable production mocks and fallback success.

### Hours 4-10

- Add gateway ownership checks.
- Move credit mutation behind admin/payment guard.
- Enforce server-side deployment addresses.
- Add tests for auth, ownership, and no mock success.

### Hours 10-16

- Lock cross-chain to intent-only mode.
- Add production guard that prevents `MockBridgeAdapter`.
- Add pending/cancel/fail/execute transition tests.
- Add runbook for one optional real bridge route if absolutely required.

### Hours 16-22

- Harden deployment scripts.
- Add post-deploy verifier.
- Configure ExecutionHub policies.
- Run local and fork/testnet smoke.

### Hours 22-28

- Deploy final testnet rehearsal.
- Verify contracts.
- Run full smoke and abuse tests.
- Fix only release blockers.

### Hours 28-32

- Mainnet deploy.
- Ownership transfer.
- Post-deploy readback.
- Dry-run gateway against mainnet in read-only mode.

### Hours 32-36

- Enable guarded gateway.
- Launch with caps and kill switches.
- Watch logs continuously.
- Keep cross-chain execution disabled unless the exact route passed settlement verification.

## Immediate Engineering Order

1. Gateway auth and ownership checks.
2. Remove mock success paths in production.
3. Cross-chain intent-only guard.
4. Deployment verification script.
5. Mainnet smoke test runbook.
6. Only then consider real bridge execution.
