import { isOnline, isApiAvailable } from "./network";
import {
  getPendingOperations,
  isOfflineCreatePayload,
  markAsSyncing,
  markAsError,
  markAsFailed,
  removeFromOutbox,
  resetInterruptedOperations,
  recoverRetryableOperations,
} from "./outbox";

type SyncStatus = "offline" | "api-unavailable" | "in-progress" | "completed";

export interface SyncOutboxResult {
  status: SyncStatus;
  successCount: number;
  temporaryErrorCount: number;
  finalErrorCount: number;
  skippedCount: number;
}

export const OUTBOX_OPERATION_SYNCED_EVENT =
  "farm-manager:outbox-operation-synced";

export interface OutboxOperationSyncedDetail {
  entity: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  entityId: string;
  payload: unknown;
  serverResult: unknown;
}

class PermanentSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentSyncError";
  }
}

let syncInProgress = false;

function emptySyncResult(status: SyncStatus): SyncOutboxResult {
  return {
    status,
    successCount: 0,
    temporaryErrorCount: 0,
    finalErrorCount: 0,
    skippedCount: 0,
  };
}

function getOperationKey(operation: { entity: string; entityId: string }) {
  return `${operation.entity}:${operation.entityId}`;
}

function isPermanentSyncError(error: unknown) {
  return error instanceof PermanentSyncError;
}

function isPermanentHttpStatus(status: number) {
  return [400, 404, 409, 422].includes(status);
}

function throwSyncHttpError(response: Response, message: string): never {
  const errorMessage = `${message}: HTTP ${response.status}`;

  if (isPermanentHttpStatus(response.status)) {
    throw new PermanentSyncError(errorMessage);
  }

  throw new Error(errorMessage);
}

const bandeResourcePaths: Record<string, string> = {
  mortalite: "mortalite",
  pesee: "pesees",
  "consommation-eau": "consommation-eau",
  traitement: "traitements",
  vaccination: "vaccinations",
};

function notifyOperationSynced(
  operation: {
    entity: string;
    operation: "CREATE" | "UPDATE" | "DELETE";
    entityId: string;
    payload: unknown;
  },
  serverResult: unknown,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OutboxOperationSyncedDetail>(
      OUTBOX_OPERATION_SYNCED_EVENT,
      {
        detail: {
          entity: operation.entity,
          operation: operation.operation,
          entityId: operation.entityId,
          payload: operation.payload,
          serverResult,
        },
      },
    ),
  );
}

export async function syncOutbox(): Promise<SyncOutboxResult> {
  if (!isOnline()) {
    console.log("[sync] Hors ligne — synchronisation annulée.");
    return emptySyncResult("offline");
  }

  const apiAvailable = await isApiAvailable();

  if (!apiAvailable) {
    console.log(
      "[sync] Réseau disponible mais API inaccessible — synchronisation reportée.",
    );
    return emptySyncResult("api-unavailable");
  }

  if (syncInProgress) {
    console.log("[sync] Synchronisation déjà en cours.");
    return emptySyncResult("in-progress");
  }

  syncInProgress = true;
  const result = emptySyncResult("completed");
  const blockedOperationKeys = new Set<string>();

  try {
    await resetInterruptedOperations();
    const recoveredCount = await recoverRetryableOperations();

    if (recoveredCount > 0) {
      console.log(
        `[sync] ${recoveredCount} opération(s) récupérée(s) pour une nouvelle tentative.`,
      );
    }

    const operations = await getPendingOperations();

    console.log(`[sync] ${operations.length} opération(s) à synchroniser.`);

    for (const operation of operations) {
      const operationKey = getOperationKey(operation);

      if (blockedOperationKeys.has(operationKey)) {
        result.skippedCount += 1;
        continue;
      }

      try {
        await markAsSyncing(operation.id);

        const serverResult = await sendOperationToServer(operation);

        await removeFromOutbox(operation.id);
        notifyOperationSynced(operation, serverResult);
        result.successCount += 1;

        console.log(`[sync] Opération ${operation.id} synchronisée.`);
      } catch (error) {
        console.error(`[sync] Échec de l'opération ${operation.id}`, error);

        const failedOperation = isPermanentSyncError(error)
          ? await markAsFailed(operation.id, error)
          : await markAsError(operation.id, error);

        if (failedOperation?.status === "failed") {
          result.finalErrorCount += 1;
        } else {
          result.temporaryErrorCount += 1;
        }

        blockedOperationKeys.add(operationKey);
      }
    }

    return result;
  } finally {
    syncInProgress = false;
  }
}

async function syncObservation(operation: {
  entity: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  entityId: string;
  payload: unknown;
}) {
  const payload = operation.payload as {
    bandeId: number;
    data?: Record<string, unknown>;
    clientMutationId?: string;
  };

  if (operation.operation === "CREATE") {
    const clientMutationId = isOfflineCreatePayload(operation.payload)
      ? operation.payload.clientMutationId
      : (payload.clientMutationId ?? operation.entityId);

    const response = await fetch(
      `/api/bandes/${payload.bandeId}/observations`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload.data,
          clientMutationId,
        }),
      },
    );

    if (!response.ok) {
      throwSyncHttpError(response, "Erreur synchronisation observation CREATE");
    }

    return response.json();
  }

  if (operation.operation === "DELETE") {
    const response = await fetch(
      `/api/bandes/${payload.bandeId}/observations/${operation.entityId}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    if (!response.ok) {
      throwSyncHttpError(response, "Erreur synchronisation observation DELETE");
    }

    return response.json();
  }

  throw new PermanentSyncError(
    `Opération observation non supportée: ${operation.operation}`,
  );
}

async function syncBandeResource(operation: {
  entity: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  entityId: string;
  payload: unknown;
}) {
  const path = bandeResourcePaths[operation.entity];

  if (!path) {
    throw new PermanentSyncError(
      `Type d'entité non supporté: ${operation.entity}`,
    );
  }

  const payload = operation.payload as {
    bandeId: number;
    data?: Record<string, unknown>;
    clientMutationId?: string;
  };

  if (operation.operation === "CREATE") {
    const clientMutationId = isOfflineCreatePayload(operation.payload)
      ? operation.payload.clientMutationId
      : payload.clientMutationId ?? operation.entityId;

    const response = await fetch(`/api/bandes/${payload.bandeId}/${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload.data,
        clientMutationId,
      }),
    });

    if (!response.ok) {
      throwSyncHttpError(
        response,
        `Erreur synchronisation ${operation.entity} CREATE`,
      );
    }

    return response.json();
  }

  if (operation.operation === "DELETE") {
    const response = await fetch(
      `/api/bandes/${payload.bandeId}/${path}/${operation.entityId}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    if (!response.ok) {
      throwSyncHttpError(
        response,
        `Erreur synchronisation ${operation.entity} DELETE`,
      );
    }

    return response.json();
  }

  throw new PermanentSyncError(
    `Opération ${operation.entity} non supportée: ${operation.operation}`,
  );
}

async function sendOperationToServer(operation: {
  entity: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  entityId: string;
  payload: unknown;
}) {
  switch (operation.entity) {
    case "batiment-item":
      return syncBatimentItem(operation);

    case "observation":
      return syncObservation(operation);

    case "mortalite":
    case "pesee":
    case "consommation-eau":
    case "traitement":
    case "vaccination":
      return syncBandeResource(operation);

    default:
      throw new PermanentSyncError(
        `Type d'entité non supporté: ${operation.entity}`,
      );
  }
}

async function syncBatimentItem(operation: {
  entity: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  entityId: string;
  payload: unknown;
}) {
  let url = "/api/depenses/batiment-items";
  let method: "POST" | "PUT" | "DELETE";

  switch (operation.operation) {
    case "CREATE":
      method = "POST";
      break;

    case "UPDATE":
      method = "PUT";
      url += `/${operation.entityId}`;
      break;

    case "DELETE":
      method = "DELETE";
      url += `/${operation.entityId}`;
      break;

    default:
      throw new PermanentSyncError(
        `Opération non supportée: ${operation.operation}`,
      );
  }

  const response = await fetch(url, {
    method,
    credentials: "include",
    headers:
      method !== "DELETE"
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
    body: method !== "DELETE" ? JSON.stringify(operation.payload) : undefined,
  });

  if (!response.ok) {
    throwSyncHttpError(response, `Erreur HTTP ${response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
