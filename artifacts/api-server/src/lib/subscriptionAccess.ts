import { eq, sql } from "drizzle-orm";
import { db, groupsTable, rawQuery, settingsTable, usersTable } from "@workspace/db";

/** SQL fragment: user_product is trial or paid and not expired. */
export const activatedUserProductWhere = sql`
  up.active_until IS NOT NULL
  AND up.active_until >= NOW()
  AND (
    up.status IN ('1', 'active')
    OR up.status IN ('0', '')
    OR up.status IS NULL
  )
`;

export async function userHasActiveSubscription(userId: number): Promise<boolean> {
  const rows = await rawQuery<{ ok: number }>(sql`
    SELECT 1 AS ok
    FROM user_products up
    JOIN products p ON p.id = up.product_id
    WHERE up.user_id = ${userId}
      AND p.status = 1
      AND ${activatedUserProductWhere}
    LIMIT 1
  `);
  return rows.length > 0;
}

export async function getDefaultUserGroupId(): Promise<number | null> {
  const fromEnv = process.env.DEFAULT_USER_GROUP_ID;
  if (fromEnv) {
    const n = parseInt(fromEnv, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.name, "default_user_group_id"));

  if (!row?.value) return null;

  const n = parseInt(String(row.value).trim(), 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

/** After successful payment, move the user into the product's assigned group. */
export async function assignUserToProductGroup(
  userId: number,
  groupId: number | null | undefined,
): Promise<void> {
  if (!groupId) return;

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) return;

  await db.update(usersTable).set({ groupId }).where(eq(usersTable.id, userId));
}
