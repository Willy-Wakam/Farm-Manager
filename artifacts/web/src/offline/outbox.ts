import { offlineDb, type PendingOperation } from "./db";
export const MAX_RETRY_COUNT = 3;
type OutboxStatus = PendingOperation["status"];

function isRetryableError(operation: PendingOperation) {
  return operation.status === "error" && operation.retryCount < MAX_RETRY_COUNT;
}

function isFinalFailure(operation: PendingOperation) {
  return (
    operation.status === "failed" ||
    (operation.status === "error" && operation.retryCount >= MAX_RETRY_COUNT)
  );
}

async function updateStatus(
  operation: PendingOperation,
  status: OutboxStatus,
  extra: Partial<PendingOperation> = {},
) {
  await offlineDb.outbox.update(operation.id, {
    status,
    ...extra,
  });
}

/**
 * Add a new operation to the offline synchronization queue.
 */
export async function addToOutbox(
  operation: Omit<
    PendingOperation,
    "id" | "createdAt" | "retryCount" | "status"
  >,
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
  const errorOperations = await offlineDb.outbox
    .where("status")
    .equals("error")
    .toArray();

  const retryableOperations = errorOperations.filter(isRetryableError);
  const finalFailures = errorOperations.filter(isFinalFailure);

  for (const operation of retryableOperations) {
    await updateStatus(operation, "pending");
  }

  for (const operation of finalFailures) {
    await updateStatus(operation, "failed", {
      retryCount: Math.max(operation.retryCount, MAX_RETRY_COUNT),
      failedAt: operation.failedAt ?? new Date().toISOString(),
    });
  }

  return retryableOperations.length;
}

export async function getFailedOperations() {
  return offlineDb.outbox
    .where("status")
    .anyOf(["failed", "error"])
    .filter(isFinalFailure)
    .toArray();
}

/**
 * Return all operations waiting to be synchronized.
 */
export async function getPendingOperations() {
  return offlineDb.outbox.where("status").equals("pending").sortBy("createdAt");
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
function getErrorMessage(error?: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

export async function markAsError(id: string, error?: unknown) {
  const operation = await offlineDb.outbox.get(id);

  if (!operation) {
    console.warn(
      `[outbox] Impossible de marquer ${id} en erreur : opération introuvable.`,
    );
    return;
  }

  if (operation.status === "failed") {
    return operation;
  }

  const retryCount = Math.min(operation.retryCount + 1, MAX_RETRY_COUNT);
  const status: OutboxStatus =
    retryCount >= MAX_RETRY_COUNT ? "failed" : "error";
  const lastError = getErrorMessage(error);

  await offlineDb.outbox.update(id, {
    status,
    retryCount,
    lastError: lastError || undefined,
    failedAt: status === "failed" ? new Date().toISOString() : undefined,
  });

  return offlineDb.outbox.get(id);
}

export async function markAsFailed(id: string, error?: unknown) {
  const operation = await offlineDb.outbox.get(id);

  if (!operation) {
    console.warn(
      `[outbox] Impossible de marquer ${id} en échec final : opération introuvable.`,
    );
    return undefined;
  }

  const lastError = getErrorMessage(error);

  await offlineDb.outbox.update(id, {
    status: "failed",
    retryCount: Math.max(operation.retryCount, MAX_RETRY_COUNT),
    lastError: lastError || undefined,
    failedAt: operation.failedAt ?? new Date().toISOString(),
  });

  return offlineDb.outbox.get(id);
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

  const operation = operations.find(
    (op) =>
      op.entity === entity &&
      op.operation === "CREATE" &&
      String(op.entityId) === String(entityId),
  );

  if (!operation) {
    console.warn("[outbox-cancel] aucun CREATE correspondant trouvé");
    return false;
  }

  await offlineDb.outbox.delete(operation.id);

  const remaining = await offlineDb.outbox.toArray();

  return !remaining.some((op) => op.id === operation.id);
}

export async function getOutboxOperation(id: string) {
  return offlineDb.outbox.get(id);
}

/**
 * Number of operations still waiting for synchronization.
 */
export async function getPendingCount() {
  return offlineDb.outbox.where("status").equals("pending").count();
}

export async function resetInterruptedOperations() {
  const interrupted = await offlineDb.outbox
    .where("status")
    .equals("syncing")
    .toArray();

  for (const operation of interrupted) {
    await updateStatus(operation, "pending");
  }
}
