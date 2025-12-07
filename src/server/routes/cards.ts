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
import { createCardSchema, updateCardSchema } from "../schemas/index.js";

export interface CardDependencies {
	cardRepo: CardRepository;
	deckRepo: DeckRepository;
}

const deckIdParamSchema = z.object({
	deckId: z.string().uuid(),
});

const cardIdParamSchema = z.object({
	deckId: z.string().uuid(),
	cardId: z.string().uuid(),
});

export function createCardsRouter(deps: CardDependencies) {
	const { cardRepo, deckRepo } = deps;

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

			const cards = await cardRepo.findByDeckId(deckId);
			return c.json({ cards }, 200);
		})
		.post(
			"/",
			zValidator("param", deckIdParamSchema),
			zValidator("json", createCardSchema),
			async (c) => {
				const user = getAuthUser(c);
				const { deckId } = c.req.valid("param");
				const data = c.req.valid("json");

				// Verify deck ownership
				const deck = await deckRepo.findById(deckId, user.id);
				if (!deck) {
					throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
				}

				const card = await cardRepo.create(deckId, {
					front: data.front,
					back: data.back,
				});

				return c.json({ card }, 201);
			},
		)
		.get("/:cardId", zValidator("param", cardIdParamSchema), async (c) => {
			const user = getAuthUser(c);
			const { deckId, cardId } = c.req.valid("param");

			// Verify deck ownership
			const deck = await deckRepo.findById(deckId, user.id);
			if (!deck) {
				throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
			}

			const card = await cardRepo.findById(cardId, deckId);
			if (!card) {
				throw Errors.notFound("Card not found", "CARD_NOT_FOUND");
			}

			return c.json({ card }, 200);
		})
		.put(
			"/:cardId",
			zValidator("param", cardIdParamSchema),
			zValidator("json", updateCardSchema),
			async (c) => {
				const user = getAuthUser(c);
				const { deckId, cardId } = c.req.valid("param");
				const data = c.req.valid("json");

				// Verify deck ownership
				const deck = await deckRepo.findById(deckId, user.id);
				if (!deck) {
					throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
				}

				const card = await cardRepo.update(cardId, deckId, data);
				if (!card) {
					throw Errors.notFound("Card not found", "CARD_NOT_FOUND");
				}

				return c.json({ card }, 200);
			},
		)
		.delete("/:cardId", zValidator("param", cardIdParamSchema), async (c) => {
			const user = getAuthUser(c);
			const { deckId, cardId } = c.req.valid("param");

			// Verify deck ownership
			const deck = await deckRepo.findById(deckId, user.id);
			if (!deck) {
				throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
			}

			const deleted = await cardRepo.softDelete(cardId, deckId);
			if (!deleted) {
				throw Errors.notFound("Card not found", "CARD_NOT_FOUND");
			}

			return c.json({ success: true }, 200);
		});
}

export const cards = createCardsRouter({
	cardRepo: cardRepository,
	deckRepo: deckRepository,
});
