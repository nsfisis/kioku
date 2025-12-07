import type { LocalCard, LocalDeck, LocalReviewLog } from "../db/index";
import type { PendingChanges, SyncQueue } from "./queue";

/**
 * Data format for push request to server
 */
export interface SyncPushData {
	decks: SyncDeckData[];
	cards: SyncCardData[];
	reviewLogs: SyncReviewLogData[];
}

export interface SyncDeckData {
	id: string;
	name: string;
	description: string | null;
	newCardsPerDay: number;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncCardData {
	id: string;
	deckId: string;
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

/**
 * Response from push endpoint
 */
export interface SyncPushResult {
	decks: { id: string; syncVersion: number }[];
	cards: { id: string; syncVersion: number }[];
	reviewLogs: { id: string; syncVersion: number }[];
	conflicts: {
		decks: string[];
		cards: string[];
	};
}

/**
 * Options for creating a push service
 */
export interface PushServiceOptions {
	syncQueue: SyncQueue;
	pushToServer: (data: SyncPushData) => Promise<SyncPushResult>;
}

/**
 * Convert local deck to sync format
 */
function deckToSyncData(deck: LocalDeck): SyncDeckData {
	return {
		id: deck.id,
		name: deck.name,
		description: deck.description,
		newCardsPerDay: deck.newCardsPerDay,
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
 * Convert pending changes to sync push data format
 */
export function pendingChangesToPushData(changes: PendingChanges): SyncPushData {
	return {
		decks: changes.decks.map(deckToSyncData),
		cards: changes.cards.map(cardToSyncData),
		reviewLogs: changes.reviewLogs.map(reviewLogToSyncData),
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
 * 5. Handle conflicts (server wins for LWW)
 */
export class PushService {
	private syncQueue: SyncQueue;
	private pushToServer: (data: SyncPushData) => Promise<SyncPushResult>;

	constructor(options: PushServiceOptions) {
		this.syncQueue = options.syncQueue;
		this.pushToServer = options.pushToServer;
	}

	/**
	 * Push all pending changes to the server
	 *
	 * @returns Result containing synced items and conflicts
	 * @throws Error if push fails
	 */
	async push(): Promise<SyncPushResult> {
		const pendingChanges = await this.syncQueue.getPendingChanges();

		// If no pending changes, return empty result
		if (
			pendingChanges.decks.length === 0 &&
			pendingChanges.cards.length === 0 &&
			pendingChanges.reviewLogs.length === 0
		) {
			return {
				decks: [],
				cards: [],
				reviewLogs: [],
				conflicts: { decks: [], cards: [] },
			};
		}

		// Convert to API format
		const pushData = pendingChangesToPushData(pendingChanges);

		// Push to server
		const result = await this.pushToServer(pushData);

		// Mark successfully synced items
		await this.syncQueue.markSynced({
			decks: result.decks,
			cards: result.cards,
			reviewLogs: result.reviewLogs,
		});

		return result;
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
