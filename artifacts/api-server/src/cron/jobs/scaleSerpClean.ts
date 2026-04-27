import { logger } from "../../lib/logger";
import fs from "fs";
import path from "path";

export async function scaleSerpClean() {
  const tmpDir = path.join(process.cwd(), "tmp_scaleserpimgs");

  try {
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tmpDir, file));
      }
      logger.info({ count: files.length }, "ScaleSerp temp images cleaned");
    } else {
      logger.info("No ScaleSerp temp directory to clean");
    }
  } catch (err) {
    logger.error({ err }, "ScaleSerp clean failed");
  }
}
