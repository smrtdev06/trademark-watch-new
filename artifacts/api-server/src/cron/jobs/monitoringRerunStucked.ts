import { db } from "@workspace/db";
import { monitoringScopesTable } from "@workspace/db";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

export async function monitoringRerunStucked() {
  await db.update(monitoringScopesTable)
    .set({ status: 0 })
    .where(and(
      isNull(monitoringScopesTable.countryCode),
      eq(monitoringScopesTable.status, 1),
      lt(monitoringScopesTable.createdAt, sql`NOW() - INTERVAL '20 minutes'`)
    ));
}
