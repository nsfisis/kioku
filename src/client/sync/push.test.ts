/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardState, db, FieldType, Rating } from "../db/index";
import {
	localCardRepository,
	localDeckRepository,
	localNoteFieldTypeRepository,
	localNoteFieldValueRepository,
	localNoteRepository,
	localNoteTypeRepository,
	localReviewLogRepository,
} from "../db/repositories";
import { base64ToBinary } from "./crdt/sync-state";
import { CrdtEntityType } from "./crdt/types";
import {
	generateCrdtChanges,
	PushService,
	pendingChangesToPushData,
} from "./push";
import type { PendingChanges } from "./queue";
import { SyncQueue } from "./queue";

function createEmptyPending(): Omit<
	PendingChanges,
	"decks" | "cards" | "reviewLogs"
> {
	return {
		noteTypes: [],
		noteFieldTypes: [],
		notes: [],
		noteFieldValues: [],
	};
}

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

function createEmptyPushResult(): Omit<
	import("./push").SyncPushResult,
	"decks" | "cards" | "reviewLogs" | "conflicts"
> {
	return {
		noteTypes: [],
		noteFieldTypes: [],
		notes: [],
		noteFieldValues: [],
	};
}

function createEmptyPushData(): Omit<
	import("./push").SyncPushData,
	"decks" | "cards" | "reviewLogs"
> {
	return {
		noteTypes: [],
		noteFieldTypes: [],
		notes: [],
		noteFieldValues: [],
		crdtChanges: expect.any(
			Array,
		) as import("./crdt/sync-state").CrdtSyncPayload[],
	};
}

describe("pendingChangesToPushData", () => {
	it("should convert decks to sync format", () => {
		const decks = [
			{
				id: "deck-1",
				userId: "user-1",
				name: "Test Deck",
				description: "A description",
				newCardsPerDay: 20,
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				deletedAt: null,
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks,
			cards: [],
			reviewLogs: [],
			...createEmptyPending(),
		});

		expect(result.decks).toHaveLength(1);
		expect(result.decks[0]).toEqual({
			id: "deck-1",
			name: "Test Deck",
			description: "A description",
			newCardsPerDay: 20,
			createdAt: "2024-01-01T10:00:00.000Z",
			updatedAt: "2024-01-02T15:30:00.000Z",
			deletedAt: null,
		});
	});

	it("should convert deleted decks with deletedAt timestamp", () => {
		const decks = [
			{
				id: "deck-1",
				userId: "user-1",
				name: "Deleted Deck",
				description: null,
				newCardsPerDay: 10,
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-03T12:00:00Z"),
				deletedAt: new Date("2024-01-03T12:00:00Z"),
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks,
			cards: [],
			reviewLogs: [],
			...createEmptyPending(),
		});

		expect(result.decks[0]?.deletedAt).toBe("2024-01-03T12:00:00.000Z");
	});

	it("should convert cards to sync format", () => {
		const cards = [
			{
				id: "card-1",
				deckId: "deck-1",
				noteId: "test-note-id",
				isReversed: false,
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
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards,
			reviewLogs: [],
			...createEmptyPending(),
		});

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]).toEqual({
			id: "card-1",
			deckId: "deck-1",
			noteId: "test-note-id",
			isReversed: false,
			front: "Question",
			back: "Answer",
			state: CardState.Review,
			due: "2024-01-05T09:00:00.000Z",
			stability: 10.5,
			difficulty: 5.2,
			elapsedDays: 3,
			scheduledDays: 5,
			reps: 4,
			lapses: 1,
			lastReview: "2024-01-02T10:00:00.000Z",
			createdAt: "2024-01-01T10:00:00.000Z",
			updatedAt: "2024-01-02T10:00:00.000Z",
			deletedAt: null,
		});
	});

	it("should convert cards with null lastReview", () => {
		const cards = [
			{
				id: "card-1",
				deckId: "deck-1",
				noteId: "test-note-id",
				isReversed: false,
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
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards,
			reviewLogs: [],
			...createEmptyPending(),
		});

		expect(result.cards[0]?.lastReview).toBeNull();
	});

	it("should convert review logs to sync format", () => {
		const reviewLogs = [
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
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards: [],
			reviewLogs,
			...createEmptyPending(),
		});

		expect(result.reviewLogs).toHaveLength(1);
		expect(result.reviewLogs[0]).toEqual({
			id: "log-1",
			cardId: "card-1",
			rating: Rating.Good,
			state: CardState.Learning,
			scheduledDays: 1,
			elapsedDays: 0,
			reviewedAt: "2024-01-02T10:00:00.000Z",
			durationMs: 5000,
		});
	});

	it("should convert review logs with null durationMs", () => {
		const reviewLogs = [
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
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards: [],
			reviewLogs,
			...createEmptyPending(),
		});

		expect(result.reviewLogs[0]?.durationMs).toBeNull();
	});

	it("should convert note types to sync format", () => {
		const noteTypes = [
			{
				id: "note-type-1",
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: true,
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				deletedAt: null,
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes,
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		});

		expect(result.noteTypes).toHaveLength(1);
		expect(result.noteTypes[0]).toEqual({
			id: "note-type-1",
			name: "Basic",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: true,
			createdAt: "2024-01-01T10:00:00.000Z",
			updatedAt: "2024-01-02T15:30:00.000Z",
			deletedAt: null,
		});
	});

	it("should convert note field types to sync format", () => {
		const noteFieldTypes = [
			{
				id: "field-type-1",
				noteTypeId: "note-type-1",
				name: "Front",
				order: 0,
				fieldType: FieldType.Text,
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				deletedAt: null,
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes,
			notes: [],
			noteFieldValues: [],
		});

		expect(result.noteFieldTypes).toHaveLength(1);
		expect(result.noteFieldTypes[0]).toEqual({
			id: "field-type-1",
			noteTypeId: "note-type-1",
			name: "Front",
			order: 0,
			fieldType: "text",
			createdAt: "2024-01-01T10:00:00.000Z",
			updatedAt: "2024-01-02T15:30:00.000Z",
			deletedAt: null,
		});
	});

	it("should convert notes to sync format", () => {
		const notes = [
			{
				id: "note-1",
				deckId: "deck-1",
				noteTypeId: "note-type-1",
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				deletedAt: null,
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes,
			noteFieldValues: [],
		});

		expect(result.notes).toHaveLength(1);
		expect(result.notes[0]).toEqual({
			id: "note-1",
			deckId: "deck-1",
			noteTypeId: "note-type-1",
			createdAt: "2024-01-01T10:00:00.000Z",
			updatedAt: "2024-01-02T15:30:00.000Z",
			deletedAt: null,
		});
	});

	it("should convert note field values to sync format", () => {
		const noteFieldValues = [
			{
				id: "field-value-1",
				noteId: "note-1",
				noteFieldTypeId: "field-type-1",
				value: "What is the capital of Japan?",
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues,
		});

		expect(result.noteFieldValues).toHaveLength(1);
		expect(result.noteFieldValues[0]).toEqual({
			id: "field-value-1",
			noteId: "note-1",
			noteFieldTypeId: "field-type-1",
			value: "What is the capital of Japan?",
			createdAt: "2024-01-01T10:00:00.000Z",
			updatedAt: "2024-01-02T15:30:00.000Z",
		});
	});

	it("should convert cards with noteId and isReversed to sync format", () => {
		const cards = [
			{
				id: "card-1",
				deckId: "deck-1",
				noteId: "note-1",
				isReversed: true,
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
				syncVersion: 0,
				_synced: false,
			},
		];

		const result = pendingChangesToPushData({
			decks: [],
			cards,
			reviewLogs: [],
			...createEmptyPending(),
		});

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]?.noteId).toBe("note-1");
		expect(result.cards[0]?.isReversed).toBe(true);
	});
});

describe("PushService", () => {
	let syncQueue: SyncQueue;

	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();
		localStorage.clear();
		syncQueue = new SyncQueue();
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

	describe("push", () => {
		it("should return empty result when no pending changes", async () => {
			const pushToServer = vi.fn();
			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(result).toEqual({
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			});
			expect(pushToServer).not.toHaveBeenCalled();
		});

		it("should push pending decks to server", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(pushToServer).toHaveBeenCalledTimes(1);
			expect(pushToServer).toHaveBeenCalledWith({
				decks: [
					expect.objectContaining({
						id: deck.id,
						name: "Test Deck",
					}),
				],
				cards: [],
				reviewLogs: [],
				...createEmptyPushData(),
			});
			expect(result.decks).toHaveLength(1);
			expect(result.decks[0]?.id).toBe(deck.id);
		});

		it("should push pending cards to server", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.markSynced(deck.id, 1);

			const card = await localCardRepository.create({
				deckId: deck.id,
				noteId: "test-note-id",
				isReversed: false,
				front: "Question",
				back: "Answer",
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [{ id: card.id, syncVersion: 1 }],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(pushToServer).toHaveBeenCalledWith({
				decks: [],
				cards: [
					expect.objectContaining({
						id: card.id,
						front: "Question",
						back: "Answer",
					}),
				],
				reviewLogs: [],
				...createEmptyPushData(),
			});
			expect(result.cards).toHaveLength(1);
		});

		it("should push pending review logs to server", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.markSynced(deck.id, 1);

			const card = await localCardRepository.create({
				deckId: deck.id,
				noteId: "test-note-id",
				isReversed: false,
				front: "Q",
				back: "A",
			});
			await localCardRepository.markSynced(card.id, 1);

			const log = await localReviewLogRepository.create({
				cardId: card.id,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 5000,
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [{ id: log.id, syncVersion: 1 }],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(pushToServer).toHaveBeenCalledWith({
				decks: [],
				cards: [],
				reviewLogs: [
					expect.objectContaining({
						id: log.id,
						rating: Rating.Good,
					}),
				],
				...createEmptyPushData(),
			});
			expect(result.reviewLogs).toHaveLength(1);
		});

		it("should mark items as synced after successful push", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 5 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			await pushService.push();

			const updatedDeck = await localDeckRepository.findById(deck.id);
			expect(updatedDeck?._synced).toBe(true);
			expect(updatedDeck?.syncVersion).toBe(5);
		});

		it("should return conflicts from server", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 3 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: { ...createEmptyConflicts(), decks: [deck.id] },
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(result.conflicts.decks).toContain(deck.id);
		});

		it("should throw error if push fails", async () => {
			await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const pushToServer = vi
				.fn()
				.mockRejectedValue(new Error("Network error"));

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			await expect(pushService.push()).rejects.toThrow("Network error");
		});

		it("should push all types of changes together", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const card = await localCardRepository.create({
				deckId: deck.id,
				noteId: "test-note-id",
				isReversed: false,
				front: "Q",
				back: "A",
			});

			const log = await localReviewLogRepository.create({
				cardId: card.id,
				userId: "user-1",
				rating: Rating.Good,
				state: CardState.New,
				scheduledDays: 1,
				elapsedDays: 0,
				reviewedAt: new Date(),
				durationMs: 5000,
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [{ id: card.id, syncVersion: 1 }],
				reviewLogs: [{ id: log.id, syncVersion: 1 }],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(result.decks).toHaveLength(1);
			expect(result.cards).toHaveLength(1);
			expect(result.reviewLogs).toHaveLength(1);

			// Verify all items are marked as synced
			const updatedDeck = await localDeckRepository.findById(deck.id);
			const updatedCard = await localCardRepository.findById(card.id);
			const updatedLog = await localReviewLogRepository.findById(log.id);

			expect(updatedDeck?._synced).toBe(true);
			expect(updatedCard?._synced).toBe(true);
			expect(updatedLog?._synced).toBe(true);
		});

		it("should push pending note types to server", async () => {
			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [{ id: noteType.id, syncVersion: 1 }],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(pushToServer).toHaveBeenCalledWith(
				expect.objectContaining({
					noteTypes: [
						expect.objectContaining({
							id: noteType.id,
							name: "Basic",
						}),
					],
				}),
			);
			expect(result.noteTypes).toHaveLength(1);
			expect(result.noteTypes[0]?.id).toBe(noteType.id);

			const updatedNoteType = await localNoteTypeRepository.findById(
				noteType.id,
			);
			expect(updatedNoteType?._synced).toBe(true);
			expect(updatedNoteType?.syncVersion).toBe(1);
		});

		it("should push pending note field types to server", async () => {
			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
			await localNoteTypeRepository.markSynced(noteType.id, 1);

			const fieldType = await localNoteFieldTypeRepository.create({
				noteTypeId: noteType.id,
				name: "Front",
				order: 0,
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [{ id: fieldType.id, syncVersion: 1 }],
				notes: [],
				noteFieldValues: [],
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(result.noteFieldTypes).toHaveLength(1);

			const updatedFieldType = await localNoteFieldTypeRepository.findById(
				fieldType.id,
			);
			expect(updatedFieldType?._synced).toBe(true);
			expect(updatedFieldType?.syncVersion).toBe(1);
		});

		it("should push pending notes to server", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.markSynced(deck.id, 1);

			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
			await localNoteTypeRepository.markSynced(noteType.id, 1);

			const note = await localNoteRepository.create({
				deckId: deck.id,
				noteTypeId: noteType.id,
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [{ id: note.id, syncVersion: 1 }],
				noteFieldValues: [],
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(result.notes).toHaveLength(1);

			const updatedNote = await localNoteRepository.findById(note.id);
			expect(updatedNote?._synced).toBe(true);
			expect(updatedNote?.syncVersion).toBe(1);
		});

		it("should push pending note field values to server", async () => {
			const deck = await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});
			await localDeckRepository.markSynced(deck.id, 1);

			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
			await localNoteTypeRepository.markSynced(noteType.id, 1);

			const fieldType = await localNoteFieldTypeRepository.create({
				noteTypeId: noteType.id,
				name: "Front",
				order: 0,
			});
			await localNoteFieldTypeRepository.markSynced(fieldType.id, 1);

			const note = await localNoteRepository.create({
				deckId: deck.id,
				noteTypeId: noteType.id,
			});
			await localNoteRepository.markSynced(note.id, 1);

			const fieldValue = await localNoteFieldValueRepository.create({
				noteId: note.id,
				noteFieldTypeId: fieldType.id,
				value: "What is 2+2?",
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [{ id: fieldValue.id, syncVersion: 1 }],
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(result.noteFieldValues).toHaveLength(1);

			const updatedFieldValue = await localNoteFieldValueRepository.findById(
				fieldValue.id,
			);
			expect(updatedFieldValue?._synced).toBe(true);
			expect(updatedFieldValue?.syncVersion).toBe(1);
		});

		it("should push all note-related entities together", async () => {
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

			const fieldType = await localNoteFieldTypeRepository.create({
				noteTypeId: noteType.id,
				name: "Front",
				order: 0,
			});

			const note = await localNoteRepository.create({
				deckId: deck.id,
				noteTypeId: noteType.id,
			});

			const fieldValue = await localNoteFieldValueRepository.create({
				noteId: note.id,
				noteFieldTypeId: fieldType.id,
				value: "What is 2+2?",
			});

			const pushToServer = vi.fn().mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				noteTypes: [{ id: noteType.id, syncVersion: 1 }],
				noteFieldTypes: [{ id: fieldType.id, syncVersion: 1 }],
				notes: [{ id: note.id, syncVersion: 1 }],
				noteFieldValues: [{ id: fieldValue.id, syncVersion: 1 }],
				conflicts: createEmptyConflicts(),
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer,
			});

			const result = await pushService.push();

			expect(result.decks).toHaveLength(1);
			expect(result.noteTypes).toHaveLength(1);
			expect(result.noteFieldTypes).toHaveLength(1);
			expect(result.notes).toHaveLength(1);
			expect(result.noteFieldValues).toHaveLength(1);

			// Verify all items are marked as synced
			const updatedNoteType = await localNoteTypeRepository.findById(
				noteType.id,
			);
			const updatedFieldType = await localNoteFieldTypeRepository.findById(
				fieldType.id,
			);
			const updatedNote = await localNoteRepository.findById(note.id);
			const updatedFieldValue = await localNoteFieldValueRepository.findById(
				fieldValue.id,
			);

			expect(updatedNoteType?._synced).toBe(true);
			expect(updatedFieldType?._synced).toBe(true);
			expect(updatedNote?._synced).toBe(true);
			expect(updatedFieldValue?._synced).toBe(true);
		});
	});

	describe("hasPendingChanges", () => {
		it("should return false when no pending changes", async () => {
			const pushService = new PushService({
				syncQueue,
				pushToServer: vi.fn(),
			});

			const result = await pushService.hasPendingChanges();
			expect(result).toBe(false);
		});

		it("should return true when there are pending changes", async () => {
			await localDeckRepository.create({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				newCardsPerDay: 20,
			});

			const pushService = new PushService({
				syncQueue,
				pushToServer: vi.fn(),
			});

			const result = await pushService.hasPendingChanges();
			expect(result).toBe(true);
		});
	});
});

describe("generateCrdtChanges", () => {
	it("should generate CRDT changes for decks", () => {
		const changes: PendingChanges = {
			decks: [
				{
					id: "deck-1",
					userId: "user-1",
					name: "Test Deck",
					description: null,
					newCardsPerDay: 20,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(1);
		expect(crdtChanges[0]?.entityType).toBe(CrdtEntityType.Deck);
		expect(crdtChanges[0]?.entityId).toBe("deck-1");
		expect(crdtChanges[0]?.documentId).toBe("deck:deck-1");
		expect(crdtChanges[0]?.binary).toBeDefined();
		// Verify it's valid base64
		const binary = crdtChanges[0]?.binary;
		if (binary) {
			expect(() => base64ToBinary(binary)).not.toThrow();
		}
	});

	it("should generate CRDT changes for cards", () => {
		const changes: PendingChanges = {
			decks: [],
			cards: [
				{
					id: "card-1",
					deckId: "deck-1",
					noteId: "note-1",
					isReversed: false,
					front: "Question",
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
					syncVersion: 0,
					_synced: false,
				},
			],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(1);
		expect(crdtChanges[0]?.entityType).toBe(CrdtEntityType.Card);
		expect(crdtChanges[0]?.entityId).toBe("card-1");
		expect(crdtChanges[0]?.documentId).toBe("card:card-1");
	});

	it("should generate CRDT changes for review logs", () => {
		const changes: PendingChanges = {
			decks: [],
			cards: [],
			reviewLogs: [
				{
					id: "log-1",
					cardId: "card-1",
					userId: "user-1",
					rating: Rating.Good,
					state: CardState.New,
					scheduledDays: 1,
					elapsedDays: 0,
					reviewedAt: new Date("2024-01-02T10:00:00Z"),
					durationMs: 5000,
					syncVersion: 0,
					_synced: false,
				},
			],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(1);
		expect(crdtChanges[0]?.entityType).toBe(CrdtEntityType.ReviewLog);
		expect(crdtChanges[0]?.entityId).toBe("log-1");
		expect(crdtChanges[0]?.documentId).toBe("reviewLog:log-1");
	});

	it("should generate CRDT changes for note types", () => {
		const changes: PendingChanges = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [
				{
					id: "note-type-1",
					userId: "user-1",
					name: "Basic",
					frontTemplate: "{{Front}}",
					backTemplate: "{{Back}}",
					isReversible: true,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(1);
		expect(crdtChanges[0]?.entityType).toBe(CrdtEntityType.NoteType);
		expect(crdtChanges[0]?.entityId).toBe("note-type-1");
		expect(crdtChanges[0]?.documentId).toBe("noteType:note-type-1");
	});

	it("should generate CRDT changes for note field types", () => {
		const changes: PendingChanges = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [
				{
					id: "field-type-1",
					noteTypeId: "note-type-1",
					name: "Front",
					order: 0,
					fieldType: FieldType.Text,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			notes: [],
			noteFieldValues: [],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(1);
		expect(crdtChanges[0]?.entityType).toBe(CrdtEntityType.NoteFieldType);
		expect(crdtChanges[0]?.entityId).toBe("field-type-1");
		expect(crdtChanges[0]?.documentId).toBe("noteFieldType:field-type-1");
	});

	it("should generate CRDT changes for notes", () => {
		const changes: PendingChanges = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [
				{
					id: "note-1",
					deckId: "deck-1",
					noteTypeId: "note-type-1",
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			noteFieldValues: [],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(1);
		expect(crdtChanges[0]?.entityType).toBe(CrdtEntityType.Note);
		expect(crdtChanges[0]?.entityId).toBe("note-1");
		expect(crdtChanges[0]?.documentId).toBe("note:note-1");
	});

	it("should generate CRDT changes for note field values", () => {
		const changes: PendingChanges = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [
				{
					id: "field-value-1",
					noteId: "note-1",
					noteFieldTypeId: "field-type-1",
					value: "What is 2+2?",
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					syncVersion: 0,
					_synced: false,
				},
			],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(1);
		expect(crdtChanges[0]?.entityType).toBe(CrdtEntityType.NoteFieldValue);
		expect(crdtChanges[0]?.entityId).toBe("field-value-1");
		expect(crdtChanges[0]?.documentId).toBe("noteFieldValue:field-value-1");
	});

	it("should generate CRDT changes for all entity types in correct order", () => {
		const changes: PendingChanges = {
			decks: [
				{
					id: "deck-1",
					userId: "user-1",
					name: "Test Deck",
					description: null,
					newCardsPerDay: 20,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			cards: [
				{
					id: "card-1",
					deckId: "deck-1",
					noteId: "note-1",
					isReversed: false,
					front: "Q",
					back: "A",
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
					syncVersion: 0,
					_synced: false,
				},
			],
			reviewLogs: [
				{
					id: "log-1",
					cardId: "card-1",
					userId: "user-1",
					rating: Rating.Good,
					state: CardState.New,
					scheduledDays: 1,
					elapsedDays: 0,
					reviewedAt: new Date("2024-01-02T10:00:00Z"),
					durationMs: 5000,
					syncVersion: 0,
					_synced: false,
				},
			],
			noteTypes: [
				{
					id: "note-type-1",
					userId: "user-1",
					name: "Basic",
					frontTemplate: "{{Front}}",
					backTemplate: "{{Back}}",
					isReversible: false,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			noteFieldTypes: [
				{
					id: "field-type-1",
					noteTypeId: "note-type-1",
					name: "Front",
					order: 0,
					fieldType: FieldType.Text,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			notes: [
				{
					id: "note-1",
					deckId: "deck-1",
					noteTypeId: "note-type-1",
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			noteFieldValues: [
				{
					id: "field-value-1",
					noteId: "note-1",
					noteFieldTypeId: "field-type-1",
					value: "What is 2+2?",
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					syncVersion: 0,
					_synced: false,
				},
			],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(7);

		// Verify order: decks, noteTypes, noteFieldTypes, notes, noteFieldValues, cards, reviewLogs
		expect(crdtChanges[0]?.entityType).toBe(CrdtEntityType.Deck);
		expect(crdtChanges[1]?.entityType).toBe(CrdtEntityType.NoteType);
		expect(crdtChanges[2]?.entityType).toBe(CrdtEntityType.NoteFieldType);
		expect(crdtChanges[3]?.entityType).toBe(CrdtEntityType.Note);
		expect(crdtChanges[4]?.entityType).toBe(CrdtEntityType.NoteFieldValue);
		expect(crdtChanges[5]?.entityType).toBe(CrdtEntityType.Card);
		expect(crdtChanges[6]?.entityType).toBe(CrdtEntityType.ReviewLog);
	});

	it("should return empty array for empty pending changes", () => {
		const changes: PendingChanges = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		};

		const crdtChanges = generateCrdtChanges(changes);

		expect(crdtChanges).toHaveLength(0);
	});
});

describe("pendingChangesToPushData with crdtChanges", () => {
	it("should include crdtChanges in push data", () => {
		const changes: PendingChanges = {
			decks: [
				{
					id: "deck-1",
					userId: "user-1",
					name: "Test Deck",
					description: null,
					newCardsPerDay: 20,
					createdAt: new Date("2024-01-01T10:00:00Z"),
					updatedAt: new Date("2024-01-02T15:30:00Z"),
					deletedAt: null,
					syncVersion: 0,
					_synced: false,
				},
			],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		};

		const pushData = pendingChangesToPushData(changes);

		expect(pushData.crdtChanges).toHaveLength(1);
		expect(pushData.crdtChanges[0]?.entityType).toBe(CrdtEntityType.Deck);
		expect(pushData.crdtChanges[0]?.entityId).toBe("deck-1");
	});

	it("should include empty crdtChanges for empty pending changes", () => {
		const changes: PendingChanges = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		};

		const pushData = pendingChangesToPushData(changes);

		expect(pushData.crdtChanges).toHaveLength(0);
	});
});
