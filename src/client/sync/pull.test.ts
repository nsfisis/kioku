/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardState, db, Rating } from "../db/index";
import {
	localCardRepository,
	localDeckRepository,
	localNoteFieldTypeRepository,
	localNoteFieldValueRepository,
	localNoteRepository,
	localNoteTypeRepository,
} from "../db/repositories";
import {
	PullService,
	pullResultToLocalData,
	type SyncPullResult,
} from "./pull";
import { SyncQueue } from "./queue";

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
			...createEmptyPullResult(5),
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
			...createEmptyPullResult(3),
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
				syncVersion: 2,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: serverCards,
			reviewLogs: [],
			...createEmptyPullResult(2),
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
				syncVersion: 1,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: serverCards,
			reviewLogs: [],
			...createEmptyPullResult(1),
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
			...createEmptyPullResult(1),
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
			...createEmptyPullResult(1),
		});

		expect(result.reviewLogs[0]?.durationMs).toBeNull();
	});

	it("should convert server note types to local format", () => {
		const serverNoteTypes = [
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
				syncVersion: 5,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: serverNoteTypes,
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			currentSyncVersion: 5,
		});

		expect(result.noteTypes).toHaveLength(1);
		expect(result.noteTypes[0]).toEqual({
			id: "note-type-1",
			userId: "user-1",
			name: "Basic",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: true,
			createdAt: new Date("2024-01-01T10:00:00Z"),
			updatedAt: new Date("2024-01-02T15:30:00Z"),
			deletedAt: null,
			syncVersion: 5,
			_synced: true,
		});
	});

	it("should convert server note field types to local format", () => {
		const serverNoteFieldTypes = [
			{
				id: "field-type-1",
				noteTypeId: "note-type-1",
				name: "Front",
				order: 0,
				fieldType: "text",
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				deletedAt: null,
				syncVersion: 3,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: serverNoteFieldTypes,
			notes: [],
			noteFieldValues: [],
			currentSyncVersion: 3,
		});

		expect(result.noteFieldTypes).toHaveLength(1);
		expect(result.noteFieldTypes[0]).toEqual({
			id: "field-type-1",
			noteTypeId: "note-type-1",
			name: "Front",
			order: 0,
			fieldType: "text",
			createdAt: new Date("2024-01-01T10:00:00Z"),
			updatedAt: new Date("2024-01-02T15:30:00Z"),
			deletedAt: null,
			syncVersion: 3,
			_synced: true,
		});
	});

	it("should convert server notes to local format", () => {
		const serverNotes = [
			{
				id: "note-1",
				deckId: "deck-1",
				noteTypeId: "note-type-1",
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				deletedAt: null,
				syncVersion: 2,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: serverNotes,
			noteFieldValues: [],
			currentSyncVersion: 2,
		});

		expect(result.notes).toHaveLength(1);
		expect(result.notes[0]).toEqual({
			id: "note-1",
			deckId: "deck-1",
			noteTypeId: "note-type-1",
			createdAt: new Date("2024-01-01T10:00:00Z"),
			updatedAt: new Date("2024-01-02T15:30:00Z"),
			deletedAt: null,
			syncVersion: 2,
			_synced: true,
		});
	});

	it("should convert server note field values to local format", () => {
		const serverNoteFieldValues = [
			{
				id: "field-value-1",
				noteId: "note-1",
				noteFieldTypeId: "field-type-1",
				value: "What is the capital of Japan?",
				createdAt: new Date("2024-01-01T10:00:00Z"),
				updatedAt: new Date("2024-01-02T15:30:00Z"),
				syncVersion: 4,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: serverNoteFieldValues,
			currentSyncVersion: 4,
		});

		expect(result.noteFieldValues).toHaveLength(1);
		expect(result.noteFieldValues[0]).toEqual({
			id: "field-value-1",
			noteId: "note-1",
			noteFieldTypeId: "field-type-1",
			value: "What is the capital of Japan?",
			createdAt: new Date("2024-01-01T10:00:00Z"),
			updatedAt: new Date("2024-01-02T15:30:00Z"),
			syncVersion: 4,
			_synced: true,
		});
	});

	it("should convert server cards with noteId and isReversed to local format", () => {
		const serverCards = [
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
				syncVersion: 2,
			},
		];

		const result = pullResultToLocalData({
			decks: [],
			cards: serverCards,
			reviewLogs: [],
			...createEmptyPullResult(2),
		});

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]?.noteId).toBe("note-1");
		expect(result.cards[0]?.isReversed).toBe(true);
	});
});

describe("PullService", () => {
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

	describe("pull", () => {
		it("should return empty result when no server changes", async () => {
			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(0),
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
				...createEmptyPullResult(0),
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
				...createEmptyPullResult(10),
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
				...createEmptyPullResult(5),
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
						noteId: "test-note-id",
						isReversed: false,
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
				...createEmptyPullResult(3),
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
				...createEmptyPullResult(15),
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
				...createEmptyPullResult(0),
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
				...createEmptyPullResult(10),
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
						noteId: "test-note-id",
						isReversed: false,
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
				...createEmptyPullResult(3),
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

		it("should apply pulled note types to local database", async () => {
			const pullFromServer = vi.fn().mockResolvedValue({
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
						isReversible: false,
						createdAt: new Date("2024-01-01T10:00:00Z"),
						updatedAt: new Date("2024-01-02T10:00:00Z"),
						deletedAt: null,
						syncVersion: 5,
					},
				],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				currentSyncVersion: 5,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			const noteType = await localNoteTypeRepository.findById("note-type-1");
			expect(noteType).toBeDefined();
			expect(noteType?.name).toBe("Basic");
			expect(noteType?.frontTemplate).toBe("{{Front}}");
			expect(noteType?.isReversible).toBe(false);
			expect(noteType?._synced).toBe(true);
			expect(noteType?.syncVersion).toBe(5);
		});

		it("should apply pulled note field types to local database", async () => {
			// First create the note type
			const noteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
			await localNoteTypeRepository.markSynced(noteType.id, 1);

			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [
					{
						id: "field-type-1",
						noteTypeId: noteType.id,
						name: "Front",
						order: 0,
						fieldType: "text",
						createdAt: new Date("2024-01-01T10:00:00Z"),
						updatedAt: new Date("2024-01-02T10:00:00Z"),
						deletedAt: null,
						syncVersion: 3,
					},
				],
				notes: [],
				noteFieldValues: [],
				currentSyncVersion: 3,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			const fieldType =
				await localNoteFieldTypeRepository.findById("field-type-1");
			expect(fieldType).toBeDefined();
			expect(fieldType?.name).toBe("Front");
			expect(fieldType?.order).toBe(0);
			expect(fieldType?._synced).toBe(true);
			expect(fieldType?.syncVersion).toBe(3);
		});

		it("should apply pulled notes to local database", async () => {
			// First create the deck and note type
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

			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [
					{
						id: "note-1",
						deckId: deck.id,
						noteTypeId: noteType.id,
						createdAt: new Date("2024-01-01T10:00:00Z"),
						updatedAt: new Date("2024-01-02T10:00:00Z"),
						deletedAt: null,
						syncVersion: 4,
					},
				],
				noteFieldValues: [],
				currentSyncVersion: 4,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			const note = await localNoteRepository.findById("note-1");
			expect(note).toBeDefined();
			expect(note?.deckId).toBe(deck.id);
			expect(note?.noteTypeId).toBe(noteType.id);
			expect(note?._synced).toBe(true);
			expect(note?.syncVersion).toBe(4);
		});

		it("should apply pulled note field values to local database", async () => {
			// First create the deck, note type, field type, and note
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

			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [
					{
						id: "field-value-1",
						noteId: note.id,
						noteFieldTypeId: fieldType.id,
						value: "What is 2+2?",
						createdAt: new Date("2024-01-01T10:00:00Z"),
						updatedAt: new Date("2024-01-02T10:00:00Z"),
						syncVersion: 6,
					},
				],
				currentSyncVersion: 6,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			const fieldValue =
				await localNoteFieldValueRepository.findById("field-value-1");
			expect(fieldValue).toBeDefined();
			expect(fieldValue?.value).toBe("What is 2+2?");
			expect(fieldValue?._synced).toBe(true);
			expect(fieldValue?.syncVersion).toBe(6);
		});

		it("should handle pulling all note-related entities together", async () => {
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
				cards: [],
				reviewLogs: [],
				noteTypes: [
					{
						id: "note-type-1",
						userId: "user-1",
						name: "Basic",
						frontTemplate: "{{Front}}",
						backTemplate: "{{Back}}",
						isReversible: false,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 2,
					},
				],
				noteFieldTypes: [
					{
						id: "field-type-1",
						noteTypeId: "note-type-1",
						name: "Front",
						order: 0,
						fieldType: "text",
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 3,
					},
				],
				notes: [
					{
						id: "note-1",
						deckId: "deck-1",
						noteTypeId: "note-type-1",
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 4,
					},
				],
				noteFieldValues: [
					{
						id: "field-value-1",
						noteId: "note-1",
						noteFieldTypeId: "field-type-1",
						value: "What is 2+2?",
						createdAt: new Date(),
						updatedAt: new Date(),
						syncVersion: 5,
					},
				],
				currentSyncVersion: 5,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			const result = await pullService.pull();

			expect(result.noteTypes).toHaveLength(1);
			expect(result.noteFieldTypes).toHaveLength(1);
			expect(result.notes).toHaveLength(1);
			expect(result.noteFieldValues).toHaveLength(1);
			expect(syncQueue.getLastSyncVersion()).toBe(5);

			// Verify all items are stored in local database
			const noteType = await localNoteTypeRepository.findById("note-type-1");
			const fieldType =
				await localNoteFieldTypeRepository.findById("field-type-1");
			const note = await localNoteRepository.findById("note-1");
			const fieldValue =
				await localNoteFieldValueRepository.findById("field-value-1");

			expect(noteType?._synced).toBe(true);
			expect(fieldType?._synced).toBe(true);
			expect(note?._synced).toBe(true);
			expect(fieldValue?._synced).toBe(true);
		});

		it("should update existing note types when pulling", async () => {
			// Create an existing note type
			const existingNoteType = await localNoteTypeRepository.create({
				userId: "user-1",
				name: "Old Name",
				frontTemplate: "{{Old}}",
				backTemplate: "{{Old}}",
				isReversible: false,
			});

			const pullFromServer = vi.fn().mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [
					{
						id: existingNoteType.id,
						userId: "user-1",
						name: "Updated Name",
						frontTemplate: "{{Front}}",
						backTemplate: "{{Back}}",
						isReversible: true,
						createdAt: existingNoteType.createdAt,
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 10,
					},
				],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				currentSyncVersion: 10,
			});

			const pullService = new PullService({
				syncQueue,
				pullFromServer,
			});

			await pullService.pull();

			const updatedNoteType = await localNoteTypeRepository.findById(
				existingNoteType.id,
			);
			expect(updatedNoteType?.name).toBe("Updated Name");
			expect(updatedNoteType?.frontTemplate).toBe("{{Front}}");
			expect(updatedNoteType?.isReversible).toBe(true);
			expect(updatedNoteType?._synced).toBe(true);
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
