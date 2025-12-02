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
			delete: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve(undefined)),
			})),
		},
		users: {
			id: "id",
			username: "username",
			createdAt: "created_at",
		},
		refreshTokens: {
			id: "id",
			userId: "user_id",
			tokenHash: "token_hash",
			expiresAt: "expires_at",
			createdAt: "created_at",
		},
	};
});

vi.mock("argon2", () => ({
	hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
	verify: vi.fn((hash: string, password: string) =>
		Promise.resolve(hash === `hashed_${password}`),
	),
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

interface LoginResponse {
	accessToken?: string;
	refreshToken?: string;
	user?: {
		id: string;
		username: string;
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

describe("POST /login", () => {
	let app: Hono;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/auth", auth);
	});

	it("returns access token for valid credentials", async () => {
		const { db } = await import("../db");
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([
						{
							id: "user-uuid-123",
							username: "testuser",
							passwordHash: "hashed_correctpassword",
						},
					]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		// Mock the insert call for refresh token
		vi.mocked(db.insert).mockReturnValueOnce({
			values: vi.fn().mockResolvedValue(undefined),
		} as unknown as ReturnType<typeof db.insert>);

		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "testuser",
				password: "correctpassword",
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as LoginResponse;
		expect(body.accessToken).toBeDefined();
		expect(typeof body.accessToken).toBe("string");
		expect(body.refreshToken).toBeDefined();
		expect(typeof body.refreshToken).toBe("string");
		expect(body.user).toEqual({
			id: "user-uuid-123",
			username: "testuser",
		});
	});

	it("returns 401 for non-existent user", async () => {
		const { db } = await import("../db");
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "nonexistent",
				password: "anypassword",
			}),
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as LoginResponse;
		expect(body.error?.code).toBe("INVALID_CREDENTIALS");
	});

	it("returns 401 for incorrect password", async () => {
		const { db } = await import("../db");
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([
						{
							id: "user-uuid-123",
							username: "testuser",
							passwordHash: "hashed_correctpassword",
						},
					]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "testuser",
				password: "wrongpassword",
			}),
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as LoginResponse;
		expect(body.error?.code).toBe("INVALID_CREDENTIALS");
	});

	it("returns 422 for missing username", async () => {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "",
				password: "somepassword",
			}),
		});

		expect(res.status).toBe(422);
		const body = (await res.json()) as LoginResponse;
		expect(body.error?.code).toBe("VALIDATION_ERROR");
	});

	it("returns 422 for missing password", async () => {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "testuser",
				password: "",
			}),
		});

		expect(res.status).toBe(422);
		const body = (await res.json()) as LoginResponse;
		expect(body.error?.code).toBe("VALIDATION_ERROR");
	});
});

interface RefreshResponse {
	accessToken?: string;
	refreshToken?: string;
	user?: {
		id: string;
		username: string;
	};
	error?: {
		code: string;
		message: string;
	};
}

describe("POST /refresh", () => {
	let app: Hono;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/auth", auth);
	});

	it("returns new tokens for valid refresh token", async () => {
		const { db } = await import("../db");

		// Mock finding valid refresh token
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([
						{
							id: "token-id-123",
							userId: "user-uuid-123",
							expiresAt: new Date(Date.now() + 86400000), // expires in 1 day
						},
					]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		// Mock finding user
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([
						{
							id: "user-uuid-123",
							username: "testuser",
						},
					]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		// Mock delete old token
		vi.mocked(db.delete).mockReturnValueOnce({
			where: vi.fn().mockResolvedValue(undefined),
		} as unknown as ReturnType<typeof db.delete>);

		// Mock insert new token
		vi.mocked(db.insert).mockReturnValueOnce({
			values: vi.fn().mockResolvedValue(undefined),
		} as unknown as ReturnType<typeof db.insert>);

		const res = await app.request("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				refreshToken: "valid-refresh-token-hex",
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as RefreshResponse;
		expect(body.accessToken).toBeDefined();
		expect(typeof body.accessToken).toBe("string");
		expect(body.refreshToken).toBeDefined();
		expect(typeof body.refreshToken).toBe("string");
		expect(body.user).toEqual({
			id: "user-uuid-123",
			username: "testuser",
		});
	});

	it("returns 401 for invalid refresh token", async () => {
		const { db } = await import("../db");

		// Mock no token found
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		const res = await app.request("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				refreshToken: "invalid-refresh-token",
			}),
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as RefreshResponse;
		expect(body.error?.code).toBe("INVALID_REFRESH_TOKEN");
	});

	it("returns 401 for expired refresh token", async () => {
		const { db } = await import("../db");

		// Mock no valid (non-expired) token found (empty result because expiry check in query)
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		const res = await app.request("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				refreshToken: "expired-refresh-token",
			}),
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as RefreshResponse;
		expect(body.error?.code).toBe("INVALID_REFRESH_TOKEN");
	});

	it("returns 401 when user not found", async () => {
		const { db } = await import("../db");

		// Mock finding valid refresh token
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([
						{
							id: "token-id-123",
							userId: "deleted-user-id",
							expiresAt: new Date(Date.now() + 86400000),
						},
					]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		// Mock user not found
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([]),
				}),
			}),
		} as unknown as ReturnType<typeof db.select>);

		const res = await app.request("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				refreshToken: "valid-refresh-token",
			}),
		});

		expect(res.status).toBe(401);
		const body = (await res.json()) as RefreshResponse;
		expect(body.error?.code).toBe("USER_NOT_FOUND");
	});

	it("returns 422 for missing refresh token", async () => {
		const res = await app.request("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(422);
		const body = (await res.json()) as RefreshResponse;
		expect(body.error?.code).toBe("VALIDATION_ERROR");
	});

	it("returns 422 for empty refresh token", async () => {
		const res = await app.request("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				refreshToken: "",
			}),
		});

		expect(res.status).toBe(422);
		const body = (await res.json()) as RefreshResponse;
		expect(body.error?.code).toBe("VALIDATION_ERROR");
	});
});
