import "dotenv/config";
import { runRealAiTest } from "./harness.js";

const result = await runRealAiTest({ mode: "MOCK_ONLY", requireRealAI: false });
console.log(JSON.stringify(result, null, 2));
