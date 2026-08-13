import { Router } from "express";
import { db, actifsTable, bandeActifsTable, bandesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const actifs = await db.select().from(actifsTable).orderBy(actifsTable.dateAcquisition);
  const result = actifs.map(a => {
    const valeur = parseFloat(a.valeur);
    const taux = parseFloat(a.tauxAmortissementAnnuel);
    return { ...a, valeur, tauxAmortissementAnnuel: taux };
  });
  res.json(result);
});

router.post("/", async (req, res) => {
  const { nom, type, valeur, tauxAmortissementAnnuel, dateAcquisition, description } = req.body;
  if (!nom || !type || !valeur || !dateAcquisition) { res.status(400).json({ message: "Champs requis manquants" }); return; }
  const rows = await db.insert(actifsTable).values({
    nom, type, valeur: String(valeur), tauxAmortissementAnnuel: String(tauxAmortissementAnnuel ?? 0), dateAcquisition, description
  }).returning();
  res.status(201).json({ ...rows[0], valeur: parseFloat(rows[0].valeur), tauxAmortissementAnnuel: parseFloat(rows[0].tauxAmortissementAnnuel) });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, type, valeur, tauxAmortissementAnnuel, dateAcquisition, description } = req.body;
  const rows = await db.update(actifsTable).set({ nom, type, valeur: String(valeur), tauxAmortissementAnnuel: String(tauxAmortissementAnnuel), dateAcquisition, description }).where(eq(actifsTable.id, id)).returning();
  if (rows.length === 0) { res.status(404).json({ message: "Actif introuvable" }); return; }
  res.json({ ...rows[0], valeur: parseFloat(rows[0].valeur), tauxAmortissementAnnuel: parseFloat(rows[0].tauxAmortissementAnnuel) });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(bandeActifsTable).where(eq(bandeActifsTable.actifId, id));
  await db.delete(actifsTable).where(eq(actifsTable.id, id));
  res.json({ success: true });
});

router.get("/:id/bande-allocations", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(bandeActifsTable).where(eq(bandeActifsTable.actifId, id));
  res.json(rows);
});

export default router;
