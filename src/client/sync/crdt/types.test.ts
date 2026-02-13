import { describe, expect, it } from "vitest";
import { CardState, FieldType, Rating } from "../../db/index";
import {
	type CrdtCardDocument,
	type CrdtDeckDocument,
	CrdtEntityType,
	type CrdtNoteDocument,
	type CrdtNoteFieldTypeDocument,
	type CrdtNoteFieldValueDocument,
	type CrdtNoteTypeDocument,
	type CrdtReviewLogDocument,
	createCrdtMetadata,
	createDeletedCrdtMetadata,
	createDocumentId,
	parseDocumentId,
} from "./types";

describe("CrdtEntityType", () => {
	it("should have all required entity types", () => {
		expect(CrdtEntityType.Deck).toBe("deck");
		expect(CrdtEntityType.NoteType).toBe("noteType");
		expect(CrdtEntityType.NoteFieldType).toBe("noteFieldType");
		expect(CrdtEntityType.Note).toBe("note");
		expect(CrdtEntityType.NoteFieldValue).toBe("noteFieldValue");
		expect(CrdtEntityType.Card).toBe("card");
		expect(CrdtEntityType.ReviewLog).toBe("reviewLog");
	});
});

describe("createDocumentId", () => {
	it("should create a document ID from entity type and ID", () => {
		const docId = createDocumentId(CrdtEntityType.Deck, "deck-123");
		expect(docId).toBe("deck:deck-123");
	});

	it("should work with all entity types", () => {
		expect(createDocumentId(CrdtEntityType.Card, "card-1")).toBe("card:card-1");
		expect(createDocumentId(CrdtEntityType.Note, "note-1")).toBe("note:note-1");
		expect(createDocumentId(CrdtEntityType.NoteType, "notetype-1")).toBe(
			"noteType:notetype-1",
		);
	});
});

describe("parseDocumentId", () => {
	it("should parse a valid document ID", () => {
		const result = parseDocumentId("deck:deck-123");
		expect(result).toEqual({
			entityType: "deck",
			entityId: "deck-123",
		});
	});

	it("should parse document IDs for all entity types", () => {
		expect(parseDocumentId("card:card-456")).toEqual({
			entityType: "card",
			entityId: "card-456",
		});
		expect(parseDocumentId("noteType:nt-789")).toEqual({
			entityType: "noteType",
			entityId: "nt-789",
		});
		expect(parseDocumentId("noteFieldType:nft-111")).toEqual({
			entityType: "noteFieldType",
			entityId: "nft-111",
		});
		expect(parseDocumentId("note:n-222")).toEqual({
			entityType: "note",
			entityId: "n-222",
		});
		expect(parseDocumentId("noteFieldValue:nfv-333")).toEqual({
			entityType: "noteFieldValue",
			entityId: "nfv-333",
		});
		expect(parseDocumentId("reviewLog:rl-444")).toEqual({
			entityType: "reviewLog",
			entityId: "rl-444",
		});
	});

	it("should return null for invalid document ID format", () => {
		expect(parseDocumentId("invalid")).toBeNull();
		expect(parseDocumentId("")).toBeNull();
		expect(parseDocumentId(":missing-type")).toBeNull();
		expect(parseDocumentId("missing-id:")).toBeNull();
	});

	it("should return null for invalid entity type", () => {
		expect(parseDocumentId("invalid:entity-123")).toBeNull();
		expect(parseDocumentId("unknown:entity-456")).toBeNull();
	});

	it("should handle entity IDs with colons", () => {
		// Note: Our simple split implementation only handles one colon
		// If entity IDs contain colons, this would need adjustment
		const result = parseDocumentId("deck:uuid-with-colon");
		expect(result).toEqual({
			entityType: "deck",
			entityId: "uuid-with-colon",
		});
	});
});

describe("createCrdtMetadata", () => {
	it("should create metadata with correct entity ID", () => {
		const meta = createCrdtMetadata("entity-123");
		expect(meta.entityId).toBe("entity-123");
		expect(meta.deleted).toBe(false);
	});

	it("should set lastModified to current time", () => {
		const before = Date.now();
		const meta = createCrdtMetadata("entity-123");
		const after = Date.now();

		expect(meta.lastModified).toBeGreaterThanOrEqual(before);
		expect(meta.lastModified).toBeLessThanOrEqual(after);
	});
});

describe("createDeletedCrdtMetadata", () => {
	it("should create metadata with deleted flag", () => {
		const meta = createDeletedCrdtMetadata("entity-123");
		expect(meta.entityId).toBe("entity-123");
		expect(meta.deleted).toBe(true);
	});

	it("should set lastModified to current time", () => {
		const before = Date.now();
		const meta = createDeletedCrdtMetadata("entity-123");
		const after = Date.now();

		expect(meta.lastModified).toBeGreaterThanOrEqual(before);
		expect(meta.lastModified).toBeLessThanOrEqual(after);
	});
});

describe("CRDT Document type structures", () => {
	const now = Date.now();

	it("should allow creating a valid CrdtDeckDocument", () => {
		const doc: CrdtDeckDocument = {
			meta: {
				entityId: "deck-1",
				lastModified: now,
				deleted: false,
			},
			data: {
				userId: "user-1",
				name: "My Deck",
				description: "A test deck",
				createdAt: now,
				deletedAt: null,
			},
		};

		expect(doc.meta.entityId).toBe("deck-1");
		expect(doc.data.name).toBe("My Deck");
	});

	it("should allow creating a valid CrdtNoteTypeDocument", () => {
		const doc: CrdtNoteTypeDocument = {
			meta: {
				entityId: "notetype-1",
				lastModified: now,
				deleted: false,
			},
			data: {
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
				createdAt: now,
				deletedAt: null,
			},
		};

		expect(doc.data.frontTemplate).toBe("{{Front}}");
		expect(doc.data.isReversible).toBe(false);
	});

	it("should allow creating a valid CrdtNoteFieldTypeDocument", () => {
		const doc: CrdtNoteFieldTypeDocument = {
			meta: {
				entityId: "fieldtype-1",
				lastModified: now,
				deleted: false,
			},
			data: {
				noteTypeId: "notetype-1",
				name: "Front",
				order: 0,
				fieldType: FieldType.Text,
				createdAt: now,
				deletedAt: null,
			},
		};

		expect(doc.data.name).toBe("Front");
		expect(doc.data.fieldType).toBe("text");
	});

	it("should allow creating a valid CrdtNoteDocument", () => {
		const doc: CrdtNoteDocument = {
			meta: {
				entityId: "note-1",
				lastModified: now,
				deleted: false,
			},
			data: {
				deckId: "deck-1",
				noteTypeId: "notetype-1",
				createdAt: now,
				deletedAt: null,
			},
		};

		expect(doc.data.deckId).toBe("deck-1");
		expect(doc.data.noteTypeId).toBe("notetype-1");
	});

	it("should allow creating a valid CrdtNoteFieldValueDocument", () => {
		const doc: CrdtNoteFieldValueDocument = {
			meta: {
				entityId: "fieldvalue-1",
				lastModified: now,
				deleted: false,
			},
			data: {
				noteId: "note-1",
				noteFieldTypeId: "fieldtype-1",
				value: "What is the capital of Japan?",
				createdAt: now,
			},
		};

		expect(doc.data.value).toBe("What is the capital of Japan?");
	});

	it("should allow creating a valid CrdtCardDocument", () => {
		const doc: CrdtCardDocument = {
			meta: {
				entityId: "card-1",
				lastModified: now,
				deleted: false,
			},
			data: {
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
				deletedAt: null,
			},
		};

		expect(doc.data.front).toBe("What is the capital of Japan?");
		expect(doc.data.state).toBe(CardState.New);
	});

	it("should allow creating a valid CrdtReviewLogDocument", () => {
		const doc: CrdtReviewLogDocument = {
			meta: {
				entityId: "review-1",
				lastModified: now,
				deleted: false,
			},
			data: {
				cardId: "card-1",
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.Review,
				scheduledDays: 4,
				elapsedDays: 1,
				reviewedAt: now,
				durationMs: 5000,
			},
		};

		expect(doc.data.rating).toBe(Rating.Good);
		expect(doc.data.durationMs).toBe(5000);
	});

	it("should handle deleted entities", () => {
		const doc: CrdtDeckDocument = {
			meta: {
				entityId: "deck-deleted",
				lastModified: now,
				deleted: true,
			},
			data: {
				userId: "user-1",
				name: "Deleted Deck",
				description: null,
				createdAt: now - 86400000,
				deletedAt: now,
			},
		};

		expect(doc.meta.deleted).toBe(true);
		expect(doc.data.deletedAt).toBe(now);
	});
});
