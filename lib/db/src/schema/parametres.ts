import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const parametresTable = pgTable("parametres", {
  id: serial("id").primaryKey(),
  cle: text("cle").notNull().unique(),
  valeur: text("valeur").notNull(),
  description: text("description").notNull(),
  categorie: text("categorie").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Parametre = typeof parametresTable.$inferSelect;
