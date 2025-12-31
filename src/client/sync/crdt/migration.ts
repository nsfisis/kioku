/**
 * CRDT Migration Script
 *
 * One-time migration script to convert existing local entities to CRDT documents.
 * This migrates data from the legacy LWW (Last-Write-Wins) sync system to the
 * new Automerge CRDT-based sync system.
 *
 * Migration process:
 * 1. Check if migration has already been completed
 * 2. Read all entities from local IndexedDB
 * 3. Convert each entity to an Automerge CRDT document
 * 4. Store the CRDT binary in the sync state database
 * 5. Mark migration as complete
 *
 * The migration is idempotent - running it multiple times has no effect
 * after the first successful run.
 */

import { db } from "../../db/index";
import {
	crdtCardRepository,
	crdtDeckRepository,
	crdtNoteFieldTypeRepository,
	crdtNoteFieldValueRepository,
	crdtNoteRepository,
	crdtNoteTypeRepository,
	crdtReviewLogRepository,
} from "./repositories";
import { crdtSyncDb, crdtSyncStateManager } from "./sync-state";
import { CrdtEntityType } from "./types";

/**
 * Migration status stored in IndexedDB
 */
interface MigrationStatus {
	/** Migration version */
	version: number;
	/** Timestamp when migration was completed */
	completedAt: number;
	/** Entity counts migrated */
	counts: {
		decks: number;
		noteTypes: number;
		noteFieldTypes: number;
		notes: number;
		noteFieldValues: number;
		cards: number;
		reviewLogs: number;
	};
}

/**
 * Current migration version
 * Increment this when making breaking changes to the migration logic
 */
export const MIGRATION_VERSION = 1;

/**
 * Key used to store migration status in metadata
 */
const MIGRATION_STATUS_KEY = "crdt-migration-status";

/**
 * Result of running the migration
 */
export interface MigrationResult {
	/** Whether the migration was run (false if already completed) */
	wasRun: boolean;
	/** Migration status after completion */
	status: MigrationStatus | null;
	/** Error if migration failed */
	error?: Error;
}

/**
 * Check if migration has already been completed
 */
export async function isMigrationCompleted(): Promise<boolean> {
	const status = await getMigrationStatus();
	return status !== null && status.version >= MIGRATION_VERSION;
}

/**
 * Get the current migration status
 */
export async function getMigrationStatus(): Promise<MigrationStatus | null> {
	const entry = await crdtSyncDb.metadata.get(MIGRATION_STATUS_KEY);
	if (!entry) {
		return null;
	}

	// Parse the status from the metadata entry
	// We store it as a JSON string in the actorId field for simplicity
	try {
		return JSON.parse(entry.actorId) as MigrationStatus;
	} catch {
		return null;
	}
}

/**
 * Save the migration status
 */
async function saveMigrationStatus(status: MigrationStatus): Promise<void> {
	await crdtSyncDb.metadata.put({
		key: MIGRATION_STATUS_KEY,
		lastSyncAt: status.completedAt,
		syncVersionWatermark: status.version,
		actorId: JSON.stringify(status),
	});
}

/**
 * Run the CRDT migration
 *
 * Converts all existing local entities to CRDT documents and stores them
 * in the CRDT sync state database.
 *
 * @returns Migration result indicating whether migration was run and the status
 */
export async function runMigration(): Promise<MigrationResult> {
	// Check if migration is already completed
	if (await isMigrationCompleted()) {
		const status = await getMigrationStatus();
		return { wasRun: false, status };
	}

	try {
		const counts = {
			decks: 0,
			noteTypes: 0,
			noteFieldTypes: 0,
			notes: 0,
			noteFieldValues: 0,
			cards: 0,
			reviewLogs: 0,
		};

		// Migrate Decks
		const decks = await db.decks.toArray();
		for (const deck of decks) {
			const { binary } = crdtDeckRepository.toCrdtDocument(deck);
			await crdtSyncStateManager.setDocumentBinary(
				CrdtEntityType.Deck,
				deck.id,
				binary,
				deck.syncVersion,
			);
			counts.decks++;
		}

		// Migrate NoteTypes
		const noteTypes = await db.noteTypes.toArray();
		for (const noteType of noteTypes) {
			const { binary } = crdtNoteTypeRepository.toCrdtDocument(noteType);
			await crdtSyncStateManager.setDocumentBinary(
				CrdtEntityType.NoteType,
				noteType.id,
				binary,
				noteType.syncVersion,
			);
			counts.noteTypes++;
		}

		// Migrate NoteFieldTypes
		const noteFieldTypes = await db.noteFieldTypes.toArray();
		for (const noteFieldType of noteFieldTypes) {
			const { binary } =
				crdtNoteFieldTypeRepository.toCrdtDocument(noteFieldType);
			await crdtSyncStateManager.setDocumentBinary(
				CrdtEntityType.NoteFieldType,
				noteFieldType.id,
				binary,
				noteFieldType.syncVersion,
			);
			counts.noteFieldTypes++;
		}

		// Migrate Notes
		const notes = await db.notes.toArray();
		for (const note of notes) {
			const { binary } = crdtNoteRepository.toCrdtDocument(note);
			await crdtSyncStateManager.setDocumentBinary(
				CrdtEntityType.Note,
				note.id,
				binary,
				note.syncVersion,
			);
			counts.notes++;
		}

		// Migrate NoteFieldValues
		const noteFieldValues = await db.noteFieldValues.toArray();
		for (const noteFieldValue of noteFieldValues) {
			const { binary } =
				crdtNoteFieldValueRepository.toCrdtDocument(noteFieldValue);
			await crdtSyncStateManager.setDocumentBinary(
				CrdtEntityType.NoteFieldValue,
				noteFieldValue.id,
				binary,
				noteFieldValue.syncVersion,
			);
			counts.noteFieldValues++;
		}

		// Migrate Cards
		const cards = await db.cards.toArray();
		for (const card of cards) {
			const { binary } = crdtCardRepository.toCrdtDocument(card);
			await crdtSyncStateManager.setDocumentBinary(
				CrdtEntityType.Card,
				card.id,
				binary,
				card.syncVersion,
			);
			counts.cards++;
		}

		// Migrate ReviewLogs
		const reviewLogs = await db.reviewLogs.toArray();
		for (const reviewLog of reviewLogs) {
			const { binary } = crdtReviewLogRepository.toCrdtDocument(reviewLog);
			await crdtSyncStateManager.setDocumentBinary(
				CrdtEntityType.ReviewLog,
				reviewLog.id,
				binary,
				reviewLog.syncVersion,
			);
			counts.reviewLogs++;
		}

		// Save migration status
		const status: MigrationStatus = {
			version: MIGRATION_VERSION,
			completedAt: Date.now(),
			counts,
		};
		await saveMigrationStatus(status);

		return { wasRun: true, status };
	} catch (error) {
		return {
			wasRun: true,
			status: null,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Run migration with batching for better performance with large datasets
 *
 * This version processes entities in batches to avoid memory issues
 * and provide progress feedback for large migrations.
 *
 * @param batchSize Number of entities to process per batch
 * @param onProgress Optional callback for progress updates
 * @returns Migration result
 */
export async function runMigrationWithBatching(
	batchSize = 100,
	onProgress?: (progress: MigrationProgress) => void,
): Promise<MigrationResult> {
	// Check if migration is already completed
	if (await isMigrationCompleted()) {
		const status = await getMigrationStatus();
		return { wasRun: false, status };
	}

	try {
		const counts = {
			decks: 0,
			noteTypes: 0,
			noteFieldTypes: 0,
			notes: 0,
			noteFieldValues: 0,
			cards: 0,
			reviewLogs: 0,
		};

		// Get total counts for progress reporting
		const totalCounts = {
			decks: await db.decks.count(),
			noteTypes: await db.noteTypes.count(),
			noteFieldTypes: await db.noteFieldTypes.count(),
			notes: await db.notes.count(),
			noteFieldValues: await db.noteFieldValues.count(),
			cards: await db.cards.count(),
			reviewLogs: await db.reviewLogs.count(),
		};

		const totalEntities = Object.values(totalCounts).reduce(
			(sum, count) => sum + count,
			0,
		);
		let processedEntities = 0;

		// Helper to report progress
		const reportProgress = (entityType: string, current: number) => {
			processedEntities++;
			if (onProgress) {
				onProgress({
					entityType,
					current,
					total: totalEntities,
					processed: processedEntities,
					percentage: Math.round((processedEntities / totalEntities) * 100),
				});
			}
		};

		// Migrate Decks in batches
		counts.decks = await migrateEntityType(
			db.decks,
			crdtDeckRepository,
			CrdtEntityType.Deck,
			batchSize,
			() => reportProgress("deck", counts.decks + 1),
		);

		// Migrate NoteTypes in batches
		counts.noteTypes = await migrateEntityType(
			db.noteTypes,
			crdtNoteTypeRepository,
			CrdtEntityType.NoteType,
			batchSize,
			() => reportProgress("noteType", counts.noteTypes + 1),
		);

		// Migrate NoteFieldTypes in batches
		counts.noteFieldTypes = await migrateEntityType(
			db.noteFieldTypes,
			crdtNoteFieldTypeRepository,
			CrdtEntityType.NoteFieldType,
			batchSize,
			() => reportProgress("noteFieldType", counts.noteFieldTypes + 1),
		);

		// Migrate Notes in batches
		counts.notes = await migrateEntityType(
			db.notes,
			crdtNoteRepository,
			CrdtEntityType.Note,
			batchSize,
			() => reportProgress("note", counts.notes + 1),
		);

		// Migrate NoteFieldValues in batches
		counts.noteFieldValues = await migrateEntityType(
			db.noteFieldValues,
			crdtNoteFieldValueRepository,
			CrdtEntityType.NoteFieldValue,
			batchSize,
			() => reportProgress("noteFieldValue", counts.noteFieldValues + 1),
		);

		// Migrate Cards in batches
		counts.cards = await migrateEntityType(
			db.cards,
			crdtCardRepository,
			CrdtEntityType.Card,
			batchSize,
			() => reportProgress("card", counts.cards + 1),
		);

		// Migrate ReviewLogs in batches
		counts.reviewLogs = await migrateEntityType(
			db.reviewLogs,
			crdtReviewLogRepository,
			CrdtEntityType.ReviewLog,
			batchSize,
			() => reportProgress("reviewLog", counts.reviewLogs + 1),
		);

		// Save migration status
		const status: MigrationStatus = {
			version: MIGRATION_VERSION,
			completedAt: Date.now(),
			counts,
		};
		await saveMigrationStatus(status);

		return { wasRun: true, status };
	} catch (error) {
		return {
			wasRun: true,
			status: null,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Progress information for batch migration
 */
export interface MigrationProgress {
	/** Current entity type being migrated */
	entityType: string;
	/** Current entity number within type */
	current: number;
	/** Total entities across all types */
	total: number;
	/** Total entities processed so far */
	processed: number;
	/** Percentage complete (0-100) */
	percentage: number;
}

/**
 * Interface representing a table with offset/limit capabilities
 * Used for batch processing of entities
 */
interface BatchableTable<T> {
	offset(n: number): { limit(n: number): { toArray(): Promise<T[]> } };
}

/**
 * Helper to migrate entities of a specific type in batches
 */
async function migrateEntityType<T extends { id: string; syncVersion: number }>(
	table: BatchableTable<T>,
	repository: { toCrdtDocument: (entity: T) => { binary: Uint8Array } },
	entityType: string,
	batchSize: number,
	onEntity?: () => void,
): Promise<number> {
	let count = 0;
	let offset = 0;

	for (;;) {
		const batch = await table.offset(offset).limit(batchSize).toArray();
		if (batch.length === 0) {
			break;
		}

		// Prepare batch entries for bulk insert
		const entries = batch.map((entity) => {
			const { binary } = repository.toCrdtDocument(entity);
			return {
				entityType: entityType as import("./types").CrdtEntityTypeValue,
				entityId: entity.id,
				binary,
				syncVersion: entity.syncVersion,
			};
		});

		// Batch insert
		await crdtSyncStateManager.batchSetDocuments(entries);

		count += batch.length;
		offset += batchSize;

		// Call progress callback for each entity
		if (onEntity) {
			for (let i = 0; i < batch.length; i++) {
				onEntity();
			}
		}
	}

	return count;
}

/**
 * Reset migration status (for testing or retry purposes)
 *
 * WARNING: This should only be used for development/testing.
 * In production, resetting migration could lead to duplicate CRDT documents.
 */
export async function resetMigration(): Promise<void> {
	await crdtSyncDb.metadata.delete(MIGRATION_STATUS_KEY);
}

/**
 * Clear all CRDT sync state (for full reset)
 *
 * WARNING: This will delete all CRDT documents and require a full resync.
 * Only use this for development/testing or when explicitly requested by user.
 */
export async function clearAllCrdtState(): Promise<void> {
	await crdtSyncStateManager.clearAll();
}
