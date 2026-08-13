import { Router } from "express";
import type { Request } from "express";
import { db, activityLogTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const rows = await db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt)).limit(limit);
  res.json(rows);
});

export default router;

export async function logActivity(userId: number | null, userNom: string, action: string, details?: string) {
  await db.insert(activityLogTable).values({
    userId,
    userNom,
    action,
    details: details || null,
  });
}

export async function logFromRequest(req: Request, action: string, details?: string) {
  const userId = (req.session as any).userId as number | undefined;
  let userNom = "Système";
  if (userId) {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (users.length > 0) userNom = users[0].nom;
  }
  await logActivity(userId ?? null, userNom, action, details);
}
