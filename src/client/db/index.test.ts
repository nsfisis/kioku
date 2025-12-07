/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	CardState,
	db,
	type LocalCard,
	type LocalDeck,
	type LocalReviewLog,
	Rating,
} from "./index";

describe("KiokuDatabase", () => {
	beforeEach(async () => {
		// Clear database before each test
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
	});

	afterEach(async () => {
		// Clean up after tests
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
	});

	describe("database initialization", () => {
		it("should have decks table", () => {
			expect(db.decks).toBeDefined();
		});

		it("should have cards table", () => {
			expect(db.cards).toBeDefined();
		});

		it("should have reviewLogs table", () => {
			expect(db.reviewLogs).toBeDefined();
		});

		it("should be named kioku", () => {
			expect(db.name).toBe("kioku");
		});
	});

	describe("decks table", () => {
		const testDeck: LocalDeck = {
			id: "deck-1",
			userId: "user-1",
			name: "Test Deck",
			description: "A test deck",
			newCardsPerDay: 20,
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};

		it("should add and retrieve a deck", async () => {
			await db.decks.add(testDeck);
			const retrieved = await db.decks.get("deck-1");
			expect(retrieved).toEqual(testDeck);
		});

		it("should find unsynced decks", async () => {
			await db.decks.add(testDeck);
			await db.decks.add({
				...testDeck,
				id: "deck-2",
				name: "Synced Deck",
				_synced: true,
			});

			const unsynced = await db.decks.filter((d) => !d._synced).toArray();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe("deck-1");
		});

		it("should find decks by userId", async () => {
			await db.decks.add(testDeck);
			await db.decks.add({
				...testDeck,
				id: "deck-2",
				userId: "user-2",
			});

			const userDecks = await db.decks
				.where("userId")
				.equals("user-1")
				.toArray();
			expect(userDecks).toHaveLength(1);
			expect(userDecks[0]?.id).toBe("deck-1");
		});

		it("should update a deck", async () => {
			await db.decks.add(testDeck);
			await db.decks.update("deck-1", {
				name: "Updated Deck",
				_synced: false,
			});

			const updated = await db.decks.get("deck-1");
			expect(updated?.name).toBe("Updated Deck");
		});

		it("should delete a deck", async () => {
			await db.decks.add(testDeck);
			await db.decks.delete("deck-1");

			const deleted = await db.decks.get("deck-1");
			expect(deleted).toBeUndefined();
		});
	});

	describe("cards table", () => {
		const testCard: LocalCard = {
			id: "card-1",
			deckId: "deck-1",
			front: "Question",
			back: "Answer",
			state: CardState.New,
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
			_synced: false,
		};

		it("should add and retrieve a card", async () => {
			await db.cards.add(testCard);
			const retrieved = await db.cards.get("card-1");
			expect(retrieved).toEqual(testCard);
		});

		it("should find cards by deckId", async () => {
			await db.cards.add(testCard);
			await db.cards.add({
				...testCard,
				id: "card-2",
				deckId: "deck-2",
			});

			const deckCards = await db.cards
				.where("deckId")
				.equals("deck-1")
				.toArray();
			expect(deckCards).toHaveLength(1);
			expect(deckCards[0]?.id).toBe("card-1");
		});

		it("should find due cards", async () => {
			const now = new Date();
			const past = new Date(now.getTime() - 1000 * 60 * 60);
			const future = new Date(now.getTime() + 1000 * 60 * 60);

			await db.cards.add({ ...testCard, id: "card-past", due: past });
			await db.cards.add({ ...testCard, id: "card-future", due: future });

			const dueCards = await db.cards.where("due").belowOrEqual(now).toArray();
			expect(dueCards).toHaveLength(1);
			expect(dueCards[0]?.id).toBe("card-past");
		});

		it("should find cards by state", async () => {
			await db.cards.add(testCard);
			await db.cards.add({
				...testCard,
				id: "card-2",
				state: CardState.Review,
			});

			const newCards = await db.cards
				.where("state")
				.equals(CardState.New)
				.toArray();
			expect(newCards).toHaveLength(1);
			expect(newCards[0]?.id).toBe("card-1");
		});

		it("should find unsynced cards", async () => {
			await db.cards.add(testCard);
			await db.cards.add({
				...testCard,
				id: "card-2",
				_synced: true,
			});

			const unsynced = await db.cards.filter((c) => !c._synced).toArray();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe("card-1");
		});
	});

	describe("reviewLogs table", () => {
		const testReviewLog: LocalReviewLog = {
			id: "review-1",
			cardId: "card-1",
			userId: "user-1",
			rating: Rating.Good,
			state: CardState.New,
			scheduledDays: 1,
			elapsedDays: 0,
			reviewedAt: new Date("2024-01-01"),
			durationMs: 5000,
			syncVersion: 0,
			_synced: false,
		};

		it("should add and retrieve a review log", async () => {
			await db.reviewLogs.add(testReviewLog);
			const retrieved = await db.reviewLogs.get("review-1");
			expect(retrieved).toEqual(testReviewLog);
		});

		it("should find review logs by cardId", async () => {
			await db.reviewLogs.add(testReviewLog);
			await db.reviewLogs.add({
				...testReviewLog,
				id: "review-2",
				cardId: "card-2",
			});

			const cardReviews = await db.reviewLogs
				.where("cardId")
				.equals("card-1")
				.toArray();
			expect(cardReviews).toHaveLength(1);
			expect(cardReviews[0]?.id).toBe("review-1");
		});

		it("should find review logs by userId", async () => {
			await db.reviewLogs.add(testReviewLog);
			await db.reviewLogs.add({
				...testReviewLog,
				id: "review-2",
				userId: "user-2",
			});

			const userReviews = await db.reviewLogs
				.where("userId")
				.equals("user-1")
				.toArray();
			expect(userReviews).toHaveLength(1);
			expect(userReviews[0]?.id).toBe("review-1");
		});

		it("should find unsynced review logs", async () => {
			await db.reviewLogs.add(testReviewLog);
			await db.reviewLogs.add({
				...testReviewLog,
				id: "review-2",
				_synced: true,
			});

			const unsynced = await db.reviewLogs.filter((r) => !r._synced).toArray();
			expect(unsynced).toHaveLength(1);
			expect(unsynced[0]?.id).toBe("review-1");
		});

		it("should order review logs by reviewedAt", async () => {
			const earlier = new Date("2024-01-01");
			const later = new Date("2024-01-02");

			await db.reviewLogs.add({
				...testReviewLog,
				id: "review-later",
				reviewedAt: later,
			});
			await db.reviewLogs.add({
				...testReviewLog,
				id: "review-earlier",
				reviewedAt: earlier,
			});

			const sorted = await db.reviewLogs.orderBy("reviewedAt").toArray();
			expect(sorted[0]?.id).toBe("review-earlier");
			expect(sorted[1]?.id).toBe("review-later");
		});
	});

	describe("constants", () => {
		it("should export CardState enum", () => {
			expect(CardState.New).toBe(0);
			expect(CardState.Learning).toBe(1);
			expect(CardState.Review).toBe(2);
			expect(CardState.Relearning).toBe(3);
		});

		it("should export Rating enum", () => {
			expect(Rating.Again).toBe(1);
			expect(Rating.Hard).toBe(2);
			expect(Rating.Good).toBe(3);
			expect(Rating.Easy).toBe(4);
		});
	});
});
