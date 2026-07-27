import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
config({ path: path.resolve(rootEnvPath) });
