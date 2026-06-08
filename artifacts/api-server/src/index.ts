import "./env-bootstrap";
import app from "./app";
import { logger } from "./lib/logger";
import { initCronJobs } from "./cron/scheduler";
import { ensureMonitoringResultsFavoriteColumn, ensureUserProductsTable } from "./lib/ensureDbPatches";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

void (async () => {
  try {
    await ensureMonitoringResultsFavoriteColumn();
    await ensureUserProductsTable();
  } catch (err) {
    logger.error({ err }, "Database startup checks failed");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    initCronJobs();
  });
})();
