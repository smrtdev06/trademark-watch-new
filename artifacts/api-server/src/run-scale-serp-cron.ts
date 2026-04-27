/**
 * Runs the Social Watch / ScaleSerp job (`scale-serp:run`):
 * fetches image results for due keywords and writes `social_results`.
 *
 * Usage: pnpm --filter @workspace/api-server run cron:scale-serp
 * Optional: SOCIAL_WATCH_CRON_FORCE=1 to run every keyword (ignore trigger_at), e.g. after testing.
 * Requires DATABASE_URL and SCALESERP_APIKEY (same as Laravel; optional fallback: SCALE_SERP_API_KEY) in repo root `.env`.
 */
import "./env-bootstrap";
import { scaleSerpRun } from "./cron/jobs/scaleSerpRun";

async function main() {
  console.log("[scale-serp] scale-serp:run …");
  await scaleSerpRun();
  console.log("[scale-serp] done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
