import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import type {
	RefreshTokenRepository,
	UserRepository,
} from "../repositories/index.js";
import { createAuthRouter } from "./auth.js";

vi.mock("argon2", () => ({
	hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
	verify: vi.fn((hash: string, password: string) =>
		Promise.resolve(hash === `hashed_${password}`),
	),
}));

function createMockUserRepo(): UserRepository {
	return {
		findByUsername: vi.fn(),
		existsByUsername: vi.fn(),
		create: vi.fn(),
		findById: vi.fn(),
	};
}

function createMockRefreshTokenRepo(): RefreshTokenRepository {
	return {
		findValidToken: vi.fn(),
		create: vi.fn(),
		deleteById: vi.fn(),
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

describe("POST /login", () => {
	let app: Hono;
	let mockUserRepo: ReturnType<typeof createMockUserRepo>;
	let mockRefreshTokenRepo: ReturnType<typeof createMockRefreshTokenRepo>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockUserRepo = createMockUserRepo();
		mockRefreshTokenRepo = createMockRefreshTokenRepo();
		const auth = createAuthRouter({
			userRepo: mockUserRepo,
			refreshTokenRepo: mockRefreshTokenRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/auth", auth);
	});

	it("returns access token for valid credentials", async () => {
		vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
			id: "user-uuid-123",
			username: "testuser",
			passwordHash: "hashed_correctpassword",
		});
		vi.mocked(mockRefreshTokenRepo.create).mockResolvedValue(undefined);

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
		expect(mockRefreshTokenRepo.create).toHaveBeenCalledWith({
			userId: "user-uuid-123",
			tokenHash: expect.any(String),
			expiresAt: expect.any(Date),
		});
	});

	it("returns 401 for non-existent user", async () => {
		vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(undefined);

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
		vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
			id: "user-uuid-123",
			username: "testuser",
			passwordHash: "hashed_correctpassword",
		});

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

	it("returns 400 for missing username", async () => {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "",
				password: "somepassword",
			}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for missing password", async () => {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "testuser",
				password: "",
			}),
		});

		expect(res.status).toBe(400);
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
	let mockUserRepo: ReturnType<typeof createMockUserRepo>;
	let mockRefreshTokenRepo: ReturnType<typeof createMockRefreshTokenRepo>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockUserRepo = createMockUserRepo();
		mockRefreshTokenRepo = createMockRefreshTokenRepo();
		const auth = createAuthRouter({
			userRepo: mockUserRepo,
			refreshTokenRepo: mockRefreshTokenRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/auth", auth);
	});

	it("returns new tokens for valid refresh token", async () => {
		vi.mocked(mockRefreshTokenRepo.findValidToken).mockResolvedValue({
			id: "token-id-123",
			userId: "user-uuid-123",
			expiresAt: new Date(Date.now() + 86400000),
		});
		vi.mocked(mockUserRepo.findById).mockResolvedValue({
			id: "user-uuid-123",
			username: "testuser",
		});
		vi.mocked(mockRefreshTokenRepo.deleteById).mockResolvedValue(undefined);
		vi.mocked(mockRefreshTokenRepo.create).mockResolvedValue(undefined);

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
		expect(mockRefreshTokenRepo.deleteById).toHaveBeenCalledWith(
			"token-id-123",
		);
		expect(mockRefreshTokenRepo.create).toHaveBeenCalledWith({
			userId: "user-uuid-123",
			tokenHash: expect.any(String),
			expiresAt: expect.any(Date),
		});
	});

	it("returns 401 for invalid refresh token", async () => {
		vi.mocked(mockRefreshTokenRepo.findValidToken).mockResolvedValue(undefined);

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
		vi.mocked(mockRefreshTokenRepo.findValidToken).mockResolvedValue(undefined);

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
		vi.mocked(mockRefreshTokenRepo.findValidToken).mockResolvedValue({
			id: "token-id-123",
			userId: "deleted-user-id",
			expiresAt: new Date(Date.now() + 86400000),
		});
		vi.mocked(mockUserRepo.findById).mockResolvedValue(undefined);

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

	it("returns 400 for missing refresh token", async () => {
		const res = await app.request("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for empty refresh token", async () => {
		const res = await app.request("/api/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				refreshToken: "",
			}),
		});

		expect(res.status).toBe(400);
	});
});
