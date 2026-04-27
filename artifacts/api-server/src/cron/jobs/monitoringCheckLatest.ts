import { db } from "@workspace/db";
import { monitoringLatestTable, monitoringKeywordsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { graphQlJournalRequest, createScopesForKeywords, lastMondayIsoLocal } from "../../lib/monitoringEnqueue";

export async function monitoringCheckLatest() {
  await processIndiaKeywords();

  const journals = await graphQlJournalRequest();

  if (journals === null) {
    logger.warn("monitoringCheckLatest: journals GraphQL request failed (auth or network); check MONITORING_GRAPHQL_* env");
    return;
  }

  if (journals.length === 0) {
    logger.info("No new journal records found");
    return;
  }

  for (const journal of journals) {
    if (journal.countryCode === "IND") continue;

    const existing = await db.select().from(monitoringLatestTable)
      .where(and(
        eq(monitoringLatestTable.countryCode, journal.countryCode),
        sql`journal_date = ${journal.journalDate}::date`
      ))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(monitoringLatestTable).values({
      countryCode: journal.countryCode,
      journalDate: journal.journalDate,
    });

    const keywords = await db.select().from(monitoringKeywordsTable)
      .where(eq(monitoringKeywordsTable.country, journal.countryCode));

    const journalDateIso =
      typeof journal.journalDate === "string"
        ? journal.journalDate.slice(0, 10)
        : new Date(journal.journalDate).toISOString().split("T")[0];

    const scopeCount = await createScopesForKeywords(keywords, journalDateIso);
    logger.info({ countryCode: journal.countryCode, journalDate: journalDateIso, scopeCount }, "New journal date processed, scopes generated");
  }
}

async function processIndiaKeywords() {
  /** Same journal anchor as enqueueScopesForKeyword / PHP generateQueue — not calendar "today". */
  const journalIso = lastMondayIsoLocal();

  const existing = await db.select().from(monitoringLatestTable)
    .where(and(
      eq(monitoringLatestTable.countryCode, "IN"),
      sql`journal_date = ${journalIso}::date`
    ))
    .limit(1);

  if (existing.length > 0) return;

  const keywords = await db.select().from(monitoringKeywordsTable)
    .where(eq(monitoringKeywordsTable.country, "IN"));

  if (keywords.length === 0) {
    logger.info("No India keywords to process");
    return;
  }

  await db.insert(monitoringLatestTable).values({
    countryCode: "IN",
    journalDate: journalIso,
  });

  const scopeCount = await createScopesForKeywords(keywords, journalIso);
  logger.info({ journalDate: journalIso, scopeCount, keywordIds: keywords.map((k) => k.id) }, "India keyword scopes generated (last-Monday journal anchor)");
}
