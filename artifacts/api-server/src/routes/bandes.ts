import { Router } from "express";
import { db, bandesTable, bandeDepensesTable, bandeVentesTable, chargesFixesTable, depensesVenteTable, mortaliteJournaliereTable, peseesTable, consommationAlimentTable, vaccinationsTable, consommationEauTable, traitementsTable, observationsJournalTable, bandeActifsTable, actifsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logFromRequest } from "./activity-log";
import { getParam, getVaccinationSchedule, REFERENCE_WEIGHT_CURVE } from "../lib/parametres";

const router = Router();

/**
 * Client Gemini chargé à la demande : les fonctionnalités IA sont optionnelles,
 * le serveur doit démarrer normalement sans GEMINI_API_KEY.
 */
async function getAI() {
  const mod = await import("@workspace/integrations-gemini-ai");
  return mod.ai;
}

async function getBandeDetail(id: number) {
  const bandeRows = await db.select().from(bandesTable).where(eq(bandesTable.id, id));
  if (bandeRows.length === 0) return null;
  const bande = bandeRows[0];

  const depenses = await db.select().from(bandeDepensesTable).where(eq(bandeDepensesTable.bandeId, id));
  const ventes = await db.select().from(bandeVentesTable).where(eq(bandeVentesTable.bandeId, id));
  const chargesRows = await db.select().from(chargesFixesTable).where(eq(chargesFixesTable.bandeId, id));
  const depensesVente = await db.select().from(depensesVenteTable).where(eq(depensesVenteTable.bandeId, id));

  // Compute nombreDeces from the actual mortalite table (avoids drift from denormalized column)
  const mortaliteSumRows = await db
    .select({ total: sql<number>`COALESCE(SUM(${mortaliteJournaliereTable.decesJour}), 0)` })
    .from(mortaliteJournaliereTable)
    .where(eq(mortaliteJournaliereTable.bandeId, id));
  const nombreDeces = Number(mortaliteSumRows[0]?.total ?? 0);

  // Keep the denormalized column in sync silently
  if (nombreDeces !== bande.nombreDeces) {
    await db.update(bandesTable).set({ nombreDeces }).where(eq(bandesTable.id, id));
  }

  const totalDepenses = depenses.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
  const totalRecettes = ventes.reduce((s, v) => s + v.quantiteVendue * parseFloat(v.prixUnitaire), 0);
  const totalVendus = ventes.reduce((s, v) => s + v.quantiteVendue, 0);

  const tauxDepreciation = await getParam("taux_depreciation_materiel", 10);
  const tauxImprevus = await getParam("taux_imprevus", 5);
  const valeurMateriel = parseFloat(bande.valeurMaterielFixe);
  const valeurPerdueMateriel = valeurMateriel * (tauxDepreciation / 100);
  const imprevus = totalDepenses * (tauxImprevus / 100);
  const loyer = chargesRows.length > 0 ? parseFloat(chargesRows[0].loyer) : 0;
  const chargesFixesTotal = valeurPerdueMateriel + imprevus + loyer;

  const sujetsRestants = bande.sujetsDepart - nombreDeces - totalVendus;
  const totalDepensesVente = depensesVente.reduce((s, d) => s + parseFloat(d.montant), 0);
  const beneficeNetSansCharges = totalRecettes - totalDepenses - totalDepensesVente;
  const beneficeNet = totalRecettes - totalDepenses - chargesFixesTotal - totalDepensesVente;
  const sujetsVivants = bande.sujetsDepart - nombreDeces;
  const coutParSujet = sujetsVivants > 0 ? (totalDepenses + chargesFixesTotal) / sujetsVivants : 0;

  return {
    id: bande.id,
    numero: bande.numero,
    nom: bande.nom,
    sujetsDepart: bande.sujetsDepart,
    nombreDeces,
    totalVendus,
    sujetsRestants,
    valeurMaterielFixe: valeurMateriel,
    statut: bande.statut,
    totalDepenses,
    totalRecettes,
    chargesFixesTotal,
    beneficeNet,
    beneficeNetSansCharges,
    coutParSujet,
    dateDeDepart: bande.dateDeDepart,
    createdAt: bande.createdAt,
  };
}

router.get("/designations-suggestions", async (_req, res) => {
  const rows = await db.selectDistinct({ designation: bandeDepensesTable.designation }).from(bandeDepensesTable);
  const designations = rows.map(r => r.designation).filter(Boolean).sort();
  res.json(designations);
});

router.get("/", async (req, res) => {
  const rows = await db.select().from(bandesTable).orderBy(bandesTable.numero);
  res.json(rows.map(r => ({
    id: r.id,
    numero: r.numero,
    nom: r.nom,
    dateDeDepart: r.dateDeDepart,
    sujetsDepart: r.sujetsDepart,
    nombreDeces: r.nombreDeces,
    valeurMaterielFixe: parseFloat(r.valeurMaterielFixe),
    statut: r.statut,
    createdAt: r.createdAt,
  })));
});

router.post("/", async (req, res) => {
  const { nom, dateDeDepart, sujetsDepart, nombreDeces, valeurMaterielFixe, statut } = req.body;
  const count = await db.select().from(bandesTable);
  const numero = count.length + 1;
  const rows = await db.insert(bandesTable).values({
    numero,
    nom,
    dateDeDepart: dateDeDepart ?? new Date().toISOString().split("T")[0],
    sujetsDepart,
    nombreDeces: nombreDeces ?? 0,
    valeurMaterielFixe: String(valeurMaterielFixe ?? 0),
    statut: statut ?? "active",
  }).returning();
  const r = rows[0];
  await logFromRequest(req, "Création bande", `${nom} - ${sujetsDepart} sujets`);
  res.status(201).json({
    id: r.id,
    numero: r.numero,
    nom: r.nom,
    dateDeDepart: r.dateDeDepart,
    sujetsDepart: r.sujetsDepart,
    nombreDeces: r.nombreDeces,
    valeurMaterielFixe: parseFloat(r.valeurMaterielFixe),
    statut: r.statut,
    createdAt: r.createdAt,
  });
});

router.get("/reference-poids", async (_req, res) => {
  res.json(REFERENCE_WEIGHT_CURVE);
});

router.get("/historique-moyennes", async (_req, res) => {
  const allBandes = await db.select().from(bandesTable).where(eq(bandesTable.statut, "terminee"));
  if (allBandes.length === 0) {
    res.json({ nbBandes: 0 });
    return;
  }

  let totalSujets = 0;
  let totalDeces = 0;
  let totalAlimentKg = 0;
  let totalEauL = 0;
  let alimentDemarrage = 0;
  let alimentCroissance = 0;
  let alimentFinition = 0;
  let eauDemarrage = 0;
  let eauCroissance = 0;
  let eauFinition = 0;
  let decesDemarrage = 0;
  let decesCroissance = 0;
  let decesFinition = 0;
  let totalDureeJours = 0;
  let bandesAvecAliment = 0;
  let bandesAvecEau = 0;
  let bandesAvecMort = 0;
  let poidsFinaux: number[] = [];

  for (const bande of allBandes) {
    totalSujets += bande.sujetsDepart;
    totalDeces += bande.nombreDeces;

    const aliment = await db.select().from(consommationAlimentTable).where(eq(consommationAlimentTable.bandeId, bande.id)).orderBy(consommationAlimentTable.date);
    if (aliment.length > 0) {
      bandesAvecAliment++;
      const startDate = new Date(bande.dateDeDepart + "T00:00:00");
      for (const a of aliment) {
        const kg = parseFloat(a.quantiteKg);
        totalAlimentKg += kg;
        const entryDate = new Date(a.date + "T00:00:00");
        const ageJours = Math.floor((entryDate.getTime() - startDate.getTime()) / 86400000) + 1;
        if (ageJours <= 15) alimentDemarrage += kg;
        else if (ageJours <= 28) alimentCroissance += kg;
        else alimentFinition += kg;
      }
    }

    const eau = await db.select().from(consommationEauTable).where(eq(consommationEauTable.bandeId, bande.id));
    if (eau.length > 0) {
      bandesAvecEau++;
      for (const e of eau) {
        const litres = parseFloat(e.quantiteLitres);
        totalEauL += litres;
        const age = e.ageJours;
        if (age <= 15) eauDemarrage += litres;
        else if (age <= 28) eauCroissance += litres;
        else eauFinition += litres;
      }
    }

    const mort = await db.select().from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.bandeId, bande.id));
    if (mort.length > 0) {
      bandesAvecMort++;
      let maxAge = 0;
      for (const m of mort) {
        const deces = m.decesJour;
        const age = m.ageJours;
        if (age > maxAge) maxAge = age;
        if (age <= 15) decesDemarrage += deces;
        else if (age <= 28) decesCroissance += deces;
        else decesFinition += deces;
      }
      totalDureeJours += maxAge;
    }

    const pesees = await db.select().from(peseesTable).where(eq(peseesTable.bandeId, bande.id)).orderBy(peseesTable.ageJours);
    if (pesees.length > 0) {
      const dernierPoids = parseFloat(pesees[pesees.length - 1].poidsMoyenG);
      poidsFinaux.push(dernierPoids);
    }
  }

  const n = allBandes.length;
  const avgAlimentParSujet = totalSujets > 0 ? totalAlimentKg / totalSujets : 4.5;
  const avgEauParSujet = totalSujets > 0 ? totalEauL / totalSujets : 15;
  const avgTauxMortalite = totalSujets > 0 ? (totalDeces / totalSujets) * 100 : 5;
  const avgDuree = bandesAvecMort > 0 ? Math.round(totalDureeJours / bandesAvecMort) : 45;
  const avgPoidsFinalG = poidsFinaux.length > 0 ? Math.round(poidsFinaux.reduce((a, b) => a + b, 0) / poidsFinaux.length) : 2000;

  const alimentParSujetDemarrage = totalSujets > 0 ? alimentDemarrage / totalSujets : 0.5;
  const alimentParSujetCroissance = totalSujets > 0 ? alimentCroissance / totalSujets : 1.5;
  const alimentParSujetFinition = totalSujets > 0 ? alimentFinition / totalSujets : 2.5;

  const eauParSujetDemarrage = totalSujets > 0 ? eauDemarrage / totalSujets : 2;
  const eauParSujetCroissance = totalSujets > 0 ? eauCroissance / totalSujets : 5;
  const eauParSujetFinition = totalSujets > 0 ? eauFinition / totalSujets : 8;

  res.json({
    nbBandes: n,
    avgSujetsDepart: Math.round(totalSujets / n),
    avgTauxMortalite: Math.round(avgTauxMortalite * 10) / 10,
    avgDureeJours: avgDuree,
    avgPoidsFinalG,
    aliment: {
      totalParSujet: Math.round(avgAlimentParSujet * 100) / 100,
      demarrage: { parSujet: Math.round(alimentParSujetDemarrage * 100) / 100, totalKg: Math.round(alimentDemarrage), pctTotal: totalAlimentKg > 0 ? Math.round(alimentDemarrage / totalAlimentKg * 100) : 0 },
      croissance: { parSujet: Math.round(alimentParSujetCroissance * 100) / 100, totalKg: Math.round(alimentCroissance), pctTotal: totalAlimentKg > 0 ? Math.round(alimentCroissance / totalAlimentKg * 100) : 0 },
      finition: { parSujet: Math.round(alimentParSujetFinition * 100) / 100, totalKg: Math.round(alimentFinition), pctTotal: totalAlimentKg > 0 ? Math.round(alimentFinition / totalAlimentKg * 100) : 0 },
    },
    eau: {
      totalParSujet: Math.round(avgEauParSujet * 100) / 100,
      demarrage: { parSujet: Math.round(eauParSujetDemarrage * 100) / 100 },
      croissance: { parSujet: Math.round(eauParSujetCroissance * 100) / 100 },
      finition: { parSujet: Math.round(eauParSujetFinition * 100) / 100 },
    },
    mortalite: {
      demarrage: totalDeces > 0 ? Math.round(decesDemarrage / totalDeces * 100) : 0,
      croissance: totalDeces > 0 ? Math.round(decesCroissance / totalDeces * 100) : 0,
      finition: totalDeces > 0 ? Math.round(decesFinition / totalDeces * 100) : 0,
    },
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const detail = await getBandeDetail(id);
  if (!detail) {
    res.status(404).json({ error: "Bande introuvable" });
    return;
  }
  res.json(detail);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, dateDeDepart, sujetsDepart, nombreDeces, valeurMaterielFixe, statut } = req.body;
  const updates: Record<string, unknown> = {};
  if (nom !== undefined) updates.nom = nom;
  if (dateDeDepart !== undefined) updates.dateDeDepart = dateDeDepart;
  if (sujetsDepart !== undefined) updates.sujetsDepart = sujetsDepart;
  if (nombreDeces !== undefined) updates.nombreDeces = nombreDeces;
  if (valeurMaterielFixe !== undefined) updates.valeurMaterielFixe = String(valeurMaterielFixe);
  if (statut !== undefined) updates.statut = statut;
  const rows = await db.update(bandesTable).set(updates).where(eq(bandesTable.id, id)).returning();
  const r = rows[0];
  await logFromRequest(req, "Modification bande", `${r.nom}`);
  res.json({
    id: r.id,
    numero: r.numero,
    nom: r.nom,
    dateDeDepart: r.dateDeDepart,
    sujetsDepart: r.sujetsDepart,
    nombreDeces: r.nombreDeces,
    valeurMaterielFixe: parseFloat(r.valeurMaterielFixe),
    statut: r.statut,
    createdAt: r.createdAt,
  });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(bandesTable).where(eq(bandesTable.id, id));
  await logFromRequest(req, "Suppression bande", `ID: ${id}`);
  res.json({ success: true });
});

router.get("/:id/depenses", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const rows = await db.select().from(bandeDepensesTable).where(eq(bandeDepensesTable.bandeId, bandeId));
  res.json(rows.map(r => ({
    id: r.id,
    bandeId: r.bandeId,
    designation: r.designation,
    categorie: r.categorie,
    quantite: parseFloat(r.quantite),
    prixUnitaire: parseFloat(r.prixUnitaire),
    montant: parseFloat(r.quantite) * parseFloat(r.prixUnitaire),
  })));
});

router.post("/:id/depenses", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { designation, categorie, quantite, prixUnitaire } = req.body;
  const rows = await db.insert(bandeDepensesTable).values({
    bandeId,
    designation,
    categorie,
    quantite: String(quantite),
    prixUnitaire: String(prixUnitaire),
  }).returning();
  const r = rows[0];
  await logFromRequest(req, "Ajout dépense bande", `${designation} - ${parseFloat(r.quantite) * parseFloat(r.prixUnitaire)} FCFA`);
  res.status(201).json({
    id: r.id,
    bandeId: r.bandeId,
    designation: r.designation,
    categorie: r.categorie,
    quantite: parseFloat(r.quantite),
    prixUnitaire: parseFloat(r.prixUnitaire),
    montant: parseFloat(r.quantite) * parseFloat(r.prixUnitaire),
  });
});

router.put("/:id/depenses/:depenseId", async (req, res) => {
  const depenseId = parseInt(req.params.depenseId);
  const { designation, categorie, quantite, prixUnitaire } = req.body;
  const rows = await db.update(bandeDepensesTable).set({
    designation,
    categorie,
    quantite: String(quantite),
    prixUnitaire: String(prixUnitaire),
  }).where(eq(bandeDepensesTable.id, depenseId)).returning();
  const r = rows[0];
  res.json({
    id: r.id,
    bandeId: r.bandeId,
    designation: r.designation,
    categorie: r.categorie,
    quantite: parseFloat(r.quantite),
    prixUnitaire: parseFloat(r.prixUnitaire),
    montant: parseFloat(r.quantite) * parseFloat(r.prixUnitaire),
  });
});

router.delete("/:id/depenses/:depenseId", async (req, res) => {
  const depenseId = parseInt(req.params.depenseId);
  await db.delete(bandeDepensesTable).where(eq(bandeDepensesTable.id, depenseId));
  await logFromRequest(req, "Suppression dépense bande", `ID: ${depenseId}`);
  res.json({ success: true });
});

router.get("/:id/ventes", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const rows = await db.select().from(bandeVentesTable).where(eq(bandeVentesTable.bandeId, bandeId));
  res.json(rows.map(r => ({
    id: r.id,
    bandeId: r.bandeId,
    date: r.date,
    quantiteVendue: r.quantiteVendue,
    prixUnitaire: parseFloat(r.prixUnitaire),
    montant: r.quantiteVendue * parseFloat(r.prixUnitaire),
  })));
});

router.post("/:id/ventes", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { date, quantiteVendue, prixUnitaire } = req.body;
  const rows = await db.insert(bandeVentesTable).values({
    bandeId,
    date,
    quantiteVendue,
    prixUnitaire: String(prixUnitaire),
  }).returning();
  const r = rows[0];
  await logFromRequest(req, "Ajout vente bande", `${quantiteVendue} sujets à ${prixUnitaire} FCFA`);
  res.status(201).json({
    id: r.id,
    bandeId: r.bandeId,
    date: r.date,
    quantiteVendue: r.quantiteVendue,
    prixUnitaire: parseFloat(r.prixUnitaire),
    montant: r.quantiteVendue * parseFloat(r.prixUnitaire),
  });
});

router.put("/:id/ventes/:venteId", async (req, res) => {
  const venteId = parseInt(req.params.venteId);
  const { date, quantiteVendue, prixUnitaire } = req.body;
  const rows = await db.update(bandeVentesTable).set({
    date,
    quantiteVendue,
    prixUnitaire: String(prixUnitaire),
  }).where(eq(bandeVentesTable.id, venteId)).returning();
  const r = rows[0];
  res.json({
    id: r.id,
    bandeId: r.bandeId,
    date: r.date,
    quantiteVendue: r.quantiteVendue,
    prixUnitaire: parseFloat(r.prixUnitaire),
    montant: r.quantiteVendue * parseFloat(r.prixUnitaire),
  });
});

router.delete("/:id/ventes/:venteId", async (req, res) => {
  const venteId = parseInt(req.params.venteId);
  await db.delete(bandeVentesTable).where(eq(bandeVentesTable.id, venteId));
  await logFromRequest(req, "Suppression vente bande", `ID: ${venteId}`);
  res.json({ success: true });
});

router.get("/:id/charges-fixes", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const bandeRows = await db.select().from(bandesTable).where(eq(bandesTable.id, bandeId));
  if (bandeRows.length === 0) {
    res.status(404).json({ error: "Bande introuvable" });
    return;
  }
  const bande = bandeRows[0];

  const chargesRows = await db.select().from(chargesFixesTable).where(eq(chargesFixesTable.bandeId, bandeId));
  let chargesRow = chargesRows[0];
  if (!chargesRow) {
    const inserted = await db.insert(chargesFixesTable).values({ bandeId, loyer: "0" }).returning();
    chargesRow = inserted[0];
  }

  const depenses = await db.select().from(bandeDepensesTable).where(eq(bandeDepensesTable.bandeId, bandeId));
  const totalDepenses = depenses.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
  const tauxDep = await getParam("taux_depreciation_materiel", 10);
  const tauxImp = await getParam("taux_imprevus", 5);
  const valeurPerdueMateriel = parseFloat(bande.valeurMaterielFixe) * (tauxDep / 100);
  const imprevus = totalDepenses * (tauxImp / 100);
  const loyer = parseFloat(chargesRow.loyer);
  const total = valeurPerdueMateriel + imprevus + loyer;

  res.json({
    id: chargesRow.id,
    bandeId,
    valeurPerdueMateriel,
    imprévus: imprevus,
    loyer,
    total,
  });
});

router.put("/:id/charges-fixes", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { loyer } = req.body;

  const bandeRows = await db.select().from(bandesTable).where(eq(bandesTable.id, bandeId));
  if (bandeRows.length === 0) {
    res.status(404).json({ error: "Bande introuvable" });
    return;
  }
  const bande = bandeRows[0];

  const existing = await db.select().from(chargesFixesTable).where(eq(chargesFixesTable.bandeId, bandeId));
  let chargesRow;
  if (existing.length === 0) {
    const inserted = await db.insert(chargesFixesTable).values({ bandeId, loyer: String(loyer ?? 0) }).returning();
    chargesRow = inserted[0];
  } else {
    const updated = await db.update(chargesFixesTable).set({ loyer: String(loyer ?? 0) }).where(eq(chargesFixesTable.bandeId, bandeId)).returning();
    chargesRow = updated[0];
  }

  const depenses = await db.select().from(bandeDepensesTable).where(eq(bandeDepensesTable.bandeId, bandeId));
  const totalDepenses = depenses.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
  const tauxDep2 = await getParam("taux_depreciation_materiel", 10);
  const tauxImp2 = await getParam("taux_imprevus", 5);
  const valeurPerdueMateriel = parseFloat(bande.valeurMaterielFixe) * (tauxDep2 / 100);
  const imprevus = totalDepenses * (tauxImp2 / 100);
  const loyerVal = parseFloat(chargesRow.loyer);
  const total = valeurPerdueMateriel + imprevus + loyerVal;

  res.json({ id: chargesRow.id, bandeId, valeurPerdueMateriel, imprévus: imprevus, loyer: loyerVal, total });
});

router.get("/:id/depenses-vente", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const rows = await db.select().from(depensesVenteTable).where(eq(depensesVenteTable.bandeId, bandeId));
  res.json(rows.map(r => ({
    id: r.id,
    bandeId: r.bandeId,
    designation: r.designation,
    montant: parseFloat(r.montant),
  })));
});

router.post("/:id/depenses-vente", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { designation, montant } = req.body;
  const rows = await db.insert(depensesVenteTable).values({ bandeId, designation, montant: String(montant) }).returning();
  const r = rows[0];
  res.status(201).json({ id: r.id, bandeId: r.bandeId, designation: r.designation, montant: parseFloat(r.montant) });
});

router.put("/:id/depenses-vente/:depenseId", async (req, res) => {
  const depenseId = parseInt(req.params.depenseId);
  const { designation, montant } = req.body;
  const rows = await db.update(depensesVenteTable).set({ designation, montant: String(montant) }).where(eq(depensesVenteTable.id, depenseId)).returning();
  const r = rows[0];
  res.json({ id: r.id, bandeId: r.bandeId, designation: r.designation, montant: parseFloat(r.montant) });
});

router.delete("/:id/depenses-vente/:depenseId", async (req, res) => {
  const depenseId = parseInt(req.params.depenseId);
  await db.delete(depensesVenteTable).where(eq(depensesVenteTable.id, depenseId));
  res.json({ success: true });
});

router.get("/:id/mortalite", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const rows = await db.select().from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.bandeId, bandeId)).orderBy(mortaliteJournaliereTable.ageJours);
  const bande = (await db.select().from(bandesTable).where(eq(bandesTable.id, bandeId)))[0];
  if (!bande) { res.status(404).json({ error: "Bande introuvable" }); return; }

  const seuilMortaliteJour = await getParam("seuil_mortalite_alerte_jour", 3);
  let decesCumules = 0;
  const data = rows.map(r => {
    const vivantsDebutJournee = bande.sujetsDepart - decesCumules;
    const tauxJour = vivantsDebutJournee > 0 ? (r.decesJour / vivantsDebutJournee) * 100 : 0;
    decesCumules += r.decesJour;
    const tauxMortalite = bande.sujetsDepart > 0 ? (decesCumules / bande.sujetsDepart) * 100 : 0;
    return {
      id: r.id,
      bandeId: r.bandeId,
      date: r.date,
      ageJours: r.ageJours,
      decesJour: r.decesJour,
      decesCumules,
      tauxMortalite: Math.round(tauxMortalite * 100) / 100,
      alerteRouge: tauxJour > seuilMortaliteJour,
    };
  });
  res.json(data);
});

router.post("/:id/mortalite", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { date, ageJours, decesJour } = req.body;
  const rows = await db.insert(mortaliteJournaliereTable).values({ bandeId, date, ageJours, decesJour: decesJour ?? 0 }).returning();
  // Recompute from source of truth to avoid drift
  const sumRows = await db.select({ total: sql<number>`COALESCE(SUM(${mortaliteJournaliereTable.decesJour}), 0)` }).from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.bandeId, bandeId));
  await db.update(bandesTable).set({ nombreDeces: Number(sumRows[0]?.total ?? 0) }).where(eq(bandesTable.id, bandeId));
  const r = rows[0];
  await logFromRequest(req, "Ajout mortalité", `${decesJour} décès - Bande ID: ${bandeId}`);
  res.status(201).json({ id: r.id, bandeId: r.bandeId, date: r.date, ageJours: r.ageJours, decesJour: r.decesJour });
});

router.delete("/:id/mortalite/:mortaliteId", async (req, res) => {
  const mortaliteId = parseInt(req.params.mortaliteId);
  const existing = await db.select().from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.id, mortaliteId));
  if (existing.length > 0) {
    const bandeId = existing[0].bandeId;
    await db.delete(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.id, mortaliteId));
    // Recompute from source of truth
    const sumRows = await db.select({ total: sql<number>`COALESCE(SUM(${mortaliteJournaliereTable.decesJour}), 0)` }).from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.bandeId, bandeId));
    await db.update(bandesTable).set({ nombreDeces: Number(sumRows[0]?.total ?? 0) }).where(eq(bandesTable.id, bandeId));
    res.json({ success: true });
    return;
  }
  await db.delete(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.id, mortaliteId));
  res.json({ success: true });
});

router.get("/:id/pesees", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const rows = await db.select().from(peseesTable).where(eq(peseesTable.bandeId, bandeId)).orderBy(peseesTable.ageJours);
  const seuilPoids = await getParam("seuil_poids_alerte", 90);
  res.json(rows.map(r => ({
    id: r.id,
    bandeId: r.bandeId,
    date: r.date,
    ageJours: r.ageJours,
    poidsMoyenG: parseFloat(r.poidsMoyenG),
    objectifPoidsG: r.objectifPoidsG ? parseFloat(r.objectifPoidsG) : null,
    ecart: r.objectifPoidsG ? parseFloat(r.poidsMoyenG) - parseFloat(r.objectifPoidsG) : null,
    alertePoids: r.objectifPoidsG ? parseFloat(r.poidsMoyenG) < parseFloat(r.objectifPoidsG) * (seuilPoids / 100) : false,
  })));
});

router.post("/:id/pesees", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { date, ageJours, poidsMoyenG, objectifPoidsG } = req.body;
  const rows = await db.insert(peseesTable).values({
    bandeId, date, ageJours,
    poidsMoyenG: String(poidsMoyenG),
    objectifPoidsG: objectifPoidsG ? String(objectifPoidsG) : null,
  }).returning();
  const r = rows[0];
  res.status(201).json({
    id: r.id, bandeId: r.bandeId, date: r.date, ageJours: r.ageJours,
    poidsMoyenG: parseFloat(r.poidsMoyenG),
    objectifPoidsG: r.objectifPoidsG ? parseFloat(r.objectifPoidsG) : null,
  });
});

router.delete("/:id/pesees/:peseeId", async (req, res) => {
  await db.delete(peseesTable).where(eq(peseesTable.id, parseInt(req.params.peseeId)));
  res.json({ success: true });
});

router.get("/:id/consommation", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const rows = await db.select().from(consommationAlimentTable).where(eq(consommationAlimentTable.bandeId, bandeId)).orderBy(consommationAlimentTable.date);
  const pesees = await db.select().from(peseesTable).where(eq(peseesTable.bandeId, bandeId)).orderBy(peseesTable.ageJours);
  const bande = (await db.select().from(bandesTable).where(eq(bandesTable.id, bandeId)))[0];

  const totalAlimentKg = rows.reduce((s, r) => s + parseFloat(r.quantiteKg), 0);
  let ic: number | null = null;
  let icStatus: string | null = null;
  if (pesees.length > 0 && bande) {
    const dernierPoids = parseFloat(pesees[pesees.length - 1].poidsMoyenG);
    const totalVendusIC = await db.select({ total: sql<number>`sum(quantite_vendue)` }).from(bandeVentesTable).where(eq(bandeVentesTable.bandeId, bandeId));
    const venduCount = Number(totalVendusIC[0]?.total || 0);
    const sujetsRestants = bande.sujetsDepart - bande.nombreDeces - venduCount;
    const poidsGagneTotal = (dernierPoids / 1000) * sujetsRestants;
    if (poidsGagneTotal > 0) {
      ic = Math.round((totalAlimentKg / poidsGagneTotal) * 100) / 100;
      const icBon = await getParam("ic_bon", 1.8);
      const icMoyen = await getParam("ic_moyen", 2.2);
      if (ic < icBon) icStatus = "bon";
      else if (ic <= icMoyen) icStatus = "moyen";
      else icStatus = "mauvais";
    }
  }

  res.json({
    entries: rows.map(r => ({ id: r.id, bandeId: r.bandeId, date: r.date, quantiteKg: parseFloat(r.quantiteKg) })),
    totalAlimentKg,
    ic,
    icStatus,
  });
});

router.post("/:id/consommation", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { date, quantiteKg } = req.body;
  const rows = await db.insert(consommationAlimentTable).values({ bandeId, date, quantiteKg: String(quantiteKg) }).returning();
  const r = rows[0];
  res.status(201).json({ id: r.id, bandeId: r.bandeId, date: r.date, quantiteKg: parseFloat(r.quantiteKg) });
});

router.delete("/:id/consommation/:consId", async (req, res) => {
  await db.delete(consommationAlimentTable).where(eq(consommationAlimentTable.id, parseInt(req.params.consId)));
  res.json({ success: true });
});

router.get("/:id/vaccinations", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  let rows = await db.select().from(vaccinationsTable).where(eq(vaccinationsTable.bandeId, bandeId)).orderBy(vaccinationsTable.jourPrevu);
  if (rows.length === 0) {
    const schedule = await getVaccinationSchedule();
    for (const v of schedule) {
      await db.insert(vaccinationsTable).values({ bandeId, ...v, fait: "non" });
    }
    rows = await db.select().from(vaccinationsTable).where(eq(vaccinationsTable.bandeId, bandeId)).orderBy(vaccinationsTable.jourPrevu);
  }
  const bande = (await db.select().from(bandesTable).where(eq(bandesTable.id, bandeId)))[0];
  const startDate = bande ? new Date(bande.dateDeDepart) : new Date();

  res.json(rows.map(r => {
    const datePrevue = new Date(startDate);
    datePrevue.setDate(datePrevue.getDate() + r.jourPrevu - 1);
    const enRetard = r.fait === "non" && datePrevue < new Date();
    return {
      id: r.id, bandeId: r.bandeId, jourPrevu: r.jourPrevu, nom: r.nom,
      description: r.description, fait: r.fait, dateFait: r.dateFait,
      commentaire: r.commentaire, datePrevue: datePrevue.toISOString().split("T")[0], enRetard,
    };
  }));
});

router.put("/:id/vaccinations/:vaccId", async (req, res) => {
  const vaccId = parseInt(req.params.vaccId);
  const { fait, dateFait, commentaire } = req.body;
  const updates: Record<string, unknown> = {};
  if (fait !== undefined) updates.fait = fait;
  if (dateFait !== undefined) updates.dateFait = dateFait;
  if (commentaire !== undefined) updates.commentaire = commentaire;
  const rows = await db.update(vaccinationsTable).set(updates).where(eq(vaccinationsTable.id, vaccId)).returning();
  const r = rows[0];
  res.json({
    id: r.id, bandeId: r.bandeId, jourPrevu: r.jourPrevu, nom: r.nom,
    description: r.description, fait: r.fait, dateFait: r.dateFait, commentaire: r.commentaire,
  });
});

router.post("/:id/vaccinations", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { jourPrevu, nom, description } = req.body;
  const rows = await db.insert(vaccinationsTable).values({ bandeId, jourPrevu, nom, description: description || null, fait: "non" }).returning();
  const r = rows[0];
  res.status(201).json({
    id: r.id, bandeId: r.bandeId, jourPrevu: r.jourPrevu, nom: r.nom,
    description: r.description, fait: r.fait, dateFait: r.dateFait, commentaire: r.commentaire,
  });
});

router.get("/:id/consommation-eau", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const rows = await db.select().from(consommationEauTable).where(eq(consommationEauTable.bandeId, bandeId)).orderBy(consommationEauTable.ageJours);
  res.json(rows.map(r => ({
    id: r.id, bandeId: r.bandeId, date: r.date, ageJours: r.ageJours,
    quantiteLitres: parseFloat(r.quantiteLitres),
  })));
});

router.post("/:id/consommation-eau", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { date, ageJours, quantiteLitres } = req.body;
  const rows = await db.insert(consommationEauTable).values({
    bandeId, date, ageJours, quantiteLitres: String(quantiteLitres),
  }).returning();
  const r = rows[0];
  res.status(201).json({
    id: r.id, bandeId: r.bandeId, date: r.date, ageJours: r.ageJours,
    quantiteLitres: parseFloat(r.quantiteLitres),
  });
});

router.delete("/:id/consommation-eau/:eauId", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  await db.delete(consommationEauTable).where(and(eq(consommationEauTable.id, parseInt(req.params.eauId)), eq(consommationEauTable.bandeId, bandeId)));
  res.json({ success: true });
});

router.get("/:id/traitements", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const rows = await db.select().from(traitementsTable).where(eq(traitementsTable.bandeId, bandeId)).orderBy(traitementsTable.ageJours);
  res.json(rows.map(r => ({
    id: r.id, bandeId: r.bandeId, date: r.date, ageJours: r.ageJours,
    produit: r.produit, type: r.type, dosage: r.dosage, observations: r.observations,
  })));
});

router.post("/:id/traitements", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { date, ageJours, produit, type, dosage, observations } = req.body;
  const rows = await db.insert(traitementsTable).values({
    bandeId, date, ageJours, produit, type: type || "traitement",
    dosage: dosage || null, observations: observations || null,
  }).returning();
  const r = rows[0];
  res.status(201).json({
    id: r.id, bandeId: r.bandeId, date: r.date, ageJours: r.ageJours,
    produit: r.produit, type: r.type, dosage: r.dosage, observations: r.observations,
  });
});

router.delete("/:id/traitements/:traitId", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  await db.delete(traitementsTable).where(and(eq(traitementsTable.id, parseInt(req.params.traitId)), eq(traitementsTable.bandeId, bandeId)));
  res.json({ success: true });
});

router.get("/:id/observations", async (req, res) => {
  const bandeId = parseInt(req.params.id);

  const rows = await db
    .select()
    .from(observationsJournalTable)
    .where(
      eq(observationsJournalTable.bandeId, bandeId),
    )
    .orderBy(observationsJournalTable.ageJours);

  res.json(
    rows.map((r) => ({
      id: r.id,
      bandeId: r.bandeId,
      date: r.date,
      ageJours: r.ageJours,
      contenu: r.contenu,
      clientMutationId: r.clientMutationId,
    })),
  );
});

router.post("/:id/observations", async (req, res) => {
  const bandeId = parseInt(req.params.id);

  const {
    date,
    ageJours,
    contenu,
    clientMutationId,
  } = req.body;

  const rows = await db
    .insert(observationsJournalTable)
    .values({
      bandeId,
      date,
      ageJours,
      contenu,
      clientMutationId: clientMutationId ?? null,
    })
    .onConflictDoNothing({
      target: observationsJournalTable.clientMutationId,
    })
    .returning();

  if (rows.length > 0) {
    const r = rows[0];

    res.status(201).json({
      id: r.id,
      bandeId: r.bandeId,
      date: r.date,
      ageJours: r.ageJours,
      contenu: r.contenu,
      clientMutationId: r.clientMutationId,
    });

    return;
  }

  if (clientMutationId) {
    const existing = await db
      .select()
      .from(observationsJournalTable)
      .where(
        eq(
          observationsJournalTable.clientMutationId,
          clientMutationId,
        ),
      );

    if (existing.length > 0) {
      const r = existing[0];

      res.status(200).json({
        id: r.id,
        bandeId: r.bandeId,
        date: r.date,
        ageJours: r.ageJours,
        contenu: r.contenu,
        clientMutationId: r.clientMutationId,
      });

      return;
    }
  }

  res.status(409).json({
    error: "Impossible de créer l'observation",
  });
});

router.delete("/:id/observations/:obsId", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  await db.delete(observationsJournalTable).where(and(eq(observationsJournalTable.id, parseInt(req.params.obsId)), eq(observationsJournalTable.bandeId, bandeId)));
  res.json({ success: true });
});

router.post("/:id/parse-fiche", async (req, res) => {
  try {
    const bandeId = parseInt(req.params.id);
    const bandes = await db.select().from(bandesTable).where(eq(bandesTable.id, bandeId));
    if (!bandes.length) { res.status(404).json({ error: "Bande introuvable" }); return; }
    const bande = bandes[0];

    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) { res.status(400).json({ error: "Image requise" }); return; }

    const startDate = bande.dateDeDepart as string;
    const prompt = `Tu es un expert en aviculture. Analyse cette fiche de suivi hebdomadaire d'une bande de poulets de chair.

La bande a démarré le ${startDate}.

Extrais pour chaque ligne (jour) les données suivantes au format JSON strict:
{
  "jours": [
    {
      "date": "YYYY-MM-DD",
      "ageJours": number,
      "decesJour": number,
      "alimentKg": number,
      "eauLitres": number,
      "poidsMinG": number | null,
      "poidsMaxG": number | null,
      "traitement": string | null
    }
  ]
}

Règles:
- "date": déduis la date exacte depuis la date inscrite sur la fiche (format YYYY-MM-DD)
- "ageJours": le numéro du jour (J1, J2... ou l'âge de l'oiseau)  
- "decesJour": nombre de décès ce jour (colonne "Jour/day" sous Mortalité)
- "alimentKg": quantité d'aliment consommée ce jour en kg (colonne "Jour/day" sous Aliments/Feed)
- "eauLitres": quantité d'eau consommée ce jour en litres (colonne Eau/Water)
- "poidsMinG": poids minimum en grammes si indiqué sur la fiche (convertis depuis kg si nécessaire, ex: 0,080 kg → 80 g), sinon null
- "poidsMaxG": poids maximum en grammes si indiqué sur la fiche (convertis depuis kg si nécessaire), sinon null
- Sur la fiche il peut y avoir 2 colonnes de poids par jour (min et max) — extrait les deux séparément
- "traitement": traitement ou vaccin administré ce jour si lisible, sinon null
- Si une valeur est illisible ou absente, mets 0 pour les numériques et null pour les textes
- Retourne UNIQUEMENT le JSON, sans texte avant ou après`;

    let ai;
    try {
      ai = await getAI();
    } catch {
      res.status(503).json({
        error: "La lecture automatique de fiche n'est pas configurée sur ce serveur.",
        details: "Définissez GEMINI_API_KEY dans le fichier .env pour activer cette fonctionnalité (voir .env.example).",
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      }],
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    });

    const rawText = response.text ?? "{}";

    function cleanAndParseJson(text: string): any {
      // Try direct parse first
      try { return JSON.parse(text); } catch {}
      // Extract first JSON object
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      let s = match[0];
      // Remove single-line comments (// ...)
      s = s.replace(/\/\/[^\n]*/g, "");
      // Remove multi-line comments (/* ... */)
      s = s.replace(/\/\*[\s\S]*?\*\//g, "");
      // Remove trailing commas before } or ]
      s = s.replace(/,\s*([\]}])/g, "$1");
      // Replace undefined with null
      s = s.replace(/:\s*undefined/g, ": null");
      try { return JSON.parse(s); } catch {}
      return null;
    }

    const parsed = cleanAndParseJson(rawText) ?? { jours: [] };
    res.json({ jours: parsed.jours || [], bandeId, startDate });
  } catch (e: any) {
    console.error("parse-fiche error:", e.message);
    const userMsg = (e.message || "").includes("JSON")
      ? "L'IA a retourné une réponse mal formatée. Réessayez avec une photo plus nette ou recadrez la fiche."
      : (e.message || "Erreur lors de l'analyse");
    res.status(500).json({ error: userMsg });
  }
});

router.post("/:id/import-fiche", async (req, res) => {
  try {
    const bandeId = parseInt(req.params.id);
    const { jours } = req.body as { jours: Array<{date: string; ageJours: number; decesJour: number; alimentKg: number; eauLitres: number; poidsMinG?: number | null; poidsMaxG?: number | null; traitement?: string | null}> };
    if (!Array.isArray(jours) || !jours.length) { res.status(400).json({ error: "Aucune donnée à importer" }); return; }

    let imported = 0;
    for (const j of jours) {
      if (j.decesJour > 0 || j.decesJour === 0) {
        const existing = await db.select().from(mortaliteJournaliereTable).where(and(eq(mortaliteJournaliereTable.bandeId, bandeId), eq(mortaliteJournaliereTable.date, j.date)));
        if (!existing.length) {
          await db.insert(mortaliteJournaliereTable).values({ bandeId, date: j.date, ageJours: j.ageJours, decesJour: j.decesJour });
        }
      }
      if (j.alimentKg > 0) {
        const existing = await db.select().from(consommationAlimentTable).where(and(eq(consommationAlimentTable.bandeId, bandeId), eq(consommationAlimentTable.date, j.date)));
        if (!existing.length) {
          await db.insert(consommationAlimentTable).values({ bandeId, date: j.date, quantiteKg: String(j.alimentKg) });
        }
      }
      if (j.eauLitres > 0) {
        const existing = await db.select().from(consommationEauTable).where(and(eq(consommationEauTable.bandeId, bandeId), eq(consommationEauTable.date, j.date)));
        if (!existing.length) {
          await db.insert(consommationEauTable).values({ bandeId, date: j.date, ageJours: j.ageJours, quantiteLitres: String(j.eauLitres) });
        }
      }
      const hasMin = j.poidsMinG != null && j.poidsMinG > 0;
      const hasMax = j.poidsMaxG != null && j.poidsMaxG > 0;
      if (hasMin || hasMax) {
        const poidsMoyenG = hasMin && hasMax
          ? Math.round(((j.poidsMinG as number) + (j.poidsMaxG as number)) / 2)
          : (j.poidsMinG ?? j.poidsMaxG) as number;
        const existing = await db.select().from(peseesTable).where(and(eq(peseesTable.bandeId, bandeId), eq(peseesTable.date, j.date)));
        if (!existing.length) {
          await db.insert(peseesTable).values({ bandeId, date: j.date, ageJours: j.ageJours, poidsMoyenG: String(poidsMoyenG) });
        }
      }
      if (j.traitement) {
        await db.insert(traitementsTable).values({ bandeId, date: j.date, ageJours: j.ageJours, produit: j.traitement, type: "preventif" });
      }
      imported++;
    }
    res.json({ success: true, imported });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id/actifs", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const allocations = await db.select().from(bandeActifsTable).where(eq(bandeActifsTable.bandeId, bandeId));
  const result = await Promise.all(allocations.map(async (a) => {
    const actifRows = await db.select().from(actifsTable).where(eq(actifsTable.id, a.actifId));
    if (actifRows.length === 0) return null;
    const actif = actifRows[0];
    const bande = await db.select().from(bandesTable).where(eq(bandesTable.id, bandeId));
    const bandeRow = bande[0];
    const fraction = parseFloat(a.fractionUtilisee);
    const valeur = parseFloat(actif.valeur);
    const taux = parseFloat(actif.tauxAmortissementAnnuel);
    const dateDebut = bandeRow?.dateDeDepart ? new Date(bandeRow.dateDeDepart) : new Date();
    const dureeJours = Math.max(1, Math.floor((Date.now() - dateDebut.getTime()) / (1000 * 60 * 60 * 24)));
    const amortissement = valeur * fraction * (taux / 100) * (dureeJours / 365);
    return {
      id: a.id,
      actifId: a.actifId,
      bandeId: a.bandeId,
      fractionUtilisee: fraction,
      actif: { ...actif, valeur, tauxAmortissementAnnuel: taux },
      amortissement: Math.round(amortissement),
    };
  }));
  res.json(result.filter(Boolean));
});

router.post("/:id/actifs", async (req, res) => {
  const bandeId = parseInt(req.params.id);
  const { actifId, fractionUtilisee } = req.body;
  if (!actifId) { res.status(400).json({ message: "actifId requis" }); return; }
  const rows = await db.insert(bandeActifsTable).values({
    bandeId,
    actifId: parseInt(actifId),
    fractionUtilisee: String(fractionUtilisee ?? 1),
  }).returning();
  res.status(201).json(rows[0]);
});

router.put("/:id/actifs/:allocationId", async (req, res) => {
  const allocationId = parseInt(req.params.allocationId);
  const { fractionUtilisee } = req.body;
  const rows = await db.update(bandeActifsTable).set({ fractionUtilisee: String(fractionUtilisee) }).where(eq(bandeActifsTable.id, allocationId)).returning();
  if (rows.length === 0) { res.status(404).json({ message: "Allocation introuvable" }); return; }
  res.json(rows[0]);
});

router.delete("/:id/actifs/:allocationId", async (req, res) => {
  const allocationId = parseInt(req.params.allocationId);
  await db.delete(bandeActifsTable).where(eq(bandeActifsTable.id, allocationId));
  res.json({ success: true });
});

export default router;
