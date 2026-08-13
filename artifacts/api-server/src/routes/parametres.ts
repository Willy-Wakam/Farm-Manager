import { Router } from "express";
import { db, parametresTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { invalidateCache } from "../lib/parametres";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db.select().from(parametresTable).orderBy(parametresTable.categorie, parametresTable.cle);
  res.json(rows);
});

router.put("/:cle", async (req, res) => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const currentUser = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!currentUser[0] || currentUser[0].role !== "admin") {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }

  const { valeur } = req.body;
  if (valeur === undefined || valeur === null || String(valeur).trim() === "") {
    res.status(400).json({ error: "La valeur est requise" });
    return;
  }

  const rows = await db.update(parametresTable)
    .set({ valeur: String(valeur), updatedAt: new Date() })
    .where(eq(parametresTable.cle, req.params.cle))
    .returning();

  if (rows.length === 0) {
    res.status(404).json({ error: "Paramètre introuvable" });
    return;
  }

  invalidateCache();
  res.json(rows[0]);
});

export default router;
