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
 * Local card stored in IndexedDB
 * Includes _synced flag for offline sync tracking
 */
export interface LocalCard {
	id: string;
	deckId: string;
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
 * This database stores decks, cards, and review logs locally for offline support.
 * Each entity has a _synced flag to track whether it has been synchronized with the server.
 */
export class KiokuDatabase extends Dexie {
	decks!: EntityTable<LocalDeck, "id">;
	cards!: EntityTable<LocalCard, "id">;
	reviewLogs!: EntityTable<LocalReviewLog, "id">;

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
	}
}

/**
 * Singleton instance of the Kioku database
 */
export const db = new KiokuDatabase();
