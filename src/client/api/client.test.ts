/**
 * @vitest-environment jsdom
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import {
	ApiClient,
	ApiClientError,
	type LoginResponse,
	localStorageTokenStorage,
	type TokenStorage,
	type User,
} from "./client";

function createMockTokenStorage(): TokenStorage & {
	getTokens: Mock;
	setTokens: Mock;
	clearTokens: Mock;
} {
	return {
		getTokens: vi.fn(),
		setTokens: vi.fn(),
		clearTokens: vi.fn(),
	};
}

function mockFetch(responses: Array<{ status: number; body?: unknown }>) {
	let callIndex = 0;
	return vi.fn(async () => {
		const response = responses[callIndex++];
		if (!response) {
			throw new Error("Unexpected fetch call");
		}
		return {
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			json: async () => response.body,
		};
	}) as Mock;
}

describe("ApiClient", () => {
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	describe("login", () => {
		it("sends login request and stores tokens", async () => {
			const mockStorage = createMockTokenStorage();
			const client = new ApiClient({ tokenStorage: mockStorage });

			const responseBody = {
				accessToken: "access-token",
				refreshToken: "refresh-token",
				user: { id: "123", username: "testuser" },
			};
			global.fetch = mockFetch([{ status: 200, body: responseBody }]);

			const result = await client.login("testuser", "password123");

			expect(result).toEqual(responseBody);
			expect(mockStorage.setTokens).toHaveBeenCalledWith({
				accessToken: "access-token",
				refreshToken: "refresh-token",
			});
		});

		it("throws ApiClientError on invalid credentials", async () => {
			const mockStorage = createMockTokenStorage();
			const client = new ApiClient({ tokenStorage: mockStorage });

			global.fetch = mockFetch([
				{
					status: 401,
					body: {
						error: {
							message: "Invalid username or password",
							code: "INVALID_CREDENTIALS",
						},
					},
				},
			]);

			try {
				await client.login("testuser", "wrongpassword");
				expect.fail("Expected ApiClientError to be thrown");
			} catch (e) {
				expect(e).toBeInstanceOf(ApiClientError);
				const error = e as ApiClientError;
				expect(error.message).toBe("Invalid username or password");
				expect(error.status).toBe(401);
				expect(error.code).toBe("INVALID_CREDENTIALS");
			}
		});
	});

	describe("logout", () => {
		it("clears tokens from storage", () => {
			const mockStorage = createMockTokenStorage();
			const client = new ApiClient({ tokenStorage: mockStorage });

			client.logout();

			expect(mockStorage.clearTokens).toHaveBeenCalled();
		});
	});

	describe("isAuthenticated", () => {
		it("returns true when tokens exist", () => {
			const mockStorage = createMockTokenStorage();
			mockStorage.getTokens.mockReturnValue({
				accessToken: "token",
				refreshToken: "refresh",
			});
			const client = new ApiClient({ tokenStorage: mockStorage });

			expect(client.isAuthenticated()).toBe(true);
		});

		it("returns false when no tokens", () => {
			const mockStorage = createMockTokenStorage();
			mockStorage.getTokens.mockReturnValue(null);
			const client = new ApiClient({ tokenStorage: mockStorage });

			expect(client.isAuthenticated()).toBe(false);
		});
	});

	describe("getAuthHeader", () => {
		it("returns auth header when tokens exist", () => {
			const mockStorage = createMockTokenStorage();
			mockStorage.getTokens.mockReturnValue({
				accessToken: "my-access-token",
				refreshToken: "my-refresh-token",
			});
			const client = new ApiClient({ tokenStorage: mockStorage });

			expect(client.getAuthHeader()).toEqual({
				Authorization: "Bearer my-access-token",
			});
		});

		it("returns undefined when no tokens", () => {
			const mockStorage = createMockTokenStorage();
			mockStorage.getTokens.mockReturnValue(null);
			const client = new ApiClient({ tokenStorage: mockStorage });

			expect(client.getAuthHeader()).toBeUndefined();
		});
	});

	describe("rpc client", () => {
		it("exposes typed RPC client", () => {
			const mockStorage = createMockTokenStorage();
			const client = new ApiClient({ tokenStorage: mockStorage });

			// RPC client should have auth routes
			expect(client.rpc.api.auth.login).toBeDefined();
			expect(client.rpc.api.auth.refresh).toBeDefined();
		});
	});
});

describe("localStorageTokenStorage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("stores and retrieves tokens", () => {
		const tokens = { accessToken: "access", refreshToken: "refresh" };
		localStorageTokenStorage.setTokens(tokens);

		const retrieved = localStorageTokenStorage.getTokens();
		expect(retrieved).toEqual(tokens);
	});

	it("returns null when no tokens stored", () => {
		expect(localStorageTokenStorage.getTokens()).toBeNull();
	});

	it("clears tokens", () => {
		localStorageTokenStorage.setTokens({
			accessToken: "a",
			refreshToken: "r",
		});
		localStorageTokenStorage.clearTokens();

		expect(localStorageTokenStorage.getTokens()).toBeNull();
	});

	it("returns null on invalid JSON", () => {
		localStorage.setItem("kioku_tokens", "not-valid-json");
		expect(localStorageTokenStorage.getTokens()).toBeNull();
	});
});

describe("InferResponseType types", () => {
	it("LoginResponse has expected properties", () => {
		// This test verifies the inferred types have the correct structure
		// The type assertions will fail at compile time if the types are wrong
		const mockResponse: LoginResponse = {
			accessToken: "access-token",
			refreshToken: "refresh-token",
			user: { id: "123", username: "testuser" },
		};

		expect(mockResponse.accessToken).toBe("access-token");
		expect(mockResponse.refreshToken).toBe("refresh-token");
		expect(mockResponse.user.id).toBe("123");
		expect(mockResponse.user.username).toBe("testuser");
	});

	it("User type is correctly derived from LoginResponse", () => {
		// Verify User type has expected structure
		const user: User = {
			id: "user-1",
			username: "testuser",
		};

		expect(user.id).toBe("user-1");
		expect(user.username).toBe("testuser");
	});
});
