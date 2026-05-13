import "dotenv/config";
import { deployLocalMantle } from "./harness.js";

const { deployment } = await deployLocalMantle({ write: true });
console.log(JSON.stringify(deployment, null, 2));
