import { Router } from "express";
import { db, chantiersTable, chantierDevisLignesTable, chantierDepensesTable, chantierLotsTable, actifsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── Désignations distinctes (autocomplétion) ────────────────────────────────
router.get("/designations", async (req, res) => {
  const categorie = (req.query.categorie as string) || "materiaux";
  const rows = await db
    .selectDistinct({ designation: chantierDepensesTable.designation })
    .from(chantierDepensesTable)
    .where(eq(chantierDepensesTable.categorie, categorie))
    .orderBy(chantierDepensesTable.designation);
  const list = rows
    .map((r) => r.designation?.trim())
    .filter((d): d is string => !!d);
  // Dédoublonnage insensible à la casse (garde la première occurrence)
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const d of list) {
    const k = d.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(d);
    }
  }
  res.json(unique);
});

// ── Liste des chantiers ──────────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  const chantiers = await db.select().from(chantiersTable).orderBy(chantiersTable.createdAt);
  const result = await Promise.all(chantiers.map(async (c) => {
    const depenses = await db.select().from(chantierDepensesTable).where(eq(chantierDepensesTable.chantierId, c.id));
    const devisLignes = await db.select().from(chantierDevisLignesTable).where(eq(chantierDevisLignesTable.chantierId, c.id));
    const totalReel = depenses.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
    const totalPrevu = devisLignes.reduce((s, l) => s + parseFloat(l.montantPrevu), 0);
    return { ...c, totalReel, totalPrevu, nbDepenses: depenses.length };
  }));
  res.json(result);
});

router.post("/", async (req, res) => {
  const { nom, description, dateDebut } = req.body;
  if (!nom) { res.status(400).json({ message: "Le nom est requis" }); return; }
  const rows = await db.insert(chantiersTable).values({ nom, description, dateDebut, statut: "en_cours" }).returning();
  res.status(201).json(rows[0]);
});

// ── Détail d'un chantier (avec lots) ────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(chantiersTable).where(eq(chantiersTable.id, id));
  if (rows.length === 0) { res.status(404).json({ message: "Chantier introuvable" }); return; }
  const chantier = rows[0];

  const [allDepenses, allDevis, lots] = await Promise.all([
    db.select().from(chantierDepensesTable).where(eq(chantierDepensesTable.chantierId, id)).orderBy(chantierDepensesTable.createdAt),
    db.select().from(chantierDevisLignesTable).where(eq(chantierDevisLignesTable.chantierId, id)).orderBy(chantierDevisLignesTable.ordre),
    db.select().from(chantierLotsTable).where(eq(chantierLotsTable.chantierId, id)).orderBy(chantierLotsTable.ordre),
  ]);

  const depensesWithTotal = allDepenses.map(d => ({ ...d, prixTotal: parseFloat(d.quantite) * parseFloat(d.prixUnitaire) }));
  const totalReel = depensesWithTotal.reduce((s, d) => s + d.prixTotal, 0);
  const totalPrevu = allDevis.reduce((s, l) => s + parseFloat(l.montantPrevu), 0);

  const lotsWithData = lots.map(lot => {
    const lotDepenses = depensesWithTotal.filter(d => d.lotId === lot.id);
    const lotDevis = allDevis.filter(l => l.lotId === lot.id);
    return {
      ...lot,
      depenses: lotDepenses,
      devisLignes: lotDevis,
      totalReel: lotDepenses.reduce((s, d) => s + d.prixTotal, 0),
      totalPrevu: lotDevis.reduce((s, l) => s + parseFloat(l.montantPrevu), 0),
    };
  });

  res.json({ ...chantier, depenses: depensesWithTotal, devisLignes: allDevis, lots: lotsWithData, totalReel, totalPrevu });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, description, dateDebut, statut } = req.body;
  const rows = await db.update(chantiersTable).set({ nom, description, dateDebut, statut }).where(eq(chantiersTable.id, id)).returning();
  if (rows.length === 0) { res.status(404).json({ message: "Chantier introuvable" }); return; }
  res.json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(chantiersTable).where(eq(chantiersTable.id, id));
  res.json({ success: true });
});

// ── Clôture ──────────────────────────────────────────────────────────────────
router.post("/:id/cloture", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(chantiersTable).where(eq(chantiersTable.id, id));
  if (rows.length === 0) { res.status(404).json({ message: "Chantier introuvable" }); return; }
  const chantier = rows[0];
  const depenses = await db.select().from(chantierDepensesTable).where(eq(chantierDepensesTable.chantierId, id));
  const totalReel = depenses.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
  const { tauxAmortissement, dateAcquisition } = req.body;
  const taux = tauxAmortissement ?? 5;
  const dateAcq = dateAcquisition ?? new Date().toISOString().split("T")[0];
  const actifRows = await db.insert(actifsTable).values({
    nom: chantier.nom, type: "batiment", valeur: String(totalReel),
    tauxAmortissementAnnuel: String(taux), dateAcquisition: dateAcq,
    description: chantier.description, chantierId: id,
  }).returning();
  await db.update(chantiersTable).set({ statut: "cloture", dateCloture: dateAcq }).where(eq(chantiersTable.id, id));
  res.json({ chantier: { ...chantier, statut: "cloture" }, actif: actifRows[0] });
});

// ── Lots ─────────────────────────────────────────────────────────────────────
router.post("/:id/lots", async (req, res) => {
  const chantierId = parseInt(req.params.id);
  const { nom, description } = req.body;
  if (!nom) { res.status(400).json({ message: "Le nom est requis" }); return; }
  const existing = await db.select().from(chantierLotsTable).where(eq(chantierLotsTable.chantierId, chantierId));
  const rows = await db.insert(chantierLotsTable).values({ chantierId, nom, description, ordre: existing.length }).returning();
  res.status(201).json(rows[0]);
});

router.put("/:id/lots/:lotId", async (req, res) => {
  const lotId = parseInt(req.params.lotId);
  const { nom, description } = req.body;
  const rows = await db.update(chantierLotsTable).set({ nom, description }).where(eq(chantierLotsTable.id, lotId)).returning();
  if (rows.length === 0) { res.status(404).json({ message: "Lot introuvable" }); return; }
  res.json(rows[0]);
});

router.delete("/:id/lots/:lotId", async (req, res) => {
  const lotId = parseInt(req.params.lotId);
  await db.delete(chantierLotsTable).where(eq(chantierLotsTable.id, lotId));
  res.json({ success: true });
});

// ── Dépenses ─────────────────────────────────────────────────────────────────
router.get("/:id/depenses", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(chantierDepensesTable).where(eq(chantierDepensesTable.chantierId, id)).orderBy(chantierDepensesTable.createdAt);
  res.json(rows.map(d => ({ ...d, prixTotal: parseFloat(d.quantite) * parseFloat(d.prixUnitaire) })));
});

router.post("/:id/depenses", async (req, res) => {
  const chantierId = parseInt(req.params.id);
  const { designation, quantite, prixUnitaire, categorie, date, commentaire, lotId } = req.body;
  if (!designation) { res.status(400).json({ message: "La désignation est requise" }); return; }
  const rows = await db.insert(chantierDepensesTable).values({
    chantierId, designation, quantite: String(quantite ?? 1),
    prixUnitaire: String(prixUnitaire ?? 0), categorie: categorie || "materiaux",
    date, commentaire, lotId: lotId || null,
  }).returning();
  const d = rows[0];
  res.status(201).json({ ...d, prixTotal: parseFloat(d.quantite) * parseFloat(d.prixUnitaire) });
});

router.put("/:id/depenses/:depId", async (req, res) => {
  const depId = parseInt(req.params.depId);
  const { designation, quantite, prixUnitaire, categorie, date, commentaire, lotId } = req.body;
  const rows = await db.update(chantierDepensesTable).set({
    designation, quantite: String(quantite), prixUnitaire: String(prixUnitaire),
    categorie, date, commentaire, lotId: lotId || null,
  }).where(eq(chantierDepensesTable.id, depId)).returning();
  if (rows.length === 0) { res.status(404).json({ message: "Dépense introuvable" }); return; }
  const d = rows[0];
  res.json({ ...d, prixTotal: parseFloat(d.quantite) * parseFloat(d.prixUnitaire) });
});

router.delete("/:id/depenses/:depId", async (req, res) => {
  const depId = parseInt(req.params.depId);
  await db.delete(chantierDepensesTable).where(eq(chantierDepensesTable.id, depId));
  res.json({ success: true });
});

// ── Devis / Lignes budgétaires ────────────────────────────────────────────────
router.get("/:id/devis", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(chantierDevisLignesTable).where(eq(chantierDevisLignesTable.chantierId, id)).orderBy(chantierDevisLignesTable.ordre);
  res.json(rows);
});

router.post("/:id/devis", async (req, res) => {
  const chantierId = parseInt(req.params.id);
  const { poste, montantPrevu, ordre, lotId } = req.body;
  if (!poste) { res.status(400).json({ message: "Le poste est requis" }); return; }
  const existing = await db.select().from(chantierDevisLignesTable).where(eq(chantierDevisLignesTable.chantierId, chantierId));
  const nextOrdre = ordre ?? existing.length;
  const rows = await db.insert(chantierDevisLignesTable).values({
    chantierId, poste, montantPrevu: String(montantPrevu ?? 0), ordre: nextOrdre, lotId: lotId || null,
  }).returning();
  res.status(201).json(rows[0]);
});

router.put("/:id/devis/:ligneId", async (req, res) => {
  const ligneId = parseInt(req.params.ligneId);
  const { poste, montantPrevu } = req.body;
  const rows = await db.update(chantierDevisLignesTable).set({ poste, montantPrevu: String(montantPrevu) }).where(eq(chantierDevisLignesTable.id, ligneId)).returning();
  if (rows.length === 0) { res.status(404).json({ message: "Ligne introuvable" }); return; }
  res.json(rows[0]);
});

router.delete("/:id/devis/:ligneId", async (req, res) => {
  const ligneId = parseInt(req.params.ligneId);
  await db.delete(chantierDevisLignesTable).where(eq(chantierDevisLignesTable.id, ligneId));
  res.json({ success: true });
});

export default router;
