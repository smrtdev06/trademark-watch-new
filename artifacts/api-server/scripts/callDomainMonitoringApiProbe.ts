/**
 * One-off: call the WHOIS domain API — latest row in `domain_monitoring`, URL from env.
 * Date range: **January 1 (current year) → today** (local calendar).
 */
import "../src/env-bootstrap";
import { db } from "@workspace/db";
import { domainsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { localCalendarYmd } from "../src/lib/domainMonitoringDates";

/** 1/1 ~ current year (probe only; production cron still uses {@link ../src/cron/jobs/domainMonitoringCheck.ts} defaults). */
function januaryFirstThroughToday(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const from = `${y}-01-01`;
  const to = localCalendarYmd(now);
  return { from, to };
}

const DOMAIN_API_DEFAULT = "http://89.40.6.177:8080/api/rest/search";

function buildDomainPattern(domain: string, searchType: string): string {
  switch (searchType) {
    case "contains":
      return `%${domain}%`;
    case "starts":
      return `${domain}%`;
    case "ends":
      return `%${domain}`;
    default:
      return "";
  }
}

async function main() {
  const url = process.env.DOMAIN_MONITORING_API_URL?.trim() || DOMAIN_API_DEFAULT;
  const { from, to } = januaryFirstThroughToday();

  const rows = await db.select().from(domainsTable).orderBy(desc(domainsTable.id)).limit(1);
  if (rows.length === 0) {
    console.error("No rows in domain_monitoring — add a domain in the app first.");
    process.exit(1);
  }

  const d = rows[0];
  const like = buildDomainPattern(d.domain, d.searchType);
  if (!like) {
    console.error("Invalid searchType on row:", d.searchType);
    process.exit(1);
  }

  const payload = { like, from, to };
  console.log("POST", url);
  console.log("Using DB row:", { id: d.id, domain: d.domain, searchType: d.searchType, status: d.status });
  console.log("Body:", JSON.stringify(payload));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log("HTTP", res.status, res.statusText);

  try {
    const data = JSON.parse(text) as { whois_db_whois?: unknown[] };
    const n = Array.isArray(data.whois_db_whois) ? data.whois_db_whois.length : 0;
    console.log("whois_db_whois entries:", n);
    console.log(JSON.stringify(data, null, 2));
  } catch {
    console.log(text.slice(0, 3000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
