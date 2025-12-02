import { createUserSchema } from "@kioku/shared";
import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, users } from "../db";
import { Errors } from "../middleware";

const auth = new Hono();

auth.post("/register", async (c) => {
	const body = await c.req.json();

	const parsed = createUserSchema.safeParse(body);
	if (!parsed.success) {
		throw Errors.validationError(parsed.error.issues[0]?.message);
	}

	const { username, password } = parsed.data;

	// Check if username already exists
	const existingUser = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, username))
		.limit(1);

	if (existingUser.length > 0) {
		throw Errors.conflict("Username already exists", "USERNAME_EXISTS");
	}

	// Hash password with Argon2
	const passwordHash = await argon2.hash(password);

	// Create user
	const [newUser] = await db
		.insert(users)
		.values({
			username,
			passwordHash,
		})
		.returning({
			id: users.id,
			username: users.username,
			createdAt: users.createdAt,
		});

	return c.json({ user: newUser }, 201);
});

export { auth };
