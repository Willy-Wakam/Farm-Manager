// artifacts/web/src/offline/db.ts

import Dexie, { type Table } from "dexie";
console.log("🚨 DB BUILD VERSION: v3-queryCache");

export interface PendingOperation {
  id: string;
  entity: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  entityId: string;
  payload: unknown;
  createdAt: string;
  retryCount: number;
  status: "pending" | "syncing" | "error";
}

export interface OfflineUser {
  id: number;
  username: string;
  role: string;
  nom: string;
  lastAuthenticatedAt: string;
}

export interface QueryCacheEntry {
  key: string;
  value: string;
}

export interface OfflineEntity {
  id: string;
  updatedAt?: string;
}

class FarmManagerDB extends Dexie {
  outbox!: Table<PendingOperation, string>;

  queryCache!: Table<QueryCacheEntry>;
  bandes!: Table<OfflineEntity, string>;
  depenses!: Table<OfflineEntity, string>;
  stocks!: Table<OfflineEntity, string>;
  financements!: Table<OfflineEntity, string>;
  auth!: Table<OfflineUser>;

  constructor() {
    super("farm-manager");

    this.version(1).stores({
      outbox: "id, entity, entityId, status, createdAt",
      bandes: "id, updatedAt",
      depenses: "id, updatedAt",
      stocks: "id, updatedAt",
      financements: "id, updatedAt",
    });

    this.version(2).stores({
      outbox: "id, entity, entityId, status, createdAt",
      bandes: "id, updatedAt",
      depenses: "id, updatedAt",
      stocks: "id, updatedAt",
      financements: "id, updatedAt",

      auth: "id, username",
    });

    this.version(3).stores({
      outbox: "id, entity, entityId, status, createdAt",
      bandes: "id, updatedAt",
      depenses: "id, updatedAt",
      stocks: "id, updatedAt",
      financements: "id, updatedAt",
      auth: "id, username",

      queryCache: "key",
    });
  }
}

export const offlineDb = new FarmManagerDB();

offlineDb
  .open()
  .then(() => {
    console.log("✅ IndexedDB ouverte :", offlineDb.name);
    console.log(
      "Tables IndexedDB:",
      offlineDb.tables.map((table) => table.name),
    );
  })
  .catch((error) => {
    console.error("❌ Erreur IndexedDB :", error);
  });