import { Router } from "express";
import { db, financementTable, remboursementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logFromRequest } from "./activity-log";

const router = Router();

router.get("/", async (req, res) => {
  const rows = await db.select().from(financementTable).orderBy(financementTable.createdAt);
  res.json(rows.map(r => ({
    id: r.id,
    nom: r.nom,
    montant: parseFloat(r.montant),
    date: r.date,
    createdAt: r.createdAt,
  })));
});

router.post("/", async (req, res) => {
  const { nom, montant, date } = req.body;
  const rows = await db.insert(financementTable).values({ nom, montant: String(montant), date }).returning();
  const r = rows[0];
  await logFromRequest(req, "Ajout financement", `${nom} - ${montant} FCFA`);
  res.status(201).json({
    id: r.id,
    nom: r.nom,
    montant: parseFloat(r.montant),
    date: r.date,
    createdAt: r.createdAt,
  });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, montant, date } = req.body;
  const rows = await db.update(financementTable).set({ nom, montant: String(montant), date }).where(eq(financementTable.id, id)).returning();
  const r = rows[0];
  await logFromRequest(req, "Modification financement", `${nom} - ${montant} FCFA`);
  res.json({
    id: r.id,
    nom: r.nom,
    montant: parseFloat(r.montant),
    date: r.date,
    createdAt: r.createdAt,
  });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(financementTable).where(eq(financementTable.id, id));
  await logFromRequest(req, "Suppression financement", `ID: ${id}`);
  res.json({ success: true });
});

router.get("/remboursements", async (req, res) => {
  const rows = await db.select().from(remboursementsTable).orderBy(remboursementsTable.createdAt);
  const financements = await db.select().from(financementTable);

  const investisseurMap: Record<string, { totalInvesti: number; totalRembourse: number }> = {};
  for (const f of financements) {
    const key = f.nom;
    if (!investisseurMap[key]) investisseurMap[key] = { totalInvesti: 0, totalRembourse: 0 };
    investisseurMap[key].totalInvesti += parseFloat(f.montant);
  }
  for (const r of rows) {
    const key = r.investisseurNom;
    if (!investisseurMap[key]) investisseurMap[key] = { totalInvesti: 0, totalRembourse: 0 };
    investisseurMap[key].totalRembourse += parseFloat(r.montant);
  }

  const remboursements = rows.map(r => ({
    id: r.id,
    investisseurNom: r.investisseurNom,
    montant: parseFloat(r.montant),
    date: r.date,
    commentaire: r.commentaire,
    createdAt: r.createdAt,
  }));

  const soldesInvestisseurs = Object.entries(investisseurMap).map(([nom, data]) => ({
    nom,
    totalInvesti: data.totalInvesti,
    totalRembourse: data.totalRembourse,
    soldeRestant: data.totalInvesti - data.totalRembourse,
  }));

  res.json({ remboursements, soldesInvestisseurs });
});

router.post("/remboursements", async (req, res) => {
  const { investisseurNom, montant, date, commentaire } = req.body;
  const rows = await db.insert(remboursementsTable).values({
    investisseurNom,
    montant: String(montant),
    date,
    commentaire: commentaire || null,
  }).returning();
  const r = rows[0];
  await logFromRequest(req, "Ajout remboursement", `${investisseurNom} - ${montant} FCFA`);
  res.status(201).json({
    id: r.id,
    investisseurNom: r.investisseurNom,
    montant: parseFloat(r.montant),
    date: r.date,
    commentaire: r.commentaire,
    createdAt: r.createdAt,
  });
});

router.delete("/remboursements/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(remboursementsTable).where(eq(remboursementsTable.id, id));
  await logFromRequest(req, "Suppression remboursement", `ID: ${id}`);
  res.json({ success: true });
});

export default router;
