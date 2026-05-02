/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crdtSyncStateManager } from "../sync/crdt/sync-state";
import { CrdtEntityType } from "../sync/crdt/types";
import { syncQueue } from "../sync/queue";
import { clearAllLocalData } from "./clear";
import { CardState, db } from "./index";

describe("clearAllLocalData", () => {
	beforeEach(async () => {
		await db.delete();
		await db.open();
		await syncQueue.reset();
		await crdtSyncStateManager.clearAll();
	});

	afterEach(async () => {
		await db.delete();
		await db.open();
		await syncQueue.reset();
		await crdtSyncStateManager.clearAll();
	});

	it("clears all main IndexedDB tables", async () => {
		await db.decks.add({
			id: "deck-1",
			userId: "user-1",
			name: "Deck",
			description: null,
			defaultNoteTypeId: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		});
		await db.cards.add({
			id: "card-1",
			deckId: "deck-1",
			noteId: "note-1",
			isReversed: false,
			front: "Q",
			back: "A",
			state: CardState.New,
			due: new Date(),
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		});

		await clearAllLocalData();
		await db.open();

		expect(await db.decks.toArray()).toHaveLength(0);
		expect(await db.cards.toArray()).toHaveLength(0);
	});

	it("resets the sync queue state", async () => {
		await syncQueue.startSync();
		await syncQueue.completeSync(42);

		const before = await syncQueue.getState();
		expect(before.lastSyncVersion).toBe(42);

		await clearAllLocalData();
		await db.open();

		const after = await syncQueue.getState();
		expect(after.lastSyncVersion).toBe(0);
		expect(after.lastSyncAt).toBeNull();
		expect(after.lastError).toBeNull();
	});

	it("clears the CRDT sync state", async () => {
		await crdtSyncStateManager.setDocumentBinary(
			CrdtEntityType.Note,
			"note-1",
			new Uint8Array([1, 2, 3]),
			1,
		);
		expect(await crdtSyncStateManager.getTotalDocumentCount()).toBeGreaterThan(
			0,
		);

		await clearAllLocalData();
		await db.open();

		expect(await crdtSyncStateManager.getTotalDocumentCount()).toBe(0);
	});
});
