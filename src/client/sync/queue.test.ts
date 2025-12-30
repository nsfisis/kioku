/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardState, db, Rating } from "../db/index";
import {
	localCardRepository,
	localDeckRepository,
	localReviewLogRepository,
} from "../db/repositories";
import { SyncQueue, SyncStatus } from "./queue";

describe("SyncQueue", () => {
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

	describe("initial state", () => {
		it("should have idle status by default", async () => {
			const state = await syncQueue.getState();
			expect(state.status).toBe(SyncStatus.Idle);
		});

		it("should have zero pending count initially", async () => {
			const state = await syncQueue.getState();
			expect(state.pendingCount).toBe(0);
		});

		it("should have zero last sync version initially", () => {
			expect(syncQueue.getLastSyncVersion()).toBe(0);
		});

		it("should have no last sync date initially", async () => {
			const state = await syncQueue.getState();
			expect(state.lastSyncAt).toBeNull();
		});

		it("should have no error initially", async () => {
			const state = await syncQueue.getState();
			expect(state.lastError).toBeNull();
		});
	});

	describe("getPendingChanges", () => {
		it("should return empty arrays when no pending changes", async () => {
			const changes = await syncQueue.getPendingChanges();
			expect(changes.decks).toHaveLength(0);
			expect(changes.cards).toHaveLength(0);
			expect(changes.reviewLogs).toHaveLength(0);
		});

		it("should return unsynced decks", async () => {
			await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const changes = await syncQueue.getPendingChanges();
			expect(changes.decks).toHaveLength(1);
			expect(changes.decks[0]?.name).toBe("Test Deck");
		});

		it("should return unsynced cards", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localCardRepository.create({
				deckId: deck.id,
				front: "Question",
				back: "Answer",
			});

			const changes = await syncQueue.getPendingChanges();
			expect(changes.cards).toHaveLength(1);
			expect(changes.cards[0]?.front).toBe("Question");
		});

		it("should return unsynced review logs", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			const card = await localCardRepository.create({
				deckId: deck.id,
				front: "Question",
				back: "Answer",
			});
			await localReviewLogRepository.create({
				cardId: card.id,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 5000,
			});

			const changes = await syncQueue.getPendingChanges();
			expect(changes.reviewLogs).toHaveLength(1);
		});

		it("should not return synced items", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.markSynced(deck.id, 1);

			const changes = await syncQueue.getPendingChanges();
			expect(changes.decks).toHaveLength(0);
		});
	});

	describe("getPendingCount", () => {
		it("should return total count of pending items", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localCardRepository.create({
				deckId: deck.id,
				front: "Q1",
				back: "A1",
			});
			await localCardRepository.create({
				deckId: deck.id,
				front: "Q2",
				back: "A2",
			});

			const count = await syncQueue.getPendingCount();
			// 1 deck + 2 cards = 3
			expect(count).toBe(3);
		});
	});

	describe("hasPendingChanges", () => {
		it("should return false when no pending changes", async () => {
			const hasPending = await syncQueue.hasPendingChanges();
			expect(hasPending).toBe(false);
		});

		it("should return true when there are pending changes", async () => {
			await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const hasPending = await syncQueue.hasPendingChanges();
			expect(hasPending).toBe(true);
		});
	});

	describe("startSync", () => {
		it("should set status to syncing", async () => {
			await syncQueue.startSync();

			const state = await syncQueue.getState();
			expect(state.status).toBe(SyncStatus.Syncing);
		});

		it("should clear previous error", async () => {
			await syncQueue.failSync("Previous error");
			await syncQueue.startSync();

			const state = await syncQueue.getState();
			expect(state.lastError).toBeNull();
		});

		it("should notify listeners", async () => {
			const listener = vi.fn();
			syncQueue.subscribe(listener);

			await syncQueue.startSync();

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					status: SyncStatus.Syncing,
				}),
			);
		});
	});

	describe("completeSync", () => {
		it("should set status to idle", async () => {
			await syncQueue.startSync();
			await syncQueue.completeSync(10);

			const state = await syncQueue.getState();
			expect(state.status).toBe(SyncStatus.Idle);
		});

		it("should update last sync version", async () => {
			await syncQueue.completeSync(10);

			expect(syncQueue.getLastSyncVersion()).toBe(10);
		});

		it("should update last sync date", async () => {
			const before = new Date();
			await syncQueue.completeSync(10);

			const state = await syncQueue.getState();
			expect(state.lastSyncAt).not.toBeNull();
			expect(state.lastSyncAt?.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
		});

		it("should persist state to localStorage", async () => {
			await syncQueue.completeSync(10);

			const stored = JSON.parse(
				localStorage.getItem("kioku_sync_state") ?? "{}",
			);
			expect(stored.lastSyncVersion).toBe(10);
			expect(stored.lastSyncAt).toBeDefined();
		});

		it("should notify listeners", async () => {
			const listener = vi.fn();
			syncQueue.subscribe(listener);

			await syncQueue.completeSync(10);

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					status: SyncStatus.Idle,
					lastSyncVersion: 10,
				}),
			);
		});
	});

	describe("failSync", () => {
		it("should set status to error", async () => {
			await syncQueue.failSync("Network error");

			const state = await syncQueue.getState();
			expect(state.status).toBe(SyncStatus.Error);
		});

		it("should set error message", async () => {
			await syncQueue.failSync("Network error");

			const state = await syncQueue.getState();
			expect(state.lastError).toBe("Network error");
		});

		it("should notify listeners", async () => {
			const listener = vi.fn();
			syncQueue.subscribe(listener);

			await syncQueue.failSync("Network error");

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					status: SyncStatus.Error,
					lastError: "Network error",
				}),
			);
		});
	});

	describe("markSynced", () => {
		it("should mark decks as synced", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			await syncQueue.markSynced({
				decks: [{ id: deck.id, syncVersion: 5 }],
				cards: [],
				reviewLogs: [],
			});

			const found = await localDeckRepository.findById(deck.id);
			expect(found?._synced).toBe(true);
			expect(found?.syncVersion).toBe(5);
		});

		it("should mark cards as synced", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			const card = await localCardRepository.create({
				deckId: deck.id,
				front: "Q",
				back: "A",
			});

			await syncQueue.markSynced({
				decks: [],
				cards: [{ id: card.id, syncVersion: 3 }],
				reviewLogs: [],
			});

			const found = await localCardRepository.findById(card.id);
			expect(found?._synced).toBe(true);
			expect(found?.syncVersion).toBe(3);
		});

		it("should mark review logs as synced", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			const card = await localCardRepository.create({
				deckId: deck.id,
				front: "Q",
				back: "A",
			});
			const reviewLog = await localReviewLogRepository.create({
				cardId: card.id,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 5000,
			});

			await syncQueue.markSynced({
				decks: [],
				cards: [],
				reviewLogs: [{ id: reviewLog.id, syncVersion: 2 }],
			});

			const found = await localReviewLogRepository.findById(reviewLog.id);
			expect(found?._synced).toBe(true);
			expect(found?.syncVersion).toBe(2);
		});

		it("should notify listeners", async () => {
			const listener = vi.fn();
			syncQueue.subscribe(listener);

			await syncQueue.markSynced({
				decks: [],
				cards: [],
				reviewLogs: [],
			});

			expect(listener).toHaveBeenCalled();
		});
	});

	describe("applyPulledChanges", () => {
		it("should upsert decks from server", async () => {
			const serverDeck = {
				id: "server-deck-1",
				userId: "user-1",
				name: "Server Deck",
				description: null,
				newCardsPerDay: 15,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
				syncVersion: 5,
				_synced: false,
			};

			await syncQueue.applyPulledChanges({
				decks: [serverDeck],
				cards: [],
				reviewLogs: [],
			});

			const found = await localDeckRepository.findById("server-deck-1");
			expect(found?.name).toBe("Server Deck");
			expect(found?._synced).toBe(true);
		});

		it("should upsert cards from server", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.markSynced(deck.id, 1);

			const serverCard = {
				id: "server-card-1",
				deckId: deck.id,
				noteId: null,
				isReversed: null,
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
				_synced: false,
			} as const;

			await syncQueue.applyPulledChanges({
				decks: [],
				cards: [serverCard],
				reviewLogs: [],
			});

			const found = await localCardRepository.findById("server-card-1");
			expect(found?.front).toBe("Server Question");
			expect(found?._synced).toBe(true);
		});

		it("should upsert review logs from server", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			const card = await localCardRepository.create({
				deckId: deck.id,
				front: "Q",
				back: "A",
			});

			const serverLog = {
				id: "server-log-1",
				cardId: card.id,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 5000,
				syncVersion: 2,
				_synced: false,
			} as const;

			await syncQueue.applyPulledChanges({
				decks: [],
				cards: [],
				reviewLogs: [serverLog],
			});

			const found = await localReviewLogRepository.findById("server-log-1");
			expect(found?.rating).toBe(Rating.Good);
			expect(found?._synced).toBe(true);
		});

		it("should notify listeners", async () => {
			const listener = vi.fn();
			syncQueue.subscribe(listener);

			await syncQueue.applyPulledChanges({
				decks: [],
				cards: [],
				reviewLogs: [],
			});

			expect(listener).toHaveBeenCalled();
		});
	});

	describe("reset", () => {
		it("should reset all state", async () => {
			await syncQueue.completeSync(10);
			await syncQueue.reset();

			const state = await syncQueue.getState();
			expect(state.status).toBe(SyncStatus.Idle);
			expect(state.lastSyncVersion).toBe(0);
			expect(state.lastSyncAt).toBeNull();
			expect(state.lastError).toBeNull();
		});

		it("should clear localStorage", async () => {
			await syncQueue.completeSync(10);
			await syncQueue.reset();

			expect(localStorage.getItem("kioku_sync_state")).toBeNull();
		});

		it("should notify listeners", async () => {
			const listener = vi.fn();
			syncQueue.subscribe(listener);

			await syncQueue.reset();

			expect(listener).toHaveBeenCalled();
		});
	});

	describe("subscribe", () => {
		it("should return unsubscribe function", async () => {
			const listener = vi.fn();
			const unsubscribe = syncQueue.subscribe(listener);

			await syncQueue.startSync();
			expect(listener).toHaveBeenCalledTimes(1);

			unsubscribe();

			await syncQueue.completeSync(10);
			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("should support multiple listeners", async () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			syncQueue.subscribe(listener1);
			syncQueue.subscribe(listener2);

			await syncQueue.startSync();

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
		});
	});

	describe("state persistence", () => {
		it("should restore state from localStorage on construction", async () => {
			// Simulate previous sync state
			localStorage.setItem(
				"kioku_sync_state",
				JSON.stringify({
					lastSyncVersion: 15,
					lastSyncAt: "2024-01-15T10:00:00.000Z",
				}),
			);

			const newQueue = new SyncQueue();

			expect(newQueue.getLastSyncVersion()).toBe(15);
			const state = await newQueue.getState();
			expect(state.lastSyncAt).toEqual(new Date("2024-01-15T10:00:00.000Z"));
		});

		it("should handle invalid localStorage data", async () => {
			localStorage.setItem("kioku_sync_state", "invalid json");

			const newQueue = new SyncQueue();

			expect(newQueue.getLastSyncVersion()).toBe(0);
		});
	});
});
