import { pgTable, serial, integer, numeric, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bandesTable } from "./bandes";

export const actifsTable = pgTable("actifs", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  type: text("type").notNull(),
  valeur: numeric("valeur", { precision: 15, scale: 2 }).notNull(),
  tauxAmortissementAnnuel: numeric("taux_amortissement_annuel", { precision: 5, scale: 2 }).notNull().default("0"),
  dateAcquisition: date("date_acquisition").notNull(),
  description: text("description"),
  chantierId: integer("chantier_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bandeActifsTable = pgTable("bande_actifs", {
  id: serial("id").primaryKey(),
  bandeId: integer("bande_id").notNull().references(() => bandesTable.id, { onDelete: "cascade" }),
  actifId: integer("actif_id").notNull().references(() => actifsTable.id, { onDelete: "cascade" }),
  fractionUtilisee: numeric("fraction_utilisee", { precision: 5, scale: 4 }).notNull().default("1"),
});

export const insertActifSchema = createInsertSchema(actifsTable).omit({ id: true, createdAt: true });
export type InsertActif = z.infer<typeof insertActifSchema>;
export type Actif = typeof actifsTable.$inferSelect;

export const insertBandeActifSchema = createInsertSchema(bandeActifsTable).omit({ id: true });
export type InsertBandeActif = z.infer<typeof insertBandeActifSchema>;
export type BandeActif = typeof bandeActifsTable.$inferSelect;
