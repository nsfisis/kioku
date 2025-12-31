/**
 * CRDT Sync State Management
 *
 * This module handles the serialization and persistence of CRDT sync state.
 * It tracks which documents have been synced and stores the binary state
 * for incremental sync operations.
 *
 * Design:
 * - Sync state is stored in IndexedDB alongside entity data
 * - Each entity has a corresponding CRDT binary stored in sync state
 * - The state tracks sync vectors for efficient incremental updates
 */

import Dexie from "dexie";
import { type CrdtEntityTypeValue, createDocumentId } from "./types";

/**
 * Sync state entry for a single CRDT document
 */
export interface CrdtSyncStateEntry {
	/** Document ID in format entityType:entityId */
	documentId: string;
	/** Entity type */
	entityType: CrdtEntityTypeValue;
	/** Entity ID */
	entityId: string;
	/** Binary representation of the CRDT document */
	binary: Uint8Array;
	/** Last sync timestamp */
	lastSyncedAt: number;
	/** Sync version from server */
	syncVersion: number;
}

/**
 * Sync metadata for tracking overall sync state
 */
export interface CrdtSyncMetadata {
	/** Unique key for metadata storage */
	key: string;
	/** Last successful sync timestamp */
	lastSyncAt: number;
	/** Server sync version watermark */
	syncVersionWatermark: number;
	/** Actor ID for this client */
	actorId: string;
}

/**
 * Database for storing CRDT sync state
 * Separate from main app database to avoid migration conflicts
 */
class CrdtSyncDatabase extends Dexie {
	syncState!: Dexie.Table<CrdtSyncStateEntry, string>;
	metadata!: Dexie.Table<CrdtSyncMetadata, string>;

	constructor() {
		super("kioku-crdt-sync");

		this.version(1).stores({
			// Primary key is documentId, indexed by entityType and entityId
			syncState: "documentId, entityType, entityId, lastSyncedAt",
			// Simple key-value store for metadata
			metadata: "key",
		});
	}
}

/**
 * Singleton instance of the CRDT sync database
 */
export const crdtSyncDb = new CrdtSyncDatabase();

/**
 * CRDT Sync State Manager
 *
 * Provides operations for managing CRDT sync state:
 * - Store/retrieve CRDT document binaries
 * - Track sync progress
 * - Manage sync metadata
 */
export class CrdtSyncStateManager {
	private readonly metadataKey = "sync-metadata";

	/**
	 * Get the CRDT binary for an entity
	 */
	async getDocumentBinary(
		entityType: CrdtEntityTypeValue,
		entityId: string,
	): Promise<Uint8Array | null> {
		const documentId = createDocumentId(entityType, entityId);
		const entry = await crdtSyncDb.syncState.get(documentId);
		return entry?.binary ?? null;
	}

	/**
	 * Store the CRDT binary for an entity
	 */
	async setDocumentBinary(
		entityType: CrdtEntityTypeValue,
		entityId: string,
		binary: Uint8Array,
		syncVersion: number,
	): Promise<void> {
		const documentId = createDocumentId(entityType, entityId);
		const entry: CrdtSyncStateEntry = {
			documentId,
			entityType,
			entityId,
			binary,
			lastSyncedAt: Date.now(),
			syncVersion,
		};
		await crdtSyncDb.syncState.put(entry);
	}

	/**
	 * Get all CRDT binaries for an entity type
	 */
	async getDocumentsByType(
		entityType: CrdtEntityTypeValue,
	): Promise<CrdtSyncStateEntry[]> {
		return crdtSyncDb.syncState
			.where("entityType")
			.equals(entityType)
			.toArray();
	}

	/**
	 * Delete the CRDT binary for an entity
	 */
	async deleteDocument(
		entityType: CrdtEntityTypeValue,
		entityId: string,
	): Promise<void> {
		const documentId = createDocumentId(entityType, entityId);
		await crdtSyncDb.syncState.delete(documentId);
	}

	/**
	 * Delete all CRDT binaries for an entity type
	 */
	async deleteDocumentsByType(entityType: CrdtEntityTypeValue): Promise<void> {
		await crdtSyncDb.syncState.where("entityType").equals(entityType).delete();
	}

	/**
	 * Get sync metadata
	 */
	async getMetadata(): Promise<CrdtSyncMetadata | null> {
		const metadata = await crdtSyncDb.metadata.get(this.metadataKey);
		return metadata ?? null;
	}

	/**
	 * Update sync metadata
	 */
	async setMetadata(
		updates: Partial<Omit<CrdtSyncMetadata, "key">>,
	): Promise<void> {
		const existing = await this.getMetadata();
		const metadata: CrdtSyncMetadata = {
			key: this.metadataKey,
			lastSyncAt: updates.lastSyncAt ?? existing?.lastSyncAt ?? 0,
			syncVersionWatermark:
				updates.syncVersionWatermark ?? existing?.syncVersionWatermark ?? 0,
			actorId: updates.actorId ?? existing?.actorId ?? "",
		};
		await crdtSyncDb.metadata.put(metadata);
	}

	/**
	 * Get the last sync timestamp
	 */
	async getLastSyncAt(): Promise<number> {
		const metadata = await this.getMetadata();
		return metadata?.lastSyncAt ?? 0;
	}

	/**
	 * Update the last sync timestamp
	 */
	async setLastSyncAt(timestamp: number): Promise<void> {
		await this.setMetadata({ lastSyncAt: timestamp });
	}

	/**
	 * Get the sync version watermark
	 */
	async getSyncVersionWatermark(): Promise<number> {
		const metadata = await this.getMetadata();
		return metadata?.syncVersionWatermark ?? 0;
	}

	/**
	 * Update the sync version watermark
	 */
	async setSyncVersionWatermark(version: number): Promise<void> {
		await this.setMetadata({ syncVersionWatermark: version });
	}

	/**
	 * Clear all sync state (for full resync)
	 */
	async clearAll(): Promise<void> {
		await crdtSyncDb.syncState.clear();
		await crdtSyncDb.metadata.clear();
	}

	/**
	 * Get count of stored documents by type
	 */
	async getDocumentCountByType(
		entityType: CrdtEntityTypeValue,
	): Promise<number> {
		return crdtSyncDb.syncState.where("entityType").equals(entityType).count();
	}

	/**
	 * Get total count of stored documents
	 */
	async getTotalDocumentCount(): Promise<number> {
		return crdtSyncDb.syncState.count();
	}

	/**
	 * Check if a document exists in sync state
	 */
	async hasDocument(
		entityType: CrdtEntityTypeValue,
		entityId: string,
	): Promise<boolean> {
		const documentId = createDocumentId(entityType, entityId);
		const count = await crdtSyncDb.syncState
			.where("documentId")
			.equals(documentId)
			.count();
		return count > 0;
	}

	/**
	 * Get documents that have been synced since a given timestamp
	 */
	async getDocumentsSyncedSince(
		timestamp: number,
	): Promise<CrdtSyncStateEntry[]> {
		return crdtSyncDb.syncState
			.where("lastSyncedAt")
			.above(timestamp)
			.toArray();
	}

	/**
	 * Batch update multiple documents
	 */
	async batchSetDocuments(
		entries: Array<{
			entityType: CrdtEntityTypeValue;
			entityId: string;
			binary: Uint8Array;
			syncVersion: number;
		}>,
	): Promise<void> {
		const now = Date.now();
		const syncEntries: CrdtSyncStateEntry[] = entries.map((entry) => ({
			documentId: createDocumentId(entry.entityType, entry.entityId),
			entityType: entry.entityType,
			entityId: entry.entityId,
			binary: entry.binary,
			lastSyncedAt: now,
			syncVersion: entry.syncVersion,
		}));

		await crdtSyncDb.syncState.bulkPut(syncEntries);
	}

	/**
	 * Batch delete multiple documents
	 */
	async batchDeleteDocuments(
		entries: Array<{
			entityType: CrdtEntityTypeValue;
			entityId: string;
		}>,
	): Promise<void> {
		const documentIds = entries.map((entry) =>
			createDocumentId(entry.entityType, entry.entityId),
		);
		await crdtSyncDb.syncState.bulkDelete(documentIds);
	}
}

/**
 * Singleton instance of the sync state manager
 */
export const crdtSyncStateManager = new CrdtSyncStateManager();

/**
 * Serialize CRDT binary to base64 for network transport
 */
export function binaryToBase64(binary: Uint8Array): string {
	// Use standard base64 encoding
	const bytes = new Uint8Array(binary);
	let binaryStr = "";
	for (const byte of bytes) {
		binaryStr += String.fromCharCode(byte);
	}
	return btoa(binaryStr);
}

/**
 * Deserialize base64 string to CRDT binary
 */
export function base64ToBinary(base64: string): Uint8Array {
	const binaryStr = atob(base64);
	const bytes = new Uint8Array(binaryStr.length);
	for (let i = 0; i < binaryStr.length; i++) {
		bytes[i] = binaryStr.charCodeAt(i);
	}
	return bytes;
}

/**
 * CRDT changes payload for sync API
 */
export interface CrdtSyncPayload {
	/** Document ID */
	documentId: string;
	/** Entity type */
	entityType: CrdtEntityTypeValue;
	/** Entity ID */
	entityId: string;
	/** Base64-encoded CRDT binary */
	binary: string;
}

/**
 * Convert sync state entries to sync payload format
 */
export function entriesToSyncPayload(
	entries: CrdtSyncStateEntry[],
): CrdtSyncPayload[] {
	return entries.map((entry) => ({
		documentId: entry.documentId,
		entityType: entry.entityType,
		entityId: entry.entityId,
		binary: binaryToBase64(entry.binary),
	}));
}

/**
 * Convert sync payload to sync state entries
 */
export function syncPayloadToEntries(
	payloads: CrdtSyncPayload[],
	syncVersion: number,
): Array<{
	entityType: CrdtEntityTypeValue;
	entityId: string;
	binary: Uint8Array;
	syncVersion: number;
}> {
	return payloads.map((payload) => ({
		entityType: payload.entityType,
		entityId: payload.entityId,
		binary: base64ToBinary(payload.binary),
		syncVersion,
	}));
}
