/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CardState, db, Rating } from "./index";
import {
	localCardRepository,
	localDeckRepository,
	localNoteFieldTypeRepository,
	localNoteFieldValueRepository,
	localNoteRepository,
	localNoteTypeRepository,
	localReviewLogRepository,
} from "./repositories";

describe("localDeckRepository", () => {
	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
	});

	describe("create", () => {
		it("should create a deck with generated id and timestamps", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: "A test deck",
				newCardsPerDay: 20,
			});

			expect(deck.id).toBeDefined();
			expect(deck.userId).toBe("user-1");
			expect(deck.name).toBe("Test Deck");
			expect(deck.description).toBe("A test deck");
			expect(deck.newCardsPerDay).toBe(20);
			expect(deck.createdAt).toBeInstanceOf(Date);
			expect(deck.updatedAt).toBeInstanceOf(Date);
			expect(deck.deletedAt).toBeNull();
			expect(deck.syncVersion).toBe(0);
			expect(deck._synced).toBe(false);
		});

		it("should persist the deck to the database", async () => {
			const created = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 10,
			});

			const found = await db.decks.get(created.id);
			expect(found).toEqual(created);
		});
	});

	describe("findById", () => {
		it("should return the deck if found", async () => {
			const created = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const found = await localDeckRepository.findById(created.id);
			expect(found).toEqual(created);
		});

		it("should return undefined if not found", async () => {
			const found = await localDeckRepository.findById("non-existent");
			expect(found).toBeUndefined();
		});
	});

	describe("findByUserId", () => {
		it("should return all decks for a user", async () => {
			await localDeckRepository.create({
				userId: "user-1",
				name: "Deck 1",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.create({
				userId: "user-1",
				name: "Deck 2",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.create({
				userId: "user-2",
				name: "Other User Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const decks = await localDeckRepository.findByUserId("user-1");
			expect(decks).toHaveLength(2);
			expect(decks.map((d) => d.name).sort()).toEqual(["Deck 1", "Deck 2"]);
		});

		it("should exclude soft-deleted decks", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Deleted Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.delete(deck.id);

			const decks = await localDeckRepository.findByUserId("user-1");
			expect(decks).toHaveLength(0);
		});
	});

	describe("update", () => {
		it("should update deck fields", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Original Name",
				description: null,
				newCardsPerDay: 20,
			});

			const updated = await localDeckRepository.update(deck.id, {
				name: "Updated Name",
				description: "New description",
			});

			expect(updated?.name).toBe("Updated Name");
			expect(updated?.description).toBe("New description");
			expect(updated?._synced).toBe(false);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				deck.updatedAt.getTime(),
			);
		});

		it("should return undefined for non-existent deck", async () => {
			const updated = await localDeckRepository.update("non-existent", {
				name: "New Name",
			});
			expect(updated).toBeUndefined();
		});
	});

	describe("delete", () => {
		it("should soft delete a deck", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const result = await localDeckRepository.delete(deck.id);
			expect(result).toBe(true);

			const found = await localDeckRepository.findById(deck.id);
			expect(found?.deletedAt).not.toBeNull();
			expect(found?._synced).toBe(false);
		});

		it("should return false for non-existent deck", async () => {
			const result = await localDeckRepository.delete("non-existent");
			expect(result).toBe(false);
		});
	});

	describe("findUnsynced", () => {
		it("should return unsynced decks", async () => {
			const deck1 = await localDeckRepository.create({
				userId: "user-1",
				name: "Unsynced",
				description: null,
				newCardsPerDay: 20,
			});
			const deck2 = await localDeckRepository.create({
				userId: "user-1",
				name: "Synced",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.markSynced(deck2.id, 1);

			const unsynced = await localDeckRepository.findUnsynced();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe(deck1.id);
		});
	});

	describe("markSynced", () => {
		it("should mark a deck as synced with version", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test",
				description: null,
				newCardsPerDay: 20,
			});

			await localDeckRepository.markSynced(deck.id, 5);

			const found = await localDeckRepository.findById(deck.id);
			expect(found?._synced).toBe(true);
			expect(found?.syncVersion).toBe(5);
		});
	});
});

describe("localCardRepository", () => {
	let deckId: string;

	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();

		const deck = await localDeckRepository.create({
			userId: "user-1",
			name: "Test Deck",
			description: null,
			newCardsPerDay: 20,
		});
		deckId = deck.id;
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
	});

	describe("create", () => {
		it("should create a card with FSRS defaults", async () => {
			const card = await localCardRepository.create({
				deckId,
				noteId: "test-note-id",
				isReversed: false,
				front: "Question",
				back: "Answer",
			});

			expect(card.id).toBeDefined();
			expect(card.deckId).toBe(deckId);
			expect(card.front).toBe("Question");
			expect(card.back).toBe("Answer");
			expect(card.state).toBe(CardState.New);
			expect(card.stability).toBe(0);
			expect(card.difficulty).toBe(0);
			expect(card.reps).toBe(0);
			expect(card.lapses).toBe(0);
			expect(card.lastReview).toBeNull();
			expect(card._synced).toBe(false);
		});
	});

	describe("findByDeckId", () => {
		it("should return all cards for a deck", async () => {
			await localCardRepository.create({
				deckId,
				noteId: "test-note-id",
				isReversed: false,
				front: "Q1",
				back: "A1",
			});
			await localCardRepository.create({
				deckId,
				noteId: "test-note-id-2",
				isReversed: false,
				front: "Q2",
				back: "A2",
			});

			const cards = await localCardRepository.findByDeckId(deckId);
			expect(cards).toHaveLength(2);
		});

		it("should exclude soft-deleted cards", async () => {
			const card = await localCardRepository.create({
				deckId,
				noteId: "test-note-id",
				isReversed: false,
				front: "Q",
				back: "A",
			});
			await localCardRepository.delete(card.id);

			const cards = await localCardRepository.findByDeckId(deckId);
			expect(cards).toHaveLength(0);
		});
	});

	describe("findDueCards", () => {
		it("should return cards that are due", async () => {
			const pastDue = new Date(Date.now() - 60000);
			// Use a date far enough in the future to be beyond the next 3 AM boundary
			const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

			const card1 = await localCardRepository.create({
				deckId,
				noteId: "test-note-id",
				isReversed: false,
				front: "Due",
				back: "A",
			});
			await db.cards.update(card1.id, { due: pastDue });

			const card2 = await localCardRepository.create({
				deckId,
				noteId: "test-note-id-2",
				isReversed: false,
				front: "Not Due",
				back: "B",
			});
			await db.cards.update(card2.id, { due: future });

			const dueCards = await localCardRepository.findDueCards(deckId);
			expect(dueCards).toHaveLength(1);
			expect(dueCards[0]?.front).toBe("Due");
		});

		it("should respect limit parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await localCardRepository.create({
					deckId,
					noteId: `test-note-id-${i}`,
					isReversed: false,
					front: `Q${i}`,
					back: `A${i}`,
				});
			}

			const dueCards = await localCardRepository.findDueCards(deckId, 3);
			expect(dueCards).toHaveLength(3);
		});
	});

	describe("findNewCards", () => {
		it("should return only new cards", async () => {
			await localCardRepository.create({
				deckId,
				noteId: "test-note-id",
				isReversed: false,
				front: "New",
				back: "A",
			});

			const reviewedCard = await localCardRepository.create({
				deckId,
				noteId: "test-note-id-2",
				isReversed: false,
				front: "Reviewed",
				back: "B",
			});
			await db.cards.update(reviewedCard.id, { state: CardState.Review });

			const newCards = await localCardRepository.findNewCards(deckId);
			expect(newCards).toHaveLength(1);
			expect(newCards[0]?.front).toBe("New");
		});
	});

	describe("update", () => {
		it("should update card content", async () => {
			const card = await localCardRepository.create({
				deckId,
				noteId: "test-note-id",
				isReversed: false,
				front: "Original",
				back: "Original",
			});

			const updated = await localCardRepository.update(card.id, {
				front: "Updated Front",
				back: "Updated Back",
			});

			expect(updated?.front).toBe("Updated Front");
			expect(updated?.back).toBe("Updated Back");
			expect(updated?._synced).toBe(false);
		});
	});

	describe("updateScheduling", () => {
		it("should update FSRS scheduling data", async () => {
			const card = await localCardRepository.create({
				deckId,
				noteId: "test-note-id",
				isReversed: false,
				front: "Q",
				back: "A",
			});

			const now = new Date();
			const updated = await localCardRepository.updateScheduling(card.id, {
				state: CardState.Review,
				due: now,
				stability: 10.5,
				difficulty: 5.2,
				elapsedDays: 1,
				scheduledDays: 5,
				reps: 1,
				lapses: 0,
				lastReview: now,
			});

			expect(updated?.state).toBe(CardState.Review);
			expect(updated?.stability).toBe(10.5);
			expect(updated?.difficulty).toBe(5.2);
			expect(updated?.reps).toBe(1);
			expect(updated?._synced).toBe(false);
		});
	});

	describe("delete", () => {
		it("should soft delete a card", async () => {
			const card = await localCardRepository.create({
				deckId,
				noteId: "test-note-id",
				isReversed: false,
				front: "Q",
				back: "A",
			});

			const result = await localCardRepository.delete(card.id);
			expect(result).toBe(true);

			const found = await localCardRepository.findById(card.id);
			expect(found?.deletedAt).not.toBeNull();
		});
	});
});

describe("localReviewLogRepository", () => {
	let deckId: string;
	let cardId: string;

	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();

		const deck = await localDeckRepository.create({
			userId: "user-1",
			name: "Test Deck",
			description: null,
			newCardsPerDay: 20,
		});
		deckId = deck.id;

		const card = await localCardRepository.create({
			deckId,
			noteId: "test-note-id",
			isReversed: false,
			front: "Q",
			back: "A",
		});
		cardId = card.id;
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
	});

	describe("create", () => {
		it("should create a review log", async () => {
			const now = new Date();
			const reviewLog = await localReviewLogRepository.create({
				cardId,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: now,
				durationMs: 5000,
			});

			expect(reviewLog.id).toBeDefined();
			expect(reviewLog.cardId).toBe(cardId);
			expect(reviewLog.rating).toBe(Rating.Good);
			expect(reviewLog._synced).toBe(false);
		});
	});

	describe("findByCardId", () => {
		it("should return all review logs for a card", async () => {
			await localReviewLogRepository.create({
				cardId,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 5000,
			});
			await localReviewLogRepository.create({
				cardId,
				userId: "user-1",
				rating: Rating.Easy,
				state: CardState.Learning,
				scheduledDays: 3,
				elapsedDays: 1,
				reviewedAt: new Date(),
				durationMs: 3000,
			});

			const logs = await localReviewLogRepository.findByCardId(cardId);
			expect(logs).toHaveLength(2);
		});
	});

	describe("findByUserId", () => {
		it("should return all review logs for a user", async () => {
			await localReviewLogRepository.create({
				cardId,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 5000,
			});
			await localReviewLogRepository.create({
				cardId,
				userId: "user-2",
				rating: Rating.Hard,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 4000,
			});

			const logs = await localReviewLogRepository.findByUserId("user-1");
			expect(logs).toHaveLength(1);
			expect(logs[0]?.rating).toBe(Rating.Good);
		});
	});

	describe("findUnsynced", () => {
		it("should return unsynced review logs", async () => {
			const log1 = await localReviewLogRepository.create({
				cardId,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 5000,
			});
			const log2 = await localReviewLogRepository.create({
				cardId,
				userId: "user-1",
				rating: Rating.Easy,
				state: CardState.Learning,
				scheduledDays: 3,
				elapsedDays: 1,
				reviewedAt: new Date(),
				durationMs: 3000,
			});
			await localReviewLogRepository.markSynced(log2.id, 1);

			const unsynced = await localReviewLogRepository.findUnsynced();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe(log1.id);
		});
	});

	describe("findByDateRange", () => {
		it("should return review logs within date range", async () => {
			const yesterday = new Date(Date.now() - 86400000);
			const today = new Date();
			const tomorrow = new Date(Date.now() + 86400000);

			await localReviewLogRepository.create({
				cardId,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: yesterday,
				durationMs: 5000,
			});
			await localReviewLogRepository.create({
				cardId,
				userId: "user-1",
				rating: Rating.Easy,
				state: CardState.Learning,
				scheduledDays: 3,
				elapsedDays: 1,
				reviewedAt: today,
				durationMs: 3000,
			});

			const startOfToday = new Date(today);
			startOfToday.setHours(0, 0, 0, 0);

			const logs = await localReviewLogRepository.findByDateRange(
				"user-1",
				startOfToday,
				tomorrow,
			);
			expect(logs).toHaveLength(1);
			expect(logs[0]?.rating).toBe(Rating.Easy);
		});
	});
});

describe("localNoteTypeRepository", () => {
	beforeEach(async () => {
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();
	});

	afterEach(async () => {
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();
	});

	describe("create", () => {
		it("should create a note type with generated id and timestamps", async () => {
			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});

			expect(noteType.id).toBeDefined();
			expect(noteType.userId).toBe("user-1");
			expect(noteType.name).toBe("Basic");
			expect(noteType.frontTemplate).toBe("{{Front}}");
			expect(noteType.backTemplate).toBe("{{Back}}");
			expect(noteType.isReversible).toBe(false);
			expect(noteType.createdAt).toBeInstanceOf(Date);
			expect(noteType.updatedAt).toBeInstanceOf(Date);
			expect(noteType.deletedAt).toBeNull();
			expect(noteType.syncVersion).toBe(0);
			expect(noteType._synced).toBe(false);
		});

		it("should persist the note type to the database", async () => {
			const created = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});

			const found = await db.noteTypes.get(created.id);
			expect(found).toEqual(created);
		});
	});

	describe("findById", () => {
		it("should return the note type if found", async () => {
			const created = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});

			const found = await localNoteTypeRepository.findById(created.id);
			expect(found).toEqual(created);
		});

		it("should return undefined if not found", async () => {
			const found = await localNoteTypeRepository.findById("non-existent");
			expect(found).toBeUndefined();
		});
	});

	describe("findByUserId", () => {
		it("should return all note types for a user", async () => {
			await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
			await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic (reversed)",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: true,
			});
			await localNoteTypeRepository.create({
				userId: "user-2",
				name: "Other User Type",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});

			const noteTypes = await localNoteTypeRepository.findByUserId("user-1");
			expect(noteTypes).toHaveLength(2);
			expect(noteTypes.map((nt) => nt.name).sort()).toEqual([
				"Basic",
				"Basic (reversed)",
			]);
		});

		it("should exclude soft-deleted note types", async () => {
			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Deleted Type",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
			await localNoteTypeRepository.delete(noteType.id);

			const noteTypes = await localNoteTypeRepository.findByUserId("user-1");
			expect(noteTypes).toHaveLength(0);
		});
	});

	describe("update", () => {
		it("should update note type fields", async () => {
			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Original Name",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});

			const updated = await localNoteTypeRepository.update(noteType.id, {
				name: "Updated Name",
				frontTemplate: "Q: {{Front}}",
				isReversible: true,
			});

			expect(updated?.name).toBe("Updated Name");
			expect(updated?.frontTemplate).toBe("Q: {{Front}}");
			expect(updated?.isReversible).toBe(true);
			expect(updated?._synced).toBe(false);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				noteType.updatedAt.getTime(),
			);
		});

		it("should return undefined for non-existent note type", async () => {
			const updated = await localNoteTypeRepository.update("non-existent", {
				name: "New Name",
			});
			expect(updated).toBeUndefined();
		});
	});

	describe("delete", () => {
		it("should soft delete a note type", async () => {
			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Test Type",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});

			const result = await localNoteTypeRepository.delete(noteType.id);
			expect(result).toBe(true);

			const found = await localNoteTypeRepository.findById(noteType.id);
			expect(found?.deletedAt).not.toBeNull();
			expect(found?._synced).toBe(false);
		});

		it("should return false for non-existent note type", async () => {
			const result = await localNoteTypeRepository.delete("non-existent");
			expect(result).toBe(false);
		});
	});

	describe("findUnsynced", () => {
		it("should return unsynced note types", async () => {
			const noteType1 = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Unsynced",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
			const noteType2 = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Synced",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
			await localNoteTypeRepository.markSynced(noteType2.id, 1);

			const unsynced = await localNoteTypeRepository.findUnsynced();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe(noteType1.id);
		});
	});

	describe("markSynced", () => {
		it("should mark a note type as synced with version", async () => {
			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Test",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});

			await localNoteTypeRepository.markSynced(noteType.id, 5);

			const found = await localNoteTypeRepository.findById(noteType.id);
			expect(found?._synced).toBe(true);
			expect(found?.syncVersion).toBe(5);
		});
	});
});

describe("localNoteFieldTypeRepository", () => {
	let noteTypeId: string;

	beforeEach(async () => {
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();

		const noteType = await localNoteTypeRepository.create({
			userId: "user-1",
			name: "Basic",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
		});
		noteTypeId = noteType.id;
	});

	afterEach(async () => {
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();
	});

	describe("create", () => {
		it("should create a field type with generated id and timestamps", async () => {
			const fieldType = await localNoteFieldTypeRepository.create({
				noteTypeId,
				name: "Front",
				order: 0,
			});

			expect(fieldType.id).toBeDefined();
			expect(fieldType.noteTypeId).toBe(noteTypeId);
			expect(fieldType.name).toBe("Front");
			expect(fieldType.order).toBe(0);
			expect(fieldType.fieldType).toBe("text");
			expect(fieldType.createdAt).toBeInstanceOf(Date);
			expect(fieldType.updatedAt).toBeInstanceOf(Date);
			expect(fieldType.deletedAt).toBeNull();
			expect(fieldType.syncVersion).toBe(0);
			expect(fieldType._synced).toBe(false);
		});
	});

	describe("findByNoteTypeId", () => {
		it("should return all field types for a note type sorted by order", async () => {
			await localNoteFieldTypeRepository.create({
				noteTypeId,
				name: "Back",
				order: 1,
			});
			await localNoteFieldTypeRepository.create({
				noteTypeId,
				name: "Front",
				order: 0,
			});

			const fieldTypes =
				await localNoteFieldTypeRepository.findByNoteTypeId(noteTypeId);
			expect(fieldTypes).toHaveLength(2);
			expect(fieldTypes[0]?.name).toBe("Front");
			expect(fieldTypes[1]?.name).toBe("Back");
		});

		it("should exclude soft-deleted field types", async () => {
			const fieldType = await localNoteFieldTypeRepository.create({
				noteTypeId,
				name: "Deleted",
				order: 0,
			});
			await localNoteFieldTypeRepository.delete(fieldType.id);

			const fieldTypes =
				await localNoteFieldTypeRepository.findByNoteTypeId(noteTypeId);
			expect(fieldTypes).toHaveLength(0);
		});
	});

	describe("update", () => {
		it("should update field type fields", async () => {
			const fieldType = await localNoteFieldTypeRepository.create({
				noteTypeId,
				name: "Original",
				order: 0,
			});

			const updated = await localNoteFieldTypeRepository.update(fieldType.id, {
				name: "Updated",
				order: 1,
			});

			expect(updated?.name).toBe("Updated");
			expect(updated?.order).toBe(1);
			expect(updated?._synced).toBe(false);
		});
	});

	describe("findUnsynced", () => {
		it("should return unsynced field types", async () => {
			const fieldType1 = await localNoteFieldTypeRepository.create({
				noteTypeId,
				name: "Unsynced",
				order: 0,
			});
			const fieldType2 = await localNoteFieldTypeRepository.create({
				noteTypeId,
				name: "Synced",
				order: 1,
			});
			await localNoteFieldTypeRepository.markSynced(fieldType2.id, 1);

			const unsynced = await localNoteFieldTypeRepository.findUnsynced();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe(fieldType1.id);
		});
	});
});

describe("localNoteRepository", () => {
	let deckId: string;
	let noteTypeId: string;

	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();

		const deck = await localDeckRepository.create({
			userId: "user-1",
			name: "Test Deck",
			description: null,
			newCardsPerDay: 20,
		});
		deckId = deck.id;

		const noteType = await localNoteTypeRepository.create({
			userId: "user-1",
			name: "Basic",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
		});
		noteTypeId = noteType.id;
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();
	});

	describe("create", () => {
		it("should create a note with generated id and timestamps", async () => {
			const note = await localNoteRepository.create({
				deckId,
				noteTypeId,
			});

			expect(note.id).toBeDefined();
			expect(note.deckId).toBe(deckId);
			expect(note.noteTypeId).toBe(noteTypeId);
			expect(note.createdAt).toBeInstanceOf(Date);
			expect(note.updatedAt).toBeInstanceOf(Date);
			expect(note.deletedAt).toBeNull();
			expect(note.syncVersion).toBe(0);
			expect(note._synced).toBe(false);
		});
	});

	describe("findByDeckId", () => {
		it("should return all notes for a deck", async () => {
			await localNoteRepository.create({ deckId, noteTypeId });
			await localNoteRepository.create({ deckId, noteTypeId });

			const notes = await localNoteRepository.findByDeckId(deckId);
			expect(notes).toHaveLength(2);
		});

		it("should exclude soft-deleted notes", async () => {
			const note = await localNoteRepository.create({ deckId, noteTypeId });
			await localNoteRepository.delete(note.id);

			const notes = await localNoteRepository.findByDeckId(deckId);
			expect(notes).toHaveLength(0);
		});
	});

	describe("findByNoteTypeId", () => {
		it("should return all notes for a note type", async () => {
			await localNoteRepository.create({ deckId, noteTypeId });

			const notes = await localNoteRepository.findByNoteTypeId(noteTypeId);
			expect(notes).toHaveLength(1);
		});
	});

	describe("update", () => {
		it("should update note metadata", async () => {
			const note = await localNoteRepository.create({ deckId, noteTypeId });

			const updated = await localNoteRepository.update(note.id);

			expect(updated?._synced).toBe(false);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				note.updatedAt.getTime(),
			);
		});

		it("should return undefined for non-existent note", async () => {
			const updated = await localNoteRepository.update("non-existent");
			expect(updated).toBeUndefined();
		});
	});

	describe("delete", () => {
		it("should soft delete a note", async () => {
			const note = await localNoteRepository.create({ deckId, noteTypeId });

			const result = await localNoteRepository.delete(note.id);
			expect(result).toBe(true);

			const found = await localNoteRepository.findById(note.id);
			expect(found?.deletedAt).not.toBeNull();
		});

		it("should cascade soft delete to related cards", async () => {
			const note = await localNoteRepository.create({ deckId, noteTypeId });

			// Create cards associated with this note
			const card1 = await localCardRepository.create({
				deckId,
				front: "Q1",
				back: "A1",
				noteId: note.id,
				isReversed: false,
			});
			const card2 = await localCardRepository.create({
				deckId,
				front: "Q2",
				back: "A2",
				noteId: note.id,
				isReversed: true,
			});

			await localNoteRepository.delete(note.id);

			const foundCard1 = await localCardRepository.findById(card1.id);
			const foundCard2 = await localCardRepository.findById(card2.id);
			expect(foundCard1?.deletedAt).not.toBeNull();
			expect(foundCard2?.deletedAt).not.toBeNull();
		});

		it("should return false for non-existent note", async () => {
			const result = await localNoteRepository.delete("non-existent");
			expect(result).toBe(false);
		});
	});

	describe("findUnsynced", () => {
		it("should return unsynced notes", async () => {
			const note1 = await localNoteRepository.create({ deckId, noteTypeId });
			const note2 = await localNoteRepository.create({ deckId, noteTypeId });
			await localNoteRepository.markSynced(note2.id, 1);

			const unsynced = await localNoteRepository.findUnsynced();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe(note1.id);
		});
	});
});

describe("localNoteFieldValueRepository", () => {
	let noteId: string;
	let noteFieldTypeId: string;
	let noteTypeId: string;

	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();

		const deck = await localDeckRepository.create({
			userId: "user-1",
			name: "Test Deck",
			description: null,
			newCardsPerDay: 20,
		});

		const noteType = await localNoteTypeRepository.create({
			userId: "user-1",
			name: "Basic",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
		});
		noteTypeId = noteType.id;

		const fieldType = await localNoteFieldTypeRepository.create({
			noteTypeId: noteType.id,
			name: "Front",
			order: 0,
		});
		noteFieldTypeId = fieldType.id;

		const note = await localNoteRepository.create({
			deckId: deck.id,
			noteTypeId: noteType.id,
		});
		noteId = note.id;
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();
	});

	describe("create", () => {
		it("should create a field value with generated id and timestamps", async () => {
			const fieldValue = await localNoteFieldValueRepository.create({
				noteId,
				noteFieldTypeId,
				value: "What is the capital of Japan?",
			});

			expect(fieldValue.id).toBeDefined();
			expect(fieldValue.noteId).toBe(noteId);
			expect(fieldValue.noteFieldTypeId).toBe(noteFieldTypeId);
			expect(fieldValue.value).toBe("What is the capital of Japan?");
			expect(fieldValue.createdAt).toBeInstanceOf(Date);
			expect(fieldValue.updatedAt).toBeInstanceOf(Date);
			expect(fieldValue.syncVersion).toBe(0);
			expect(fieldValue._synced).toBe(false);
		});
	});

	describe("findByNoteId", () => {
		it("should return all field values for a note", async () => {
			await localNoteFieldValueRepository.create({
				noteId,
				noteFieldTypeId,
				value: "Front value",
			});

			const backFieldType = await localNoteFieldTypeRepository.create({
				noteTypeId,
				name: "Back",
				order: 1,
			});
			await localNoteFieldValueRepository.create({
				noteId,
				noteFieldTypeId: backFieldType.id,
				value: "Back value",
			});

			const fieldValues =
				await localNoteFieldValueRepository.findByNoteId(noteId);
			expect(fieldValues).toHaveLength(2);
		});
	});

	describe("findByNoteIdAndFieldTypeId", () => {
		it("should return the field value for a specific note and field type", async () => {
			await localNoteFieldValueRepository.create({
				noteId,
				noteFieldTypeId,
				value: "Test value",
			});

			const found =
				await localNoteFieldValueRepository.findByNoteIdAndFieldTypeId(
					noteId,
					noteFieldTypeId,
				);
			expect(found?.value).toBe("Test value");
		});

		it("should return undefined if not found", async () => {
			const found =
				await localNoteFieldValueRepository.findByNoteIdAndFieldTypeId(
					noteId,
					"non-existent",
				);
			expect(found).toBeUndefined();
		});
	});

	describe("update", () => {
		it("should update field value", async () => {
			const fieldValue = await localNoteFieldValueRepository.create({
				noteId,
				noteFieldTypeId,
				value: "Original",
			});

			const updated = await localNoteFieldValueRepository.update(
				fieldValue.id,
				{
					value: "Updated",
				},
			);

			expect(updated?.value).toBe("Updated");
			expect(updated?._synced).toBe(false);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				fieldValue.updatedAt.getTime(),
			);
		});

		it("should return undefined for non-existent field value", async () => {
			const updated = await localNoteFieldValueRepository.update(
				"non-existent",
				{
					value: "Updated",
				},
			);
			expect(updated).toBeUndefined();
		});
	});

	describe("findUnsynced", () => {
		it("should return unsynced field values", async () => {
			const fieldValue1 = await localNoteFieldValueRepository.create({
				noteId,
				noteFieldTypeId,
				value: "Unsynced",
			});
			const fieldValue2 = await localNoteFieldValueRepository.create({
				noteId,
				noteFieldTypeId: noteFieldTypeId,
				value: "Synced",
			});
			await localNoteFieldValueRepository.markSynced(fieldValue2.id, 1);

			const unsynced = await localNoteFieldValueRepository.findUnsynced();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe(fieldValue1.id);
		});
	});

	describe("markSynced", () => {
		it("should mark a field value as synced with version", async () => {
			const fieldValue = await localNoteFieldValueRepository.create({
				noteId,
				noteFieldTypeId,
				value: "Test",
			});

			await localNoteFieldValueRepository.markSynced(fieldValue.id, 5);

			const found = await localNoteFieldValueRepository.findById(fieldValue.id);
			expect(found?._synced).toBe(true);
			expect(found?.syncVersion).toBe(5);
		});
	});
});
