/**
 * Repository types for abstracting database operations
 */

export interface User {
	id: string;
	username: string;
	passwordHash: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface UserPublic {
	id: string;
	username: string;
	createdAt: Date;
}

export interface RefreshToken {
	id: string;
	userId: string;
	tokenHash: string;
	expiresAt: Date;
	createdAt: Date;
}

export interface UserRepository {
	findByUsername(
		username: string,
	): Promise<Pick<User, "id" | "username" | "passwordHash"> | undefined>;
	existsByUsername(username: string): Promise<boolean>;
	create(data: { username: string; passwordHash: string }): Promise<UserPublic>;
	findById(id: string): Promise<Pick<User, "id" | "username"> | undefined>;
}

export interface RefreshTokenRepository {
	findValidToken(
		tokenHash: string,
	): Promise<Pick<RefreshToken, "id" | "userId" | "expiresAt"> | undefined>;
	create(data: {
		userId: string;
		tokenHash: string;
		expiresAt: Date;
	}): Promise<void>;
	deleteById(id: string): Promise<void>;
}

export interface Deck {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	newCardsPerDay: number;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
}

export interface DeckRepository {
	findByUserId(userId: string): Promise<Deck[]>;
	findById(id: string, userId: string): Promise<Deck | undefined>;
	create(data: {
		userId: string;
		name: string;
		description?: string | null;
		newCardsPerDay?: number;
	}): Promise<Deck>;
	update(
		id: string,
		userId: string,
		data: {
			name?: string;
			description?: string | null;
			newCardsPerDay?: number;
		},
	): Promise<Deck | undefined>;
	softDelete(id: string, userId: string): Promise<boolean>;
}

export interface Card {
	id: string;
	deckId: string;
	front: string;
	back: string;

	// FSRS fields
	state: number;
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

export interface CardRepository {
	findByDeckId(deckId: string): Promise<Card[]>;
	findById(id: string, deckId: string): Promise<Card | undefined>;
	create(
		deckId: string,
		data: {
			front: string;
			back: string;
		},
	): Promise<Card>;
	update(
		id: string,
		deckId: string,
		data: {
			front?: string;
			back?: string;
		},
	): Promise<Card | undefined>;
	softDelete(id: string, deckId: string): Promise<boolean>;
	findDueCards(deckId: string, now: Date, limit: number): Promise<Card[]>;
	updateFSRSFields(
		id: string,
		deckId: string,
		data: {
			state: number;
			due: Date;
			stability: number;
			difficulty: number;
			elapsedDays: number;
			scheduledDays: number;
			reps: number;
			lapses: number;
			lastReview: Date;
		},
	): Promise<Card | undefined>;
}

export interface ReviewLog {
	id: string;
	cardId: string;
	userId: string;
	rating: number;
	state: number;
	scheduledDays: number;
	elapsedDays: number;
	reviewedAt: Date;
	durationMs: number | null;
	syncVersion: number;
}

export interface ReviewLogRepository {
	create(data: {
		cardId: string;
		userId: string;
		rating: number;
		state: number;
		scheduledDays: number;
		elapsedDays: number;
		durationMs?: number | null;
	}): Promise<ReviewLog>;
}
