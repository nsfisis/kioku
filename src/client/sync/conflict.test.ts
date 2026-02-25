/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CardState, db } from "../db/index";
import { localCardRepository, localDeckRepository } from "../db/repositories";
import { ConflictResolver } from "./conflict";
import {
	binaryToBase64,
	crdtDeckRepository,
	crdtSyncDb,
	crdtSyncStateManager,
} from "./crdt";
import type { SyncPullResult } from "./pull";
import type { SyncPushResult } from "./push";

function createEmptyConflicts() {
	return {
		decks: [] as string[],
		cards: [] as string[],
		noteTypes: [] as string[],
		noteFieldTypes: [] as string[],
		notes: [] as string[],
		noteFieldValues: [] as string[],
	};
}

function createEmptyPullResult(
	currentSyncVersion = 0,
): Omit<SyncPullResult, "decks" | "cards" | "reviewLogs"> {
	return {
		noteTypes: [],
		noteFieldTypes: [],
		notes: [],
		noteFieldValues: [],
		currentSyncVersion,
	};
}

describe("ConflictResolver", () => {
	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		await crdtSyncDb.syncState.clear();
		await crdtSyncDb.metadata.clear();
		localStorage.clear();
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		await crdtSyncDb.syncState.clear();
		await crdtSyncDb.metadata.clear();
		localStorage.clear();
	});

	describe("hasConflicts", () => {
		it("should return false when no conflicts", () => {
			const resolver = new ConflictResolver();
			const pushResult: SyncPushResult = {
				decks: [{ id: "deck-1", syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: createEmptyConflicts(),
			};

			expect(resolver.hasConflicts(pushResult)).toBe(false);
		});

		it("should return true when deck conflicts exist", () => {
			const resolver = new ConflictResolver();
			const pushResult: SyncPushResult = {
				decks: [{ id: "deck-1", syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), decks: ["deck-1"] },
			};

			expect(resolver.hasConflicts(pushResult)).toBe(true);
		});

		it("should return true when card conflicts exist", () => {
			const resolver = new ConflictResolver();
			const pushResult: SyncPushResult = {
				decks: [],
				cards: [{ id: "card-1", syncVersion: 1 }],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), cards: ["card-1"] },
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
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), decks: ["deck-1", "deck-2"] },
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
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), cards: ["card-1", "card-2"] },
			};

			expect(resolver.getConflictingCardIds(pushResult)).toEqual([
				"card-1",
				"card-2",
			]);
		});
	});

	describe("resolveDeckConflict", () => {
		it("should use server data when no CRDT data available", async () => {
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: "Local description",
				defaultNoteTypeId: null,
			});

			const serverDeck = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Name",
				description: "Server description",
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-03"),
				deletedAt: null,
				defaultNoteTypeId: null,
				syncVersion: 5,
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveDeckConflict(localDeck, serverDeck);

			expect(result).toBe(localDeck.id);

			const updatedDeck = await localDeckRepository.findById(localDeck.id);
			expect(updatedDeck?.name).toBe("Server Name");
			expect(updatedDeck?.description).toBe("Server description");
			expect(updatedDeck?._synced).toBe(true);
		});
	});

	describe("resolveCardConflict", () => {
		it("should use server data when no CRDT data available", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				defaultNoteTypeId: null,
			});

			const localCard = await localCardRepository.create({
				deckId: deck.id,
				noteId: "test-note-id",
				isReversed: false,
				front: "Local Question",
				back: "Local Answer",
			});

			const serverCard = {
				id: localCard.id,
				deckId: deck.id,
				noteId: "test-note-id",
				isReversed: false,
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

			const resolver = new ConflictResolver();
			const result = await resolver.resolveCardConflict(localCard, serverCard);

			expect(result).toBe(localCard.id);

			const updatedCard = await localCardRepository.findById(localCard.id);
			expect(updatedCard?.front).toBe("Server Question");
			expect(updatedCard?.back).toBe("Server Answer");
			expect(updatedCard?._synced).toBe(true);
		});
	});

	describe("resolveConflicts", () => {
		it("should resolve multiple deck conflicts", async () => {
			const deck1 = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Deck 1",
				description: null,
				defaultNoteTypeId: null,
			});
			const deck2 = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Deck 2",
				description: null,
				defaultNoteTypeId: null,
			});

			const pushResult: SyncPushResult = {
				decks: [
					{ id: deck1.id, syncVersion: 1 },
					{ id: deck2.id, syncVersion: 1 },
				],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: {
					...createEmptyConflicts(),
					decks: [deck1.id, deck2.id],
				},
			};

			const pullResult: SyncPullResult = {
				decks: [
					{
						id: deck1.id,
						userId: "user-1",
						name: "Server Deck 1",
						description: null,
						defaultNoteTypeId: null,
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
						defaultNoteTypeId: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 6,
					},
				],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(6),
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks).toHaveLength(2);
			expect(result.decks[0]).toBe(deck1.id);
			expect(result.decks[1]).toBe(deck2.id);

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
				defaultNoteTypeId: null,
			});

			const card = await localCardRepository.create({
				deckId: deck.id,
				noteId: "test-note-id",
				isReversed: false,
				front: "Local Question",
				back: "Local Answer",
			});

			const pushResult: SyncPushResult = {
				decks: [],
				cards: [{ id: card.id, syncVersion: 1 }],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), cards: [card.id] },
			};

			const pullResult: SyncPullResult = {
				decks: [],
				cards: [
					{
						id: card.id,
						deckId: deck.id,
						noteId: "test-note-id",
						isReversed: false,
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
				...createEmptyPullResult(3),
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]).toBe(card.id);

			const updatedCard = await localCardRepository.findById(card.id);
			expect(updatedCard?.front).toBe("Server Question");
		});

		it("should handle conflicts when local item does not exist", async () => {
			const pushResult: SyncPushResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: {
					...createEmptyConflicts(),
					decks: ["non-existent-deck"],
				},
			};

			const pullResult: SyncPullResult = {
				decks: [
					{
						id: "non-existent-deck",
						userId: "user-1",
						name: "Server Deck",
						description: null,
						defaultNoteTypeId: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 1,
					},
				],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(1),
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks).toHaveLength(1);
			expect(result.decks[0]).toBe("non-existent-deck");

			const insertedDeck =
				await localDeckRepository.findById("non-existent-deck");
			expect(insertedDeck?.name).toBe("Server Deck");
		});

		it("should handle conflicts when server item does not exist", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Only Deck",
				description: null,
				defaultNoteTypeId: null,
			});

			const pushResult: SyncPushResult = {
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), decks: [deck.id] },
			};

			const pullResult: SyncPullResult = {
				decks: [], // Server doesn't have this deck
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(0),
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			// No resolution since server doesn't have the item
			expect(result.decks).toHaveLength(0);

			// Local deck should still exist
			const localDeck = await localDeckRepository.findById(deck.id);
			expect(localDeck?.name).toBe("Local Only Deck");
		});

		it("should use CRDT strategy by default", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: null,
				defaultNoteTypeId: null,
			});

			const pushResult: SyncPushResult = {
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), decks: [deck.id] },
			};

			const pullResult: SyncPullResult = {
				decks: [
					{
						id: deck.id,
						userId: "user-1",
						name: "Server Name",
						description: null,
						defaultNoteTypeId: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 5,
					},
				],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(5),
			};

			// Create resolver without explicit strategy - defaults to CRDT
			// Without CRDT data, falls back to server_wins behavior
			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks[0]).toBe(deck.id);

			const updatedDeck = await localDeckRepository.findById(deck.id);
			expect(updatedDeck?.name).toBe("Server Name");
		});
	});

	describe("CRDT conflict resolution", () => {
		it("should merge deck using CRDT when crdtChanges are provided", async () => {
			// Create a local deck
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Deck Name",
				description: "Local description",
				defaultNoteTypeId: null,
			});

			// Store local CRDT document
			const localCrdtResult = crdtDeckRepository.toCrdtDocument(localDeck);
			await crdtSyncStateManager.setDocumentBinary(
				"deck",
				localDeck.id,
				localCrdtResult.binary,
				1,
			);

			// Create a "server" version with different data
			const serverDeckData = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Deck Name",
				description: "Server description",
				defaultNoteTypeId: null,
				createdAt: localDeck.createdAt,
				updatedAt: new Date(Date.now() + 1000),
				deletedAt: null,
				syncVersion: 5,
			};

			// Create server CRDT document
			const serverCrdtResult = crdtDeckRepository.toCrdtDocument({
				...serverDeckData,
				_synced: true,
			});

			const pushResult: SyncPushResult = {
				decks: [{ id: localDeck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), decks: [localDeck.id] },
			};

			const pullResult: SyncPullResult = {
				decks: [serverDeckData],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(5),
				crdtChanges: [
					{
						documentId: `deck:${localDeck.id}`,
						entityType: "deck",
						entityId: localDeck.id,
						binary: binaryToBase64(serverCrdtResult.binary),
					},
				],
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks).toHaveLength(1);
			expect(result.decks[0]).toBe(localDeck.id);

			// Verify the CRDT sync state was updated
			const storedBinary = await crdtSyncStateManager.getDocumentBinary(
				"deck",
				localDeck.id,
			);
			expect(storedBinary).toBeDefined();
		});

		it("should fall back to server_wins when CRDT merge fails", async () => {
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: null,
				defaultNoteTypeId: null,
			});

			const serverDeck = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Name",
				description: null,
				defaultNoteTypeId: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
				syncVersion: 5,
			};

			const pushResult: SyncPushResult = {
				decks: [{ id: localDeck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), decks: [localDeck.id] },
			};

			const pullResult: SyncPullResult = {
				decks: [serverDeck],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(5),
				crdtChanges: [
					{
						documentId: `deck:${localDeck.id}`,
						entityType: "deck",
						entityId: localDeck.id,
						// Invalid base64 - should trigger fallback
						binary: "invalid-base64-data!!!",
					},
				],
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			// Should still resolve using fallback
			expect(result.decks).toHaveLength(1);
			expect(result.decks[0]).toBe(localDeck.id);

			// Server data should be applied
			const updatedDeck = await localDeckRepository.findById(localDeck.id);
			expect(updatedDeck?.name).toBe("Server Name");
		});

		it("should fall back to server_wins when no CRDT data is available", async () => {
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: null,
				defaultNoteTypeId: null,
			});

			const serverDeck = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Name",
				description: null,
				defaultNoteTypeId: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
				syncVersion: 5,
			};

			const pushResult: SyncPushResult = {
				decks: [{ id: localDeck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), decks: [localDeck.id] },
			};

			// No crdtChanges in pull result
			const pullResult: SyncPullResult = {
				decks: [serverDeck],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(5),
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks).toHaveLength(1);
			expect(result.decks[0]).toBe(localDeck.id);

			const updatedDeck = await localDeckRepository.findById(localDeck.id);
			expect(updatedDeck?.name).toBe("Server Name");
		});

		it("should use CRDT to merge when local has no existing CRDT document", async () => {
			// Create a local deck without a CRDT document
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Name",
				description: null,
				defaultNoteTypeId: null,
			});

			const serverDeck = {
				id: localDeck.id,
				userId: "user-1",
				name: "Server Name",
				description: null,
				defaultNoteTypeId: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
				syncVersion: 5,
			};

			// Create server CRDT document
			const serverCrdtResult = crdtDeckRepository.toCrdtDocument({
				...serverDeck,
				_synced: true,
			});

			const pushResult: SyncPushResult = {
				decks: [{ id: localDeck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), decks: [localDeck.id] },
			};

			const pullResult: SyncPullResult = {
				decks: [serverDeck],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(5),
				crdtChanges: [
					{
						documentId: `deck:${localDeck.id}`,
						entityType: "deck",
						entityId: localDeck.id,
						binary: binaryToBase64(serverCrdtResult.binary),
					},
				],
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks).toHaveLength(1);
			expect(result.decks[0]).toBe(localDeck.id);

			// Verify CRDT document was stored
			const storedBinary = await crdtSyncStateManager.getDocumentBinary(
				"deck",
				localDeck.id,
			);
			expect(storedBinary).toBeDefined();
		});
	});
});
