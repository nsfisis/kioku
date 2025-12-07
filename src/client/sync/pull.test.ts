/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardState, db, Rating } from "../db/index";
import { localCardRepository, localDeckRepository } from "../db/repositories";
import { PullService, pullResultToLocalData } from "./pull";
import { SyncQueue } from "./queue";

describe("pullResultToLocalData", () => {
	it("should convert server decks to local format", () => {
		const serverDecks = [
			{
				id: "deck-1",
				userId: "user-1",
				name: "Test Deck",
				description: "A description",
				newCardsPerDay: 20,
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				deletedAt: null,
				syncVersion: 5,
			},
		];

		const result = pullResultToLocalData({
			decks: serverDecks,
			cards: [],
			reviewLogs: [],
			currentSyncVersion: 5,
		});

		expect(result.decks).toHaveLength(1);
		expect(result.decks[0]).toEqual({
			id: "deck-1",
			userId: "user-1",
			name: "Test Deck",
			description: "A description",
			newCardsPerDay: 20,
			createdAt: new Date("2024-01-01T10:00:00Z"),
			updatedAt: new Date("2024-01-02T15:30:00Z"),
			deletedAt: null,
			syncVersion: 5,
			_synced: true,
		});
	});

	it("should convert deleted server decks with deletedAt timestamp", () => {
		const serverDecks = [
			{
				id: "deck-1",
				userId: "user-1",
				name: "Deleted Deck",
				description: null,
				newCardsPerDay: 10,
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-03T12:00:00Z"),
				deletedAt: new Date("2024-01-03T12:00:00Z"),
				syncVersion: 3,
			},
		];

		const result = pullResultToLocalData({
			decks: serverDecks,
			cards: [],
			reviewLogs: [],
			currentSyncVersion: 3,
		});

		expect(result.decks[0]?.deletedAt).toEqual(
			new Date("2024-01-03T12:00:00Z"),
		);
	});

	it("should convert server cards to local format", () => {
		const serverCards = [
			{
				id: "card-1",
				deckId: "deck-1",
				front: "Question",
				back: "Answer",
				state: CardState.Review,
				due: new Date("2024-01-05T09:00:00Z"),
				stability: 10.5,
				difficulty: 5.2,
				elapsedDays: 3,
				scheduledDays: 5,
				reps: 4,
				lapses: 1,
				lastReview: new Date("2024-01-02T10:00:00Z"),
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T10:00:00Z"),
				deletedAt: null,
				syncVersion: 2,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: serverCards,
			reviewLogs: [],
			currentSyncVersion: 2,
		});

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]).toEqual({
			id: "card-1",
			deckId: "deck-1",
			front: "Question",
			back: "Answer",
			state: CardState.Review,
			due: new Date("2024-01-05T09:00:00Z"),
			stability: 10.5,
			difficulty: 5.2,
			elapsedDays: 3,
			scheduledDays: 5,
			reps: 4,
			lapses: 1,
			lastReview: new Date("2024-01-02T10:00:00Z"),
			createdAt: new Date("2024-01-01T10:00:00Z"),
			updatedAt: new Date("2024-01-02T10:00:00Z"),
			deletedAt: null,
			syncVersion: 2,
			_synced: true,
		});
	});

	it("should convert server cards with null lastReview", () => {
		const serverCards = [
			{
				id: "card-1",
				deckId: "deck-1",
				front: "New Card",
				back: "Answer",
				state: CardState.New,
				due: new Date("2024-01-01T10:00:00Z"),
				stability: 0,
				difficulty: 0,
				elapsedDays: 0,
				scheduledDays: 0,
				reps: 0,
				lapses: 0,
				lastReview: null,
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-01T10:00:00Z"),
				deletedAt: null,
				syncVersion: 1,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: serverCards,
			reviewLogs: [],
			currentSyncVersion: 1,
		});

		expect(result.cards[0]?.lastReview).toBeNull();
	});

	it("should convert server review logs to local format", () => {
		const serverReviewLogs = [
			{
				id: "log-1",
				cardId: "card-1",
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.Learning,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date("2024-01-02T10:00:00Z"),
				durationMs: 5000,
				syncVersion: 1,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: [],
			reviewLogs: serverReviewLogs,
			currentSyncVersion: 1,
		});

		expect(result.reviewLogs).toHaveLength(1);
		expect(result.reviewLogs[0]).toEqual({
			id: "log-1",
			cardId: "card-1",
			userId: "user-1",
			rating: Rating.Good,
			state: CardState.Learning,
			scheduledDays: 1,
			elapsedDays: 0,
			reviewedAt: new Date("2024-01-02T10:00:00Z"),
			durationMs: 5000,
			syncVersion: 1,
			_synced: true,
		});
	});

	it("should convert review logs with null durationMs", () => {
		const serverReviewLogs = [
			{
				id: "log-1",
				cardId: "card-1",
				userId: "user-1",
				rating: Rating.Easy,
				state: CardState.New,
				scheduledDays: 3,
				elapsedDays: 0,
				reviewedAt: new Date("2024-01-02T10:00:00Z"),
				durationMs: null,
				syncVersion: 1,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: [],
			reviewLogs: serverReviewLogs,
			currentSyncVersion: 1,
		});

		expect(result.reviewLogs[0]?.durationMs).toBeNull();
	});
});

describe("PullService", () => {
	let syncQueue: SyncQueue;

	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		localStorage.clear();
		syncQueue = new SyncQueue();
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		localStorage.clear();
	});

	describe("pull", () => {
		it("should return empty result when no server changes", async () => {
			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 0,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			const result = await pullService.pull();

			expect(result).toEqual({
				decks: [],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 0,
			});
			expect(pullFromServer).toHaveBeenCalledWith(0);
		});

		it("should call pullFromServer with last sync version", async () => {
			// Set a previous sync version
			await syncQueue.completeSync(10);

			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 10,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			expect(pullFromServer).toHaveBeenCalledWith(10);
		});

		it("should apply pulled decks to local database", async () => {
			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [
					{
						id: "server-deck-1",
						userId: "user-1",
						name: "Server Deck",
						description: "From server",
						newCardsPerDay: 15,
						createdAt: new Date("2024-01-01T10:00:00Z"),
						updatedAt: new Date("2024-01-02T10:00:00Z"),
						deletedAt: null,
						syncVersion: 5,
					},
				],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 5,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			const deck = await localDeckRepository.findById("server-deck-1");
			expect(deck).toBeDefined();
			expect(deck?.name).toBe("Server Deck");
			expect(deck?.description).toBe("From server");
			expect(deck?._synced).toBe(true);
			expect(deck?.syncVersion).toBe(5);
		});

		it("should apply pulled cards to local database", async () => {
			// First create a deck for the card
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.markSynced(deck.id, 1);

			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [
					{
						id: "server-card-1",
						deckId: deck.id,
						front: "Server Question",
						back: "Server Answer",
						state: CardState.New,
						due: new Date("2024-01-01T10:00:00Z"),
						stability: 0,
						difficulty: 0,
						elapsedDays: 0,
						scheduledDays: 0,
						reps: 0,
						lapses: 0,
						lastReview: null,
						createdAt: new Date("2024-01-01T10:00:00Z"),
						updatedAt: new Date("2024-01-01T10:00:00Z"),
						deletedAt: null,
						syncVersion: 3,
					},
				],
				reviewLogs: [],
				currentSyncVersion: 3,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			const card = await localCardRepository.findById("server-card-1");
			expect(card).toBeDefined();
			expect(card?.front).toBe("Server Question");
			expect(card?.back).toBe("Server Answer");
			expect(card?._synced).toBe(true);
		});

		it("should update sync version after successful pull", async () => {
			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 15,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			expect(syncQueue.getLastSyncVersion()).toBe(15);
		});

		it("should not update sync version if unchanged", async () => {
			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 0,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			expect(syncQueue.getLastSyncVersion()).toBe(0);
		});

		it("should throw error if pull fails", async () => {
			const pullFromServer = vi
				.fn()
				.mockRejectedValue(new Error("Network error"));

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await expect(pullService.pull()).rejects.toThrow("Network error");
		});

		it("should update existing items when pulling", async () => {
			// Create an existing deck
			const existingDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Old Name",
				description: null,
				newCardsPerDay: 10,
			});

			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [
					{
						id: existingDeck.id,
						userId: "user-1",
						name: "Updated Name",
						description: "Updated description",
						newCardsPerDay: 25,
						createdAt: existingDeck.createdAt,
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 10,
					},
				],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 10,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			const updatedDeck = await localDeckRepository.findById(existingDeck.id);
			expect(updatedDeck?.name).toBe("Updated Name");
			expect(updatedDeck?.description).toBe("Updated description");
			expect(updatedDeck?.newCardsPerDay).toBe(25);
			expect(updatedDeck?._synced).toBe(true);
		});

		it("should handle pulling all types of data together", async () => {
			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [
					{
						id: "deck-1",
						userId: "user-1",
						name: "Deck",
						description: null,
						newCardsPerDay: 20,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 1,
					},
				],
				cards: [
					{
						id: "card-1",
						deckId: "deck-1",
						front: "Q",
						back: "A",
						state: CardState.New,
						due: new Date(),
						stability: 0,
						difficulty: 0,
						elapsedDays: 0,
						scheduledDays: 0,
						reps: 0,
						lapses: 0,
						lastReview: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 2,
					},
				],
				reviewLogs: [
					{
						id: "log-1",
						cardId: "card-1",
						userId: "user-1",
						rating: Rating.Good,
						state: CardState.Learning,
						scheduledDays: 1,
						elapsedDays: 0,
						reviewedAt: new Date(),
						durationMs: 5000,
						syncVersion: 3,
					},
				],
				currentSyncVersion: 3,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			const result = await pullService.pull();

			expect(result.decks).toHaveLength(1);
			expect(result.cards).toHaveLength(1);
			expect(result.reviewLogs).toHaveLength(1);
			expect(syncQueue.getLastSyncVersion()).toBe(3);
		});
	});

	describe("getLastSyncVersion", () => {
		it("should return current sync version", async () => {
			await syncQueue.completeSync(25);

			const pullService = new PullService({
				syncQueue,
				pullFromServer: vi.fn(),
			});

			expect(pullService.getLastSyncVersion()).toBe(25);
		});

		it("should return 0 when never synced", () => {
			const pullService = new PullService({
				syncQueue,
				pullFromServer: vi.fn(),
			});

			expect(pullService.getLastSyncVersion()).toBe(0);
		});
	});
});
