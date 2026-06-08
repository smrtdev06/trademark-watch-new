import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(srcDir, "../../..");
/* Do not override PORT/DATABASE_URL already set by PM2 or npm scripts. */
config({ path: path.join(workspaceRoot, ".env"), override: false });
