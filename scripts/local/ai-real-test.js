import "dotenv/config";
import { runRealAiTest } from "./harness.js";

const result = await runRealAiTest();
console.log(JSON.stringify(result, null, 2));
