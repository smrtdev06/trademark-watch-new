import { db, rawQuery } from "@workspace/db";
import { domainsTable, domainResultsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { defaultDomainMonitoringDateRange } from "../../lib/domainMonitoringDates";

/** PHP {@link new-monitoring/app/Services/Monitoring/DomainMonitoringService.php} `$api` */
const DOMAIN_API_DEFAULT = "http://89.40.6.177:8080/api/rest/search";

const SCOPE_SIZE = 50;

function domainApiUrl(): string {
  return process.env.DOMAIN_MONITORING_API_URL?.trim() || DOMAIN_API_DEFAULT;
}

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

async function makeRequest(
  domainPattern: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, unknown> | false> {
  try {
    const response = await fetch(domainApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      /** PHP sends JSON string as body while header says urlencoded — we match that. */
      body: JSON.stringify({ like: domainPattern, from: fromDate, to: toDate }),
    });
    if (!response.ok) return false;
    return (await response.json()) as Record<string, unknown>;
  } catch (err) {
    logger.error({ err }, "Domain monitoring API request failed");
    return false;
  }
}

type WhoisRow = {
  domain_name?: string;
  registrant_name?: string;
  registrant_country?: string;
  create_date?: string;
};

/**
 * PHP `Result::updateOrCreate($arr, $arr)` — match on user_id, domain_monitoring_id, domain_name,
 * registrant_name, registrant_country, create_date (null-safe).
 */
async function upsertDomainResultLikePhp(
  domainRecord: { id: number; userId: number },
  result: WhoisRow,
): Promise<void> {
  const rows = await rawQuery<{ id: number }>(sql`
    SELECT id FROM domain_results
    WHERE user_id = ${domainRecord.userId}
      AND domain_monitoring_id = ${domainRecord.id}
      AND domain_name IS NOT DISTINCT FROM ${result.domain_name ?? null}
      AND registrant_name IS NOT DISTINCT FROM ${result.registrant_name ?? null}
      AND registrant_country IS NOT DISTINCT FROM ${result.registrant_country ?? null}
      AND create_date IS NOT DISTINCT FROM ${result.create_date ?? null}
    LIMIT 1
  `);
  const existingId = rows[0]?.id;
  if (existingId != null) {
    await db
      .update(domainResultsTable)
      .set({
        domainName: result.domain_name ?? null,
        registrantName: result.registrant_name ?? null,
        registrantCountry: result.registrant_country ?? null,
        createDate: result.create_date ?? null,
      })
      .where(eq(domainResultsTable.id, existingId));
    return;
  }
  await db.insert(domainResultsTable).values({
    userId: domainRecord.userId,
    domainMonitoringId: domainRecord.id,
    domainName: result.domain_name ?? null,
    registrantName: result.registrant_name ?? null,
    registrantCountry: result.registrant_country ?? null,
    createDate: result.create_date ?? null,
  });
}

export type DomainMonitoringCheckOptions = {
  /** PHP `DomainMonitoringService($from, $to)` optional override */
  from?: string;
  to?: string;
};

/**
 * PHP `domain:monitoring:check` → {@link new-monitoring/app/Services/Monitoring/DomainMonitoringService.php} `process()`
 */
export async function domainMonitoringCheck(options?: DomainMonitoringCheckOptions): Promise<void> {
  const defaults = defaultDomainMonitoringDateRange();
  const fromDate = options?.from ?? defaults.from;
  const toDate = options?.to ?? defaults.to;

  const domains = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.status, 0))
    .limit(SCOPE_SIZE);

  for (const domainRecord of domains) {
    const domainPattern = buildDomainPattern(domainRecord.domain, domainRecord.searchType);

    if (!domainPattern) {
      await db.update(domainsTable).set({ status: 2 }).where(eq(domainsTable.id, domainRecord.id));
      continue;
    }

    const data = await makeRequest(domainPattern, fromDate, toDate);

    if (data === false) {
      await db.update(domainsTable).set({ status: 2 }).where(eq(domainsTable.id, domainRecord.id));
      continue;
    }

    try {
      const whois = data.whois_db_whois;
      if (whois && Array.isArray(whois)) {
        for (const raw of whois) {
          const result = raw as WhoisRow;
          await upsertDomainResultLikePhp(domainRecord, result);
        }
      }

      await db.update(domainsTable).set({ status: 1 }).where(eq(domainsTable.id, domainRecord.id));
    } catch (err) {
      /** PHP empty catch — we log and mark failed to avoid infinite retries on bad rows */
      logger.error({ err, domainMonitoringId: domainRecord.id }, "Error processing domain monitoring results");
      await db.update(domainsTable).set({ status: 2 }).where(eq(domainsTable.id, domainRecord.id));
    }
  }
}
