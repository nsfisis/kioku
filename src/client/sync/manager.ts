import type { ConflictResolver } from "./conflict";
import {
	CrdtEntityType,
	type CrdtSyncStateManager,
	crdtCardRepository,
	crdtDeckRepository,
	crdtNoteFieldTypeRepository,
	crdtNoteFieldValueRepository,
	crdtNoteRepository,
	crdtNoteTypeRepository,
	crdtReviewLogRepository,
	crdtSyncStateManager as defaultCrdtSyncStateManager,
} from "./crdt";
import type { PullService, SyncPullResult } from "./pull";
import type { PushService, SyncPushResult } from "./push";
import type { PendingChanges, SyncQueue, SyncQueueState } from "./queue";

/**
 * Sync result from a full sync operation
 */
export interface SyncResult {
	success: boolean;
	pushResult: SyncPushResult | null;
	pullResult: SyncPullResult | null;
	conflictsResolved: number;
	/** Number of CRDT documents stored during sync */
	crdtDocumentsStored: number;
	error?: string;
}

/**
 * Options for creating a sync manager
 */
export interface SyncManagerOptions {
	syncQueue: SyncQueue;
	pushService: PushService;
	pullService: PullService;
	conflictResolver: ConflictResolver;
	/**
	 * CRDT sync state manager for storing CRDT document binaries
	 * Default: singleton crdtSyncStateManager
	 */
	crdtSyncStateManager?: CrdtSyncStateManager;
	/**
	 * Debounce time in ms before syncing after coming online
	 * Default: 1000ms
	 */
	debounceMs?: number;
	/**
	 * Whether to auto-sync when coming online
	 * Default: true
	 */
	autoSync?: boolean;
}

/**
 * Listener for sync manager events
 */
export type SyncManagerListener = (event: SyncManagerEvent) => void;

export type SyncManagerEvent =
	| { type: "online" }
	| { type: "offline" }
	| { type: "sync_start" }
	| { type: "sync_complete"; result: SyncResult }
	| { type: "sync_error"; error: string }
	| { type: "crdt_documents_stored"; count: number };

/**
 * Sync Manager
 *
 * Orchestrates the sync process and handles auto-sync on reconnect:
 * 1. Monitors online/offline status
 * 2. Triggers sync when coming back online
 * 3. Coordinates push, pull, and conflict resolution
 * 4. Manages sync state and notifies listeners
 * 5. Stores CRDT document binaries for conflict-free sync
 */
export class SyncManager {
	private syncQueue: SyncQueue;
	private pushService: PushService;
	private pullService: PullService;
	private conflictResolver: ConflictResolver;
	private crdtSyncStateManager: CrdtSyncStateManager;
	private debounceMs: number;
	private autoSync: boolean;
	private listeners: Set<SyncManagerListener> = new Set();
	private isOnline: boolean;
	private syncInProgress = false;
	private pendingSyncTimeout: ReturnType<typeof setTimeout> | null = null;
	private boundOnlineHandler: () => void;
	private boundOfflineHandler: () => void;
	private started = false;

	constructor(options: SyncManagerOptions) {
		this.syncQueue = options.syncQueue;
		this.pushService = options.pushService;
		this.pullService = options.pullService;
		this.conflictResolver = options.conflictResolver;
		this.crdtSyncStateManager =
			options.crdtSyncStateManager ?? defaultCrdtSyncStateManager;
		this.debounceMs = options.debounceMs ?? 1000;
		this.autoSync = options.autoSync ?? true;
		this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

		// Bind handlers for proper removal later
		this.boundOnlineHandler = this.handleOnline.bind(this);
		this.boundOfflineHandler = this.handleOffline.bind(this);
	}

	/**
	 * Start monitoring network status and auto-syncing
	 */
	start(): void {
		if (this.started) return;
		this.started = true;

		if (typeof window !== "undefined") {
			window.addEventListener("online", this.boundOnlineHandler);
			window.addEventListener("offline", this.boundOfflineHandler);
		}
	}

	/**
	 * Stop monitoring and cleanup
	 */
	stop(): void {
		if (!this.started) return;
		this.started = false;

		if (typeof window !== "undefined") {
			window.removeEventListener("online", this.boundOnlineHandler);
			window.removeEventListener("offline", this.boundOfflineHandler);
		}

		if (this.pendingSyncTimeout) {
			clearTimeout(this.pendingSyncTimeout);
			this.pendingSyncTimeout = null;
		}
	}

	/**
	 * Subscribe to sync manager events
	 */
	subscribe(listener: SyncManagerListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Notify all listeners of an event
	 */
	private notifyListeners(event: SyncManagerEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	/**
	 * Handle online event
	 */
	private handleOnline(): void {
		this.isOnline = true;
		this.notifyListeners({ type: "online" });

		if (this.autoSync) {
			this.scheduleSyncWithDebounce();
		}
	}

	/**
	 * Handle offline event
	 */
	private handleOffline(): void {
		this.isOnline = false;
		this.notifyListeners({ type: "offline" });

		// Cancel pending sync if going offline
		if (this.pendingSyncTimeout) {
			clearTimeout(this.pendingSyncTimeout);
			this.pendingSyncTimeout = null;
		}
	}

	/**
	 * Schedule sync with debounce to avoid rapid syncs
	 */
	private scheduleSyncWithDebounce(): void {
		if (this.pendingSyncTimeout) {
			clearTimeout(this.pendingSyncTimeout);
		}

		this.pendingSyncTimeout = setTimeout(async () => {
			this.pendingSyncTimeout = null;
			await this.sync();
		}, this.debounceMs);
	}

	/**
	 * Check if currently online
	 */
	getOnlineStatus(): boolean {
		return this.isOnline;
	}

	/**
	 * Check if sync is in progress
	 */
	isSyncing(): boolean {
		return this.syncInProgress;
	}

	/**
	 * Get current sync queue state
	 */
	async getState(): Promise<SyncQueueState> {
		return this.syncQueue.getState();
	}

	/**
	 * Perform a full sync: push then pull
	 *
	 * @returns Sync result with push/pull results and any conflicts resolved
	 */
	async sync(): Promise<SyncResult> {
		// Don't sync if offline or already syncing
		if (!this.isOnline) {
			return {
				success: false,
				pushResult: null,
				pullResult: null,
				conflictsResolved: 0,
				crdtDocumentsStored: 0,
				error: "Offline",
			};
		}

		if (this.syncInProgress) {
			return {
				success: false,
				pushResult: null,
				pullResult: null,
				conflictsResolved: 0,
				crdtDocumentsStored: 0,
				error: "Sync already in progress",
			};
		}

		this.syncInProgress = true;
		this.notifyListeners({ type: "sync_start" });

		try {
			await this.syncQueue.startSync();

			// Get pending changes before push to store CRDT documents
			const pendingChanges = await this.syncQueue.getPendingChanges();

			// Step 1: Push local changes
			const pushResult = await this.pushService.push();

			// Step 2: Store CRDT documents for successfully pushed entities
			const crdtDocumentsStored = await this.storeCrdtDocumentsAfterPush(
				pendingChanges,
				pushResult,
			);

			if (crdtDocumentsStored > 0) {
				this.notifyListeners({
					type: "crdt_documents_stored",
					count: crdtDocumentsStored,
				});
			}

			// Step 3: Pull server changes
			const pullResult = await this.pullService.pull();

			// Step 4: Resolve any conflicts using CRDT merge
			let conflictsResolved = 0;
			if (this.conflictResolver.hasConflicts(pushResult)) {
				const resolution = await this.conflictResolver.resolveConflicts(
					pushResult,
					pullResult,
				);
				conflictsResolved =
					resolution.decks.length +
					resolution.cards.length +
					resolution.noteTypes.length +
					resolution.noteFieldTypes.length +
					resolution.notes.length +
					resolution.noteFieldValues.length;
			}

			// Step 5: Update CRDT sync metadata
			await this.crdtSyncStateManager.setMetadata({
				lastSyncAt: Date.now(),
				syncVersionWatermark: pullResult.currentSyncVersion,
			});

			const result: SyncResult = {
				success: true,
				pushResult,
				pullResult,
				conflictsResolved,
				crdtDocumentsStored,
			};

			this.notifyListeners({ type: "sync_complete", result });
			return result;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown sync error";
			await this.syncQueue.failSync(errorMessage);

			const result: SyncResult = {
				success: false,
				pushResult: null,
				pullResult: null,
				conflictsResolved: 0,
				crdtDocumentsStored: 0,
				error: errorMessage,
			};

			this.notifyListeners({ type: "sync_error", error: errorMessage });
			return result;
		} finally {
			this.syncInProgress = false;
		}
	}

	/**
	 * Store CRDT document binaries after successful push
	 * This ensures we have local CRDT state for future conflict resolution
	 */
	private async storeCrdtDocumentsAfterPush(
		pendingChanges: PendingChanges,
		pushResult: SyncPushResult,
	): Promise<number> {
		const entriesToStore: Array<{
			entityType: (typeof CrdtEntityType)[keyof typeof CrdtEntityType];
			entityId: string;
			binary: Uint8Array;
			syncVersion: number;
		}> = [];

		// Helper to find sync version from push result
		const findSyncVersion = (
			results: { id: string; syncVersion: number }[],
			id: string,
		): number | undefined => {
			return results.find((r) => r.id === id)?.syncVersion;
		};

		// Process pushed decks
		for (const deck of pendingChanges.decks) {
			const syncVersion = findSyncVersion(pushResult.decks, deck.id);
			if (syncVersion !== undefined) {
				const result = crdtDeckRepository.toCrdtDocument(deck);
				entriesToStore.push({
					entityType: CrdtEntityType.Deck,
					entityId: deck.id,
					binary: result.binary,
					syncVersion,
				});
			}
		}

		// Process pushed note types
		for (const noteType of pendingChanges.noteTypes) {
			const syncVersion = findSyncVersion(pushResult.noteTypes, noteType.id);
			if (syncVersion !== undefined) {
				const result = crdtNoteTypeRepository.toCrdtDocument(noteType);
				entriesToStore.push({
					entityType: CrdtEntityType.NoteType,
					entityId: noteType.id,
					binary: result.binary,
					syncVersion,
				});
			}
		}

		// Process pushed note field types
		for (const fieldType of pendingChanges.noteFieldTypes) {
			const syncVersion = findSyncVersion(
				pushResult.noteFieldTypes,
				fieldType.id,
			);
			if (syncVersion !== undefined) {
				const result = crdtNoteFieldTypeRepository.toCrdtDocument(fieldType);
				entriesToStore.push({
					entityType: CrdtEntityType.NoteFieldType,
					entityId: fieldType.id,
					binary: result.binary,
					syncVersion,
				});
			}
		}

		// Process pushed notes
		for (const note of pendingChanges.notes) {
			const syncVersion = findSyncVersion(pushResult.notes, note.id);
			if (syncVersion !== undefined) {
				const result = crdtNoteRepository.toCrdtDocument(note);
				entriesToStore.push({
					entityType: CrdtEntityType.Note,
					entityId: note.id,
					binary: result.binary,
					syncVersion,
				});
			}
		}

		// Process pushed note field values
		for (const fieldValue of pendingChanges.noteFieldValues) {
			const syncVersion = findSyncVersion(
				pushResult.noteFieldValues,
				fieldValue.id,
			);
			if (syncVersion !== undefined) {
				const result = crdtNoteFieldValueRepository.toCrdtDocument(fieldValue);
				entriesToStore.push({
					entityType: CrdtEntityType.NoteFieldValue,
					entityId: fieldValue.id,
					binary: result.binary,
					syncVersion,
				});
			}
		}

		// Process pushed cards
		for (const card of pendingChanges.cards) {
			const syncVersion = findSyncVersion(pushResult.cards, card.id);
			if (syncVersion !== undefined) {
				const result = crdtCardRepository.toCrdtDocument(card);
				entriesToStore.push({
					entityType: CrdtEntityType.Card,
					entityId: card.id,
					binary: result.binary,
					syncVersion,
				});
			}
		}

		// Process pushed review logs
		for (const reviewLog of pendingChanges.reviewLogs) {
			const syncVersion = findSyncVersion(pushResult.reviewLogs, reviewLog.id);
			if (syncVersion !== undefined) {
				const result = crdtReviewLogRepository.toCrdtDocument(reviewLog);
				entriesToStore.push({
					entityType: CrdtEntityType.ReviewLog,
					entityId: reviewLog.id,
					binary: result.binary,
					syncVersion,
				});
			}
		}

		// Batch store all entries
		if (entriesToStore.length > 0) {
			await this.crdtSyncStateManager.batchSetDocuments(entriesToStore);
		}

		return entriesToStore.length;
	}

	/**
	 * Force sync even if auto-sync is disabled
	 */
	async forceSync(): Promise<SyncResult> {
		return this.sync();
	}

	/**
	 * Enable or disable auto-sync
	 */
	setAutoSync(enabled: boolean): void {
		this.autoSync = enabled;
	}

	/**
	 * Check if auto-sync is enabled
	 */
	isAutoSyncEnabled(): boolean {
		return this.autoSync;
	}

	/**
	 * Get CRDT sync statistics
	 */
	async getCrdtSyncStats(): Promise<{
		totalDocuments: number;
		lastSyncAt: number;
		syncVersionWatermark: number;
	}> {
		const [totalDocuments, metadata] = await Promise.all([
			this.crdtSyncStateManager.getTotalDocumentCount(),
			this.crdtSyncStateManager.getMetadata(),
		]);

		return {
			totalDocuments,
			lastSyncAt: metadata?.lastSyncAt ?? 0,
			syncVersionWatermark: metadata?.syncVersionWatermark ?? 0,
		};
	}

	/**
	 * Clear all CRDT sync state
	 * Use this when resetting sync or logging out
	 */
	async clearCrdtState(): Promise<void> {
		await this.crdtSyncStateManager.clearAll();
	}

	/**
	 * Check if a document has CRDT state stored
	 */
	async hasCrdtDocument(
		entityType: (typeof CrdtEntityType)[keyof typeof CrdtEntityType],
		entityId: string,
	): Promise<boolean> {
		return this.crdtSyncStateManager.hasDocument(entityType, entityId);
	}
}

/**
 * Create a sync manager with the given options
 */
export function createSyncManager(options: SyncManagerOptions): SyncManager {
	return new SyncManager(options);
}
