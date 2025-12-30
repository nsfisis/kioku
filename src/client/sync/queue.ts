import {
	db,
	type LocalCard,
	type LocalDeck,
	type LocalNote,
	type LocalNoteFieldType,
	type LocalNoteFieldValue,
	type LocalNoteType,
	type LocalReviewLog,
} from "../db/index";
import {
	localCardRepository,
	localDeckRepository,
	localNoteFieldTypeRepository,
	localNoteFieldValueRepository,
	localNoteRepository,
	localNoteTypeRepository,
	localReviewLogRepository,
} from "../db/repositories";

/**
 * Sync status enum for tracking queue state
 */
export const SyncStatus = {
	Idle: "idle",
	Syncing: "syncing",
	Error: "error",
} as const;

export type SyncStatusType = (typeof SyncStatus)[keyof typeof SyncStatus];

/**
 * Pending changes to be pushed to the server
 */
export interface PendingChanges {
	decks: LocalDeck[];
	cards: LocalCard[];
	reviewLogs: LocalReviewLog[];
	noteTypes: LocalNoteType[];
	noteFieldTypes: LocalNoteFieldType[];
	notes: LocalNote[];
	noteFieldValues: LocalNoteFieldValue[];
}

/**
 * Sync queue state
 */
export interface SyncQueueState {
	status: SyncStatusType;
	pendingCount: number;
	lastSyncVersion: number;
	lastSyncAt: Date | null;
	lastError: string | null;
}

const SYNC_STATE_KEY = "kioku_sync_state";

/**
 * Load sync state from localStorage
 */
function loadSyncState(): Pick<
	SyncQueueState,
	"lastSyncVersion" | "lastSyncAt"
> {
	const stored = localStorage.getItem(SYNC_STATE_KEY);
	if (!stored) {
		return { lastSyncVersion: 0, lastSyncAt: null };
	}
	try {
		const parsed = JSON.parse(stored) as {
			lastSyncVersion?: number;
			lastSyncAt?: string;
		};
		return {
			lastSyncVersion: parsed.lastSyncVersion ?? 0,
			lastSyncAt: parsed.lastSyncAt ? new Date(parsed.lastSyncAt) : null,
		};
	} catch {
		return { lastSyncVersion: 0, lastSyncAt: null };
	}
}

/**
 * Save sync state to localStorage
 */
function saveSyncState(lastSyncVersion: number, lastSyncAt: Date): void {
	localStorage.setItem(
		SYNC_STATE_KEY,
		JSON.stringify({
			lastSyncVersion,
			lastSyncAt: lastSyncAt.toISOString(),
		}),
	);
}

/**
 * Listener type for sync queue state changes
 */
export type SyncQueueListener = (state: SyncQueueState) => void;

/**
 * Sync Queue Manager
 *
 * Manages the queue of pending changes to be synchronized with the server.
 * Provides methods to:
 * - Get pending changes count
 * - Get pending changes to push
 * - Mark items as synced after successful push
 * - Handle sync state persistence
 */
export class SyncQueue {
	private status: SyncStatusType = SyncStatus.Idle;
	private lastError: string | null = null;
	private lastSyncVersion: number;
	private lastSyncAt: Date | null;
	private listeners: Set<SyncQueueListener> = new Set();

	constructor() {
		const saved = loadSyncState();
		this.lastSyncVersion = saved.lastSyncVersion;
		this.lastSyncAt = saved.lastSyncAt;
	}

	/**
	 * Subscribe to sync queue state changes
	 */
	subscribe(listener: SyncQueueListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Notify all listeners of state change
	 */
	private async notifyListeners(): Promise<void> {
		const state = await this.getState();
		for (const listener of this.listeners) {
			listener(state);
		}
	}

	/**
	 * Get all pending (unsynced) changes
	 */
	async getPendingChanges(): Promise<PendingChanges> {
		const [
			decks,
			cards,
			reviewLogs,
			noteTypes,
			noteFieldTypes,
			notes,
			noteFieldValues,
		] = await Promise.all([
			localDeckRepository.findUnsynced(),
			localCardRepository.findUnsynced(),
			localReviewLogRepository.findUnsynced(),
			localNoteTypeRepository.findUnsynced(),
			localNoteFieldTypeRepository.findUnsynced(),
			localNoteRepository.findUnsynced(),
			localNoteFieldValueRepository.findUnsynced(),
		]);

		return {
			decks,
			cards,
			reviewLogs,
			noteTypes,
			noteFieldTypes,
			notes,
			noteFieldValues,
		};
	}

	/**
	 * Get count of pending changes
	 */
	async getPendingCount(): Promise<number> {
		const changes = await this.getPendingChanges();
		return (
			changes.decks.length +
			changes.cards.length +
			changes.reviewLogs.length +
			changes.noteTypes.length +
			changes.noteFieldTypes.length +
			changes.notes.length +
			changes.noteFieldValues.length
		);
	}

	/**
	 * Check if there are any pending changes
	 */
	async hasPendingChanges(): Promise<boolean> {
		return (await this.getPendingCount()) > 0;
	}

	/**
	 * Get current sync queue state
	 */
	async getState(): Promise<SyncQueueState> {
		return {
			status: this.status,
			pendingCount: await this.getPendingCount(),
			lastSyncVersion: this.lastSyncVersion,
			lastSyncAt: this.lastSyncAt,
			lastError: this.lastError,
		};
	}

	/**
	 * Get the last sync version for pull requests
	 */
	getLastSyncVersion(): number {
		return this.lastSyncVersion;
	}

	/**
	 * Set sync status to syncing
	 */
	async startSync(): Promise<void> {
		this.status = SyncStatus.Syncing;
		this.lastError = null;
		await this.notifyListeners();
	}

	/**
	 * Mark sync as completed successfully
	 */
	async completeSync(newSyncVersion: number): Promise<void> {
		this.status = SyncStatus.Idle;
		this.lastSyncVersion = newSyncVersion;
		this.lastSyncAt = new Date();
		this.lastError = null;
		saveSyncState(this.lastSyncVersion, this.lastSyncAt);
		await this.notifyListeners();
	}

	/**
	 * Mark sync as failed
	 */
	async failSync(error: string): Promise<void> {
		this.status = SyncStatus.Error;
		this.lastError = error;
		await this.notifyListeners();
	}

	/**
	 * Mark items as synced after successful push
	 */
	async markSynced(results: {
		decks: { id: string; syncVersion: number }[];
		cards: { id: string; syncVersion: number }[];
		reviewLogs: { id: string; syncVersion: number }[];
		noteTypes: { id: string; syncVersion: number }[];
		noteFieldTypes: { id: string; syncVersion: number }[];
		notes: { id: string; syncVersion: number }[];
		noteFieldValues: { id: string; syncVersion: number }[];
	}): Promise<void> {
		await db.transaction(
			"rw",
			[
				db.decks,
				db.cards,
				db.reviewLogs,
				db.noteTypes,
				db.noteFieldTypes,
				db.notes,
				db.noteFieldValues,
			],
			async () => {
				for (const deck of results.decks) {
					await localDeckRepository.markSynced(deck.id, deck.syncVersion);
				}
				for (const card of results.cards) {
					await localCardRepository.markSynced(card.id, card.syncVersion);
				}
				for (const reviewLog of results.reviewLogs) {
					await localReviewLogRepository.markSynced(
						reviewLog.id,
						reviewLog.syncVersion,
					);
				}
				for (const noteType of results.noteTypes) {
					await localNoteTypeRepository.markSynced(
						noteType.id,
						noteType.syncVersion,
					);
				}
				for (const fieldType of results.noteFieldTypes) {
					await localNoteFieldTypeRepository.markSynced(
						fieldType.id,
						fieldType.syncVersion,
					);
				}
				for (const note of results.notes) {
					await localNoteRepository.markSynced(note.id, note.syncVersion);
				}
				for (const fieldValue of results.noteFieldValues) {
					await localNoteFieldValueRepository.markSynced(
						fieldValue.id,
						fieldValue.syncVersion,
					);
				}
			},
		);
		await this.notifyListeners();
	}

	/**
	 * Apply changes pulled from server
	 */
	async applyPulledChanges(data: {
		decks: LocalDeck[];
		cards: LocalCard[];
		reviewLogs: LocalReviewLog[];
		noteTypes: LocalNoteType[];
		noteFieldTypes: LocalNoteFieldType[];
		notes: LocalNote[];
		noteFieldValues: LocalNoteFieldValue[];
	}): Promise<void> {
		await db.transaction(
			"rw",
			[
				db.decks,
				db.cards,
				db.reviewLogs,
				db.noteTypes,
				db.noteFieldTypes,
				db.notes,
				db.noteFieldValues,
			],
			async () => {
				// Apply in dependency order: NoteTypes first, then dependent entities
				for (const noteType of data.noteTypes) {
					await localNoteTypeRepository.upsertFromServer(noteType);
				}
				for (const fieldType of data.noteFieldTypes) {
					await localNoteFieldTypeRepository.upsertFromServer(fieldType);
				}
				for (const deck of data.decks) {
					await localDeckRepository.upsertFromServer(deck);
				}
				for (const note of data.notes) {
					await localNoteRepository.upsertFromServer(note);
				}
				for (const fieldValue of data.noteFieldValues) {
					await localNoteFieldValueRepository.upsertFromServer(fieldValue);
				}
				for (const card of data.cards) {
					await localCardRepository.upsertFromServer(card);
				}
				for (const reviewLog of data.reviewLogs) {
					await localReviewLogRepository.upsertFromServer(reviewLog);
				}
			},
		);
		await this.notifyListeners();
	}

	/**
	 * Reset sync state (for logout or debugging)
	 */
	async reset(): Promise<void> {
		this.status = SyncStatus.Idle;
		this.lastSyncVersion = 0;
		this.lastSyncAt = null;
		this.lastError = null;
		localStorage.removeItem(SYNC_STATE_KEY);
		await this.notifyListeners();
	}
}

/**
 * Singleton instance of the sync queue
 */
export const syncQueue = new SyncQueue();
