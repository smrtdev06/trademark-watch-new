import { Router } from "express";
import { requireAuth, requireAdmin } from "../lib/auth";
import { monitoringProcessScope } from "../cron/jobs/monitoringProcessScope";
import { monitoringRerunStucked } from "../cron/jobs/monitoringRerunStucked";
import { monitoringCheckLatest } from "../cron/jobs/monitoringCheckLatest";
import { domainMonitoringClean } from "../cron/jobs/domainMonitoringClean";
import { domainMonitoringCheck } from "../cron/jobs/domainMonitoringCheck";
import { alertsCheck } from "../cron/jobs/alertsCheck";
import { alertReport } from "../cron/jobs/alertReport";
import { exportQueueProcess } from "../cron/jobs/exportQueueProcess";
import { logoSearch } from "../cron/jobs/logoSearch";
import { scaleSerpRun } from "../cron/jobs/scaleSerpRun";
import { scaleSerpClean } from "../cron/jobs/scaleSerpClean";
import { scaleSerpReport } from "../cron/jobs/scaleSerpReport";
import { monitoringReport } from "../cron/jobs/monitoringReport";
import { domainMonitoringReport } from "../cron/jobs/domainMonitoringReport";

const router = Router();

const JOBS: Record<string, () => Promise<void>> = {
  "monitoring:process:scope": () => monitoringProcessScope(),
  "monitoring:process:scope:india": () => monitoringProcessScope("IN"),
  "monitoring:rerun:stucked": monitoringRerunStucked,
  "monitoring:check:latest": monitoringCheckLatest,
  "monitoring:report": monitoringReport,
  "domain:monitoring:clean": domainMonitoringClean,
  "domain:monitoring:check": domainMonitoringCheck,
  "domain:monitoring:report": domainMonitoringReport,
  "scale-serp:clean": scaleSerpClean,
  "scale-serp:run": scaleSerpRun,
  "scale-serp:report": scaleSerpReport,
  "alerts:check:fssai": () => alertsCheck("fssai"),
  "alerts:check:mca": () => alertsCheck("mca"),
  "alerts:check:udyaam": () => alertsCheck("udyaam"),
  "alerts:check:citations": () => alertsCheck("citations"),
  "alerts:check:opposition_watch": () => alertsCheck("opposition_watch"),
  "alerts:check:proprietor_search": () => alertsCheck("proprietor_search"),
  "alerts:check:domain_monitoring": () => alertsCheck("domain_monitoring"),
  "alert:report": alertReport,
  "export:queue:process": exportQueueProcess,
  "logo:search": logoSearch,
};

router.get("/cron/jobs", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  res.json({ status: 200, jobs: Object.keys(JOBS) });
});

router.post("/cron/trigger/:jobName", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const jobName = req.params.jobName;
  const jobFn = JOBS[jobName];
  if (!jobFn) {
    res.status(404).json({ status: 404, message: `Job "${jobName}" not found`, available: Object.keys(JOBS) });
    return;
  }
  const start = Date.now();
  try {
    await jobFn();
    res.json({ status: 200, job: jobName, message: "Completed", durationMs: Date.now() - start });
  } catch (err: any) {
    res.status(500).json({ status: 500, job: jobName, message: "Failed", error: err.message, durationMs: Date.now() - start });
  }
});

router.post("/cron/trigger-all", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const results: Array<{ job: string; status: string; durationMs: number; error?: string }> = [];
  for (const [name, fn] of Object.entries(JOBS)) {
    const start = Date.now();
    try {
      await fn();
      results.push({ job: name, status: "success", durationMs: Date.now() - start });
    } catch (err: any) {
      results.push({ job: name, status: "failed", durationMs: Date.now() - start, error: err.message });
    }
  }
  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;
  res.json({ status: 200, summary: { total: results.length, succeeded, failed }, results });
});

export default router;
