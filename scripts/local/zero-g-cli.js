import "dotenv/config";
import { createLocalZeroGProvider, createLocalZeroGDAProvider } from "../../gateway/zeroG/localProvider.js";

const command = process.argv[2] || "init";
const args = parseArgs(process.argv.slice(3));
const storage = createLocalZeroGProvider();
const da = createLocalZeroGDAProvider();

let result;
switch (command) {
  case "start":
  case "init":
    result = { provider: "local-0g", rootDir: storage.rootDir, objectsDir: storage.objectsDir, uploadLogPath: storage.uploadLogPath };
    break;
  case "test-upload":
    result = await storage.uploadValidationProof(args.claim || "local-test-claim", { ok: true, source: "local-0g-cli" });
    break;
  case "read-proof":
    if (!args.uri) throw new Error("--uri is required");
    result = await storage.readZeroGObject(args.uri);
    break;
  case "publish-da":
    result = await da.publishStrategyExecutionLog({ ok: true, source: "local-0g-cli" });
    break;
  default:
    throw new Error(`Unknown local 0G command: ${command}`);
}

console.log(JSON.stringify(result, null, 2));

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith("--")) continue;
    const key = values[i].slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
