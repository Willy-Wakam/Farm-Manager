import { pgTable, serial, numeric, date, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sortiesArgentTable = pgTable("sorties_argent", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  decaisse: numeric("decaisse", { precision: 15, scale: 2 }).notNull(),
  depense: numeric("depense", { precision: 15, scale: 2 }).notNull(),
  commentaire: text("commentaire"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sortiesCarburantTable = pgTable("sorties_carburant", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  montant: numeric("montant", { precision: 15, scale: 2 }).notNull(),
  commentaire: text("commentaire"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const depensesBatimentTable = pgTable("depenses_batiment", {
  id: serial("id").primaryKey(),

  clientMutationId: uuid("clientMutationId").unique(),

  designation: text("designation").notNull(),
  quantite: numeric("quantite", {
    precision: 15,
    scale: 2,
  }).notNull(),
  prixUnitaire: numeric("prix_unitaire", {
    precision: 15,
    scale: 2,
  }).notNull(),
  categorie: text("categorie").default("materiaux"),
  date: date("date"),
  commentaire: text("commentaire"),
});

export const depensesPuitsTable = pgTable("depenses_puits", {
  id: serial("id").primaryKey(),
  clientMutationId: uuid("client_mutation_id").unique(),
  designation: text("designation").notNull(),
  quantite: numeric("quantite", { precision: 15, scale: 2 }).notNull(),
  prixUnitaire: numeric("prix_unitaire", { precision: 15, scale: 2 }).notNull(),
  categorie: text("categorie").default("materiaux"),
  date: date("date"),
  commentaire: text("commentaire"),
});

export const insertSortieArgentSchema = createInsertSchema(sortiesArgentTable).omit({ id: true, createdAt: true });
export type InsertSortieArgent = z.infer<typeof insertSortieArgentSchema>;
export type SortieArgent = typeof sortiesArgentTable.$inferSelect;

export const insertSortieCarburantSchema = createInsertSchema(sortiesCarburantTable).omit({ id: true, createdAt: true });
export type InsertSortieCarburant = z.infer<typeof insertSortieCarburantSchema>;
export type SortieCarburant = typeof sortiesCarburantTable.$inferSelect;

export const insertDepenseBatimentSchema = createInsertSchema(depensesBatimentTable).omit({ id: true });
export type InsertDepenseBatiment = z.infer<typeof insertDepenseBatimentSchema>;
export type DepenseBatiment = typeof depensesBatimentTable.$inferSelect;

export const insertDepensePuitsSchema = createInsertSchema(depensesPuitsTable).omit({ id: true });
export type InsertDepensePuits = z.infer<typeof insertDepensePuitsSchema>;
export type DepensePuits = typeof depensesPuitsTable.$inferSelect;
