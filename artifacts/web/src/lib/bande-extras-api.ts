import {
  addToOutbox,
  removePendingCreateByEntityId,
} from "@/offline/outbox";
import { useAppNetworkStatus } from "@/offline/network-provider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = `${import.meta.env.BASE_URL}api/bandes`;

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useConsommationEau(bandeId: number) {
  return useQuery({
    queryKey: getConsommationEauQueryKey(bandeId),
    queryFn: () => fetchConsommationEau(bandeId),
  });
}

export function useCreateConsommationEau(bandeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchJson(`${BASE}/${bandeId}/consommation-eau`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consommation-eau", bandeId] }),
  });
}

export function useDeleteConsommationEau(bandeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eauId: number) => fetchJson(`${BASE}/${bandeId}/consommation-eau/${eauId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consommation-eau", bandeId] }),
  });
}

export function useTraitements(bandeId: number) {
  return useQuery({
    queryKey: getTraitementsQueryKey(bandeId),
    queryFn: () => fetchTraitements(bandeId),
  });
}

export function useCreateTraitement(bandeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchJson(`${BASE}/${bandeId}/traitements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["traitements", bandeId] }),
  });
}

export function useDeleteTraitement(bandeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (traitId: number) => fetchJson(`${BASE}/${bandeId}/traitements/${traitId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["traitements", bandeId] }),
  });
}

export function useObservations(bandeId: number) {
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
      const localId = crypto.randomUUID();

      const localObservation = {
        ...data,
        id: localId,
        _offline: true,
        _pendingSync: true,
      };

      await addToOutbox({
        entity: "observation",
        operation: "CREATE",
        entityId: localId,
        payload: {
          bandeId,
          data,
        },
      });

      // Affichage immédiat dans l'interface
qc.setQueryData(
  getObservationsQueryKey(bandeId),
  (current: any) => {
    console.log(
      "[observation] cache actuel:",
      current,
    );

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
       * Son UUID est également l'id de son opération CREATE
       * dans l'Outbox.
       */
if (typeof obsId === "string") {
  console.log(
    "[observation-delete] annulation locale:",
    obsId,
  );

  const cancelled =
    await removePendingCreateByEntityId(
      "observation",
      obsId,
    );

  console.log(
    "[observation-delete] CREATE annulé:",
    cancelled,
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