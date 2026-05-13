import "dotenv/config";
import { runLocalPredictionE2E } from "./harness.js";

const result = await runLocalPredictionE2E({ requireRealAI: process.env.REQUIRE_REAL_AI !== "false" });
console.log(JSON.stringify(result, null, 2));
