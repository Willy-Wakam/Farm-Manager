import { Router } from "express";
import { db, devisConstructionTable, puitsItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logFromRequest } from "./activity-log";
import { getParam } from "../lib/parametres";

const router = Router();

async function getDevisWithPuits() {
  let devisRows = await db.select().from(devisConstructionTable).limit(1);
  if (devisRows.length === 0) {
    const budgetBat = await getParam("budget_batiment_defaut", 3525000);
    const budgetCarb = await getParam("budget_carburant_defaut", 150000);
    const inserted = await db.insert(devisConstructionTable).values({
      batimentEstime: String(budgetBat),
      batimentNotes: null,
      carburantEstime: String(budgetCarb),
    }).returning();
    devisRows = inserted;
  }
  const devis = devisRows[0];
  const puitsItems = await db.select().from(puitsItemsTable);
  const totalPuits = puitsItems.reduce((sum, item) => {
    return sum + parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
  }, 0);
  const totalGeneral = parseFloat(devis.batimentEstime) + parseFloat(devis.carburantEstime) + totalPuits;

  return {
    id: devis.id,
    batimentEstime: parseFloat(devis.batimentEstime),
    batimentNotes: devis.batimentNotes,
    carburantEstime: parseFloat(devis.carburantEstime),
    puitsItems: puitsItems.map(item => ({
      id: item.id,
      designation: item.designation,
      quantite: parseFloat(item.quantite),
      prixUnitaire: parseFloat(item.prixUnitaire),
      prixTotal: parseFloat(item.quantite) * parseFloat(item.prixUnitaire),
    })),
    totalPuits,
    totalGeneral,
    updatedAt: devis.updatedAt,
  };
}

router.get("/", async (req, res) => {
  res.json(await getDevisWithPuits());
});

router.put("/", async (req, res) => {
  const { batimentEstime, batimentNotes, carburantEstime } = req.body;
  const existing = await db.select().from(devisConstructionTable).limit(1);
  if (existing.length === 0) {
    const defBat = await getParam("budget_batiment_defaut", 3525000);
    const defCarb = await getParam("budget_carburant_defaut", 150000);
    await db.insert(devisConstructionTable).values({
      batimentEstime: String(batimentEstime ?? defBat),
      batimentNotes: batimentNotes ?? null,
      carburantEstime: String(carburantEstime ?? defCarb),
    });
  } else {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (batimentEstime !== undefined) updates.batimentEstime = String(batimentEstime);
    if (batimentNotes !== undefined) updates.batimentNotes = batimentNotes;
    if (carburantEstime !== undefined) updates.carburantEstime = String(carburantEstime);
    await db.update(devisConstructionTable).set(updates).where(eq(devisConstructionTable.id, existing[0].id));
  }
  await logFromRequest(req, "Modification devis construction");
  res.json(await getDevisWithPuits());
});

router.get("/puits-items", async (req, res) => {
  const items = await db.select().from(puitsItemsTable);
  res.json(items.map(item => ({
    id: item.id,
    designation: item.designation,
    quantite: parseFloat(item.quantite),
    prixUnitaire: parseFloat(item.prixUnitaire),
    prixTotal: parseFloat(item.quantite) * parseFloat(item.prixUnitaire),
  })));
});

router.post("/puits-items", async (req, res) => {
  const { designation, quantite, prixUnitaire } = req.body;
  const rows = await db.insert(puitsItemsTable).values({
    designation,
    quantite: String(quantite),
    prixUnitaire: String(prixUnitaire),
  }).returning();
  const item = rows[0];
  await logFromRequest(req, "Ajout item devis puits", `${designation}`);
  res.status(201).json({
    id: item.id,
    designation: item.designation,
    quantite: parseFloat(item.quantite),
    prixUnitaire: parseFloat(item.prixUnitaire),
    prixTotal: parseFloat(item.quantite) * parseFloat(item.prixUnitaire),
  });
});

router.put("/puits-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { designation, quantite, prixUnitaire } = req.body;
  const rows = await db.update(puitsItemsTable).set({
    designation,
    quantite: String(quantite),
    prixUnitaire: String(prixUnitaire),
  }).where(eq(puitsItemsTable.id, id)).returning();
  const item = rows[0];
  await logFromRequest(req, "Modification item devis puits", `${designation}`);
  res.json({
    id: item.id,
    designation: item.designation,
    quantite: parseFloat(item.quantite),
    prixUnitaire: parseFloat(item.prixUnitaire),
    prixTotal: parseFloat(item.quantite) * parseFloat(item.prixUnitaire),
  });
});

router.delete("/puits-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(puitsItemsTable).where(eq(puitsItemsTable.id, id));
  await logFromRequest(req, "Suppression item devis puits", `ID: ${id}`);
  res.json({ success: true });
});

export default router;
