import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";

import { onlineManager } from "@tanstack/react-query";

import { useNetworkStatus } from "./network";

type NetworkContextValue = ReturnType<typeof useNetworkStatus>;

const NetworkContext =
  createContext<NetworkContextValue | null>(null);

// Tant que /api/health n'a pas confirmé que l'API est disponible,
// TanStack Query reste en pause.
onlineManager.setOnline(false);

export function NetworkProvider({
  children,
}: {
  children: ReactNode;
}) {
  const network = useNetworkStatus();

  useEffect(() => {
    onlineManager.setOnline(network.status === "online");
  }, [network.status]);

  return (
    <NetworkContext.Provider value={network}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useAppNetworkStatus() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error(
      "useAppNetworkStatus must be used inside NetworkProvider",
    );
  }

  return context;
}