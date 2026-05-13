import "dotenv/config";
import { runLocalDefiE2E } from "./harness.js";

const result = await runLocalDefiE2E({ requireRealAI: process.env.REQUIRE_REAL_AI === "true" });
console.log(JSON.stringify(result, null, 2));
