# ClusterFi Mainnet Launch Runbook

This runbook is for the guarded launch path. It intentionally keeps cross-chain execution disabled until one real route has settlement verification.

## Required Gateway Environment

Set these before starting the production gateway:

```bash
GATEWAY_ENV=production
GATEWAY_REQUIRE_AUTH=true
GATEWAY_AUTH_SECRET=<32+ random chars>
ADMIN_API_TOKEN=<32+ random chars>
INTELLIGENCE_ENCRYPTION_KEY=<32+ random chars>
ALLOW_PRODUCTION_MOCKS=false
DISABLE_CROSSCHAIN_EXECUTION=true
ACROSS_SIMULATION_MODE=false
ZERO_G_PROVIDER=real
ZERO_G_DA_PROVIDER=real
AGENT_NFT_ADDRESS=<deployed AgentNFT>
SKILL_NFT_ADDRESS=<deployed SkillNFT>
BSC_TESTNET_RPC_URL=<or production RPC consumed by gateway config>
```

Do not set `DEPLOYER_PRIVATE_KEY` on the gateway host.

## Pre-Deploy

1. Confirm working tree contains only release changes.
2. Run:

```bash
npm test
npm run verify:mainnet-readiness
```

3. If deploying Mantle-native modules, keep `ALLOW_MOCK_BRIDGE` unset on Mantle mainnet.

## Deploy

1. Deploy contracts with the release branch.
2. Verify contracts on explorers.
3. Transfer protocol ownership to the intended multisig / hardware wallet.
4. Set `EXPECTED_PROTOCOL_OWNER` locally and run:

```bash
EXPECTED_PROTOCOL_OWNER=<owner> REQUIRE_POLICY_DENYLIST=true npm run verify:mainnet-readiness
```

## Gateway Smoke

Use a smoke wallet that owns a tiny test agent and has enough credits:

```bash
GATEWAY_URL=https://<gateway-host> \
SMOKE_PRIVATE_KEY=<smoke-wallet-private-key> \
SMOKE_AGENT_ID=<agent-id> \
SMOKE_TBA_ADDRESS=<agent-tba> \
npm run smoke:gateway-production
```

Expected:

- `/auth/nonce` works.
- `/auth/verify` works.
- `/intelligence/credits/:wallet` only returns the authenticated wallet's credits.
- `/agent/execute` works only if the smoke wallet owns the agent and the agent has the required skill.

## Kill Switches

Use these immediately if behavior is suspicious:

- Pause `AgentSkillManager`.
- Pause job/strategy factories where available.
- Revoke agent permissions on affected Sovereign Accounts.
- Remove adapter and chain permissions from affected Sovereign Accounts.
- Keep `DISABLE_CROSSCHAIN_EXECUTION=true`.
- Stop the gateway service if auth or ownership checks misbehave.

## Stop-Ship

Do not launch if:

- `npm test` fails.
- `npm run verify:mainnet-readiness` fails under production env.
- Gateway has `DEPLOYER_PRIVATE_KEY`.
- `ALLOW_PRODUCTION_MOCKS=true`.
- `DISABLE_CROSSCHAIN_EXECUTION` is not `true`.
- Mock adapter addresses are present in production deployment.
- ExecutionHub denylist is missing privileged selectors.
- Authenticated smoke can access another wallet's credits, config, or agent.
