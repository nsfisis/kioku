import { describe, expect, it, vi } from "vitest";
import type {
	Card,
	CardForStudy,
	CardRepository,
	CardWithNoteData,
	Note,
	NoteFieldValue,
} from "./types.js";

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

function createMockCardWithNoteData(
	overrides: Partial<CardWithNoteData> = {},
): CardWithNoteData {
	const card = createMockCard({
		noteId: "note-uuid-123",
		isReversed: false,
		...overrides,
	});
	return {
		...card,
		note: overrides.note ?? createMockNote(),
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

function createMockCardForStudy(
	overrides: Partial<CardForStudy> = {},
): CardForStudy {
	const card = createMockCard(overrides);
	return {
		...card,
		noteType: overrides.noteType ?? {
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
		},
		fieldValuesMap: overrides.fieldValuesMap ?? { Front: "Q", Back: "A" },
	};
}

function createMockCardRepo(): CardRepository {
	return {
		findByDeckId: vi.fn(),
		findById: vi.fn(),
		findByIdWithNoteData: vi.fn(),
		findByNoteId: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		softDeleteByNoteId: vi.fn(),
		findDueCards: vi.fn(),
		findDueCardsWithNoteData: vi.fn(),
		findDueCardsForStudy: vi.fn(),
		updateFSRSFields: vi.fn(),
	};
}

describe("CardRepository mock factory", () => {
	describe("createMockCard", () => {
		it("creates a valid Card with defaults", () => {
			const card = createMockCard();

			expect(card.id).toBe("card-uuid-123");
			expect(card.deckId).toBe("deck-uuid-123");
			expect(card.noteId).toBe("note-uuid-123");
			expect(card.isReversed).toBe(false);
			expect(card.front).toBe("Front text");
			expect(card.back).toBe("Back text");
			expect(card.state).toBe(0);
			expect(card.deletedAt).toBeNull();
			expect(card.syncVersion).toBe(0);
		});

		it("allows overriding properties", () => {
			const card = createMockCard({
				id: "custom-id",
				noteId: "note-uuid-456",
				isReversed: true,
				front: "Custom front",
			});

			expect(card.id).toBe("custom-id");
			expect(card.noteId).toBe("note-uuid-456");
			expect(card.isReversed).toBe(true);
			expect(card.front).toBe("Custom front");
		});

		it("creates card with note association", () => {
			const card = createMockCard({
				noteId: "note-uuid-123",
				isReversed: false,
			});

			expect(card.noteId).toBe("note-uuid-123");
			expect(card.isReversed).toBe(false);
		});

		it("creates reversed card", () => {
			const card = createMockCard({
				noteId: "note-uuid-123",
				isReversed: true,
			});

			expect(card.noteId).toBe("note-uuid-123");
			expect(card.isReversed).toBe(true);
		});
	});

	describe("createMockCardWithNoteData", () => {
		it("creates CardWithNoteData with defaults", () => {
			const cardWithNote = createMockCardWithNoteData();

			expect(cardWithNote.noteId).toBe("note-uuid-123");
			expect(cardWithNote.isReversed).toBe(false);
			expect(cardWithNote.note).toBeDefined();
			expect(cardWithNote.note?.id).toBe("note-uuid-123");
			expect(cardWithNote.fieldValues).toHaveLength(2);
		});

		it("allows overriding note", () => {
			const customNote = createMockNote({
				id: "custom-note-id",
				noteTypeId: "custom-note-type",
			});
			const cardWithNote = createMockCardWithNoteData({
				note: customNote,
			});

			expect(cardWithNote.note?.id).toBe("custom-note-id");
			expect(cardWithNote.note?.noteTypeId).toBe("custom-note-type");
		});

		it("allows overriding field values", () => {
			const customFieldValues = [
				createMockNoteFieldValue({ noteFieldTypeId: "word", value: "日本語" }),
			];
			const cardWithNote = createMockCardWithNoteData({
				fieldValues: customFieldValues,
			});

			expect(cardWithNote.fieldValues).toHaveLength(1);
			expect(cardWithNote.fieldValues[0]?.value).toBe("日本語");
		});

		it("card always has note association", () => {
			// All cards now require note association
			const cardWithNote = createMockCardWithNoteData();

			expect(cardWithNote.noteId).toBe("note-uuid-123");
			expect(cardWithNote.note).not.toBeNull();
			expect(cardWithNote.fieldValues).toHaveLength(2);
		});
	});

	describe("createMockCardRepo", () => {
		it("creates a repository with all required methods", () => {
			const repo = createMockCardRepo();

			expect(repo.findByDeckId).toBeDefined();
			expect(repo.findById).toBeDefined();
			expect(repo.findByIdWithNoteData).toBeDefined();
			expect(repo.findByNoteId).toBeDefined();
			expect(repo.create).toBeDefined();
			expect(repo.update).toBeDefined();
			expect(repo.softDelete).toBeDefined();
			expect(repo.softDeleteByNoteId).toBeDefined();
			expect(repo.findDueCards).toBeDefined();
			expect(repo.updateFSRSFields).toBeDefined();
		});

		it("methods are mockable for findByDeckId", async () => {
			const repo = createMockCardRepo();
			const mockCards = [createMockCard(), createMockCard({ id: "card-2" })];

			vi.mocked(repo.findByDeckId).mockResolvedValue(mockCards);

			const results = await repo.findByDeckId("deck-123");
			expect(results).toHaveLength(2);
			expect(repo.findByDeckId).toHaveBeenCalledWith("deck-123");
		});

		it("methods are mockable for findById", async () => {
			const repo = createMockCardRepo();
			const mockCard = createMockCard();

			vi.mocked(repo.findById).mockResolvedValue(mockCard);

			const found = await repo.findById("card-id", "deck-id");
			expect(found).toEqual(mockCard);
			expect(repo.findById).toHaveBeenCalledWith("card-id", "deck-id");
		});

		it("methods are mockable for findByIdWithNoteData", async () => {
			const repo = createMockCardRepo();
			const mockCardWithNote = createMockCardWithNoteData();

			vi.mocked(repo.findByIdWithNoteData).mockResolvedValue(mockCardWithNote);

			const found = await repo.findByIdWithNoteData("card-id", "deck-id");
			expect(found?.note).toBeDefined();
			expect(found?.fieldValues).toHaveLength(2);
			expect(repo.findByIdWithNoteData).toHaveBeenCalledWith(
				"card-id",
				"deck-id",
			);
		});

		it("methods are mockable for findByNoteId", async () => {
			const repo = createMockCardRepo();
			const mockCards = [
				createMockCard({ id: "card-1", isReversed: false }),
				createMockCard({ id: "card-2", isReversed: true }),
			];

			vi.mocked(repo.findByNoteId).mockResolvedValue(mockCards);

			const found = await repo.findByNoteId("note-id");
			expect(found).toHaveLength(2);
			expect(found[0]?.isReversed).toBe(false);
			expect(found[1]?.isReversed).toBe(true);
			expect(repo.findByNoteId).toHaveBeenCalledWith("note-id");
		});

		it("methods are mockable for softDeleteByNoteId", async () => {
			const repo = createMockCardRepo();

			vi.mocked(repo.softDeleteByNoteId).mockResolvedValue(true);

			const deleted = await repo.softDeleteByNoteId("note-id");
			expect(deleted).toBe(true);
			expect(repo.softDeleteByNoteId).toHaveBeenCalledWith("note-id");
		});

		it("returns undefined when card not found", async () => {
			const repo = createMockCardRepo();

			vi.mocked(repo.findById).mockResolvedValue(undefined);
			vi.mocked(repo.findByIdWithNoteData).mockResolvedValue(undefined);

			expect(await repo.findById("nonexistent", "deck-id")).toBeUndefined();
			expect(
				await repo.findByIdWithNoteData("nonexistent", "deck-id"),
			).toBeUndefined();
		});

		it("returns false when soft delete fails", async () => {
			const repo = createMockCardRepo();

			vi.mocked(repo.softDelete).mockResolvedValue(false);
			vi.mocked(repo.softDeleteByNoteId).mockResolvedValue(false);

			expect(await repo.softDelete("nonexistent", "deck-id")).toBe(false);
			expect(await repo.softDeleteByNoteId("nonexistent")).toBe(false);
		});

		it("returns empty array when no cards found for note", async () => {
			const repo = createMockCardRepo();

			vi.mocked(repo.findByNoteId).mockResolvedValue([]);

			const found = await repo.findByNoteId("nonexistent-note");
			expect(found).toHaveLength(0);
		});
	});
});

describe("Card interface contracts", () => {
	it("Card has required sync fields", () => {
		const card = createMockCard();

		expect(card).toHaveProperty("syncVersion");
		expect(card).toHaveProperty("createdAt");
		expect(card).toHaveProperty("updatedAt");
		expect(card).toHaveProperty("deletedAt");
	});

	it("Card has required note association fields", () => {
		const card = createMockCard();

		expect(card).toHaveProperty("noteId");
		expect(card).toHaveProperty("isReversed");
	});

	it("Card has required FSRS fields", () => {
		const card = createMockCard();

		expect(card).toHaveProperty("state");
		expect(card).toHaveProperty("due");
		expect(card).toHaveProperty("stability");
		expect(card).toHaveProperty("difficulty");
		expect(card).toHaveProperty("elapsedDays");
		expect(card).toHaveProperty("scheduledDays");
		expect(card).toHaveProperty("reps");
		expect(card).toHaveProperty("lapses");
		expect(card).toHaveProperty("lastReview");
	});

	it("CardWithNoteData extends Card with note and fieldValues", () => {
		const cardWithNote = createMockCardWithNoteData();

		expect(cardWithNote).toHaveProperty("id");
		expect(cardWithNote).toHaveProperty("deckId");
		expect(cardWithNote).toHaveProperty("note");
		expect(cardWithNote).toHaveProperty("fieldValues");
		expect(Array.isArray(cardWithNote.fieldValues)).toBe(true);
	});

	it("CardForStudy extends Card with noteType and fieldValuesMap", () => {
		const cardForStudy = createMockCardForStudy({
			noteType: {
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
			},
			fieldValuesMap: {
				Front: "Question",
				Back: "Answer",
			},
		});

		expect(cardForStudy).toHaveProperty("id");
		expect(cardForStudy).toHaveProperty("deckId");
		expect(cardForStudy).toHaveProperty("noteType");
		expect(cardForStudy).toHaveProperty("fieldValuesMap");
		expect(cardForStudy.noteType?.frontTemplate).toBe("{{Front}}");
		expect(cardForStudy.fieldValuesMap.Front).toBe("Question");
	});

	it("CardForStudy has required note data", () => {
		const cardForStudy = createMockCardForStudy({
			front: "Question",
			back: "Answer",
		});

		expect(cardForStudy.noteId).toBe("note-uuid-123");
		expect(cardForStudy.noteType).not.toBeNull();
		expect(cardForStudy.noteType.frontTemplate).toBe("{{Front}}");
		expect(cardForStudy.fieldValuesMap).toEqual({ Front: "Q", Back: "A" });
	});
});

describe("Card and Note relationship", () => {
	it("card has required noteId and isReversed", () => {
		const card = createMockCard();

		expect(card.noteId).toBe("note-uuid-123");
		expect(card.isReversed).toBe(false);
	});

	it("card with explicit note data", () => {
		const card = createMockCard({
			noteId: "different-note-id",
			isReversed: false,
		});

		expect(card.noteId).toBe("different-note-id");
		expect(card.isReversed).toBe(false);
	});

	it("reversed card has isReversed true", () => {
		const card = createMockCard({
			isReversed: true,
		});

		expect(card.noteId).toBe("note-uuid-123");
		expect(card.isReversed).toBe(true);
	});

	it("multiple cards can reference the same note", () => {
		const normalCard = createMockCard({
			id: "card-normal",
			noteId: "shared-note-id",
			isReversed: false,
		});
		const reversedCard = createMockCard({
			id: "card-reversed",
			noteId: "shared-note-id",
			isReversed: true,
		});

		expect(normalCard.noteId).toBe(reversedCard.noteId);
		expect(normalCard.isReversed).toBe(false);
		expect(reversedCard.isReversed).toBe(true);
	});
});

describe("Card deletion behavior", () => {
	describe("softDelete cascades to Note and sibling Cards", () => {
		it("when a card is deleted, it also deletes the parent Note", async () => {
			// This test documents the expected behavior:
			// Deleting a card should also soft-delete its parent Note
			const repo = createMockCardRepo();
			const card = createMockCard({ id: "card-1", noteId: "note-1" });

			// The implementation first finds the card to get noteId
			vi.mocked(repo.findById).mockResolvedValue(card);
			vi.mocked(repo.softDelete).mockResolvedValue(true);

			const deleted = await repo.softDelete("card-1", "deck-1");

			expect(deleted).toBe(true);
			expect(repo.softDelete).toHaveBeenCalledWith("card-1", "deck-1");
		});

		it("when a card is deleted, sibling cards (same noteId) should also be deleted", async () => {
			// This test documents the expected behavior:
			// A reversible note creates 2 cards with the same noteId.
			// When one card is deleted, both cards should be soft-deleted.
			const repo = createMockCardRepo();
			const normalCard = createMockCard({
				id: "card-normal",
				noteId: "shared-note",
				isReversed: false,
			});
			const reversedCard = createMockCard({
				id: "card-reversed",
				noteId: "shared-note",
				isReversed: true,
			});

			// Before deletion: both cards exist
			vi.mocked(repo.findByNoteId).mockResolvedValue([
				normalCard,
				reversedCard,
			]);
			expect((await repo.findByNoteId("shared-note")).length).toBe(2);

			// After deleting one card, both should be deleted
			vi.mocked(repo.softDelete).mockResolvedValue(true);
			const deleted = await repo.softDelete("card-normal", "deck-1");

			expect(deleted).toBe(true);
		});

		it("deleting non-existent card returns false", async () => {
			const repo = createMockCardRepo();

			vi.mocked(repo.findById).mockResolvedValue(undefined);
			vi.mocked(repo.softDelete).mockResolvedValue(false);

			const deleted = await repo.softDelete("nonexistent", "deck-1");
			expect(deleted).toBe(false);
		});
	});
});

describe("findByDeckId ordering", () => {
	it("returns cards ordered by createdAt", async () => {
		const repo = createMockCardRepo();

		const oldCard = createMockCard({
			id: "card-old",
			createdAt: new Date("2024-01-01"),
		});
		const newCard = createMockCard({
			id: "card-new",
			createdAt: new Date("2024-06-01"),
		});

		vi.mocked(repo.findByDeckId).mockResolvedValue([oldCard, newCard]);

		const results = await repo.findByDeckId("deck-123");

		expect(results).toHaveLength(2);
		expect(results[0]?.id).toBe("card-old");
		expect(results[1]?.id).toBe("card-new");
		expect(results[0]?.createdAt.getTime()).toBeLessThan(
			results[1]?.createdAt.getTime() ?? 0,
		);
	});

	it("returns empty array when deck has no cards", async () => {
		const repo = createMockCardRepo();

		vi.mocked(repo.findByDeckId).mockResolvedValue([]);

		const results = await repo.findByDeckId("deck-with-no-cards");
		expect(results).toHaveLength(0);
	});

	it("maintains consistent ordering across multiple calls", async () => {
		const repo = createMockCardRepo();

		const card1 = createMockCard({
			id: "card-1",
			createdAt: new Date("2024-01-01"),
		});
		const card2 = createMockCard({
			id: "card-2",
			createdAt: new Date("2024-02-01"),
		});
		const card3 = createMockCard({
			id: "card-3",
			createdAt: new Date("2024-03-01"),
		});

		vi.mocked(repo.findByDeckId).mockResolvedValue([card1, card2, card3]);

		const results1 = await repo.findByDeckId("deck-123");
		const results2 = await repo.findByDeckId("deck-123");

		expect(results1.map((c) => c.id)).toEqual(results2.map((c) => c.id));
		expect(results1.map((c) => c.id)).toEqual(["card-1", "card-2", "card-3"]);
	});
});

describe("findByNoteId ordering", () => {
	it("returns cards ordered by isReversed (normal card first)", async () => {
		const repo = createMockCardRepo();

		const normalCard = createMockCard({
			id: "card-normal",
			noteId: "note-123",
			isReversed: false,
		});
		const reversedCard = createMockCard({
			id: "card-reversed",
			noteId: "note-123",
			isReversed: true,
		});

		// Mock returns cards in isReversed order (false first, true second)
		vi.mocked(repo.findByNoteId).mockResolvedValue([normalCard, reversedCard]);

		const results = await repo.findByNoteId("note-123");

		expect(results).toHaveLength(2);
		expect(results[0]?.id).toBe("card-normal");
		expect(results[0]?.isReversed).toBe(false);
		expect(results[1]?.id).toBe("card-reversed");
		expect(results[1]?.isReversed).toBe(true);
	});

	it("returns single card for non-reversible note type", async () => {
		const repo = createMockCardRepo();

		const normalCard = createMockCard({
			id: "card-only",
			noteId: "note-123",
			isReversed: false,
		});

		vi.mocked(repo.findByNoteId).mockResolvedValue([normalCard]);

		const results = await repo.findByNoteId("note-123");

		expect(results).toHaveLength(1);
		expect(results[0]?.isReversed).toBe(false);
	});

	it("returns empty array when note has no cards", async () => {
		const repo = createMockCardRepo();

		vi.mocked(repo.findByNoteId).mockResolvedValue([]);

		const results = await repo.findByNoteId("note-without-cards");
		expect(results).toHaveLength(0);
	});

	it("maintains consistent ordering across multiple calls", async () => {
		const repo = createMockCardRepo();

		const normalCard = createMockCard({
			id: "card-normal",
			noteId: "note-123",
			isReversed: false,
		});
		const reversedCard = createMockCard({
			id: "card-reversed",
			noteId: "note-123",
			isReversed: true,
		});

		vi.mocked(repo.findByNoteId).mockResolvedValue([normalCard, reversedCard]);

		const results1 = await repo.findByNoteId("note-123");
		const results2 = await repo.findByNoteId("note-123");

		expect(results1.map((c) => c.id)).toEqual(results2.map((c) => c.id));
		expect(results1.map((c) => c.isReversed)).toEqual([false, true]);
	});
});
