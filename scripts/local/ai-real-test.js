import "dotenv/config";
import { runRealAiTest } from "./harness.js";

const result = await runRealAiTest({
  mode: process.env.TEST_MODE || "MOCK_ONLY",
  requireRealAI: process.env.REQUIRE_REAL_AI === "true",
});
console.log(JSON.stringify(result, null, 2));
