import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(srcDir, "../../..");
/* `.env` must win over a stray parent `PORT` (e.g. same shell used for Vite). */
config({ path: path.join(workspaceRoot, ".env"), override: true });
