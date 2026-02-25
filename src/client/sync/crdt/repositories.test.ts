import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";
import type {
	LocalCard,
	LocalDeck,
	LocalNote,
	LocalNoteFieldType,
	LocalNoteFieldValue,
	LocalNoteType,
	LocalReviewLog,
} from "../../db/index";
import { CardState, FieldType, Rating } from "../../db/index";
import { saveDocument } from "./document-manager";
import {
	crdtCardRepository,
	crdtDeckRepository,
	crdtNoteFieldTypeRepository,
	crdtNoteFieldValueRepository,
	crdtNoteRepository,
	crdtNoteTypeRepository,
	crdtRepositories,
	crdtReviewLogRepository,
	entitiesToCrdtDocuments,
	getCrdtRepository,
	getRepositoryForDocumentId,
	mergeAndConvert,
} from "./repositories";
import { CrdtEntityType } from "./types";

describe("crdtDeckRepository", () => {
	const createTestDeck = (): LocalDeck => {
		const now = new Date();
		return {
			id: "deck-1",
			userId: "user-1",
			name: "Test Deck",
			description: "A test deck",
			defaultNoteTypeId: null,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 1,
			_synced: true,
		};
	};

	it("should have correct entity type", () => {
		expect(crdtDeckRepository.entityType).toBe(CrdtEntityType.Deck);
	});

	it("should convert deck to CRDT document", () => {
		const deck = createTestDeck();
		const result = crdtDeckRepository.toCrdtDocument(deck);

		expect(result.documentId).toBe("deck:deck-1");
		expect(result.binary).toBeInstanceOf(Uint8Array);
		expect(result.doc.meta.entityId).toBe("deck-1");
		expect(result.doc.data.name).toBe("Test Deck");
	});

	it("should load document from binary", () => {
		const deck = createTestDeck();
		const { binary } = crdtDeckRepository.toCrdtDocument(deck);
		const loaded = crdtDeckRepository.fromBinary(binary);

		expect(loaded.meta.entityId).toBe("deck-1");
		expect(loaded.data.name).toBe("Test Deck");
	});

	it("should merge documents correctly", () => {
		const deck = createTestDeck();
		const { doc: doc1 } = crdtDeckRepository.toCrdtDocument(deck);
		const doc2 = Automerge.clone(doc1);

		// Make concurrent changes
		const updated1 = Automerge.change(doc1, (d) => {
			d.data.name = "Updated Name";
		});
		const updated2 = Automerge.change(doc2, (d) => {
			d.data.description = "Updated Description";
		});

		const result = crdtDeckRepository.merge(updated1, updated2);

		expect(result.hasChanges).toBe(true);
		expect(result.merged.data.name).toBe("Updated Name");
		expect(result.merged.data.description).toBe("Updated Description");
	});

	it("should convert CRDT document to local entity", () => {
		const deck = createTestDeck();
		const { doc } = crdtDeckRepository.toCrdtDocument(deck);
		const localEntity = crdtDeckRepository.toLocalEntity(doc);

		expect(localEntity.id).toBe("deck-1");
		expect(localEntity.name).toBe("Test Deck");
		expect(localEntity.userId).toBe("user-1");
		expect(localEntity.syncVersion).toBe(0); // Reset by conversion
	});

	it("should create document ID correctly", () => {
		expect(crdtDeckRepository.createDocumentId("deck-123")).toBe(
			"deck:deck-123",
		);
	});
});

describe("crdtNoteTypeRepository", () => {
	const createTestNoteType = (): LocalNoteType => {
		const now = new Date();
		return {
			id: "notetype-1",
			userId: "user-1",
			name: "Basic",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: true,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 1,
			_synced: true,
		};
	};

	it("should have correct entity type", () => {
		expect(crdtNoteTypeRepository.entityType).toBe(CrdtEntityType.NoteType);
	});

	it("should convert note type to CRDT document", () => {
		const noteType = createTestNoteType();
		const result = crdtNoteTypeRepository.toCrdtDocument(noteType);

		expect(result.documentId).toBe("noteType:notetype-1");
		expect(result.doc.data.name).toBe("Basic");
		expect(result.doc.data.isReversible).toBe(true);
	});

	it("should roundtrip correctly", () => {
		const noteType = createTestNoteType();
		const { binary } = crdtNoteTypeRepository.toCrdtDocument(noteType);
		const loaded = crdtNoteTypeRepository.fromBinary(binary);
		const entity = crdtNoteTypeRepository.toLocalEntity(loaded);

		expect(entity.id).toBe("notetype-1");
		expect(entity.frontTemplate).toBe("{{Front}}");
		expect(entity.backTemplate).toBe("{{Back}}");
	});
});

describe("crdtNoteFieldTypeRepository", () => {
	const createTestNoteFieldType = (): LocalNoteFieldType => {
		const now = new Date();
		return {
			id: "fieldtype-1",
			noteTypeId: "notetype-1",
			name: "Front",
			order: 0,
			fieldType: FieldType.Text,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 1,
			_synced: true,
		};
	};

	it("should have correct entity type", () => {
		expect(crdtNoteFieldTypeRepository.entityType).toBe(
			CrdtEntityType.NoteFieldType,
		);
	});

	it("should convert note field type to CRDT document", () => {
		const fieldType = createTestNoteFieldType();
		const result = crdtNoteFieldTypeRepository.toCrdtDocument(fieldType);

		expect(result.documentId).toBe("noteFieldType:fieldtype-1");
		expect(result.doc.data.name).toBe("Front");
		expect(result.doc.data.order).toBe(0);
	});
});

describe("crdtNoteRepository", () => {
	const createTestNote = (): LocalNote => {
		const now = new Date();
		return {
			id: "note-1",
			deckId: "deck-1",
			noteTypeId: "notetype-1",
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 1,
			_synced: true,
		};
	};

	it("should have correct entity type", () => {
		expect(crdtNoteRepository.entityType).toBe(CrdtEntityType.Note);
	});

	it("should convert note to CRDT document", () => {
		const note = createTestNote();
		const result = crdtNoteRepository.toCrdtDocument(note);

		expect(result.documentId).toBe("note:note-1");
		expect(result.doc.data.deckId).toBe("deck-1");
		expect(result.doc.data.noteTypeId).toBe("notetype-1");
	});
});

describe("crdtNoteFieldValueRepository", () => {
	const createTestNoteFieldValue = (): LocalNoteFieldValue => {
		const now = new Date();
		return {
			id: "fieldvalue-1",
			noteId: "note-1",
			noteFieldTypeId: "fieldtype-1",
			value: "Tokyo",
			createdAt: now,
			updatedAt: now,
			syncVersion: 1,
			_synced: true,
		};
	};

	it("should have correct entity type", () => {
		expect(crdtNoteFieldValueRepository.entityType).toBe(
			CrdtEntityType.NoteFieldValue,
		);
	});

	it("should convert note field value to CRDT document", () => {
		const fieldValue = createTestNoteFieldValue();
		const result = crdtNoteFieldValueRepository.toCrdtDocument(fieldValue);

		expect(result.documentId).toBe("noteFieldValue:fieldvalue-1");
		expect(result.doc.data.value).toBe("Tokyo");
	});
});

describe("crdtCardRepository", () => {
	const createTestCard = (): LocalCard => {
		const now = new Date();
		return {
			id: "card-1",
			deckId: "deck-1",
			noteId: "note-1",
			isReversed: false,
			front: "What is the capital of Japan?",
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
	};

	it("should have correct entity type", () => {
		expect(crdtCardRepository.entityType).toBe(CrdtEntityType.Card);
	});

	it("should convert card to CRDT document", () => {
		const card = createTestCard();
		const result = crdtCardRepository.toCrdtDocument(card);

		expect(result.documentId).toBe("card:card-1");
		expect(result.doc.data.front).toBe("What is the capital of Japan?");
		expect(result.doc.data.back).toBe("Tokyo");
		expect(result.doc.data.state).toBe(CardState.New);
	});

	it("should preserve FSRS fields in roundtrip", () => {
		const now = new Date();
		const card: LocalCard = {
			...createTestCard(),
			state: CardState.Review,
			stability: 5.5,
			difficulty: 0.3,
			reps: 5,
			lapses: 1,
			lastReview: now,
		};

		const { binary } = crdtCardRepository.toCrdtDocument(card);
		const loaded = crdtCardRepository.fromBinary(binary);
		const entity = crdtCardRepository.toLocalEntity(loaded);

		expect(entity.state).toBe(CardState.Review);
		expect(entity.stability).toBe(5.5);
		expect(entity.difficulty).toBe(0.3);
		expect(entity.reps).toBe(5);
		expect(entity.lapses).toBe(1);
	});
});

describe("crdtReviewLogRepository", () => {
	const createTestReviewLog = (): LocalReviewLog => {
		const now = new Date();
		return {
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
	};

	it("should have correct entity type", () => {
		expect(crdtReviewLogRepository.entityType).toBe(CrdtEntityType.ReviewLog);
	});

	it("should convert review log to CRDT document", () => {
		const reviewLog = createTestReviewLog();
		const result = crdtReviewLogRepository.toCrdtDocument(reviewLog);

		expect(result.documentId).toBe("reviewLog:review-1");
		expect(result.doc.data.rating).toBe(Rating.Good);
		expect(result.doc.data.durationMs).toBe(5000);
	});
});

describe("getCrdtRepository", () => {
	it("should return correct repository for each entity type", () => {
		expect(getCrdtRepository(CrdtEntityType.Deck)).toBe(crdtDeckRepository);
		expect(getCrdtRepository(CrdtEntityType.NoteType)).toBe(
			crdtNoteTypeRepository,
		);
		expect(getCrdtRepository(CrdtEntityType.NoteFieldType)).toBe(
			crdtNoteFieldTypeRepository,
		);
		expect(getCrdtRepository(CrdtEntityType.Note)).toBe(crdtNoteRepository);
		expect(getCrdtRepository(CrdtEntityType.NoteFieldValue)).toBe(
			crdtNoteFieldValueRepository,
		);
		expect(getCrdtRepository(CrdtEntityType.Card)).toBe(crdtCardRepository);
		expect(getCrdtRepository(CrdtEntityType.ReviewLog)).toBe(
			crdtReviewLogRepository,
		);
	});
});

describe("crdtRepositories", () => {
	it("should contain all repositories", () => {
		expect(Object.keys(crdtRepositories)).toHaveLength(7);
		expect(crdtRepositories.deck).toBe(crdtDeckRepository);
		expect(crdtRepositories.noteType).toBe(crdtNoteTypeRepository);
		expect(crdtRepositories.noteFieldType).toBe(crdtNoteFieldTypeRepository);
		expect(crdtRepositories.note).toBe(crdtNoteRepository);
		expect(crdtRepositories.noteFieldValue).toBe(crdtNoteFieldValueRepository);
		expect(crdtRepositories.card).toBe(crdtCardRepository);
		expect(crdtRepositories.reviewLog).toBe(crdtReviewLogRepository);
	});
});

describe("entitiesToCrdtDocuments", () => {
	it("should convert multiple entities to CRDT documents", () => {
		const now = new Date();
		const decks: LocalDeck[] = [
			{
				id: "deck-1",
				userId: "user-1",
				name: "Deck 1",
				description: null,
				defaultNoteTypeId: null,
				createdAt: now,
				updatedAt: now,
				deletedAt: null,
				syncVersion: 1,
				_synced: true,
			},
			{
				id: "deck-2",
				userId: "user-1",
				name: "Deck 2",
				description: "Second deck",
				defaultNoteTypeId: null,
				createdAt: now,
				updatedAt: now,
				deletedAt: null,
				syncVersion: 1,
				_synced: true,
			},
		];

		const results = entitiesToCrdtDocuments(decks, crdtDeckRepository);

		expect(results).toHaveLength(2);
		expect(results[0]?.documentId).toBe("deck:deck-1");
		expect(results[1]?.documentId).toBe("deck:deck-2");
		expect(results[0]?.doc.data.name).toBe("Deck 1");
		expect(results[1]?.doc.data.name).toBe("Deck 2");
	});
});

describe("mergeAndConvert", () => {
	it("should use remote document when local is null", () => {
		const now = new Date();
		const deck: LocalDeck = {
			id: "deck-1",
			userId: "user-1",
			name: "Remote Deck",
			description: null,
			defaultNoteTypeId: null,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 1,
			_synced: true,
		};

		const { binary } = crdtDeckRepository.toCrdtDocument(deck);
		const result = mergeAndConvert(null, binary, crdtDeckRepository);

		expect(result.hasChanges).toBe(true);
		expect(result.entity.name).toBe("Remote Deck");
	});

	it("should merge local and remote documents", () => {
		const now = new Date();
		const deck: LocalDeck = {
			id: "deck-1",
			userId: "user-1",
			name: "Original",
			description: null,
			defaultNoteTypeId: null,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 1,
			_synced: true,
		};

		const { doc: localDoc } = crdtDeckRepository.toCrdtDocument(deck);

		// Create remote with different changes
		const remoteDoc = Automerge.change(Automerge.clone(localDoc), (d) => {
			d.data.description = "Remote Description";
		});
		const remoteBinary = saveDocument(remoteDoc);

		// Modify local
		const updatedLocalDoc = Automerge.change(localDoc, (d) => {
			d.data.name = "Updated Local";
		});
		const updatedLocalBinary = saveDocument(updatedLocalDoc);

		const result = mergeAndConvert(
			updatedLocalBinary,
			remoteBinary,
			crdtDeckRepository,
		);

		expect(result.hasChanges).toBe(true);
		// Both changes should be merged
		expect(result.entity.name).toBe("Updated Local");
		expect(result.entity.description).toBe("Remote Description");
	});

	it("should detect no changes when documents are identical", () => {
		const now = new Date();
		const deck: LocalDeck = {
			id: "deck-1",
			userId: "user-1",
			name: "Same",
			description: null,
			defaultNoteTypeId: null,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 1,
			_synced: true,
		};

		const { binary } = crdtDeckRepository.toCrdtDocument(deck);
		const result = mergeAndConvert(binary, binary, crdtDeckRepository);

		expect(result.hasChanges).toBe(false);
		expect(result.entity.name).toBe("Same");
	});
});

describe("getRepositoryForDocumentId", () => {
	it("should return repository and entity ID for valid document ID", () => {
		const result = getRepositoryForDocumentId("deck:deck-123");

		expect(result).not.toBeNull();
		expect(result?.entityId).toBe("deck-123");
	});

	it("should return null for invalid document ID", () => {
		expect(getRepositoryForDocumentId("invalid")).toBeNull();
		expect(getRepositoryForDocumentId("unknown:id")).toBeNull();
		expect(getRepositoryForDocumentId("")).toBeNull();
	});

	it("should work for all entity types", () => {
		const testCases = [
			{ documentId: "deck:id1", entityId: "id1" },
			{ documentId: "noteType:id2", entityId: "id2" },
			{ documentId: "noteFieldType:id3", entityId: "id3" },
			{ documentId: "note:id4", entityId: "id4" },
			{ documentId: "noteFieldValue:id5", entityId: "id5" },
			{ documentId: "card:id6", entityId: "id6" },
			{ documentId: "reviewLog:id7", entityId: "id7" },
		];

		for (const { documentId, entityId } of testCases) {
			const result = getRepositoryForDocumentId(documentId);
			expect(result).not.toBeNull();
			expect(result?.entityId).toBe(entityId);
		}
	});
});
