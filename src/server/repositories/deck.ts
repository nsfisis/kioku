import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { decks } from "../db/schema.js";
import type { Deck, DeckRepository } from "./types.js";

export const deckRepository: DeckRepository = {
	async findByUserId(userId: string): Promise<Deck[]> {
		const result = await db
			.select()
			.from(decks)
			.where(and(eq(decks.userId, userId), isNull(decks.deletedAt)));
		return result;
	},

	async findById(id: string, userId: string): Promise<Deck | undefined> {
		const result = await db
			.select()
			.from(decks)
			.where(
				and(
					eq(decks.id, id),
					eq(decks.userId, userId),
					isNull(decks.deletedAt),
				),
			);
		return result[0];
	},

	async create(data: {
		userId: string;
		name: string;
		description?: string | null;
		newCardsPerDay?: number;
	}): Promise<Deck> {
		const [deck] = await db
			.insert(decks)
			.values({
				userId: data.userId,
				name: data.name,
				description: data.description ?? null,
				newCardsPerDay: data.newCardsPerDay ?? 20,
			})
			.returning();
		if (!deck) {
			throw new Error("Failed to create deck");
		}
		return deck;
	},

	async update(
		id: string,
		userId: string,
		data: {
			name?: string;
			description?: string | null;
			newCardsPerDay?: number;
		},
	): Promise<Deck | undefined> {
		const result = await db
			.update(decks)
			.set({
				...data,
				updatedAt: new Date(),
				syncVersion: sql`${decks.syncVersion} + 1`,
			})
			.where(
				and(
					eq(decks.id, id),
					eq(decks.userId, userId),
					isNull(decks.deletedAt),
				),
			)
			.returning();
		return result[0];
	},

	async softDelete(id: string, userId: string): Promise<boolean> {
		const result = await db
			.update(decks)
			.set({
				deletedAt: new Date(),
				updatedAt: new Date(),
				syncVersion: sql`${decks.syncVersion} + 1`,
			})
			.where(
				and(
					eq(decks.id, id),
					eq(decks.userId, userId),
					isNull(decks.deletedAt),
				),
			)
			.returning({ id: decks.id });
		return result.length > 0;
	},
};
