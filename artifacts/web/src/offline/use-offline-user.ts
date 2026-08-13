import { useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";

import { getOfflineUser } from "./auth";
import type { OfflineUser } from "./db";
import { useAppNetworkStatus } from "./network-provider";

export function useOfflineUser() {
  const { status } = useAppNetworkStatus();

  const {
    data: serverUser,
    isLoading: isServerUserLoading,
  } = useGetMe();

  const [offlineUser, setOfflineUser] =
    useState<OfflineUser | null>(null);

  const [isOfflineUserLoading, setIsOfflineUserLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadOfflineUser() {
      setIsOfflineUserLoading(true);

      try {
        const user = await getOfflineUser();

        if (!cancelled) {
          setOfflineUser(user ?? null);
        }
      } finally {
        if (!cancelled) {
          setIsOfflineUserLoading(false);
        }
      }
    }

    void loadOfflineUser();

    return () => {
      cancelled = true;
    };
  }, [status]);

  /*
   * Quand l'API est disponible, le serveur reste
   * la source de vérité.
   *
   * Sinon, on utilise le dernier utilisateur
   * authentifié sauvegardé dans IndexedDB.
   */
  const user =
    status === "online"
      ? serverUser ?? null
      : offlineUser;

  const isOfflineSession =
    status !== "online" && Boolean(offlineUser);

  const isLoading =
    status === "online"
      ? isServerUserLoading
      : isOfflineUserLoading;

  return {
    user,
    serverUser,
    offlineUser,

    isLoading,

    isOfflineSession,
  };
}