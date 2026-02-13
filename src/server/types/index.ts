// Card states for FSRS algorithm
export const CardState = {
	New: 0,
	Learning: 1,
	Review: 2,
	Relearning: 3,
} as const;

export type CardState = (typeof CardState)[keyof typeof CardState];

// Rating values for reviews
export const Rating = {
	Again: 1,
	Hard: 2,
	Good: 3,
	Easy: 4,
} as const;

export type Rating = (typeof Rating)[keyof typeof Rating];

// User
export interface User {
	id: string;
	username: string;
	passwordHash: string;
	createdAt: Date;
	updatedAt: Date;
}

// Deck
export interface Deck {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
}

// Card with FSRS fields
export interface Card {
	id: string;
	deckId: string;
	front: string;
	back: string;

	// FSRS fields
	state: CardState;
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
}

// ReviewLog (append-only)
export interface ReviewLog {
	id: string;
	cardId: string;
	userId: string;
	rating: Rating;
	state: CardState;
	scheduledDays: number;
	elapsedDays: number;
	reviewedAt: Date;
	durationMs: number | null;
	syncVersion: number;
}
