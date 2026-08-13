import { db, usersTable, parametresTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

/**
 * Paramètres par défaut de l'application.
 *
 * Ce sont des valeurs de référence génériques pour un élevage de poulets de chair.
 * Chaque exploitation peut les ajuster depuis la page /parametres (rôle admin).
 */
const PARAMETRES_DEFAUT = [
  { cle: "nom_ferme", valeur: "Ma Ferme", description: "Nom de l'exploitation, affiché dans l'application et sur les rapports PDF", categorie: "Identité" },
  { cle: "devise", valeur: "FCFA", description: "Devise utilisée pour tous les montants", categorie: "Identité" },

  { cle: "taux_depreciation_materiel", valeur: "10", description: "Taux de dépréciation annuel du matériel fixe (%)", categorie: "Charges fixes" },
  { cle: "taux_imprevus", valeur: "5", description: "Taux pour imprévus sur dépenses de production (%)", categorie: "Charges fixes" },

  { cle: "seuil_mortalite_alerte_jour", valeur: "3", description: "Taux de mortalité journalier déclenchant une alerte rouge (%)", categorie: "Alertes" },
  { cle: "seuil_mortalite_alerte_cumul", valeur: "5", description: "Taux de mortalité cumulé affiché en rouge (%)", categorie: "Alertes" },
  { cle: "seuil_poids_alerte", valeur: "90", description: "Pourcentage minimum du poids objectif avant alerte (%)", categorie: "Alertes" },

  { cle: "ic_bon", valeur: "1.8", description: "Indice de conversion considéré comme bon (≤)", categorie: "Indice de conversion" },
  { cle: "ic_moyen", valeur: "2.2", description: "Indice de conversion considéré comme moyen (≤)", categorie: "Indice de conversion" },

  { cle: "budget_batiment_defaut", valeur: "0", description: "Budget bâtiment par défaut si aucun devis n'a été saisi", categorie: "Budget construction" },
  { cle: "budget_carburant_defaut", valeur: "0", description: "Budget carburant par défaut si aucun devis n'a été saisi", categorie: "Budget construction" },

  { cle: "vaccin_j1_nom", valeur: "Bipestos + Antistress", description: "Nom du traitement jour 1", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j1_jour", valeur: "1", description: "Jour prévu pour le traitement 1", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j1_description", valeur: "Vaccination bipestos (Newcastle+Gumboro) + eau sucrée antistress", description: "Description du traitement jour 1", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j4_nom", valeur: "Antibiotique (J4-J6)", description: "Nom du traitement jour 4", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j4_jour", valeur: "4", description: "Jour prévu pour antibiotique", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j4_description", valeur: "Traitement antibiotique préventif pendant 3 jours", description: "Description traitement jour 4", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j8_nom", valeur: "Vaccin Gumboro", description: "Nom du vaccin jour 8", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j8_jour", valeur: "8", description: "Jour prévu pour le vaccin Gumboro", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j8_description", valeur: "Vaccination contre la maladie de Gumboro + antistress", description: "Description vaccin jour 8", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j14_nom", valeur: "Rappel Gumboro", description: "Nom du vaccin jour 14", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j14_jour", valeur: "14", description: "Jour prévu pour le rappel Gumboro", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j14_description", valeur: "Rappel vaccination Gumboro", description: "Description vaccin jour 14", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j21_nom", valeur: "Rappel Bipestos + Antistress", description: "Nom du vaccin jour 21", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j21_jour", valeur: "21", description: "Jour prévu pour le rappel bipestos", categorie: "Calendrier vaccinal" },
  { cle: "vaccin_j21_description", valeur: "Rappel bipestos (Newcastle+Gumboro) + antistress", description: "Description vaccin jour 21", categorie: "Calendrier vaccinal" },
];

/** Crée la table de sessions utilisée par connect-pg-simple. */
async function ensureSessionTable() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS session (sid VARCHAR NOT NULL COLLATE "default", sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL, CONSTRAINT session_pkey PRIMARY KEY (sid))`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire)`);
}

/** Ajoute les clés d'idempotence offline nécessaires aux déploiements existants. */
async function ensureOfflineIdempotencyColumns() {
  await db.execute(sql`
    ALTER TABLE "mortalite_journaliere"
    ADD COLUMN IF NOT EXISTS "client_mutation_id" uuid
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'mortalite_journaliere_client_mutation_id_unique'
      ) THEN
        ALTER TABLE "mortalite_journaliere"
        ADD CONSTRAINT "mortalite_journaliere_client_mutation_id_unique"
        UNIQUE ("client_mutation_id");
      END IF;
    END
    $$
  `);

  await db.execute(sql`
    ALTER TABLE "pesees"
    ADD COLUMN IF NOT EXISTS "client_mutation_id" uuid
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pesees_client_mutation_id_unique'
      ) THEN
        ALTER TABLE "pesees"
        ADD CONSTRAINT "pesees_client_mutation_id_unique"
        UNIQUE ("client_mutation_id");
      END IF;
    END
    $$
  `);

  await db.execute(sql`
    ALTER TABLE "consommation_eau"
    ADD COLUMN IF NOT EXISTS "client_mutation_id" uuid
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'consommation_eau_client_mutation_id_unique'
      ) THEN
        ALTER TABLE "consommation_eau"
        ADD CONSTRAINT "consommation_eau_client_mutation_id_unique"
        UNIQUE ("client_mutation_id");
      END IF;
    END
    $$
  `);

  await db.execute(sql`
    ALTER TABLE "traitements"
    ADD COLUMN IF NOT EXISTS "client_mutation_id" uuid
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'traitements_client_mutation_id_unique'
      ) THEN
        ALTER TABLE "traitements"
        ADD CONSTRAINT "traitements_client_mutation_id_unique"
        UNIQUE ("client_mutation_id");
      END IF;
    END
    $$
  `);

  await db.execute(sql`
    ALTER TABLE "vaccinations"
    ADD COLUMN IF NOT EXISTS "client_mutation_id" uuid
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'vaccinations_client_mutation_id_unique'
      ) THEN
        ALTER TABLE "vaccinations"
        ADD CONSTRAINT "vaccinations_client_mutation_id_unique"
        UNIQUE ("client_mutation_id");
      END IF;
    END
    $$
  `);
}

/**
 * Insère les paramètres manquants sans écraser ceux que l'exploitant a déjà réglés.
 * Permet d'ajouter de nouveaux paramètres lors des mises à jour de l'application.
 */
async function seedParametres() {
  const existing = await db.select({ cle: parametresTable.cle }).from(parametresTable);
  const known = new Set(existing.map((p) => p.cle));
  const manquants = PARAMETRES_DEFAUT.filter((p) => !known.has(p.cle));

  if (manquants.length === 0) return;

  await db.insert(parametresTable).values(manquants);
  logger.info({ count: manquants.length }, "Paramètres par défaut ajoutés");
}

/**
 * Crée le compte administrateur initial si la base ne contient aucun utilisateur.
 *
 * Identifiants pris dans ADMIN_USERNAME / ADMIN_PASSWORD, sinon admin / admin.
 * Le mot de passe doit être changé dès la première connexion.
 */
async function seedAdminUser() {
  const existingUsers = await db
    .select()
    .from(usersTable);

  if (existingUsers.length > 0) return;

  const isProduction =
    process.env.NODE_ENV === "production";

  const username =
    process.env.ADMIN_USERNAME ||
    (isProduction ? undefined : "admin");

  const password =
    process.env.ADMIN_PASSWORD ||
    (isProduction ? undefined : "admin");

  const nom =
    process.env.ADMIN_NOM ||
    "Administrateur";

  if (!username || !password) {
    throw new Error(
      "ADMIN_USERNAME et ADMIN_PASSWORD sont obligatoires pour initialiser une base vide en production.",
    );
  }

  await db.insert(usersTable).values({
    username,
    password: await bcrypt.hash(password, 10),
    nom,
    role: "admin",
  });

  if (isProduction) {
    logger.info(
      { username },
      "Compte administrateur initial créé",
    );
  } else if (!process.env.ADMIN_PASSWORD) {
    logger.warn(
      { username },
      "Compte administrateur de développement créé avec le mot de passe par défaut.",
    );
  }
}

/**
 * Initialisation au démarrage : table de sessions, paramètres par défaut,
 * et compte admin sur une base vierge. Aucune donnée d'exploitation n'est créée —
 * bandes, dépenses, investissements et chantiers se saisissent depuis l'application.
 */
export async function seedDefaults() {
  await ensureSessionTable();
  await ensureOfflineIdempotencyColumns();
  await seedParametres();
  await seedAdminUser();
}
