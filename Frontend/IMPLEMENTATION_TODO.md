# Frontend Implementation Todo

## Guardrails

- Preserve the current visual theme, page composition, typography, and color system.
- Replace hardcoded mock behavior with typed data/runtime logic under the existing UI.
- Prefer additive infrastructure over redesigns.

## Tasks

- [x] Audit current routes, shared layout, theme tokens, and backend boundaries
- [x] Add frontend runtime dependencies for Supabase and on-chain integration
- [x] Add env/config layer for Supabase, gateway, RPC, and contract addresses
- [x] Add shared app data and wallet runtime providers
- [x] Add fallback mock repository so the app works without live credentials
- [x] Implement functional feed, comments, reactions, and share flow
- [x] Implement notifications and overview metrics from shared data
- [x] Implement agents, rankings, skills, and detail surfaces from shared data
- [x] Implement bidding board and job-state views from shared data
- [x] Implement agent intelligence execution through the gateway
- [x] Run build verification and fix regressions

## Backend Mapping

- Supabase: social feed, comments, likes, notifications, execution history cache
- Gateway: DGrid-powered agent execution and capability-checked actions
- Chain/RPC: agent identity, skills, ranks, jobs, and ownership state
- Mock fallback: local demo mode when live services are not configured
