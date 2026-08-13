import { pgTable, serial, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devisConstructionTable = pgTable("devis_construction", {
  id: serial("id").primaryKey(),
  batimentEstime: numeric("batiment_estime", { precision: 15, scale: 2 }).notNull().default("0"),
  batimentNotes: text("batiment_notes"),
  carburantEstime: numeric("carburant_estime", { precision: 15, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const puitsItemsTable = pgTable("puits_items_devis", {
  id: serial("id").primaryKey(),
  designation: text("designation").notNull(),
  quantite: numeric("quantite", { precision: 15, scale: 2 }).notNull(),
  prixUnitaire: numeric("prix_unitaire", { precision: 15, scale: 2 }).notNull(),
});

export const insertDevisSchema = createInsertSchema(devisConstructionTable).omit({ id: true, updatedAt: true });
export type InsertDevis = z.infer<typeof insertDevisSchema>;
export type DevisConstruction = typeof devisConstructionTable.$inferSelect;

export const insertPuitsItemSchema = createInsertSchema(puitsItemsTable).omit({ id: true });
export type InsertPuitsItem = z.infer<typeof insertPuitsItemSchema>;
export type PuitsItem = typeof puitsItemsTable.$inferSelect;
