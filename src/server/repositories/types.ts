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

export interface CardWithNoteData extends Card {
	note: Note;
	fieldValues: NoteFieldValue[];
}

/**
 * Card data prepared for study, including all necessary template rendering info.
 */
export interface CardForStudy extends Card {
	/** Note type templates for rendering */
	noteType: {
		frontTemplate: string;
		backTemplate: string;
	};
	/** Field values as a name-value map for template rendering */
	fieldValuesMap: Record<string, string>;
}

export interface CardRepository {
	findByDeckId(deckId: string): Promise<Card[]>;
	findById(id: string, deckId: string): Promise<Card | undefined>;
	findByIdWithNoteData(
		id: string,
		deckId: string,
	): Promise<CardWithNoteData | undefined>;
	findByNoteId(noteId: string): Promise<Card[]>;
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
	softDeleteByNoteId(noteId: string): Promise<boolean>;
	findDueCards(deckId: string, now: Date, limit: number): Promise<Card[]>;
	findDueCardsWithNoteData(
		deckId: string,
		now: Date,
		limit: number,
	): Promise<CardWithNoteData[]>;
	findDueCardsForStudy(
		deckId: string,
		now: Date,
		limit: number,
	): Promise<CardForStudy[]>;
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

export interface NoteTypeWithFields extends NoteType {
	fields: NoteFieldType[];
}

export interface NoteTypeRepository {
	findByUserId(userId: string): Promise<NoteType[]>;
	findById(id: string, userId: string): Promise<NoteType | undefined>;
	findByIdWithFields(
		id: string,
		userId: string,
	): Promise<NoteTypeWithFields | undefined>;
	create(data: {
		userId: string;
		name: string;
		frontTemplate: string;
		backTemplate: string;
		isReversible?: boolean;
	}): Promise<NoteType>;
	update(
		id: string,
		userId: string,
		data: {
			name?: string;
			frontTemplate?: string;
			backTemplate?: string;
			isReversible?: boolean;
		},
	): Promise<NoteType | undefined>;
	softDelete(id: string, userId: string): Promise<boolean>;
	hasNotes(id: string, userId: string): Promise<boolean>;
}

export interface NoteFieldTypeRepository {
	findByNoteTypeId(noteTypeId: string): Promise<NoteFieldType[]>;
	findById(id: string, noteTypeId: string): Promise<NoteFieldType | undefined>;
	create(
		noteTypeId: string,
		data: {
			name: string;
			order: number;
			fieldType?: string;
		},
	): Promise<NoteFieldType>;
	update(
		id: string,
		noteTypeId: string,
		data: {
			name?: string;
			order?: number;
		},
	): Promise<NoteFieldType | undefined>;
	softDelete(id: string, noteTypeId: string): Promise<boolean>;
	reorder(noteTypeId: string, fieldIds: string[]): Promise<NoteFieldType[]>;
	hasNoteFieldValues(id: string): Promise<boolean>;
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

export interface NoteWithFieldValues extends Note {
	fieldValues: NoteFieldValue[];
}

export interface CreateNoteResult {
	note: Note;
	fieldValues: NoteFieldValue[];
	cards: Card[];
}

export interface NoteRepository {
	findByDeckId(deckId: string): Promise<Note[]>;
	findById(id: string, deckId: string): Promise<Note | undefined>;
	findByIdWithFieldValues(
		id: string,
		deckId: string,
	): Promise<NoteWithFieldValues | undefined>;
	create(
		deckId: string,
		data: {
			noteTypeId: string;
			fields: Record<string, string>;
		},
	): Promise<CreateNoteResult>;
	update(
		id: string,
		deckId: string,
		fields: Record<string, string>,
	): Promise<NoteWithFieldValues | undefined>;
	softDelete(id: string, deckId: string): Promise<boolean>;
}
