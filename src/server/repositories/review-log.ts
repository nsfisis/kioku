import { and, eq, gte, sql } from "drizzle-orm";
import { getStartOfStudyDayBoundary } from "../../shared/date.js";
import { db } from "../db/index.js";
import { CardState, cards, reviewLogs } from "../db/schema.js";
import type { ReviewLog, ReviewLogRepository } from "./types.js";

export const reviewLogRepository: ReviewLogRepository = {
	async create(data: {
		cardId: string;
		userId: string;
		rating: number;
		state: number;
		scheduledDays: number;
		elapsedDays: number;
		durationMs?: number | null;
	}): Promise<ReviewLog> {
		const [reviewLog] = await db
			.insert(reviewLogs)
			.values({
				cardId: data.cardId,
				userId: data.userId,
				rating: data.rating,
				state: data.state,
				scheduledDays: data.scheduledDays,
				elapsedDays: data.elapsedDays,
				durationMs: data.durationMs ?? null,
			})
			.returning();
		if (!reviewLog) {
			throw new Error("Failed to create review log");
		}
		return reviewLog;
	},

	async countTodayNewCardReviews(deckId: string, now: Date): Promise<number> {
		const startOfDay = getStartOfStudyDayBoundary(now);

		const result = await db
			.select({ count: sql<number>`count(distinct ${reviewLogs.cardId})::int` })
			.from(reviewLogs)
			.innerJoin(cards, eq(reviewLogs.cardId, cards.id))
			.where(
				and(
					eq(cards.deckId, deckId),
					eq(reviewLogs.state, CardState.New),
					gte(reviewLogs.reviewedAt, startOfDay),
				),
			);
		return result[0]?.count ?? 0;
	},
};
