import { Router } from "express";
import multer from "multer";
import { db, bandesTable, mortaliteJournaliereTable, peseesTable, consommationAlimentTable, consommationEauTable, traitementsTable, observationsJournalTable } from "@workspace/db";
import * as XLSX from "xlsx";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function excelDateToISO(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  return d.toISOString().split("T")[0];
}

interface DayRow {
  jour: number;
  date: string;
  effectif: number;
  mortaliteJour: number;
  alimentJourKg: number;
  eauLitres: number;
  poidsMinKg: number;
  poidsMaxKg: number;
  traitements: string;
  observations: string;
}

interface ColMap {
  jour: number;
  date: number;
  effectif: number;
  mortJour: number;
  alimJour: number;
  eau: number;
  poidsMin: number;
  poidsMax: number;
  traitements: number;
  observations: number;
}

function detectColumns(headers: string[]): ColMap {
  const h = headers.map(x => (x || "").toLowerCase().trim());

  const map: ColMap = {
    jour: 0,
    date: 1,
    effectif: 2,
    mortJour: 3,
    alimJour: 5,
    eau: -1,
    poidsMin: -1,
    poidsMax: -1,
    traitements: -1,
    observations: -1,
  };

  for (let i = 7; i < h.length; i++) {
    if ((h[i].includes("eau") || h[i].includes("water")) && !h[i].includes("cumul") && map.eau === -1) {
      map.eau = i;
    }
    if ((h[i].includes("masse") || h[i].includes("poids") || h[i].includes("weight")) && !h[i].includes("max") && map.poidsMin === -1) {
      map.poidsMin = i;
    }
    if ((h[i].includes("masse") || h[i].includes("poids") || h[i].includes("weight")) && h[i].includes("max") && map.poidsMax === -1) {
      map.poidsMax = i;
    }
    if ((h[i].includes("traitement") || h[i].includes("vaccin")) && map.traitements === -1) {
      map.traitements = i;
    }
    if (h[i].includes("observation") && map.observations === -1) {
      map.observations = i;
    }
  }

  if (map.poidsMax === -1 && map.poidsMin >= 0) {
    map.poidsMax = map.poidsMin;
  }

  return map;
}

function parseSheet(ws: XLSX.WorkSheet): { rows: DayRow[]; sujetsDepart: number } {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const data: any[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: any[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? cell.v : null);
    }
    data.push(row);
  }

  let headerRow = -1;
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const rowStr = data[i].map(c => String(c || "").toLowerCase()).join(" ");
    if (rowStr.includes("jour") && rowStr.includes("effectif")) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) return { rows: [], sujetsDepart: 0 };

  let skipAfterHeader = 0;
  if (headerRow + 1 < data.length) {
    const nextRow = data[headerRow + 1].map((c: any) => String(c || "").toLowerCase());
    if (nextRow.some((c: string) => c.includes("spalte"))) {
      skipAfterHeader = 1;
    }
  }

  const headers = data[headerRow].map((h: any) => String(h || ""));
  const colMap = detectColumns(headers);

  const rows: DayRow[] = [];
  let sujetsDepart = 0;

  for (let i = headerRow + 1 + skipAfterHeader; i < data.length; i++) {
    const r = data[i];
    const jour = Number(r[colMap.jour] || 0);
    if (!jour || jour <= 0 || isNaN(jour)) continue;

    const dateVal = r[colMap.date];
    let dateStr = "";
    if (typeof dateVal === "number" && dateVal > 40000) {
      dateStr = excelDateToISO(dateVal);
    } else if (dateVal) {
      dateStr = String(dateVal);
    }

    const effectif = Number(r[colMap.effectif] || 0);
    if (jour === 1 && effectif > 0) sujetsDepart = effectif;

    const mortJour = Number(r[colMap.mortJour] || 0);
    const alimJour = Number(r[colMap.alimJour] || 0);
    const eau = colMap.eau >= 0 ? Number(r[colMap.eau] || 0) : 0;
    const poidsMin = colMap.poidsMin >= 0 ? Number(r[colMap.poidsMin] || 0) : 0;
    const poidsMax = colMap.poidsMax >= 0 ? Number(r[colMap.poidsMax] || 0) : 0;

    const traitements = colMap.traitements >= 0 ? String(r[colMap.traitements] || "").trim() : "";
    const observations = colMap.observations >= 0 ? String(r[colMap.observations] || "").trim() : "";

    rows.push({
      jour,
      date: dateStr,
      effectif,
      mortaliteJour: isNaN(mortJour) ? 0 : mortJour,
      alimentJourKg: isNaN(alimJour) ? 0 : alimJour,
      eauLitres: isNaN(eau) ? 0 : eau,
      poidsMinKg: isNaN(poidsMin) ? 0 : poidsMin,
      poidsMaxKg: isNaN(poidsMax) ? 0 : poidsMax,
      traitements,
      observations,
    });
  }

  return { rows, sujetsDepart };
}

/**
 * Import d'un historique de bandes depuis un classeur Excel de suivi.
 *
 * Le fichier est envoyé par l'utilisateur (multipart, champ `fichier`).
 * Chaque feuille du classeur est traitée comme une bande : les colonnes
 * (jour, date, effectif, mortalité, aliment, eau, poids, traitements,
 * observations) sont détectées automatiquement depuis la ligne d'en-tête.
 */
router.post("/", upload.single("fichier"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier reçu. Envoyez un classeur Excel dans le champ 'fichier'." });
      return;
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch {
      res.status(400).json({ error: "Fichier illisible. Formats acceptés : .xlsx, .xls, .csv" });
      return;
    }

    const results: any[] = [];

    const existingBandes = await db.select().from(bandesTable);
    let nextNumero = Math.max(0, ...existingBandes.filter(b => b.numero > 0).map(b => b.numero)) + 1;

    for (let si = 0; si < workbook.SheetNames.length; si++) {
      const sheetName = workbook.SheetNames[si];
      const ws = workbook.Sheets[sheetName];
      const { rows, sujetsDepart } = parseSheet(ws);

      if (rows.length === 0 || sujetsDepart === 0) {
        results.push({ sheet: sheetName, status: "skipped", reason: "no data or no sujets" });
        continue;
      }

      const bandeName = sheetName.trim();
      const existingDuplicate = existingBandes.find(b => b.nom === bandeName);
      if (existingDuplicate) {
        results.push({ sheet: sheetName, status: "skipped", reason: "already imported", bandeId: existingDuplicate.id });
        continue;
      }
      const startDate = rows[0]?.date || "2024-01-01";
      const alreadyByDate = existingBandes.find(b => b.dateDeDepart === startDate && b.sujetsDepart === sujetsDepart);
      if (alreadyByDate) {
        results.push({ sheet: sheetName, status: "skipped", reason: "already imported (same date+sujets)", bandeId: alreadyByDate.id });
        continue;
      }

      const totalDeces = rows.reduce((s, r) => s + r.mortaliteJour, 0);

      const [bande] = await db.insert(bandesTable).values({
        numero: nextNumero++,
        nom: bandeName,
        dateDeDepart: startDate,
        sujetsDepart,
        nombreDeces: totalDeces,
        valeurMaterielFixe: "0",
        statut: "terminee",
      }).returning();

      for (const row of rows) {
        if (row.mortaliteJour > 0) {
          await db.insert(mortaliteJournaliereTable).values({
            bandeId: bande.id,
            date: row.date || startDate,
            ageJours: row.jour,
            decesJour: row.mortaliteJour,
          });
        }

        if (row.alimentJourKg > 0) {
          await db.insert(consommationAlimentTable).values({
            bandeId: bande.id,
            date: row.date || startDate,
            quantiteKg: String(row.alimentJourKg),
          });
        }

        if (row.eauLitres > 0) {
          await db.insert(consommationEauTable).values({
            bandeId: bande.id,
            date: row.date || startDate,
            ageJours: row.jour,
            quantiteLitres: String(row.eauLitres),
          });
        }

        const poidsMoyenKg = (row.poidsMinKg + row.poidsMaxKg) / 2;
        if (poidsMoyenKg > 0) {
          const poidsMoyenG = Math.round(poidsMoyenKg * 1000);
          await db.insert(peseesTable).values({
            bandeId: bande.id,
            date: row.date || startDate,
            ageJours: row.jour,
            poidsMoyenG: String(poidsMoyenG),
            objectifPoidsG: null,
          });
        }

        if (row.traitements && row.traitements !== "undefined" && row.traitements !== "0") {
          await db.insert(traitementsTable).values({
            bandeId: bande.id,
            date: row.date || startDate,
            ageJours: row.jour,
            produit: row.traitements,
            type: row.traitements.toLowerCase().includes("vaccin") ? "vaccin" : "traitement",
          });
        }

        if (row.observations && row.observations !== "undefined" && row.observations !== "0") {
          await db.insert(observationsJournalTable).values({
            bandeId: bande.id,
            date: row.date || startDate,
            ageJours: row.jour,
            contenu: row.observations,
          });
        }
      }

      results.push({
        sheet: sheetName,
        status: "imported",
        bandeId: bande.id,
        nom: bandeName,
        sujetsDepart,
        jours: rows.length,
        totalDeces,
      });
    }

    res.json({ success: true, results });
  } catch (err: any) {
    console.error("Import error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
