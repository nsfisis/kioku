/**
 * CRDT Module
 *
 * This module provides Automerge CRDT-based sync functionality for Kioku.
 * It enables conflict-free synchronization of data between clients and server.
 */

// Document lifecycle management
export {
	// Core document operations
	applyChanges,
	// Entity to/from CRDT document conversions
	cardToCrdtDocument,
	crdtDocumentToCard,
	crdtDocumentToDeck,
	crdtDocumentToNote,
	crdtDocumentToNoteFieldType,
	crdtDocumentToNoteFieldValue,
	crdtDocumentToNoteType,
	crdtDocumentToReviewLog,
	createDocument,
	// Generic entity conversion
	createDocumentFromEntity,
	createEmptyDocument,
	// Types
	type DocumentChange,
	type DocumentSnapshot,
	deckToCrdtDocument,
	// Actor ID management
	getActorId,
	getChanges,
	// Conflict detection and utilities
	getLastModified,
	hasConflicts,
	initDocumentWithActor,
	isDeleted,
	loadDocument,
	loadIncremental,
	type MergeResult,
	mergeDocuments,
	noteFieldTypeToCrdtDocument,
	noteFieldValueToCrdtDocument,
	noteToCrdtDocument,
	noteTypeToCrdtDocument,
	reviewLogToCrdtDocument,
	saveDocument,
	saveIncremental,
	updateDocument,
} from "./document-manager";
// Migration utilities
export {
	clearAllCrdtState,
	getMigrationStatus,
	isMigrationCompleted,
	MIGRATION_VERSION,
	type MigrationProgress,
	type MigrationResult,
	resetMigration,
	runMigration,
	runMigrationWithBatching,
} from "./migration";
// CRDT-aware repository wrappers
export {
	type CrdtDocumentResult,
	type CrdtMergeResult,
	type CrdtRepository,
	crdtCardRepository,
	crdtDeckRepository,
	crdtNoteFieldTypeRepository,
	crdtNoteFieldValueRepository,
	crdtNoteRepository,
	crdtNoteTypeRepository,
	crdtRepositories,
	crdtReviewLogRepository,
	entitiesToCrdtDocuments,
	getCrdtRepository,
	getRepositoryForDocumentId,
	mergeAndConvert,
} from "./repositories";
// Sync state management
export {
	base64ToBinary,
	binaryToBase64,
	type CrdtSyncMetadata,
	type CrdtSyncPayload,
	type CrdtSyncStateEntry,
	CrdtSyncStateManager,
	crdtSyncDb,
	crdtSyncStateManager,
	entriesToSyncPayload,
	syncPayloadToEntries,
} from "./sync-state";
// Type definitions
export {
	type CrdtCardDocument,
	type CrdtDeckDocument,
	type CrdtDocument,
	type CrdtDocumentMap,
	CrdtEntityType,
	type CrdtEntityTypeValue,
	type CrdtMetadata,
	type CrdtNoteDocument,
	type CrdtNoteFieldTypeDocument,
	type CrdtNoteFieldValueDocument,
	type CrdtNoteTypeDocument,
	type CrdtReviewLogDocument,
	createCrdtMetadata,
	createDeletedCrdtMetadata,
	createDocumentId,
	type DocumentId,
	parseDocumentId,
} from "./types";
