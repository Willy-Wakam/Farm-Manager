import { useCallback, useEffect, useState } from "react";

export type NetworkStatus =
  | "online"
  | "offline"
  | "server-unavailable";

/**
 * Indicates whether the browser has a network connection.
 *
 * Attention:
 * navigator.onLine === true does NOT mean that the Farm Manager API
 * is reachable.
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Checks whether the Farm Manager API is reachable.
 */
export async function isApiAvailable(): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, 3000);

  try {
    const response = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Determines the real connectivity state of Farm Manager.
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  if (!navigator.onLine) {
    return "offline";
  }

  const apiAvailable = await isApiAvailable();

  return apiAvailable
    ? "online"
    : "server-unavailable";
}

/**
 * React hook that monitors both:
 *
 * - browser connectivity
 * - Farm Manager API availability
 */
export function useNetworkStatus() {
  const [status, setStatus] =
    useState<NetworkStatus>(
      navigator.onLine ? "server-unavailable" : "offline",
    );

  const checkStatus = useCallback(async () => {
    const newStatus = await getNetworkStatus();

    setStatus(newStatus);

    return newStatus;
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      setStatus("offline");
    };

    const handleOnline = () => {
      void checkStatus();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Vérification au démarrage
    void checkStatus();

    // Important:
    // permet de détecter le retour du backend sans changement
    // de navigator.onLine.
    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        void checkStatus();
      }
    }, 2000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      window.clearInterval(interval);
    };
  }, [checkStatus]);

  return {
    status,

    isOnline: status === "online",

    isOffline: status === "offline",

    isServerUnavailable:
      status === "server-unavailable",

    checkStatus,
  };
}