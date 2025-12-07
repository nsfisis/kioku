/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CardState, db } from "../db/index";
import { localCardRepository, localDeckRepository } from "../db/repositories";
import { ConflictResolver } from "./conflict";
import type { SyncPullResult } from "./pull";
import type { SyncPushResult } from "./push";

describe("ConflictResolver", () => {
	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		localStorage.clear();
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		localStorage.clear();
	});

	describe("hasConflicts", () => {
		it("should return false when no conflicts", () => {
			const resolver = new ConflictResolver();
			const pushResult: SyncPushResult = {
				decks: [{ id: "deck-1", syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: [], cards: [] },
			};

			expect(resolver.hasConflicts(pushResult)).toBe(false);
		});

		it("should return true when deck conflicts exist", () => {
			const resolver = new ConflictResolver();
			const pushResult: SyncPushResult = {
				decks: [{ id: "deck-1", syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: ["deck-1"], cards: [] },
			};

			expect(resolver.hasConflicts(pushResult)).toBe(true);
		});

		it("should return true when card conflicts exist", () => {
			const resolver = new ConflictResolver();
			const pushResult: SyncPushResult = {
				decks: [],
				cards: [{ id: "card-1", syncVersion: 1 }],
				reviewLogs: [],
				conflicts: { decks: [], cards: ["card-1"] },
			};

			expect(resolver.hasConflicts(pushResult)).toBe(true);
		});
	});

	describe("getConflictingDeckIds", () => {
		it("should return conflicting deck IDs", () => {
			const resolver = new ConflictResolver();
			const pushResult: SyncPushResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: ["deck-1", "deck-2"], cards: [] },
			};

			expect(resolver.getConflictingDeckIds(pushResult)).toEqual([
				"deck-1",
				"deck-2",
			]);
		});
	});

	describe("getConflictingCardIds", () => {
		it("should return conflicting card IDs", () => {
			const resolver = new ConflictResolver();
			const pushResult: SyncPushResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: [], cards: ["card-1", "card-2"] },
			};

			expect(resolver.getConflictingCardIds(pushResult)).toEqual([
				"card-1",
				"card-2",
			]);
		});
	});

	describe("resolveDeckConflict", () => {
		it("should use server data with server_wins strategy", async () => {
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: "Local description",
				newCardsPerDay: 10,
			});

			const serverDeck = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Name",
				description: "Server description",
				newCardsPerDay: 20,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-03"),
				deletedAt: null,
				syncVersion: 5,
			};

			const resolver = new ConflictResolver({ strategy: "server_wins" });
			const result = await resolver.resolveDeckConflict(localDeck, serverDeck);

			expect(result.resolution).toBe("server_wins");

			const updatedDeck = await localDeckRepository.findById(localDeck.id);
			expect(updatedDeck?.name).toBe("Server Name");
			expect(updatedDeck?.description).toBe("Server description");
			expect(updatedDeck?.newCardsPerDay).toBe(20);
			expect(updatedDeck?._synced).toBe(true);
		});

		it("should keep local data with local_wins strategy", async () => {
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: "Local description",
				newCardsPerDay: 10,
			});

			const serverDeck = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Name",
				description: "Server description",
				newCardsPerDay: 20,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-03"),
				deletedAt: null,
				syncVersion: 5,
			};

			const resolver = new ConflictResolver({ strategy: "local_wins" });
			const result = await resolver.resolveDeckConflict(localDeck, serverDeck);

			expect(result.resolution).toBe("local_wins");

			const updatedDeck = await localDeckRepository.findById(localDeck.id);
			expect(updatedDeck?.name).toBe("Local Name");
		});

		it("should use server data when server is newer with newer_wins strategy", async () => {
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: null,
				newCardsPerDay: 10,
			});

			const serverDeck = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Name",
				description: null,
				newCardsPerDay: 20,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date(Date.now() + 10000), // Server is newer
				deletedAt: null,
				syncVersion: 5,
			};

			const resolver = new ConflictResolver({ strategy: "newer_wins" });
			const result = await resolver.resolveDeckConflict(localDeck, serverDeck);

			expect(result.resolution).toBe("server_wins");

			const updatedDeck = await localDeckRepository.findById(localDeck.id);
			expect(updatedDeck?.name).toBe("Server Name");
		});

		it("should use local data when local is newer with newer_wins strategy", async () => {
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: null,
				newCardsPerDay: 10,
			});

			const serverDeck = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Name",
				description: null,
				newCardsPerDay: 20,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-01"), // Server is older
				deletedAt: null,
				syncVersion: 5,
			};

			const resolver = new ConflictResolver({ strategy: "newer_wins" });
			const result = await resolver.resolveDeckConflict(localDeck, serverDeck);

			expect(result.resolution).toBe("local_wins");

			const updatedDeck = await localDeckRepository.findById(localDeck.id);
			expect(updatedDeck?.name).toBe("Local Name");
		});
	});

	describe("resolveCardConflict", () => {
		it("should use server data with server_wins strategy", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const localCard = await localCardRepository.create({
				deckId: deck.id,
				front: "Local Question",
				back: "Local Answer",
			});

			const serverCard = {
				id: localCard.id,
				deckId: deck.id,
				front: "Server Question",
				back: "Server Answer",
				state: CardState.Review,
				due: new Date("2024-01-05"),
				stability: 10,
				difficulty: 5,
				elapsedDays: 3,
				scheduledDays: 5,
				reps: 4,
				lapses: 1,
				lastReview: new Date("2024-01-02"),
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-03"),
				deletedAt: null,
				syncVersion: 3,
			};

			const resolver = new ConflictResolver({ strategy: "server_wins" });
			const result = await resolver.resolveCardConflict(localCard, serverCard);

			expect(result.resolution).toBe("server_wins");

			const updatedCard = await localCardRepository.findById(localCard.id);
			expect(updatedCard?.front).toBe("Server Question");
			expect(updatedCard?.back).toBe("Server Answer");
			expect(updatedCard?._synced).toBe(true);
		});

		it("should keep local data with local_wins strategy", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const localCard = await localCardRepository.create({
				deckId: deck.id,
				front: "Local Question",
				back: "Local Answer",
			});

			const serverCard = {
				id: localCard.id,
				deckId: deck.id,
				front: "Server Question",
				back: "Server Answer",
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
				syncVersion: 3,
			};

			const resolver = new ConflictResolver({ strategy: "local_wins" });
			const result = await resolver.resolveCardConflict(localCard, serverCard);

			expect(result.resolution).toBe("local_wins");

			const updatedCard = await localCardRepository.findById(localCard.id);
			expect(updatedCard?.front).toBe("Local Question");
		});
	});

	describe("resolveConflicts", () => {
		it("should resolve multiple deck conflicts", async () => {
			const deck1 = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Deck 1",
				description: null,
				newCardsPerDay: 10,
			});
			const deck2 = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Deck 2",
				description: null,
				newCardsPerDay: 10,
			});

			const pushResult: SyncPushResult = {
				decks: [
					{ id: deck1.id, syncVersion: 1 },
					{ id: deck2.id, syncVersion: 1 },
				],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: [deck1.id, deck2.id], cards: [] },
			};

			const pullResult: SyncPullResult = {
				decks: [
					{
						id: deck1.id,
						userId: "user-1",
						name: "Server Deck 1",
						description: null,
						newCardsPerDay: 20,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 5,
					},
					{
						id: deck2.id,
						userId: "user-1",
						name: "Server Deck 2",
						description: null,
						newCardsPerDay: 25,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 6,
					},
				],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 6,
			};

			const resolver = new ConflictResolver({ strategy: "server_wins" });
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks).toHaveLength(2);
			expect(result.decks[0]?.resolution).toBe("server_wins");
			expect(result.decks[1]?.resolution).toBe("server_wins");

			const updatedDeck1 = await localDeckRepository.findById(deck1.id);
			const updatedDeck2 = await localDeckRepository.findById(deck2.id);
			expect(updatedDeck1?.name).toBe("Server Deck 1");
			expect(updatedDeck2?.name).toBe("Server Deck 2");
		});

		it("should resolve card conflicts", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const card = await localCardRepository.create({
				deckId: deck.id,
				front: "Local Question",
				back: "Local Answer",
			});

			const pushResult: SyncPushResult = {
				decks: [],
				cards: [{ id: card.id, syncVersion: 1 }],
				reviewLogs: [],
				conflicts: { decks: [], cards: [card.id] },
			};

			const pullResult: SyncPullResult = {
				decks: [],
				cards: [
					{
						id: card.id,
						deckId: deck.id,
						front: "Server Question",
						back: "Server Answer",
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
						syncVersion: 3,
					},
				],
				reviewLogs: [],
				currentSyncVersion: 3,
			};

			const resolver = new ConflictResolver({ strategy: "server_wins" });
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]?.resolution).toBe("server_wins");

			const updatedCard = await localCardRepository.findById(card.id);
			expect(updatedCard?.front).toBe("Server Question");
		});

		it("should handle conflicts when local item does not exist", async () => {
			const pushResult: SyncPushResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: ["non-existent-deck"], cards: [] },
			};

			const pullResult: SyncPullResult = {
				decks: [
					{
						id: "non-existent-deck",
						userId: "user-1",
						name: "Server Deck",
						description: null,
						newCardsPerDay: 20,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 1,
					},
				],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 1,
			};

			const resolver = new ConflictResolver({ strategy: "server_wins" });
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks).toHaveLength(1);
			expect(result.decks[0]?.resolution).toBe("server_wins");

			const insertedDeck = await localDeckRepository.findById("non-existent-deck");
			expect(insertedDeck?.name).toBe("Server Deck");
		});

		it("should handle conflicts when server item does not exist", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Only Deck",
				description: null,
				newCardsPerDay: 10,
			});

			const pushResult: SyncPushResult = {
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: [deck.id], cards: [] },
			};

			const pullResult: SyncPullResult = {
				decks: [], // Server doesn't have this deck
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 0,
			};

			const resolver = new ConflictResolver({ strategy: "server_wins" });
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			// No resolution since server doesn't have the item
			expect(result.decks).toHaveLength(0);

			// Local deck should still exist
			const localDeck = await localDeckRepository.findById(deck.id);
			expect(localDeck?.name).toBe("Local Only Deck");
		});

		it("should default to server_wins strategy", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: null,
				newCardsPerDay: 10,
			});

			const pushResult: SyncPushResult = {
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: [deck.id], cards: [] },
			};

			const pullResult: SyncPullResult = {
				decks: [
					{
						id: deck.id,
						userId: "user-1",
						name: "Server Name",
						description: null,
						newCardsPerDay: 20,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 5,
					},
				],
				cards: [],
				reviewLogs: [],
				currentSyncVersion: 5,
			};

			// Create resolver without explicit strategy
			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks[0]?.resolution).toBe("server_wins");

			const updatedDeck = await localDeckRepository.findById(deck.id);
			expect(updatedDeck?.name).toBe("Server Name");
		});
	});
});
