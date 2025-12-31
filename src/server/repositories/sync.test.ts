import { describe, expect, it, vi } from "vitest";
import type { SyncPullResult, SyncPushResult, SyncRepository } from "./sync.js";
import type {
	Card,
	Deck,
	Note,
	NoteFieldType,
	NoteFieldValue,
	NoteType,
	ReviewLog,
} from "./types.js";

function createMockDeck(overrides: Partial<Deck> = {}): Deck {
	return {
		id: "deck-uuid-123",
		userId: "user-uuid-123",
		name: "Test Deck",
		description: null,
		newCardsPerDay: 20,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 1,
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
		syncVersion: 1,
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
		syncVersion: 1,
		...overrides,
	};
}

function createMockNoteType(overrides: Partial<NoteType> = {}): NoteType {
	return {
		id: "note-type-uuid-123",
		userId: "user-uuid-123",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 1,
		...overrides,
	};
}

function createMockNoteFieldType(
	overrides: Partial<NoteFieldType> = {},
): NoteFieldType {
	return {
		id: "field-type-uuid-123",
		noteTypeId: "note-type-uuid-123",
		name: "Front",
		order: 0,
		fieldType: "text",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 1,
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
		syncVersion: 1,
		...overrides,
	};
}

function createMockReviewLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
	return {
		id: "review-log-uuid-123",
		cardId: "card-uuid-123",
		userId: "user-uuid-123",
		rating: 3,
		state: 2,
		scheduledDays: 1,
		elapsedDays: 0,
		reviewedAt: new Date("2024-01-01"),
		durationMs: 5000,
		syncVersion: 1,
		...overrides,
	};
}

function createMockSyncRepo(): SyncRepository {
	return {
		pushChanges: vi.fn(),
		pullChanges: vi.fn(),
	};
}

describe("SyncRepository mock factory", () => {
	describe("createMockSyncRepo", () => {
		it("creates a repository with all required methods", () => {
			const repo = createMockSyncRepo();

			expect(repo.pushChanges).toBeDefined();
			expect(repo.pullChanges).toBeDefined();
		});

		it("methods are mockable for pushChanges", async () => {
			const repo = createMockSyncRepo();
			const mockResult: SyncPushResult = {
				decks: [{ id: "deck-1", syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				crdtChanges: [],
				conflicts: {
					decks: [],
					cards: [],
					noteTypes: [],
					noteFieldTypes: [],
					notes: [],
					noteFieldValues: [],
				},
			};

			vi.mocked(repo.pushChanges).mockResolvedValue(mockResult);

			const result = await repo.pushChanges("user-123", {
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			});

			expect(result.decks).toHaveLength(1);
			expect(repo.pushChanges).toHaveBeenCalledWith(
				"user-123",
				expect.any(Object),
			);
		});

		it("methods are mockable for pullChanges", async () => {
			const repo = createMockSyncRepo();
			const mockResult: SyncPullResult = {
				decks: [createMockDeck()],
				cards: [createMockCard()],
				reviewLogs: [createMockReviewLog()],
				noteTypes: [createMockNoteType()],
				noteFieldTypes: [createMockNoteFieldType()],
				notes: [createMockNote()],
				noteFieldValues: [createMockNoteFieldValue()],
				crdtChanges: [],
				currentSyncVersion: 5,
			};

			vi.mocked(repo.pullChanges).mockResolvedValue(mockResult);

			const result = await repo.pullChanges("user-123", { lastSyncVersion: 0 });

			expect(result.decks).toHaveLength(1);
			expect(result.cards).toHaveLength(1);
			expect(result.currentSyncVersion).toBe(5);
			expect(repo.pullChanges).toHaveBeenCalledWith("user-123", {
				lastSyncVersion: 0,
			});
		});
	});
});

describe("SyncPullResult ordering", () => {
	describe("pullChanges returns entities ordered by id", () => {
		it("returns cards ordered by id", async () => {
			const repo = createMockSyncRepo();

			const cardA = createMockCard({ id: "card-aaa" });
			const cardB = createMockCard({ id: "card-bbb" });
			const cardC = createMockCard({ id: "card-ccc" });

			const mockResult: SyncPullResult = {
				decks: [],
				cards: [cardA, cardB, cardC],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				crdtChanges: [],
				currentSyncVersion: 1,
			};

			vi.mocked(repo.pullChanges).mockResolvedValue(mockResult);

			const result = await repo.pullChanges("user-123", { lastSyncVersion: 0 });

			expect(result.cards).toHaveLength(3);
			expect(result.cards[0]?.id).toBe("card-aaa");
			expect(result.cards[1]?.id).toBe("card-bbb");
			expect(result.cards[2]?.id).toBe("card-ccc");
		});

		it("returns notes ordered by id", async () => {
			const repo = createMockSyncRepo();

			const noteA = createMockNote({ id: "note-aaa" });
			const noteB = createMockNote({ id: "note-bbb" });
			const noteC = createMockNote({ id: "note-ccc" });

			const mockResult: SyncPullResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [noteA, noteB, noteC],
				noteFieldValues: [],
				crdtChanges: [],
				currentSyncVersion: 1,
			};

			vi.mocked(repo.pullChanges).mockResolvedValue(mockResult);

			const result = await repo.pullChanges("user-123", { lastSyncVersion: 0 });

			expect(result.notes).toHaveLength(3);
			expect(result.notes[0]?.id).toBe("note-aaa");
			expect(result.notes[1]?.id).toBe("note-bbb");
			expect(result.notes[2]?.id).toBe("note-ccc");
		});

		it("returns noteFieldTypes ordered by id", async () => {
			const repo = createMockSyncRepo();

			const fieldTypeA = createMockNoteFieldType({ id: "ft-aaa" });
			const fieldTypeB = createMockNoteFieldType({ id: "ft-bbb" });
			const fieldTypeC = createMockNoteFieldType({ id: "ft-ccc" });

			const mockResult: SyncPullResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [fieldTypeA, fieldTypeB, fieldTypeC],
				notes: [],
				noteFieldValues: [],
				crdtChanges: [],
				currentSyncVersion: 1,
			};

			vi.mocked(repo.pullChanges).mockResolvedValue(mockResult);

			const result = await repo.pullChanges("user-123", { lastSyncVersion: 0 });

			expect(result.noteFieldTypes).toHaveLength(3);
			expect(result.noteFieldTypes[0]?.id).toBe("ft-aaa");
			expect(result.noteFieldTypes[1]?.id).toBe("ft-bbb");
			expect(result.noteFieldTypes[2]?.id).toBe("ft-ccc");
		});

		it("returns noteFieldValues ordered by id", async () => {
			const repo = createMockSyncRepo();

			const fieldValueA = createMockNoteFieldValue({ id: "fv-aaa" });
			const fieldValueB = createMockNoteFieldValue({ id: "fv-bbb" });
			const fieldValueC = createMockNoteFieldValue({ id: "fv-ccc" });

			const mockResult: SyncPullResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [fieldValueA, fieldValueB, fieldValueC],
				crdtChanges: [],
				currentSyncVersion: 1,
			};

			vi.mocked(repo.pullChanges).mockResolvedValue(mockResult);

			const result = await repo.pullChanges("user-123", { lastSyncVersion: 0 });

			expect(result.noteFieldValues).toHaveLength(3);
			expect(result.noteFieldValues[0]?.id).toBe("fv-aaa");
			expect(result.noteFieldValues[1]?.id).toBe("fv-bbb");
			expect(result.noteFieldValues[2]?.id).toBe("fv-ccc");
		});

		it("maintains consistent ordering across multiple calls", async () => {
			const repo = createMockSyncRepo();

			const cards = [
				createMockCard({ id: "card-001" }),
				createMockCard({ id: "card-002" }),
				createMockCard({ id: "card-003" }),
			];

			const mockResult: SyncPullResult = {
				decks: [],
				cards,
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				crdtChanges: [],
				currentSyncVersion: 1,
			};

			vi.mocked(repo.pullChanges).mockResolvedValue(mockResult);

			const result1 = await repo.pullChanges("user-123", {
				lastSyncVersion: 0,
			});
			const result2 = await repo.pullChanges("user-123", {
				lastSyncVersion: 0,
			});

			expect(result1.cards.map((c) => c.id)).toEqual(
				result2.cards.map((c) => c.id),
			);
			expect(result1.cards.map((c) => c.id)).toEqual([
				"card-001",
				"card-002",
				"card-003",
			]);
		});

		it("returns empty arrays when no entities to pull", async () => {
			const repo = createMockSyncRepo();

			const mockResult: SyncPullResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				crdtChanges: [],
				currentSyncVersion: 0,
			};

			vi.mocked(repo.pullChanges).mockResolvedValue(mockResult);

			const result = await repo.pullChanges("user-123", { lastSyncVersion: 0 });

			expect(result.cards).toHaveLength(0);
			expect(result.notes).toHaveLength(0);
			expect(result.noteFieldTypes).toHaveLength(0);
			expect(result.noteFieldValues).toHaveLength(0);
		});
	});
});
