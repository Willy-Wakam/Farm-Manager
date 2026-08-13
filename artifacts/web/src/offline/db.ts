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

const offlineDataTableNames = [
  "outbox",
  "queryCache",
  "bandes",
  "depenses",
  "stocks",
  "financements",
] as const;

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

async function hasLegacyOfflineData() {
  const counts = await Promise.all(
    offlineDataTableNames.map((tableName) =>
      offlineDb.table(tableName).count(),
    ),
  );

  return counts.some((count) => count > 0);
}

export async function clearOfflineBrowserScope() {
  const scopedTables = [
    offlineDb.auth,
    offlineDb.outbox,
    offlineDb.queryCache,
    offlineDb.bandes,
    offlineDb.depenses,
    offlineDb.stocks,
    offlineDb.financements,
  ];

  await offlineDb.transaction(
    "rw",
    scopedTables,
    async () => {
      await Promise.all([
        offlineDb.auth.clear(),
        offlineDb.outbox.clear(),
        offlineDb.queryCache.clear(),
        offlineDb.bandes.clear(),
        offlineDb.depenses.clear(),
        offlineDb.stocks.clear(),
        offlineDb.financements.clear(),
      ]);
    },
  );
}

export async function prepareOfflineStorageForUser(userId: number) {
  const existingUser = await offlineDb.auth.toCollection().first();

  if (existingUser && existingUser.id !== userId) {
    await clearOfflineBrowserScope();
    return true;
  }

  if (!existingUser && (await hasLegacyOfflineData())) {
    await clearOfflineBrowserScope();
    return true;
  }

  return false;
}

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
