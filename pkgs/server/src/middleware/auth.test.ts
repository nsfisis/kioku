import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it } from "vitest";
import { authMiddleware, getAuthUser } from "./auth";
import { errorHandler } from "./error-handler";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

interface ErrorResponse {
	error: {
		code: string;
		message: string;
	};
}

interface SuccessResponse {
	userId: string;
}

describe("authMiddleware", () => {
	let app: Hono;

	beforeEach(() => {
		app = new Hono();
		app.onError(errorHandler);
		app.use("/protected/*", authMiddleware);
		app.get("/protected/resource", (c) => {
			const user = getAuthUser(c);
			return c.json({ userId: user.id });
		});
	});

	it("allows access with valid token", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await sign(
			{
				sub: "user-123",
				iat: now,
				exp: now + 3600,
			},
			JWT_SECRET,
		);

		const res = await app.request("/protected/resource", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SuccessResponse;
		expect(body.userId).toBe("user-123");
	});

	it("returns 401 when Authorization header is missing", async () => {
		const res = await app.request("/protected/resource");

		expect(res.status).toBe(401);
		const body = (await res.json()) as ErrorResponse;
		expect(body.error.code).toBe("MISSING_AUTH");
	});

	it("returns 401 for invalid Authorization format", async () => {
		const res = await app.request("/protected/resource", {
			headers: {
				Authorization: "Basic sometoken",
			},
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as ErrorResponse;
		expect(body.error.code).toBe("INVALID_AUTH_FORMAT");
	});

	it("returns 401 for empty Bearer token", async () => {
		const res = await app.request("/protected/resource", {
			headers: {
				Authorization: "Bearer",
			},
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as ErrorResponse;
		expect(body.error.code).toBe("INVALID_AUTH_FORMAT");
	});

	it("returns 401 for expired token", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await sign(
			{
				sub: "user-123",
				iat: now - 7200,
				exp: now - 3600, // expired 1 hour ago
			},
			JWT_SECRET,
		);

		const res = await app.request("/protected/resource", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as ErrorResponse;
		expect(body.error.code).toBe("INVALID_TOKEN");
	});

	it("returns 401 for invalid token", async () => {
		const res = await app.request("/protected/resource", {
			headers: {
				Authorization: "Bearer invalid.token.here",
			},
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as ErrorResponse;
		expect(body.error.code).toBe("INVALID_TOKEN");
	});

	it("returns 401 for token signed with wrong secret", async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await sign(
			{
				sub: "user-123",
				iat: now,
				exp: now + 3600,
			},
			"wrong-secret",
		);

		const res = await app.request("/protected/resource", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as ErrorResponse;
		expect(body.error.code).toBe("INVALID_TOKEN");
	});
});

describe("getAuthUser", () => {
	it("returns user from context when authenticated", async () => {
		const app = new Hono();
		app.onError(errorHandler);
		app.use("/test", authMiddleware);
		app.get("/test", (c) => {
			const user = getAuthUser(c);
			return c.json({ id: user.id });
		});

		const now = Math.floor(Date.now() / 1000);
		const token = await sign(
			{
				sub: "test-user-456",
				iat: now,
				exp: now + 3600,
			},
			JWT_SECRET,
		);

		const res = await app.request("/test", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { id: string };
		expect(body.id).toBe("test-user-456");
	});

	it("throws when user is not in context", async () => {
		const app = new Hono();
		app.onError(errorHandler);
		// Note: no authMiddleware applied
		app.get("/unprotected", (c) => {
			const user = getAuthUser(c);
			return c.json({ id: user.id });
		});

		const res = await app.request("/unprotected");

		expect(res.status).toBe(401);
		const body = (await res.json()) as ErrorResponse;
		expect(body.error.code).toBe("NOT_AUTHENTICATED");
	});
});
