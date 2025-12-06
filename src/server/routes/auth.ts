import { createHash, randomBytes } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import * as argon2 from "argon2";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { Errors } from "../middleware/index.js";
import {
	type RefreshTokenRepository,
	refreshTokenRepository,
	type UserRepository,
	userRepository,
} from "../repositories/index.js";
import {
	createUserSchema,
	loginSchema,
	refreshTokenSchema,
} from "../schemas/index.js";

function getJwtSecret(): string {
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		throw new Error("JWT_SECRET environment variable is required");
	}
	return secret;
}
const ACCESS_TOKEN_EXPIRES_IN = 60 * 15; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days

function generateRefreshToken(): string {
	return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export interface AuthDependencies {
	userRepo: UserRepository;
	refreshTokenRepo: RefreshTokenRepository;
}

export function createAuthRouter(deps: AuthDependencies) {
	const { userRepo, refreshTokenRepo } = deps;

	return new Hono()
		.post("/register", zValidator("json", createUserSchema), async (c) => {
			const { username, password } = c.req.valid("json");

			// Check if username already exists
			const exists = await userRepo.existsByUsername(username);
			if (exists) {
				throw Errors.conflict("Username already exists", "USERNAME_EXISTS");
			}

			// Hash password with Argon2
			const passwordHash = await argon2.hash(password);

			// Create user
			const newUser = await userRepo.create({ username, passwordHash });

			return c.json({ user: newUser }, 201);
		})
		.post("/login", zValidator("json", loginSchema), async (c) => {
			const { username, password } = c.req.valid("json");

			// Find user by username
			const user = await userRepo.findByUsername(username);

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
				getJwtSecret(),
			);

			// Generate refresh token
			const refreshToken = generateRefreshToken();
			const tokenHash = hashToken(refreshToken);
			const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

			// Store refresh token in database
			await refreshTokenRepo.create({
				userId: user.id,
				tokenHash,
				expiresAt,
			});

			return c.json(
				{
					accessToken,
					refreshToken,
					user: {
						id: user.id,
						username: user.username,
					},
				},
				200,
			);
		})
		.post("/refresh", zValidator("json", refreshTokenSchema), async (c) => {
			const { refreshToken } = c.req.valid("json");
			const tokenHash = hashToken(refreshToken);

			// Find valid refresh token
			const storedToken = await refreshTokenRepo.findValidToken(tokenHash);

			if (!storedToken) {
				throw Errors.unauthorized(
					"Invalid or expired refresh token",
					"INVALID_REFRESH_TOKEN",
				);
			}

			// Get user info
			const user = await userRepo.findById(storedToken.userId);

			if (!user) {
				throw Errors.unauthorized("User not found", "USER_NOT_FOUND");
			}

			// Delete old refresh token (rotation)
			await refreshTokenRepo.deleteById(storedToken.id);

			// Generate new access token
			const now = Math.floor(Date.now() / 1000);
			const accessToken = await sign(
				{
					sub: user.id,
					iat: now,
					exp: now + ACCESS_TOKEN_EXPIRES_IN,
				},
				getJwtSecret(),
			);

			// Generate new refresh token (rotation)
			const newRefreshToken = generateRefreshToken();
			const newTokenHash = hashToken(newRefreshToken);
			const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

			await refreshTokenRepo.create({
				userId: user.id,
				tokenHash: newTokenHash,
				expiresAt,
			});

			return c.json(
				{
					accessToken,
					refreshToken: newRefreshToken,
					user: {
						id: user.id,
						username: user.username,
					},
				},
				200,
			);
		});
}

// Default auth router with real repositories for production use
export const auth = createAuthRouter({
	userRepo: userRepository,
	refreshTokenRepo: refreshTokenRepository,
});
