import cron from "node-cron";
import { logger } from "../lib/logger";
import { monitoringProcessScope } from "./jobs/monitoringProcessScope";
import { monitoringRerunStucked } from "./jobs/monitoringRerunStucked";
import { monitoringCheckLatest } from "./jobs/monitoringCheckLatest";
import { domainMonitoringClean } from "./jobs/domainMonitoringClean";
import { domainMonitoringCheck } from "./jobs/domainMonitoringCheck";
import { alertsCheck } from "./jobs/alertsCheck";
import { alertReport } from "./jobs/alertReport";
import { exportQueueProcess } from "./jobs/exportQueueProcess";
import { logoSearch } from "./jobs/logoSearch";
import { scaleSerpRun } from "./jobs/scaleSerpRun";
import { scaleSerpClean } from "./jobs/scaleSerpClean";
import { scaleSerpReport } from "./jobs/scaleSerpReport";
import { monitoringReport } from "./jobs/monitoringReport";
import { domainMonitoringReport } from "./jobs/domainMonitoringReport";
import { checkTrialPeriod } from "./jobs/checkTrialPeriod";

/**
 * Cron parity with Laravel `new-monitoring/app/Console/Kernel.php::schedule()`.
 * Times use the same expressions as Laravel’s scheduler in that file.
 *
 * Override timezone with `CRON_TZ` (defaults to `Asia/Kolkata`, matching
 * `new-monitoring/config/app.php` `timezone`).
 */
const CRON_TZ = process.env.CRON_TZ ?? "Asia/Kolkata";
const cronOpts = { timezone: CRON_TZ };

function wrapJob(name: string, fn: () => Promise<void>) {
  return async () => {
    const start = Date.now();
    logger.info(`[CRON] Starting: ${name}`);
    try {
      await fn();
      logger.info(`[CRON] Completed: ${name} (${Date.now() - start}ms)`);
    } catch (err) {
      logger.error({ err }, `[CRON] Failed: ${name}`);
    }
  };
}

const locks = new Map<string, boolean>();

/** Same idea as Laravel `withoutOverlapping()` for these two commands (process mutex). */
function wrapJobNoOverlap(name: string, fn: () => Promise<void>) {
  return async () => {
    if (locks.get(name)) {
      logger.info(`[CRON] Skipping (already running): ${name}`);
      return;
    }
    locks.set(name, true);
    try {
      await wrapJob(name, fn)();
    } finally {
      locks.set(name, false);
    }
  };
}

export function initCronJobs() {
  logger.info({ CRON_TZ }, "[CRON] Initializing scheduler (parity with Laravel Kernel.php)");

  // Kernel L27-28: everyMinute + withoutOverlapping
  cron.schedule("* * * * *", wrapJobNoOverlap("monitoring:process:scope", () => monitoringProcessScope()), cronOpts);
  cron.schedule("* * * * *", wrapJobNoOverlap("monitoring:process:scope:india", () => monitoringProcessScope("IN")), cronOpts);

  // Kernel L29
  cron.schedule("*/10 * * * *", wrapJob("monitoring:rerun:stucked", monitoringRerunStucked), cronOpts);

  // Kernel L30-31: everyThreeHours → 0 */3 * * * ; dailyAt 10:10
  cron.schedule("0 */3 * * *", wrapJob("monitoring:check:latest", monitoringCheckLatest), cronOpts);
  cron.schedule("10 10 * * *", wrapJob("monitoring:report", monitoringReport), cronOpts);

  // Kernel L33-35
  cron.schedule("0 0 * * *", wrapJob("domain:monitoring:clean", domainMonitoringClean), cronOpts);
  cron.schedule("0 10 * * *", wrapJob("domain:monitoring:check", domainMonitoringCheck), cronOpts);
  cron.schedule("0 11 * * *", wrapJob("domain:monitoring:report", domainMonitoringReport), cronOpts);

  // Kernel L37-39
  cron.schedule("0 0 * * *", wrapJob("scale-serp:clean", scaleSerpClean), cronOpts);
  cron.schedule("10 9 * * *", wrapJob("scale-serp:run", scaleSerpRun), cronOpts);
  cron.schedule("30 10 * * *", wrapJob("scale-serp:report", scaleSerpReport), cronOpts);

  // Kernel L41-47
  cron.schedule("20 10 * * *", wrapJob("alerts:check:fssai", () => alertsCheck("fssai")), cronOpts);
  cron.schedule("40 10 * * *", wrapJob("alerts:check:mca", () => alertsCheck("mca")), cronOpts);
  cron.schedule("0 11 * * *", wrapJob("alerts:check:udyaam", () => alertsCheck("udyaam")), cronOpts);
  cron.schedule("20 11 * * *", wrapJob("alerts:check:citations", () => alertsCheck("citations")), cronOpts);
  cron.schedule("40 11 * * *", wrapJob("alerts:check:opposition_watch", () => alertsCheck("opposition_watch")), cronOpts);
  cron.schedule("0 12 * * *", wrapJob("alerts:check:proprietor_search", () => alertsCheck("proprietor_search")), cronOpts);
  cron.schedule("20 12 * * *", wrapJob("alerts:check:domain_monitoring", () => alertsCheck("domain_monitoring")), cronOpts);

  // Kernel L48
  cron.schedule("0 14 * * *", wrapJob("alert:report", alertReport), cronOpts);

  // Kernel L50
  cron.schedule("*/10 * * * *", wrapJob("export:queue:process", exportQueueProcess), cronOpts);

  // Kernel L52
  cron.schedule("0 2 * * *", wrapJob("logo:search", logoSearch), cronOpts);

  // check:trial – daily at 08:00 (not in Laravel Kernel.php schedule, but defined as artisan command)
  cron.schedule("0 8 * * *", wrapJob("check:trial", checkTrialPeriod), cronOpts);

  logger.info("[CRON] All jobs registered (same order as Laravel Kernel.php)");
}
