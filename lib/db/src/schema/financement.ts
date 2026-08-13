import { pgTable, serial, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financementTable = pgTable("financement", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  montant: numeric("montant", { precision: 15, scale: 2 }).notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const remboursementsTable = pgTable("remboursements", {
  id: serial("id").primaryKey(),
  investisseurNom: text("investisseur_nom").notNull(),
  montant: numeric("montant", { precision: 15, scale: 2 }).notNull(),
  date: date("date").notNull(),
  commentaire: text("commentaire"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFinancementSchema = createInsertSchema(financementTable).omit({ id: true, createdAt: true });
export type InsertFinancement = z.infer<typeof insertFinancementSchema>;
export type Financement = typeof financementTable.$inferSelect;

export const insertRemboursementSchema = createInsertSchema(remboursementsTable).omit({ id: true, createdAt: true });
export type InsertRemboursement = z.infer<typeof insertRemboursementSchema>;
export type Remboursement = typeof remboursementsTable.$inferSelect;
