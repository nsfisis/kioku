/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CardState, db, Rating } from "./index";
import {
	localCardRepository,
	localDeckRepository,
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
			expect(updated?.updatedAt.getTime()).toBeGreaterThan(
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
			await localCardRepository.create({ deckId, front: "Q1", back: "A1" });
			await localCardRepository.create({ deckId, front: "Q2", back: "A2" });

			const cards = await localCardRepository.findByDeckId(deckId);
			expect(cards).toHaveLength(2);
		});

		it("should exclude soft-deleted cards", async () => {
			const card = await localCardRepository.create({
				deckId,
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
			const future = new Date(Date.now() + 60000);

			const card1 = await localCardRepository.create({
				deckId,
				front: "Due",
				back: "A",
			});
			await db.cards.update(card1.id, { due: pastDue });

			const card2 = await localCardRepository.create({
				deckId,
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
				front: "New",
				back: "A",
			});

			const reviewedCard = await localCardRepository.create({
				deckId,
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
