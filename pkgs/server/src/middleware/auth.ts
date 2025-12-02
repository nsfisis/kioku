import type { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { Errors } from "./error-handler";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
	throw new Error("JWT_SECRET environment variable is required");
}

export interface AuthUser {
	id: string;
}

interface JWTPayload {
	sub: string;
	iat: number;
	exp: number;
}

/**
 * Auth middleware that validates JWT tokens from Authorization header
 * Sets the authenticated user in context variables
 */
export async function authMiddleware(c: Context, next: Next) {
	const authHeader = c.req.header("Authorization");

	if (!authHeader) {
		throw Errors.unauthorized("Missing Authorization header", "MISSING_AUTH");
	}

	if (!authHeader.startsWith("Bearer ")) {
		throw Errors.unauthorized(
			"Invalid Authorization header format",
			"INVALID_AUTH_FORMAT",
		);
	}

	const token = authHeader.slice(7);

	try {
		const payload = (await verify(token, JWT_SECRET)) as unknown as JWTPayload;

		const user: AuthUser = {
			id: payload.sub,
		};

		c.set("user", user);

		await next();
	} catch {
		throw Errors.unauthorized("Invalid or expired token", "INVALID_TOKEN");
	}
}

/**
 * Helper function to get the authenticated user from context
 * Throws if user is not authenticated
 */
export function getAuthUser(c: Context): AuthUser {
	const user = c.get("user") as AuthUser | undefined;
	if (!user) {
		throw Errors.unauthorized("Not authenticated", "NOT_AUTHENTICATED");
	}
	return user;
}
