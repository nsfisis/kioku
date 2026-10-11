import type {
	LocalCard,
	LocalDeck,
	LocalNote,
	LocalNoteFieldType,
	LocalNoteFieldValue,
	LocalNoteType,
} from "../db/index";
import {
	localCardRepository,
	localDeckRepository,
	localNoteFieldTypeRepository,
	localNoteFieldValueRepository,
	localNoteRepository,
	localNoteTypeRepository,
} from "../db/repositories";
import type {
	ServerCard,
	ServerDeck,
	ServerNote,
	ServerNoteFieldType,
	ServerNoteFieldValue,
	ServerNoteType,
	SyncPullResult,
} from "./pull";
import type { SyncPushResult } from "./push";

/**
 * Result of conflict resolution process
 * Each array contains the IDs of resolved items
 *
 * There is deliberately no `reviewLogs` entry: review logs are append-only and
 * can never conflict (see {@link entityConflictPolicies}).
 */
export interface ConflictResolutionResult {
	decks: string[];
	cards: string[];
	noteTypes: string[];
	noteFieldTypes: string[];
	notes: string[];
	noteFieldValues: string[];
}

/**
 * The entity types that take part in sync.
 */
export const SyncEntityType = {
	Deck: "deck",
	NoteType: "noteType",
	NoteFieldType: "noteFieldType",
	Note: "note",
	NoteFieldValue: "noteFieldValue",
	Card: "card",
	ReviewLog: "reviewLog",
} as const;

export type SyncEntityTypeValue =
	(typeof SyncEntityType)[keyof typeof SyncEntityType];

/**
 * How a conflict on a given entity type is resolved.
 *
 * The server (`src/server/repositories/sync.ts`) is the one that decides *that*
 * a conflict happened: on push it compares `updatedAt` per row and only reports
 * a conflict when its own row is the newer one. These policies decide what the
 * client does with that verdict.
 */
export const ConflictPolicy = {
	/**
	 * Last-Write-Wins on `updatedAt`, at whole-row granularity.
	 *
	 * The server already applied LWW when it rejected our push, so the only
	 * consistent thing the client can do is take the server row verbatim.
	 * Merging field-by-field here would resurrect values the server has already
	 * discarded and leave the client permanently out of step with the server.
	 */
	Lww: "lww",
	/**
	 * Append-only: rows are immutable once written, so conflicts cannot happen.
	 * The server de-duplicates by primary key and the client never resolves them.
	 */
	AppendOnly: "append-only",
} as const;

export type ConflictPolicyValue =
	(typeof ConflictPolicy)[keyof typeof ConflictPolicy];

/**
 * The conflict resolution policy of every synced entity type.
 *
 * | Entity           | Policy      | Why                                                |
 * | ---------------- | ----------- | -------------------------------------------------- |
 * | `deck`           | LWW         | Metadata; single-user edits, rarely concurrent      |
 * | `noteType`       | LWW         | Template/config metadata                            |
 * | `noteFieldType`  | LWW         | Field definition metadata                           |
 * | `note`           | LWW         | Note metadata only (deck/note type/timestamps)      |
 * | `noteFieldValue` | LWW         | Note text, one row per field (see below)            |
 * | `card`           | LWW         | FSRS state is one coherent unit, never field-merged |
 * | `reviewLog`      | append-only | Immutable rows, keyed by client-generated UUID      |
 *
 * `noteFieldValue` is not merged: when two devices edit the same field, the
 * newer edit wins. Each field is its own row, so edits to different fields of
 * the same note do not conflict.
 */
export const entityConflictPolicies: Readonly<
	Record<SyncEntityTypeValue, ConflictPolicyValue>
> = {
	[SyncEntityType.Deck]: ConflictPolicy.Lww,
	[SyncEntityType.NoteType]: ConflictPolicy.Lww,
	[SyncEntityType.NoteFieldType]: ConflictPolicy.Lww,
	[SyncEntityType.Note]: ConflictPolicy.Lww,
	[SyncEntityType.NoteFieldValue]: ConflictPolicy.Lww,
	[SyncEntityType.Card]: ConflictPolicy.Lww,
	[SyncEntityType.ReviewLog]: ConflictPolicy.AppendOnly,
};

/**
 * Get the conflict resolution policy for an entity type
 */
export function getConflictPolicy(
	entityType: SyncEntityTypeValue,
): ConflictPolicyValue {
	return entityConflictPolicies[entityType];
}

/**
 * Convert server deck to local format for storage
 */
function serverDeckToLocal(deck: ServerDeck): LocalDeck {
	return {
		id: deck.id,
		userId: deck.userId,
		name: deck.name,
		description: deck.description,
		defaultNoteTypeId: deck.defaultNoteTypeId,
		createdAt: new Date(deck.createdAt),
		updatedAt: new Date(deck.updatedAt),
		deletedAt: deck.deletedAt ? new Date(deck.deletedAt) : null,
		syncVersion: deck.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server card to local format for storage
 */
function serverCardToLocal(card: ServerCard): LocalCard {
	return {
		id: card.id,
		deckId: card.deckId,
		noteId: card.noteId,
		isReversed: card.isReversed,
		front: card.front,
		back: card.back,
		state: card.state as LocalCard["state"],
		due: new Date(card.due),
		stability: card.stability,
		difficulty: card.difficulty,
		elapsedDays: card.elapsedDays,
		scheduledDays: card.scheduledDays,
		reps: card.reps,
		lapses: card.lapses,
		lastReview: card.lastReview ? new Date(card.lastReview) : null,
		createdAt: new Date(card.createdAt),
		updatedAt: new Date(card.updatedAt),
		deletedAt: card.deletedAt ? new Date(card.deletedAt) : null,
		syncVersion: card.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server note type to local format for storage
 */
function serverNoteTypeToLocal(noteType: ServerNoteType): LocalNoteType {
	return {
		id: noteType.id,
		userId: noteType.userId,
		name: noteType.name,
		frontTemplate: noteType.frontTemplate,
		backTemplate: noteType.backTemplate,
		isReversible: noteType.isReversible,
		createdAt: new Date(noteType.createdAt),
		updatedAt: new Date(noteType.updatedAt),
		deletedAt: noteType.deletedAt ? new Date(noteType.deletedAt) : null,
		syncVersion: noteType.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server note field type to local format for storage
 */
function serverNoteFieldTypeToLocal(
	fieldType: ServerNoteFieldType,
): LocalNoteFieldType {
	return {
		id: fieldType.id,
		noteTypeId: fieldType.noteTypeId,
		name: fieldType.name,
		order: fieldType.order,
		fieldType: fieldType.fieldType as LocalNoteFieldType["fieldType"],
		createdAt: new Date(fieldType.createdAt),
		updatedAt: new Date(fieldType.updatedAt),
		deletedAt: fieldType.deletedAt ? new Date(fieldType.deletedAt) : null,
		syncVersion: fieldType.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server note to local format for storage
 */
function serverNoteToLocal(note: ServerNote): LocalNote {
	return {
		id: note.id,
		deckId: note.deckId,
		noteTypeId: note.noteTypeId,
		createdAt: new Date(note.createdAt),
		updatedAt: new Date(note.updatedAt),
		deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
		syncVersion: note.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server note field value to local format for storage
 */
function serverNoteFieldValueToLocal(
	fieldValue: ServerNoteFieldValue,
): LocalNoteFieldValue {
	return {
		id: fieldValue.id,
		noteId: fieldValue.noteId,
		noteFieldTypeId: fieldValue.noteFieldTypeId,
		value: fieldValue.value,
		createdAt: new Date(fieldValue.createdAt),
		updatedAt: new Date(fieldValue.updatedAt),
		syncVersion: fieldValue.syncVersion,
		_synced: true,
	};
}

/**
 * Conflict Resolver
 *
 * Handles conflicts reported by the server during push operations.
 * Every entity type is resolved according to {@link entityConflictPolicies}:
 *
 * - LWW entities take the server row as-is, because the server only reports a
 *   conflict after it has already decided its row is the newer one.
 * - Append-only entities (review logs) never reach this class.
 */
export class ConflictResolver {
	/**
	 * Check if there are conflicts in push result
	 */
	hasConflicts(pushResult: SyncPushResult): boolean {
		return (
			pushResult.conflicts.decks.length > 0 ||
			pushResult.conflicts.cards.length > 0 ||
			pushResult.conflicts.noteTypes.length > 0 ||
			pushResult.conflicts.noteFieldTypes.length > 0 ||
			pushResult.conflicts.notes.length > 0 ||
			pushResult.conflicts.noteFieldValues.length > 0
		);
	}

	/**
	 * Get list of conflicting deck IDs
	 */
	getConflictingDeckIds(pushResult: SyncPushResult): string[] {
		return pushResult.conflicts.decks;
	}

	/**
	 * Get list of conflicting card IDs
	 */
	getConflictingCardIds(pushResult: SyncPushResult): string[] {
		return pushResult.conflicts.cards;
	}

	/**
	 * Resolve deck conflict (policy: LWW, so the server row wins)
	 */
	async resolveDeckConflict(
		localDeck: LocalDeck,
		serverDeck: ServerDeck,
	): Promise<string> {
		await localDeckRepository.upsertFromServer(serverDeckToLocal(serverDeck));
		return localDeck.id;
	}

	/**
	 * Resolve card conflict (policy: LWW, so the server row wins)
	 *
	 * FSRS scheduling state is only meaningful as a whole, so the losing device's
	 * review is discarded rather than merged field by field.
	 */
	async resolveCardConflict(
		localCard: LocalCard,
		serverCard: ServerCard,
	): Promise<string> {
		await localCardRepository.upsertFromServer(serverCardToLocal(serverCard));
		return localCard.id;
	}

	/**
	 * Resolve note type conflict (policy: LWW, so the server row wins)
	 */
	async resolveNoteTypeConflict(
		localNoteType: LocalNoteType,
		serverNoteType: ServerNoteType,
	): Promise<string> {
		await localNoteTypeRepository.upsertFromServer(
			serverNoteTypeToLocal(serverNoteType),
		);
		return localNoteType.id;
	}

	/**
	 * Resolve note field type conflict (policy: LWW, so the server row wins)
	 */
	async resolveNoteFieldTypeConflict(
		localFieldType: LocalNoteFieldType,
		serverFieldType: ServerNoteFieldType,
	): Promise<string> {
		await localNoteFieldTypeRepository.upsertFromServer(
			serverNoteFieldTypeToLocal(serverFieldType),
		);
		return localFieldType.id;
	}

	/**
	 * Resolve note conflict (policy: LWW, so the server row wins)
	 *
	 * Only note metadata lives on this row; the text lives in note field values.
	 */
	async resolveNoteConflict(
		localNote: LocalNote,
		serverNote: ServerNote,
	): Promise<string> {
		await localNoteRepository.upsertFromServer(serverNoteToLocal(serverNote));
		return localNote.id;
	}

	/**
	 * Resolve note field value conflict (policy: LWW, so the server row wins)
	 */
	async resolveNoteFieldValueConflict(
		localFieldValue: LocalNoteFieldValue,
		serverFieldValue: ServerNoteFieldValue,
	): Promise<string> {
		await localNoteFieldValueRepository.upsertFromServer(
			serverNoteFieldValueToLocal(serverFieldValue),
		);
		return localFieldValue.id;
	}

	/**
	 * Resolve all conflicts from a push result
	 * Uses pull result to get server data for conflicting items
	 */
	async resolveConflicts(
		pushResult: SyncPushResult,
		pullResult: SyncPullResult,
	): Promise<ConflictResolutionResult> {
		const result: ConflictResolutionResult = {
			decks: [],
			cards: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		};

		// Resolve deck conflicts
		for (const deckId of pushResult.conflicts.decks) {
			const localDeck = await localDeckRepository.findById(deckId);
			const serverDeck = pullResult.decks.find((d) => d.id === deckId);

			if (localDeck && serverDeck) {
				const resolution = await this.resolveDeckConflict(
					localDeck,
					serverDeck,
				);
				result.decks.push(resolution);
			} else if (serverDeck) {
				// Local doesn't exist, apply server data
				const localData = serverDeckToLocal(serverDeck);
				await localDeckRepository.upsertFromServer(localData);
				result.decks.push(deckId);
			}
			// If server doesn't have it but local does, keep local (will push again)
		}

		// Resolve card conflicts
		for (const cardId of pushResult.conflicts.cards) {
			const localCard = await localCardRepository.findById(cardId);
			const serverCard = pullResult.cards.find((c) => c.id === cardId);

			if (localCard && serverCard) {
				const resolution = await this.resolveCardConflict(
					localCard,
					serverCard,
				);
				result.cards.push(resolution);
			} else if (serverCard) {
				// Local doesn't exist, apply server data
				const localData = serverCardToLocal(serverCard);
				await localCardRepository.upsertFromServer(localData);
				result.cards.push(cardId);
			}
			// If server doesn't have it but local does, keep local (will push again)
		}

		// Resolve note type conflicts
		for (const noteTypeId of pushResult.conflicts.noteTypes) {
			const localNoteType = await localNoteTypeRepository.findById(noteTypeId);
			const serverNoteType = pullResult.noteTypes.find(
				(nt) => nt.id === noteTypeId,
			);

			if (localNoteType && serverNoteType) {
				const resolution = await this.resolveNoteTypeConflict(
					localNoteType,
					serverNoteType,
				);
				result.noteTypes.push(resolution);
			} else if (serverNoteType) {
				const localData = serverNoteTypeToLocal(serverNoteType);
				await localNoteTypeRepository.upsertFromServer(localData);
				result.noteTypes.push(noteTypeId);
			}
		}

		// Resolve note field type conflicts
		for (const fieldTypeId of pushResult.conflicts.noteFieldTypes) {
			const localFieldType =
				await localNoteFieldTypeRepository.findById(fieldTypeId);
			const serverFieldType = pullResult.noteFieldTypes.find(
				(ft) => ft.id === fieldTypeId,
			);

			if (localFieldType && serverFieldType) {
				const resolution = await this.resolveNoteFieldTypeConflict(
					localFieldType,
					serverFieldType,
				);
				result.noteFieldTypes.push(resolution);
			} else if (serverFieldType) {
				const localData = serverNoteFieldTypeToLocal(serverFieldType);
				await localNoteFieldTypeRepository.upsertFromServer(localData);
				result.noteFieldTypes.push(fieldTypeId);
			}
		}

		// Resolve note conflicts
		for (const noteId of pushResult.conflicts.notes) {
			const localNote = await localNoteRepository.findById(noteId);
			const serverNote = pullResult.notes.find((n) => n.id === noteId);

			if (localNote && serverNote) {
				const resolution = await this.resolveNoteConflict(
					localNote,
					serverNote,
				);
				result.notes.push(resolution);
			} else if (serverNote) {
				const localData = serverNoteToLocal(serverNote);
				await localNoteRepository.upsertFromServer(localData);
				result.notes.push(noteId);
			}
		}

		// Resolve note field value conflicts
		for (const fieldValueId of pushResult.conflicts.noteFieldValues) {
			const localFieldValue =
				await localNoteFieldValueRepository.findById(fieldValueId);
			const serverFieldValue = pullResult.noteFieldValues.find(
				(fv) => fv.id === fieldValueId,
			);

			if (localFieldValue && serverFieldValue) {
				const resolution = await this.resolveNoteFieldValueConflict(
					localFieldValue,
					serverFieldValue,
				);
				result.noteFieldValues.push(resolution);
			} else if (serverFieldValue) {
				const localData = serverNoteFieldValueToLocal(serverFieldValue);
				await localNoteFieldValueRepository.upsertFromServer(localData);
				result.noteFieldValues.push(fieldValueId);
			}
		}

		return result;
	}
}

/**
 * Create a conflict resolver
 */
export function createConflictResolver(): ConflictResolver {
	return new ConflictResolver();
}

/**
 * Default conflict resolver
 *
 * Resolution per entity type follows {@link entityConflictPolicies}.
 */
export const conflictResolver = new ConflictResolver();
