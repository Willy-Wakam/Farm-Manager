import { isOnline, isApiAvailable } from "./network";
import {
  getPendingOperations,
  markAsSyncing,
  markAsError,
  removeFromOutbox,
  resetInterruptedOperations,
  recoverRetryableOperations,
  getOutboxOperation,
} from "./outbox";


let syncInProgress = false;

export async function syncOutbox() {
  if (!isOnline()) {
    console.log("[sync] Hors ligne — synchronisation annulée.");
    return;
    }

    const apiAvailable = await isApiAvailable();

    if (!apiAvailable) {
    console.log(
        "[sync] Réseau disponible mais API inaccessible — synchronisation reportée.",
    );
    return;
}

  if (syncInProgress) {
    console.log("[sync] Synchronisation déjà en cours.");
    return;
  }

  syncInProgress = true;

  try {
    await resetInterruptedOperations();
    const recoveredCount = await recoverRetryableOperations();

    if (recoveredCount > 0) {
        console.log(
            `[sync] ${recoveredCount} opération(s) récupérée(s) pour une nouvelle tentative.`,
        );
    }

    const operations = await getPendingOperations();

    console.log(
      `[sync] ${operations.length} opération(s) à synchroniser.`,
    );

    for (const operation of operations) {
      try {
        await markAsSyncing(operation.id);

        await sendOperationToServer(operation);

        await removeFromOutbox(operation.id);

        console.log(
          `[sync] Opération ${operation.id} synchronisée.`,
        );
      } catch (error) {
            console.error(
                `[sync] Échec de l'opération ${operation.id}`,
                error,
            );

            await markAsError(operation.id);

            const failedOperation =
                await getOutboxOperation(operation.id);

            console.log(
                "[sync] État après échec:",
                failedOperation,
            );

            break;
        }
    }
  } finally {
    syncInProgress = false;
  }
}

async function syncObservation(
  operation: {
    entity: string;
    operation: "CREATE" | "UPDATE" | "DELETE";
    entityId: string;
    payload: unknown;
  },
) {
  const payload = operation.payload as {
    bandeId: number;
    data?: Record<string, unknown>;
  };

  if (operation.operation === "CREATE") {
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
          clientMutationId: operation.entityId,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Erreur synchronisation observation CREATE: HTTP ${response.status}`,
      );
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
      throw new Error(
        `Erreur synchronisation observation DELETE: HTTP ${response.status}`,
      );
    }

    return response.json();
  }

  throw new Error(
    `Opération observation non supportée: ${operation.operation}`,
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

    default:
      throw new Error(
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
      throw new Error(
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
    body:
      method !== "DELETE"
        ? JSON.stringify(operation.payload)
        : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Erreur HTTP ${response.status}: ${response.statusText}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}