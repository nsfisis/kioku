import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { AppError, Errors, errorHandler } from "./error-handler.js";

function createTestApp() {
	const app = new Hono();
	app.onError(errorHandler);
	return app;
}

describe("errorHandler", () => {
	describe("AppError handling", () => {
		it("returns correct status and message for AppError", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw new AppError("Custom error", 400, "CUSTOM_ERROR");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({
				error: {
					message: "Custom error",
					code: "CUSTOM_ERROR",
				},
			});
		});

		it("uses default values for AppError", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw new AppError("Something went wrong");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(500);
			expect(await res.json()).toEqual({
				error: {
					message: "Something went wrong",
					code: "INTERNAL_ERROR",
				},
			});
		});
	});

	describe("Errors factory functions", () => {
		it("handles badRequest error", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw Errors.badRequest("Invalid input");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({
				error: {
					message: "Invalid input",
					code: "BAD_REQUEST",
				},
			});
		});

		it("handles unauthorized error", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw Errors.unauthorized();
			});

			const res = await app.request("/test");
			expect(res.status).toBe(401);
			expect(await res.json()).toEqual({
				error: {
					message: "Unauthorized",
					code: "UNAUTHORIZED",
				},
			});
		});

		it("handles forbidden error", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw Errors.forbidden("Access denied");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(403);
			expect(await res.json()).toEqual({
				error: {
					message: "Access denied",
					code: "FORBIDDEN",
				},
			});
		});

		it("handles notFound error", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw Errors.notFound("Resource not found");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({
				error: {
					message: "Resource not found",
					code: "NOT_FOUND",
				},
			});
		});

		it("handles conflict error", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw Errors.conflict("Already exists");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(409);
			expect(await res.json()).toEqual({
				error: {
					message: "Already exists",
					code: "CONFLICT",
				},
			});
		});

		it("handles validationError", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw Errors.validationError("Invalid data");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(422);
			expect(await res.json()).toEqual({
				error: {
					message: "Invalid data",
					code: "VALIDATION_ERROR",
				},
			});
		});

		it("handles internal error", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw Errors.internal("Database connection failed");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(500);
			expect(await res.json()).toEqual({
				error: {
					message: "Database connection failed",
					code: "INTERNAL_ERROR",
				},
			});
		});
	});

	describe("unknown error handling", () => {
		it("handles generic Error with 500 status", async () => {
			const app = createTestApp();
			app.get("/test", () => {
				throw new Error("Unexpected error");
			});

			const res = await app.request("/test");
			expect(res.status).toBe(500);
			const body = (await res.json()) as { error: { code: string } };
			expect(body.error.code).toBe("INTERNAL_ERROR");
		});
	});
});
