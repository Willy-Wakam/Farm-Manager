import { Router } from "express";
import { eq, isNull } from "drizzle-orm";
import { db, financementTable, remboursementsTable, devisConstructionTable, puitsItemsTable, sortiesArgentTable, sortiesCarburantTable, depensesBatimentTable, depensesPuitsTable, bandesTable, bandeDepensesTable, bandeVentesTable, chargesFixesTable, depensesVenteTable, mortaliteJournaliereTable, vaccinationsTable, actifsTable } from "@workspace/db";
import { getParam } from "../lib/parametres";

const router = Router();

router.get("/summary", async (req, res) => {
  const financements = await db.select().from(financementTable);
  const totalFinance = financements.reduce((s, f) => s + parseFloat(f.montant), 0);

  const remboursements = await db.select().from(remboursementsTable);
  const totalRembourse = remboursements.reduce((s, r) => s + parseFloat(r.montant), 0);

  const devisRows = await db.select().from(devisConstructionTable).limit(1);
  const puitsItemsDevis = await db.select().from(puitsItemsTable);
  const totalPuitsDevis = puitsItemsDevis.reduce((s, p) => s + parseFloat(p.quantite) * parseFloat(p.prixUnitaire), 0);
  const devis = devisRows[0];
  const budgetBatDefaut = await getParam("budget_batiment_defaut", 3525000);
  const budgetCarbDefaut = await getParam("budget_carburant_defaut", 150000);
  const totalDevis = devis ? parseFloat(devis.batimentEstime) + parseFloat(devis.carburantEstime) + totalPuitsDevis : (budgetBatDefaut + budgetCarbDefaut);

  const sorties = await db.select().from(sortiesArgentTable);
  const sortiesCarb = await db.select().from(sortiesCarburantTable);
  const batimentItems = await db.select().from(depensesBatimentTable);
  const puitsItemsReal = await db.select().from(depensesPuitsTable);

  const totalSorties = sorties.reduce((s, r) => s + parseFloat(r.depense), 0);
  const totalCarburant = sortiesCarb.reduce((s, r) => s + parseFloat(r.montant), 0);
  const totalBatiment = batimentItems.reduce((s, r) => s + parseFloat(r.quantite) * parseFloat(r.prixUnitaire), 0);
  const totalPuitsReal = puitsItemsReal.reduce((s, r) => s + parseFloat(r.quantite) * parseFloat(r.prixUnitaire), 0);
  const totalDepenseConstruction = totalSorties + totalCarburant + totalBatiment + totalPuitsReal;

  const tauxDepreciation = await getParam("taux_depreciation_materiel", 10);
  const tauxImprevus = await getParam("taux_imprevus", 5);

  const bandes = await db.select().from(bandesTable).orderBy(bandesTable.numero);
  const bandesActives = [];
  const bandesTerminees = [];

  for (const bande of bandes) {
    const depenses = await db.select().from(bandeDepensesTable).where(eq(bandeDepensesTable.bandeId, bande.id));
    const ventes = await db.select().from(bandeVentesTable).where(eq(bandeVentesTable.bandeId, bande.id));
    const chargesRows = await db.select().from(chargesFixesTable).where(eq(chargesFixesTable.bandeId, bande.id));
    const depVenteRows = await db.select().from(depensesVenteTable).where(eq(depensesVenteTable.bandeId, bande.id));
    const mortaliteRows = await db.select().from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.bandeId, bande.id));

    const totalDepBande = depenses.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
    const totalRecettesBande = ventes.reduce((s, v) => s + v.quantiteVendue * parseFloat(v.prixUnitaire), 0);
    const loyer = chargesRows.length > 0 ? parseFloat(chargesRows[0].loyer) : 0;
    const valeurPerdue = parseFloat(bande.valeurMaterielFixe) * (tauxDepreciation / 100);
    const imprevus = totalDepBande * (tauxImprevus / 100);
    const chargesTotal = valeurPerdue + imprevus + loyer;
    const totalDepVente = depVenteRows.reduce((s, d) => s + parseFloat(d.montant), 0);
    const coutProduction = totalDepBande + chargesTotal;
    const beneficeEstime = totalRecettesBande - totalDepBande - chargesTotal - totalDepVente;
    const totalDeces = mortaliteRows.reduce((s, m) => s + m.decesJour, 0);
    const totalVendus = ventes.reduce((s, v) => s + v.quantiteVendue, 0);
    const sujetsVivants = bande.sujetsDepart - totalDeces;
    const tauxMortalite = bande.sujetsDepart > 0 ? (totalDeces / bande.sujetsDepart) * 100 : 0;

    const bandeData = {
      id: bande.id,
      nom: bande.nom,
      sujetsDepart: bande.sujetsDepart,
      sujetsVivants,
      coutProduction,
      totalRecettes: totalRecettesBande,
      beneficeEstime,
      tauxMortalite: Math.round(tauxMortalite * 100) / 100,
      totalDeces,
      totalVendus,
      createdAt: bande.createdAt,
      dateDeDepart: bande.dateDeDepart,
    };

    if (bande.statut === "active") {
      bandesActives.push(bandeData);
    } else {
      bandesTerminees.push(bandeData);
    }
  }

  const allDepenses = await db.select().from(bandeDepensesTable);
  const depensesMap: Record<string, number> = {};
  for (const d of allDepenses) {
    const montant = parseFloat(d.quantite) * parseFloat(d.prixUnitaire);
    depensesMap[d.categorie] = (depensesMap[d.categorie] ?? 0) + montant;
  }
  const depensesParCategorie = Object.entries(depensesMap).map(([categorie, montant]) => ({ categorie, montant }));

  const allBandeDepRows = await db.select().from(bandeDepensesTable);
  const totalDepBandesAll = allBandeDepRows.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
  const allBandeVenteRows = await db.select().from(bandeVentesTable);
  const totalRecBandesAll = allBandeVenteRows.reduce((s, v) => s + v.quantiteVendue * parseFloat(v.prixUnitaire), 0);
  const allDepVenteRows = await db.select().from(depensesVenteTable);
  const totalDepVenteAll = allDepVenteRows.reduce((s, d) => s + parseFloat(d.montant), 0);
  const actifsStandalone = await db.select().from(actifsTable).where(isNull(actifsTable.chantierId));
  const totalAchatActifs = actifsStandalone.reduce((s, a) => s + parseFloat(a.valeur), 0);
  const caisseDisponible = totalFinance - totalDepenseConstruction - totalDepBandesAll - totalDepVenteAll + totalRecBandesAll - totalRembourse - totalAchatActifs;
  const alerteDepassementBudget = totalDepenseConstruction > totalDevis;

  let prochainesVaccinations: Array<{ bandeNom: string; vaccinNom: string; datePrevue: string; enRetard: boolean }> = [];
  for (const bande of bandes) {
    if (bande.statut !== "active") continue;
    const vaccins = await db.select().from(vaccinationsTable).where(eq(vaccinationsTable.bandeId, bande.id));
    const startDate = new Date(bande.dateDeDepart);
    for (const v of vaccins) {
      if (v.fait === "oui") continue;
      const datePrevue = new Date(startDate);
      datePrevue.setDate(datePrevue.getDate() + v.jourPrevu - 1);
      prochainesVaccinations.push({
        bandeNom: bande.nom,
        vaccinNom: v.nom,
        datePrevue: datePrevue.toISOString().split("T")[0],
        enRetard: datePrevue < new Date(),
      });
    }
  }
  prochainesVaccinations.sort((a, b) => a.datePrevue.localeCompare(b.datePrevue));
  prochainesVaccinations = prochainesVaccinations.slice(0, 5);

  let previsions = null;
  if (bandesTerminees.length > 0) {
    const avgCoutProduction = bandesTerminees.reduce((s, b) => s + b.coutProduction, 0) / bandesTerminees.length;
    const avgBenefice = bandesTerminees.reduce((s, b) => s + b.beneficeEstime, 0) / bandesTerminees.length;
    const dureesParBande: number[] = [];
    for (const bt of bandesTerminees) {
      const startDate = new Date(bt.dateDeDepart);
      const mortRows = await db.select().from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.bandeId, bt.id));
      if (mortRows.length > 0) {
        dureesParBande.push(Math.max(...mortRows.map(m => m.ageJours)));
      } else {
        dureesParBande.push(45);
      }
    }
    const avgDureeJours = Math.round(dureesParBande.reduce((s, d) => s + d, 0) / dureesParBande.length);

    previsions = {
      coutProductionEstime: Math.round(avgCoutProduction),
      beneficeProbable: Math.round(avgBenefice),
      dureeMoyenneJours: avgDureeJours,
    };
  }

  res.json({
    totalFinance,
    totalRembourse,
    totalDevis,
    totalDepenseConstruction,
    caisseDisponible,
    nombreBandes: bandes.length,
    bandesActives,
    bandesTerminees,
    alerteDepassementBudget,
    depensesParCategorie,
    prochainesVaccinations,
    previsions,
  });
});

router.get("/comparaison-bandes", async (req, res) => {
  const tauxDepComp = await getParam("taux_depreciation_materiel", 10);
  const tauxImpComp = await getParam("taux_imprevus", 5);

  const bandes = await db.select().from(bandesTable).orderBy(bandesTable.numero);
  const result = [];

  for (const bande of bandes) {
    const depenses = await db.select().from(bandeDepensesTable).where(eq(bandeDepensesTable.bandeId, bande.id));
    const ventes = await db.select().from(bandeVentesTable).where(eq(bandeVentesTable.bandeId, bande.id));
    const chargesRows = await db.select().from(chargesFixesTable).where(eq(chargesFixesTable.bandeId, bande.id));
    const depVenteRows = await db.select().from(depensesVenteTable).where(eq(depensesVenteTable.bandeId, bande.id));
    const mortaliteRows = await db.select().from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.bandeId, bande.id));

    const totalDepBande = depenses.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
    const totalRecettes = ventes.reduce((s, v) => s + v.quantiteVendue * parseFloat(v.prixUnitaire), 0);
    const loyer = chargesRows.length > 0 ? parseFloat(chargesRows[0].loyer) : 0;
    const valeurPerdue = parseFloat(bande.valeurMaterielFixe) * (tauxDepComp / 100);
    const imprevus = totalDepBande * (tauxImpComp / 100);
    const chargesTotal = valeurPerdue + imprevus + loyer;
    const totalDepVente = depVenteRows.reduce((s, d) => s + parseFloat(d.montant), 0);
    const totalVendus = ventes.reduce((s, v) => s + v.quantiteVendue, 0);
    const totalDeces = mortaliteRows.reduce((s, m) => s + m.decesJour, 0);
    const beneficeNet = totalRecettes - totalDepBande - chargesTotal - totalDepVente;
    const tauxMortalite = bande.sujetsDepart > 0 ? (totalDeces / bande.sujetsDepart) * 100 : 0;
    const coutParSujet = bande.sujetsDepart > 0 ? (totalDepBande + chargesTotal) / bande.sujetsDepart : 0;
    const ventesNonNulles = ventes.filter(v => parseFloat(v.prixUnitaire) > 0);
    const totalRecettesNonNulles = ventesNonNulles.reduce((s, v) => s + v.quantiteVendue * parseFloat(v.prixUnitaire), 0);
    const totalVendusNonNuls = ventesNonNulles.reduce((s, v) => s + v.quantiteVendue, 0);
    const prixVenteMoyen = totalVendusNonNuls > 0 ? totalRecettesNonNulles / totalVendusNonNuls : 0;

    const startDate = new Date(bande.dateDeDepart);
    let dureeJours: number;
    if (bande.statut === "active") {
      dureeJours = Math.round((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    } else if (mortaliteRows.length > 0) {
      const lastMortDay = Math.max(...mortaliteRows.map(m => m.ageJours));
      dureeJours = lastMortDay;
    } else if (ventes.length > 0) {
      const lastVenteDate = new Date(Math.max(...ventes.map(v => new Date(v.date).getTime())));
      dureeJours = Math.round((lastVenteDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      dureeJours = 45;
    }

    const coutTotal = totalDepBande + chargesTotal + totalDepVente;
    const seuilNombrePoulets = prixVenteMoyen > 0 ? Math.ceil(coutTotal / prixVenteMoyen) : 0;
    const sujetsRestants = bande.sujetsDepart - totalDeces - totalVendus;
    const sujetsVivants = bande.sujetsDepart - totalDeces;
    const seuilPrixMin = sujetsVivants > 0 ? Math.round(coutTotal / sujetsVivants) : 0;
    const margeSecurite = totalRecettes > 0 ? ((totalRecettes - coutTotal) / totalRecettes) * 100 : 0;

    result.push({
      id: bande.id,
      numero: bande.numero,
      nom: bande.nom,
      statut: bande.statut,
      sujetsDepart: bande.sujetsDepart,
      nombreDeces: totalDeces,
      sujetsRestants,
      tauxMortalite: Math.round(tauxMortalite * 100) / 100,
      coutParSujet: Math.round(coutParSujet),
      prixVenteMoyen: Math.round(prixVenteMoyen),
      beneficeNet: Math.round(beneficeNet),
      dureeJours,
      totalVendus,
      seuilNombrePoulets,
      seuilPrixMin,
      margeSecurite: Math.round(margeSecurite * 100) / 100,
    });
  }

  res.json(result);
});

router.get("/historique-caisse", async (req, res) => {
  const financements = await db.select().from(financementTable).orderBy(financementTable.createdAt);
  const sortiesArgent = await db.select().from(sortiesArgentTable).orderBy(sortiesArgentTable.createdAt);
  const sortiesCarburant = await db.select().from(sortiesCarburantTable).orderBy(sortiesCarburantTable.createdAt);
  const rembRows = await db.select().from(remboursementsTable).orderBy(remboursementsTable.createdAt);
  const batimentItems = await db.select().from(depensesBatimentTable);
  const puitsItems = await db.select().from(depensesPuitsTable);
  const allBandeDepenses = await db.select().from(bandeDepensesTable);
  const allBandeVentes = await db.select().from(bandeVentesTable);
  const allDepVente = await db.select().from(depensesVenteTable);

  type CaisseEntry = { date: string; type: "entree" | "sortie"; categorie: string; designation: string; montant: number; timestamp: Date };
  const entries: CaisseEntry[] = [];

  for (const f of financements) {
    entries.push({ date: f.date, type: "entree", categorie: "Financement", designation: `Investissement de ${f.nom}`, montant: parseFloat(f.montant), timestamp: new Date(f.date + "T00:00:00") });
  }
  for (const s of sortiesArgent) {
    entries.push({ date: s.date, type: "sortie", categorie: "Sortie argent", designation: `Décaissement`, montant: parseFloat(s.depense), timestamp: new Date(s.date + "T00:00:00") });
  }
  for (const c of sortiesCarburant) {
    entries.push({ date: c.date, type: "sortie", categorie: "Carburant", designation: `Carburant`, montant: parseFloat(c.montant), timestamp: new Date(c.date + "T00:00:00") });
  }
  for (const r of rembRows) {
    entries.push({ date: r.date, type: "sortie", categorie: "Remboursement", designation: `Remboursement ${r.investisseurNom}`, montant: parseFloat(r.montant), timestamp: new Date(r.date + "T00:00:00") });
  }
  for (const d of batimentItems) {
    const montant = parseFloat(d.quantite) * parseFloat(d.prixUnitaire);
    const dateStr = d.date ?? "2026-01-01";
    entries.push({ date: dateStr, type: "sortie", categorie: "Construction", designation: `Bâtiment : ${d.designation}`, montant, timestamp: new Date(dateStr + "T00:00:00") });
  }
  for (const d of puitsItems) {
    const montant = parseFloat(d.quantite) * parseFloat(d.prixUnitaire);
    const dateStr = d.date ?? "2026-01-01";
    entries.push({ date: dateStr, type: "sortie", categorie: "Construction", designation: `Puits : ${d.designation}`, montant, timestamp: new Date(dateStr + "T00:00:00") });
  }
  const bandeMap = new Map<number, { nom: string; dateDeDepart: string }>();
  const bandeRows = await db.select().from(bandesTable);
  for (const b of bandeRows) bandeMap.set(b.id, { nom: b.nom, dateDeDepart: b.dateDeDepart });
  for (const d of allBandeDepenses) {
    const montant = parseFloat(d.quantite) * parseFloat(d.prixUnitaire);
    const bInfo = bandeMap.get(d.bandeId);
    const dateStr = bInfo?.dateDeDepart ?? "2026-01-01";
    entries.push({ date: dateStr, type: "sortie", categorie: "Production", designation: `[${bInfo?.nom ?? "?"}] ${d.categorie} : ${d.designation}`, montant, timestamp: new Date(dateStr + "T00:00:00") });
  }
  for (const v of allBandeVentes) {
    const montant = v.quantiteVendue * parseFloat(v.prixUnitaire);
    if (montant > 0) {
      entries.push({ date: v.date, type: "entree", categorie: "Vente", designation: `Vente ${v.quantiteVendue} poulet(s)`, montant, timestamp: new Date(v.date + "T00:00:00") });
    }
  }
  for (const d of allDepVente) {
    const bInfo = bandeMap.get(d.bandeId);
    const dateStr = bInfo?.dateDeDepart ?? "2026-01-01";
    entries.push({ date: dateStr, type: "sortie", categorie: "Frais de vente", designation: d.designation, montant: parseFloat(d.montant), timestamp: new Date(dateStr + "T00:00:00") });
  }
  const actifsManuals = await db.select().from(actifsTable).where(isNull(actifsTable.chantierId));
  for (const a of actifsManuals) {
    const valeur = parseFloat(a.valeur);
    if (valeur > 0) {
      const dateStr = a.dateAcquisition ?? "2026-01-01";
      entries.push({ date: dateStr, type: "sortie", categorie: "Achat actif", designation: a.nom, montant: valeur, timestamp: new Date(dateStr + "T00:00:00") });
    }
  }

  entries.sort((a, b) => {
    const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
    if (timeDiff !== 0) return timeDiff;
    if (a.type === "entree" && b.type === "sortie") return -1;
    if (a.type === "sortie" && b.type === "entree") return 1;
    return 0;
  });

  let solde = 0;
  const result = entries.map(e => {
    if (e.type === "entree") solde += e.montant;
    else solde -= e.montant;
    return { ...e, soldeApres: Math.round(solde), timestamp: undefined };
  });

  res.json({ entries: result, soldeCourant: Math.round(solde) });
});

router.get("/finances", async (req, res) => {
  const tauxDepreciation = await getParam("taux_depreciation_materiel", 10);
  const tauxImprevus = await getParam("taux_imprevus", 5);

  const financements = await db.select().from(financementTable);
  const remboursements = await db.select().from(remboursementsTable);
  const sorties = await db.select().from(sortiesArgentTable);
  const sortiesCarb = await db.select().from(sortiesCarburantTable);
  const batimentItems = await db.select().from(depensesBatimentTable);
  const puitsItems = await db.select().from(depensesPuitsTable);
  const bandes = await db.select().from(bandesTable).orderBy(bandesTable.numero);

  const totalFinancement = financements.reduce((s, f) => s + parseFloat(f.montant), 0);
  const totalRembourse = remboursements.reduce((s, r) => s + parseFloat(r.montant), 0);
  const totalSorties = sorties.reduce((s, r) => s + parseFloat(r.depense), 0);
  const totalCarburant = sortiesCarb.reduce((s, r) => s + parseFloat(r.montant), 0);
  const totalBatiment = batimentItems.reduce((s, r) => s + parseFloat(r.quantite) * parseFloat(r.prixUnitaire), 0);
  const totalPuits = puitsItems.reduce((s, r) => s + parseFloat(r.quantite) * parseFloat(r.prixUnitaire), 0);
  const totalConstruction = totalSorties + totalCarburant + totalBatiment + totalPuits;

  let totalDepensesBandes = 0;
  let totalRecettesBandes = 0;
  let totalDepensesVenteBandes = 0;
  let totalAmorti = 0;
  const bandesDetails: any[] = [];
  const projectionsBandesActives: any[] = [];

  for (const bande of bandes) {
    const depenses = await db.select().from(bandeDepensesTable).where(eq(bandeDepensesTable.bandeId, bande.id));
    const ventes = await db.select().from(bandeVentesTable).where(eq(bandeVentesTable.bandeId, bande.id));
    const chargesRows = await db.select().from(chargesFixesTable).where(eq(chargesFixesTable.bandeId, bande.id));
    const depVenteRows = await db.select().from(depensesVenteTable).where(eq(depensesVenteTable.bandeId, bande.id));
    const mortaliteRows = await db.select().from(mortaliteJournaliereTable).where(eq(mortaliteJournaliereTable.bandeId, bande.id));

    const totalDep = depenses.reduce((s, d) => s + parseFloat(d.quantite) * parseFloat(d.prixUnitaire), 0);
    const totalRec = ventes.reduce((s, v) => s + v.quantiteVendue * parseFloat(v.prixUnitaire), 0);
    const totalDepV = depVenteRows.reduce((s, d) => s + parseFloat(d.montant), 0);
    const loyer = chargesRows.length > 0 ? parseFloat(chargesRows[0].loyer) : 0;
    const valeurPerdue = parseFloat(bande.valeurMaterielFixe) * (tauxDepreciation / 100);
    const imprevus = totalDep * (tauxImprevus / 100);
    const chargesTotal = valeurPerdue + imprevus + loyer;
    const totalDeces = mortaliteRows.reduce((s, m) => s + m.decesJour, 0);
    const totalVendus = ventes.reduce((s, v) => s + v.quantiteVendue, 0);
    const sujetsRestants = bande.sujetsDepart - totalDeces - totalVendus;
    const coutTotal = totalDep + chargesTotal;
    const beneficeNet = totalRec - coutTotal - totalDepV;
    const ventesNonNulles = ventes.filter(v => parseFloat(v.prixUnitaire) > 0);
    const totalRecNonNul = ventesNonNulles.reduce((s, v) => s + v.quantiteVendue * parseFloat(v.prixUnitaire), 0);
    const totalVendusNonNuls = ventesNonNulles.reduce((s, v) => s + v.quantiteVendue, 0);
    const prixVenteMoyen = totalVendusNonNuls > 0 ? totalRecNonNul / totalVendusNonNuls : 0;
    const roiBande = coutTotal > 0 ? ((totalRec - coutTotal - totalDepV) / coutTotal) * 100 : 0;

    totalDepensesBandes += totalDep;
    totalRecettesBandes += totalRec;
    totalDepensesVenteBandes += totalDepV;
    totalAmorti += chargesTotal;

    const detail = {
      id: bande.id,
      nom: bande.nom,
      statut: bande.statut,
      sujetsDepart: bande.sujetsDepart,
      sujetsRestants,
      totalDeces,
      totalVendus,
      coutProduction: Math.round(coutTotal),
      totalRecettes: Math.round(totalRec),
      beneficeNet: Math.round(beneficeNet),
      chargesTotal: Math.round(chargesTotal),
      prixVenteMoyen: Math.round(prixVenteMoyen),
      roiBande: Math.round(roiBande * 10) / 10,
    };
    bandesDetails.push(detail);

    if (bande.statut === "active") {
      const recettesEstimees = totalRec + sujetsRestants * prixVenteMoyen;
      const beneficeEstime = recettesEstimees - coutTotal - totalDepV;
      projectionsBandesActives.push({
        ...detail,
        recettesEstimees: Math.round(recettesEstimees),
        beneficeEstime: Math.round(beneficeEstime),
        prixVenteMoyenUtilise: Math.round(prixVenteMoyen),
        hypothese: prixVenteMoyen > 0 ? "prix_historique" : "pas_de_vente_encore",
      });
    }
  }

  // Standalone actifs (terrain, bâtiment racheté, etc.) — not linked to a chantier
  const actifsStandalone = await db.select().from(actifsTable).where(isNull(actifsTable.chantierId));
  const totalAchatActifs = actifsStandalone.reduce((s, a) => s + parseFloat(a.valeur), 0);

  // Full cash position: money in - money out (all categories)
  const soldeCourant = totalFinancement - totalConstruction - totalDepensesBandes - totalDepensesVenteBandes + totalRecettesBandes - totalRembourse - totalAchatActifs;

  // Amortissement
  const resteAAmortir = Math.max(0, totalConstruction + totalAchatActifs - totalAmorti);
  const totalInvestissementsAmortissables = totalConstruction + totalAchatActifs;
  const progressionAmortissement = totalInvestissementsAmortissables > 0 ? Math.min(100, (totalAmorti / totalInvestissementsAmortissables) * 100) : 0;
  const bandesTerminees = bandesDetails.filter(b => b.statut !== "active");
  const moyenneAmortissementParBande = bandesTerminees.length > 0
    ? bandesTerminees.reduce((s, b) => s + b.chargesTotal, 0) / bandesTerminees.length
    : (bandesDetails.length > 0 ? bandesDetails.reduce((s, b) => s + b.chargesTotal, 0) / bandesDetails.length : 0);
  const bandesRestantesEstimees = moyenneAmortissementParBande > 0 ? Math.ceil(resteAAmortir / moyenneAmortissementParBande) : null;

  // ROI global
  const totalDepensesToutes = totalConstruction + totalDepensesBandes + totalDepensesVenteBandes + totalAchatActifs;
  const roiGlobal = totalFinancement > 0
    ? ((totalRecettesBandes - totalDepensesToutes) / totalFinancement) * 100
    : 0;
  const pertesOuGains = totalRecettesBandes - totalDepensesToutes;

  res.json({
    soldeCourant: Math.round(soldeCourant),
    totalFinancement: Math.round(totalFinancement),
    totalRembourse: Math.round(totalRembourse),
    totalConstruction: Math.round(totalConstruction),
    totalDepensesBandes: Math.round(totalDepensesBandes),
    totalRecettesBandes: Math.round(totalRecettesBandes),
    totalDepensesVenteBandes: Math.round(totalDepensesVenteBandes),
    totalAchatActifs: Math.round(totalAchatActifs),
    totalAmorti: Math.round(totalAmorti),
    resteAAmortir: Math.round(resteAAmortir),
    progressionAmortissement: Math.round(progressionAmortissement * 10) / 10,
    bandesRestantesEstimees,
    moyenneAmortissementParBande: Math.round(moyenneAmortissementParBande),
    roiGlobal: Math.round(roiGlobal * 10) / 10,
    pertesOuGains: Math.round(pertesOuGains),
    bandesDetails,
    projectionsBandesActives,
  });
});

export default router;
