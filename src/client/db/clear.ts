import { crdtSyncStateManager } from "../sync/crdt/sync-state";
import { syncQueue } from "../sync/queue";
import { db } from "./index";

/**
 * Clears all locally persisted user-scoped data: the main IndexedDB tables,
 * the sync queue state, and the CRDT sync state. Used at explicit logout to
 * prevent the next user from seeing the previous user's offline data.
 *
 * Each step is isolated so that a partial failure (e.g. one tab still has the
 * Dexie connection open) does not stop the rest from running.
 */
export async function clearAllLocalData(): Promise<void> {
	const results = await Promise.allSettled([
		syncQueue.reset(),
		crdtSyncStateManager.clearAll(),
		db.delete(),
	]);

	for (const result of results) {
		if (result.status === "rejected") {
			console.error("Failed to clear local data:", result.reason);
		}
	}
}
