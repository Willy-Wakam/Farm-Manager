import { offlineDb, type OfflineUser } from "./db";

export async function saveOfflineUser(
  user: Omit<OfflineUser, "lastAuthenticatedAt">,
) {
  const offlineUser: OfflineUser = {
    ...user,
    lastAuthenticatedAt: new Date().toISOString(),
  };

  await offlineDb.auth.put(offlineUser);

  const users = await offlineDb.auth.toArray();

  console.log(
    "[offline-auth] Après sauvegarde, contenu réel de auth:",
    users,
  );
}

export async function getOfflineUser() {
  return offlineDb.auth.toCollection().first();
}

export async function clearOfflineUser() {
  await offlineDb.auth.clear();
}