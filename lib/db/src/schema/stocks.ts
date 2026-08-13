import { pgTable, serial, text, numeric, date, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const stockAlimentsTable = pgTable("stock_aliments", {
  id: serial("id").primaryKey(),
  designation: text("designation").notNull(),
  type: text("type").notNull().default("entree"),
  quantiteKg: numeric("quantite_kg", { precision: 12, scale: 2 }).notNull(),
  prixUnitaire: numeric("prix_unitaire", { precision: 15, scale: 2 }),
  fournisseur: text("fournisseur"),
  date: date("date").notNull(),
  commentaire: text("commentaire"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockMedicamentsTable = pgTable("stock_medicaments", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  type: text("type").notNull().default("entree"),
  quantite: numeric("quantite", { precision: 12, scale: 2 }).notNull(),
  unite: text("unite").notNull().default("unité"),
  datePeremption: date("date_peremption"),
  fournisseur: text("fournisseur"),
  date: date("date").notNull(),
  commentaire: text("commentaire"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockAlimentSchema = createInsertSchema(stockAlimentsTable).omit({ id: true, createdAt: true });
export type StockAliment = typeof stockAlimentsTable.$inferSelect;

export const insertStockMedicamentSchema = createInsertSchema(stockMedicamentsTable).omit({ id: true, createdAt: true });
export type StockMedicament = typeof stockMedicamentsTable.$inferSelect;
