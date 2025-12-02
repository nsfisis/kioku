import { eq } from "drizzle-orm";
import { db, users } from "../db";
import type { UserPublic, UserRepository } from "./types";

export const userRepository: UserRepository = {
	async findByUsername(username) {
		const [user] = await db
			.select({
				id: users.id,
				username: users.username,
				passwordHash: users.passwordHash,
			})
			.from(users)
			.where(eq(users.username, username))
			.limit(1);
		return user;
	},

	async existsByUsername(username) {
		const [user] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.username, username))
			.limit(1);
		return user !== undefined;
	},

	async create(data): Promise<UserPublic> {
		const [newUser] = await db
			.insert(users)
			.values({
				username: data.username,
				passwordHash: data.passwordHash,
			})
			.returning({
				id: users.id,
				username: users.username,
				createdAt: users.createdAt,
			});
		// Insert with returning should always return the created row
		return newUser!;
	},

	async findById(id) {
		const [user] = await db
			.select({
				id: users.id,
				username: users.username,
			})
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return user;
	},
};
