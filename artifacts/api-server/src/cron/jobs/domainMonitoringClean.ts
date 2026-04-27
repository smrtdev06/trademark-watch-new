import { db } from "@workspace/db";
import { domainsTable } from "@workspace/db";
import { logger } from "../../lib/logger";

export async function domainMonitoringClean() {
  try {
    await db.update(domainsTable).set({ status: 0 });
    logger.info("Domain monitoring statuses reset to 0");
  } catch (err) {
    logger.error({ err }, "Domain monitoring clean failed");
  }
}
