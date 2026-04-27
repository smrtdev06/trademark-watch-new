import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, userProfilesTable, userStatsTable, groupsTable } from "@workspace/db";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { signToken, requireAuth, type AuthUser } from "../lib/auth";
import { getDefaultAllMenuPermissions, isAppAdminRole } from "../lib/menuKeys";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: 400, message: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ status: 401, message: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ status: 401, message: "Invalid credentials" });
    return;
  }
  if (user.deletedAt) {
    res.status(403).json({ status: 403, message: "Account suspended" });
    return;
  }
  const authUser: AuthUser = { id: user.id, email: user.email, role: user.role, name: user.name };
  const token = signToken(authUser);

  await db.update(userStatsTable).set({ lastLogin: new Date(), loginCount: (user.id) }).where(eq(userStatsTable.userId, user.id));

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, user.id));
  let groupPermissions: Record<string, boolean> | null = null;
  if (user.groupId) {
    const [g] = await db.select().from(groupsTable).where(eq(groupsTable.id, user.groupId));
    if (g) groupPermissions = g.menuPermissions;
  }
  if (isAppAdminRole(user.role)) {
    groupPermissions = getDefaultAllMenuPermissions();
  }
  res.json({
    status: 200,
    user: { ...user, password: undefined, profile: profile || undefined, groupPermissions },
    token,
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: 400, message: parsed.error.message });
    return;
  }
  const { name, email, password, phone } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ status: 409, message: "Email already registered" });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ name, email, password: hash, phone }).returning();
  await db.insert(userProfilesTable).values({ userId: user.id });
  await db.insert(userStatsTable).values({ userId: user.id });
  const authUser: AuthUser = { id: user.id, email: user.email, role: user.role, name: user.name };
  const token = signToken(authUser);
  let groupPermissions: Record<string, boolean> | null = null;
  if (user.groupId) {
    const [g] = await db.select().from(groupsTable).where(eq(groupsTable.id, user.groupId));
    if (g) groupPermissions = g.menuPermissions;
  }
  if (isAppAdminRole(user.role)) {
    groupPermissions = getDefaultAllMenuPermissions();
  }
  res.json({ status: 200, user: { ...user, password: undefined, groupPermissions }, token });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(404).json({ status: 404, message: "User not found" });
    return;
  }
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, user.id));
  let groupPermissions: Record<string, boolean> | null = null;
  if (user.groupId) {
    const [g] = await db.select().from(groupsTable).where(eq(groupsTable.id, user.groupId));
    if (g) groupPermissions = g.menuPermissions;
  }
  if (isAppAdminRole(user.role)) {
    groupPermissions = getDefaultAllMenuPermissions();
  }
  res.json({ ...user, password: undefined, profile: profile || undefined, groupPermissions });
});

router.post("/auth/logout", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, message: "Logged out" });
});

export default router;
