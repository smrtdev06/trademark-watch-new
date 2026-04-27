/**
 * Runs the same TM Watch pipeline as the Linux scheduled tasks / node-cron:
 * - monitoring:check:latest — new journals → scopes for matching keywords
 * - monitoring:process:scope — phoneticSearch batch (non-India scopes)
 * - monitoring:process:scope:india — India HTTP monitoring batch
 *
 * Usage (from repo root): pnpm run tm-watch:cron
 * Requires DATABASE_URL (+ GraphQL auth in .env) like the API server.
 */
import "./env-bootstrap";
import { monitoringCheckLatest } from "./cron/jobs/monitoringCheckLatest";
import { monitoringProcessScope } from "./cron/jobs/monitoringProcessScope";

async function main() {
  console.log("[tm-watch] monitoring:check:latest …");
  await monitoringCheckLatest();

  console.log("[tm-watch] monitoring:process:scope (international) …");
  await monitoringProcessScope();

  console.log("[tm-watch] monitoring:process:scope:india …");
  await monitoringProcessScope("IN");

  console.log("[tm-watch] done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
