import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
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
import { createDeckSchema, updateDeckSchema } from "../schemas/index.js";

export interface DeckDependencies {
	deckRepo: DeckRepository;
	cardRepo: CardRepository;
	reviewLogRepo: ReviewLogRepository;
}

const deckIdParamSchema = z.object({
	id: z.uuid(),
});

const REVIEW_CARDS_LIMIT = 80;

export function createDecksRouter(deps: DeckDependencies) {
	const { deckRepo, cardRepo, reviewLogRepo } = deps;

	return new Hono()
		.use("*", authMiddleware)
		.get("/", async (c) => {
			const user = getAuthUser(c);
			const decks = await deckRepo.findByUserId(user.id);
			const now = new Date();
			const decksWithDueCount = await Promise.all(
				decks.map(async (deck) => {
					const [dueNewCards, dueReviewCards, reviewedNewCards] =
						await Promise.all([
							cardRepo.countDueNewCards(deck.id, now),
							cardRepo.countDueReviewCards(deck.id, now),
							reviewLogRepo.countTodayNewCardReviews(deck.id, now),
						]);

					// Apply the same limits as the study screen
					const newCardBudget = Math.max(
						0,
						deck.newCardsPerDay - reviewedNewCards,
					);
					const newCardsToStudy = Math.min(dueNewCards, newCardBudget);
					const reviewCardsToStudy = Math.min(
						dueReviewCards,
						REVIEW_CARDS_LIMIT,
					);

					const dueCardCount = newCardsToStudy + reviewCardsToStudy;

					return { ...deck, dueCardCount };
				}),
			);
			return c.json({ decks: decksWithDueCount }, 200);
		})
		.post("/", zValidator("json", createDeckSchema), async (c) => {
			const user = getAuthUser(c);
			const data = c.req.valid("json");

			const deck = await deckRepo.create({
				userId: user.id,
				name: data.name,
				description: data.description,
				newCardsPerDay: data.newCardsPerDay,
			});

			return c.json({ deck }, 201);
		})
		.get("/:id", zValidator("param", deckIdParamSchema), async (c) => {
			const user = getAuthUser(c);
			const { id } = c.req.valid("param");

			const deck = await deckRepo.findById(id, user.id);
			if (!deck) {
				throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
			}

			const now = new Date();
			const [dueNewCards, dueReviewCards, reviewedNewCards] = await Promise.all(
				[
					cardRepo.countDueNewCards(deck.id, now),
					cardRepo.countDueReviewCards(deck.id, now),
					reviewLogRepo.countTodayNewCardReviews(deck.id, now),
				],
			);

			const newCardBudget = Math.max(0, deck.newCardsPerDay - reviewedNewCards);
			const newCardsToStudy = Math.min(dueNewCards, newCardBudget);
			const reviewCardsToStudy = Math.min(dueReviewCards, REVIEW_CARDS_LIMIT);
			const dueCardCount = newCardsToStudy + reviewCardsToStudy;

			return c.json({ deck: { ...deck, dueCardCount } }, 200);
		})
		.put(
			"/:id",
			zValidator("param", deckIdParamSchema),
			zValidator("json", updateDeckSchema),
			async (c) => {
				const user = getAuthUser(c);
				const { id } = c.req.valid("param");
				const data = c.req.valid("json");

				const deck = await deckRepo.update(id, user.id, data);
				if (!deck) {
					throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
				}

				return c.json({ deck }, 200);
			},
		)
		.delete("/:id", zValidator("param", deckIdParamSchema), async (c) => {
			const user = getAuthUser(c);
			const { id } = c.req.valid("param");

			const deleted = await deckRepo.softDelete(id, user.id);
			if (!deleted) {
				throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
			}

			return c.json({ success: true }, 200);
		});
}

export const decks = createDecksRouter({
	deckRepo: deckRepository,
	cardRepo: cardRepository,
	reviewLogRepo: reviewLogRepository,
});
