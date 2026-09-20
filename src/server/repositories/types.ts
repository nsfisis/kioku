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
	findByUsername: (
		username: string,
	) => Promise<Pick<User, "id" | "username" | "passwordHash"> | undefined>;
	existsByUsername: (username: string) => Promise<boolean>;
	create: (data: {
		username: string;
		passwordHash: string;
	}) => Promise<UserPublic>;
	findById: (id: string) => Promise<Pick<User, "id" | "username"> | undefined>;
}

export interface RefreshTokenRepository {
	findValidToken: (
		tokenHash: string,
	) => Promise<Pick<RefreshToken, "id" | "userId" | "expiresAt"> | undefined>;
	create: (data: {
		userId: string;
		tokenHash: string;
		expiresAt: Date;
	}) => Promise<void>;
	deleteById: (id: string) => Promise<void>;
}

export interface Deck {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	defaultNoteTypeId: string | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
}

export interface Card {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
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

export interface NoteType {
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
}

export interface NoteFieldType {
	id: string;
	noteTypeId: string;
	name: string;
	order: number;
	fieldType: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
}

export interface Note {
	id: string;
	deckId: string;
	noteTypeId: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
}

export interface NoteFieldValue {
	id: string;
	noteId: string;
	noteFieldTypeId: string;
	value: string;
	createdAt: Date;
	updatedAt: Date;
	syncVersion: number;
}
