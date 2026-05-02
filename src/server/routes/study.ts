import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { computeNextSchedule } from "../../shared/fsrs.js";
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

				const next = computeNextSchedule(card, rating, now);

				// Update the card with new FSRS values
				const updatedCard = await cardRepo.updateFSRSFields(cardId, deckId, {
					state: next.state,
					due: next.due,
					stability: next.stability,
					difficulty: next.difficulty,
					elapsedDays: next.elapsedDays,
					scheduledDays: next.scheduledDays,
					reps: next.reps,
					lapses: next.lapses,
					lastReview: next.lastReview,
				});

				// Create review log
				await reviewLogRepo.create({
					cardId,
					userId: user.id,
					rating,
					state: card.state,
					scheduledDays: next.scheduledDays,
					elapsedDays: next.reviewElapsedDays,
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
