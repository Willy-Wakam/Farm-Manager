import { Router } from "express";
import multer from "multer";

let aiClient: any = null;
async function getAI() {
  if (!aiClient) {
    const mod = await import("@workspace/integrations-gemini-ai");
    aiClient = mod.ai;
  }
  return aiClient;
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

const EXTRACTION_PROMPT = `Tu es un assistant qui extrait les données d'une fiche de suivi d'élevage de poulets de chair.
La fiche contient un tableau avec les colonnes : Jour (ou date), Température (8h, 12h, 18h), alimentation (kg), eau (litres), mortalité (nombre de décès), Observations/Traitements.
Les jours de la semaine sont : lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche.
La fiche peut aussi contenir : période (dates), semaine N°, effectif en début de semaine, poids moyen en fin de semaine.

Extrais TOUTES les données lisibles du tableau et retourne un JSON valide avec cette structure exacte :
{
  "semaine": <numéro de semaine ou null>,
  "periodeDu": "<date début au format YYYY-MM-DD>",
  "periodeAu": "<date fin au format YYYY-MM-DD>",
  "effectifDebut": <nombre ou null>,
  "poidsMoyenFinSemaine": <nombre en grammes ou null>,
  "jours": [
    {
      "jour": "lundi",
      "date": "2026-02-17",
      "alimentationKg": <nombre ou null>,
      "eauLitres": <nombre ou null>,
      "mortalite": <nombre ou 0>,
      "observations": "<texte ou chaîne vide>"
    }
  ]
}

Règles CRITIQUES sur les dates :
- periodeDu et periodeAu DOIVENT être au format YYYY-MM-DD (ex: "2026-02-17"), JAMAIS en format DD/MM/YY ou autre
- Si la fiche indique "17/02/26" ou "17/02/2026", convertis en "2026-02-17"
- Si l'année est sur 2 chiffres (ex: 26), interprète comme 2026
- Chaque jour dans le tableau doit avoir un champ "date" au format YYYY-MM-DD calculé depuis les dates visibles sur la fiche
- Le champ "jour" reste le nom du jour de la semaine en français (lundi, mardi, etc.)

Autres règles :
- Retourne UNIQUEMENT le JSON, sans markdown, sans backticks, sans texte avant ou après
- Si une cellule est vide ou illisible, mets null pour les nombres et "" pour les textes
- mortalite doit être 0 si la cellule est vide (pas null)
- Les quantités d'aliment sont en kg, l'eau en litres
- Inclus uniquement les jours qui ont au moins une donnée remplie
- Si le poids est en kg, convertis en grammes (multiplie par 1000)
- Les observations peuvent inclure des traitements et vaccinations mentionnés sur la fiche`;

router.post("/", upload.single("photo"), async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  try {
    if (!req.file) {
      res.status(400).json({ error: "Aucune image fournie" });
      return;
    }

    const base64 = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype as "image/jpeg" | "image/png" | "image/webp";

    let ai;
    try {
      ai = await getAI();
    } catch {
      res.status(503).json({
        error: "Le scan de fiche n'est pas configuré sur ce serveur.",
        details: "Définissez GEMINI_API_KEY dans le fichier .env pour activer cette fonctionnalité (voir .env.example).",
      });
      return;
    }
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      config: { maxOutputTokens: 8192 },
    });

    const rawText = response.text ?? "";

    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(422).json({ error: "Impossible de lire les données de la fiche", raw: rawText });
      return;
    }

    if (!parsed.jours || !Array.isArray(parsed.jours)) {
      res.status(422).json({ error: "Aucune donnée journalière trouvée", data: parsed });
      return;
    }

    parsed.periodeDu = normalizeDate(parsed.periodeDu);
    parsed.periodeAu = normalizeDate(parsed.periodeAu);
    for (const jour of parsed.jours) {
      if (jour.date) jour.date = normalizeDate(jour.date);
    }

    res.json(parsed);
  } catch (err: any) {
    console.error("OCR error:", err);
    res.status(500).json({ error: "Erreur lors de l'analyse de l'image", details: err.message });
  }
});

export default router;
