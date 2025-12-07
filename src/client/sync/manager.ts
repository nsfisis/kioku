import type { ConflictResolver } from "./conflict";
import type { PullService, SyncPullResult } from "./pull";
import type { PushService, SyncPushResult } from "./push";
import type { SyncQueue, SyncQueueState } from "./queue";

/**
 * Sync result from a full sync operation
 */
export interface SyncResult {
	success: boolean;
	pushResult: SyncPushResult | null;
	pullResult: SyncPullResult | null;
	conflictsResolved: number;
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
	| { type: "sync_error"; error: string };

/**
 * Sync Manager
 *
 * Orchestrates the sync process and handles auto-sync on reconnect:
 * 1. Monitors online/offline status
 * 2. Triggers sync when coming back online
 * 3. Coordinates push, pull, and conflict resolution
 * 4. Manages sync state and notifies listeners
 */
export class SyncManager {
	private syncQueue: SyncQueue;
	private pushService: PushService;
	private pullService: PullService;
	private conflictResolver: ConflictResolver;
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
				error: "Offline",
			};
		}

		if (this.syncInProgress) {
			return {
				success: false,
				pushResult: null,
				pullResult: null,
				conflictsResolved: 0,
				error: "Sync already in progress",
			};
		}

		this.syncInProgress = true;
		this.notifyListeners({ type: "sync_start" });

		try {
			await this.syncQueue.startSync();

			// Step 1: Push local changes
			const pushResult = await this.pushService.push();

			// Step 2: Pull server changes
			const pullResult = await this.pullService.pull();

			// Step 3: Resolve any conflicts
			let conflictsResolved = 0;
			if (this.conflictResolver.hasConflicts(pushResult)) {
				const resolution = await this.conflictResolver.resolveConflicts(
					pushResult,
					pullResult,
				);
				conflictsResolved =
					resolution.decks.length + resolution.cards.length;
			}

			const result: SyncResult = {
				success: true,
				pushResult,
				pullResult,
				conflictsResolved,
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
				error: errorMessage,
			};

			this.notifyListeners({ type: "sync_error", error: errorMessage });
			return result;
		} finally {
			this.syncInProgress = false;
		}
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
}

/**
 * Create a sync manager with the given options
 */
export function createSyncManager(options: SyncManagerOptions): SyncManager {
	return new SyncManager(options);
}
