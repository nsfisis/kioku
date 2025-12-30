import { cors } from "hono/cors";

/**
 * CORS middleware configuration.
 * Uses CORS_ORIGIN environment variable to configure allowed origins.
 * If not set, defaults to same-origin only (no CORS headers).
 *
 * Examples:
 * - CORS_ORIGIN=https://kioku.example.com (single origin)
 * - CORS_ORIGIN=https://example.com,https://app.example.com (multiple origins)
 */
function getAllowedOrigins(): string[] {
	const origins = process.env.CORS_ORIGIN;
	if (!origins) {
		return [];
	}
	return origins.split(",").map((o) => o.trim());
}

export function createCorsMiddleware() {
	const allowedOrigins = getAllowedOrigins();

	// If no origins configured, don't add CORS headers
	if (allowedOrigins.length === 0) {
		return cors({
			origin: () => "",
		});
	}

	return cors({
		origin: allowedOrigins,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		exposeHeaders: [
			"RateLimit-Limit",
			"RateLimit-Remaining",
			"RateLimit-Reset",
		],
		maxAge: 86400, // 24 hours
		credentials: true,
	});
}
