import { v4 as uuidv4 } from "uuid";
import {
	type FieldTypeForGeneration,
	type FieldValueForGeneration,
	generateCardsForNote,
	type NoteTypeForGeneration,
} from "../../shared/card-generator";
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
		data: Partial<
			Pick<LocalDeck, "name" | "description" | "defaultNoteTypeId">
		>,
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
	 * Hard-delete a review log. Used to undo a just-submitted review
	 * before it gets pushed to the server.
	 */
	async delete(id: string): Promise<void> {
		await db.reviewLogs.delete(id);
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
	 * Returns true if any non-deleted note still uses this note type. Used to
	 * block deletion (mirrors the server's hasNotes check).
	 */
	async hasNotes(id: string): Promise<boolean> {
		const note = await db.notes
			.where("noteTypeId")
			.equals(id)
			.filter((n) => n.deletedAt === null)
			.first();
		return note !== undefined;
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
	 * Returns true if any noteFieldValue references this field type. Used to
	 * block deletion (mirrors the server's hasNoteFieldValues check).
	 */
	async hasNoteFieldValues(id: string): Promise<boolean> {
		const value = await db.noteFieldValues
			.where("noteFieldTypeId")
			.equals(id)
			.first();
		return value !== undefined;
	},

	/**
	 * Reorder field types in a note type. The given fieldIds become the new
	 * ordering 0..n-1. Returns the reordered field types in the new order.
	 */
	async reorder(
		noteTypeId: string,
		fieldIds: string[],
	): Promise<LocalNoteFieldType[]> {
		const now = new Date();
		const result = await db.transaction("rw", db.noteFieldTypes, async () => {
			const updated: LocalNoteFieldType[] = [];
			for (let i = 0; i < fieldIds.length; i++) {
				const fieldId = fieldIds[i];
				if (!fieldId) continue;
				const field = await db.noteFieldTypes.get(fieldId);
				if (!field || field.noteTypeId !== noteTypeId) continue;
				const next: LocalNoteFieldType = {
					...field,
					order: i,
					updatedAt: now,
					_synced: false,
				};
				await db.noteFieldTypes.put(next);
				updated.push(next);
			}
			return updated;
		});
		return result.sort((a, b) => a.order - b.order);
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
 * A note type plus its order-sorted field types: everything needed to
 * materialize a note and its generated cards.
 */
interface NoteTemplate {
	noteType: LocalNoteType;
	fieldTypes: LocalNoteFieldType[];
}

/**
 * Load a note type and its field types, or undefined when the note type is
 * missing or soft-deleted.
 */
async function loadNoteTemplate(
	noteTypeId: string,
): Promise<NoteTemplate | undefined> {
	const noteType = await db.noteTypes.get(noteTypeId);
	if (!noteType || noteType.deletedAt !== null) return undefined;

	const fieldTypes = (
		await db.noteFieldTypes
			.where("noteTypeId")
			.equals(noteTypeId)
			.filter((ft) => ft.deletedAt === null)
			.toArray()
	).sort((a, b) => a.order - b.order);

	return { noteType, fieldTypes };
}

/**
 * Build a note, its field values and its generated cards in memory. Callers
 * are responsible for writing the rows, so a single note and a bulk import can
 * share the same materialization logic.
 */
function buildNoteRows(input: {
	deckId: string;
	template: NoteTemplate;
	fields: Record<string, string>;
	now: Date;
}): {
	note: LocalNote;
	fieldValues: LocalNoteFieldValue[];
	cards: LocalCard[];
} {
	const { deckId, template, fields, now } = input;

	const note: LocalNote = {
		id: uuidv4(),
		deckId,
		noteTypeId: template.noteType.id,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		syncVersion: 0,
		_synced: false,
	};

	const fieldValues: LocalNoteFieldValue[] = template.fieldTypes.map((ft) => ({
		id: uuidv4(),
		noteId: note.id,
		noteFieldTypeId: ft.id,
		value: fields[ft.id] ?? "",
		createdAt: now,
		updatedAt: now,
		syncVersion: 0,
		_synced: false,
	}));

	const noteTypeForGeneration: NoteTypeForGeneration = {
		frontTemplate: template.noteType.frontTemplate,
		backTemplate: template.noteType.backTemplate,
		isReversible: template.noteType.isReversible,
	};
	const fieldTypesForGeneration: FieldTypeForGeneration[] =
		template.fieldTypes.map((ft) => ({ id: ft.id, name: ft.name }));
	const fieldValuesForGeneration: FieldValueForGeneration[] = fieldValues.map(
		(fv) => ({ noteFieldTypeId: fv.noteFieldTypeId, value: fv.value }),
	);

	const cards: LocalCard[] = generateCardsForNote({
		noteType: noteTypeForGeneration,
		fieldTypes: fieldTypesForGeneration,
		fieldValues: fieldValuesForGeneration,
		now,
	}).map((generated) => ({
		id: uuidv4(),
		deckId,
		noteId: note.id,
		isReversed: generated.isReversed,
		front: generated.front,
		back: generated.back,
		state: generated.state as LocalCard["state"],
		due: generated.due,
		stability: generated.stability,
		difficulty: generated.difficulty,
		elapsedDays: generated.elapsedDays,
		scheduledDays: generated.scheduledDays,
		reps: generated.reps,
		lapses: generated.lapses,
		lastReview: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		syncVersion: 0,
		_synced: false,
	}));

	return { note, fieldValues, cards };
}

/**
 * One row of a bulk import.
 */
export interface BulkNoteInput {
	noteTypeId: string;
	fields: Record<string, string>;
}

export interface BulkCreateOptions {
	/**
	 * Number of notes written per transaction. Default: 100.
	 */
	chunkSize?: number;
	/**
	 * Called after each chunk with the number of processed rows (successes and
	 * failures) and the total.
	 */
	onProgress?: (done: number, total: number) => void;
}

export interface BulkCreateResult {
	created: number;
	failed: { index: number; error: string }[];
}

const DEFAULT_BULK_CHUNK_SIZE = 100;

/**
 * Hand the event loop back to the browser so the progress UI can repaint
 * between chunks.
 */
function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

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
	 * Create a note together with its field values and auto-generated cards
	 * (1 or 2 depending on isReversible) inside a single IndexedDB transaction
	 * so partial writes can never leak through.
	 */
	async createWithCards(input: {
		deckId: string;
		noteTypeId: string;
		fields: Record<string, string>;
	}): Promise<{
		note: LocalNote;
		fieldValues: LocalNoteFieldValue[];
		cards: LocalCard[];
	}> {
		return db.transaction(
			"rw",
			[db.notes, db.noteFieldValues, db.cards, db.noteTypes, db.noteFieldTypes],
			async () => {
				const template = await loadNoteTemplate(input.noteTypeId);
				if (!template) {
					throw new Error("Note type not found");
				}

				const rows = buildNoteRows({
					deckId: input.deckId,
					template,
					fields: input.fields,
					now: new Date(),
				});

				await db.notes.add(rows.note);
				await db.noteFieldValues.bulkAdd(rows.fieldValues);
				await db.cards.bulkAdd(rows.cards);

				return rows;
			},
		);
	},

	/**
	 * Create many notes at once (bulk import).
	 *
	 * Rows are written in chunked transactions instead of one giant one: a
	 * multi-thousand row import stays responsive because the event loop is
	 * released between chunks, and `onProgress` can drive a progress bar. Rows
	 * whose note type is missing are reported in `failed` rather than aborting
	 * the whole import.
	 */
	async bulkCreateWithCards(
		input: { deckId: string; notes: BulkNoteInput[] },
		options: BulkCreateOptions = {},
	): Promise<BulkCreateResult> {
		const total = input.notes.length;
		const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_BULK_CHUNK_SIZE);
		const failed: { index: number; error: string }[] = [];
		let created = 0;

		if (total === 0) {
			return { created, failed };
		}

		// Load each distinct note type once instead of per row.
		const templates = new Map<string, NoteTemplate>();
		for (const noteTypeId of new Set(input.notes.map((n) => n.noteTypeId))) {
			const template = await loadNoteTemplate(noteTypeId);
			if (template) {
				templates.set(noteTypeId, template);
			}
		}

		for (let start = 0; start < total; start += chunkSize) {
			const chunk = input.notes.slice(start, start + chunkSize);
			const now = new Date();
			const notes: LocalNote[] = [];
			const fieldValues: LocalNoteFieldValue[] = [];
			const cards: LocalCard[] = [];
			const writtenIndexes: number[] = [];

			for (let i = 0; i < chunk.length; i++) {
				const entry = chunk[i];
				if (!entry) continue;

				const index = start + i;
				const template = templates.get(entry.noteTypeId);
				if (!template) {
					failed.push({ index, error: "Note type not found" });
					continue;
				}

				const rows = buildNoteRows({
					deckId: input.deckId,
					template,
					fields: entry.fields,
					now,
				});
				notes.push(rows.note);
				fieldValues.push(...rows.fieldValues);
				cards.push(...rows.cards);
				writtenIndexes.push(index);
			}

			if (notes.length > 0) {
				try {
					await db.transaction(
						"rw",
						[db.notes, db.noteFieldValues, db.cards],
						async () => {
							await db.notes.bulkAdd(notes);
							await db.noteFieldValues.bulkAdd(fieldValues);
							await db.cards.bulkAdd(cards);
						},
					);
					created += notes.length;
				} catch (err) {
					const message =
						err instanceof Error ? err.message : "Failed to import notes";
					for (const index of writtenIndexes) {
						failed.push({ index, error: message });
					}
				}
			}

			const done = Math.min(start + chunk.length, total);
			options.onProgress?.(done, total);

			if (done < total) {
				await yieldToEventLoop();
			}
		}

		failed.sort((a, b) => a.index - b.index);
		return { created, failed };
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
	 * Atomically bump the note's updatedAt and upsert each provided field value
	 * (creating one if the note never had a value for the field type yet).
	 */
	async updateWithFieldValues(
		id: string,
		fields: Record<string, string>,
	): Promise<
		{ note: LocalNote; fieldValues: LocalNoteFieldValue[] } | undefined
	> {
		return db.transaction("rw", [db.notes, db.noteFieldValues], async () => {
			const note = await db.notes.get(id);
			if (!note || note.deletedAt !== null) return undefined;

			const now = new Date();
			const updatedNote: LocalNote = {
				...note,
				updatedAt: now,
				_synced: false,
			};
			await db.notes.put(updatedNote);

			const updatedFieldValues: LocalNoteFieldValue[] = [];
			for (const [noteFieldTypeId, value] of Object.entries(fields)) {
				const existing = await db.noteFieldValues
					.where("noteId")
					.equals(id)
					.filter((fv) => fv.noteFieldTypeId === noteFieldTypeId)
					.first();

				if (existing) {
					const next: LocalNoteFieldValue = {
						...existing,
						value,
						updatedAt: now,
						_synced: false,
					};
					await db.noteFieldValues.put(next);
					updatedFieldValues.push(next);
				} else {
					const created: LocalNoteFieldValue = {
						id: uuidv4(),
						noteId: id,
						noteFieldTypeId,
						value,
						createdAt: now,
						updatedAt: now,
						syncVersion: 0,
						_synced: false,
					};
					await db.noteFieldValues.add(created);
					updatedFieldValues.push(created);
				}
			}

			return { note: updatedNote, fieldValues: updatedFieldValues };
		});
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
