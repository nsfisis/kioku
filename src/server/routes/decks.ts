import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, Errors, getAuthUser } from "../middleware/index.js";
import {
	type CardRepository,
	cardRepository,
	type DeckRepository,
	deckRepository,
} from "../repositories/index.js";
import { createDeckSchema, updateDeckSchema } from "../schemas/index.js";

export interface DeckDependencies {
	deckRepo: DeckRepository;
	cardRepo: CardRepository;
}

const deckIdParamSchema = z.object({
	id: z.uuid(),
});

export function createDecksRouter(deps: DeckDependencies) {
	const { deckRepo, cardRepo } = deps;

	return new Hono()
		.use("*", authMiddleware)
		.get("/", async (c) => {
			const user = getAuthUser(c);
			const decks = await deckRepo.findByUserId(user.id);
			const now = new Date();
			const decksWithDueCount = await Promise.all(
				decks.map(async (deck) => {
					const [dueCardCount, newCardCount, totalCardCount, reviewCardCount] =
						await Promise.all([
							cardRepo.countDueCards(deck.id, now),
							cardRepo.countNewCards(deck.id),
							cardRepo.countTotalCards(deck.id),
							cardRepo.countReviewStateCards(deck.id),
						]);
					return {
						...deck,
						dueCardCount,
						newCardCount,
						totalCardCount,
						reviewCardCount,
					};
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
			const [dueCardCount, newCardCount, totalCardCount, reviewCardCount] =
				await Promise.all([
					cardRepo.countDueCards(deck.id, now),
					cardRepo.countNewCards(deck.id),
					cardRepo.countTotalCards(deck.id),
					cardRepo.countReviewStateCards(deck.id),
				]);

			return c.json(
				{
					deck: {
						...deck,
						dueCardCount,
						newCardCount,
						totalCardCount,
						reviewCardCount,
					},
				},
				200,
			);
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
});
