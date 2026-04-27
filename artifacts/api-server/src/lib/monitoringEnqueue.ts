import { db } from "@workspace/db";
import { monitoringScopesTable, type MonitoringKeyword } from "@workspace/db";
import { logger } from "./logger";
import { monitoringGraphQlHeaders } from "./graphqlMonitoringAuth";

const GRAPHQL_URL = process.env.GRAPHQL_MONITORING_URL ?? "https://trans.rasr.in/graphql";

/** Matches PHP `date('d/m/Y', strtotime('last Monday'))` journal anchor when journals API has no row. */
export function lastMondayIsoLocal(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/**
 * PHP stores classes as pipe-delimited (e.g. "|25|35|"). The React UI sends "25,35".
 * Without normalization, getAllClasses() in monitoringProcessScope never matches conflicts.
 */
export function normalizeMonitoringClass(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (s.includes("|")) {
    const inner = s.replace(/^\|+|\|+$/g, "");
    const parts = inner.split("|").map((p) => p.trim()).filter(Boolean);
    return parts.length ? `|${parts.join("|")}|` : "";
  }
  const parts = s.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  return parts.length ? `|${parts.join("|")}|` : "";
}

/** Returns null on HTTP/GraphQL failure; empty array if API succeeded but no rows. */
export async function graphQlJournalRequest(): Promise<any[] | null> {
  const query = `
    query JournalsQuery($journalDate: String, $countryCode: String) {
      journals: allJournalDates(journalDate: $journalDate, countryCode: $countryCode) {
        journalDate
        countryCode
      }
    }
  `;

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: monitoringGraphQlHeaders(),
      body: JSON.stringify({
        query,
        variables: { countryCode: "", journalDate: "latest" },
      }),
    });

    const bodyText = await response.text();
    let json: any;
    try {
      json = JSON.parse(bodyText);
    } catch {
      logger.warn({ status: response.status, bodyPreview: bodyText.slice(0, 200) }, "GraphQL journal: non-JSON response");
      return null;
    }

    if (!response.ok) {
      logger.warn({ status: response.status, errors: json?.errors }, "GraphQL journal HTTP error");
      return null;
    }
    if (json.errors?.length) {
      logger.warn({ errors: json.errors }, "GraphQL journal GraphQL errors");
      return null;
    }
    return json.data?.journals ?? [];
  } catch (err) {
    logger.error({ err }, "GraphQL journal request failed");
    return null;
  }
}

function journalDateToIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "string") return value.slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

/**
 * Mirrors PHP Monitoring::generateQueue scope rows (simplified: word split only).
 * PHP also expands via Similarity::checkWord / golden rules — not ported here.
 */
export async function createScopesForKeywords(keywords: MonitoringKeyword[], journalDateIso: string): Promise<number> {
  let count = 0;
  for (const keyword of keywords) {
    const words = keyword.keyword.toLowerCase().trim().split(/\s+/);
    for (const word of words) {
      if (!word) continue;
      const isIndia = keyword.country.toUpperCase() === "IN";
      await db.insert(monitoringScopesTable).values({
        keywordId: keyword.id,
        keyword: word,
        class: keyword.class,
        wordToCompare: word,
        countryCode: isIndia ? "in" : null,
        variables: {
          keyword: word,
          countryCode: keyword.country,
          journalDate: journalDateIso,
          offset: 0,
          limit: 100000,
        },
      });
      count++;
    }
  }
  return count;
}

/**
 * PHP AddKeywords / import call Artisan::queue('monitoring:generate:queue', ...) when the keyword's
 * country appears in the latest journals list. Node previously never created scopes on POST.
 */
export async function enqueueScopesForKeyword(keyword: MonitoringKeyword): Promise<void> {
  const countryUpper = keyword.country.trim().toUpperCase();

  if (countryUpper === "IN") {
    /** Match PHP Monitoring::generateQueue default: date('d/m/Y', strtotime('last Monday')), not "today". */
    const journalIso = lastMondayIsoLocal();
    const n = await createScopesForKeywords([keyword], journalIso);
    logger.info({ keywordId: keyword.id, journalDate: journalIso, scopes: n }, "enqueueScopesForKeyword: India scopes");
    return;
  }

  const journals = await graphQlJournalRequest();
  if (journals === null) {
    const fallback = lastMondayIsoLocal();
    const n = await createScopesForKeywords([keyword], fallback);
    logger.warn(
      { keywordId: keyword.id, journalDate: fallback, scopes: n },
      "enqueueScopesForKeyword: journals API failed (check MONITORING_GRAPHQL_* auth); scopes created with last Monday date",
    );
    return;
  }

  let created = 0;
  for (const journal of journals) {
    if (journal.countryCode === "IND") continue;
    const jc = String(journal.countryCode ?? "").trim().toUpperCase();
    if (jc !== countryUpper) continue;

    const iso = journalDateToIso(journal.journalDate);
    const n = await createScopesForKeywords([keyword], iso);
    created += n;
    logger.info({ keywordId: keyword.id, country: jc, journalDate: iso, scopes: n }, "enqueueScopesForKeyword: scopes from journal");
  }

  if (created === 0) {
    const fallback = lastMondayIsoLocal();
    const n = await createScopesForKeywords([keyword], fallback);
    logger.warn(
      { keywordId: keyword.id, country: countryUpper, journalDate: fallback, scopes: n },
      "enqueueScopesForKeyword: no journal row matched this country; scopes created with last Monday (PHP generateQueue default date style)",
    );
  }
}
