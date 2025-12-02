import { createHash, randomBytes } from "node:crypto";
import {
	createUserSchema,
	loginSchema,
	refreshTokenSchema,
} from "@kioku/shared";
import * as argon2 from "argon2";
import { and, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { db, refreshTokens, users } from "../db";
import { Errors } from "../middleware";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
	throw new Error("JWT_SECRET environment variable is required");
}
const ACCESS_TOKEN_EXPIRES_IN = 60 * 15; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days

function generateRefreshToken(): string {
	return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

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

	// Generate refresh token
	const refreshToken = generateRefreshToken();
	const tokenHash = hashToken(refreshToken);
	const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

	// Store refresh token in database
	await db.insert(refreshTokens).values({
		userId: user.id,
		tokenHash,
		expiresAt,
	});

	return c.json({
		accessToken,
		refreshToken,
		user: {
			id: user.id,
			username: user.username,
		},
	});
});

auth.post("/refresh", async (c) => {
	const body = await c.req.json();

	const parsed = refreshTokenSchema.safeParse(body);
	if (!parsed.success) {
		throw Errors.validationError(parsed.error.issues[0]?.message);
	}

	const { refreshToken } = parsed.data;
	const tokenHash = hashToken(refreshToken);

	// Find valid refresh token
	const [storedToken] = await db
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

	if (!storedToken) {
		throw Errors.unauthorized(
			"Invalid or expired refresh token",
			"INVALID_REFRESH_TOKEN",
		);
	}

	// Get user info
	const [user] = await db
		.select({
			id: users.id,
			username: users.username,
		})
		.from(users)
		.where(eq(users.id, storedToken.userId))
		.limit(1);

	if (!user) {
		throw Errors.unauthorized("User not found", "USER_NOT_FOUND");
	}

	// Delete old refresh token (rotation)
	await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

	// Generate new access token
	const now = Math.floor(Date.now() / 1000);
	const accessToken = await sign(
		{
			sub: user.id,
			iat: now,
			exp: now + ACCESS_TOKEN_EXPIRES_IN,
		},
		JWT_SECRET,
	);

	// Generate new refresh token (rotation)
	const newRefreshToken = generateRefreshToken();
	const newTokenHash = hashToken(newRefreshToken);
	const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

	await db.insert(refreshTokens).values({
		userId: user.id,
		tokenHash: newTokenHash,
		expiresAt,
	});

	return c.json({
		accessToken,
		refreshToken: newRefreshToken,
		user: {
			id: user.id,
			username: user.username,
		},
	});
});

export { auth };
