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
