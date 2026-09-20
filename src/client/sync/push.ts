import type {
	LocalCard,
	LocalDeck,
	LocalNote,
	LocalNoteFieldType,
	LocalNoteFieldValue,
	LocalNoteType,
	LocalReviewLog,
} from "../db/index";
import {
	crdtCardRepository,
	crdtDeckRepository,
	crdtNoteFieldTypeRepository,
	crdtNoteFieldValueRepository,
	crdtNoteRepository,
	crdtNoteTypeRepository,
	crdtReviewLogRepository,
} from "./crdt";
import type { CrdtSyncPayload } from "./crdt/sync-state";
import { binaryToBase64 } from "./crdt/sync-state";
import type { PendingChanges, SyncQueue } from "./queue";

/**
 * Data format for push request to server
 */
export interface SyncPushData {
	decks: SyncDeckData[];
	cards: SyncCardData[];
	reviewLogs: SyncReviewLogData[];
	noteTypes: SyncNoteTypeData[];
	noteFieldTypes: SyncNoteFieldTypeData[];
	notes: SyncNoteData[];
	noteFieldValues: SyncNoteFieldValueData[];
	/** CRDT document changes for conflict-free sync */
	crdtChanges: CrdtSyncPayload[];
}

export interface SyncDeckData {
	id: string;
	name: string;
	description: string | null;
	defaultNoteTypeId: string | null;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncCardData {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	front: string;
	back: string;
	state: number;
	due: string;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	lastReview: string | null;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncReviewLogData {
	id: string;
	cardId: string;
	rating: number;
	state: number;
	scheduledDays: number;
	elapsedDays: number;
	reviewedAt: string;
	durationMs: number | null;
}

export interface SyncNoteTypeData {
	id: string;
	name: string;
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncNoteFieldTypeData {
	id: string;
	noteTypeId: string;
	name: string;
	order: number;
	fieldType: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncNoteData {
	id: string;
	deckId: string;
	noteTypeId: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncNoteFieldValueData {
	id: string;
	noteId: string;
	noteFieldTypeId: string;
	value: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Response from push endpoint
 */
export interface SyncPushResult {
	decks: { id: string; syncVersion: number }[];
	cards: { id: string; syncVersion: number }[];
	reviewLogs: { id: string; syncVersion: number }[];
	noteTypes: { id: string; syncVersion: number }[];
	noteFieldTypes: { id: string; syncVersion: number }[];
	notes: { id: string; syncVersion: number }[];
	noteFieldValues: { id: string; syncVersion: number }[];
	conflicts: {
		decks: string[];
		cards: string[];
		noteTypes: string[];
		noteFieldTypes: string[];
		notes: string[];
		noteFieldValues: string[];
	};
}

/**
 * Options for creating a push service
 */
export interface PushServiceOptions {
	syncQueue: SyncQueue;
	pushToServer: (data: SyncPushData) => Promise<SyncPushResult>;
	/**
	 * Maximum number of records sent in a single push request.
	 * Default: {@link DEFAULT_MAX_RECORDS_PER_REQUEST}
	 */
	maxRecordsPerRequest?: number;
}

/**
 * A bulk import can queue thousands of rows at once. Splitting them across
 * requests keeps each one small enough for the server to process without
 * hitting request size or timeout limits, and lets a partially completed push
 * keep the progress it already made.
 */
export const DEFAULT_MAX_RECORDS_PER_REQUEST = 500;

/**
 * Convert local deck to sync format
 */
function deckToSyncData(deck: LocalDeck): SyncDeckData {
	return {
		id: deck.id,
		name: deck.name,
		description: deck.description,
		defaultNoteTypeId: deck.defaultNoteTypeId,
		createdAt: deck.createdAt.toISOString(),
		updatedAt: deck.updatedAt.toISOString(),
		deletedAt: deck.deletedAt?.toISOString() ?? null,
	};
}

/**
 * Convert local card to sync format
 */
function cardToSyncData(card: LocalCard): SyncCardData {
	return {
		id: card.id,
		deckId: card.deckId,
		noteId: card.noteId,
		isReversed: card.isReversed,
		front: card.front,
		back: card.back,
		state: card.state,
		due: card.due.toISOString(),
		stability: card.stability,
		difficulty: card.difficulty,
		elapsedDays: card.elapsedDays,
		scheduledDays: card.scheduledDays,
		reps: card.reps,
		lapses: card.lapses,
		lastReview: card.lastReview?.toISOString() ?? null,
		createdAt: card.createdAt.toISOString(),
		updatedAt: card.updatedAt.toISOString(),
		deletedAt: card.deletedAt?.toISOString() ?? null,
	};
}

/**
 * Convert local review log to sync format
 */
function reviewLogToSyncData(log: LocalReviewLog): SyncReviewLogData {
	return {
		id: log.id,
		cardId: log.cardId,
		rating: log.rating,
		state: log.state,
		scheduledDays: log.scheduledDays,
		elapsedDays: log.elapsedDays,
		reviewedAt: log.reviewedAt.toISOString(),
		durationMs: log.durationMs,
	};
}

/**
 * Convert local note type to sync format
 */
function noteTypeToSyncData(noteType: LocalNoteType): SyncNoteTypeData {
	return {
		id: noteType.id,
		name: noteType.name,
		frontTemplate: noteType.frontTemplate,
		backTemplate: noteType.backTemplate,
		isReversible: noteType.isReversible,
		createdAt: noteType.createdAt.toISOString(),
		updatedAt: noteType.updatedAt.toISOString(),
		deletedAt: noteType.deletedAt?.toISOString() ?? null,
	};
}

/**
 * Convert local note field type to sync format
 */
function noteFieldTypeToSyncData(
	fieldType: LocalNoteFieldType,
): SyncNoteFieldTypeData {
	return {
		id: fieldType.id,
		noteTypeId: fieldType.noteTypeId,
		name: fieldType.name,
		order: fieldType.order,
		fieldType: fieldType.fieldType,
		createdAt: fieldType.createdAt.toISOString(),
		updatedAt: fieldType.updatedAt.toISOString(),
		deletedAt: fieldType.deletedAt?.toISOString() ?? null,
	};
}

/**
 * Convert local note to sync format
 */
function noteToSyncData(note: LocalNote): SyncNoteData {
	return {
		id: note.id,
		deckId: note.deckId,
		noteTypeId: note.noteTypeId,
		createdAt: note.createdAt.toISOString(),
		updatedAt: note.updatedAt.toISOString(),
		deletedAt: note.deletedAt?.toISOString() ?? null,
	};
}

/**
 * Convert local note field value to sync format
 */
function noteFieldValueToSyncData(
	fieldValue: LocalNoteFieldValue,
): SyncNoteFieldValueData {
	return {
		id: fieldValue.id,
		noteId: fieldValue.noteId,
		noteFieldTypeId: fieldValue.noteFieldTypeId,
		value: fieldValue.value,
		createdAt: fieldValue.createdAt.toISOString(),
		updatedAt: fieldValue.updatedAt.toISOString(),
	};
}

/**
 * Generate CRDT sync payloads from pending changes
 */
export function generateCrdtChanges(
	changes: PendingChanges,
): CrdtSyncPayload[] {
	const crdtChanges: CrdtSyncPayload[] = [];

	// Convert decks to CRDT documents
	for (const deck of changes.decks) {
		const result = crdtDeckRepository.toCrdtDocument(deck);
		crdtChanges.push({
			documentId: result.documentId,
			entityType: crdtDeckRepository.entityType,
			entityId: deck.id,
			binary: binaryToBase64(result.binary),
		});
	}

	// Convert note types to CRDT documents
	for (const noteType of changes.noteTypes) {
		const result = crdtNoteTypeRepository.toCrdtDocument(noteType);
		crdtChanges.push({
			documentId: result.documentId,
			entityType: crdtNoteTypeRepository.entityType,
			entityId: noteType.id,
			binary: binaryToBase64(result.binary),
		});
	}

	// Convert note field types to CRDT documents
	for (const fieldType of changes.noteFieldTypes) {
		const result = crdtNoteFieldTypeRepository.toCrdtDocument(fieldType);
		crdtChanges.push({
			documentId: result.documentId,
			entityType: crdtNoteFieldTypeRepository.entityType,
			entityId: fieldType.id,
			binary: binaryToBase64(result.binary),
		});
	}

	// Convert notes to CRDT documents
	for (const note of changes.notes) {
		const result = crdtNoteRepository.toCrdtDocument(note);
		crdtChanges.push({
			documentId: result.documentId,
			entityType: crdtNoteRepository.entityType,
			entityId: note.id,
			binary: binaryToBase64(result.binary),
		});
	}

	// Convert note field values to CRDT documents
	for (const fieldValue of changes.noteFieldValues) {
		const result = crdtNoteFieldValueRepository.toCrdtDocument(fieldValue);
		crdtChanges.push({
			documentId: result.documentId,
			entityType: crdtNoteFieldValueRepository.entityType,
			entityId: fieldValue.id,
			binary: binaryToBase64(result.binary),
		});
	}

	// Convert cards to CRDT documents
	for (const card of changes.cards) {
		const result = crdtCardRepository.toCrdtDocument(card);
		crdtChanges.push({
			documentId: result.documentId,
			entityType: crdtCardRepository.entityType,
			entityId: card.id,
			binary: binaryToBase64(result.binary),
		});
	}

	// Convert review logs to CRDT documents
	for (const reviewLog of changes.reviewLogs) {
		const result = crdtReviewLogRepository.toCrdtDocument(reviewLog);
		crdtChanges.push({
			documentId: result.documentId,
			entityType: crdtReviewLogRepository.entityType,
			entityId: reviewLog.id,
			binary: binaryToBase64(result.binary),
		});
	}

	return crdtChanges;
}

function createEmptyPendingChanges(): PendingChanges {
	return {
		decks: [],
		cards: [],
		reviewLogs: [],
		noteTypes: [],
		noteFieldTypes: [],
		notes: [],
		noteFieldValues: [],
	};
}

function createEmptyPushResult(): SyncPushResult {
	return {
		decks: [],
		cards: [],
		reviewLogs: [],
		noteTypes: [],
		noteFieldTypes: [],
		notes: [],
		noteFieldValues: [],
		conflicts: {
			decks: [],
			cards: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
		},
	};
}

interface BatchState {
	batches: PendingChanges[];
	current: PendingChanges;
	count: number;
}

function appendToBatches<T>(
	items: T[],
	select: (batch: PendingChanges) => T[],
	state: BatchState,
	limit: number,
): void {
	for (const item of items) {
		if (state.count >= limit) {
			state.batches.push(state.current);
			state.current = createEmptyPendingChanges();
			state.count = 0;
		}
		select(state.current).push(item);
		state.count++;
	}
}

/**
 * Split pending changes into batches of at most `maxRecords` records each.
 *
 * Entities are laid out in dependency order (note types → field types → decks
 * → notes → field values → cards → review logs), so a referenced row is always
 * pushed in the same batch as, or an earlier batch than, the rows referencing
 * it. Returns an empty array when there is nothing to push.
 */
export function splitPendingChanges(
	changes: PendingChanges,
	maxRecords: number,
): PendingChanges[] {
	const limit = Math.max(1, maxRecords);
	const state: BatchState = {
		batches: [],
		current: createEmptyPendingChanges(),
		count: 0,
	};

	appendToBatches(changes.noteTypes, (b) => b.noteTypes, state, limit);
	appendToBatches(
		changes.noteFieldTypes,
		(b) => b.noteFieldTypes,
		state,
		limit,
	);
	appendToBatches(changes.decks, (b) => b.decks, state, limit);
	appendToBatches(changes.notes, (b) => b.notes, state, limit);
	appendToBatches(
		changes.noteFieldValues,
		(b) => b.noteFieldValues,
		state,
		limit,
	);
	appendToBatches(changes.cards, (b) => b.cards, state, limit);
	appendToBatches(changes.reviewLogs, (b) => b.reviewLogs, state, limit);

	if (state.count > 0) {
		state.batches.push(state.current);
	}

	return state.batches;
}

/**
 * Accumulate a batch's push result into the combined result
 */
function mergePushResult(target: SyncPushResult, source: SyncPushResult): void {
	target.decks.push(...source.decks);
	target.cards.push(...source.cards);
	target.reviewLogs.push(...source.reviewLogs);
	target.noteTypes.push(...source.noteTypes);
	target.noteFieldTypes.push(...source.noteFieldTypes);
	target.notes.push(...source.notes);
	target.noteFieldValues.push(...source.noteFieldValues);
	target.conflicts.decks.push(...source.conflicts.decks);
	target.conflicts.cards.push(...source.conflicts.cards);
	target.conflicts.noteTypes.push(...source.conflicts.noteTypes);
	target.conflicts.noteFieldTypes.push(...source.conflicts.noteFieldTypes);
	target.conflicts.notes.push(...source.conflicts.notes);
	target.conflicts.noteFieldValues.push(...source.conflicts.noteFieldValues);
}

/**
 * Convert pending changes to sync push data format
 */
export function pendingChangesToPushData(
	changes: PendingChanges,
): SyncPushData {
	return {
		decks: changes.decks.map(deckToSyncData),
		cards: changes.cards.map(cardToSyncData),
		reviewLogs: changes.reviewLogs.map(reviewLogToSyncData),
		noteTypes: changes.noteTypes.map(noteTypeToSyncData),
		noteFieldTypes: changes.noteFieldTypes.map(noteFieldTypeToSyncData),
		notes: changes.notes.map(noteToSyncData),
		noteFieldValues: changes.noteFieldValues.map(noteFieldValueToSyncData),
		crdtChanges: generateCrdtChanges(changes),
	};
}

/**
 * Push sync service
 *
 * Handles pushing local changes to the server:
 * 1. Get pending changes from sync queue
 * 2. Convert to API format
 * 3. Send to server
 * 4. Mark items as synced on success
 * 5. Handle conflicts using CRDT merge (fallback to server_wins)
 */
export class PushService {
	private syncQueue: SyncQueue;
	private pushToServer: (data: SyncPushData) => Promise<SyncPushResult>;
	private maxRecordsPerRequest: number;

	constructor(options: PushServiceOptions) {
		this.syncQueue = options.syncQueue;
		this.pushToServer = options.pushToServer;
		this.maxRecordsPerRequest =
			options.maxRecordsPerRequest ?? DEFAULT_MAX_RECORDS_PER_REQUEST;
	}

	/**
	 * Push all pending changes to the server
	 *
	 * @returns Result containing synced items and conflicts
	 * @throws Error if push fails
	 */
	async push(): Promise<SyncPushResult> {
		const pendingChanges = await this.syncQueue.getPendingChanges();
		const batches = splitPendingChanges(
			pendingChanges,
			this.maxRecordsPerRequest,
		);

		// With nothing pending there are no batches, so no request is made.
		const merged = createEmptyPushResult();

		for (const batch of batches) {
			const result = await this.pushToServer(pendingChangesToPushData(batch));

			// Mark this batch's items as synced before sending the next one, so a
			// failure halfway through a large import does not re-push what the
			// server already accepted.
			await this.syncQueue.markSynced({
				decks: result.decks,
				cards: result.cards,
				reviewLogs: result.reviewLogs,
				noteTypes: result.noteTypes,
				noteFieldTypes: result.noteFieldTypes,
				notes: result.notes,
				noteFieldValues: result.noteFieldValues,
			});

			mergePushResult(merged, result);
		}

		return merged;
	}

	/**
	 * Check if there are pending changes to push
	 */
	async hasPendingChanges(): Promise<boolean> {
		return this.syncQueue.hasPendingChanges();
	}
}

/**
 * Create a push service with the given options
 */
export function createPushService(options: PushServiceOptions): PushService {
	return new PushService(options);
}
