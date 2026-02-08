import Dexie, { type EntityTable } from "dexie";

/**
 * Card states for FSRS algorithm
 */
export const CardState = {
	New: 0,
	Learning: 1,
	Review: 2,
	Relearning: 3,
} as const;

export type CardStateType = (typeof CardState)[keyof typeof CardState];

/**
 * Rating values for reviews
 */
export const Rating = {
	Again: 1,
	Hard: 2,
	Good: 3,
	Easy: 4,
} as const;

export type RatingType = (typeof Rating)[keyof typeof Rating];

/**
 * Field types for note fields
 */
export const FieldType = {
	Text: "text",
} as const;

export type FieldTypeType = (typeof FieldType)[keyof typeof FieldType];

/**
 * Local note type stored in IndexedDB
 * Defines the structure of notes (fields and card templates)
 */
export interface LocalNoteType {
	id: string;
	userId: string;
	name: string;
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
	_synced: boolean;
}

/**
 * Local note field type stored in IndexedDB
 * Defines a field within a note type
 */
export interface LocalNoteFieldType {
	id: string;
	noteTypeId: string;
	name: string;
	order: number;
	fieldType: FieldTypeType;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
	_synced: boolean;
}

/**
 * Local deck stored in IndexedDB
 * Includes _synced flag for offline sync tracking
 */
export interface LocalDeck {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	newCardsPerDay: number;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
	_synced: boolean;
}

/**
 * Local note stored in IndexedDB
 * Contains field values for a note type
 */
export interface LocalNote {
	id: string;
	deckId: string;
	noteTypeId: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
	_synced: boolean;
}

/**
 * Local note field value stored in IndexedDB
 * Contains the value for a specific field in a note
 */
export interface LocalNoteFieldValue {
	id: string;
	noteId: string;
	noteFieldTypeId: string;
	value: string;
	createdAt: Date;
	updatedAt: Date;
	syncVersion: number;
	_synced: boolean;
}

/**
 * Local card stored in IndexedDB
 * Includes _synced flag for offline sync tracking
 */
export interface LocalCard {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	front: string;
	back: string;

	// FSRS fields
	state: CardStateType;
	due: Date;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	lastReview: Date | null;

	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
	_synced: boolean;
}

/**
 * Local review log stored in IndexedDB
 * Includes _synced flag for offline sync tracking
 * ReviewLog is append-only (no conflicts possible)
 */
export interface LocalReviewLog {
	id: string;
	cardId: string;
	userId: string;
	rating: RatingType;
	state: CardStateType;
	scheduledDays: number;
	elapsedDays: number;
	reviewedAt: Date;
	durationMs: number | null;
	syncVersion: number;
	_synced: boolean;
}

/**
 * Kioku local database using Dexie (IndexedDB wrapper)
 *
 * This database stores decks, cards, notes, and review logs locally for offline support.
 * Each entity has a _synced flag to track whether it has been synchronized with the server.
 */
export class KiokuDatabase extends Dexie {
	decks!: EntityTable<LocalDeck, "id">;
	cards!: EntityTable<LocalCard, "id">;
	reviewLogs!: EntityTable<LocalReviewLog, "id">;
	noteTypes!: EntityTable<LocalNoteType, "id">;
	noteFieldTypes!: EntityTable<LocalNoteFieldType, "id">;
	notes!: EntityTable<LocalNote, "id">;
	noteFieldValues!: EntityTable<LocalNoteFieldValue, "id">;

	constructor() {
		super("kioku");

		this.version(1).stores({
			// Primary key is 'id', indexed fields follow
			// userId: for filtering by user
			// updatedAt: for sync ordering
			// Note: _synced is not indexed (boolean fields can't be indexed in IndexedDB)
			// Use .filter() to find unsynced items
			decks: "id, userId, updatedAt",

			// deckId: for filtering cards by deck
			// due: for finding due cards
			// state: for filtering by card state
			cards: "id, deckId, updatedAt, due, state",

			// cardId: for finding reviews for a card
			// userId: for filtering by user
			// reviewedAt: for ordering reviews
			reviewLogs: "id, cardId, userId, reviewedAt",
		});

		// Version 2: Add note-related tables for Anki-compatible note system
		this.version(2)
			.stores({
				decks: "id, userId, updatedAt",
				// Add noteId index for filtering cards by note
				cards: "id, deckId, noteId, updatedAt, due, state",
				reviewLogs: "id, cardId, userId, reviewedAt",

				// Note types define the structure of notes (templates and fields)
				// userId: for filtering by user
				noteTypes: "id, userId, updatedAt",

				// Note field types define the fields for a note type
				// noteTypeId: for filtering fields by note type
				noteFieldTypes: "id, noteTypeId, updatedAt",

				// Notes contain field values for a note type
				// deckId: for filtering notes by deck
				// noteTypeId: for filtering notes by note type
				notes: "id, deckId, noteTypeId, updatedAt",

				// Note field values contain the actual field data
				// noteId: for filtering values by note
				// noteFieldTypeId: for filtering values by field type
				noteFieldValues: "id, noteId, noteFieldTypeId, updatedAt",
			})
			.upgrade((tx) => {
				// Migrate existing cards to have noteId and isReversed as null
				return tx
					.table("cards")
					.toCollection()
					.modify((card) => {
						if (card.noteId === undefined) {
							card.noteId = null;
						}
						if (card.isReversed === undefined) {
							card.isReversed = null;
						}
					});
			});

		// Version 3: noteId and isReversed are now required (NOT NULL)
		this.version(3).stores({
			decks: "id, userId, updatedAt",
			cards: "id, deckId, noteId, updatedAt, due, state",
			reviewLogs: "id, cardId, userId, reviewedAt",
			noteTypes: "id, userId, updatedAt",
			noteFieldTypes: "id, noteTypeId, updatedAt",
			notes: "id, deckId, noteTypeId, updatedAt",
			noteFieldValues: "id, noteId, noteFieldTypeId, updatedAt",
		});
	}
}

/**
 * Singleton instance of the Kioku database
 */
export const db = new KiokuDatabase();
