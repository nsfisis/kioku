/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CardState, db } from "../db/index";
import {
	localCardRepository,
	localDeckRepository,
	localNoteFieldValueRepository,
} from "../db/repositories";
import {
	ConflictPolicy,
	ConflictResolver,
	entityConflictPolicies,
	getConflictPolicy,
	SyncEntityType,
} from "./conflict";
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
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();
		localStorage.clear();
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();
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
		it("should use server data", async () => {
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
		it("should use server data", async () => {
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

		it("should resolve with the server row by default", async () => {
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

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks[0]).toBe(deck.id);

			const updatedDeck = await localDeckRepository.findById(deck.id);
			expect(updatedDeck?.name).toBe("Server Name");
		});
	});

	describe("conflict policy table", () => {
		it("should declare a policy for every entity type", () => {
			const entityTypes = Object.values(SyncEntityType);
			expect(Object.keys(entityConflictPolicies).sort()).toEqual(
				[...entityTypes].sort(),
			);
		});

		it("should resolve metadata entities with last-write-wins", () => {
			expect(getConflictPolicy(SyncEntityType.Deck)).toBe(ConflictPolicy.Lww);
			expect(getConflictPolicy(SyncEntityType.NoteType)).toBe(
				ConflictPolicy.Lww,
			);
			expect(getConflictPolicy(SyncEntityType.NoteFieldType)).toBe(
				ConflictPolicy.Lww,
			);
			expect(getConflictPolicy(SyncEntityType.Note)).toBe(ConflictPolicy.Lww);
			expect(getConflictPolicy(SyncEntityType.Card)).toBe(ConflictPolicy.Lww);
		});

		it("should resolve note field values with last-write-wins", () => {
			expect(getConflictPolicy(SyncEntityType.NoteFieldValue)).toBe(
				ConflictPolicy.Lww,
			);
		});

		it("should treat review logs as append-only", () => {
			expect(getConflictPolicy(SyncEntityType.ReviewLog)).toBe(
				ConflictPolicy.AppendOnly,
			);
		});

		it("should not expose a review log bucket in the resolution result", async () => {
			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(
				{
					decks: [],
					cards: [],
					reviewLogs: [],
					noteTypes: [],
					noteFieldTypes: [],
					notes: [],
					noteFieldValues: [],
					conflicts: createEmptyConflicts(),
				},
				{
					decks: [],
					cards: [],
					reviewLogs: [],
					...createEmptyPullResult(0),
				},
			);

			expect(Object.keys(result).sort()).toEqual([
				"cards",
				"decks",
				"noteFieldTypes",
				"noteFieldValues",
				"noteTypes",
				"notes",
			]);
		});
	});

	describe("LWW conflict resolution", () => {
		it("should take the server deck as-is", async () => {
			const localDeck = await localDeckRepository.create({
				userId: "user-1",
				name: "Local Deck Name",
				description: "Local description",
				defaultNoteTypeId: null,
			});

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
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.decks).toEqual([localDeck.id]);

			// LWW: the server row wins wholesale, no field-level merge
			const updatedDeck = await localDeckRepository.findById(localDeck.id);
			expect(updatedDeck?.name).toBe("Server Deck Name");
			expect(updatedDeck?.description).toBe("Server description");
			expect(updatedDeck?.syncVersion).toBe(5);
			expect(updatedDeck?._synced).toBe(true);
		});

		it("should keep the server FSRS state as one unit instead of merging fields", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				defaultNoteTypeId: null,
			});
			const localCard = await localCardRepository.create({
				deckId: deck.id,
				noteId: "note-1",
				isReversed: false,
				front: "Local front",
				back: "Local back",
			});
			// A local review that is about to lose to the server's
			await localCardRepository.updateScheduling(localCard.id, {
				state: CardState.Learning,
				due: new Date("2024-01-10"),
				stability: 99,
				difficulty: 1,
				elapsedDays: 0,
				scheduledDays: 1,
				reps: 9,
				lapses: 2,
				lastReview: new Date("2024-01-09"),
			});

			const serverCard = {
				id: localCard.id,
				deckId: deck.id,
				noteId: "note-1",
				isReversed: false,
				front: "Server front",
				back: "Server back",
				state: CardState.Review,
				due: new Date("2024-02-01"),
				stability: 4,
				difficulty: 5,
				elapsedDays: 1,
				scheduledDays: 2,
				reps: 3,
				lapses: 0,
				lastReview: new Date("2024-01-30"),
				createdAt: localCard.createdAt,
				updatedAt: new Date(Date.now() + 1000),
				deletedAt: null,
				syncVersion: 7,
			};

			const pushResult: SyncPushResult = {
				decks: [],
				cards: [{ id: localCard.id, syncVersion: 1 }],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: { ...createEmptyConflicts(), cards: [localCard.id] },
			};

			const pullResult: SyncPullResult = {
				decks: [],
				cards: [serverCard],
				reviewLogs: [],
				...createEmptyPullResult(7),
			};

			const resolver = new ConflictResolver();
			await resolver.resolveConflicts(pushResult, pullResult);

			// Every FSRS field comes from the same (server) review, never a mix
			const updatedCard = await localCardRepository.findById(localCard.id);
			expect(updatedCard?.state).toBe(CardState.Review);
			expect(updatedCard?.reps).toBe(3);
			expect(updatedCard?.stability).toBe(4);
			expect(updatedCard?.front).toBe("Server front");
		});
	});

	describe("note field value conflict resolution", () => {
		it("should take the server value as-is", async () => {
			const fieldValue = await localNoteFieldValueRepository.create({
				noteId: "note-1",
				noteFieldTypeId: "field-type-1",
				value: "local edit",
			});
			const pushResult: SyncPushResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [{ id: fieldValue.id, syncVersion: 5 }],
				conflicts: {
					...createEmptyConflicts(),
					noteFieldValues: [fieldValue.id],
				},
			};
			const pullResult: SyncPullResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(6),
				noteFieldValues: [
					{
						id: fieldValue.id,
						noteId: "note-1",
						noteFieldTypeId: "field-type-1",
						value: "newer server edit",
						createdAt: new Date(),
						updatedAt: new Date(),
						syncVersion: 5,
					},
				],
			};

			const resolver = new ConflictResolver();
			const result = await resolver.resolveConflicts(pushResult, pullResult);

			expect(result.noteFieldValues).toEqual([fieldValue.id]);

			const resolved = await localNoteFieldValueRepository.findById(
				fieldValue.id,
			);
			expect(resolved?.value).toBe("newer server edit");
			// Nothing is left to push back over the server's newer row.
			expect(resolved?._synced).toBe(true);
		});
	});
});
