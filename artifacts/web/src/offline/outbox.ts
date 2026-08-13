import { offlineDb, type PendingOperation } from "./db";
export const MAX_RETRY_COUNT = 3;
/**
 * Add a new operation to the offline synchronization queue.
 */
export async function addToOutbox(
  operation: Omit<PendingOperation, "id" | "createdAt" | "retryCount" | "status">
) {
  const pendingOperation: PendingOperation = {
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
  };

  await offlineDb.outbox.add(pendingOperation);

  return pendingOperation;
}

/**
 * Recover operations that can safely be retried.
 *
 * - "syncing": the application may have been interrupted during sync
 * - "error": retry only while the maximum retry count is not reached
 */
export async function recoverRetryableOperations() {
  const syncingOperations = await offlineDb.outbox
    .where("status")
    .equals("syncing")
    .toArray();

  const failedOperations = await offlineDb.outbox
    .where("status")
    .equals("error")
    .filter((operation) => operation.retryCount < MAX_RETRY_COUNT)
    .toArray();

  const operationsToRecover = [
    ...syncingOperations,
    ...failedOperations,
  ];

  for (const operation of operationsToRecover) {
    await offlineDb.outbox.update(operation.id, {
      status: "pending",
    });
  }

  return operationsToRecover.length;
}

export async function getFailedOperations() {
  return offlineDb.outbox
    .where("status")
    .equals("error")
    .filter((operation) => operation.retryCount >= MAX_RETRY_COUNT)
    .toArray();
}

/**
 * Return all operations waiting to be synchronized.
 */
export async function getPendingOperations() {
  return offlineDb.outbox
    .where("status")
    .equals("pending")
    .sortBy("createdAt");
}

/**
 * Mark an operation as currently being synchronized.
 */
export async function markAsSyncing(id: string) {
  await offlineDb.outbox.update(id, {
    status: "syncing",
  });
}

/**
 * Mark synchronization as failed.
 */
export async function markAsError(id: string) {
  const operation = await offlineDb.outbox.get(id);

  if (!operation) {
    console.warn(
      `[outbox] Impossible de marquer ${id} en erreur : opération introuvable.`,
    );
    return;
  }

  const retryCount = operation.retryCount + 1;

  await offlineDb.outbox.update(id, {
    status: "error",
    retryCount,
  });

  const updatedOperation = await offlineDb.outbox.get(id);

  console.log(
    `[outbox] Opération ${id} marquée en erreur.`,
    updatedOperation,
  );
}

/**
 * Mark an operation as pending again.
 */
export async function markAsPending(id: string) {
  await offlineDb.outbox.update(id, {
    status: "pending",
  });
}

/**
 * Remove an operation after successful synchronization.
 */
export async function removeFromOutbox(id: string) {
  await offlineDb.outbox.delete(id);
}

export async function removePendingCreateByEntityId(
  entity: string,
  entityId: string,
): Promise<boolean> {
  const operations = await offlineDb.outbox.toArray();

  console.log("[outbox-cancel] recherche:", {
    entity,
    entityId,
  });

  console.log(
    "[outbox-cancel] avant suppression:",
    operations,
  );

  const operation = operations.find(
    (op) =>
      op.entity === entity &&
      op.operation === "CREATE" &&
      String(op.entityId) === String(entityId),
  );

  console.log(
    "[outbox-cancel] opération trouvée:",
    operation,
  );

  if (!operation) {
    console.warn(
      "[outbox-cancel] aucun CREATE correspondant trouvé",
    );
    return false;
  }

  await offlineDb.outbox.delete(operation.id);

  const remaining = await offlineDb.outbox.toArray();

  console.log(
    "[outbox-cancel] après suppression:",
    remaining,
  );

  return !remaining.some(
    (op) => op.id === operation.id,
  );
}

export async function getOutboxOperation(id: string) {
  return offlineDb.outbox.get(id);
}

/**
 * Number of operations still waiting for synchronization.
 */
export async function getPendingCount() {
  return offlineDb.outbox
    .where("status")
    .equals("pending")
    .count();
}

export async function resetInterruptedOperations() {
  const interrupted = await offlineDb.outbox
    .where("status")
    .anyOf(["syncing", "error"])
    .toArray();

  for (const operation of interrupted) {
    await offlineDb.outbox.update(operation.id, {
      status: "pending",
    });
  }
}