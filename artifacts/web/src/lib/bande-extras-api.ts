import {
  getGetBandeMortaliteQueryKey,
  getGetBandePeseesQueryKey,
  getGetBandeVaccinationsQueryKey,
} from "@workspace/api-client-react";
import {
  addToOutbox,
  buildOfflineCreatePayload,
  removePendingCreateByEntityId,
} from "@/offline/outbox";
import { useAppNetworkStatus } from "@/offline/network-provider";
import {
  OUTBOX_OPERATION_SYNCED_EVENT,
  type OutboxOperationSyncedDetail,
} from "@/offline/sync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const BASE = `${import.meta.env.BASE_URL}api/bandes`;
type QueryKey = readonly unknown[];
type ProductionEntity =
  | "mortalite"
  | "pesee"
  | "consommation-eau"
  | "traitement"
  | "vaccination";

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function appendToListCache(
  qc: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
  item: unknown,
) {
  qc.setQueryData(queryKey, (current: any) => {
    if (Array.isArray(current)) {
      return [...current, item];
    }

    if (current && Array.isArray(current.data)) {
      return {
        ...current,
        data: [...current.data, item],
      };
    }

    return current == null ? [item] : current;
  });
}

function removeFromListCache(
  qc: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
  itemId: number | string,
) {
  qc.setQueryData(queryKey, (current: any) => {
    const remove = (items: any[]) =>
      items.filter((item) => String(item.id) !== String(itemId));

    if (Array.isArray(current)) {
      return remove(current);
    }

    if (current && Array.isArray(current.data)) {
      return {
        ...current,
        data: remove(current.data),
      };
    }

    return current;
  });
}

function replaceInListCache(
  qc: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
  localId: string,
  serverItem: unknown,
) {
  qc.setQueryData(queryKey, (current: any) => {
    const replace = (items: any[]) =>
      items.map((item) =>
        String(item.id) === String(localId) ? serverItem : item,
      );

    if (Array.isArray(current)) {
      return replace(current);
    }

    if (current && Array.isArray(current.data)) {
      return {
        ...current,
        data: replace(current.data),
      };
    }

    return current;
  });
}

function useOutboxCreateReconciliation(
  entity: ProductionEntity | "observation",
  bandeId: number,
  queryKey: QueryKey,
) {
  const qc = useQueryClient();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OutboxOperationSyncedDetail>).detail;

      if (detail.entity !== entity || detail.operation !== "CREATE") {
        return;
      }

      const payload = detail.payload as { bandeId?: number };

      if (payload.bandeId !== bandeId) {
        return;
      }

      replaceInListCache(qc, queryKey, detail.entityId, detail.serverResult);
      void qc.invalidateQueries({ queryKey });
    };

    window.addEventListener(OUTBOX_OPERATION_SYNCED_EVENT, handler);

    return () => {
      window.removeEventListener(OUTBOX_OPERATION_SYNCED_EVENT, handler);
    };
  }, [bandeId, entity, qc, queryKey]);
}

async function createProductionEntry(options: {
  status: string;
  qc: ReturnType<typeof useQueryClient>;
  bandeId: number;
  queryKey: QueryKey;
  entity: ProductionEntity;
  path: string;
  data: Record<string, unknown>;
  optimisticExtra?: Record<string, unknown>;
}) {
  const { status, qc, bandeId, queryKey, entity, path, data, optimisticExtra } =
    options;

  if (status === "online") {
    return fetchJson(`${BASE}/${bandeId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  const offlineCreate = buildOfflineCreatePayload(bandeId, data);
  const localItem = {
    ...offlineCreate.data,
    ...optimisticExtra,
    id: offlineCreate.localEntityId,
    _offline: true,
    _pendingSync: true,
  };

  await addToOutbox({
    entity,
    operation: "CREATE",
    entityId: offlineCreate.localEntityId,
    payload: offlineCreate,
  });

  appendToListCache(qc, queryKey, localItem);

  return localItem;
}

async function deleteProductionEntry(options: {
  status: string;
  qc: ReturnType<typeof useQueryClient>;
  bandeId: number;
  queryKey: QueryKey;
  entity: ProductionEntity;
  path: string;
  entityId: number | string;
}) {
  const { status, qc, bandeId, queryKey, entity, path, entityId } = options;

  if (typeof entityId === "string") {
    const cancelled = await removePendingCreateByEntityId(entity, entityId);

    if (!cancelled) {
      throw new Error(`CREATE local introuvable pour ${entityId}`);
    }

    removeFromListCache(qc, queryKey, entityId);

    return {
      success: true,
      cancelledLocalCreate: true,
    };
  }

  if (status === "online") {
    const result = await fetchJson(`${BASE}/${bandeId}/${path}/${entityId}`, {
      method: "DELETE",
    });

    removeFromListCache(qc, queryKey, entityId);

    return result;
  }

  await addToOutbox({
    entity,
    operation: "DELETE",
    entityId: String(entityId),
    payload: { bandeId },
  });

  removeFromListCache(qc, queryKey, entityId);

  return {
    success: true,
    pendingSync: true,
  };
}

export function useCreateBandeMortaliteOffline() {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();

  return useMutation({
    networkMode: "always",
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      createProductionEntry({
        status,
        qc,
        bandeId: id,
        queryKey: getGetBandeMortaliteQueryKey(id),
        entity: "mortalite",
        path: "mortalite",
        data,
        optimisticExtra: {
          decesCumules: data.decesJour ?? 0,
          tauxMortalite: 0,
          alerteRouge: false,
        },
      }),
    onSuccess: (_result, variables) => {
      if (status === "online") {
        void qc.invalidateQueries({
          queryKey: getGetBandeMortaliteQueryKey(variables.id),
        });
      }
    },
  });
}

export function useDeleteBandeMortaliteOffline() {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();

  return useMutation({
    networkMode: "always",
    mutationFn: ({
      id,
      mortaliteId,
    }: {
      id: number;
      mortaliteId: number | string;
    }) =>
      deleteProductionEntry({
        status,
        qc,
        bandeId: id,
        queryKey: getGetBandeMortaliteQueryKey(id),
        entity: "mortalite",
        path: "mortalite",
        entityId: mortaliteId,
      }),
  });
}

export function useBandeMortaliteOffline(bandeId: number) {
  const queryKey = getGetBandeMortaliteQueryKey(bandeId);

  useOutboxCreateReconciliation("mortalite", bandeId, queryKey);

  return useQuery({
    queryKey,
    queryFn: () => fetchJson(`${BASE}/${bandeId}/mortalite`),
  });
}

export function useConsommationEau(bandeId: number) {
  useOutboxCreateReconciliation(
    "consommation-eau",
    bandeId,
    getConsommationEauQueryKey(bandeId),
  );

  return useQuery({
    queryKey: getConsommationEauQueryKey(bandeId),
    queryFn: () => fetchConsommationEau(bandeId),
  });
}

export function useCreateConsommationEau(bandeId: number) {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();
  const queryKey = getConsommationEauQueryKey(bandeId);

  return useMutation({
    networkMode: "always",
    mutationFn: (data: Record<string, unknown>) =>
      createProductionEntry({
        status,
        qc,
        bandeId,
        queryKey,
        entity: "consommation-eau",
        path: "consommation-eau",
        data,
      }),
    onSuccess: () => {
      if (status === "online") {
        void qc.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useDeleteConsommationEau(bandeId: number) {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();
  const queryKey = getConsommationEauQueryKey(bandeId);

  return useMutation({
    networkMode: "always",
    mutationFn: (eauId: number | string) =>
      deleteProductionEntry({
        status,
        qc,
        bandeId,
        queryKey,
        entity: "consommation-eau",
        path: "consommation-eau",
        entityId: eauId,
      }),
  });
}

export function useCreateBandePeseeOffline() {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();

  return useMutation({
    networkMode: "always",
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      createProductionEntry({
        status,
        qc,
        bandeId: id,
        queryKey: getGetBandePeseesQueryKey(id),
        entity: "pesee",
        path: "pesees",
        data,
        optimisticExtra: {
          ecart:
            typeof data.objectifPoidsG === "number" &&
            typeof data.poidsMoyenG === "number"
              ? data.poidsMoyenG - data.objectifPoidsG
              : null,
          alertePoids: false,
        },
      }),
    onSuccess: (_result, variables) => {
      if (status === "online") {
        void qc.invalidateQueries({
          queryKey: getGetBandePeseesQueryKey(variables.id),
        });
      }
    },
  });
}

export function useDeleteBandePeseeOffline() {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();

  return useMutation({
    networkMode: "always",
    mutationFn: ({
      id,
      peseeId,
    }: {
      id: number;
      peseeId: number | string;
    }) =>
      deleteProductionEntry({
        status,
        qc,
        bandeId: id,
        queryKey: getGetBandePeseesQueryKey(id),
        entity: "pesee",
        path: "pesees",
        entityId: peseeId,
      }),
  });
}

export function useBandePeseesOffline(bandeId: number) {
  const queryKey = getGetBandePeseesQueryKey(bandeId);

  useOutboxCreateReconciliation("pesee", bandeId, queryKey);

  return useQuery({
    queryKey,
    queryFn: () => fetchJson(`${BASE}/${bandeId}/pesees`),
  });
}

export function useCreateBandeVaccinationOffline() {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();

  return useMutation({
    networkMode: "always",
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      createProductionEntry({
        status,
        qc,
        bandeId: id,
        queryKey: getGetBandeVaccinationsQueryKey(id),
        entity: "vaccination",
        path: "vaccinations",
        data,
        optimisticExtra: {
          fait: "non",
          dateFait: null,
          commentaire: null,
          datePrevue: "",
          enRetard: false,
        },
      }),
    onSuccess: (_result, variables) => {
      if (status === "online") {
        void qc.invalidateQueries({
          queryKey: getGetBandeVaccinationsQueryKey(variables.id),
        });
      }
    },
  });
}

export function useDeleteBandeVaccinationOffline() {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();

  return useMutation({
    networkMode: "always",
    mutationFn: ({
      id,
      vaccId,
    }: {
      id: number;
      vaccId: number | string;
    }) =>
      deleteProductionEntry({
        status,
        qc,
        bandeId: id,
        queryKey: getGetBandeVaccinationsQueryKey(id),
        entity: "vaccination",
        path: "vaccinations",
        entityId: vaccId,
      }),
  });
}

export function useBandeVaccinationsOffline(bandeId: number) {
  const queryKey = getGetBandeVaccinationsQueryKey(bandeId);

  useOutboxCreateReconciliation("vaccination", bandeId, queryKey);

  return useQuery({
    queryKey,
    queryFn: () => fetchJson(`${BASE}/${bandeId}/vaccinations`),
  });
}

export function useTraitements(bandeId: number) {
  useOutboxCreateReconciliation(
    "traitement",
    bandeId,
    getTraitementsQueryKey(bandeId),
  );

  return useQuery({
    queryKey: getTraitementsQueryKey(bandeId),
    queryFn: () => fetchTraitements(bandeId),
  });
}

export function useCreateTraitement(bandeId: number) {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();
  const queryKey = getTraitementsQueryKey(bandeId);

  return useMutation({
    networkMode: "always",
    mutationFn: (data: Record<string, unknown>) =>
      createProductionEntry({
        status,
        qc,
        bandeId,
        queryKey,
        entity: "traitement",
        path: "traitements",
        data,
      }),
    onSuccess: () => {
      if (status === "online") {
        void qc.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useDeleteTraitement(bandeId: number) {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();
  const queryKey = getTraitementsQueryKey(bandeId);

  return useMutation({
    networkMode: "always",
    mutationFn: (traitId: number | string) =>
      deleteProductionEntry({
        status,
        qc,
        bandeId,
        queryKey,
        entity: "traitement",
        path: "traitements",
        entityId: traitId,
      }),
  });
}

export function useObservations(bandeId: number) {
  useOutboxCreateReconciliation(
    "observation",
    bandeId,
    getObservationsQueryKey(bandeId),
  );

  return useQuery({
    queryKey: getObservationsQueryKey(bandeId),
    queryFn: () => fetchObservations(bandeId),
  });
}

export function useCreateObservation(bandeId: number) {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();

  return useMutation({
    networkMode: "always",
    mutationFn: async (data: any) => {
      // Online : comportement normal actuel
      if (status === "online") {
        return fetchJson(
          `${BASE}/${bandeId}/observations`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          },
        );
      }

      // Offline / serveur inaccessible
      const offlineCreate = buildOfflineCreatePayload(bandeId, data);
      const localId = offlineCreate.localEntityId;

      const localObservation = {
        ...offlineCreate.data,
        id: localId,
        _offline: true,
        _pendingSync: true,
      };

      await addToOutbox({
        entity: "observation",
        operation: "CREATE",
        entityId: localId,
        payload: offlineCreate,
      });

      // Affichage immédiat dans l'interface
qc.setQueryData(
  getObservationsQueryKey(bandeId),
  (current: any) => {
    // Cas normal : l'API retourne directement un tableau
    if (Array.isArray(current)) {
      return [
        ...current,
        localObservation,
      ];
    }

    // Cas où l'API retourne { data: [...] }
    if (
      current &&
      Array.isArray(current.data)
    ) {
      return {
        ...current,
        data: [
          ...current.data,
          localObservation,
        ],
      };
    }

    // Aucun cache encore disponible
    if (current == null) {
      return [localObservation];
    }

    console.warn(
      "[observation] format de cache inattendu:",
      current,
    );

    return current;
  },
);

      return localObservation;
    },

    onSuccess: () => {
      // Ne surtout pas invalider offline :
      // cela tenterait de récupérer immédiatement l'API.
      if (status === "online") {
        void qc.invalidateQueries({
          queryKey: getObservationsQueryKey(bandeId),
        });
      }
    },
  });
}

function removeObservationFromCache(
  qc: ReturnType<typeof useQueryClient>,
  bandeId: number,
  obsId: number | string,
) {
  qc.setQueryData(
    getObservationsQueryKey(bandeId),
    (current: any) => {
      if (Array.isArray(current)) {
        return current.filter(
          (observation) =>
            String(observation.id) !== String(obsId),
        );
      }

      if (
        current &&
        Array.isArray(current.data)
      ) {
        return {
          ...current,
          data: current.data.filter(
            (observation: any) =>
              String(observation.id) !== String(obsId),
          ),
        };
      }

      return current;
    },
  );
}

export function useDeleteObservation(bandeId: number) {
  const qc = useQueryClient();
  const { status } = useAppNetworkStatus();

  return useMutation({
    networkMode: "always",

    mutationFn: async (obsId: number | string) => {
      /*
       * Cas 1 :
       * observation créée localement et pas encore synchronisée.
       *
       * Son UUID est l'entityId de l'opération CREATE
       * dans l'Outbox; l'id de l'opération reste distinct.
       */
if (typeof obsId === "string") {
  const cancelled =
    await removePendingCreateByEntityId(
      "observation",
      obsId,
    );

  if (!cancelled) {
    throw new Error(
      `CREATE local introuvable pour ${obsId}`,
    );
  }

  removeObservationFromCache(
    qc,
    bandeId,
    obsId,
  );

  return {
    success: true,
    cancelledLocalCreate: true,
  };
}

      /*
       * Cas 2 :
       * observation déjà connue du serveur.
       */
      if (status === "online") {
        const result = await fetchJson(
          `${BASE}/${bandeId}/observations/${obsId}`,
          {
            method: "DELETE",
          },
        );

        removeObservationFromCache(
          qc,
          bandeId,
          obsId,
        );

        return result;
      }

      /*
       * Offline :
       * placer le DELETE dans l'Outbox.
       */
      await addToOutbox({
        entity: "observation",
        operation: "DELETE",
        entityId: String(obsId),
        payload: {
          bandeId,
        },
      });

      removeObservationFromCache(
        qc,
        bandeId,
        obsId,
      );

      return {
        success: true,
        pendingSync: true,
      };
    },

    onSuccess: () => {
      if (status === "online") {
        void qc.invalidateQueries({
          queryKey: getObservationsQueryKey(bandeId),
        });
      }
    },
  });
}

export function useReferencePoids() {
  return useQuery({
    queryKey: getReferencePoidsQueryKey(),
    queryFn: fetchReferencePoids,
  });
}

export const getConsommationEauQueryKey = (bandeId: number) =>
  ["consommation-eau", bandeId] as const;

export const fetchConsommationEau = (bandeId: number) =>
  fetchJson(`${BASE}/${bandeId}/consommation-eau`);


export const getTraitementsQueryKey = (bandeId: number) =>
  ["traitements", bandeId] as const;

export const fetchTraitements = (bandeId: number) =>
  fetchJson(`${BASE}/${bandeId}/traitements`);


export const getObservationsQueryKey = (bandeId: number) =>
  ["observations", bandeId] as const;

export const fetchObservations = (bandeId: number) =>
  fetchJson(`${BASE}/${bandeId}/observations`);


export const getReferencePoidsQueryKey = () =>
  ["reference-poids"] as const;

export const fetchReferencePoids = () =>
  fetchJson(`${BASE}/reference-poids`);
