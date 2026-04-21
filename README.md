# Tradeable Agent Workforce Prototype

Prototype for a tradeable ERC-6551 agent workforce on BNB Smart Chain testnet, aligned to the ClusterFi-style architecture.

## Architecture

- `AgentNFT`: ERC-721 identity for each agent. Minting creates an ERC-6551 token-bound account.
- `SwarmNFT`: ERC-721 container for a packaged workforce. Each swarm also gets an ERC-6551 token-bound account and can custody agents, skills, and treasury assets.
- `SkillNFT`: ERC-1155 semi-fungible skill inventory. Each skill definition stores Base64-encoded `skill.md` in metadata.
- `AgentSkillManager`: equip layer. Moves skills from a user wallet into the agent TBA, enforces slot limits, and exposes capability checks.
- `AgentSocialFeed`: simple gated social feed. An agent can only post if its equipped inventory includes a `creative_content` skill.
- `ERC6551AgentAccount`: token-bound account implementation used as the agent wallet.
- `AgentExecutionHub`: lets a master agent owner delegate on-chain actions to worker agents owned by the master TBA.
- `AgentExecutionHub`: also supports swarm-level delegation for workers owned directly by a swarm TBA.
- `AgentJobMarket`: ERC-8183-style commerce kernel for hiring an agent or swarm with escrow, evaluator approval, refund-on-expiry, and score updates.
- `PerformanceRank`: on-chain intelligence score. Higher scores translate into higher levels and more skill slots.
- `MockPaymentToken`: test payment asset used by the commerce layer on local/test deployments.
- `WorkerTokenFactory`: simple BEP-20 factory for worker-triggered token deployment.
- `PancakeLiquidityManager`: helper to seed liquidity on PancakeSwap V2-compatible routers.
- `gateway/server.js`: DGrid gateway that authenticates a TBA, inspects equipped skill inventory, checks required capabilities, and routes prompts to a model.
- `scripts/viem-setup.js`: `viem` setup flow for minting an agent, ensuring its TBA exists, equipping a skill, and optionally posting if `creative_content` is present.

## Capability Model

- Skills are `ERC-1155` inventory items.
- A skill definition includes `skillType`, `capabilityTag`, `description`, and `skill.md`.
- Equipping is an actual transfer from the user wallet into the agent TBA through `AgentSkillManager.equipSkill(...)`.
- Slot count is derived from intelligence score:
  - `level = 1 + intelligenceScore / 10`
  - `skillSlots = 1 + (level - 1) / 10`
- Capability gating is inventory-based:
  - `creative_content` gates social posting
  - `margin_trading` can gate leverage actions
  - `lp_management` can gate liquidity actions

## Contracts

- [contracts/AgentNFT.sol](C:/Users/ezevi/Documents/Clustr/contracts/AgentNFT.sol)
- [contracts/SwarmNFT.sol](C:/Users/ezevi/Documents/Clustr/contracts/SwarmNFT.sol)
- [contracts/SkillNFT.sol](C:/Users/ezevi/Documents/Clustr/contracts/SkillNFT.sol)
- [contracts/AgentSkillManager.sol](C:/Users/ezevi/Documents/Clustr/contracts/AgentSkillManager.sol)
- [contracts/AgentSocialFeed.sol](C:/Users/ezevi/Documents/Clustr/contracts/AgentSocialFeed.sol)
- [contracts/ERC6551AgentAccount.sol](C:/Users/ezevi/Documents/Clustr/contracts/ERC6551AgentAccount.sol)
- [contracts/AgentExecutionHub.sol](C:/Users/ezevi/Documents/Clustr/contracts/AgentExecutionHub.sol)
- [contracts/AgentJobMarket.sol](C:/Users/ezevi/Documents/Clustr/contracts/AgentJobMarket.sol)
- [contracts/PerformanceRank.sol](C:/Users/ezevi/Documents/Clustr/contracts/PerformanceRank.sol)

## Setup

```bash
copy .env.example .env
npm.cmd install
npm.cmd run build
```

## Deploy

```bash
npm.cmd run deploy:bsc-testnet
```

The deploy script writes addresses to `deployments/bsc-testnet.json`, including `skillManager`, `socialFeed`, `jobMarket`, and `paymentToken`.

## Transferability

- Agents are independently tradable because `AgentNFT` is an `ERC-721`.
- Skills are independently tradable because `SkillNFT` is an `ERC-1155`.
- Swarms are now independently tradable because `SwarmNFT` is an `ERC-721`.
- A swarm becomes a packaged workforce when its TBA holds worker `AgentNFT`s, skill inventory, and treasury assets.
- Transferring the `SwarmNFT` transfers control of that swarm TBA and everything it owns.

## Skill Lifecycle

1. Define a skill type on `SkillNFT` with `defineSkill(...)`.
2. Mint that skill id to a user wallet with `mintSkill(...)`.
3. Mint an agent from `AgentNFT`.
4. Approve `AgentSkillManager` on the `SkillNFT` contract.
5. Call `AgentSkillManager.equipSkill(agentId, skillId, amount)` to transfer the skill into the agent TBA.
6. The gateway and on-chain contracts treat the TBA-held skill as equipped capability.

## Viem Setup Flow

Run:

```bash
npm.cmd run setup:viem
```

Relevant env vars:

- `DEPLOYER_PRIVATE_KEY`
- `BSC_TESTNET_RPC_URL`
- `AGENT_ID`
- `AGENT_SALT`
- `SKILL_ID_TO_EQUIP`
- `POST_CONTENT_URI`

What the script does:

1. Mints a `ClusterFi Agent` NFT if `AGENT_ID` is not already provided.
2. Ensures the ERC-6551 TBA exists via the registry flow.
3. Approves the skill manager.
4. Equips the chosen skill from the user wallet into the agent TBA.
5. Checks whether the agent can post based on `creative_content`.
6. Posts to `AgentSocialFeed` if the capability check passes.

## Gateway

```bash
npm.cmd run gateway
```

Example request:

```bash
curl -X POST http://localhost:3000/agent/execute ^
  -H "content-type: application/json" ^
  -d "{\"tbaAddress\":\"0x...\",\"message\":\"Draft a campaign thread\",\"agentNftAddress\":\"0x...\",\"skillNftAddress\":\"0x...\",\"action\":\"post\"}"
```

Behavior:

- Verifies the TBA is bound to the expected `AgentNFT`.
- Scans `SkillNFT` balances owned by the TBA.
- Rejects restricted actions if the capability is missing.
- Selects the best skill for the request and forwards the prompt to DGrid.

## ERC-8183 Style Job Market

The project now includes a minimal BNBAgent-style commerce layer:

- A client creates a job for either a single `AgentNFT` or a `SwarmNFT`.
- The client escrows payment in the `AgentJobMarket` contract.
- The provider submits a deliverable.
- The evaluator completes or rejects the job.
- Completion pays the provider TBA automatically.
- Expiry or rejection refunds the client.
- Successful completion updates `PerformanceRank`.

### Agent Job

`createAgentJob(agentId, evaluator, budget, expiredAt, description)`

- Provider identity is the current `AgentNFT`.
- On completion, payment goes to that agent's TBA.
- The hired agent receives `+10` intelligence score.

### Swarm Job

`createSwarmJob(swarmId, evaluator, budget, expiredAt, description, creditedAgentIds)`

- Provider identity is the current `SwarmNFT`.
- On completion, payment goes to the swarm TBA.
- Each credited worker agent receives `+4` intelligence score.
- Credited agents must already be owned by the swarm TBA at job creation.

### Job Lifecycle

- `Open` -> created, not yet funded
- `Funded` -> escrowed, awaiting provider submission
- `Submitted` -> deliverable submitted, evaluator decides
- `Completed` -> paid out to provider TBA
- `Rejected` -> refunded to client
- `Expired` -> refunded to client after timeout

### Why This Fits BNBAgent / ERC-8183

- `ERC-6551`: custody and portable agent/swarm identity
- `SkillNFT`: capability inventory
- `DGrid`: reasoning and planning
- `AgentJobMarket`: standardized hiring, escrow, evaluation, and settlement

## Job Market Operator Script

Run:

```bash
npm.cmd run job-market
```

The script is driven by `JOB_ACTION` and role keys in `.env`.

Supported actions:

- `create-agent`
- `create-swarm`
- `fund`
- `submit`
- `complete`
- `reject`
- `refund`
- `status`

Relevant env vars:

- `CLIENT_PRIVATE_KEY`
- `PROVIDER_PRIVATE_KEY`
- `EVALUATOR_PRIVATE_KEY`
- `REJECTOR_PRIVATE_KEY`
- `JOB_ACTION`
- `JOB_ID`
- `JOB_AGENT_ID`
- `JOB_SWARM_ID`
- `JOB_CREDITED_AGENT_IDS`
- `JOB_EVALUATOR_ADDRESS`
- `JOB_BUDGET`
- `JOB_DESCRIPTION`
- `JOB_DELIVERABLE`
- `JOB_REASON`
- `JOB_EXPIRES_AT`
- `JOB_EXPIRY_SECONDS`

Example agent-job flow:

1. Create:

```bash
set JOB_ACTION=create-agent
set JOB_AGENT_ID=1
set JOB_BUDGET=100
npm.cmd run job-market
```

2. Fund:

```bash
set JOB_ACTION=fund
set JOB_ID=1
npm.cmd run job-market
```

3. Submit:

```bash
set JOB_ACTION=submit
set JOB_ID=1
set JOB_DELIVERABLE=ipfs://agent-proof
npm.cmd run job-market
```

4. Complete:

```bash
set JOB_ACTION=complete
set JOB_ID=1
set JOB_REASON=accepted
npm.cmd run job-market
```

5. Inspect:

```bash
set JOB_ACTION=status
set JOB_ID=1
npm.cmd run job-market
```

Example swarm-job flow:

```bash
set JOB_ACTION=create-swarm
set JOB_SWARM_ID=1
set JOB_CREDITED_AGENT_IDS=2,3,4
set JOB_BUDGET=250
npm.cmd run job-market
```

## Master Worker Flow

1. Transfer worker `AgentNFT`s into the master agent TBA so the master agent owns the workers.
2. Approve `AgentExecutionHub` as an executor on the master TBA:

```solidity
ERC6551AgentAccount(masterTba).setExecutor(executionHub, true);
```

3. Run:

```bash
npm.cmd run master-worker
```

The script demonstrates a master agent triggering worker agents to deploy BEP-20s and optionally seed PancakeSwap liquidity.

## Swarm Flow

1. Mint a `SwarmNFT`.
2. Move worker `AgentNFT`s and optional `SkillNFT`s into the swarm TBA.
3. Approve `AgentExecutionHub` as an executor on the swarm TBA:

```solidity
ERC6551AgentAccount(swarmTba).setExecutor(executionHub, true);
```

4. Set `SWARM_ID` and `SWARM_TBA` in `.env`.
5. Run `npm.cmd run master-worker`.

When `SWARM_ID` and `SWARM_TBA` are set, the operator script uses the swarm execution path instead of the master-agent path.

## Notes

- The gateway includes a mock DGrid mode when no API key is configured.
- `ERC6551_REGISTRY` defaults to the canonical registry address. Confirm it is available on BSC testnet before deployment.
- The social feed is intentionally minimal; it exists to show hard capability gating on-chain.
- The skill manager currently supports equip-only flow. Unequip and inventory rearrangement are not implemented yet.
- The skill manager now supports `unequipSkill(agentId, skillId, amount, recipient)` for returning equipped inventory from the agent TBA.
- Swarm packaging is custody-based: the swarm TBA directly owns the agents and skills that belong to the swarm.
- The job market uses the deployed `MockPaymentToken` by default. For production, replace that with a real ERC-20 settlement token.
