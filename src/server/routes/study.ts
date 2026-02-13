import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
	type Card as FSRSCard,
	type State as FSRSState,
	fsrs,
	type Grade,
} from "ts-fsrs";
import { z } from "zod";
import { authMiddleware, Errors, getAuthUser } from "../middleware/index.js";
import {
	type CardRepository,
	cardRepository,
	type DeckRepository,
	deckRepository,
	type ReviewLogRepository,
	reviewLogRepository,
} from "../repositories/index.js";
import { submitReviewSchema } from "../schemas/index.js";

export interface StudyDependencies {
	cardRepo: CardRepository;
	deckRepo: DeckRepository;
	reviewLogRepo: ReviewLogRepository;
}

const deckIdParamSchema = z.object({
	deckId: z.uuid(),
});

const cardIdParamSchema = z.object({
	deckId: z.uuid(),
	cardId: z.uuid(),
});

const f = fsrs({ enable_fuzz: true });

export function createStudyRouter(deps: StudyDependencies) {
	const { cardRepo, deckRepo, reviewLogRepo } = deps;

	return new Hono()
		.use("*", authMiddleware)
		.get("/", zValidator("param", deckIdParamSchema), async (c) => {
			const user = getAuthUser(c);
			const { deckId } = c.req.valid("param");

			// Verify deck ownership
			const deck = await deckRepo.findById(deckId, user.id);
			if (!deck) {
				throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
			}

			const now = new Date();

			const cards = await cardRepo.findDueCardsForStudy(deckId, now);

			return c.json({ cards }, 200);
		})
		.post(
			"/:cardId",
			zValidator("param", cardIdParamSchema),
			zValidator("json", submitReviewSchema),
			async (c) => {
				const user = getAuthUser(c);
				const { deckId, cardId } = c.req.valid("param");
				const { rating, durationMs } = c.req.valid("json");

				// Verify deck ownership
				const deck = await deckRepo.findById(deckId, user.id);
				if (!deck) {
					throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
				}

				// Get the card
				const card = await cardRepo.findById(cardId, deckId);
				if (!card) {
					throw Errors.notFound("Card not found", "CARD_NOT_FOUND");
				}

				const now = new Date();

				// Convert our card to FSRS card format
				const fsrsCard: FSRSCard = {
					due: card.due,
					stability: card.stability,
					difficulty: card.difficulty,
					elapsed_days: card.elapsedDays,
					scheduled_days: card.scheduledDays,
					reps: card.reps,
					lapses: card.lapses,
					state: card.state as FSRSState,
					last_review: card.lastReview ?? undefined,
					learning_steps: 0,
				};

				// Schedule the card with the given rating
				const result = f.next(fsrsCard, now, rating as Grade);

				// Calculate elapsed days for review log
				const elapsedDays = card.lastReview
					? Math.round(
							(now.getTime() - card.lastReview.getTime()) /
								(1000 * 60 * 60 * 24),
						)
					: 0;

				// Update the card with new FSRS values
				const updatedCard = await cardRepo.updateFSRSFields(cardId, deckId, {
					state: result.card.state,
					due: result.card.due,
					stability: result.card.stability,
					difficulty: result.card.difficulty,
					elapsedDays: result.card.elapsed_days,
					scheduledDays: result.card.scheduled_days,
					reps: result.card.reps,
					lapses: result.card.lapses,
					lastReview: now,
				});

				// Create review log
				await reviewLogRepo.create({
					cardId,
					userId: user.id,
					rating,
					state: card.state,
					scheduledDays: result.card.scheduled_days,
					elapsedDays,
					durationMs: durationMs ?? null,
				});

				return c.json({ card: updatedCard }, 200);
			},
		);
}

export const study = createStudyRouter({
	cardRepo: cardRepository,
	deckRepo: deckRepository,
	reviewLogRepo: reviewLogRepository,
});
