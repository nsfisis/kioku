import type { LocalCard, LocalDeck } from "../db/index";
import { localCardRepository, localDeckRepository } from "../db/repositories";
import type { ServerCard, ServerDeck, SyncPullResult } from "./pull";
import type { SyncPushResult } from "./push";

/**
 * Conflict resolution result for a single item
 */
export interface ConflictResolutionItem {
	id: string;
	resolution: "server_wins" | "local_wins";
}

/**
 * Result of conflict resolution process
 */
export interface ConflictResolutionResult {
	decks: ConflictResolutionItem[];
	cards: ConflictResolutionItem[];
}

/**
 * Options for conflict resolver
 */
export interface ConflictResolverOptions {
	/**
	 * Strategy for resolving conflicts
	 * - "server_wins": Always use server data (default for LWW)
	 * - "local_wins": Always use local data
	 * - "newer_wins": Compare timestamps and use newer data
	 */
	strategy?: "server_wins" | "local_wins" | "newer_wins";
}

/**
 * Compare timestamps for LWW resolution
 * Returns true if server data is newer or equal
 */
function isServerNewer(serverUpdatedAt: Date, localUpdatedAt: Date): boolean {
	return serverUpdatedAt.getTime() >= localUpdatedAt.getTime();
}

/**
 * Convert server deck to local format for storage
 */
function serverDeckToLocal(deck: ServerDeck): LocalDeck {
	return {
		id: deck.id,
		userId: deck.userId,
		name: deck.name,
		description: deck.description,
		newCardsPerDay: deck.newCardsPerDay,
		createdAt: new Date(deck.createdAt),
		updatedAt: new Date(deck.updatedAt),
		deletedAt: deck.deletedAt ? new Date(deck.deletedAt) : null,
		syncVersion: deck.syncVersion,
		_synced: true,
	};
}

/**
 * Convert server card to local format for storage
 */
function serverCardToLocal(card: ServerCard): LocalCard {
	return {
		id: card.id,
		deckId: card.deckId,
		noteId: card.noteId ?? null,
		isReversed: card.isReversed ?? null,
		front: card.front,
		back: card.back,
		state: card.state as LocalCard["state"],
		due: new Date(card.due),
		stability: card.stability,
		difficulty: card.difficulty,
		elapsedDays: card.elapsedDays,
		scheduledDays: card.scheduledDays,
		reps: card.reps,
		lapses: card.lapses,
		lastReview: card.lastReview ? new Date(card.lastReview) : null,
		createdAt: new Date(card.createdAt),
		updatedAt: new Date(card.updatedAt),
		deletedAt: card.deletedAt ? new Date(card.deletedAt) : null,
		syncVersion: card.syncVersion,
		_synced: true,
	};
}

/**
 * Conflict Resolver
 *
 * Handles conflicts reported by the server during push operations.
 * When a conflict occurs (server has newer data), this resolver:
 * 1. Identifies conflicting items from push result
 * 2. Pulls latest server data for those items
 * 3. Applies conflict resolution strategy (default: server wins / LWW)
 * 4. Updates local database accordingly
 */
export class ConflictResolver {
	private strategy: "server_wins" | "local_wins" | "newer_wins";

	constructor(options: ConflictResolverOptions = {}) {
		this.strategy = options.strategy ?? "server_wins";
	}

	/**
	 * Check if there are conflicts in push result
	 */
	hasConflicts(pushResult: SyncPushResult): boolean {
		return (
			pushResult.conflicts.decks.length > 0 ||
			pushResult.conflicts.cards.length > 0
		);
	}

	/**
	 * Get list of conflicting deck IDs
	 */
	getConflictingDeckIds(pushResult: SyncPushResult): string[] {
		return pushResult.conflicts.decks;
	}

	/**
	 * Get list of conflicting card IDs
	 */
	getConflictingCardIds(pushResult: SyncPushResult): string[] {
		return pushResult.conflicts.cards;
	}

	/**
	 * Resolve deck conflict using configured strategy
	 */
	async resolveDeckConflict(
		localDeck: LocalDeck,
		serverDeck: ServerDeck,
	): Promise<ConflictResolutionItem> {
		let resolution: "server_wins" | "local_wins";

		switch (this.strategy) {
			case "server_wins":
				resolution = "server_wins";
				break;
			case "local_wins":
				resolution = "local_wins";
				break;
			case "newer_wins":
				resolution = isServerNewer(
					new Date(serverDeck.updatedAt),
					localDeck.updatedAt,
				)
					? "server_wins"
					: "local_wins";
				break;
		}

		if (resolution === "server_wins") {
			// Update local with server data
			const localData = serverDeckToLocal(serverDeck);
			await localDeckRepository.upsertFromServer(localData);
		}
		// If local_wins, we keep local data and it will be pushed again next sync

		return { id: localDeck.id, resolution };
	}

	/**
	 * Resolve card conflict using configured strategy
	 */
	async resolveCardConflict(
		localCard: LocalCard,
		serverCard: ServerCard,
	): Promise<ConflictResolutionItem> {
		let resolution: "server_wins" | "local_wins";

		switch (this.strategy) {
			case "server_wins":
				resolution = "server_wins";
				break;
			case "local_wins":
				resolution = "local_wins";
				break;
			case "newer_wins":
				resolution = isServerNewer(
					new Date(serverCard.updatedAt),
					localCard.updatedAt,
				)
					? "server_wins"
					: "local_wins";
				break;
		}

		if (resolution === "server_wins") {
			// Update local with server data
			const localData = serverCardToLocal(serverCard);
			await localCardRepository.upsertFromServer(localData);
		}
		// If local_wins, we keep local data and it will be pushed again next sync

		return { id: localCard.id, resolution };
	}

	/**
	 * Resolve all conflicts from a push result
	 * Uses pull result to get server data for conflicting items
	 */
	async resolveConflicts(
		pushResult: SyncPushResult,
		pullResult: SyncPullResult,
	): Promise<ConflictResolutionResult> {
		const result: ConflictResolutionResult = {
			decks: [],
			cards: [],
		};

		// Resolve deck conflicts
		for (const deckId of pushResult.conflicts.decks) {
			const localDeck = await localDeckRepository.findById(deckId);
			const serverDeck = pullResult.decks.find((d) => d.id === deckId);

			if (localDeck && serverDeck) {
				const resolution = await this.resolveDeckConflict(
					localDeck,
					serverDeck,
				);
				result.decks.push(resolution);
			} else if (serverDeck) {
				// Local doesn't exist, apply server data
				const localData = serverDeckToLocal(serverDeck);
				await localDeckRepository.upsertFromServer(localData);
				result.decks.push({ id: deckId, resolution: "server_wins" });
			}
			// If server doesn't have it but local does, keep local (will push again)
		}

		// Resolve card conflicts
		for (const cardId of pushResult.conflicts.cards) {
			const localCard = await localCardRepository.findById(cardId);
			const serverCard = pullResult.cards.find((c) => c.id === cardId);

			if (localCard && serverCard) {
				const resolution = await this.resolveCardConflict(
					localCard,
					serverCard,
				);
				result.cards.push(resolution);
			} else if (serverCard) {
				// Local doesn't exist, apply server data
				const localData = serverCardToLocal(serverCard);
				await localCardRepository.upsertFromServer(localData);
				result.cards.push({ id: cardId, resolution: "server_wins" });
			}
			// If server doesn't have it but local does, keep local (will push again)
		}

		return result;
	}
}

/**
 * Create a conflict resolver with the given options
 */
export function createConflictResolver(
	options: ConflictResolverOptions = {},
): ConflictResolver {
	return new ConflictResolver(options);
}

/**
 * Default conflict resolver using LWW (server wins) strategy
 */
export const conflictResolver = new ConflictResolver({
	strategy: "server_wins",
});
