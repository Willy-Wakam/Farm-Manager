import { Router } from "express";
import { db, sortiesArgentTable, sortiesCarburantTable, depensesBatimentTable, depensesPuitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logFromRequest } from "./activity-log";

const router = Router();

router.get("/sorties", async (req, res) => {
  const rows = await db.select().from(sortiesArgentTable).orderBy(sortiesArgentTable.date);
  res.json(rows.map(r => ({
    id: r.id,
    date: r.date,
    decaisse: parseFloat(r.decaisse),
    depense: parseFloat(r.depense),
    reste: parseFloat(r.decaisse) - parseFloat(r.depense),
  })));
});

router.post("/sorties", async (req, res) => {
  const { date, decaisse, depense } = req.body;
  const rows = await db.insert(sortiesArgentTable).values({ date, decaisse: String(decaisse), depense: String(depense) }).returning();
  const r = rows[0];
  await logFromRequest(req, "Ajout sortie d'argent", `Dépensé: ${depense} FCFA`);
  res.status(201).json({ id: r.id, date: r.date, decaisse: parseFloat(r.decaisse), depense: parseFloat(r.depense), reste: parseFloat(r.decaisse) - parseFloat(r.depense) });
});

router.put("/sorties/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { date, decaisse, depense } = req.body;
  const rows = await db.update(sortiesArgentTable).set({ date, decaisse: String(decaisse), depense: String(depense) }).where(eq(sortiesArgentTable.id, id)).returning();
  const r = rows[0];
  await logFromRequest(req, "Modification sortie d'argent", `ID: ${id}`);
  res.json({ id: r.id, date: r.date, decaisse: parseFloat(r.decaisse), depense: parseFloat(r.depense), reste: parseFloat(r.decaisse) - parseFloat(r.depense) });
});

router.delete("/sorties/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(sortiesArgentTable).where(eq(sortiesArgentTable.id, id));
  await logFromRequest(req, "Suppression sortie d'argent", `ID: ${id}`);
  res.json({ success: true });
});

router.get("/carburant", async (req, res) => {
  const rows = await db.select().from(sortiesCarburantTable).orderBy(sortiesCarburantTable.date);
  res.json(rows.map(r => ({ id: r.id, date: r.date, montant: parseFloat(r.montant) })));
});

router.post("/carburant", async (req, res) => {
  const { date, montant } = req.body;
  const rows = await db.insert(sortiesCarburantTable).values({ date, montant: String(montant) }).returning();
  const r = rows[0];
  await logFromRequest(req, "Ajout carburant", `${montant} FCFA`);
  res.status(201).json({ id: r.id, date: r.date, montant: parseFloat(r.montant) });
});

router.put("/carburant/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { date, montant } = req.body;
  const rows = await db.update(sortiesCarburantTable).set({ date, montant: String(montant) }).where(eq(sortiesCarburantTable.id, id)).returning();
  const r = rows[0];
  await logFromRequest(req, "Modification carburant", `ID: ${id}`);
  res.json({ id: r.id, date: r.date, montant: parseFloat(r.montant) });
});

router.delete("/carburant/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(sortiesCarburantTable).where(eq(sortiesCarburantTable.id, id));
  await logFromRequest(req, "Suppression carburant", `ID: ${id}`);
  res.json({ success: true });
});

function formatBatItem(r: any) {
  return { id: r.id, designation: r.designation, quantite: parseFloat(r.quantite), prixUnitaire: parseFloat(r.prixUnitaire), prixTotal: parseFloat(r.quantite) * parseFloat(r.prixUnitaire), categorie: r.categorie || "materiaux", date: r.date || null, commentaire: r.commentaire || null };
}

router.get("/designations-suggestions", async (_req, res) => {
  const batRows = await db.selectDistinct({ designation: depensesBatimentTable.designation }).from(depensesBatimentTable);
  const puitsRows = await db.selectDistinct({ designation: depensesPuitsTable.designation }).from(depensesPuitsTable);
  const all = new Set<string>();
  for (const r of batRows) { if (r.designation) all.add(r.designation); }
  for (const r of puitsRows) { if (r.designation) all.add(r.designation); }
  res.json([...all].sort());
});

router.get("/batiment-items", async (req, res) => {
  const rows = await db.select().from(depensesBatimentTable);
  res.json(rows.map(formatBatItem));
});

router.post("/batiment-items", async (req, res) => {
  const {
    designation,
    quantite,
    prixUnitaire,
    categorie,
    date,
    commentaire,
    clientMutationId,
  } = req.body;

  const rows = await db
    .insert(depensesBatimentTable)
    .values({
      designation,
      quantite: String(quantite),
      prixUnitaire: String(prixUnitaire),
      categorie: categorie || "materiaux",
      date: date || null,
      commentaire: commentaire || null,
      clientMutationId: clientMutationId || null,
    })
    .onConflictDoNothing({
      target: depensesBatimentTable.clientMutationId,
    })
    .returning();

  // Cas 1 : nouvelle dépense créée
  if (rows.length > 0) {
    const r = rows[0];

    await logFromRequest(
      req,
      "Ajout dépense bâtiment",
      `${designation} - ${
        parseFloat(r.quantite) * parseFloat(r.prixUnitaire)
      } FCFA`,
    );

    res.status(201).json(formatBatItem(r));
    return;
  }

  // Cas 2 : cette mutation a déjà été traitée
  if (clientMutationId) {
    const existingRows = await db
      .select()
      .from(depensesBatimentTable)
      .where(
        eq(
          depensesBatimentTable.clientMutationId,
          clientMutationId,
        ),
      )
      .limit(1);

    if (existingRows.length > 0) {
      console.log(
        `[idempotency] Opération ${clientMutationId} déjà traitée.`,
      );

      res.status(200).json(
        formatBatItem(existingRows[0]),
      );

      return;
    }
  }

  res.status(409).json({
    error: "Impossible de créer la dépense",
  });
});

router.put("/batiment-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { designation, quantite, prixUnitaire, categorie, date, commentaire } = req.body;
  const updates: any = { designation, quantite: String(quantite), prixUnitaire: String(prixUnitaire) };
  if (categorie !== undefined) updates.categorie = categorie;
  if (date !== undefined) updates.date = date || null;
  if (commentaire !== undefined) updates.commentaire = commentaire || null;
  const rows = await db.update(depensesBatimentTable).set(updates).where(eq(depensesBatimentTable.id, id)).returning();
  if (!rows.length) { res.status(404).json({ error: "Item non trouvé" }); return; }
  const r = rows[0];
  await logFromRequest(req, "Modification dépense bâtiment", `${designation}`);
  res.json(formatBatItem(r));
});

router.delete("/batiment-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(depensesBatimentTable).where(eq(depensesBatimentTable.id, id));
  await logFromRequest(req, "Suppression dépense bâtiment", `ID: ${id}`);
  res.json({ success: true });
});

function formatPuitsItem(r: any) {
  return { id: r.id, designation: r.designation, quantite: parseFloat(r.quantite), prixUnitaire: parseFloat(r.prixUnitaire), prixTotal: parseFloat(r.quantite) * parseFloat(r.prixUnitaire), categorie: r.categorie || "materiaux", date: r.date || null, commentaire: r.commentaire || null };
}

router.get("/puits-items", async (req, res) => {
  const rows = await db.select().from(depensesPuitsTable);
  res.json(rows.map(formatPuitsItem));
});

router.post("/puits-items", async (req, res) => {
  const { designation, quantite, prixUnitaire, categorie, date, commentaire } = req.body;
  const rows = await db.insert(depensesPuitsTable).values({ designation, quantite: String(quantite), prixUnitaire: String(prixUnitaire), categorie: categorie || "materiaux", date: date || null, commentaire: commentaire || null }).returning();
  const r = rows[0];
  await logFromRequest(req, "Ajout dépense forage", `${designation} - ${parseFloat(r.quantite) * parseFloat(r.prixUnitaire)} FCFA`);
  res.status(201).json(formatPuitsItem(r));
});

router.put("/puits-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { designation, quantite, prixUnitaire, categorie, date, commentaire } = req.body;
  const updates: any = { designation, quantite: String(quantite), prixUnitaire: String(prixUnitaire) };
  if (categorie !== undefined) updates.categorie = categorie;
  if (date !== undefined) updates.date = date || null;
  if (commentaire !== undefined) updates.commentaire = commentaire || null;
  const rows = await db.update(depensesPuitsTable).set(updates).where(eq(depensesPuitsTable.id, id)).returning();
  if (!rows.length) { res.status(404).json({ error: "Item non trouvé" }); return; }
  const r = rows[0];
  await logFromRequest(req, "Modification dépense forage", `${designation}`);
  res.json(formatPuitsItem(r));
});

router.delete("/puits-items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(depensesPuitsTable).where(eq(depensesPuitsTable.id, id));
  await logFromRequest(req, "Suppression dépense puits", `ID: ${id}`);
  res.json({ success: true });
});

export default router;
