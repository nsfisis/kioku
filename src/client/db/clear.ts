import Dexie from "dexie";
import { syncQueue } from "../sync/queue";
import { db } from "./index";

/**
 * IndexedDB database in which earlier versions kept Automerge documents.
 * Nothing uses it any more, but it still exists on devices that ran them.
 */
const LEGACY_CRDT_DATABASE = "kioku-crdt-sync";

/**
 * Delete the database left behind by earlier versions, if it is still there.
 *
 * TODO: remove this cleanup in v0.7.1. `scripts/bump-version.sh` refuses to
 * bump to that version until it is gone.
 */
export async function deleteLegacyCrdtDatabase(): Promise<void> {
	await Dexie.delete(LEGACY_CRDT_DATABASE);
}

/**
 * Clears all locally persisted user-scoped data: the main IndexedDB tables,
 * the sync queue state, and the legacy CRDT database. Used at explicit logout to
 * prevent the next user from seeing the previous user's offline data.
 *
 * Each step is isolated so that a partial failure (e.g. one tab still has the
 * Dexie connection open) does not stop the rest from running.
 */
export async function clearAllLocalData(): Promise<void> {
	const results = await Promise.allSettled([
		syncQueue.reset(),
		deleteLegacyCrdtDatabase(),
		db.delete(),
	]);

	for (const result of results) {
		if (result.status === "rejected") {
			console.error("Failed to clear local data:", result.reason);
		}
	}
}
