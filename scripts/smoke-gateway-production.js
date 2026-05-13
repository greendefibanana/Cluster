import "dotenv/config";
import { ethers } from "ethers";

const gatewayUrl = (process.env.GATEWAY_URL || process.env.VITE_GATEWAY_URL || "http://localhost:3000").replace(/\/$/, "");
const privateKey = process.env.SMOKE_PRIVATE_KEY;
const agentId = process.env.SMOKE_AGENT_ID;
const tbaAddress = process.env.SMOKE_TBA_ADDRESS;

if (!privateKey) {
  throw new Error("SMOKE_PRIVATE_KEY is required for production gateway smoke");
}

const wallet = new ethers.Wallet(privateKey);

async function request(path, options = {}) {
  const response = await fetch(`${gatewayUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${payload.error || JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  const nonce = await request("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address: wallet.address }),
  });
  const signature = await wallet.signMessage(nonce.message);
  const session = await request("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ address: wallet.address, nonce: nonce.nonce, signature }),
  });

  console.log(`Authenticated smoke wallet ${session.wallet}`);

  const authHeaders = { authorization: `Bearer ${session.token}` };
  const credits = await request(`/intelligence/credits/${session.wallet}`, {
    headers: authHeaders,
  });
  console.log(`Credits balance: ${credits.credits.balance}`);

  if (agentId && tbaAddress) {
    const result = await request("/agent/execute", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        agentId,
        tbaAddress,
        message: "Production smoke: respond with a concise readiness acknowledgement.",
        action: "post",
      }),
    });
    console.log(`Agent execution trace: ${result.response?.traceId || "no-trace"}`);
  } else {
    console.log("Skipped /agent/execute smoke; set SMOKE_AGENT_ID and SMOKE_TBA_ADDRESS to enable it.");
  }

  console.log("Production gateway smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
