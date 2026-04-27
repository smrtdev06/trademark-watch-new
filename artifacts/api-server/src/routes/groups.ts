import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, groupsTable } from "@workspace/db";
import { requireAuth, requireAdmin, parseId } from "../lib/auth";

const router: IRouter = Router();

router.get("/groups", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(groupsTable).orderBy(asc(groupsTable.id));
  res.json(
    rows.map((g) => ({
      id: g.id,
      name: g.name,
      menuPermissions: g.menuPermissions,
      createdAt: g.createdAt,
    })),
  );
});

router.post("/groups", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, menuPermissions } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ status: 400, message: "Name is required" });
    return;
  }
  const perms: Record<string, boolean> =
    menuPermissions && typeof menuPermissions === "object" && !Array.isArray(menuPermissions)
      ? (menuPermissions as Record<string, boolean>)
      : {};
  try {
    const [row] = await db
      .insert(groupsTable)
      .values({ name: name.trim(), menuPermissions: perms })
      .returning();
    res.json({
      id: row.id,
      name: row.name,
      menuPermissions: row.menuPermissions,
      createdAt: row.createdAt,
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ status: 409, message: "A group with this name already exists" });
      return;
    }
    throw e;
  }
});

router.put("/groups/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { name, menuPermissions } = req.body;
  const perms: Record<string, boolean> | undefined =
    menuPermissions && typeof menuPermissions === "object" && !Array.isArray(menuPermissions)
      ? (menuPermissions as Record<string, boolean>)
      : undefined;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ status: 400, message: "Invalid name" });
    return;
  }
  try {
    const [row] = await db
      .update(groupsTable)
      .set({
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(perms !== undefined ? { menuPermissions: perms } : {}),
      })
      .where(eq(groupsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ status: 404, message: "Group not found" });
      return;
    }
    res.json({
      id: row.id,
      name: row.name,
      menuPermissions: row.menuPermissions,
      createdAt: row.createdAt,
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ status: 409, message: "A group with this name already exists" });
      return;
    }
    throw e;
  }
});

router.delete("/groups/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [row] = await db.delete(groupsTable).where(eq(groupsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ status: 404, message: "Group not found" });
    return;
  }
  res.json({ status: 200, message: "Group deleted" });
});

export default router;
