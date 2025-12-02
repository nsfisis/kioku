import { createUserSchema, loginSchema } from "@kioku/shared";
import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { db, users } from "../db";
import { Errors } from "../middleware";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
	throw new Error("JWT_SECRET environment variable is required");
}
const ACCESS_TOKEN_EXPIRES_IN = 60 * 15; // 15 minutes

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

auth.post("/login", async (c) => {
	const body = await c.req.json();

	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		throw Errors.validationError(parsed.error.issues[0]?.message);
	}

	const { username, password } = parsed.data;

	// Find user by username
	const [user] = await db
		.select({
			id: users.id,
			username: users.username,
			passwordHash: users.passwordHash,
		})
		.from(users)
		.where(eq(users.username, username))
		.limit(1);

	if (!user) {
		throw Errors.unauthorized(
			"Invalid username or password",
			"INVALID_CREDENTIALS",
		);
	}

	// Verify password
	const isPasswordValid = await argon2.verify(user.passwordHash, password);
	if (!isPasswordValid) {
		throw Errors.unauthorized(
			"Invalid username or password",
			"INVALID_CREDENTIALS",
		);
	}

	// Generate JWT access token
	const now = Math.floor(Date.now() / 1000);
	const accessToken = await sign(
		{
			sub: user.id,
			iat: now,
			exp: now + ACCESS_TOKEN_EXPIRES_IN,
		},
		JWT_SECRET,
	);

	return c.json({
		accessToken,
		user: {
			id: user.id,
			username: user.username,
		},
	});
});

export { auth };
