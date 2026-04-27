import { Router, type IRouter } from "express";
import { eq, sql, ilike } from "drizzle-orm";
import { db, clientsTable, usersTable } from "@workspace/db";
import { requireAuth, parseId } from "../lib/auth";

const router: IRouter = Router();

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const search = req.query.search as string;

  let query = db.select({
    id: clientsTable.id,
    name: clientsTable.name,
    email1: clientsTable.email1,
    email2: clientsTable.email2,
    email3: clientsTable.email3,
    phone1: clientsTable.phone1,
    phone2: clientsTable.phone2,
    phone3: clientsTable.phone3,
    address1: clientsTable.address1,
    address2: clientsTable.address2,
    address3: clientsTable.address3,
    country: clientsTable.country,
    city: clientsTable.city,
    pincode: clientsTable.pincode,
    clientType: clientsTable.clientType,
    preferredContactType: clientsTable.preferredContactType,
    allowControlPanel: clientsTable.allowControlPanel,
    userId: clientsTable.userId,
    userName: usersTable.name,
    userEmail: usersTable.email,
    createdAt: clientsTable.createdAt,
  }).from(clientsTable).leftJoin(usersTable, eq(clientsTable.userId, usersTable.id));

  const conditions = [];
  if (!isAdmin) conditions.push(eq(clientsTable.userId, userId));
  if (search) conditions.push(ilike(clientsTable.name, `%${search}%`));

  if (conditions.length > 0) {
    const results = await query.where(sql.join(conditions, sql` AND `));
    res.json(results);
  } else {
    const results = await query;
    res.json(results);
  }
});

router.post("/clients", requireAuth, async (req, res): Promise<void> => {
  const { name, email1, email2, email3, phone1, phone2, phone3, address1, address2, address3, country, city, pincode, clientType, preferredContactType, allowControlPanel } = req.body;
  if (!name) {
    res.status(400).json({ status: 400, message: "Name is required" });
    return;
  }
  await db.insert(clientsTable).values({
    name, email1, email2, email3, phone1, phone2, phone3,
    address1, address2, address3, country, city, pincode,
    clientType, preferredContactType, allowControlPanel,
    userId: req.user!.id,
  });
  res.json({ status: 200, message: "Client added" });
});

router.put("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const { name, email1, email2, email3, phone1, phone2, phone3, address1, address2, address3, country, city, pincode, clientType, preferredContactType, allowControlPanel } = req.body;
  if (!name) {
    res.status(400).json({ status: 400, message: "Name is required" });
    return;
  }
  const where = isAdmin ? eq(clientsTable.id, id) : sql`id = ${id} AND user_id = ${userId}`;
  const result = await db.update(clientsTable).set({
    name, email1, email2, email3, phone1, phone2, phone3,
    address1, address2, address3, country, city, pincode,
    clientType, preferredContactType, allowControlPanel,
  }).where(where);
  if ((result as any).rowCount === 0) {
    res.status(404).json({ status: 404, message: "Client not found" });
    return;
  }
  res.json({ status: 200, message: "Client updated" });
});

router.delete("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";

  if (isAdmin) {
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
  } else {
    await db.delete(clientsTable).where(sql`id = ${id} AND user_id = ${userId}`);
  }
  res.json({ status: 200, message: "Client deleted" });
});

export default router;
