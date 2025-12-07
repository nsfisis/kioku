import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, Errors, getAuthUser } from "../middleware/index.js";
import { type DeckRepository, deckRepository } from "../repositories/index.js";
import { createDeckSchema, updateDeckSchema } from "../schemas/index.js";

export interface DeckDependencies {
	deckRepo: DeckRepository;
}

const deckIdParamSchema = z.object({
	id: z.string().uuid(),
});

export function createDecksRouter(deps: DeckDependencies) {
	const { deckRepo } = deps;

	return new Hono()
		.use("*", authMiddleware)
		.get("/", async (c) => {
			const user = getAuthUser(c);
			const decks = await deckRepo.findByUserId(user.id);
			return c.json({ decks }, 200);
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

			return c.json({ deck }, 200);
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
});
