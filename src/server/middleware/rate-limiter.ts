import { rateLimiter } from "hono-rate-limiter";

/**
 * Rate limiter for login endpoint to prevent brute force attacks.
 * Limits to 5 login attempts per minute per IP address.
 */
export const loginRateLimiter = rateLimiter({
	windowMs: 60 * 1000, // 1 minute
	limit: 5, // 5 requests per window
	keyGenerator: (c) =>
		c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown",
	message: {
		error: {
			message: "Too many login attempts, please try again later",
			code: "RATE_LIMIT_EXCEEDED",
		},
	},
});
