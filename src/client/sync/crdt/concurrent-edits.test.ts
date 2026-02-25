/**
 * Integration tests for CRDT concurrent edit scenarios
 *
 * These tests simulate real-world concurrent editing scenarios where
 * multiple devices/clients edit the same data while offline and then sync.
 */
import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";
import type { LocalCard, LocalDeck } from "../../db/index";
import { CardState } from "../../db/index";
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
