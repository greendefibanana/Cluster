# Production Env Setup (BNB Testnet)

`dotenv` files are not auto-synced to hosting providers.

Use these rules:
- Local build/dev: create `.env.production` (and `Frontend/.env.production` if building locally).
- Hosted backend (Render): add env vars in Render dashboard.
- Hosted frontend (Vercel/Netlify): add `VITE_*` env vars in that platform dashboard.

## 1) Backend (Render)

Source template: `.env.production.example`

Set those keys in Render service environment variables.

Important:
- Do not set `DEPLOYER_PRIVATE_KEY` for gateway production flow.
- `/meme/launch` server route is intentionally disabled; launches are wallet-signed from frontend.

## 2) Frontend (Vercel/Netlify/Cloudflare)

Source template: `Frontend/.env.production.example`

Set all `VITE_*` keys in frontend hosting environment settings.

Important:
- `VITE_GATEWAY_URL` must point to your live Render gateway URL.
- Rebuild/redeploy frontend after changing env vars.

## 3) Local production-like run (optional)

From repo root:

```bash
copy .env.production.example .env.production
copy Frontend\\.env.production.example Frontend\\.env.production
```

Then fill secret fields and run your normal build/start commands.
