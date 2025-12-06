import { and, eq, gt } from "drizzle-orm";
import { db, refreshTokens } from "../db/index.js";
import type { RefreshTokenRepository } from "./types.js";

export const refreshTokenRepository: RefreshTokenRepository = {
	async findValidToken(tokenHash) {
		const [token] = await db
			.select({
				id: refreshTokens.id,
				userId: refreshTokens.userId,
				expiresAt: refreshTokens.expiresAt,
			})
			.from(refreshTokens)
			.where(
				and(
					eq(refreshTokens.tokenHash, tokenHash),
					gt(refreshTokens.expiresAt, new Date()),
				),
			)
			.limit(1);
		return token;
	},

	async create(data) {
		await db.insert(refreshTokens).values({
			userId: data.userId,
			tokenHash: data.tokenHash,
			expiresAt: data.expiresAt,
		});
	},

	async deleteById(id) {
		await db.delete(refreshTokens).where(eq(refreshTokens.id, id));
	},
};
