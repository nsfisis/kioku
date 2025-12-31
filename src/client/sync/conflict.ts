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
import {
	type CrdtSyncPayload,
	crdtCardRepository,
	crdtDeckRepository,
	crdtNoteFieldTypeRepository,
	crdtNoteFieldValueRepository,
	crdtNoteRepository,
	crdtNoteTypeRepository,
	crdtSyncStateManager,
} from "./crdt";
import { base64ToBinary } from "./crdt/sync-state";
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
	resolution: "server_wins";
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
 * CRDT merge result with entity data
 */
interface CrdtMergeConflictResult<T> {
	entity: Omit<T, "_synced">;
	binary: Uint8Array;
	hadLocalDocument: boolean;
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
 * When a conflict occurs (server has newer data), this resolver:
 * 1. Identifies conflicting items from push result
 * 2. Uses Automerge CRDT merge for conflict-free resolution
 * 3. Falls back to server_wins when CRDT data is unavailable
 * 4. Updates local database accordingly
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
	 * Resolve deck conflict using CRDT merge with server_wins fallback
	 */
	async resolveDeckConflict(
		localDeck: LocalDeck,
		serverDeck: ServerDeck,
		serverCrdtBinary?: Uint8Array,
	): Promise<ConflictResolutionItem> {
		// Try CRDT merge first if we have CRDT data
		if (serverCrdtBinary) {
			const mergeResult = await this.mergeDeckWithCrdt(
				localDeck,
				serverCrdtBinary,
			);
			if (mergeResult) {
				const localData: LocalDeck = {
					...mergeResult.entity,
					_synced: true,
				};
				await localDeckRepository.upsertFromServer(localData);
				// Store the merged CRDT binary
				await crdtSyncStateManager.setDocumentBinary(
					"deck",
					localDeck.id,
					mergeResult.binary,
					serverDeck.syncVersion,
				);
				return { id: localDeck.id, resolution: "server_wins" };
			}
		}

		// Fallback to server_wins when CRDT merge is not available
		const localData = serverDeckToLocal(serverDeck);
		await localDeckRepository.upsertFromServer(localData);

		return { id: localDeck.id, resolution: "server_wins" };
	}

	/**
	 * Merge deck using CRDT
	 */
	private async mergeDeckWithCrdt(
		localDeck: LocalDeck,
		serverBinary: Uint8Array,
	): Promise<CrdtMergeConflictResult<LocalDeck> | null> {
		try {
			// Get local CRDT binary if it exists
			const localBinary = await crdtSyncStateManager.getDocumentBinary(
				"deck",
				localDeck.id,
			);

			// If no local CRDT binary, create one from local entity
			const localDoc = localBinary
				? crdtDeckRepository.fromBinary(localBinary)
				: crdtDeckRepository.toCrdtDocument(localDeck).doc;

			// Load server document
			const serverDoc = crdtDeckRepository.fromBinary(serverBinary);

			// Merge documents
			const mergeResult = crdtDeckRepository.merge(localDoc, serverDoc);

			return {
				entity: crdtDeckRepository.toLocalEntity(mergeResult.merged),
				binary: mergeResult.binary,
				hadLocalDocument: localBinary !== null,
			};
		} catch (error) {
			console.warn(
				"CRDT merge failed for deck, falling back to server_wins:",
				error,
			);
			return null;
		}
	}

	/**
	 * Resolve card conflict using CRDT merge with server_wins fallback
	 */
	async resolveCardConflict(
		localCard: LocalCard,
		serverCard: ServerCard,
		serverCrdtBinary?: Uint8Array,
	): Promise<ConflictResolutionItem> {
		// Try CRDT merge first if we have CRDT data
		if (serverCrdtBinary) {
			const mergeResult = await this.mergeCardWithCrdt(
				localCard,
				serverCrdtBinary,
			);
			if (mergeResult) {
				const localData: LocalCard = {
					...mergeResult.entity,
					_synced: true,
				};
				await localCardRepository.upsertFromServer(localData);
				await crdtSyncStateManager.setDocumentBinary(
					"card",
					localCard.id,
					mergeResult.binary,
					serverCard.syncVersion,
				);
				return { id: localCard.id, resolution: "server_wins" };
			}
		}

		// Fallback to server_wins when CRDT merge is not available
		const localData = serverCardToLocal(serverCard);
		await localCardRepository.upsertFromServer(localData);

		return { id: localCard.id, resolution: "server_wins" };
	}

	/**
	 * Merge card using CRDT
	 */
	private async mergeCardWithCrdt(
		localCard: LocalCard,
		serverBinary: Uint8Array,
	): Promise<CrdtMergeConflictResult<LocalCard> | null> {
		try {
			const localBinary = await crdtSyncStateManager.getDocumentBinary(
				"card",
				localCard.id,
			);

			const localDoc = localBinary
				? crdtCardRepository.fromBinary(localBinary)
				: crdtCardRepository.toCrdtDocument(localCard).doc;

			const serverDoc = crdtCardRepository.fromBinary(serverBinary);
			const mergeResult = crdtCardRepository.merge(localDoc, serverDoc);

			return {
				entity: crdtCardRepository.toLocalEntity(mergeResult.merged),
				binary: mergeResult.binary,
				hadLocalDocument: localBinary !== null,
			};
		} catch (error) {
			console.warn(
				"CRDT merge failed for card, falling back to server_wins:",
				error,
			);
			return null;
		}
	}

	/**
	 * Resolve note type conflict using CRDT merge with server_wins fallback
	 */
	async resolveNoteTypeConflict(
		localNoteType: LocalNoteType,
		serverNoteType: ServerNoteType,
		serverCrdtBinary?: Uint8Array,
	): Promise<ConflictResolutionItem> {
		// Try CRDT merge first if we have CRDT data
		if (serverCrdtBinary) {
			const mergeResult = await this.mergeNoteTypeWithCrdt(
				localNoteType,
				serverCrdtBinary,
			);
			if (mergeResult) {
				const localData: LocalNoteType = {
					...mergeResult.entity,
					_synced: true,
				};
				await localNoteTypeRepository.upsertFromServer(localData);
				await crdtSyncStateManager.setDocumentBinary(
					"noteType",
					localNoteType.id,
					mergeResult.binary,
					serverNoteType.syncVersion,
				);
				return { id: localNoteType.id, resolution: "server_wins" };
			}
		}

		// Fallback to server_wins when CRDT merge is not available
		const localData = serverNoteTypeToLocal(serverNoteType);
		await localNoteTypeRepository.upsertFromServer(localData);

		return { id: localNoteType.id, resolution: "server_wins" };
	}

	/**
	 * Merge note type using CRDT
	 */
	private async mergeNoteTypeWithCrdt(
		localNoteType: LocalNoteType,
		serverBinary: Uint8Array,
	): Promise<CrdtMergeConflictResult<LocalNoteType> | null> {
		try {
			const localBinary = await crdtSyncStateManager.getDocumentBinary(
				"noteType",
				localNoteType.id,
			);

			const localDoc = localBinary
				? crdtNoteTypeRepository.fromBinary(localBinary)
				: crdtNoteTypeRepository.toCrdtDocument(localNoteType).doc;

			const serverDoc = crdtNoteTypeRepository.fromBinary(serverBinary);
			const mergeResult = crdtNoteTypeRepository.merge(localDoc, serverDoc);

			return {
				entity: crdtNoteTypeRepository.toLocalEntity(mergeResult.merged),
				binary: mergeResult.binary,
				hadLocalDocument: localBinary !== null,
			};
		} catch (error) {
			console.warn(
				"CRDT merge failed for note type, falling back to server_wins:",
				error,
			);
			return null;
		}
	}

	/**
	 * Resolve note field type conflict using CRDT merge with server_wins fallback
	 */
	async resolveNoteFieldTypeConflict(
		localFieldType: LocalNoteFieldType,
		serverFieldType: ServerNoteFieldType,
		serverCrdtBinary?: Uint8Array,
	): Promise<ConflictResolutionItem> {
		// Try CRDT merge first if we have CRDT data
		if (serverCrdtBinary) {
			const mergeResult = await this.mergeNoteFieldTypeWithCrdt(
				localFieldType,
				serverCrdtBinary,
			);
			if (mergeResult) {
				const localData: LocalNoteFieldType = {
					...mergeResult.entity,
					_synced: true,
				};
				await localNoteFieldTypeRepository.upsertFromServer(localData);
				await crdtSyncStateManager.setDocumentBinary(
					"noteFieldType",
					localFieldType.id,
					mergeResult.binary,
					serverFieldType.syncVersion,
				);
				return { id: localFieldType.id, resolution: "server_wins" };
			}
		}

		// Fallback to server_wins when CRDT merge is not available
		const localData = serverNoteFieldTypeToLocal(serverFieldType);
		await localNoteFieldTypeRepository.upsertFromServer(localData);

		return { id: localFieldType.id, resolution: "server_wins" };
	}

	/**
	 * Merge note field type using CRDT
	 */
	private async mergeNoteFieldTypeWithCrdt(
		localFieldType: LocalNoteFieldType,
		serverBinary: Uint8Array,
	): Promise<CrdtMergeConflictResult<LocalNoteFieldType> | null> {
		try {
			const localBinary = await crdtSyncStateManager.getDocumentBinary(
				"noteFieldType",
				localFieldType.id,
			);

			const localDoc = localBinary
				? crdtNoteFieldTypeRepository.fromBinary(localBinary)
				: crdtNoteFieldTypeRepository.toCrdtDocument(localFieldType).doc;

			const serverDoc = crdtNoteFieldTypeRepository.fromBinary(serverBinary);
			const mergeResult = crdtNoteFieldTypeRepository.merge(
				localDoc,
				serverDoc,
			);

			return {
				entity: crdtNoteFieldTypeRepository.toLocalEntity(mergeResult.merged),
				binary: mergeResult.binary,
				hadLocalDocument: localBinary !== null,
			};
		} catch (error) {
			console.warn(
				"CRDT merge failed for note field type, falling back to server_wins:",
				error,
			);
			return null;
		}
	}

	/**
	 * Resolve note conflict using CRDT merge with server_wins fallback
	 */
	async resolveNoteConflict(
		localNote: LocalNote,
		serverNote: ServerNote,
		serverCrdtBinary?: Uint8Array,
	): Promise<ConflictResolutionItem> {
		// Try CRDT merge first if we have CRDT data
		if (serverCrdtBinary) {
			const mergeResult = await this.mergeNoteWithCrdt(
				localNote,
				serverCrdtBinary,
			);
			if (mergeResult) {
				const localData: LocalNote = {
					...mergeResult.entity,
					_synced: true,
				};
				await localNoteRepository.upsertFromServer(localData);
				await crdtSyncStateManager.setDocumentBinary(
					"note",
					localNote.id,
					mergeResult.binary,
					serverNote.syncVersion,
				);
				return { id: localNote.id, resolution: "server_wins" };
			}
		}

		// Fallback to server_wins when CRDT merge is not available
		const localData = serverNoteToLocal(serverNote);
		await localNoteRepository.upsertFromServer(localData);

		return { id: localNote.id, resolution: "server_wins" };
	}

	/**
	 * Merge note using CRDT
	 */
	private async mergeNoteWithCrdt(
		localNote: LocalNote,
		serverBinary: Uint8Array,
	): Promise<CrdtMergeConflictResult<LocalNote> | null> {
		try {
			const localBinary = await crdtSyncStateManager.getDocumentBinary(
				"note",
				localNote.id,
			);

			const localDoc = localBinary
				? crdtNoteRepository.fromBinary(localBinary)
				: crdtNoteRepository.toCrdtDocument(localNote).doc;

			const serverDoc = crdtNoteRepository.fromBinary(serverBinary);
			const mergeResult = crdtNoteRepository.merge(localDoc, serverDoc);

			return {
				entity: crdtNoteRepository.toLocalEntity(mergeResult.merged),
				binary: mergeResult.binary,
				hadLocalDocument: localBinary !== null,
			};
		} catch (error) {
			console.warn(
				"CRDT merge failed for note, falling back to server_wins:",
				error,
			);
			return null;
		}
	}

	/**
	 * Resolve note field value conflict using CRDT merge with server_wins fallback
	 */
	async resolveNoteFieldValueConflict(
		localFieldValue: LocalNoteFieldValue,
		serverFieldValue: ServerNoteFieldValue,
		serverCrdtBinary?: Uint8Array,
	): Promise<ConflictResolutionItem> {
		// Try CRDT merge first if we have CRDT data
		if (serverCrdtBinary) {
			const mergeResult = await this.mergeNoteFieldValueWithCrdt(
				localFieldValue,
				serverCrdtBinary,
			);
			if (mergeResult) {
				const localData: LocalNoteFieldValue = {
					...mergeResult.entity,
					_synced: true,
				};
				await localNoteFieldValueRepository.upsertFromServer(localData);
				await crdtSyncStateManager.setDocumentBinary(
					"noteFieldValue",
					localFieldValue.id,
					mergeResult.binary,
					serverFieldValue.syncVersion,
				);
				return { id: localFieldValue.id, resolution: "server_wins" };
			}
		}

		// Fallback to server_wins when CRDT merge is not available
		const localData = serverNoteFieldValueToLocal(serverFieldValue);
		await localNoteFieldValueRepository.upsertFromServer(localData);

		return { id: localFieldValue.id, resolution: "server_wins" };
	}

	/**
	 * Merge note field value using CRDT
	 */
	private async mergeNoteFieldValueWithCrdt(
		localFieldValue: LocalNoteFieldValue,
		serverBinary: Uint8Array,
	): Promise<CrdtMergeConflictResult<LocalNoteFieldValue> | null> {
		try {
			const localBinary = await crdtSyncStateManager.getDocumentBinary(
				"noteFieldValue",
				localFieldValue.id,
			);

			const localDoc = localBinary
				? crdtNoteFieldValueRepository.fromBinary(localBinary)
				: crdtNoteFieldValueRepository.toCrdtDocument(localFieldValue).doc;

			const serverDoc = crdtNoteFieldValueRepository.fromBinary(serverBinary);
			const mergeResult = crdtNoteFieldValueRepository.merge(
				localDoc,
				serverDoc,
			);

			return {
				entity: crdtNoteFieldValueRepository.toLocalEntity(mergeResult.merged),
				binary: mergeResult.binary,
				hadLocalDocument: localBinary !== null,
			};
		} catch (error) {
			console.warn(
				"CRDT merge failed for note field value, falling back to server_wins:",
				error,
			);
			return null;
		}
	}

	/**
	 * Resolve all conflicts from a push result
	 * Uses pull result to get server data for conflicting items
	 * When CRDT changes are available, uses Automerge merge for resolution
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

		// Build a map of CRDT payloads by document ID for quick lookup
		const crdtPayloadMap = new Map<string, CrdtSyncPayload>();
		if (pullResult.crdtChanges) {
			for (const payload of pullResult.crdtChanges) {
				crdtPayloadMap.set(payload.documentId, payload);
			}
		}

		// Helper to get CRDT binary for an entity
		const getCrdtBinary = (
			entityType: string,
			entityId: string,
		): Uint8Array | undefined => {
			const payload = crdtPayloadMap.get(`${entityType}:${entityId}`);
			if (!payload) return undefined;
			try {
				return base64ToBinary(payload.binary);
			} catch {
				console.warn(
					`Failed to decode base64 for ${entityType}:${entityId}, skipping CRDT merge`,
				);
				return undefined;
			}
		};

		// Resolve deck conflicts
		for (const deckId of pushResult.conflicts.decks) {
			const localDeck = await localDeckRepository.findById(deckId);
			const serverDeck = pullResult.decks.find((d) => d.id === deckId);
			const crdtBinary = getCrdtBinary("deck", deckId);

			if (localDeck && serverDeck) {
				const resolution = await this.resolveDeckConflict(
					localDeck,
					serverDeck,
					crdtBinary,
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
			const crdtBinary = getCrdtBinary("card", cardId);

			if (localCard && serverCard) {
				const resolution = await this.resolveCardConflict(
					localCard,
					serverCard,
					crdtBinary,
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
			const crdtBinary = getCrdtBinary("noteType", noteTypeId);

			if (localNoteType && serverNoteType) {
				const resolution = await this.resolveNoteTypeConflict(
					localNoteType,
					serverNoteType,
					crdtBinary,
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
			const crdtBinary = getCrdtBinary("noteFieldType", fieldTypeId);

			if (localFieldType && serverFieldType) {
				const resolution = await this.resolveNoteFieldTypeConflict(
					localFieldType,
					serverFieldType,
					crdtBinary,
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
			const crdtBinary = getCrdtBinary("note", noteId);

			if (localNote && serverNote) {
				const resolution = await this.resolveNoteConflict(
					localNote,
					serverNote,
					crdtBinary,
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
			const crdtBinary = getCrdtBinary("noteFieldValue", fieldValueId);

			if (localFieldValue && serverFieldValue) {
				const resolution = await this.resolveNoteFieldValueConflict(
					localFieldValue,
					serverFieldValue,
					crdtBinary,
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
 * Create a conflict resolver
 */
export function createConflictResolver(): ConflictResolver {
	return new ConflictResolver();
}

/**
 * Default conflict resolver using CRDT (Automerge) merge
 * Falls back to server_wins when CRDT data is unavailable
 */
export const conflictResolver = new ConflictResolver();
