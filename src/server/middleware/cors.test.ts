import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCorsMiddleware } from "./cors.js";

describe("createCorsMiddleware", () => {
	const originalEnv = process.env.CORS_ORIGIN;

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.CORS_ORIGIN;
		} else {
			process.env.CORS_ORIGIN = originalEnv;
		}
	});

	describe("when CORS_ORIGIN is not set", () => {
		beforeEach(() => {
			delete process.env.CORS_ORIGIN;
		});

		it("does not add CORS headers", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.get("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				headers: { Origin: "https://attacker.com" },
			});

			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("does not allow preflight requests", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.get("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				method: "OPTIONS",
				headers: {
					Origin: "https://attacker.com",
					"Access-Control-Request-Method": "POST",
				},
			});

			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});
	});

	describe("when CORS_ORIGIN is set to single origin", () => {
		beforeEach(() => {
			process.env.CORS_ORIGIN = "https://allowed.example.com";
		});

		it("allows requests from the configured origin", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.get("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				headers: { Origin: "https://allowed.example.com" },
			});

			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://allowed.example.com",
			);
		});

		it("does not allow requests from other origins", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.get("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				headers: { Origin: "https://attacker.com" },
			});

			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("handles preflight requests correctly", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.post("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				method: "OPTIONS",
				headers: {
					Origin: "https://allowed.example.com",
					"Access-Control-Request-Method": "POST",
				},
			});

			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://allowed.example.com",
			);
			expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
		});

		it("exposes rate limit headers", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.get("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				method: "OPTIONS",
				headers: {
					Origin: "https://allowed.example.com",
					"Access-Control-Request-Method": "GET",
				},
			});

			const exposeHeaders = res.headers.get("Access-Control-Expose-Headers");
			expect(exposeHeaders).toContain("RateLimit-Limit");
			expect(exposeHeaders).toContain("RateLimit-Remaining");
			expect(exposeHeaders).toContain("RateLimit-Reset");
		});
	});

	describe("when CORS_ORIGIN is set to multiple origins", () => {
		beforeEach(() => {
			process.env.CORS_ORIGIN =
				"https://app.example.com, https://admin.example.com";
		});

		it("allows requests from first configured origin", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.get("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				headers: { Origin: "https://app.example.com" },
			});

			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://app.example.com",
			);
		});

		it("allows requests from second configured origin", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.get("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				headers: { Origin: "https://admin.example.com" },
			});

			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://admin.example.com",
			);
		});

		it("does not allow requests from unlisted origins", async () => {
			const app = new Hono();
			app.use("*", createCorsMiddleware());
			app.get("/test", (c) => c.json({ ok: true }));

			const res = await app.request("/test", {
				headers: { Origin: "https://other.example.com" },
			});

			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});
	});
});
