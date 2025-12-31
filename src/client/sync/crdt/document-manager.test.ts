import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";
import type { LocalCard, LocalDeck, LocalReviewLog } from "../../db/index";
import { CardState, Rating } from "../../db/index";
import {
	applyChanges,
	cardToCrdtDocument,
	crdtDocumentToCard,
	crdtDocumentToDeck,
	crdtDocumentToReviewLog,
	createDocument,
	createDocumentFromEntity,
	createEmptyDocument,
	deckToCrdtDocument,
	getChanges,
	getLastModified,
	hasConflicts,
	isDeleted,
	loadDocument,
	loadIncremental,
	mergeDocuments,
	reviewLogToCrdtDocument,
	saveDocument,
	saveIncremental,
	updateDocument,
} from "./document-manager";
import {
	type CrdtCardDocument,
	type CrdtDeckDocument,
	CrdtEntityType,
	type CrdtReviewLogDocument,
} from "./types";

describe("createDocument", () => {
	it("should create an Automerge document from data", () => {
		const data = { name: "test", value: 42 };
		const doc = createDocument(data);

		expect(doc.name).toBe("test");
		expect(doc.value).toBe(42);
	});

	it("should create a CRDT deck document", () => {
		const deckData: CrdtDeckDocument = {
			meta: {
				entityId: "deck-1",
				lastModified: Date.now(),
				deleted: false,
			},
			data: {
				userId: "user-1",
				name: "My Deck",
				description: null,
				newCardsPerDay: 20,
				createdAt: Date.now(),
				deletedAt: null,
			},
		};

		const doc = createDocument(deckData);
		expect(doc.meta.entityId).toBe("deck-1");
		expect(doc.data.name).toBe("My Deck");
	});
});

describe("updateDocument", () => {
	it("should update document and return new immutable copy", () => {
		const doc = createDocument({ count: 0 });
		const updated = updateDocument(doc, (d) => {
			d.count = 1;
		});

		expect(updated.count).toBe(1);
		// Original document should be frozen after change
	});

	it("should update nested properties", () => {
		const doc = createDocument({
			meta: { entityId: "test" },
			data: { name: "original" },
		});

		const updated = updateDocument(doc, (d) => {
			d.data.name = "updated";
		});

		expect(updated.data.name).toBe("updated");
	});
});

describe("mergeDocuments", () => {
	it("should merge two documents without conflicts", () => {
		const doc1 = createDocument({ a: 1, b: 2 });
		const doc2 = Automerge.clone(doc1);

		const updated1 = updateDocument(doc1, (d) => {
			d.a = 10;
		});
		const updated2 = updateDocument(doc2, (d) => {
			d.b = 20;
		});

		const result = mergeDocuments(updated1, updated2);

		expect(result.merged.a).toBe(10);
		expect(result.merged.b).toBe(20);
		expect(result.hasChanges).toBe(true);
	});

	it("should detect when no changes occurred", () => {
		const doc1 = createDocument({ a: 1 });
		const doc2 = Automerge.clone(doc1);

		const result = mergeDocuments(doc1, doc2);
		expect(result.hasChanges).toBe(false);
	});

	it("should return binary representation of merged document", () => {
		const doc1 = createDocument({ value: 1 });
		const doc2 = Automerge.clone(doc1);

		const result = mergeDocuments(doc1, doc2);
		expect(result.binary).toBeInstanceOf(Uint8Array);
		expect(result.binary.length).toBeGreaterThan(0);
	});
});

describe("getChanges and applyChanges", () => {
	it("should get and apply changes between documents", () => {
		const doc1 = createDocument({ value: 1 });
		const doc2 = updateDocument(doc1, (d) => {
			d.value = 2;
		});

		const changes = getChanges(doc1, doc2);
		expect(changes.length).toBeGreaterThan(0);

		// Create a clone of doc1 and apply changes
		const doc3 = Automerge.clone(doc1);
		const result = applyChanges(doc3, changes);
		expect(result.value).toBe(2);
	});
});

describe("saveDocument and loadDocument", () => {
	it("should serialize and deserialize document", () => {
		const original: CrdtDeckDocument = {
			meta: {
				entityId: "deck-123",
				lastModified: 1234567890,
				deleted: false,
			},
			data: {
				userId: "user-1",
				name: "Test Deck",
				description: "A test deck",
				newCardsPerDay: 15,
				createdAt: 1234567890,
				deletedAt: null,
			},
		};

		const doc = createDocument(original);
		const binary = saveDocument(doc);

		expect(binary).toBeInstanceOf(Uint8Array);

		const loaded = loadDocument<CrdtDeckDocument>(binary);
		expect(loaded.meta.entityId).toBe("deck-123");
		expect(loaded.data.name).toBe("Test Deck");
		expect(loaded.data.newCardsPerDay).toBe(15);
	});
});

describe("saveIncremental and loadIncremental", () => {
	it("should save and load incremental changes", () => {
		const doc1 = createDocument({ value: 1 });
		const doc2 = updateDocument(doc1, (d) => {
			d.value = 2;
		});

		const incremental = saveIncremental(doc2);
		expect(incremental).toBeInstanceOf(Uint8Array);

		// Create a clone and load incremental
		const doc3 = Automerge.clone(doc1);
		const result = loadIncremental(doc3, incremental);
		expect(result.value).toBe(2);
	});
});

describe("createEmptyDocument", () => {
	it("should create empty deck document", () => {
		const doc = createEmptyDocument(CrdtEntityType.Deck);
		expect(doc.meta.entityId).toBe("");
		expect(doc.meta.deleted).toBe(false);
		expect(doc.data.name).toBe("");
		expect(doc.data.newCardsPerDay).toBe(20);
	});

	it("should create empty card document", () => {
		const doc = createEmptyDocument(CrdtEntityType.Card);
		expect(doc.meta.entityId).toBe("");
		expect(doc.data.state).toBe(0);
		expect(doc.data.reps).toBe(0);
	});

	it("should create empty note type document", () => {
		const doc = createEmptyDocument(CrdtEntityType.NoteType);
		expect(doc.data.frontTemplate).toBe("");
		expect(doc.data.isReversible).toBe(false);
	});

	it("should create empty review log document", () => {
		const doc = createEmptyDocument(CrdtEntityType.ReviewLog);
		expect(doc.data.rating).toBe(3);
		expect(doc.data.durationMs).toBeNull();
	});
});

describe("deckToCrdtDocument and crdtDocumentToDeck", () => {
	it("should convert LocalDeck to CRDT document", () => {
		const now = new Date();
		const deck: LocalDeck = {
			id: "deck-1",
			userId: "user-1",
			name: "My Deck",
			description: "A deck for testing",
			newCardsPerDay: 25,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 1,
			_synced: true,
		};

		const crdtDoc = deckToCrdtDocument(deck);

		expect(crdtDoc.meta.entityId).toBe("deck-1");
		expect(crdtDoc.meta.deleted).toBe(false);
		expect(crdtDoc.data.name).toBe("My Deck");
		expect(crdtDoc.data.description).toBe("A deck for testing");
		expect(crdtDoc.data.newCardsPerDay).toBe(25);
		expect(crdtDoc.data.createdAt).toBe(now.getTime());
	});

	it("should convert deleted deck correctly", () => {
		const now = new Date();
		const deletedAt = new Date(now.getTime() + 1000);
		const deck: LocalDeck = {
			id: "deck-2",
			userId: "user-1",
			name: "Deleted Deck",
			description: null,
			newCardsPerDay: 20,
			createdAt: now,
			updatedAt: deletedAt,
			deletedAt: deletedAt,
			syncVersion: 2,
			_synced: false,
		};

		const crdtDoc = deckToCrdtDocument(deck);

		expect(crdtDoc.meta.deleted).toBe(true);
		expect(crdtDoc.data.deletedAt).toBe(deletedAt.getTime());
	});

	it("should convert CRDT document back to LocalDeck", () => {
		const now = Date.now();
		const crdtDoc: CrdtDeckDocument = {
			meta: {
				entityId: "deck-3",
				lastModified: now,
				deleted: false,
			},
			data: {
				userId: "user-2",
				name: "Converted Deck",
				description: "Converted from CRDT",
				newCardsPerDay: 30,
				createdAt: now - 10000,
				deletedAt: null,
			},
		};

		const localDeck = crdtDocumentToDeck(crdtDoc);

		expect(localDeck.id).toBe("deck-3");
		expect(localDeck.userId).toBe("user-2");
		expect(localDeck.name).toBe("Converted Deck");
		expect(localDeck.newCardsPerDay).toBe(30);
		expect(localDeck.deletedAt).toBeNull();
		expect(localDeck.syncVersion).toBe(0); // Set by sync layer
	});
});

describe("cardToCrdtDocument and crdtDocumentToCard", () => {
	it("should convert LocalCard to CRDT document", () => {
		const now = new Date();
		const card: LocalCard = {
			id: "card-1",
			deckId: "deck-1",
			noteId: "note-1",
			isReversed: false,
			front: "What is the capital?",
			back: "Tokyo",
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
		};

		const crdtDoc = cardToCrdtDocument(card);

		expect(crdtDoc.meta.entityId).toBe("card-1");
		expect(crdtDoc.data.front).toBe("What is the capital?");
		expect(crdtDoc.data.back).toBe("Tokyo");
		expect(crdtDoc.data.state).toBe(CardState.New);
		expect(crdtDoc.data.due).toBe(now.getTime());
	});

	it("should convert reviewed card correctly", () => {
		const now = new Date();
		const lastReview = new Date(now.getTime() - 86400000);
		const card: LocalCard = {
			id: "card-2",
			deckId: "deck-1",
			noteId: "note-1",
			isReversed: true,
			front: "Tokyo",
			back: "What is the capital?",
			state: CardState.Review,
			due: now,
			stability: 5.5,
			difficulty: 0.3,
			elapsedDays: 1,
			scheduledDays: 4,
			reps: 3,
			lapses: 0,
			lastReview: lastReview,
			createdAt: new Date(now.getTime() - 100000),
			updatedAt: now,
			deletedAt: null,
			syncVersion: 5,
			_synced: true,
		};

		const crdtDoc = cardToCrdtDocument(card);

		expect(crdtDoc.data.isReversed).toBe(true);
		expect(crdtDoc.data.state).toBe(CardState.Review);
		expect(crdtDoc.data.stability).toBe(5.5);
		expect(crdtDoc.data.reps).toBe(3);
		expect(crdtDoc.data.lastReview).toBe(lastReview.getTime());
	});

	it("should convert CRDT document back to LocalCard", () => {
		const now = Date.now();
		const crdtDoc: CrdtCardDocument = {
			meta: {
				entityId: "card-3",
				lastModified: now,
				deleted: false,
			},
			data: {
				deckId: "deck-1",
				noteId: "note-1",
				isReversed: false,
				front: "Front text",
				back: "Back text",
				state: CardState.Learning,
				due: now + 3600000,
				stability: 1.0,
				difficulty: 0.5,
				elapsedDays: 0,
				scheduledDays: 1,
				reps: 1,
				lapses: 0,
				lastReview: now,
				createdAt: now - 10000,
				deletedAt: null,
			},
		};

		const localCard = crdtDocumentToCard(crdtDoc);

		expect(localCard.id).toBe("card-3");
		expect(localCard.front).toBe("Front text");
		expect(localCard.state).toBe(CardState.Learning);
		expect(localCard.lastReview).toBeInstanceOf(Date);
		expect(localCard.lastReview?.getTime()).toBe(now);
	});
});

describe("reviewLogToCrdtDocument and crdtDocumentToReviewLog", () => {
	it("should convert LocalReviewLog to CRDT document", () => {
		const now = new Date();
		const reviewLog: LocalReviewLog = {
			id: "review-1",
			cardId: "card-1",
			userId: "user-1",
			rating: Rating.Good,
			state: CardState.Review,
			scheduledDays: 4,
			elapsedDays: 1,
			reviewedAt: now,
			durationMs: 5000,
			syncVersion: 1,
			_synced: true,
		};

		const crdtDoc = reviewLogToCrdtDocument(reviewLog);

		expect(crdtDoc.meta.entityId).toBe("review-1");
		expect(crdtDoc.data.rating).toBe(Rating.Good);
		expect(crdtDoc.data.state).toBe(CardState.Review);
		expect(crdtDoc.data.durationMs).toBe(5000);
		expect(crdtDoc.data.reviewedAt).toBe(now.getTime());
	});

	it("should convert CRDT document back to LocalReviewLog", () => {
		const now = Date.now();
		const crdtDoc: CrdtReviewLogDocument = {
			meta: {
				entityId: "review-2",
				lastModified: now,
				deleted: false,
			},
			data: {
				cardId: "card-2",
				userId: "user-2",
				rating: Rating.Hard,
				state: CardState.Relearning,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: now,
				durationMs: null,
			},
		};

		const localReviewLog = crdtDocumentToReviewLog(crdtDoc);

		expect(localReviewLog.id).toBe("review-2");
		expect(localReviewLog.rating).toBe(Rating.Hard);
		expect(localReviewLog.durationMs).toBeNull();
	});
});

describe("createDocumentFromEntity", () => {
	it("should create document from LocalDeck", () => {
		const now = new Date();
		const deck: LocalDeck = {
			id: "deck-1",
			userId: "user-1",
			name: "Test",
			description: null,
			newCardsPerDay: 20,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};

		const doc = createDocumentFromEntity(CrdtEntityType.Deck, deck);
		expect(doc.meta.entityId).toBe("deck-1");
		expect(doc.data.name).toBe("Test");
	});

	it("should create document from LocalCard", () => {
		const now = new Date();
		const card: LocalCard = {
			id: "card-1",
			deckId: "deck-1",
			noteId: "note-1",
			isReversed: false,
			front: "Q",
			back: "A",
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
			syncVersion: 0,
			_synced: false,
		};

		const doc = createDocumentFromEntity(CrdtEntityType.Card, card);
		expect(doc.meta.entityId).toBe("card-1");
		expect(doc.data.front).toBe("Q");
	});
});

describe("hasConflicts", () => {
	it("should detect no conflicts when documents are in sync", () => {
		const doc1 = createDocument({ value: 1 });
		const doc2 = Automerge.clone(doc1);

		expect(hasConflicts(doc1, doc2)).toBe(false);
	});

	it("should detect conflicts when documents have diverged", () => {
		const doc1 = createDocument({ value: 1 });
		const doc2 = Automerge.clone(doc1);

		// Make concurrent changes
		const doc1Updated = updateDocument(doc1, (d) => {
			d.value = 10;
		});
		const doc2Updated = updateDocument(doc2, (d) => {
			d.value = 20;
		});

		expect(hasConflicts(doc1Updated, doc2Updated)).toBe(true);
	});
});

describe("getLastModified", () => {
	it("should return lastModified timestamp from document", () => {
		const timestamp = 1234567890000;
		const data: CrdtDeckDocument = {
			meta: {
				entityId: "deck-1",
				lastModified: timestamp,
				deleted: false,
			},
			data: {
				userId: "user-1",
				name: "Test",
				description: null,
				newCardsPerDay: 20,
				createdAt: timestamp,
				deletedAt: null,
			},
		};

		const doc = createDocument(data);
		expect(getLastModified(doc)).toBe(timestamp);
	});
});

describe("isDeleted", () => {
	it("should return false for non-deleted document", () => {
		const data: CrdtDeckDocument = {
			meta: {
				entityId: "deck-1",
				lastModified: Date.now(),
				deleted: false,
			},
			data: {
				userId: "user-1",
				name: "Test",
				description: null,
				newCardsPerDay: 20,
				createdAt: Date.now(),
				deletedAt: null,
			},
		};

		const doc = createDocument(data);
		expect(isDeleted(doc)).toBe(false);
	});

	it("should return true for deleted document", () => {
		const data: CrdtDeckDocument = {
			meta: {
				entityId: "deck-1",
				lastModified: Date.now(),
				deleted: true,
			},
			data: {
				userId: "user-1",
				name: "Test",
				description: null,
				newCardsPerDay: 20,
				createdAt: Date.now(),
				deletedAt: Date.now(),
			},
		};

		const doc = createDocument(data);
		expect(isDeleted(doc)).toBe(true);
	});
});

// Note: getActorId tests are skipped because they require browser localStorage
// which is not available in the Node.js test environment.
// The function is tested implicitly through integration tests.
