import { offlineDb } from "./db";

export const queryStorage = {
  async getItem(key: string) {
    const entry = await offlineDb.queryCache.get(key);

    return entry?.value ?? null;
  },

  async setItem(key: string, value: string) {
    await offlineDb.queryCache.put({
      key,
      value,
    });
  },

  async removeItem(key: string) {
    await offlineDb.queryCache.delete(key);
  },
};