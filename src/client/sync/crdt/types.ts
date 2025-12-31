/**
 * Automerge CRDT Document Type Definitions
 *
 * This module defines Automerge document types for CRDT-based sync.
 * Each entity type has a corresponding Automerge document type that wraps
 * the entity data in an LWW (Last-Write-Wins) Register pattern.
 *
 * Design decisions:
 * - LWW Register for text fields: Simple and predictable conflict resolution
 * - Each entity is stored as a separate Automerge document
 * - Documents are keyed by entity ID
 */

import type { CardStateType, FieldTypeType, RatingType } from "../../db/index";

/**
 * Base CRDT metadata for all documents
 * Used for tracking document state and sync information
 */
export interface CrdtMetadata {
	/** Entity ID (same as the entity's primary key) */
	entityId: string;
	/** Timestamp of last local modification */
	lastModified: number;
	/** Whether the entity has been soft-deleted */
	deleted: boolean;
}

/**
 * CRDT document type for Deck entities
 * Wraps deck data in an Automerge-compatible structure
 */
export interface CrdtDeckDocument {
	meta: CrdtMetadata;
	data: {
		userId: string;
		name: string;
		description: string | null;
		newCardsPerDay: number;
		createdAt: number; // Unix timestamp in ms
		deletedAt: number | null;
	};
}

/**
 * CRDT document type for NoteType entities
 * Wraps note type data in an Automerge-compatible structure
 */
export interface CrdtNoteTypeDocument {
	meta: CrdtMetadata;
	data: {
		userId: string;
		name: string;
		frontTemplate: string;
		backTemplate: string;
		isReversible: boolean;
		createdAt: number;
		deletedAt: number | null;
	};
}

/**
 * CRDT document type for NoteFieldType entities
 * Wraps note field type data in an Automerge-compatible structure
 */
export interface CrdtNoteFieldTypeDocument {
	meta: CrdtMetadata;
	data: {
		noteTypeId: string;
		name: string;
		order: number;
		fieldType: FieldTypeType;
		createdAt: number;
		deletedAt: number | null;
	};
}

/**
 * CRDT document type for Note entities
 * Wraps note data in an Automerge-compatible structure
 */
export interface CrdtNoteDocument {
	meta: CrdtMetadata;
	data: {
		deckId: string;
		noteTypeId: string;
		createdAt: number;
		deletedAt: number | null;
	};
}

/**
 * CRDT document type for NoteFieldValue entities
 * Wraps note field value data in an Automerge-compatible structure
 */
export interface CrdtNoteFieldValueDocument {
	meta: CrdtMetadata;
	data: {
		noteId: string;
		noteFieldTypeId: string;
		value: string;
		createdAt: number;
	};
}

/**
 * CRDT document type for Card entities
 * Wraps card data including FSRS scheduling state
 */
export interface CrdtCardDocument {
	meta: CrdtMetadata;
	data: {
		deckId: string;
		noteId: string;
		isReversed: boolean;
		front: string;
		back: string;

		// FSRS fields
		state: CardStateType;
		due: number; // Unix timestamp in ms
		stability: number;
		difficulty: number;
		elapsedDays: number;
		scheduledDays: number;
		reps: number;
		lapses: number;
		lastReview: number | null;

		createdAt: number;
		deletedAt: number | null;
	};
}

/**
 * CRDT document type for ReviewLog entities
 * ReviewLogs are append-only (no conflicts), but we use CRDT for consistency
 */
export interface CrdtReviewLogDocument {
	meta: CrdtMetadata;
	data: {
		cardId: string;
		userId: string;
		rating: RatingType;
		state: CardStateType;
		scheduledDays: number;
		elapsedDays: number;
		reviewedAt: number;
		durationMs: number | null;
	};
}

/**
 * Union type of all CRDT document types
 */
export type CrdtDocument =
	| CrdtDeckDocument
	| CrdtNoteTypeDocument
	| CrdtNoteFieldTypeDocument
	| CrdtNoteDocument
	| CrdtNoteFieldValueDocument
	| CrdtCardDocument
	| CrdtReviewLogDocument;

/**
 * Entity type identifiers for CRDT documents
 */
export const CrdtEntityType = {
	Deck: "deck",
	NoteType: "noteType",
	NoteFieldType: "noteFieldType",
	Note: "note",
	NoteFieldValue: "noteFieldValue",
	Card: "card",
	ReviewLog: "reviewLog",
} as const;

export type CrdtEntityTypeValue =
	(typeof CrdtEntityType)[keyof typeof CrdtEntityType];

/**
 * Map entity types to their CRDT document types
 */
export interface CrdtDocumentMap {
	deck: CrdtDeckDocument;
	noteType: CrdtNoteTypeDocument;
	noteFieldType: CrdtNoteFieldTypeDocument;
	note: CrdtNoteDocument;
	noteFieldValue: CrdtNoteFieldValueDocument;
	card: CrdtCardDocument;
	reviewLog: CrdtReviewLogDocument;
}

/**
 * Document ID format for Automerge documents
 * Format: `{entityType}:{entityId}`
 */
export interface DocumentId {
	entityType: CrdtEntityTypeValue;
	entityId: string;
}

/**
 * Create a document ID string from entity type and ID
 */
export function createDocumentId(
	entityType: CrdtEntityTypeValue,
	entityId: string,
): string {
	return `${entityType}:${entityId}`;
}

/**
 * Parse a document ID string into entity type and ID
 */
export function parseDocumentId(documentId: string): DocumentId | null {
	const [entityType, entityId] = documentId.split(":");
	if (!entityType || !entityId) {
		return null;
	}

	const validTypes = Object.values(CrdtEntityType);
	if (!validTypes.includes(entityType as CrdtEntityTypeValue)) {
		return null;
	}

	return {
		entityType: entityType as CrdtEntityTypeValue,
		entityId,
	};
}

/**
 * Create CRDT metadata for a new document
 */
export function createCrdtMetadata(entityId: string): CrdtMetadata {
	return {
		entityId,
		lastModified: Date.now(),
		deleted: false,
	};
}

/**
 * Create CRDT metadata for a deleted document
 */
export function createDeletedCrdtMetadata(entityId: string): CrdtMetadata {
	return {
		entityId,
		lastModified: Date.now(),
		deleted: true,
	};
}
