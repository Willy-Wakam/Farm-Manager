import { pgTable, serial, integer, numeric, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chantiersTable = pgTable("chantiers", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  description: text("description"),
  statut: text("statut").notNull().default("en_cours"),
  dateDebut: date("date_debut"),
  dateCloture: date("date_cloture"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chantierLotsTable = pgTable("chantier_lots", {
  id: serial("id").primaryKey(),
  chantierId: integer("chantier_id").notNull().references(() => chantiersTable.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  description: text("description"),
  ordre: integer("ordre").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chantierDevisLignesTable = pgTable("chantier_devis_lignes", {
  id: serial("id").primaryKey(),
  chantierId: integer("chantier_id").notNull().references(() => chantiersTable.id, { onDelete: "cascade" }),
  lotId: integer("lot_id").references(() => chantierLotsTable.id, { onDelete: "set null" }),
  poste: text("poste").notNull(),
  montantPrevu: numeric("montant_prevu", { precision: 15, scale: 2 }).notNull().default("0"),
  ordre: integer("ordre").notNull().default(0),
});

export const chantierDepensesTable = pgTable("chantier_depenses", {
  id: serial("id").primaryKey(),
  chantierId: integer("chantier_id").notNull().references(() => chantiersTable.id, { onDelete: "cascade" }),
  lotId: integer("lot_id").references(() => chantierLotsTable.id, { onDelete: "set null" }),
  designation: text("designation").notNull(),
  quantite: numeric("quantite", { precision: 15, scale: 2 }).notNull().default("1"),
  prixUnitaire: numeric("prix_unitaire", { precision: 15, scale: 2 }).notNull().default("0"),
  categorie: text("categorie").default("materiaux"),
  date: date("date"),
  commentaire: text("commentaire"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChantierSchema = createInsertSchema(chantiersTable).omit({ id: true, createdAt: true });
export type InsertChantier = z.infer<typeof insertChantierSchema>;
export type Chantier = typeof chantiersTable.$inferSelect;

export const insertChantierLotSchema = createInsertSchema(chantierLotsTable).omit({ id: true, createdAt: true });
export type InsertChantierLot = z.infer<typeof insertChantierLotSchema>;
export type ChantierLot = typeof chantierLotsTable.$inferSelect;

export const insertChantierDevisLigneSchema = createInsertSchema(chantierDevisLignesTable).omit({ id: true });
export type InsertChantierDevisLigne = z.infer<typeof insertChantierDevisLigneSchema>;
export type ChantierDevisLigne = typeof chantierDevisLignesTable.$inferSelect;

export const insertChantierDepenseSchema = createInsertSchema(chantierDepensesTable).omit({ id: true, createdAt: true });
export type InsertChantierDepense = z.infer<typeof insertChantierDepenseSchema>;
export type ChantierDepense = typeof chantierDepensesTable.$inferSelect;
