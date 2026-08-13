import { db, parametresTable } from "@workspace/db";

let cache: Record<string, string> = {};
let lastLoad = 0;
const CACHE_TTL = 60_000;

export async function getParametres(): Promise<Record<string, string>> {
  if (Date.now() - lastLoad < CACHE_TTL && Object.keys(cache).length > 0) {
    return cache;
  }
  const rows = await db.select().from(parametresTable);
  cache = {};
  for (const r of rows) {
    cache[r.cle] = r.valeur;
  }
  lastLoad = Date.now();
  return cache;
}

export function invalidateCache() {
  lastLoad = 0;
}

export async function getParam(cle: string, defaut: number): Promise<number> {
  const params = await getParametres();
  const v = params[cle];
  return v !== undefined ? parseFloat(v) : defaut;
}

export async function getParamStr(cle: string, defaut: string): Promise<string> {
  const params = await getParametres();
  return params[cle] ?? defaut;
}

const DEFAULT_VACCINS = [
  { jourPrevu: 1, nom: "Bipestos + Antistress", description: "Vaccination bipestos (Newcastle+Gumboro) + eau sucrée antistress" },
  { jourPrevu: 4, nom: "Antibiotique (J4-J6)", description: "Traitement antibiotique preventif pendant 3 jours" },
  { jourPrevu: 8, nom: "Vaccin Gumboro", description: "Vaccination contre la maladie de Gumboro + antistress" },
  { jourPrevu: 14, nom: "Rappel Gumboro", description: "Rappel vaccination Gumboro" },
  { jourPrevu: 21, nom: "Rappel Bipestos + Antistress", description: "Rappel bipestos (Newcastle+Gumboro) + antistress" },
];

export const REFERENCE_WEIGHT_CURVE = [
  { ageJours: 1, poidsG: 42 },
  { ageJours: 3, poidsG: 70 },
  { ageJours: 5, poidsG: 100 },
  { ageJours: 7, poidsG: 164 },
  { ageJours: 10, poidsG: 260 },
  { ageJours: 14, poidsG: 430 },
  { ageJours: 17, poidsG: 570 },
  { ageJours: 21, poidsG: 780 },
  { ageJours: 24, poidsG: 950 },
  { ageJours: 28, poidsG: 1200 },
  { ageJours: 31, poidsG: 1400 },
  { ageJours: 35, poidsG: 1700 },
  { ageJours: 38, poidsG: 1900 },
  { ageJours: 42, poidsG: 2200 },
  { ageJours: 45, poidsG: 2400 },
  { ageJours: 49, poidsG: 2700 },
  { ageJours: 52, poidsG: 2900 },
  { ageJours: 56, poidsG: 3100 },
  { ageJours: 60, poidsG: 3300 },
  { ageJours: 63, poidsG: 3450 },
  { ageJours: 70, poidsG: 3800 },
];

export async function getVaccinationSchedule(): Promise<Array<{ jourPrevu: number; nom: string; description: string }>> {
  const params = await getParametres();
  const schedule = [];
  const prefixes = ["vaccin_j1", "vaccin_j4", "vaccin_j8", "vaccin_j14", "vaccin_j21"];
  for (const prefix of prefixes) {
    const jour = params[`${prefix}_jour`];
    const nom = params[`${prefix}_nom`];
    const desc = params[`${prefix}_description`];
    if (jour && nom) {
      schedule.push({
        jourPrevu: parseInt(jour),
        nom,
        description: desc || "",
      });
    }
  }
  return schedule.length > 0 ? schedule : DEFAULT_VACCINS;
}
