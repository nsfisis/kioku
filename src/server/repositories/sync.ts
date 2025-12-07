import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { cards, decks, reviewLogs } from "../db/schema.js";
import type { Card, Deck, ReviewLog } from "./types.js";

/**
 * Sync data types for push/pull operations
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

export interface SyncPushResult {
	decks: { id: string; syncVersion: number }[];
	cards: { id: string; syncVersion: number }[];
	reviewLogs: { id: string; syncVersion: number }[];
	conflicts: {
		decks: string[];
		cards: string[];
	};
}

export interface SyncPullQuery {
	lastSyncVersion: number;
}

export interface SyncPullResult {
	decks: Deck[];
	cards: Card[];
	reviewLogs: ReviewLog[];
	currentSyncVersion: number;
}

export interface SyncRepository {
	pushChanges(userId: string, data: SyncPushData): Promise<SyncPushResult>;
	pullChanges(userId: string, query: SyncPullQuery): Promise<SyncPullResult>;
}

export const syncRepository: SyncRepository = {
	async pushChanges(
		userId: string,
		data: SyncPushData,
	): Promise<SyncPushResult> {
		const result: SyncPushResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			conflicts: {
				decks: [],
				cards: [],
			},
		};

		// Process decks with Last-Write-Wins conflict resolution
		for (const deckData of data.decks) {
			const clientUpdatedAt = new Date(deckData.updatedAt);

			// Check if deck exists
			const existing = await db
				.select({
					id: decks.id,
					updatedAt: decks.updatedAt,
					syncVersion: decks.syncVersion,
				})
				.from(decks)
				.where(and(eq(decks.id, deckData.id), eq(decks.userId, userId)));

			if (existing.length === 0) {
				// New deck - insert
				const [inserted] = await db
					.insert(decks)
					.values({
						id: deckData.id,
						userId,
						name: deckData.name,
						description: deckData.description,
						newCardsPerDay: deckData.newCardsPerDay,
						createdAt: new Date(deckData.createdAt),
						updatedAt: clientUpdatedAt,
						deletedAt: deckData.deletedAt ? new Date(deckData.deletedAt) : null,
						syncVersion: 1,
					})
					.returning({ id: decks.id, syncVersion: decks.syncVersion });

				if (inserted) {
					result.decks.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				const serverDeck = existing[0];
				// Last-Write-Wins: compare timestamps
				if (serverDeck && clientUpdatedAt > serverDeck.updatedAt) {
					// Client wins - update
					const [updated] = await db
						.update(decks)
						.set({
							name: deckData.name,
							description: deckData.description,
							newCardsPerDay: deckData.newCardsPerDay,
							updatedAt: clientUpdatedAt,
							deletedAt: deckData.deletedAt
								? new Date(deckData.deletedAt)
								: null,
							syncVersion: sql`${decks.syncVersion} + 1`,
						})
						.where(eq(decks.id, deckData.id))
						.returning({ id: decks.id, syncVersion: decks.syncVersion });

					if (updated) {
						result.decks.push({
							id: updated.id,
							syncVersion: updated.syncVersion,
						});
					}
				} else if (serverDeck) {
					// Server wins - mark as conflict
					result.conflicts.decks.push(deckData.id);
					result.decks.push({
						id: serverDeck.id,
						syncVersion: serverDeck.syncVersion,
					});
				}
			}
		}

		// Process cards with Last-Write-Wins conflict resolution
		for (const cardData of data.cards) {
			const clientUpdatedAt = new Date(cardData.updatedAt);

			// Verify deck belongs to user
			const deckCheck = await db
				.select({ id: decks.id })
				.from(decks)
				.where(and(eq(decks.id, cardData.deckId), eq(decks.userId, userId)));

			if (deckCheck.length === 0) {
				// Deck doesn't belong to user, skip
				continue;
			}

			// Check if card exists
			const existing = await db
				.select({
					id: cards.id,
					updatedAt: cards.updatedAt,
					syncVersion: cards.syncVersion,
				})
				.from(cards)
				.where(eq(cards.id, cardData.id));

			if (existing.length === 0) {
				// New card - insert
				const [inserted] = await db
					.insert(cards)
					.values({
						id: cardData.id,
						deckId: cardData.deckId,
						front: cardData.front,
						back: cardData.back,
						state: cardData.state,
						due: new Date(cardData.due),
						stability: cardData.stability,
						difficulty: cardData.difficulty,
						elapsedDays: cardData.elapsedDays,
						scheduledDays: cardData.scheduledDays,
						reps: cardData.reps,
						lapses: cardData.lapses,
						lastReview: cardData.lastReview
							? new Date(cardData.lastReview)
							: null,
						createdAt: new Date(cardData.createdAt),
						updatedAt: clientUpdatedAt,
						deletedAt: cardData.deletedAt ? new Date(cardData.deletedAt) : null,
						syncVersion: 1,
					})
					.returning({ id: cards.id, syncVersion: cards.syncVersion });

				if (inserted) {
					result.cards.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				const serverCard = existing[0];
				// Last-Write-Wins: compare timestamps
				if (serverCard && clientUpdatedAt > serverCard.updatedAt) {
					// Client wins - update
					const [updated] = await db
						.update(cards)
						.set({
							deckId: cardData.deckId,
							front: cardData.front,
							back: cardData.back,
							state: cardData.state,
							due: new Date(cardData.due),
							stability: cardData.stability,
							difficulty: cardData.difficulty,
							elapsedDays: cardData.elapsedDays,
							scheduledDays: cardData.scheduledDays,
							reps: cardData.reps,
							lapses: cardData.lapses,
							lastReview: cardData.lastReview
								? new Date(cardData.lastReview)
								: null,
							updatedAt: clientUpdatedAt,
							deletedAt: cardData.deletedAt
								? new Date(cardData.deletedAt)
								: null,
							syncVersion: sql`${cards.syncVersion} + 1`,
						})
						.where(eq(cards.id, cardData.id))
						.returning({ id: cards.id, syncVersion: cards.syncVersion });

					if (updated) {
						result.cards.push({
							id: updated.id,
							syncVersion: updated.syncVersion,
						});
					}
				} else if (serverCard) {
					// Server wins - mark as conflict
					result.conflicts.cards.push(cardData.id);
					result.cards.push({
						id: serverCard.id,
						syncVersion: serverCard.syncVersion,
					});
				}
			}
		}

		// Process review logs (append-only, no conflicts)
		for (const logData of data.reviewLogs) {
			// Verify the card's deck belongs to user
			const cardCheck = await db
				.select({ id: cards.id })
				.from(cards)
				.innerJoin(decks, eq(cards.deckId, decks.id))
				.where(and(eq(cards.id, logData.cardId), eq(decks.userId, userId)));

			if (cardCheck.length === 0) {
				// Card doesn't belong to user, skip
				continue;
			}

			// Check if review log already exists
			const existing = await db
				.select({ id: reviewLogs.id, syncVersion: reviewLogs.syncVersion })
				.from(reviewLogs)
				.where(eq(reviewLogs.id, logData.id));

			if (existing.length === 0) {
				// New review log - insert
				const [inserted] = await db
					.insert(reviewLogs)
					.values({
						id: logData.id,
						cardId: logData.cardId,
						userId,
						rating: logData.rating,
						state: logData.state,
						scheduledDays: logData.scheduledDays,
						elapsedDays: logData.elapsedDays,
						reviewedAt: new Date(logData.reviewedAt),
						durationMs: logData.durationMs,
						syncVersion: 1,
					})
					.returning({
						id: reviewLogs.id,
						syncVersion: reviewLogs.syncVersion,
					});

				if (inserted) {
					result.reviewLogs.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				// Already exists, return current version
				const existingLog = existing[0];
				if (existingLog) {
					result.reviewLogs.push({
						id: existingLog.id,
						syncVersion: existingLog.syncVersion,
					});
				}
			}
		}

		return result;
	},

	async pullChanges(
		userId: string,
		query: SyncPullQuery,
	): Promise<SyncPullResult> {
		const { lastSyncVersion } = query;

		// Get all decks with syncVersion > lastSyncVersion
		const pulledDecks = await db
			.select()
			.from(decks)
			.where(
				and(eq(decks.userId, userId), gt(decks.syncVersion, lastSyncVersion)),
			);

		// Get all cards from user's decks with syncVersion > lastSyncVersion
		const userDeckIds = await db
			.select({ id: decks.id })
			.from(decks)
			.where(eq(decks.userId, userId));

		const deckIdList = userDeckIds.map((d) => d.id);

		let pulledCards: Card[] = [];
		if (deckIdList.length > 0) {
			const cardResults = await db
				.select()
				.from(cards)
				.where(gt(cards.syncVersion, lastSyncVersion));

			// Filter cards that belong to user's decks
			pulledCards = cardResults.filter((c) => deckIdList.includes(c.deckId));
		}

		// Get all review logs for user with syncVersion > lastSyncVersion
		const pulledReviewLogs = await db
			.select()
			.from(reviewLogs)
			.where(
				and(
					eq(reviewLogs.userId, userId),
					gt(reviewLogs.syncVersion, lastSyncVersion),
				),
			);

		// Calculate current max sync version across all entities
		let currentSyncVersion = lastSyncVersion;

		for (const deck of pulledDecks) {
			if (deck.syncVersion > currentSyncVersion) {
				currentSyncVersion = deck.syncVersion;
			}
		}
		for (const card of pulledCards) {
			if (card.syncVersion > currentSyncVersion) {
				currentSyncVersion = card.syncVersion;
			}
		}
		for (const log of pulledReviewLogs) {
			if (log.syncVersion > currentSyncVersion) {
				currentSyncVersion = log.syncVersion;
			}
		}

		return {
			decks: pulledDecks,
			cards: pulledCards,
			reviewLogs: pulledReviewLogs,
			currentSyncVersion,
		};
	},
};
