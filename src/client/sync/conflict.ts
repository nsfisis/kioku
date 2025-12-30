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
 * Conflict resolution result for a single item
 */
export interface ConflictResolutionItem {
	id: string;
	resolution: "server_wins" | "local_wins";
}

/**
 * Result of conflict resolution process
 */
export interface ConflictResolutionResult {
	decks: ConflictResolutionItem[];
	cards: ConflictResolutionItem[];
	noteTypes: ConflictResolutionItem[];
	noteFieldTypes: ConflictResolutionItem[];
	notes: ConflictResolutionItem[];
	noteFieldValues: ConflictResolutionItem[];
}

/**
 * Options for conflict resolver
 */
export interface ConflictResolverOptions {
	/**
	 * Strategy for resolving conflicts
	 * - "server_wins": Always use server data (default for LWW)
	 * - "local_wins": Always use local data
	 * - "newer_wins": Compare timestamps and use newer data
	 */
	strategy?: "server_wins" | "local_wins" | "newer_wins";
}

/**
 * Compare timestamps for LWW resolution
 * Returns true if server data is newer or equal
 */
function isServerNewer(serverUpdatedAt: Date, localUpdatedAt: Date): boolean {
	return serverUpdatedAt.getTime() >= localUpdatedAt.getTime();
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
		newCardsPerDay: deck.newCardsPerDay,
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
		noteId: card.noteId ?? null,
		isReversed: card.isReversed ?? null,
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
 * When a conflict occurs (server has newer data), this resolver:
 * 1. Identifies conflicting items from push result
 * 2. Pulls latest server data for those items
 * 3. Applies conflict resolution strategy (default: server wins / LWW)
 * 4. Updates local database accordingly
 */
export class ConflictResolver {
	private strategy: "server_wins" | "local_wins" | "newer_wins";

	constructor(options: ConflictResolverOptions = {}) {
		this.strategy = options.strategy ?? "server_wins";
	}

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
	 * Resolve deck conflict using configured strategy
	 */
	async resolveDeckConflict(
		localDeck: LocalDeck,
		serverDeck: ServerDeck,
	): Promise<ConflictResolutionItem> {
		let resolution: "server_wins" | "local_wins";

		switch (this.strategy) {
			case "server_wins":
				resolution = "server_wins";
				break;
			case "local_wins":
				resolution = "local_wins";
				break;
			case "newer_wins":
				resolution = isServerNewer(
					new Date(serverDeck.updatedAt),
					localDeck.updatedAt,
				)
					? "server_wins"
					: "local_wins";
				break;
		}

		if (resolution === "server_wins") {
			// Update local with server data
			const localData = serverDeckToLocal(serverDeck);
			await localDeckRepository.upsertFromServer(localData);
		}
		// If local_wins, we keep local data and it will be pushed again next sync

		return { id: localDeck.id, resolution };
	}

	/**
	 * Resolve card conflict using configured strategy
	 */
	async resolveCardConflict(
		localCard: LocalCard,
		serverCard: ServerCard,
	): Promise<ConflictResolutionItem> {
		let resolution: "server_wins" | "local_wins";

		switch (this.strategy) {
			case "server_wins":
				resolution = "server_wins";
				break;
			case "local_wins":
				resolution = "local_wins";
				break;
			case "newer_wins":
				resolution = isServerNewer(
					new Date(serverCard.updatedAt),
					localCard.updatedAt,
				)
					? "server_wins"
					: "local_wins";
				break;
		}

		if (resolution === "server_wins") {
			// Update local with server data
			const localData = serverCardToLocal(serverCard);
			await localCardRepository.upsertFromServer(localData);
		}
		// If local_wins, we keep local data and it will be pushed again next sync

		return { id: localCard.id, resolution };
	}

	/**
	 * Resolve note type conflict using configured strategy
	 */
	async resolveNoteTypeConflict(
		localNoteType: LocalNoteType,
		serverNoteType: ServerNoteType,
	): Promise<ConflictResolutionItem> {
		let resolution: "server_wins" | "local_wins";

		switch (this.strategy) {
			case "server_wins":
				resolution = "server_wins";
				break;
			case "local_wins":
				resolution = "local_wins";
				break;
			case "newer_wins":
				resolution = isServerNewer(
					new Date(serverNoteType.updatedAt),
					localNoteType.updatedAt,
				)
					? "server_wins"
					: "local_wins";
				break;
		}

		if (resolution === "server_wins") {
			const localData = serverNoteTypeToLocal(serverNoteType);
			await localNoteTypeRepository.upsertFromServer(localData);
		}

		return { id: localNoteType.id, resolution };
	}

	/**
	 * Resolve note field type conflict using configured strategy
	 */
	async resolveNoteFieldTypeConflict(
		localFieldType: LocalNoteFieldType,
		serverFieldType: ServerNoteFieldType,
	): Promise<ConflictResolutionItem> {
		let resolution: "server_wins" | "local_wins";

		switch (this.strategy) {
			case "server_wins":
				resolution = "server_wins";
				break;
			case "local_wins":
				resolution = "local_wins";
				break;
			case "newer_wins":
				resolution = isServerNewer(
					new Date(serverFieldType.updatedAt),
					localFieldType.updatedAt,
				)
					? "server_wins"
					: "local_wins";
				break;
		}

		if (resolution === "server_wins") {
			const localData = serverNoteFieldTypeToLocal(serverFieldType);
			await localNoteFieldTypeRepository.upsertFromServer(localData);
		}

		return { id: localFieldType.id, resolution };
	}

	/**
	 * Resolve note conflict using configured strategy
	 */
	async resolveNoteConflict(
		localNote: LocalNote,
		serverNote: ServerNote,
	): Promise<ConflictResolutionItem> {
		let resolution: "server_wins" | "local_wins";

		switch (this.strategy) {
			case "server_wins":
				resolution = "server_wins";
				break;
			case "local_wins":
				resolution = "local_wins";
				break;
			case "newer_wins":
				resolution = isServerNewer(
					new Date(serverNote.updatedAt),
					localNote.updatedAt,
				)
					? "server_wins"
					: "local_wins";
				break;
		}

		if (resolution === "server_wins") {
			const localData = serverNoteToLocal(serverNote);
			await localNoteRepository.upsertFromServer(localData);
		}

		return { id: localNote.id, resolution };
	}

	/**
	 * Resolve note field value conflict using configured strategy
	 */
	async resolveNoteFieldValueConflict(
		localFieldValue: LocalNoteFieldValue,
		serverFieldValue: ServerNoteFieldValue,
	): Promise<ConflictResolutionItem> {
		let resolution: "server_wins" | "local_wins";

		switch (this.strategy) {
			case "server_wins":
				resolution = "server_wins";
				break;
			case "local_wins":
				resolution = "local_wins";
				break;
			case "newer_wins":
				resolution = isServerNewer(
					new Date(serverFieldValue.updatedAt),
					localFieldValue.updatedAt,
				)
					? "server_wins"
					: "local_wins";
				break;
		}

		if (resolution === "server_wins") {
			const localData = serverNoteFieldValueToLocal(serverFieldValue);
			await localNoteFieldValueRepository.upsertFromServer(localData);
		}

		return { id: localFieldValue.id, resolution };
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
				result.decks.push({ id: deckId, resolution: "server_wins" });
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
				result.cards.push({ id: cardId, resolution: "server_wins" });
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
				result.noteTypes.push({ id: noteTypeId, resolution: "server_wins" });
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
				result.noteFieldTypes.push({
					id: fieldTypeId,
					resolution: "server_wins",
				});
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
				result.notes.push({ id: noteId, resolution: "server_wins" });
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
				result.noteFieldValues.push({
					id: fieldValueId,
					resolution: "server_wins",
				});
			}
		}

		return result;
	}
}

/**
 * Create a conflict resolver with the given options
 */
export function createConflictResolver(
	options: ConflictResolverOptions = {},
): ConflictResolver {
	return new ConflictResolver(options);
}

/**
 * Default conflict resolver using LWW (server wins) strategy
 */
export const conflictResolver = new ConflictResolver({
	strategy: "server_wins",
});
