import { computeNextSchedule } from "../../shared/fsrs";
import { db, type LocalCard, type RatingType } from "../db";
import {
	localCardRepository,
	localDeckRepository,
	localReviewLogRepository,
} from "../db/repositories";
import { syncQueue } from "./queue";

export interface SubmitReviewResult {
	/** The card after the review is applied. */
	card: LocalCard;
	/** Snapshot of the card before the review — used by undo. */
	prevCard: LocalCard;
	/** The newly created review log id — used by undo. */
	reviewLogId: string;
}

/**
 * Submit a review locally: update card scheduling and create a review log
 * in IndexedDB. The sync engine will pick up the changes via _synced=false.
 */
export async function submitReviewLocal(params: {
	cardId: string;
	rating: RatingType;
	durationMs: number;
	now?: Date;
}): Promise<SubmitReviewResult> {
	const { cardId, rating, durationMs } = params;
	const now = params.now ?? new Date();

	const card = await localCardRepository.findById(cardId);
	if (!card) {
		throw new Error(`Card not found in local database: ${cardId}`);
	}

	const deck = await localDeckRepository.findById(card.deckId);
	if (!deck) {
		throw new Error(`Deck not found in local database: ${card.deckId}`);
	}

	const prevCard = card;
	const previousState = card.state;

	const next = computeNextSchedule(card, rating, now);

	const updatedCard = await localCardRepository.updateScheduling(cardId, {
		state: next.state as LocalCard["state"],
		due: next.due,
		stability: next.stability,
		difficulty: next.difficulty,
		elapsedDays: next.elapsedDays,
		scheduledDays: next.scheduledDays,
		reps: next.reps,
		lapses: next.lapses,
		lastReview: next.lastReview,
	});
	if (!updatedCard) {
		throw new Error(`Failed to update card: ${cardId}`);
	}

	const reviewLog = await localReviewLogRepository.create({
		cardId,
		userId: deck.userId,
		rating,
		state: previousState,
		scheduledDays: next.scheduledDays,
		elapsedDays: next.reviewElapsedDays,
		reviewedAt: now,
		durationMs,
	});

	await syncQueue.notifyChanged();

	return { card: updatedCard, prevCard, reviewLogId: reviewLog.id };
}

/**
 * Undo a recent review: restore the previous card state and remove the
 * just-created review log. Best-effort — if a sync has already pushed the
 * review, the server still has it.
 */
export async function undoReviewLocal(params: {
	prevCard: LocalCard;
	reviewLogId: string;
}): Promise<void> {
	await db.cards.put({ ...params.prevCard });
	await localReviewLogRepository.delete(params.reviewLogId);
	await syncQueue.notifyChanged();
}

/**
 * Server-shaped study card. Includes all FSRS fields needed to reconstruct
 * a LocalCard so we can submit reviews offline.
 */
export interface ServerStudyCard {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
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
	syncVersion: number;
}

/**
 * Cache study cards into IndexedDB so the scheduler can submit reviews
 * even when the network drops mid-session. Only cards are cached here —
 * note types / fields / values come through the regular sync pull.
 */
export async function cacheStudyCards(cards: ServerStudyCard[]): Promise<void> {
	for (const c of cards) {
		const local: LocalCard = {
			id: c.id,
			deckId: c.deckId,
			noteId: c.noteId,
			isReversed: c.isReversed,
			front: c.front,
			back: c.back,
			state: c.state as LocalCard["state"],
			due: new Date(c.due),
			stability: c.stability,
			difficulty: c.difficulty,
			elapsedDays: c.elapsedDays,
			scheduledDays: c.scheduledDays,
			reps: c.reps,
			lapses: c.lapses,
			lastReview: c.lastReview ? new Date(c.lastReview) : null,
			createdAt: new Date(c.createdAt),
			updatedAt: new Date(c.updatedAt),
			deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
			syncVersion: c.syncVersion,
			_synced: true,
		};

		// Don't clobber pending local edits (e.g., a review that hasn't
		// been pushed yet). If the local copy has unsynced changes, skip.
		const existing = await localCardRepository.findById(c.id);
		if (existing && !existing._synced) continue;

		await localCardRepository.upsertFromServer(local);
	}
}
