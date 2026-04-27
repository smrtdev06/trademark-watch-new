import { Router, type IRouter } from "express";
import { eq, sql, count } from "drizzle-orm";
import { db, rawQuery, organizationsTable, organizationMembersTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/organizations", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM organizations`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await db.select().from(organizationsTable).orderBy(organizationsTable.id).limit(perPage).offset((page - 1) * perPage);
  res.json({ data, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.get("/organizations/my", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const [membership] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.userId, userId));
  if (!membership) {
    res.json({ organization: null, head: [], members: [] });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, membership.organizationId));
  const allMembers = await rawQuery(sql`
    SELECT om.*, u.name as user_name, u.email as user_email
    FROM organization_members om
    LEFT JOIN users u ON om.user_id = u.id
    WHERE om.organization_id = ${membership.organizationId}
  `);

  const members = (allMembers as any[]).map((m: any) => ({
    id: m.id, userId: m.user_id, organizationId: m.organization_id,
    head: m.head, userName: m.user_name, userEmail: m.user_email,
  }));

  res.json({
    organization: org,
    head: members.filter(m => m.head),
    members: members.filter(m => !m.head),
  });
});

export default router;
