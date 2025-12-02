import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware";
import { auth } from "./auth";

vi.mock("../db", () => {
	const mockUsers: Array<{
		id: string;
		username: string;
		passwordHash: string;
		createdAt: Date;
	}> = [];

	return {
		db: {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve(
								mockUsers.filter((u) => u.username === "existinguser"),
							),
						),
					})),
				})),
			})),
			insert: vi.fn(() => ({
				values: vi.fn((data: { username: string; passwordHash: string }) => ({
					returning: vi.fn(() => {
						const newUser = {
							id: "test-uuid-123",
							username: data.username,
							createdAt: new Date("2024-01-01T00:00:00Z"),
						};
						mockUsers.push({ ...newUser, passwordHash: data.passwordHash });
						return Promise.resolve([newUser]);
					}),
				})),
			})),
		},
		users: {
			id: "id",
			username: "username",
			createdAt: "created_at",
		},
	};
});

vi.mock("argon2", () => ({
	hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
}));

interface RegisterResponse {
	user?: {
		id: string;
		username: string;
		createdAt: string;
	};
	error?: {
		code: string;
		message: string;
	};
}

describe("POST /register", () => {
	let app: Hono;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/auth", auth);
	});

	it("creates a new user with valid credentials", async () => {
		const res = await app.request("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "testuser",
				password: "securepassword12345",
			}),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as RegisterResponse;
		expect(body.user).toEqual({
			id: "test-uuid-123",
			username: "testuser",
			createdAt: "2024-01-01T00:00:00.000Z",
		});
	});

	it("returns 422 for invalid username", async () => {
		const res = await app.request("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "",
				password: "securepassword12345",
			}),
		});

		expect(res.status).toBe(422);
		const body = (await res.json()) as RegisterResponse;
		expect(body.error?.code).toBe("VALIDATION_ERROR");
	});

	it("returns 422 for password too short", async () => {
		const res = await app.request("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "testuser",
				password: "tooshort123456",
			}),
		});

		expect(res.status).toBe(422);
		const body = (await res.json()) as RegisterResponse;
		expect(body.error?.code).toBe("VALIDATION_ERROR");
	});

	it("returns 409 for existing username", async () => {
		const { db } = await import("../db");
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([{ id: "existing-id" }]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		const res = await app.request("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "existinguser",
				password: "securepassword12345",
			}),
		});

		expect(res.status).toBe(409);
		const body = (await res.json()) as RegisterResponse;
		expect(body.error?.code).toBe("USERNAME_EXISTS");
	});
});
