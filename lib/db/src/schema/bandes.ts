import { pgTable, serial, integer, numeric, text, date, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bandesTable = pgTable("bandes", {
  id: serial("id").primaryKey(),
  numero: integer("numero").notNull(),
  nom: text("nom").notNull(),
  dateDeDepart: date("date_de_depart").notNull(),
  sujetsDepart: integer("sujets_depart").notNull(),
  nombreDeces: integer("nombre_deces").notNull().default(0),
  valeurMaterielFixe: numeric("valeur_materiel_fixe", { precision: 15, scale: 2 }).notNull().default("0"),
  statut: text("statut").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bandeDepensesTable = pgTable("bande_depenses", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  designation: text("designation").notNull(),
  categorie: text("categorie").notNull(),
  quantite: numeric("quantite", { precision: 15, scale: 2 }).notNull(),
  prixUnitaire: numeric("prix_unitaire", { precision: 15, scale: 2 }).notNull(),
});

export const bandeVentesTable = pgTable("bande_ventes", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  quantiteVendue: integer("quantite_vendue").notNull(),
  prixUnitaire: numeric("prix_unitaire", { precision: 15, scale: 2 }).notNull(),
});

export const chargesFixesTable = pgTable("charges_fixes", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }).unique(),
  loyer: numeric("loyer", { precision: 15, scale: 2 }).notNull().default("0"),
});

export const depensesVenteTable = pgTable("depenses_vente", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  designation: text("designation").notNull(),
  montant: numeric("montant", { precision: 15, scale: 2 }).notNull(),
});

export const insertBandeSchema = createInsertSchema(bandesTable).omit({ id: true, numero: true, createdAt: true });
export type InsertBande = z.infer<typeof insertBandeSchema>;
export type Bande = typeof bandesTable.$inferSelect;

export const insertBandeDepenseSchema = createInsertSchema(bandeDepensesTable).omit({ id: true });
export type InsertBandeDepense = z.infer<typeof insertBandeDepenseSchema>;
export type BandeDepense = typeof bandeDepensesTable.$inferSelect;

export const insertBandeVenteSchema = createInsertSchema(bandeVentesTable).omit({ id: true });
export type InsertBandeVente = z.infer<typeof insertBandeVenteSchema>;
export type BandeVente = typeof bandeVentesTable.$inferSelect;

export const insertChargesFixeSchema = createInsertSchema(chargesFixesTable).omit({ id: true });
export type InsertChargesFixe = z.infer<typeof insertChargesFixeSchema>;
export type ChargesFixe = typeof chargesFixesTable.$inferSelect;

export const insertDepenseVenteSchema = createInsertSchema(depensesVenteTable).omit({ id: true });
export type InsertDepenseVente = z.infer<typeof insertDepenseVenteSchema>;
export type DepenseVente = typeof depensesVenteTable.$inferSelect;

export const mortaliteJournaliereTable = pgTable("mortalite_journaliere", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  ageJours: integer("age_jours").notNull(),
  decesJour: integer("deces_jour").notNull().default(0),
  clientMutationId: uuid("client_mutation_id").unique(),
});

export const peseesTable = pgTable("pesees", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  ageJours: integer("age_jours").notNull(),
  poidsMoyenG: numeric("poids_moyen_g", { precision: 10, scale: 2 }).notNull(),
  objectifPoidsG: numeric("objectif_poids_g", { precision: 10, scale: 2 }),
  clientMutationId: uuid("client_mutation_id").unique(),
});

export const consommationAlimentTable = pgTable("consommation_aliment", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  quantiteKg: numeric("quantite_kg", { precision: 10, scale: 2 }).notNull(),
});

export const vaccinationsTable = pgTable("vaccinations", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  jourPrevu: integer("jour_prevu").notNull(),
  nom: text("nom").notNull(),
  description: text("description"),
  fait: text("fait").notNull().default("non"),
  dateFait: date("date_fait"),
  commentaire: text("commentaire"),
  clientMutationId: uuid("client_mutation_id").unique(),
});

export const insertMortaliteSchema = createInsertSchema(mortaliteJournaliereTable).omit({ id: true });
export type InsertMortalite = z.infer<typeof insertMortaliteSchema>;
export type Mortalite = typeof mortaliteJournaliereTable.$inferSelect;

export const insertPeseeSchema = createInsertSchema(peseesTable).omit({ id: true });
export type InsertPesee = z.infer<typeof insertPeseeSchema>;
export type Pesee = typeof peseesTable.$inferSelect;

export const insertConsommationSchema = createInsertSchema(consommationAlimentTable).omit({ id: true });
export type InsertConsommation = z.infer<typeof insertConsommationSchema>;
export type Consommation = typeof consommationAlimentTable.$inferSelect;

export const insertVaccinationSchema = createInsertSchema(vaccinationsTable).omit({ id: true });
export type InsertVaccination = z.infer<typeof insertVaccinationSchema>;
export type Vaccination = typeof vaccinationsTable.$inferSelect;

export const consommationEauTable = pgTable("consommation_eau", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  ageJours: integer("age_jours").notNull(),
  quantiteLitres: numeric("quantite_litres", { precision: 10, scale: 2 }).notNull(),
  clientMutationId: uuid("client_mutation_id").unique(),
});

export const traitementsTable = pgTable("traitements", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  ageJours: integer("age_jours").notNull(),
  produit: text("produit").notNull(),
  type: text("type").notNull().default("traitement"),
  dosage: text("dosage"),
  observations: text("observations"),
  clientMutationId: uuid("client_mutation_id").unique(),
});

export const observationsJournalTable = pgTable("observations_journal", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  ageJours: integer("age_jours").notNull(),
  contenu: text("contenu").notNull(),
  clientMutationId: uuid("client_mutation_id").unique(),
});

export const insertConsommationEauSchema = createInsertSchema(consommationEauTable).omit({ id: true });
export type InsertConsommationEau = z.infer<typeof insertConsommationEauSchema>;
export type ConsommationEau = typeof consommationEauTable.$inferSelect;

export const insertTraitementSchema = createInsertSchema(traitementsTable).omit({ id: true });
export type InsertTraitement = z.infer<typeof insertTraitementSchema>;
export type Traitement = typeof traitementsTable.$inferSelect;

export const insertObservationSchema = createInsertSchema(observationsJournalTable).omit({ id: true });
export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observationsJournalTable.$inferSelect;
