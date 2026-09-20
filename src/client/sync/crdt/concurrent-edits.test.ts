/**
 * Integration tests for CRDT concurrent edit scenarios
 *
 * These tests simulate real-world concurrent editing scenarios where
 * multiple devices/clients edit the same data while offline and then sync.
 *
 * The first half works directly on Automerge documents. The second half
 * ("Multi-device sync scenarios") drives the full client sync stack of two
 * independent devices against an in-memory server.
 *
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import * as Automerge from "@automerge/automerge";
import Dexie from "dexie";
import { IDBKeyRange as FakeIDBKeyRange, IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalCard, LocalDeck } from "../../db/index";
import { CardState } from "../../db/index";
import type {
	ServerCard,
	ServerDeck,
	ServerNote,
	ServerNoteFieldType,
	ServerNoteFieldValue,
	ServerNoteType,
	ServerReviewLog,
	SyncPullResult,
} from "../pull";
import type { SyncPushData, SyncPushResult } from "../push";
import {
	applyChanges,
	cardToCrdtDocument,
	crdtDocumentToCard,
	crdtDocumentToDeck,
	createDocument,
	deckToCrdtDocument,
	getChanges,
	hasConflicts,
	loadDocument,
	mergeDocuments,
	saveDocument,
	updateDocument,
} from "./document-manager";
import type { CrdtSyncPayload } from "./sync-state";
import type { CrdtDeckDocument } from "./types";

/**
 * Helper to create a test deck
 */
function createTestDeck(overrides: Partial<LocalDeck> = {}): LocalDeck {
	const now = new Date();
	return {
		id: "deck-1",
		userId: "user-1",
		name: "Test Deck",
		description: null,
		defaultNoteTypeId: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		syncVersion: 1,
		_synced: true,
		...overrides,
	};
}

/**
 * Helper to create a test card
 */
function createTestCard(overrides: Partial<LocalCard> = {}): LocalCard {
	const now = new Date();
	return {
		id: "card-1",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: false,
		front: "Question",
		back: "Answer",
		state: CardState.New,
		due: now,
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		syncVersion: 1,
		_synced: true,
		...overrides,
	};
}

describe("Concurrent edit scenarios", () => {
	describe("Two devices editing different fields of the same deck", () => {
		it("should merge changes from both devices without conflicts", () => {
			// Setup: Create initial deck document (represents server state)
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Device A: Offline edit - change deck name
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.name = "Updated by Device A";
				d.meta.lastModified = Date.now();
			});

			// Device B: Offline edit - change description
			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.description = "Updated by Device B";
				d.meta.lastModified = Date.now();
			});

			// Sync: Merge both changes
			const mergeResult = mergeDocuments(deviceAEdited, deviceBEdited);

			// Both changes should be present
			expect(mergeResult.merged.data.name).toBe("Updated by Device A");
			expect(mergeResult.merged.data.description).toBe("Updated by Device B");
			expect(mergeResult.hasChanges).toBe(true);
		});

		it("should correctly convert merged deck back to LocalDeck", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Device A and B make different edits
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.name = "New Name";
				d.data.description = "Added by Device A";
				d.meta.lastModified = Date.now();
			});

			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.userId = "user-updated";
				d.meta.lastModified = Date.now();
			});

			const mergeResult = mergeDocuments(deviceAEdited, deviceBEdited);
			const mergedDeck = crdtDocumentToDeck(mergeResult.merged);

			expect(mergedDeck.name).toBe("New Name");
			expect(mergedDeck.description).toBe("Added by Device A");
			expect(mergedDeck.userId).toBe("user-updated");
		});
	});

	describe("Two devices editing the same field", () => {
		it("should detect conflicts when same field is edited concurrently", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Both devices edit the same field
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.name = "Name from Device A";
			});

			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.name = "Name from Device B";
			});

			// hasConflicts should detect the divergence
			expect(hasConflicts(deviceAEdited, deviceBEdited)).toBe(true);
		});

		it("should resolve conflicting edits deterministically using Automerge", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Both devices edit the same field
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.name = "Name from Device A";
			});

			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.name = "Name from Device B";
			});

			// Merge from both directions should produce the same result
			const mergeAB = mergeDocuments(deviceAEdited, deviceBEdited);
			const mergeBA = mergeDocuments(deviceBEdited, deviceAEdited);

			// Results should be deterministic (same regardless of merge order)
			expect(mergeAB.merged.data.name).toBe(mergeBA.merged.data.name);
		});
	});

	describe("Concurrent edit and delete", () => {
		it("should handle concurrent edit and soft-delete", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Device A: Edit the deck
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.name = "Edited name";
				d.meta.lastModified = Date.now();
			});

			// Device B: Delete the deck
			const now = Date.now();
			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBDeleted = updateDocument(deviceBDoc, (d) => {
				d.meta.deleted = true;
				d.data.deletedAt = now;
				d.meta.lastModified = now;
			});

			// Merge: Both changes should be preserved
			const mergeResult = mergeDocuments(deviceAEdited, deviceBDeleted);

			// The edit should be present, and the delete flag should be set
			expect(mergeResult.merged.data.name).toBe("Edited name");
			expect(mergeResult.merged.meta.deleted).toBe(true);
			expect(mergeResult.merged.data.deletedAt).toBe(now);
		});

		it("should preserve deletedAt timestamp from the deleting device", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			const deleteTime = Date.now();
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceADeleted = updateDocument(deviceADoc, (d) => {
				d.meta.deleted = true;
				d.data.deletedAt = deleteTime;
				d.meta.lastModified = deleteTime;
			});

			// Another device just syncs without knowing about the delete
			const deviceBDoc = Automerge.clone(serverDoc);

			// Merge
			const mergeResult = mergeDocuments(deviceADeleted, deviceBDoc);

			expect(mergeResult.merged.meta.deleted).toBe(true);
			expect(mergeResult.merged.data.deletedAt).toBe(deleteTime);
		});
	});

	describe("Card FSRS field concurrent edits", () => {
		it("should merge concurrent card reviews from different devices", () => {
			const card = createTestCard();
			const crdtData = cardToCrdtDocument(card);
			const serverDoc = createDocument(crdtData);

			// Device A: Review card (update FSRS fields)
			const deviceADoc = Automerge.clone(serverDoc);
			const now = Date.now();
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.state = CardState.Learning;
				d.data.reps = 1;
				d.data.stability = 1.5;
				d.data.lastReview = now;
				d.meta.lastModified = now;
			});

			// Device B: Different field edit (update front text)
			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.front = "Updated question";
				d.meta.lastModified = now + 100;
			});

			// Merge
			const mergeResult = mergeDocuments(deviceAEdited, deviceBEdited);

			// Both sets of changes should be present
			expect(mergeResult.merged.data.state).toBe(CardState.Learning);
			expect(mergeResult.merged.data.reps).toBe(1);
			expect(mergeResult.merged.data.stability).toBe(1.5);
			expect(mergeResult.merged.data.front).toBe("Updated question");
		});

		it("should handle concurrent FSRS updates deterministically", () => {
			const card = createTestCard();
			const crdtData = cardToCrdtDocument(card);
			const serverDoc = createDocument(crdtData);
			const now = Date.now();

			// Device A: Review with "Good"
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.state = CardState.Review;
				d.data.reps = 2;
				d.data.stability = 4.0;
				d.data.difficulty = 0.3;
				d.data.scheduledDays = 4;
				d.data.lastReview = now;
				d.meta.lastModified = now;
			});

			// Device B: Review with "Hard" (different scheduling)
			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.state = CardState.Review;
				d.data.reps = 1;
				d.data.stability = 2.0;
				d.data.difficulty = 0.5;
				d.data.scheduledDays = 2;
				d.data.lastReview = now + 100;
				d.meta.lastModified = now + 100;
			});

			// Merge from both directions
			const mergeAB = mergeDocuments(deviceAEdited, deviceBEdited);
			const mergeBA = mergeDocuments(deviceBEdited, deviceAEdited);

			// Results should be deterministic
			expect(mergeAB.merged.data.reps).toBe(mergeBA.merged.data.reps);
			expect(mergeAB.merged.data.stability).toBe(mergeBA.merged.data.stability);
			expect(mergeAB.merged.data.difficulty).toBe(
				mergeBA.merged.data.difficulty,
			);
		});
	});

	describe("Incremental sync simulation", () => {
		it("should sync changes incrementally between devices", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);

			// Create server document
			const serverDoc = createDocument(crdtData);
			const serverBinary = saveDocument(serverDoc);

			// Device A downloads initial state
			const deviceADoc = loadDocument<CrdtDeckDocument>(serverBinary);

			// Device A makes an edit
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.name = "Edit 1 from A";
				d.meta.lastModified = Date.now();
			});

			// Get changes from Device A to send to server
			const changesFromA = getChanges(deviceADoc, deviceAEdited);
			expect(changesFromA.length).toBeGreaterThan(0);

			// Server applies changes from A
			const serverUpdated = applyChanges(serverDoc, changesFromA);
			expect(serverUpdated.data.name).toBe("Edit 1 from A");

			// Device B downloads initial state
			const deviceBDoc = loadDocument<CrdtDeckDocument>(serverBinary);

			// Device B makes a different edit
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.description = "Description from B";
				d.meta.lastModified = Date.now();
			});

			// Get changes from Device B
			const changesFromB = getChanges(deviceBDoc, deviceBEdited);

			// Server merges Device B's changes with its current state
			const serverWithB = applyChanges(serverUpdated, changesFromB);

			// Both changes should be present
			expect(serverWithB.data.name).toBe("Edit 1 from A");
			expect(serverWithB.data.description).toBe("Description from B");
		});

		it("should handle three-way merge correctly", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Clone for 3 devices
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceCDoc = Automerge.clone(serverDoc);

			// Each device makes a different edit
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.name = "Name from A";
			});

			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.description = "Description from B";
			});

			const deviceCEdited = updateDocument(deviceCDoc, (d) => {
				d.data.userId = "user-from-C";
			});

			// Sequential merge: A + B
			const mergeAB = mergeDocuments(deviceAEdited, deviceBEdited);

			// Then: (A+B) + C
			const mergeABC = mergeDocuments(mergeAB.merged, deviceCEdited);

			// All three changes should be present
			expect(mergeABC.merged.data.name).toBe("Name from A");
			expect(mergeABC.merged.data.description).toBe("Description from B");
			expect(mergeABC.merged.data.userId).toBe("user-from-C");
		});
	});

	describe("Serialization roundtrip with concurrent edits", () => {
		it("should preserve merged changes after serialization", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Two concurrent edits
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.name = "Serialization test name";
			});

			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.description = "Serialization test description";
			});

			// Merge
			const mergeResult = mergeDocuments(deviceAEdited, deviceBEdited);

			// Serialize and deserialize
			const binary = saveDocument(mergeResult.merged);
			const restored = loadDocument<CrdtDeckDocument>(binary);

			// Verify changes are preserved
			expect(restored.data.name).toBe("Serialization test name");
			expect(restored.data.description).toBe("Serialization test description");
		});

		it("should maintain history after serialization roundtrip", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			let doc = createDocument(crdtData);

			// Make multiple edits
			doc = updateDocument(doc, (d) => {
				d.data.name = "First edit";
			});
			doc = updateDocument(doc, (d) => {
				d.data.name = "Second edit";
			});
			doc = updateDocument(doc, (d) => {
				d.data.name = "Third edit";
			});

			// Serialize and deserialize
			const binary = saveDocument(doc);
			const restored = loadDocument<CrdtDeckDocument>(binary);

			// Final state should be preserved
			expect(restored.data.name).toBe("Third edit");

			// Automerge history should be preserved
			const history = Automerge.getHistory(restored);
			expect(history.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe("Edge cases", () => {
		it("should handle empty description being set to a value", () => {
			const deck = createTestDeck({ description: null });
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.description = "Now has a description";
			});

			const localDeck = crdtDocumentToDeck(deviceAEdited);
			expect(localDeck.description).toBe("Now has a description");
		});

		it("should handle description being set to null", () => {
			const deck = createTestDeck({ description: "Has description" });
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.description = null;
			});

			const localDeck = crdtDocumentToDeck(deviceAEdited);
			expect(localDeck.description).toBeNull();
		});

		it("should handle concurrent null to value and value to null", () => {
			const deck = createTestDeck({ description: "Initial" });
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Device A: Set description to null
			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.description = null;
			});

			// Device B: Update description to new value
			const deviceBDoc = Automerge.clone(serverDoc);
			const deviceBEdited = updateDocument(deviceBDoc, (d) => {
				d.data.description = "Updated value";
			});

			// Merge - result is deterministic (one of the values)
			const mergeAB = mergeDocuments(deviceAEdited, deviceBEdited);
			const mergeBA = mergeDocuments(deviceBEdited, deviceAEdited);

			// Both merges should produce the same result
			expect(mergeAB.merged.data.description).toBe(
				mergeBA.merged.data.description,
			);
		});

		it("should handle card with null lastReview being reviewed", () => {
			const card = createTestCard({ lastReview: null });
			const crdtData = cardToCrdtDocument(card);
			const serverDoc = createDocument(crdtData);
			const now = Date.now();

			const deviceADoc = Automerge.clone(serverDoc);
			const deviceAEdited = updateDocument(deviceADoc, (d) => {
				d.data.lastReview = now;
				d.data.reps = 1;
				d.data.state = CardState.Learning;
			});

			const localCard = crdtDocumentToCard(deviceAEdited);
			expect(localCard.lastReview).toBeInstanceOf(Date);
			expect(localCard.lastReview?.getTime()).toBe(now);
			expect(localCard.reps).toBe(1);
		});

		it("should handle multiple rapid edits to the same document", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			let doc = createDocument(crdtData);

			// Simulate rapid typing in name field
			for (let i = 1; i <= 10; i++) {
				doc = updateDocument(doc, (d) => {
					d.data.name = `Name after ${i} edits`;
					d.meta.lastModified = Date.now();
				});
			}

			expect(doc.data.name).toBe("Name after 10 edits");

			// Should still serialize/deserialize correctly
			const binary = saveDocument(doc);
			const restored = loadDocument<CrdtDeckDocument>(binary);
			expect(restored.data.name).toBe("Name after 10 edits");
		});
	});

	describe("Multi-device simulation with offline queuing", () => {
		it("should simulate offline edit queue being synced", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Device A goes offline and makes multiple edits
			let deviceADoc = Automerge.clone(serverDoc);
			const offlineEdits: Automerge.Change[][] = [];

			// Edit 1
			const beforeEdit1 = Automerge.clone(deviceADoc);
			deviceADoc = updateDocument(deviceADoc, (d) => {
				d.data.name = "Offline edit 1";
			});
			offlineEdits.push(getChanges(beforeEdit1, deviceADoc));

			// Edit 2
			const beforeEdit2 = Automerge.clone(deviceADoc);
			deviceADoc = updateDocument(deviceADoc, (d) => {
				d.data.description = "Offline edit 2";
			});
			offlineEdits.push(getChanges(beforeEdit2, deviceADoc));

			// Edit 3
			const beforeEdit3 = Automerge.clone(deviceADoc);
			deviceADoc = updateDocument(deviceADoc, (d) => {
				d.data.userId = "user-offline";
			});
			offlineEdits.push(getChanges(beforeEdit3, deviceADoc));

			// Device comes online and syncs all changes
			let currentServer = serverDoc;
			for (const changes of offlineEdits) {
				currentServer = applyChanges(currentServer, changes);
			}

			// Verify all offline edits are applied
			expect(currentServer.data.name).toBe("Offline edit 1");
			expect(currentServer.data.description).toBe("Offline edit 2");
			expect(currentServer.data.userId).toBe("user-offline");
		});

		it("should handle two devices syncing after extended offline periods", () => {
			const deck = createTestDeck();
			const crdtData = deckToCrdtDocument(deck);
			const serverDoc = createDocument(crdtData);

			// Device A: Multiple offline edits
			let deviceADoc = Automerge.clone(serverDoc);
			deviceADoc = updateDocument(deviceADoc, (d) => {
				d.data.name = "A: First edit";
			});
			deviceADoc = updateDocument(deviceADoc, (d) => {
				d.data.name = "A: Second edit";
			});
			deviceADoc = updateDocument(deviceADoc, (d) => {
				d.data.name = "A: Final name";
				d.data.description = "A: Added description";
			});

			// Device B: Different offline edits
			let deviceBDoc = Automerge.clone(serverDoc);
			deviceBDoc = updateDocument(deviceBDoc, (d) => {
				d.data.userId = "B: First user";
			});
			deviceBDoc = updateDocument(deviceBDoc, (d) => {
				d.data.userId = "B: Second user";
			});
			deviceBDoc = updateDocument(deviceBDoc, (d) => {
				d.data.userId = "B: Final user";
			});

			// Both devices come online and sync
			const mergeResult = mergeDocuments(deviceADoc, deviceBDoc);

			// Device A's content edits and Device B's user edits
			expect(mergeResult.merged.data.name).toBe("A: Final name");
			expect(mergeResult.merged.data.description).toBe("A: Added description");
			expect(mergeResult.merged.data.userId).toBe("B: Final user");
		});
	});
});

/**
 * In-memory stand-in for the sync API.
 *
 * It mirrors the semantics of `src/server/repositories/sync.ts`: rows are
 * resolved with Last-Write-Wins on `updatedAt`, a conflict is reported only
 * when the stored row is the newer one, review logs are append-only, and CRDT
 * binaries are stored verbatim under their document ID.
 *
 * One deliberate difference: `syncVersion` here is a single monotonic counter
 * shared by every row, which is what the `syncVersion > lastSyncVersion`
 * watermark used by pull actually assumes.
 */
class FakeSyncServer {
	readonly userId = "user-1";

	private version = 0;
	private decks = new Map<string, ServerDeck>();
	private noteTypes = new Map<string, ServerNoteType>();
	private noteFieldTypes = new Map<string, ServerNoteFieldType>();
	private notes = new Map<string, ServerNote>();
	private noteFieldValues = new Map<string, ServerNoteFieldValue>();
	private cards = new Map<string, ServerCard>();
	private reviewLogs = new Map<string, ServerReviewLog>();
	private crdtDocuments = new Map<
		string,
		{ payload: CrdtSyncPayload; syncVersion: number }
	>();

	/** Rows the server accepted, in the order they were accepted */
	readonly acceptedPushes: string[] = [];

	async push(data: SyncPushData): Promise<SyncPushResult> {
		const result: SyncPushResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};

		for (const noteType of data.noteTypes) {
			this.applyLww(
				this.noteTypes,
				{
					id: noteType.id,
					userId: this.userId,
					name: noteType.name,
					frontTemplate: noteType.frontTemplate,
					backTemplate: noteType.backTemplate,
					isReversible: noteType.isReversible,
					createdAt: new Date(noteType.createdAt),
					updatedAt: new Date(noteType.updatedAt),
					deletedAt: noteType.deletedAt ? new Date(noteType.deletedAt) : null,
				},
				result.noteTypes,
				result.conflicts.noteTypes,
			);
		}

		for (const fieldType of data.noteFieldTypes) {
			this.applyLww(
				this.noteFieldTypes,
				{
					id: fieldType.id,
					noteTypeId: fieldType.noteTypeId,
					name: fieldType.name,
					order: fieldType.order,
					fieldType: fieldType.fieldType,
					createdAt: new Date(fieldType.createdAt),
					updatedAt: new Date(fieldType.updatedAt),
					deletedAt: fieldType.deletedAt ? new Date(fieldType.deletedAt) : null,
				},
				result.noteFieldTypes,
				result.conflicts.noteFieldTypes,
			);
		}

		for (const deck of data.decks) {
			this.applyLww(
				this.decks,
				{
					id: deck.id,
					userId: this.userId,
					name: deck.name,
					description: deck.description,
					defaultNoteTypeId: deck.defaultNoteTypeId,
					createdAt: new Date(deck.createdAt),
					updatedAt: new Date(deck.updatedAt),
					deletedAt: deck.deletedAt ? new Date(deck.deletedAt) : null,
				},
				result.decks,
				result.conflicts.decks,
			);
		}

		for (const note of data.notes) {
			this.applyLww(
				this.notes,
				{
					id: note.id,
					deckId: note.deckId,
					noteTypeId: note.noteTypeId,
					createdAt: new Date(note.createdAt),
					updatedAt: new Date(note.updatedAt),
					deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
				},
				result.notes,
				result.conflicts.notes,
			);
		}

		for (const fieldValue of data.noteFieldValues) {
			this.applyLww(
				this.noteFieldValues,
				{
					id: fieldValue.id,
					noteId: fieldValue.noteId,
					noteFieldTypeId: fieldValue.noteFieldTypeId,
					value: fieldValue.value,
					createdAt: new Date(fieldValue.createdAt),
					updatedAt: new Date(fieldValue.updatedAt),
				},
				result.noteFieldValues,
				result.conflicts.noteFieldValues,
			);
		}

		for (const card of data.cards) {
			this.applyLww(
				this.cards,
				{
					id: card.id,
					deckId: card.deckId,
					noteId: card.noteId,
					isReversed: card.isReversed,
					front: card.front,
					back: card.back,
					state: card.state,
					due: new Date(card.due),
					stability: card.stability,
					difficulty: card.difficulty,
					elapsedDays: card.elapsedDays,
					scheduledDays: card.scheduledDays,
					reps: card.reps,
					lapses: card.lapses,
					lastReview: card.lastReview ? new Date(card.lastReview) : null,
					createdAt: new Date(card.createdAt),
					updatedAt: new Date(card.updatedAt),
					deletedAt: card.deletedAt ? new Date(card.deletedAt) : null,
				},
				result.cards,
				result.conflicts.cards,
			);
		}

		// Review logs are append-only: the first writer wins and later pushes of
		// the same ID are silently accepted as already-present.
		for (const log of data.reviewLogs) {
			const existing = this.reviewLogs.get(log.id);
			if (existing) {
				result.reviewLogs.push({
					id: existing.id,
					syncVersion: existing.syncVersion,
				});
				continue;
			}
			this.version += 1;
			this.reviewLogs.set(log.id, {
				id: log.id,
				cardId: log.cardId,
				userId: this.userId,
				rating: log.rating,
				state: log.state,
				scheduledDays: log.scheduledDays,
				elapsedDays: log.elapsedDays,
				reviewedAt: new Date(log.reviewedAt),
				durationMs: log.durationMs,
				syncVersion: this.version,
			});
			result.reviewLogs.push({ id: log.id, syncVersion: this.version });
		}

		for (const payload of data.crdtChanges) {
			this.version += 1;
			this.crdtDocuments.set(payload.documentId, {
				payload,
				syncVersion: this.version,
			});
		}

		return result;
	}

	async pull(lastSyncVersion: number): Promise<SyncPullResult> {
		const since = <T extends { syncVersion: number }>(store: Map<string, T>) =>
			[...store.values()].filter((row) => row.syncVersion > lastSyncVersion);

		const crdtChanges = [...this.crdtDocuments.values()]
			.filter((entry) => entry.syncVersion > lastSyncVersion)
			.map((entry) => entry.payload);

		return {
			decks: since(this.decks),
			cards: since(this.cards),
			reviewLogs: since(this.reviewLogs),
			noteTypes: since(this.noteTypes),
			noteFieldTypes: since(this.noteFieldTypes),
			notes: since(this.notes),
			noteFieldValues: since(this.noteFieldValues),
			crdtChanges,
			currentSyncVersion: this.version,
		};
	}

	getDeck(id: string): ServerDeck | undefined {
		return this.decks.get(id);
	}

	getNoteFieldValue(id: string): ServerNoteFieldValue | undefined {
		return this.noteFieldValues.get(id);
	}

	private applyLww<
		T extends { id: string; updatedAt: Date; syncVersion: number },
	>(
		store: Map<string, T>,
		incoming: Omit<T, "syncVersion">,
		accepted: { id: string; syncVersion: number }[],
		conflicts: string[],
	): void {
		const existing = store.get(incoming.id);

		if (existing && incoming.updatedAt <= existing.updatedAt) {
			// Server row is the newer one: reject and report a conflict
			conflicts.push(incoming.id);
			accepted.push({ id: existing.id, syncVersion: existing.syncVersion });
			return;
		}

		this.version += 1;
		store.set(incoming.id, { ...incoming, syncVersion: this.version } as T);
		accepted.push({ id: incoming.id, syncVersion: this.version });
		this.acceptedPushes.push(incoming.id);
	}
}

/**
 * Spin up an isolated "device": its own IndexedDB backing store, its own copy
 * of the client modules (and therefore its own Dexie instance, CRDT sync state
 * and sync queue), wired to the shared fake server.
 *
 * Two things make the devices genuinely separate inside one process:
 * `vi.resetModules()` gives each device its own Dexie instances, sync queue and
 * CRDT sync state, and `Dexie.dependencies.indexedDB` is repointed at a fresh
 * `IDBFactory` first, because Dexie copies that dependency into every instance
 * it constructs.
 */
async function createDevice(name: string, server: FakeSyncServer) {
	const previousIndexedDB = Dexie.dependencies.indexedDB;
	Dexie.dependencies.indexedDB = new IDBFactory();
	Dexie.dependencies.IDBKeyRange = FakeIDBKeyRange;

	vi.resetModules();
	const dbModule = await import("../../db/index");
	const repos = await import("../../db/repositories");
	const queueModule = await import("../queue");
	const pushModule = await import("../push");
	const pullModule = await import("../pull");
	const conflictModule = await import("../conflict");
	const managerModule = await import("../manager");
	const crdtModule = await import("./index");

	Dexie.dependencies.indexedDB = previousIndexedDB;

	const syncQueue = new queueModule.SyncQueue();
	const manager = new managerModule.SyncManager({
		syncQueue,
		pushService: new pushModule.PushService({
			syncQueue,
			pushToServer: (data) => server.push(data),
		}),
		pullService: new pullModule.PullService({
			syncQueue,
			pullFromServer: (lastSyncVersion) => server.pull(lastSyncVersion),
		}),
		conflictResolver: new conflictModule.ConflictResolver(),
		crdtSyncStateManager: crdtModule.crdtSyncStateManager,
		autoSync: false,
	});

	return {
		name,
		db: dbModule.db,
		repos,
		/** True while this device still has rows waiting to be pushed */
		hasPendingChanges() {
			return syncQueue.hasPendingChanges();
		},
		/** Come back online and run a full push/pull/resolve cycle */
		async sync() {
			const result = await manager.sync();
			if (!result.success) {
				throw new Error(`${name}: sync failed: ${result.error}`);
			}
			return result;
		},
		/**
		 * Force a row's `updatedAt`, so a test can decide which device holds the
		 * newer write instead of depending on wall-clock ordering.
		 */
		async setUpdatedAt(
			table: "decks" | "noteFieldValues",
			id: string,
			updatedAt: Date,
		) {
			await dbModule.db.table(table).update(id, { updatedAt });
		},
	};
}

type Device = Awaited<ReturnType<typeof createDevice>>;

/**
 * A timestamp guaranteed to be newer than anything written during setup, so a
 * test can decide which device holds the winning write.
 */
function laterThanSetup(offsetMs: number): Date {
	return new Date(Date.now() + 60_000 + offsetMs);
}

/**
 * Sync both devices until nothing is left to push and both have seen each
 * other's last push. Conflict resolution can itself produce a row that needs
 * pushing, so a fixed number of rounds is not enough.
 */
async function syncUntilConverged(a: Device, b: Device): Promise<void> {
	let settledRounds = 0;
	for (let round = 0; round < 8; round++) {
		await a.sync();
		await b.sync();
		const settled =
			!(await a.hasPendingChanges()) && !(await b.hasPendingChanges());
		// Two consecutive quiet rounds: the second one is what lets each device
		// pull whatever the other pushed during the round that went quiet.
		settledRounds = settled ? settledRounds + 1 : 0;
		if (settledRounds >= 2) return;
	}
	throw new Error("devices did not converge");
}

/** Create the note type + two text fields every note scenario needs */
async function seedNoteType(device: Device, userId: string) {
	const noteType = await device.repos.localNoteTypeRepository.create({
		userId,
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
	});
	const front = await device.repos.localNoteFieldTypeRepository.create({
		noteTypeId: noteType.id,
		name: "Front",
		order: 0,
	});
	const back = await device.repos.localNoteFieldTypeRepository.create({
		noteTypeId: noteType.id,
		name: "Back",
		order: 1,
	});
	return { noteType, front, back };
}

describe("Multi-device sync scenarios", () => {
	let server: FakeSyncServer;
	let deviceA: Device;
	let deviceB: Device;

	beforeEach(async () => {
		localStorage.clear();
		server = new FakeSyncServer();
		// Both devices are constructed before anyone syncs, so neither inherits
		// the other's persisted sync watermark.
		deviceA = await createDevice("deviceA", server);
		deviceB = await createDevice("deviceB", server);
	});

	it("keeps both edits when two devices edit different fields of the same note", async () => {
		// Device A creates the note and publishes it
		const { noteType, front, back } = await seedNoteType(
			deviceA,
			server.userId,
		);
		const deck = await deviceA.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Deck",
			description: null,
			defaultNoteTypeId: noteType.id,
		});
		const created = await deviceA.repos.localNoteRepository.createWithCards({
			deckId: deck.id,
			noteTypeId: noteType.id,
			fields: { Front: "original front", Back: "original back" },
		});
		await deviceA.sync();

		// Device B picks it up
		await deviceB.sync();
		const bValues =
			await deviceB.repos.localNoteFieldValueRepository.findByNoteId(
				created.note.id,
			);
		expect(bValues).toHaveLength(2);

		// Both go offline and edit a different field of the same note
		const aFront = created.fieldValues.find(
			(value) => value.noteFieldTypeId === front.id,
		);
		const bBack = bValues.find((value) => value.noteFieldTypeId === back.id);
		expect(aFront).toBeDefined();
		expect(bBack).toBeDefined();
		if (!aFront || !bBack) return;

		await deviceA.repos.localNoteFieldValueRepository.update(aFront.id, {
			value: "edited by A",
		});
		await deviceB.repos.localNoteFieldValueRepository.update(bBack.id, {
			value: "edited by B",
		});

		await syncUntilConverged(deviceA, deviceB);

		// Both edits survive on both devices: they touched different rows
		for (const device of [deviceA, deviceB]) {
			const values =
				await device.repos.localNoteFieldValueRepository.findByNoteId(
					created.note.id,
				);
			const byFieldType = new Map(
				values.map((value) => [value.noteFieldTypeId, value.value]),
			);
			expect(byFieldType.get(front.id)).toBe("edited by A");
			expect(byFieldType.get(back.id)).toBe("edited by B");
		}
	});

	it("converges deterministically when two devices edit the same field", async () => {
		const { noteType, front } = await seedNoteType(deviceA, server.userId);
		const deck = await deviceA.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Deck",
			description: null,
			defaultNoteTypeId: noteType.id,
		});
		const created = await deviceA.repos.localNoteRepository.createWithCards({
			deckId: deck.id,
			noteTypeId: noteType.id,
			fields: { Front: "original", Back: "back" },
		});
		await deviceA.sync();
		await deviceB.sync();

		const fieldValueId = created.fieldValues.find(
			(value) => value.noteFieldTypeId === front.id,
		)?.id;
		expect(fieldValueId).toBeDefined();
		if (!fieldValueId) return;

		// Both edit the same field while offline. Device A's write is the newer
		// one, so device B is the side that will hit a conflict.
		await deviceA.repos.localNoteFieldValueRepository.update(fieldValueId, {
			value: "A's answer",
		});
		await deviceB.repos.localNoteFieldValueRepository.update(fieldValueId, {
			value: "B's answer",
		});
		await deviceA.setUpdatedAt(
			"noteFieldValues",
			fieldValueId,
			laterThanSetup(2000),
		);
		await deviceB.setUpdatedAt(
			"noteFieldValues",
			fieldValueId,
			laterThanSetup(1000),
		);

		await syncUntilConverged(deviceA, deviceB);

		const onA =
			await deviceA.repos.localNoteFieldValueRepository.findById(fieldValueId);
		const onB =
			await deviceB.repos.localNoteFieldValueRepository.findById(fieldValueId);
		const onServer = server.getNoteFieldValue(fieldValueId);

		// The whole point: nobody is left holding a value the others never see
		expect(onA?.value).toBe(onB?.value);
		expect(onA?.value).toBe(onServer?.value);

		// Automerge picks the winner deterministically from the two documents, so
		// the surviving text is always one of the two edits, never a mix of bytes.
		// (Character-level merging of both edits additionally needs the push path
		// to carry document history, which it does not do yet.)
		expect(["A's answer", "B's answer"]).toContain(onA?.value);
	});

	it("merges an offline device's new deck with a deck created online elsewhere", async () => {
		const { noteType } = await seedNoteType(deviceA, server.userId);
		await deviceA.sync();
		await deviceB.sync();

		// Device B is online and creates its own deck
		const onlineDeck = await deviceB.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Created online on B",
			description: null,
			defaultNoteTypeId: noteType.id,
		});
		await deviceB.sync();

		// Device A is offline: a new deck plus five notes pile up locally
		const offlineDeck = await deviceA.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Created offline on A",
			description: null,
			defaultNoteTypeId: noteType.id,
		});
		for (let i = 1; i <= 5; i++) {
			await deviceA.repos.localNoteRepository.createWithCards({
				deckId: offlineDeck.id,
				noteTypeId: noteType.id,
				fields: { Front: `front ${i}`, Back: `back ${i}` },
			});
		}

		// Device A comes back online
		await syncUntilConverged(deviceA, deviceB);

		for (const device of [deviceA, deviceB]) {
			const decks = await device.repos.localDeckRepository.findByUserId(
				server.userId,
			);
			expect(decks.map((deck) => deck.name).sort()).toEqual([
				"Created offline on A",
				"Created online on B",
			]);

			const notes = await device.repos.localNoteRepository.findByDeckId(
				offlineDeck.id,
			);
			expect(notes).toHaveLength(5);

			const onlineDeckRow = await device.repos.localDeckRepository.findById(
				onlineDeck.id,
			);
			expect(onlineDeckRow?.name).toBe("Created online on B");
		}
	});

	it("agrees on the tombstone when both devices delete the same deck", async () => {
		const deck = await deviceA.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Doomed",
			description: null,
			defaultNoteTypeId: null,
		});
		await deviceA.sync();
		await deviceB.sync();

		// Both devices delete it while offline, device B a day later than A
		await deviceA.repos.localDeckRepository.delete(deck.id);
		await deviceB.repos.localDeckRepository.delete(deck.id);
		await deviceA.setUpdatedAt("decks", deck.id, laterThanSetup(1000));
		await deviceB.setUpdatedAt("decks", deck.id, laterThanSetup(2000));

		await syncUntilConverged(deviceA, deviceB);

		const onA = await deviceA.repos.localDeckRepository.findById(deck.id);
		const onB = await deviceB.repos.localDeckRepository.findById(deck.id);
		const onServer = server.getDeck(deck.id);

		expect(onA?.deletedAt).not.toBeNull();
		expect(onB?.deletedAt).not.toBeNull();
		expect(onA?.deletedAt?.getTime()).toBe(onB?.deletedAt?.getTime());
		expect(onA?.deletedAt?.getTime()).toBe(onServer?.deletedAt?.getTime());

		// And the deck is gone from both devices' deck lists
		for (const device of [deviceA, deviceB]) {
			const decks = await device.repos.localDeckRepository.findByUserId(
				server.userId,
			);
			expect(decks.map((row) => row.id)).not.toContain(deck.id);
		}
	});
});
