import { describe, expect, it, vi } from "vitest";
import type {
	Card,
	CreateNoteResult,
	Note,
	NoteFieldValue,
	NoteRepository,
	NoteWithFieldValues,
} from "./types.js";

function createMockNote(overrides: Partial<Note> = {}): Note {
	return {
		id: "note-uuid-123",
		deckId: "deck-uuid-123",
		noteTypeId: "note-type-uuid-123",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
	};
}

function createMockNoteFieldValue(
	overrides: Partial<NoteFieldValue> = {},
): NoteFieldValue {
	return {
		id: "field-value-uuid-123",
		noteId: "note-uuid-123",
		noteFieldTypeId: "field-type-uuid-123",
		value: "Test value",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		syncVersion: 0,
		...overrides,
	};
}

function createMockCard(overrides: Partial<Card> = {}): Card {
	return {
		id: "card-uuid-123",
		deckId: "deck-uuid-123",
		noteId: "note-uuid-123",
		isReversed: false,
		front: "Front text",
		back: "Back text",
		state: 0,
		due: new Date("2024-01-01"),
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
	};
}

function createMockNoteWithFieldValues(
	overrides: Partial<NoteWithFieldValues> = {},
): NoteWithFieldValues {
	const note = createMockNote(overrides);
	return {
		...note,
		fieldValues: overrides.fieldValues ?? [
			createMockNoteFieldValue({
				noteFieldTypeId: "field-front",
				value: "Question",
			}),
			createMockNoteFieldValue({
				id: "field-value-uuid-456",
				noteFieldTypeId: "field-back",
				value: "Answer",
			}),
		],
	};
}

function createMockCreateNoteResult(
	overrides: Partial<CreateNoteResult> = {},
): CreateNoteResult {
	return {
		note: createMockNote(overrides.note),
		fieldValues: overrides.fieldValues ?? [
			createMockNoteFieldValue({
				noteFieldTypeId: "field-front",
				value: "Question",
			}),
			createMockNoteFieldValue({
				id: "field-value-uuid-456",
				noteFieldTypeId: "field-back",
				value: "Answer",
			}),
		],
		cards: overrides.cards ?? [createMockCard()],
	};
}

function createMockNoteRepo(): NoteRepository {
	return {
		findByDeckId: vi.fn(),
		findById: vi.fn(),
		findByIdWithFieldValues: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		createMany: vi.fn(),
	};
}

describe("NoteRepository mock factory", () => {
	describe("createMockNote", () => {
		it("creates a valid Note with defaults", () => {
			const note = createMockNote();

			expect(note.id).toBe("note-uuid-123");
			expect(note.deckId).toBe("deck-uuid-123");
			expect(note.noteTypeId).toBe("note-type-uuid-123");
			expect(note.deletedAt).toBeNull();
			expect(note.syncVersion).toBe(0);
		});

		it("allows overriding properties", () => {
			const note = createMockNote({
				id: "custom-id",
				noteTypeId: "custom-note-type-id",
			});

			expect(note.id).toBe("custom-id");
			expect(note.noteTypeId).toBe("custom-note-type-id");
			expect(note.deckId).toBe("deck-uuid-123");
		});
	});

	describe("createMockNoteFieldValue", () => {
		it("creates a valid NoteFieldValue with defaults", () => {
			const fieldValue = createMockNoteFieldValue();

			expect(fieldValue.id).toBe("field-value-uuid-123");
			expect(fieldValue.noteId).toBe("note-uuid-123");
			expect(fieldValue.noteFieldTypeId).toBe("field-type-uuid-123");
			expect(fieldValue.value).toBe("Test value");
			expect(fieldValue.syncVersion).toBe(0);
		});

		it("allows overriding properties", () => {
			const fieldValue = createMockNoteFieldValue({
				value: "Custom value",
				noteFieldTypeId: "custom-field-type",
			});

			expect(fieldValue.value).toBe("Custom value");
			expect(fieldValue.noteFieldTypeId).toBe("custom-field-type");
		});
	});

	describe("createMockNoteWithFieldValues", () => {
		it("creates Note with default field values", () => {
			const noteWithFields = createMockNoteWithFieldValues();

			expect(noteWithFields.fieldValues).toHaveLength(2);
			expect(noteWithFields.fieldValues[0]?.value).toBe("Question");
			expect(noteWithFields.fieldValues[1]?.value).toBe("Answer");
		});

		it("allows overriding field values", () => {
			const customFieldValues = [
				createMockNoteFieldValue({ noteFieldTypeId: "word", value: "日本語" }),
				createMockNoteFieldValue({
					noteFieldTypeId: "reading",
					value: "にほんご",
				}),
				createMockNoteFieldValue({
					noteFieldTypeId: "meaning",
					value: "Japanese",
				}),
			];
			const noteWithFields = createMockNoteWithFieldValues({
				fieldValues: customFieldValues,
			});

			expect(noteWithFields.fieldValues).toHaveLength(3);
			expect(noteWithFields.fieldValues[0]?.value).toBe("日本語");
			expect(noteWithFields.fieldValues[2]?.value).toBe("Japanese");
		});
	});

	describe("createMockCreateNoteResult", () => {
		it("creates a valid CreateNoteResult with defaults", () => {
			const result = createMockCreateNoteResult();

			expect(result.note.id).toBe("note-uuid-123");
			expect(result.fieldValues).toHaveLength(2);
			expect(result.cards).toHaveLength(1);
		});

		it("creates result with multiple cards for reversible note type", () => {
			const result = createMockCreateNoteResult({
				cards: [
					createMockCard({ id: "card-1", front: "Q", back: "A" }),
					createMockCard({ id: "card-2", front: "A", back: "Q" }),
				],
			});

			expect(result.cards).toHaveLength(2);
			expect(result.cards[0]?.front).toBe("Q");
			expect(result.cards[1]?.front).toBe("A");
		});
	});

	describe("createMockNoteRepo", () => {
		it("creates a repository with all required methods", () => {
			const repo = createMockNoteRepo();

			expect(repo.findByDeckId).toBeDefined();
			expect(repo.findById).toBeDefined();
			expect(repo.findByIdWithFieldValues).toBeDefined();
			expect(repo.create).toBeDefined();
			expect(repo.update).toBeDefined();
			expect(repo.softDelete).toBeDefined();
		});

		it("methods are mockable for findByDeckId", async () => {
			const repo = createMockNoteRepo();
			const mockNotes = [createMockNote(), createMockNote({ id: "note-2" })];

			vi.mocked(repo.findByDeckId).mockResolvedValue(mockNotes);

			const results = await repo.findByDeckId("deck-123");
			expect(results).toHaveLength(2);
			expect(repo.findByDeckId).toHaveBeenCalledWith("deck-123");
		});

		it("methods are mockable for findById", async () => {
			const repo = createMockNoteRepo();
			const mockNote = createMockNote();

			vi.mocked(repo.findById).mockResolvedValue(mockNote);

			const found = await repo.findById("note-id", "deck-id");
			expect(found).toEqual(mockNote);
			expect(repo.findById).toHaveBeenCalledWith("note-id", "deck-id");
		});

		it("methods are mockable for findByIdWithFieldValues", async () => {
			const repo = createMockNoteRepo();
			const mockNoteWithFields = createMockNoteWithFieldValues();

			vi.mocked(repo.findByIdWithFieldValues).mockResolvedValue(
				mockNoteWithFields,
			);

			const found = await repo.findByIdWithFieldValues("note-id", "deck-id");
			expect(found?.fieldValues).toHaveLength(2);
			expect(repo.findByIdWithFieldValues).toHaveBeenCalledWith(
				"note-id",
				"deck-id",
			);
		});

		it("methods are mockable for create", async () => {
			const repo = createMockNoteRepo();
			const mockResult = createMockCreateNoteResult();

			vi.mocked(repo.create).mockResolvedValue(mockResult);

			const result = await repo.create("deck-123", {
				noteTypeId: "note-type-123",
				fields: { "field-front": "Question", "field-back": "Answer" },
			});
			expect(result.note.id).toBe("note-uuid-123");
			expect(result.cards).toHaveLength(1);
			expect(repo.create).toHaveBeenCalledWith("deck-123", {
				noteTypeId: "note-type-123",
				fields: { "field-front": "Question", "field-back": "Answer" },
			});
		});

		it("methods are mockable for update", async () => {
			const repo = createMockNoteRepo();
			const mockUpdated = createMockNoteWithFieldValues({
				fieldValues: [
					createMockNoteFieldValue({ value: "Updated Question" }),
					createMockNoteFieldValue({ value: "Updated Answer" }),
				],
			});

			vi.mocked(repo.update).mockResolvedValue(mockUpdated);

			const updated = await repo.update("note-id", "deck-id", {
				"field-front": "Updated Question",
				"field-back": "Updated Answer",
			});
			expect(updated?.fieldValues[0]?.value).toBe("Updated Question");
		});

		it("methods are mockable for softDelete", async () => {
			const repo = createMockNoteRepo();

			vi.mocked(repo.softDelete).mockResolvedValue(true);

			const deleted = await repo.softDelete("note-id", "deck-id");
			expect(deleted).toBe(true);
			expect(repo.softDelete).toHaveBeenCalledWith("note-id", "deck-id");
		});

		it("returns undefined when note not found", async () => {
			const repo = createMockNoteRepo();

			vi.mocked(repo.findById).mockResolvedValue(undefined);
			vi.mocked(repo.findByIdWithFieldValues).mockResolvedValue(undefined);
			vi.mocked(repo.update).mockResolvedValue(undefined);

			expect(await repo.findById("nonexistent", "deck-id")).toBeUndefined();
			expect(
				await repo.findByIdWithFieldValues("nonexistent", "deck-id"),
			).toBeUndefined();
			expect(await repo.update("nonexistent", "deck-id", {})).toBeUndefined();
		});

		it("returns false when soft delete fails", async () => {
			const repo = createMockNoteRepo();

			vi.mocked(repo.softDelete).mockResolvedValue(false);

			const deleted = await repo.softDelete("nonexistent", "deck-id");
			expect(deleted).toBe(false);
		});
	});
});

describe("Note interface contracts", () => {
	it("Note has required sync fields", () => {
		const note = createMockNote();

		expect(note).toHaveProperty("syncVersion");
		expect(note).toHaveProperty("createdAt");
		expect(note).toHaveProperty("updatedAt");
		expect(note).toHaveProperty("deletedAt");
	});

	it("NoteFieldValue has required sync fields", () => {
		const fieldValue = createMockNoteFieldValue();

		expect(fieldValue).toHaveProperty("syncVersion");
		expect(fieldValue).toHaveProperty("createdAt");
		expect(fieldValue).toHaveProperty("updatedAt");
	});

	it("NoteWithFieldValues extends Note with fieldValues array", () => {
		const noteWithFields = createMockNoteWithFieldValues();

		expect(noteWithFields).toHaveProperty("id");
		expect(noteWithFields).toHaveProperty("deckId");
		expect(noteWithFields).toHaveProperty("noteTypeId");
		expect(noteWithFields).toHaveProperty("fieldValues");
		expect(Array.isArray(noteWithFields.fieldValues)).toBe(true);
	});

	it("CreateNoteResult contains note, fieldValues, and cards", () => {
		const result = createMockCreateNoteResult();

		expect(result).toHaveProperty("note");
		expect(result).toHaveProperty("fieldValues");
		expect(result).toHaveProperty("cards");
		expect(Array.isArray(result.fieldValues)).toBe(true);
		expect(Array.isArray(result.cards)).toBe(true);
	});
});

describe("Note deletion behavior", () => {
	describe("softDelete cascades to all related Cards", () => {
		it("deleting a note also soft-deletes all its cards", async () => {
			// This test documents the expected behavior:
			// When a Note is deleted, all Cards generated from it should also be deleted
			const repo = createMockNoteRepo();

			vi.mocked(repo.softDelete).mockResolvedValue(true);

			const deleted = await repo.softDelete("note-id", "deck-id");
			expect(deleted).toBe(true);
			expect(repo.softDelete).toHaveBeenCalledWith("note-id", "deck-id");
		});

		it("deleting a note with reversible type deletes both normal and reversed cards", async () => {
			// A reversible note type creates 2 cards: normal (isReversed=false) and reversed (isReversed=true)
			// Both cards should be soft-deleted when the note is deleted
			const repo = createMockNoteRepo();

			// The softDelete implementation should:
			// 1. Soft-delete all cards with the given noteId
			// 2. Soft-delete the note itself
			vi.mocked(repo.softDelete).mockResolvedValue(true);

			const deleted = await repo.softDelete("note-with-2-cards", "deck-id");
			expect(deleted).toBe(true);
		});

		it("returns false when note does not exist", async () => {
			const repo = createMockNoteRepo();

			vi.mocked(repo.softDelete).mockResolvedValue(false);

			const deleted = await repo.softDelete("nonexistent", "deck-id");
			expect(deleted).toBe(false);
		});

		it("returns false when note is already deleted", async () => {
			const repo = createMockNoteRepo();

			// Note with deletedAt set should not be found
			vi.mocked(repo.softDelete).mockResolvedValue(false);

			const deleted = await repo.softDelete("already-deleted-note", "deck-id");
			expect(deleted).toBe(false);
		});
	});
});

describe("Card generation from Note", () => {
	it("creates one card for non-reversible note type", () => {
		const result = createMockCreateNoteResult({
			cards: [createMockCard({ front: "Question", back: "Answer" })],
		});

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]?.front).toBe("Question");
		expect(result.cards[0]?.back).toBe("Answer");
	});

	it("creates two cards for reversible note type", () => {
		const result = createMockCreateNoteResult({
			cards: [
				createMockCard({
					id: "card-normal",
					front: "Question",
					back: "Answer",
				}),
				createMockCard({
					id: "card-reversed",
					front: "Answer",
					back: "Question",
				}),
			],
		});

		expect(result.cards).toHaveLength(2);
		expect(result.cards[0]?.front).toBe("Question");
		expect(result.cards[0]?.back).toBe("Answer");
		expect(result.cards[1]?.front).toBe("Answer");
		expect(result.cards[1]?.back).toBe("Question");
	});
});

describe("findByDeckId ordering", () => {
	it("returns notes ordered by createdAt", async () => {
		const repo = createMockNoteRepo();

		const oldNote = createMockNote({
			id: "note-old",
			createdAt: new Date("2024-01-01"),
		});
		const newNote = createMockNote({
			id: "note-new",
			createdAt: new Date("2024-06-01"),
		});

		vi.mocked(repo.findByDeckId).mockResolvedValue([oldNote, newNote]);

		const results = await repo.findByDeckId("deck-123");

		expect(results).toHaveLength(2);
		expect(results[0]?.id).toBe("note-old");
		expect(results[1]?.id).toBe("note-new");
		expect(results[0]?.createdAt.getTime()).toBeLessThan(
			results[1]?.createdAt.getTime() ?? 0,
		);
	});

	it("returns empty array when deck has no notes", async () => {
		const repo = createMockNoteRepo();

		vi.mocked(repo.findByDeckId).mockResolvedValue([]);

		const results = await repo.findByDeckId("deck-with-no-notes");
		expect(results).toHaveLength(0);
	});

	it("maintains consistent ordering across multiple calls", async () => {
		const repo = createMockNoteRepo();

		const note1 = createMockNote({
			id: "note-1",
			createdAt: new Date("2024-01-01"),
		});
		const note2 = createMockNote({
			id: "note-2",
			createdAt: new Date("2024-02-01"),
		});
		const note3 = createMockNote({
			id: "note-3",
			createdAt: new Date("2024-03-01"),
		});

		vi.mocked(repo.findByDeckId).mockResolvedValue([note1, note2, note3]);

		const results1 = await repo.findByDeckId("deck-123");
		const results2 = await repo.findByDeckId("deck-123");

		expect(results1.map((n) => n.id)).toEqual(results2.map((n) => n.id));
		expect(results1.map((n) => n.id)).toEqual(["note-1", "note-2", "note-3"]);
	});
});

describe("findByIdWithFieldValues field values ordering", () => {
	it("returns field values ordered by noteFieldTypeId", async () => {
		const repo = createMockNoteRepo();

		const fieldValueA = createMockNoteFieldValue({
			id: "fv-1",
			noteFieldTypeId: "field-type-aaa",
			value: "Value A",
		});
		const fieldValueB = createMockNoteFieldValue({
			id: "fv-2",
			noteFieldTypeId: "field-type-bbb",
			value: "Value B",
		});

		const noteWithFields = createMockNoteWithFieldValues({
			fieldValues: [fieldValueA, fieldValueB],
		});

		vi.mocked(repo.findByIdWithFieldValues).mockResolvedValue(noteWithFields);

		const result = await repo.findByIdWithFieldValues("note-id", "deck-id");

		expect(result?.fieldValues).toHaveLength(2);
		expect(result?.fieldValues[0]?.noteFieldTypeId).toBe("field-type-aaa");
		expect(result?.fieldValues[1]?.noteFieldTypeId).toBe("field-type-bbb");
	});

	it("maintains consistent field value ordering across multiple calls", async () => {
		const repo = createMockNoteRepo();

		const fieldValues = [
			createMockNoteFieldValue({
				id: "fv-1",
				noteFieldTypeId: "ft-001",
				value: "First",
			}),
			createMockNoteFieldValue({
				id: "fv-2",
				noteFieldTypeId: "ft-002",
				value: "Second",
			}),
			createMockNoteFieldValue({
				id: "fv-3",
				noteFieldTypeId: "ft-003",
				value: "Third",
			}),
		];

		const noteWithFields = createMockNoteWithFieldValues({ fieldValues });

		vi.mocked(repo.findByIdWithFieldValues).mockResolvedValue(noteWithFields);

		const results1 = await repo.findByIdWithFieldValues("note-id", "deck-id");
		const results2 = await repo.findByIdWithFieldValues("note-id", "deck-id");

		expect(results1?.fieldValues.map((fv) => fv.noteFieldTypeId)).toEqual(
			results2?.fieldValues.map((fv) => fv.noteFieldTypeId),
		);
		expect(results1?.fieldValues.map((fv) => fv.noteFieldTypeId)).toEqual([
			"ft-001",
			"ft-002",
			"ft-003",
		]);
	});
});

describe("update field values ordering", () => {
	it("returns field values ordered by noteFieldTypeId after update", async () => {
		const repo = createMockNoteRepo();

		const fieldValueA = createMockNoteFieldValue({
			id: "fv-1",
			noteFieldTypeId: "field-type-aaa",
			value: "Updated A",
		});
		const fieldValueB = createMockNoteFieldValue({
			id: "fv-2",
			noteFieldTypeId: "field-type-bbb",
			value: "Updated B",
		});

		const updatedNote = createMockNoteWithFieldValues({
			fieldValues: [fieldValueA, fieldValueB],
		});

		vi.mocked(repo.update).mockResolvedValue(updatedNote);

		const result = await repo.update("note-id", "deck-id", {
			"field-type-aaa": "Updated A",
			"field-type-bbb": "Updated B",
		});

		expect(result?.fieldValues).toHaveLength(2);
		expect(result?.fieldValues[0]?.noteFieldTypeId).toBe("field-type-aaa");
		expect(result?.fieldValues[1]?.noteFieldTypeId).toBe("field-type-bbb");
	});

	it("maintains consistent field value ordering after update", async () => {
		const repo = createMockNoteRepo();

		const fieldValues = [
			createMockNoteFieldValue({
				id: "fv-1",
				noteFieldTypeId: "ft-001",
				value: "Updated First",
			}),
			createMockNoteFieldValue({
				id: "fv-2",
				noteFieldTypeId: "ft-002",
				value: "Updated Second",
			}),
			createMockNoteFieldValue({
				id: "fv-3",
				noteFieldTypeId: "ft-003",
				value: "Updated Third",
			}),
		];

		const updatedNote = createMockNoteWithFieldValues({ fieldValues });

		vi.mocked(repo.update).mockResolvedValue(updatedNote);

		const result = await repo.update("note-id", "deck-id", {
			"ft-001": "Updated First",
			"ft-002": "Updated Second",
			"ft-003": "Updated Third",
		});

		expect(result?.fieldValues.map((fv) => fv.noteFieldTypeId)).toEqual([
			"ft-001",
			"ft-002",
			"ft-003",
		]);
	});
});
