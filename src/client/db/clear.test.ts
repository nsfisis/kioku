/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncQueue } from "../sync/queue";
import { clearAllLocalData } from "./clear";
import { CardState, db } from "./index";

describe("clearAllLocalData", () => {
	beforeEach(async () => {
		await db.delete();
		await db.open();
		await syncQueue.reset();
	});

	afterEach(async () => {
		await db.delete();
		await db.open();
		await syncQueue.reset();
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

	it("deletes the legacy CRDT database", async () => {
		const legacy = new Dexie("kioku-crdt-sync");
		legacy.version(1).stores({ syncState: "documentId" });
		await legacy.table("syncState").put({ documentId: "note:note-1" });
		legacy.close();
		expect(await Dexie.exists("kioku-crdt-sync")).toBe(true);

		await clearAllLocalData();
		await db.open();

		expect(await Dexie.exists("kioku-crdt-sync")).toBe(false);
	});
});
