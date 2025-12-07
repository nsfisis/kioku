import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { CardState, cards } from "../db/schema.js";
import type { Card, CardRepository } from "./types.js";

export const cardRepository: CardRepository = {
	async findByDeckId(deckId: string): Promise<Card[]> {
		const result = await db
			.select()
			.from(cards)
			.where(and(eq(cards.deckId, deckId), isNull(cards.deletedAt)));
		return result;
	},

	async findById(id: string, deckId: string): Promise<Card | undefined> {
		const result = await db
			.select()
			.from(cards)
			.where(
				and(
					eq(cards.id, id),
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
				),
			);
		return result[0];
	},

	async create(
		deckId: string,
		data: {
			front: string;
			back: string;
		},
	): Promise<Card> {
		const [card] = await db
			.insert(cards)
			.values({
				deckId,
				front: data.front,
				back: data.back,
				state: CardState.New,
				due: new Date(),
				stability: 0,
				difficulty: 0,
				elapsedDays: 0,
				scheduledDays: 0,
				reps: 0,
				lapses: 0,
			})
			.returning();
		if (!card) {
			throw new Error("Failed to create card");
		}
		return card;
	},

	async update(
		id: string,
		deckId: string,
		data: {
			front?: string;
			back?: string;
		},
	): Promise<Card | undefined> {
		const result = await db
			.update(cards)
			.set({
				...data,
				updatedAt: new Date(),
				syncVersion: sql`${cards.syncVersion} + 1`,
			})
			.where(
				and(
					eq(cards.id, id),
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
				),
			)
			.returning();
		return result[0];
	},

	async softDelete(id: string, deckId: string): Promise<boolean> {
		const result = await db
			.update(cards)
			.set({
				deletedAt: new Date(),
				updatedAt: new Date(),
				syncVersion: sql`${cards.syncVersion} + 1`,
			})
			.where(
				and(
					eq(cards.id, id),
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
				),
			)
			.returning({ id: cards.id });
		return result.length > 0;
	},

	async findDueCards(
		deckId: string,
		now: Date,
		limit: number,
	): Promise<Card[]> {
		const result = await db
			.select()
			.from(cards)
			.where(
				and(
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
					lte(cards.due, now),
				),
			)
			.orderBy(cards.due)
			.limit(limit);
		return result;
	},

	async updateFSRSFields(
		id: string,
		deckId: string,
		data: {
			state: number;
			due: Date;
			stability: number;
			difficulty: number;
			elapsedDays: number;
			scheduledDays: number;
			reps: number;
			lapses: number;
			lastReview: Date;
		},
	): Promise<Card | undefined> {
		const result = await db
			.update(cards)
			.set({
				state: data.state,
				due: data.due,
				stability: data.stability,
				difficulty: data.difficulty,
				elapsedDays: data.elapsedDays,
				scheduledDays: data.scheduledDays,
				reps: data.reps,
				lapses: data.lapses,
				lastReview: data.lastReview,
				updatedAt: new Date(),
				syncVersion: sql`${cards.syncVersion} + 1`,
			})
			.where(
				and(
					eq(cards.id, id),
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
				),
			)
			.returning();
		return result[0];
	},
};
