import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const EXPLORER = "https://chainscan.0g.ai";
const MANTLE_AGENT_NFT = "0x3fBD3191f6a7a7537971C1809570E04A8DE14b44";
const MANTLE_TBA       = "0xBe9cd56F9aD6e49eC5B7DA9307fF186Fa57fBd81";

const IDENTITY_ABI = [
  "function getAgent(address agentNft, uint256 agentId) external view returns (tuple(uint256 agentId, address agentNft, address tba, address owner, string role, string metadataURI, string zeroGStorageURI, uint8 status))",
];
const REPUTATION_ABI = [
  "function totalEvents() external view returns (uint256)",
  "function getEvent(uint256 eventId) external view returns (tuple(uint8 subjectType, uint256 subjectId, bytes32 strategyId, string eventType, int256 scoreDelta, int256 pnlDelta, int256 tvlDelta, string proofURI, uint256 timestamp))",
];
const VALIDATION_ABI = [
  "function getClaim(bytes32 claimHash) external view returns (tuple(bytes32 claimHash, uint8 subjectType, uint256 subjectId, bytes32 strategyId, string claimType, string proofURI, address validator, uint8 status, uint256 updatedAt))",
];

function claimHash(tag) {
  return ethers.keccak256(ethers.toUtf8Bytes(`clusterfi-mainnet-claim-${tag}-${Date.now()}`));
}
function claimHashMock(tag) {
  return ethers.keccak256(ethers.toUtf8Bytes(`clusterfi-mainnet-claim-${tag}-1`)); // Mock if needed
}

async function main() {
  const deployPath = path.join(process.cwd(), "deployments", "0g-mainnet.json");
  const deployment = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const { identityRegistry: identityAddr, reputationRegistry: repAddr, validationRegistry: valAddr } = deployment.contracts;

  const rpc = process.env.ZERO_G_MAINNET_RPC_URL || "https://evmrpc.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpc);
  
  const identity   = new ethers.Contract(identityAddr, IDENTITY_ABI, provider);
  const reputation = new ethers.Contract(repAddr, REPUTATION_ABI, provider);
  const validation = new ethers.Contract(valAddr, VALIDATION_ABI, provider);

  console.log("── READBACK VERIFICATION ──");

  // Identity readback
  const ag1 = await identity.getAgent(MANTLE_AGENT_NFT, 1);
  console.log(`Agent #1 (quant): owner=${ag1.owner}, role=${ag1.role}, status=${ag1.status}`);
  const ag3 = await identity.getAgent(MANTLE_AGENT_NFT, 3);
  console.log(`Agent #3 (prediction): owner=${ag3.owner}, role=${ag3.role}, status=${ag3.status}`);

  // Reputation readback
  const totalRep = await reputation.totalEvents();
  console.log(`Reputation total events: ${totalRep}`);
  const lastRepEvt = await reputation.getEvent(Number(totalRep) - 1);
  console.log(`Last reputation event: type=${lastRepEvt.eventType}, proofURI=${lastRepEvt.proofURI}`);

  console.log("Readback successful!");
}

main().catch(console.error);
