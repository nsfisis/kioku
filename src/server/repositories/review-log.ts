import { db } from "../db/index.js";
import { reviewLogs } from "../db/schema.js";
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
};
