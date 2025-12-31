/**
 * CRDT-Aware Repository Wrappers
 *
 * This module provides CRDT-aware repository wrappers that handle the conversion
 * between local entities and Automerge CRDT documents. These repositories are used
 * during sync operations to create, update, and merge CRDT documents.
 *
 * Design:
 * - Each entity type has a corresponding CRDT repository
 * - Repositories handle conversion to/from CRDT format
 * - Binary serialization is handled for sync payload
 * - Merge operations use Automerge's conflict-free merge
 */

import type * as Automerge from "@automerge/automerge";
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
	cardToCrdtDocument,
	crdtDocumentToCard,
	crdtDocumentToDeck,
	crdtDocumentToNote,
	crdtDocumentToNoteFieldType,
	crdtDocumentToNoteFieldValue,
	crdtDocumentToNoteType,
	crdtDocumentToReviewLog,
	createDocument,
	deckToCrdtDocument,
	loadDocument,
	type MergeResult,
	mergeDocuments,
	noteFieldTypeToCrdtDocument,
	noteFieldValueToCrdtDocument,
	noteToCrdtDocument,
	noteTypeToCrdtDocument,
	reviewLogToCrdtDocument,
	saveDocument,
} from "./document-manager";
import type {
	CrdtCardDocument,
	CrdtDeckDocument,
	CrdtEntityTypeValue,
	CrdtNoteDocument,
	CrdtNoteFieldTypeDocument,
	CrdtNoteFieldValueDocument,
	CrdtNoteTypeDocument,
	CrdtReviewLogDocument,
} from "./types";
import { CrdtEntityType, createDocumentId, parseDocumentId } from "./types";

/**
 * Result of creating or updating a CRDT document
 */
export interface CrdtDocumentResult<T> {
	/** The Automerge document */
	doc: Automerge.Doc<T>;
	/** Binary representation for sync */
	binary: Uint8Array;
	/** Document ID (entityType:entityId format) */
	documentId: string;
}

/**
 * Result of merging CRDT documents
 */
export interface CrdtMergeResult<T> {
	/** The merged document */
	doc: Automerge.Doc<T>;
	/** Binary representation of merged document */
	binary: Uint8Array;
	/** Whether the merge resulted in any changes */
	hasChanges: boolean;
	/** Converted local entity from merged document */
	entity: T extends CrdtDeckDocument
		? Omit<LocalDeck, "_synced">
		: T extends CrdtNoteTypeDocument
			? Omit<LocalNoteType, "_synced">
			: T extends CrdtNoteFieldTypeDocument
				? Omit<LocalNoteFieldType, "_synced">
				: T extends CrdtNoteDocument
					? Omit<LocalNote, "_synced">
					: T extends CrdtNoteFieldValueDocument
						? Omit<LocalNoteFieldValue, "_synced">
						: T extends CrdtCardDocument
							? Omit<LocalCard, "_synced">
							: T extends CrdtReviewLogDocument
								? Omit<LocalReviewLog, "_synced">
								: never;
}

/**
 * Base interface for CRDT repositories
 */
export interface CrdtRepository<TLocal, TCrdt> {
	/** Entity type identifier */
	readonly entityType: CrdtEntityTypeValue;

	/** Convert local entity to CRDT document and serialize */
	toCrdtDocument(entity: TLocal): CrdtDocumentResult<TCrdt>;

	/** Load CRDT document from binary data */
	fromBinary(binary: Uint8Array): Automerge.Doc<TCrdt>;

	/** Merge local and remote documents */
	merge(
		local: Automerge.Doc<TCrdt>,
		remote: Automerge.Doc<TCrdt>,
	): MergeResult<TCrdt>;

	/** Convert CRDT document to local entity format */
	toLocalEntity(doc: Automerge.Doc<TCrdt>): Omit<TLocal, "_synced">;

	/** Create document ID for an entity */
	createDocumentId(entityId: string): string;
}

/**
 * CRDT Repository for Deck entities
 */
export const crdtDeckRepository: CrdtRepository<LocalDeck, CrdtDeckDocument> = {
	entityType: CrdtEntityType.Deck,

	toCrdtDocument(deck: LocalDeck): CrdtDocumentResult<CrdtDeckDocument> {
		const crdtData = deckToCrdtDocument(deck);
		const doc = createDocument(crdtData);
		const binary = saveDocument(doc);
		const documentId = createDocumentId(this.entityType, deck.id);

		return { doc, binary, documentId };
	},

	fromBinary(binary: Uint8Array): Automerge.Doc<CrdtDeckDocument> {
		return loadDocument<CrdtDeckDocument>(binary);
	},

	merge(
		local: Automerge.Doc<CrdtDeckDocument>,
		remote: Automerge.Doc<CrdtDeckDocument>,
	): MergeResult<CrdtDeckDocument> {
		return mergeDocuments(local, remote);
	},

	toLocalEntity(
		doc: Automerge.Doc<CrdtDeckDocument>,
	): Omit<LocalDeck, "_synced"> {
		return crdtDocumentToDeck(doc);
	},

	createDocumentId(entityId: string): string {
		return createDocumentId(this.entityType, entityId);
	},
};

/**
 * CRDT Repository for NoteType entities
 */
export const crdtNoteTypeRepository: CrdtRepository<
	LocalNoteType,
	CrdtNoteTypeDocument
> = {
	entityType: CrdtEntityType.NoteType,

	toCrdtDocument(
		noteType: LocalNoteType,
	): CrdtDocumentResult<CrdtNoteTypeDocument> {
		const crdtData = noteTypeToCrdtDocument(noteType);
		const doc = createDocument(crdtData);
		const binary = saveDocument(doc);
		const documentId = createDocumentId(this.entityType, noteType.id);

		return { doc, binary, documentId };
	},

	fromBinary(binary: Uint8Array): Automerge.Doc<CrdtNoteTypeDocument> {
		return loadDocument<CrdtNoteTypeDocument>(binary);
	},

	merge(
		local: Automerge.Doc<CrdtNoteTypeDocument>,
		remote: Automerge.Doc<CrdtNoteTypeDocument>,
	): MergeResult<CrdtNoteTypeDocument> {
		return mergeDocuments(local, remote);
	},

	toLocalEntity(
		doc: Automerge.Doc<CrdtNoteTypeDocument>,
	): Omit<LocalNoteType, "_synced"> {
		return crdtDocumentToNoteType(doc);
	},

	createDocumentId(entityId: string): string {
		return createDocumentId(this.entityType, entityId);
	},
};

/**
 * CRDT Repository for NoteFieldType entities
 */
export const crdtNoteFieldTypeRepository: CrdtRepository<
	LocalNoteFieldType,
	CrdtNoteFieldTypeDocument
> = {
	entityType: CrdtEntityType.NoteFieldType,

	toCrdtDocument(
		fieldType: LocalNoteFieldType,
	): CrdtDocumentResult<CrdtNoteFieldTypeDocument> {
		const crdtData = noteFieldTypeToCrdtDocument(fieldType);
		const doc = createDocument(crdtData);
		const binary = saveDocument(doc);
		const documentId = createDocumentId(this.entityType, fieldType.id);

		return { doc, binary, documentId };
	},

	fromBinary(binary: Uint8Array): Automerge.Doc<CrdtNoteFieldTypeDocument> {
		return loadDocument<CrdtNoteFieldTypeDocument>(binary);
	},

	merge(
		local: Automerge.Doc<CrdtNoteFieldTypeDocument>,
		remote: Automerge.Doc<CrdtNoteFieldTypeDocument>,
	): MergeResult<CrdtNoteFieldTypeDocument> {
		return mergeDocuments(local, remote);
	},

	toLocalEntity(
		doc: Automerge.Doc<CrdtNoteFieldTypeDocument>,
	): Omit<LocalNoteFieldType, "_synced"> {
		return crdtDocumentToNoteFieldType(doc);
	},

	createDocumentId(entityId: string): string {
		return createDocumentId(this.entityType, entityId);
	},
};

/**
 * CRDT Repository for Note entities
 */
export const crdtNoteRepository: CrdtRepository<LocalNote, CrdtNoteDocument> = {
	entityType: CrdtEntityType.Note,

	toCrdtDocument(note: LocalNote): CrdtDocumentResult<CrdtNoteDocument> {
		const crdtData = noteToCrdtDocument(note);
		const doc = createDocument(crdtData);
		const binary = saveDocument(doc);
		const documentId = createDocumentId(this.entityType, note.id);

		return { doc, binary, documentId };
	},

	fromBinary(binary: Uint8Array): Automerge.Doc<CrdtNoteDocument> {
		return loadDocument<CrdtNoteDocument>(binary);
	},

	merge(
		local: Automerge.Doc<CrdtNoteDocument>,
		remote: Automerge.Doc<CrdtNoteDocument>,
	): MergeResult<CrdtNoteDocument> {
		return mergeDocuments(local, remote);
	},

	toLocalEntity(
		doc: Automerge.Doc<CrdtNoteDocument>,
	): Omit<LocalNote, "_synced"> {
		return crdtDocumentToNote(doc);
	},

	createDocumentId(entityId: string): string {
		return createDocumentId(this.entityType, entityId);
	},
};

/**
 * CRDT Repository for NoteFieldValue entities
 */
export const crdtNoteFieldValueRepository: CrdtRepository<
	LocalNoteFieldValue,
	CrdtNoteFieldValueDocument
> = {
	entityType: CrdtEntityType.NoteFieldValue,

	toCrdtDocument(
		fieldValue: LocalNoteFieldValue,
	): CrdtDocumentResult<CrdtNoteFieldValueDocument> {
		const crdtData = noteFieldValueToCrdtDocument(fieldValue);
		const doc = createDocument(crdtData);
		const binary = saveDocument(doc);
		const documentId = createDocumentId(this.entityType, fieldValue.id);

		return { doc, binary, documentId };
	},

	fromBinary(binary: Uint8Array): Automerge.Doc<CrdtNoteFieldValueDocument> {
		return loadDocument<CrdtNoteFieldValueDocument>(binary);
	},

	merge(
		local: Automerge.Doc<CrdtNoteFieldValueDocument>,
		remote: Automerge.Doc<CrdtNoteFieldValueDocument>,
	): MergeResult<CrdtNoteFieldValueDocument> {
		return mergeDocuments(local, remote);
	},

	toLocalEntity(
		doc: Automerge.Doc<CrdtNoteFieldValueDocument>,
	): Omit<LocalNoteFieldValue, "_synced"> {
		return crdtDocumentToNoteFieldValue(doc);
	},

	createDocumentId(entityId: string): string {
		return createDocumentId(this.entityType, entityId);
	},
};

/**
 * CRDT Repository for Card entities
 */
export const crdtCardRepository: CrdtRepository<LocalCard, CrdtCardDocument> = {
	entityType: CrdtEntityType.Card,

	toCrdtDocument(card: LocalCard): CrdtDocumentResult<CrdtCardDocument> {
		const crdtData = cardToCrdtDocument(card);
		const doc = createDocument(crdtData);
		const binary = saveDocument(doc);
		const documentId = createDocumentId(this.entityType, card.id);

		return { doc, binary, documentId };
	},

	fromBinary(binary: Uint8Array): Automerge.Doc<CrdtCardDocument> {
		return loadDocument<CrdtCardDocument>(binary);
	},

	merge(
		local: Automerge.Doc<CrdtCardDocument>,
		remote: Automerge.Doc<CrdtCardDocument>,
	): MergeResult<CrdtCardDocument> {
		return mergeDocuments(local, remote);
	},

	toLocalEntity(
		doc: Automerge.Doc<CrdtCardDocument>,
	): Omit<LocalCard, "_synced"> {
		return crdtDocumentToCard(doc);
	},

	createDocumentId(entityId: string): string {
		return createDocumentId(this.entityType, entityId);
	},
};

/**
 * CRDT Repository for ReviewLog entities
 */
export const crdtReviewLogRepository: CrdtRepository<
	LocalReviewLog,
	CrdtReviewLogDocument
> = {
	entityType: CrdtEntityType.ReviewLog,

	toCrdtDocument(
		reviewLog: LocalReviewLog,
	): CrdtDocumentResult<CrdtReviewLogDocument> {
		const crdtData = reviewLogToCrdtDocument(reviewLog);
		const doc = createDocument(crdtData);
		const binary = saveDocument(doc);
		const documentId = createDocumentId(this.entityType, reviewLog.id);

		return { doc, binary, documentId };
	},

	fromBinary(binary: Uint8Array): Automerge.Doc<CrdtReviewLogDocument> {
		return loadDocument<CrdtReviewLogDocument>(binary);
	},

	merge(
		local: Automerge.Doc<CrdtReviewLogDocument>,
		remote: Automerge.Doc<CrdtReviewLogDocument>,
	): MergeResult<CrdtReviewLogDocument> {
		return mergeDocuments(local, remote);
	},

	toLocalEntity(
		doc: Automerge.Doc<CrdtReviewLogDocument>,
	): Omit<LocalReviewLog, "_synced"> {
		return crdtDocumentToReviewLog(doc);
	},

	createDocumentId(entityId: string): string {
		return createDocumentId(this.entityType, entityId);
	},
};

/**
 * Map of entity types to their CRDT repositories
 */
export const crdtRepositories = {
	[CrdtEntityType.Deck]: crdtDeckRepository,
	[CrdtEntityType.NoteType]: crdtNoteTypeRepository,
	[CrdtEntityType.NoteFieldType]: crdtNoteFieldTypeRepository,
	[CrdtEntityType.Note]: crdtNoteRepository,
	[CrdtEntityType.NoteFieldValue]: crdtNoteFieldValueRepository,
	[CrdtEntityType.Card]: crdtCardRepository,
	[CrdtEntityType.ReviewLog]: crdtReviewLogRepository,
} as const;

/**
 * Get the CRDT repository for an entity type
 */
export function getCrdtRepository<T extends CrdtEntityTypeValue>(
	entityType: T,
): (typeof crdtRepositories)[T] {
	return crdtRepositories[entityType];
}

/**
 * Helper to convert multiple entities to CRDT documents
 */
export function entitiesToCrdtDocuments<TLocal, TCrdt>(
	entities: TLocal[],
	repository: CrdtRepository<TLocal, TCrdt>,
): CrdtDocumentResult<TCrdt>[] {
	return entities.map((entity) => repository.toCrdtDocument(entity));
}

/**
 * Helper to merge and convert a remote document with a local document
 */
export function mergeAndConvert<TLocal, TCrdt>(
	localBinary: Uint8Array | null,
	remoteBinary: Uint8Array,
	repository: CrdtRepository<TLocal, TCrdt>,
): {
	entity: Omit<TLocal, "_synced">;
	binary: Uint8Array;
	hasChanges: boolean;
} {
	const remoteDoc = repository.fromBinary(remoteBinary);

	if (localBinary === null) {
		// No local document, use remote as-is
		return {
			entity: repository.toLocalEntity(remoteDoc),
			binary: remoteBinary,
			hasChanges: true,
		};
	}

	const localDoc = repository.fromBinary(localBinary);
	const mergeResult = repository.merge(localDoc, remoteDoc);

	return {
		entity: repository.toLocalEntity(mergeResult.merged),
		binary: mergeResult.binary,
		hasChanges: mergeResult.hasChanges,
	};
}

/**
 * Parse a document ID and get the corresponding repository
 */
export function getRepositoryForDocumentId(documentId: string): {
	repository: CrdtRepository<unknown, unknown>;
	entityId: string;
} | null {
	const parsed = parseDocumentId(documentId);
	if (!parsed) {
		return null;
	}

	const repository = getCrdtRepository(parsed.entityType);
	return {
		repository: repository as CrdtRepository<unknown, unknown>,
		entityId: parsed.entityId,
	};
}
