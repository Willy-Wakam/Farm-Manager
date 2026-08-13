import { Router } from "express";
import { db, stockAlimentsTable, stockMedicamentsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { logFromRequest } from "./activity-log";

const router = Router();

router.get("/aliments", async (req, res) => {
  const rows = await db.select().from(stockAlimentsTable).orderBy(desc(stockAlimentsTable.date));
  const items = rows.map(r => ({
    ...r,
    quantiteKg: parseFloat(r.quantiteKg),
    prixUnitaire: r.prixUnitaire ? parseFloat(r.prixUnitaire) : null,
  }));

  const entrees = items.filter(i => i.type === "entree").reduce((s, i) => s + i.quantiteKg, 0);
  const sorties = items.filter(i => i.type === "sortie").reduce((s, i) => s + i.quantiteKg, 0);
  const stockActuel = entrees - sorties;

  res.json({ items, stockActuel, totalEntrees: entrees, totalSorties: sorties });
});

router.post("/aliments", async (req, res) => {
  const { designation, type, quantiteKg, prixUnitaire, fournisseur, date, commentaire } = req.body;
  const [row] = await db.insert(stockAlimentsTable).values({
    designation, type: type || "entree",
    quantiteKg: String(quantiteKg), prixUnitaire: prixUnitaire ? String(prixUnitaire) : null,
    fournisseur, date, commentaire,
  }).returning();
  await logFromRequest(req, "Stock aliment", `${type === "sortie" ? "Sortie" : "Entrée"} : ${designation} - ${quantiteKg} kg`);
  res.status(201).json({ ...row, quantiteKg: parseFloat(row.quantiteKg), prixUnitaire: row.prixUnitaire ? parseFloat(row.prixUnitaire) : null });
});

router.delete("/aliments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(stockAlimentsTable).where(eq(stockAlimentsTable.id, id));
  res.json({ success: true });
});

router.get("/medicaments", async (req, res) => {
  const rows = await db.select().from(stockMedicamentsTable).orderBy(desc(stockMedicamentsTable.date));
  const items = rows.map(r => ({
    ...r,
    quantite: parseFloat(r.quantite),
  }));

  const grouped: Record<string, { nom: string; stockActuel: number; unite: string; datePeremption: string | null }> = {};
  for (const item of items) {
    if (!grouped[item.nom]) grouped[item.nom] = { nom: item.nom, stockActuel: 0, unite: item.unite, datePeremption: item.datePeremption };
    if (item.type === "entree") grouped[item.nom].stockActuel += item.quantite;
    else grouped[item.nom].stockActuel -= item.quantite;
    if (item.datePeremption) grouped[item.nom].datePeremption = item.datePeremption;
  }

  const peremptionProche = Object.values(grouped).filter(g => {
    if (!g.datePeremption) return false;
    const diff = new Date(g.datePeremption).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  });

  res.json({ items, resume: Object.values(grouped), peremptionProche });
});

router.post("/medicaments", async (req, res) => {
  const { nom, type, quantite, unite, datePeremption, fournisseur, date, commentaire } = req.body;
  const [row] = await db.insert(stockMedicamentsTable).values({
    nom, type: type || "entree",
    quantite: String(quantite), unite: unite || "unité",
    datePeremption, fournisseur, date, commentaire,
  }).returning();
  await logFromRequest(req, "Stock médicament", `${type === "sortie" ? "Sortie" : "Entrée"} : ${nom} - ${quantite} ${unite || "unité"}`);
  res.status(201).json({ ...row, quantite: parseFloat(row.quantite) });
});

router.delete("/medicaments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(stockMedicamentsTable).where(eq(stockMedicamentsTable.id, id));
  res.json({ success: true });
});

export default router;
