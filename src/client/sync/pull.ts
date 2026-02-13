import type {
	CardStateType,
	FieldTypeType,
	LocalCard,
	LocalDeck,
	LocalNote,
	LocalNoteFieldType,
	LocalNoteFieldValue,
	LocalNoteType,
	LocalReviewLog,
	RatingType,
} from "../db/index";
import {
	base64ToBinary,
	CrdtEntityType,
	type CrdtEntityTypeValue,
	type CrdtSyncPayload,
	crdtSyncStateManager,
	getCrdtRepository,
	mergeAndConvert,
	parseDocumentId,
} from "./crdt";
import type { SyncQueue } from "./queue";

/**
 * Server deck data format from pull response
 */
export interface ServerDeck {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
}

/**
 * Server card data format from pull response
 */
export interface ServerCard {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	front: string;
	back: string;
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

/**
 * Server review log data format from pull response
 */
export interface ServerReviewLog {
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

/**
 * Server note type data format from pull response
 */
export interface ServerNoteType {
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

/**
 * Server note field type data format from pull response
 */
export interface ServerNoteFieldType {
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

/**
 * Server note data format from pull response
 */
export interface ServerNote {
	id: string;
	deckId: string;
	noteTypeId: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	syncVersion: number;
}

/**
 * Server note field value data format from pull response
 */
export interface ServerNoteFieldValue {
	id: string;
	noteId: string;
	noteFieldTypeId: string;
	value: string;
	createdAt: Date;
	updatedAt: Date;
	syncVersion: number;
}

/**
 * Response from pull endpoint
 */
export interface SyncPullResult {
	decks: ServerDeck[];
	cards: ServerCard[];
	reviewLogs: ServerReviewLog[];
	noteTypes: ServerNoteType[];
	noteFieldTypes: ServerNoteFieldType[];
	notes: ServerNote[];
	noteFieldValues: ServerNoteFieldValue[];
	/** CRDT document changes for conflict-free sync */
	crdtChanges?: CrdtSyncPayload[];
	currentSyncVersion: number;
}

/**
 * Options for creating a pull service
 */
export interface PullServiceOptions {
	syncQueue: SyncQueue;
	pullFromServer: (lastSyncVersion: number) => Promise<SyncPullResult>;
}

/**
 * Convert server deck to local deck format
 */
function serverDeckToLocal(deck: ServerDeck): LocalDeck {
	return {
		id: deck.id,
		userId: deck.userId,
		name: deck.name,
		description: deck.description,
		createdAt: new Date(deck.createdAt),
		updatedAt: new Date(deck.updatedAt),
		deletedAt: deck.deletedAt ? new Date(deck.deletedAt) : null,
		syncVersion: deck.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server card to local card format
 */
function serverCardToLocal(card: ServerCard): LocalCard {
	return {
		id: card.id,
		deckId: card.deckId,
		noteId: card.noteId,
		isReversed: card.isReversed,
		front: card.front,
		back: card.back,
		state: card.state as CardStateType,
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
 * Convert server review log to local review log format
 */
function serverReviewLogToLocal(log: ServerReviewLog): LocalReviewLog {
	return {
		id: log.id,
		cardId: log.cardId,
		userId: log.userId,
		rating: log.rating as RatingType,
		state: log.state as CardStateType,
		scheduledDays: log.scheduledDays,
		elapsedDays: log.elapsedDays,
		reviewedAt: new Date(log.reviewedAt),
		durationMs: log.durationMs,
		syncVersion: log.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server note type to local note type format
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
 * Convert server note field type to local note field type format
 */
function serverNoteFieldTypeToLocal(
	fieldType: ServerNoteFieldType,
): LocalNoteFieldType {
	return {
		id: fieldType.id,
		noteTypeId: fieldType.noteTypeId,
		name: fieldType.name,
		order: fieldType.order,
		fieldType: fieldType.fieldType as FieldTypeType,
		createdAt: new Date(fieldType.createdAt),
		updatedAt: new Date(fieldType.updatedAt),
		deletedAt: fieldType.deletedAt ? new Date(fieldType.deletedAt) : null,
		syncVersion: fieldType.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server note to local note format
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
 * Convert server note field value to local note field value format
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
 * Convert server pull result to local format for storage
 */
export function pullResultToLocalData(result: SyncPullResult): {
	decks: LocalDeck[];
	cards: LocalCard[];
	reviewLogs: LocalReviewLog[];
	noteTypes: LocalNoteType[];
	noteFieldTypes: LocalNoteFieldType[];
	notes: LocalNote[];
	noteFieldValues: LocalNoteFieldValue[];
} {
	return {
		decks: result.decks.map(serverDeckToLocal),
		cards: result.cards.map(serverCardToLocal),
		reviewLogs: result.reviewLogs.map(serverReviewLogToLocal),
		noteTypes: result.noteTypes.map(serverNoteTypeToLocal),
		noteFieldTypes: result.noteFieldTypes.map(serverNoteFieldTypeToLocal),
		notes: result.notes.map(serverNoteToLocal),
		noteFieldValues: result.noteFieldValues.map(serverNoteFieldValueToLocal),
	};
}

/**
 * Result of applying CRDT changes
 */
export interface ApplyCrdtChangesResult {
	/** Number of documents that were merged */
	merged: number;
	/** Number of documents that were new (no local version) */
	created: number;
	/** Merged entities grouped by type */
	entities: {
		decks: Omit<LocalDeck, "_synced">[];
		noteTypes: Omit<LocalNoteType, "_synced">[];
		noteFieldTypes: Omit<LocalNoteFieldType, "_synced">[];
		notes: Omit<LocalNote, "_synced">[];
		noteFieldValues: Omit<LocalNoteFieldValue, "_synced">[];
		cards: Omit<LocalCard, "_synced">[];
		reviewLogs: Omit<LocalReviewLog, "_synced">[];
	};
}

/**
 * Apply CRDT changes from pull response
 *
 * This function:
 * 1. Parses each CRDT payload from the server
 * 2. Loads existing local CRDT document if present
 * 3. Merges remote and local documents using Automerge
 * 4. Stores the merged binary in sync state
 * 5. Converts merged document to local entity format
 *
 * @param crdtChanges Array of CRDT payloads from server
 * @param syncVersion The sync version to associate with merged documents
 * @returns Result containing merged entities ready for database storage
 */
export async function applyCrdtChanges(
	crdtChanges: CrdtSyncPayload[],
	syncVersion: number,
): Promise<ApplyCrdtChangesResult> {
	const result: ApplyCrdtChangesResult = {
		merged: 0,
		created: 0,
		entities: {
			decks: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			cards: [],
			reviewLogs: [],
		},
	};

	// Process each CRDT payload
	for (const payload of crdtChanges) {
		const parsed = parseDocumentId(payload.documentId);
		if (!parsed) {
			console.warn(`Invalid document ID: ${payload.documentId}`);
			continue;
		}

		const { entityType, entityId } = parsed;

		// Load existing local CRDT binary if present
		const localBinary = await crdtSyncStateManager.getDocumentBinary(
			entityType,
			entityId,
		);

		// Convert remote payload binary from base64
		const remoteBinary = base64ToBinary(payload.binary);

		// Get the repository and merge based on entity type
		// We use type assertions here because getCrdtRepository returns a union type
		// but we know the specific type based on entityType
		const repository = getCrdtRepository(entityType);
		const mergeResult = mergeAndConvert(
			localBinary,
			remoteBinary,
			// biome-ignore lint/suspicious/noExplicitAny: Repository type is determined by entityType at runtime
			repository as any,
		);

		// Store the merged binary in sync state
		await crdtSyncStateManager.setDocumentBinary(
			entityType,
			entityId,
			mergeResult.binary,
			syncVersion,
		);

		// Track statistics
		if (localBinary === null) {
			result.created++;
		} else {
			result.merged++;
		}

		// Add entity to the appropriate array based on type
		addEntityToResult(result.entities, entityType, mergeResult.entity);
	}

	return result;
}

/**
 * Helper to add an entity to the result based on its type
 */
function addEntityToResult(
	entities: ApplyCrdtChangesResult["entities"],
	entityType: CrdtEntityTypeValue,
	entity: unknown,
): void {
	switch (entityType) {
		case CrdtEntityType.Deck:
			entities.decks.push(entity as Omit<LocalDeck, "_synced">);
			break;
		case CrdtEntityType.NoteType:
			entities.noteTypes.push(entity as Omit<LocalNoteType, "_synced">);
			break;
		case CrdtEntityType.NoteFieldType:
			entities.noteFieldTypes.push(
				entity as Omit<LocalNoteFieldType, "_synced">,
			);
			break;
		case CrdtEntityType.Note:
			entities.notes.push(entity as Omit<LocalNote, "_synced">);
			break;
		case CrdtEntityType.NoteFieldValue:
			entities.noteFieldValues.push(
				entity as Omit<LocalNoteFieldValue, "_synced">,
			);
			break;
		case CrdtEntityType.Card:
			entities.cards.push(entity as Omit<LocalCard, "_synced">);
			break;
		case CrdtEntityType.ReviewLog:
			entities.reviewLogs.push(entity as Omit<LocalReviewLog, "_synced">);
			break;
	}
}

/**
 * Pull sync service
 *
 * Handles pulling changes from the server:
 * 1. Get last sync version from sync queue
 * 2. Request changes from server since that version
 * 3. Convert server data to local format
 * 4. Apply changes to local database
 * 5. Update sync version
 */
export class PullService {
	private syncQueue: SyncQueue;
	private pullFromServer: (lastSyncVersion: number) => Promise<SyncPullResult>;

	constructor(options: PullServiceOptions) {
		this.syncQueue = options.syncQueue;
		this.pullFromServer = options.pullFromServer;
	}

	/**
	 * Pull changes from the server
	 *
	 * @returns Result containing pulled items and new sync version
	 * @throws Error if pull fails
	 */
	async pull(): Promise<SyncPullResult> {
		const lastSyncVersion = this.syncQueue.getLastSyncVersion();

		// Pull changes from server
		const result = await this.pullFromServer(lastSyncVersion);

		// Process CRDT changes if present
		if (result.crdtChanges && result.crdtChanges.length > 0) {
			await applyCrdtChanges(result.crdtChanges, result.currentSyncVersion);
		}

		// If there are changes, apply them to local database
		if (
			result.decks.length > 0 ||
			result.cards.length > 0 ||
			result.reviewLogs.length > 0 ||
			result.noteTypes.length > 0 ||
			result.noteFieldTypes.length > 0 ||
			result.notes.length > 0 ||
			result.noteFieldValues.length > 0
		) {
			const localData = pullResultToLocalData(result);
			await this.syncQueue.applyPulledChanges(localData);
		}

		// Update sync version even if no changes (to mark we synced up to this point)
		if (result.currentSyncVersion > lastSyncVersion) {
			await this.syncQueue.completeSync(result.currentSyncVersion);
		}

		return result;
	}

	/**
	 * Get the last sync version
	 */
	getLastSyncVersion(): number {
		return this.syncQueue.getLastSyncVersion();
	}
}

/**
 * Create a pull service with the given options
 */
export function createPullService(options: PullServiceOptions): PullService {
	return new PullService(options);
}
