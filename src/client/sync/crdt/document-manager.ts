/**
 * Automerge Document Manager
 *
 * Manages the lifecycle of Automerge CRDT documents including:
 * - Document creation and initialization
 * - Document updates with change tracking
 * - Document merging for conflict resolution
 * - Conversion between local entities and CRDT documents
 */

import * as Automerge from "@automerge/automerge";
import type {
	LocalCard,
	LocalDeck,
	LocalNote,
	LocalNoteFieldType,
	LocalNoteFieldValue,
	LocalNoteType,
	LocalReviewLog,
} from "../../db/index";
import {
	type CrdtCardDocument,
	type CrdtDeckDocument,
	type CrdtDocumentMap,
	CrdtEntityType,
	type CrdtEntityTypeValue,
	type CrdtNoteDocument,
	type CrdtNoteFieldTypeDocument,
	type CrdtNoteFieldValueDocument,
	type CrdtNoteTypeDocument,
	type CrdtReviewLogDocument,
	createCrdtMetadata,
} from "./types";

/**
 * Result of a merge operation
 */
export interface MergeResult<T> {
	/** The merged document */
	merged: Automerge.Doc<T>;
	/** Whether the merge resulted in any changes */
	hasChanges: boolean;
	/** Binary representation of the merged document */
	binary: Uint8Array;
}

/**
 * Document change record for sync
 */
export interface DocumentChange {
	/** Entity type */
	entityType: CrdtEntityTypeValue;
	/** Entity ID */
	entityId: string;
	/** Binary changes since last sync (incremental) */
	changes: Uint8Array;
}

/**
 * Full document snapshot for initial sync
 */
export interface DocumentSnapshot {
	/** Entity type */
	entityType: CrdtEntityTypeValue;
	/** Entity ID */
	entityId: string;
	/** Full binary document */
	binary: Uint8Array;
}

/**
 * Create a new Automerge document with initial data
 */
export function createDocument<T>(data: T): Automerge.Doc<T> {
	// Type assertion needed because Automerge.from expects Record<string, unknown>
	// but we want to support typed documents
	return Automerge.from(data as Record<string, unknown>) as Automerge.Doc<T>;
}

/**
 * Update an Automerge document with new data
 * Returns a new document (Automerge documents are immutable)
 */
export function updateDocument<T>(
	doc: Automerge.Doc<T>,
	updater: (doc: T) => void,
): Automerge.Doc<T> {
	return Automerge.change(doc, updater);
}

/**
 * Merge two Automerge documents
 * This is used for conflict resolution - Automerge automatically handles concurrent changes
 */
export function mergeDocuments<T>(
	local: Automerge.Doc<T>,
	remote: Automerge.Doc<T>,
): MergeResult<T> {
	const merged = Automerge.merge(local, remote);
	const hasChanges = !Automerge.equals(local, merged);
	const binary = Automerge.save(merged);

	return { merged, hasChanges, binary };
}

/**
 * Get changes between two document states
 * Used for incremental sync
 */
export function getChanges<T>(
	oldDoc: Automerge.Doc<T>,
	newDoc: Automerge.Doc<T>,
): Automerge.Change[] {
	return Automerge.getChanges(oldDoc, newDoc);
}

/**
 * Apply changes to a document
 */
export function applyChanges<T>(
	doc: Automerge.Doc<T>,
	changes: Automerge.Change[],
): Automerge.Doc<T> {
	const [newDoc] = Automerge.applyChanges(doc, changes);
	return newDoc;
}

/**
 * Save incremental changes since last save
 * Returns binary data that can be loaded with loadIncremental
 */
export function saveIncremental<T>(doc: Automerge.Doc<T>): Uint8Array {
	return Automerge.saveIncremental(doc);
}

/**
 * Load incremental changes into a document
 */
export function loadIncremental<T>(
	doc: Automerge.Doc<T>,
	data: Uint8Array,
): Automerge.Doc<T> {
	return Automerge.loadIncremental(doc, data);
}

/**
 * Serialize a document to binary format
 */
export function saveDocument<T>(doc: Automerge.Doc<T>): Uint8Array {
	return Automerge.save(doc);
}

/**
 * Load a document from binary format
 */
export function loadDocument<T>(binary: Uint8Array): Automerge.Doc<T> {
	return Automerge.load(binary);
}

/**
 * Create an empty document of the given type
 * Used when receiving changes for a document that doesn't exist locally
 */
export function createEmptyDocument<T extends CrdtEntityTypeValue>(
	entityType: T,
): Automerge.Doc<CrdtDocumentMap[T]> {
	// Create minimal initial structure based on entity type
	const emptyData = getEmptyDocumentData(entityType);
	return Automerge.from(
		emptyData as unknown as Record<string, unknown>,
	) as Automerge.Doc<CrdtDocumentMap[T]>;
}

/**
 * Get empty document data structure for a given entity type
 */
function getEmptyDocumentData(
	entityType: CrdtEntityTypeValue,
): CrdtDocumentMap[CrdtEntityTypeValue] {
	const meta = createCrdtMetadata("");

	switch (entityType) {
		case CrdtEntityType.Deck:
			return {
				meta,
				data: {
					userId: "",
					name: "",
					description: null,
					defaultNoteTypeId: null,
					createdAt: 0,
					deletedAt: null,
				},
			} as CrdtDeckDocument;

		case CrdtEntityType.NoteType:
			return {
				meta,
				data: {
					userId: "",
					name: "",
					frontTemplate: "",
					backTemplate: "",
					isReversible: false,
					createdAt: 0,
					deletedAt: null,
				},
			} as CrdtNoteTypeDocument;

		case CrdtEntityType.NoteFieldType:
			return {
				meta,
				data: {
					noteTypeId: "",
					name: "",
					order: 0,
					fieldType: "text",
					createdAt: 0,
					deletedAt: null,
				},
			} as CrdtNoteFieldTypeDocument;

		case CrdtEntityType.Note:
			return {
				meta,
				data: {
					deckId: "",
					noteTypeId: "",
					createdAt: 0,
					deletedAt: null,
				},
			} as CrdtNoteDocument;

		case CrdtEntityType.NoteFieldValue:
			return {
				meta,
				data: {
					noteId: "",
					noteFieldTypeId: "",
					value: "",
					createdAt: 0,
				},
			} as CrdtNoteFieldValueDocument;

		case CrdtEntityType.Card:
			return {
				meta,
				data: {
					deckId: "",
					noteId: "",
					isReversed: false,
					front: "",
					back: "",
					state: 0,
					due: 0,
					stability: 0,
					difficulty: 0,
					elapsedDays: 0,
					scheduledDays: 0,
					reps: 0,
					lapses: 0,
					lastReview: null,
					createdAt: 0,
					deletedAt: null,
				},
			} as CrdtCardDocument;

		case CrdtEntityType.ReviewLog:
			return {
				meta,
				data: {
					cardId: "",
					userId: "",
					rating: 3,
					state: 0,
					scheduledDays: 0,
					elapsedDays: 0,
					reviewedAt: 0,
					durationMs: null,
				},
			} as CrdtReviewLogDocument;

		default: {
			const _exhaustive: never = entityType;
			throw new Error(`Unknown entity type: ${_exhaustive}`);
		}
	}
}

/**
 * Convert a LocalDeck to a CRDT document
 */
export function deckToCrdtDocument(deck: LocalDeck): CrdtDeckDocument {
	return {
		meta: {
			entityId: deck.id,
			lastModified: deck.updatedAt.getTime(),
			deleted: deck.deletedAt !== null,
		},
		data: {
			userId: deck.userId,
			name: deck.name,
			description: deck.description,
			defaultNoteTypeId: deck.defaultNoteTypeId,
			createdAt: deck.createdAt.getTime(),
			deletedAt: deck.deletedAt?.getTime() ?? null,
		},
	};
}

/**
 * Convert a CRDT document to LocalDeck data (without _synced flag)
 */
export function crdtDocumentToDeck(
	doc: CrdtDeckDocument,
): Omit<LocalDeck, "_synced"> {
	return {
		id: doc.meta.entityId,
		userId: doc.data.userId,
		name: doc.data.name,
		description: doc.data.description,
		defaultNoteTypeId: doc.data.defaultNoteTypeId ?? null,
		createdAt: new Date(doc.data.createdAt),
		updatedAt: new Date(doc.meta.lastModified),
		deletedAt: doc.data.deletedAt ? new Date(doc.data.deletedAt) : null,
		syncVersion: 0, // Will be set by sync layer
	};
}

/**
 * Convert a LocalNoteType to a CRDT document
 */
export function noteTypeToCrdtDocument(
	noteType: LocalNoteType,
): CrdtNoteTypeDocument {
	return {
		meta: {
			entityId: noteType.id,
			lastModified: noteType.updatedAt.getTime(),
			deleted: noteType.deletedAt !== null,
		},
		data: {
			userId: noteType.userId,
			name: noteType.name,
			frontTemplate: noteType.frontTemplate,
			backTemplate: noteType.backTemplate,
			isReversible: noteType.isReversible,
			createdAt: noteType.createdAt.getTime(),
			deletedAt: noteType.deletedAt?.getTime() ?? null,
		},
	};
}

/**
 * Convert a CRDT document to LocalNoteType data
 */
export function crdtDocumentToNoteType(
	doc: CrdtNoteTypeDocument,
): Omit<LocalNoteType, "_synced"> {
	return {
		id: doc.meta.entityId,
		userId: doc.data.userId,
		name: doc.data.name,
		frontTemplate: doc.data.frontTemplate,
		backTemplate: doc.data.backTemplate,
		isReversible: doc.data.isReversible,
		createdAt: new Date(doc.data.createdAt),
		updatedAt: new Date(doc.meta.lastModified),
		deletedAt: doc.data.deletedAt ? new Date(doc.data.deletedAt) : null,
		syncVersion: 0,
	};
}

/**
 * Convert a LocalNoteFieldType to a CRDT document
 */
export function noteFieldTypeToCrdtDocument(
	noteFieldType: LocalNoteFieldType,
): CrdtNoteFieldTypeDocument {
	return {
		meta: {
			entityId: noteFieldType.id,
			lastModified: noteFieldType.updatedAt.getTime(),
			deleted: noteFieldType.deletedAt !== null,
		},
		data: {
			noteTypeId: noteFieldType.noteTypeId,
			name: noteFieldType.name,
			order: noteFieldType.order,
			fieldType: noteFieldType.fieldType,
			createdAt: noteFieldType.createdAt.getTime(),
			deletedAt: noteFieldType.deletedAt?.getTime() ?? null,
		},
	};
}

/**
 * Convert a CRDT document to LocalNoteFieldType data
 */
export function crdtDocumentToNoteFieldType(
	doc: CrdtNoteFieldTypeDocument,
): Omit<LocalNoteFieldType, "_synced"> {
	return {
		id: doc.meta.entityId,
		noteTypeId: doc.data.noteTypeId,
		name: doc.data.name,
		order: doc.data.order,
		fieldType: doc.data.fieldType,
		createdAt: new Date(doc.data.createdAt),
		updatedAt: new Date(doc.meta.lastModified),
		deletedAt: doc.data.deletedAt ? new Date(doc.data.deletedAt) : null,
		syncVersion: 0,
	};
}

/**
 * Convert a LocalNote to a CRDT document
 */
export function noteToCrdtDocument(note: LocalNote): CrdtNoteDocument {
	return {
		meta: {
			entityId: note.id,
			lastModified: note.updatedAt.getTime(),
			deleted: note.deletedAt !== null,
		},
		data: {
			deckId: note.deckId,
			noteTypeId: note.noteTypeId,
			createdAt: note.createdAt.getTime(),
			deletedAt: note.deletedAt?.getTime() ?? null,
		},
	};
}

/**
 * Convert a CRDT document to LocalNote data
 */
export function crdtDocumentToNote(
	doc: CrdtNoteDocument,
): Omit<LocalNote, "_synced"> {
	return {
		id: doc.meta.entityId,
		deckId: doc.data.deckId,
		noteTypeId: doc.data.noteTypeId,
		createdAt: new Date(doc.data.createdAt),
		updatedAt: new Date(doc.meta.lastModified),
		deletedAt: doc.data.deletedAt ? new Date(doc.data.deletedAt) : null,
		syncVersion: 0,
	};
}

/**
 * Convert a LocalNoteFieldValue to a CRDT document
 */
export function noteFieldValueToCrdtDocument(
	noteFieldValue: LocalNoteFieldValue,
): CrdtNoteFieldValueDocument {
	return {
		meta: {
			entityId: noteFieldValue.id,
			lastModified: noteFieldValue.updatedAt.getTime(),
			deleted: false,
		},
		data: {
			noteId: noteFieldValue.noteId,
			noteFieldTypeId: noteFieldValue.noteFieldTypeId,
			value: noteFieldValue.value,
			createdAt: noteFieldValue.createdAt.getTime(),
		},
	};
}

/**
 * Convert a CRDT document to LocalNoteFieldValue data
 */
export function crdtDocumentToNoteFieldValue(
	doc: CrdtNoteFieldValueDocument,
): Omit<LocalNoteFieldValue, "_synced"> {
	return {
		id: doc.meta.entityId,
		noteId: doc.data.noteId,
		noteFieldTypeId: doc.data.noteFieldTypeId,
		value: doc.data.value,
		createdAt: new Date(doc.data.createdAt),
		updatedAt: new Date(doc.meta.lastModified),
		syncVersion: 0,
	};
}

/**
 * Convert a LocalCard to a CRDT document
 */
export function cardToCrdtDocument(card: LocalCard): CrdtCardDocument {
	return {
		meta: {
			entityId: card.id,
			lastModified: card.updatedAt.getTime(),
			deleted: card.deletedAt !== null,
		},
		data: {
			deckId: card.deckId,
			noteId: card.noteId,
			isReversed: card.isReversed,
			front: card.front,
			back: card.back,
			state: card.state,
			due: card.due.getTime(),
			stability: card.stability,
			difficulty: card.difficulty,
			elapsedDays: card.elapsedDays,
			scheduledDays: card.scheduledDays,
			reps: card.reps,
			lapses: card.lapses,
			lastReview: card.lastReview?.getTime() ?? null,
			createdAt: card.createdAt.getTime(),
			deletedAt: card.deletedAt?.getTime() ?? null,
		},
	};
}

/**
 * Convert a CRDT document to LocalCard data
 */
export function crdtDocumentToCard(
	doc: CrdtCardDocument,
): Omit<LocalCard, "_synced"> {
	return {
		id: doc.meta.entityId,
		deckId: doc.data.deckId,
		noteId: doc.data.noteId,
		isReversed: doc.data.isReversed,
		front: doc.data.front,
		back: doc.data.back,
		state: doc.data.state,
		due: new Date(doc.data.due),
		stability: doc.data.stability,
		difficulty: doc.data.difficulty,
		elapsedDays: doc.data.elapsedDays,
		scheduledDays: doc.data.scheduledDays,
		reps: doc.data.reps,
		lapses: doc.data.lapses,
		lastReview: doc.data.lastReview ? new Date(doc.data.lastReview) : null,
		createdAt: new Date(doc.data.createdAt),
		updatedAt: new Date(doc.meta.lastModified),
		deletedAt: doc.data.deletedAt ? new Date(doc.data.deletedAt) : null,
		syncVersion: 0,
	};
}

/**
 * Convert a LocalReviewLog to a CRDT document
 */
export function reviewLogToCrdtDocument(
	reviewLog: LocalReviewLog,
): CrdtReviewLogDocument {
	return {
		meta: {
			entityId: reviewLog.id,
			lastModified: reviewLog.reviewedAt.getTime(),
			deleted: false,
		},
		data: {
			cardId: reviewLog.cardId,
			userId: reviewLog.userId,
			rating: reviewLog.rating,
			state: reviewLog.state,
			scheduledDays: reviewLog.scheduledDays,
			elapsedDays: reviewLog.elapsedDays,
			reviewedAt: reviewLog.reviewedAt.getTime(),
			durationMs: reviewLog.durationMs,
		},
	};
}

/**
 * Convert a CRDT document to LocalReviewLog data
 */
export function crdtDocumentToReviewLog(
	doc: CrdtReviewLogDocument,
): Omit<LocalReviewLog, "_synced"> {
	return {
		id: doc.meta.entityId,
		cardId: doc.data.cardId,
		userId: doc.data.userId,
		rating: doc.data.rating,
		state: doc.data.state,
		scheduledDays: doc.data.scheduledDays,
		elapsedDays: doc.data.elapsedDays,
		reviewedAt: new Date(doc.data.reviewedAt),
		durationMs: doc.data.durationMs,
		syncVersion: 0,
	};
}

/**
 * Create an Automerge document from a local entity
 */
export function createDocumentFromEntity<T extends CrdtEntityTypeValue>(
	entityType: T,
	entity:
		| LocalDeck
		| LocalNoteType
		| LocalNoteFieldType
		| LocalNote
		| LocalNoteFieldValue
		| LocalCard
		| LocalReviewLog,
): Automerge.Doc<CrdtDocumentMap[T]> {
	let crdtDoc: CrdtDocumentMap[T];

	switch (entityType) {
		case CrdtEntityType.Deck:
			crdtDoc = deckToCrdtDocument(entity as LocalDeck) as CrdtDocumentMap[T];
			break;
		case CrdtEntityType.NoteType:
			crdtDoc = noteTypeToCrdtDocument(
				entity as LocalNoteType,
			) as CrdtDocumentMap[T];
			break;
		case CrdtEntityType.NoteFieldType:
			crdtDoc = noteFieldTypeToCrdtDocument(
				entity as LocalNoteFieldType,
			) as CrdtDocumentMap[T];
			break;
		case CrdtEntityType.Note:
			crdtDoc = noteToCrdtDocument(entity as LocalNote) as CrdtDocumentMap[T];
			break;
		case CrdtEntityType.NoteFieldValue:
			crdtDoc = noteFieldValueToCrdtDocument(
				entity as LocalNoteFieldValue,
			) as CrdtDocumentMap[T];
			break;
		case CrdtEntityType.Card:
			crdtDoc = cardToCrdtDocument(entity as LocalCard) as CrdtDocumentMap[T];
			break;
		case CrdtEntityType.ReviewLog:
			crdtDoc = reviewLogToCrdtDocument(
				entity as LocalReviewLog,
			) as CrdtDocumentMap[T];
			break;
		default: {
			const _exhaustive: never = entityType;
			throw new Error(`Unknown entity type: ${_exhaustive}`);
		}
	}

	return createDocument(crdtDoc);
}

/**
 * Get the actor ID for the current client
 * Used for Automerge to identify changes from this client
 */
export function getActorId(): string {
	const storageKey = "kioku-crdt-actor-id";
	let actorId = localStorage.getItem(storageKey);

	if (!actorId) {
		// Generate a new UUID-based actor ID
		actorId = crypto.randomUUID();
		localStorage.setItem(storageKey, actorId);
	}

	return actorId;
}

/**
 * Initialize a document with a specific actor ID
 * This ensures changes from this client are identifiable
 */
export function initDocumentWithActor<T>(
	data: T,
	actorId: string,
): Automerge.Doc<T> {
	return Automerge.from(data as Record<string, unknown>, {
		actor: actorId as Automerge.ActorId,
	}) as Automerge.Doc<T>;
}

/**
 * Check if two documents have diverged (have concurrent changes)
 */
export function hasConflicts<T>(
	local: Automerge.Doc<T>,
	remote: Automerge.Doc<T>,
): boolean {
	// Get the heads (latest change hashes) of both documents
	const localHeads = Automerge.getHeads(local);
	const remoteHeads = Automerge.getHeads(remote);

	// If either document is ahead of the other without sharing the latest changes,
	// they have diverged
	const localHasRemoteHeads = remoteHeads.every((h) => localHeads.includes(h));
	const remoteHasLocalHeads = localHeads.every((h) => remoteHeads.includes(h));

	// Conflict exists if neither fully contains the other's heads
	return !localHasRemoteHeads && !remoteHasLocalHeads;
}

/**
 * Get the last modified timestamp from a CRDT document
 */
export function getLastModified<T extends { meta: { lastModified: number } }>(
	doc: Automerge.Doc<T>,
): number {
	return doc.meta.lastModified;
}

/**
 * Check if a document represents a deleted entity
 */
export function isDeleted<T extends { meta: { deleted: boolean } }>(
	doc: Automerge.Doc<T>,
): boolean {
	return doc.meta.deleted;
}
