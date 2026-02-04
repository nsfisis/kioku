import { v4 as uuidv4 } from "uuid";
import { getEndOfStudyDayBoundary } from "../../shared/date";
import {
	CardState,
	db,
	FieldType,
	type LocalCard,
	type LocalDeck,
	type LocalNote,
	type LocalNoteFieldType,
	type LocalNoteFieldValue,
	type LocalNoteType,
	type LocalReviewLog,
} from "./index";

/**
 * Local deck repository for IndexedDB operations
 */
export const localDeckRepository = {
	/**
	 * Get all decks for a user (excluding soft-deleted)
	 */
	async findByUserId(userId: string): Promise<LocalDeck[]> {
		return db.decks
			.where("userId")
			.equals(userId)
			.filter((deck) => deck.deletedAt === null)
			.toArray();
	},

	/**
	 * Get a deck by ID
	 */
	async findById(id: string): Promise<LocalDeck | undefined> {
		return db.decks.get(id);
	},

	/**
	 * Create a new deck
	 */
	async create(
		data: Omit<
			LocalDeck,
			"id" | "createdAt" | "updatedAt" | "deletedAt" | "syncVersion" | "_synced"
		>,
	): Promise<LocalDeck> {
		const now = new Date();
		const deck: LocalDeck = {
			id: uuidv4(),
			...data,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};
		await db.decks.add(deck);
		return deck;
	},

	/**
	 * Update a deck
	 */
	async update(
		id: string,
		data: Partial<Pick<LocalDeck, "name" | "description" | "newCardsPerDay">>,
	): Promise<LocalDeck | undefined> {
		const deck = await db.decks.get(id);
		if (!deck) return undefined;

		const updatedDeck: LocalDeck = {
			...deck,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.decks.put(updatedDeck);
		return updatedDeck;
	},

	/**
	 * Soft delete a deck
	 */
	async delete(id: string): Promise<boolean> {
		const deck = await db.decks.get(id);
		if (!deck) return false;

		await db.decks.update(id, {
			deletedAt: new Date(),
			updatedAt: new Date(),
			_synced: false,
		});
		return true;
	},

	/**
	 * Get all unsynced decks
	 */
	async findUnsynced(): Promise<LocalDeck[]> {
		return db.decks.filter((deck) => !deck._synced).toArray();
	},

	/**
	 * Mark a deck as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.decks.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a deck from server (for sync pull)
	 */
	async upsertFromServer(deck: LocalDeck): Promise<void> {
		await db.decks.put({ ...deck, _synced: true });
	},
};

/**
 * Local card repository for IndexedDB operations
 */
export const localCardRepository = {
	/**
	 * Get all cards for a deck (excluding soft-deleted)
	 */
	async findByDeckId(deckId: string): Promise<LocalCard[]> {
		return db.cards
			.where("deckId")
			.equals(deckId)
			.filter((card) => card.deletedAt === null)
			.toArray();
	},

	/**
	 * Get a card by ID
	 */
	async findById(id: string): Promise<LocalCard | undefined> {
		return db.cards.get(id);
	},

	/**
	 * Get due cards for a deck
	 */
	async findDueCards(deckId: string, limit?: number): Promise<LocalCard[]> {
		const boundary = getEndOfStudyDayBoundary();
		const query = db.cards
			.where("deckId")
			.equals(deckId)
			.filter((card) => card.deletedAt === null && card.due < boundary);

		const cards = await query.toArray();
		// Sort by due date ascending
		cards.sort((a, b) => a.due.getTime() - b.due.getTime());

		return limit ? cards.slice(0, limit) : cards;
	},

	/**
	 * Create a new card
	 */
	async create(
		data: Omit<
			LocalCard,
			| "id"
			| "state"
			| "due"
			| "stability"
			| "difficulty"
			| "elapsedDays"
			| "scheduledDays"
			| "reps"
			| "lapses"
			| "lastReview"
			| "createdAt"
			| "updatedAt"
			| "deletedAt"
			| "syncVersion"
			| "_synced"
		>,
	): Promise<LocalCard> {
		const now = new Date();
		const card: LocalCard = {
			id: uuidv4(),
			...data,
			state: CardState.New,
			due: now,
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};
		await db.cards.add(card);
		return card;
	},

	/**
	 * Update a card's content
	 */
	async update(
		id: string,
		data: Partial<Pick<LocalCard, "front" | "back">>,
	): Promise<LocalCard | undefined> {
		const card = await db.cards.get(id);
		if (!card) return undefined;

		const updatedCard: LocalCard = {
			...card,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.cards.put(updatedCard);
		return updatedCard;
	},

	/**
	 * Update a card's FSRS scheduling data after review
	 */
	async updateScheduling(
		id: string,
		data: Pick<
			LocalCard,
			| "state"
			| "due"
			| "stability"
			| "difficulty"
			| "elapsedDays"
			| "scheduledDays"
			| "reps"
			| "lapses"
			| "lastReview"
		>,
	): Promise<LocalCard | undefined> {
		const card = await db.cards.get(id);
		if (!card) return undefined;

		const updatedCard: LocalCard = {
			...card,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.cards.put(updatedCard);
		return updatedCard;
	},

	/**
	 * Soft delete a card
	 */
	async delete(id: string): Promise<boolean> {
		const card = await db.cards.get(id);
		if (!card) return false;

		await db.cards.update(id, {
			deletedAt: new Date(),
			updatedAt: new Date(),
			_synced: false,
		});
		return true;
	},

	/**
	 * Get all unsynced cards
	 */
	async findUnsynced(): Promise<LocalCard[]> {
		return db.cards.filter((card) => !card._synced).toArray();
	},

	/**
	 * Mark a card as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.cards.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a card from server (for sync pull)
	 */
	async upsertFromServer(card: LocalCard): Promise<void> {
		await db.cards.put({ ...card, _synced: true });
	},
};

/**
 * Local review log repository for IndexedDB operations
 */
export const localReviewLogRepository = {
	/**
	 * Get all review logs for a card
	 */
	async findByCardId(cardId: string): Promise<LocalReviewLog[]> {
		return db.reviewLogs.where("cardId").equals(cardId).toArray();
	},

	/**
	 * Get all review logs for a user
	 */
	async findByUserId(userId: string): Promise<LocalReviewLog[]> {
		return db.reviewLogs.where("userId").equals(userId).toArray();
	},

	/**
	 * Get a review log by ID
	 */
	async findById(id: string): Promise<LocalReviewLog | undefined> {
		return db.reviewLogs.get(id);
	},

	/**
	 * Create a new review log
	 */
	async create(
		data: Omit<LocalReviewLog, "id" | "syncVersion" | "_synced">,
	): Promise<LocalReviewLog> {
		const reviewLog: LocalReviewLog = {
			id: uuidv4(),
			...data,
			syncVersion: 0,
			_synced: false,
		};
		await db.reviewLogs.add(reviewLog);
		return reviewLog;
	},

	/**
	 * Get all unsynced review logs
	 */
	async findUnsynced(): Promise<LocalReviewLog[]> {
		return db.reviewLogs.filter((log) => !log._synced).toArray();
	},

	/**
	 * Mark a review log as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.reviewLogs.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a review log from server (for sync pull)
	 */
	async upsertFromServer(reviewLog: LocalReviewLog): Promise<void> {
		await db.reviewLogs.put({ ...reviewLog, _synced: true });
	},

	/**
	 * Get review logs within a date range
	 */
	async findByDateRange(
		userId: string,
		startDate: Date,
		endDate: Date,
	): Promise<LocalReviewLog[]> {
		return db.reviewLogs
			.where("userId")
			.equals(userId)
			.filter((log) => log.reviewedAt >= startDate && log.reviewedAt <= endDate)
			.toArray();
	},
};

/**
 * Local note type repository for IndexedDB operations
 */
export const localNoteTypeRepository = {
	/**
	 * Get all note types for a user (excluding soft-deleted)
	 */
	async findByUserId(userId: string): Promise<LocalNoteType[]> {
		return db.noteTypes
			.where("userId")
			.equals(userId)
			.filter((noteType) => noteType.deletedAt === null)
			.toArray();
	},

	/**
	 * Get a note type by ID
	 */
	async findById(id: string): Promise<LocalNoteType | undefined> {
		return db.noteTypes.get(id);
	},

	/**
	 * Create a new note type
	 */
	async create(
		data: Omit<
			LocalNoteType,
			"id" | "createdAt" | "updatedAt" | "deletedAt" | "syncVersion" | "_synced"
		>,
	): Promise<LocalNoteType> {
		const now = new Date();
		const noteType: LocalNoteType = {
			id: uuidv4(),
			...data,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};
		await db.noteTypes.add(noteType);
		return noteType;
	},

	/**
	 * Update a note type
	 */
	async update(
		id: string,
		data: Partial<
			Pick<
				LocalNoteType,
				"name" | "frontTemplate" | "backTemplate" | "isReversible"
			>
		>,
	): Promise<LocalNoteType | undefined> {
		const noteType = await db.noteTypes.get(id);
		if (!noteType) return undefined;

		const updatedNoteType: LocalNoteType = {
			...noteType,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.noteTypes.put(updatedNoteType);
		return updatedNoteType;
	},

	/**
	 * Soft delete a note type
	 */
	async delete(id: string): Promise<boolean> {
		const noteType = await db.noteTypes.get(id);
		if (!noteType) return false;

		await db.noteTypes.update(id, {
			deletedAt: new Date(),
			updatedAt: new Date(),
			_synced: false,
		});
		return true;
	},

	/**
	 * Get all unsynced note types
	 */
	async findUnsynced(): Promise<LocalNoteType[]> {
		return db.noteTypes.filter((noteType) => !noteType._synced).toArray();
	},

	/**
	 * Mark a note type as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.noteTypes.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a note type from server (for sync pull)
	 */
	async upsertFromServer(noteType: LocalNoteType): Promise<void> {
		await db.noteTypes.put({ ...noteType, _synced: true });
	},
};

/**
 * Local note field type repository for IndexedDB operations
 */
export const localNoteFieldTypeRepository = {
	/**
	 * Get all field types for a note type (excluding soft-deleted)
	 */
	async findByNoteTypeId(noteTypeId: string): Promise<LocalNoteFieldType[]> {
		const fields = await db.noteFieldTypes
			.where("noteTypeId")
			.equals(noteTypeId)
			.filter((field) => field.deletedAt === null)
			.toArray();
		// Sort by order
		return fields.sort((a, b) => a.order - b.order);
	},

	/**
	 * Get a field type by ID
	 */
	async findById(id: string): Promise<LocalNoteFieldType | undefined> {
		return db.noteFieldTypes.get(id);
	},

	/**
	 * Create a new field type
	 */
	async create(
		data: Omit<
			LocalNoteFieldType,
			| "id"
			| "fieldType"
			| "createdAt"
			| "updatedAt"
			| "deletedAt"
			| "syncVersion"
			| "_synced"
		>,
	): Promise<LocalNoteFieldType> {
		const now = new Date();
		const fieldType: LocalNoteFieldType = {
			id: uuidv4(),
			...data,
			fieldType: FieldType.Text,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};
		await db.noteFieldTypes.add(fieldType);
		return fieldType;
	},

	/**
	 * Update a field type
	 */
	async update(
		id: string,
		data: Partial<Pick<LocalNoteFieldType, "name" | "order">>,
	): Promise<LocalNoteFieldType | undefined> {
		const fieldType = await db.noteFieldTypes.get(id);
		if (!fieldType) return undefined;

		const updatedFieldType: LocalNoteFieldType = {
			...fieldType,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.noteFieldTypes.put(updatedFieldType);
		return updatedFieldType;
	},

	/**
	 * Soft delete a field type
	 */
	async delete(id: string): Promise<boolean> {
		const fieldType = await db.noteFieldTypes.get(id);
		if (!fieldType) return false;

		await db.noteFieldTypes.update(id, {
			deletedAt: new Date(),
			updatedAt: new Date(),
			_synced: false,
		});
		return true;
	},

	/**
	 * Get all unsynced field types
	 */
	async findUnsynced(): Promise<LocalNoteFieldType[]> {
		return db.noteFieldTypes.filter((field) => !field._synced).toArray();
	},

	/**
	 * Mark a field type as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.noteFieldTypes.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a field type from server (for sync pull)
	 */
	async upsertFromServer(fieldType: LocalNoteFieldType): Promise<void> {
		await db.noteFieldTypes.put({ ...fieldType, _synced: true });
	},
};

/**
 * Local note repository for IndexedDB operations
 */
export const localNoteRepository = {
	/**
	 * Get all notes for a deck (excluding soft-deleted)
	 */
	async findByDeckId(deckId: string): Promise<LocalNote[]> {
		return db.notes
			.where("deckId")
			.equals(deckId)
			.filter((note) => note.deletedAt === null)
			.toArray();
	},

	/**
	 * Get all notes for a note type (excluding soft-deleted)
	 */
	async findByNoteTypeId(noteTypeId: string): Promise<LocalNote[]> {
		return db.notes
			.where("noteTypeId")
			.equals(noteTypeId)
			.filter((note) => note.deletedAt === null)
			.toArray();
	},

	/**
	 * Get a note by ID
	 */
	async findById(id: string): Promise<LocalNote | undefined> {
		return db.notes.get(id);
	},

	/**
	 * Create a new note
	 */
	async create(
		data: Omit<
			LocalNote,
			"id" | "createdAt" | "updatedAt" | "deletedAt" | "syncVersion" | "_synced"
		>,
	): Promise<LocalNote> {
		const now = new Date();
		const note: LocalNote = {
			id: uuidv4(),
			...data,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};
		await db.notes.add(note);
		return note;
	},

	/**
	 * Update a note's metadata (triggers updatedAt change)
	 */
	async update(id: string): Promise<LocalNote | undefined> {
		const note = await db.notes.get(id);
		if (!note) return undefined;

		const updatedNote: LocalNote = {
			...note,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.notes.put(updatedNote);
		return updatedNote;
	},

	/**
	 * Soft delete a note and its related cards
	 */
	async delete(id: string): Promise<boolean> {
		const note = await db.notes.get(id);
		if (!note) return false;

		const now = new Date();

		// Cascade soft-delete to all cards associated with this note
		await db.cards.where("noteId").equals(id).modify({
			deletedAt: now,
			updatedAt: now,
			_synced: false,
		});

		// Soft delete the note
		await db.notes.update(id, {
			deletedAt: now,
			updatedAt: now,
			_synced: false,
		});

		return true;
	},

	/**
	 * Get all unsynced notes
	 */
	async findUnsynced(): Promise<LocalNote[]> {
		return db.notes.filter((note) => !note._synced).toArray();
	},

	/**
	 * Mark a note as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.notes.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a note from server (for sync pull)
	 */
	async upsertFromServer(note: LocalNote): Promise<void> {
		await db.notes.put({ ...note, _synced: true });
	},
};

/**
 * Local note field value repository for IndexedDB operations
 */
export const localNoteFieldValueRepository = {
	/**
	 * Get all field values for a note
	 */
	async findByNoteId(noteId: string): Promise<LocalNoteFieldValue[]> {
		return db.noteFieldValues.where("noteId").equals(noteId).toArray();
	},

	/**
	 * Get a field value by ID
	 */
	async findById(id: string): Promise<LocalNoteFieldValue | undefined> {
		return db.noteFieldValues.get(id);
	},

	/**
	 * Get a field value by note ID and field type ID
	 */
	async findByNoteIdAndFieldTypeId(
		noteId: string,
		noteFieldTypeId: string,
	): Promise<LocalNoteFieldValue | undefined> {
		return db.noteFieldValues
			.where("noteId")
			.equals(noteId)
			.filter((value) => value.noteFieldTypeId === noteFieldTypeId)
			.first();
	},

	/**
	 * Create a new field value
	 */
	async create(
		data: Omit<
			LocalNoteFieldValue,
			"id" | "createdAt" | "updatedAt" | "syncVersion" | "_synced"
		>,
	): Promise<LocalNoteFieldValue> {
		const now = new Date();
		const fieldValue: LocalNoteFieldValue = {
			id: uuidv4(),
			...data,
			createdAt: now,
			updatedAt: now,
			syncVersion: 0,
			_synced: false,
		};
		await db.noteFieldValues.add(fieldValue);
		return fieldValue;
	},

	/**
	 * Update a field value
	 */
	async update(
		id: string,
		data: Partial<Pick<LocalNoteFieldValue, "value">>,
	): Promise<LocalNoteFieldValue | undefined> {
		const fieldValue = await db.noteFieldValues.get(id);
		if (!fieldValue) return undefined;

		const updatedFieldValue: LocalNoteFieldValue = {
			...fieldValue,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.noteFieldValues.put(updatedFieldValue);
		return updatedFieldValue;
	},

	/**
	 * Get all unsynced field values
	 */
	async findUnsynced(): Promise<LocalNoteFieldValue[]> {
		return db.noteFieldValues.filter((value) => !value._synced).toArray();
	},

	/**
	 * Mark a field value as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.noteFieldValues.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a field value from server (for sync pull)
	 */
	async upsertFromServer(fieldValue: LocalNoteFieldValue): Promise<void> {
		await db.noteFieldValues.put({ ...fieldValue, _synced: true });
	},
};
