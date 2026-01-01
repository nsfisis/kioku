import { hc, type InferResponseType } from "hono/client";
import type { AppType } from "../../server/index.js";
import type { ApiError, Tokens } from "./types";

// Create a temporary client just for type inference
const _rpc = hc<AppType>("");

// Infer response types from server definitions
export type LoginResponse = InferResponseType<typeof _rpc.api.auth.login.$post>;
export type User = LoginResponse["user"];

export class ApiClientError extends Error {
	constructor(
		message: string,
		public status: number,
		public code?: string,
	) {
		super(message);
		this.name = "ApiClientError";
	}
}

export interface TokenStorage {
	getTokens(): Tokens | null;
	setTokens(tokens: Tokens): void;
	clearTokens(): void;
}

const TOKEN_STORAGE_KEY = "kioku_tokens";

export const localStorageTokenStorage: TokenStorage = {
	getTokens(): Tokens | null {
		const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
		if (!stored) return null;
		try {
			return JSON.parse(stored) as Tokens;
		} catch {
			return null;
		}
	},
	setTokens(tokens: Tokens): void {
		localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
	},
	clearTokens(): void {
		localStorage.removeItem(TOKEN_STORAGE_KEY);
	},
};

export interface ApiClientOptions {
	baseUrl?: string;
	tokenStorage?: TokenStorage;
}

// RPC client type - use this for type-safe API calls
export type Client = ReturnType<typeof hc<AppType>>;

export function createClient(baseUrl: string): Client {
	return hc<AppType>(baseUrl);
}

export class ApiClient {
	private tokenStorage: TokenStorage;
	private refreshPromise: Promise<boolean> | null = null;
	private baseUrl: string;
	public readonly rpc: Client;

	constructor(options: ApiClientOptions = {}) {
		this.baseUrl = options.baseUrl ?? window.location.origin;
		this.tokenStorage = options.tokenStorage ?? localStorageTokenStorage;
		this.rpc = this.createAuthenticatedClient();
	}

	private createAuthenticatedClient(): Client {
		return hc<AppType>(this.baseUrl, {
			fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
				return this.authenticatedFetch(input, init);
			},
		});
	}

	async authenticatedFetch(
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> {
		const tokens = this.tokenStorage.getTokens();
		const headers = new Headers(init?.headers);

		if (tokens?.accessToken && !headers.has("Authorization")) {
			headers.set("Authorization", `Bearer ${tokens.accessToken}`);
		}

		const response = await fetch(input, { ...init, headers });

		if (response.status === 401 && tokens?.refreshToken) {
			// Try to refresh the token
			const refreshed = await this.refreshToken();
			if (refreshed) {
				// Retry with new token
				const newTokens = this.tokenStorage.getTokens();
				if (newTokens?.accessToken) {
					headers.set("Authorization", `Bearer ${newTokens.accessToken}`);
				}
				return fetch(input, { ...init, headers });
			}
		}

		return response;
	}

	private async handleResponse<T>(response: Response): Promise<T> {
		if (!response.ok) {
			const errorBody = (await response.json().catch(() => ({}))) as ApiError;
			throw new ApiClientError(
				errorBody.error?.message ||
					`Request failed with status ${response.status}`,
				response.status,
				errorBody.error?.code,
			);
		}

		if (response.status === 204) {
			return undefined as T;
		}

		return response.json() as Promise<T>;
	}

	private async refreshToken(): Promise<boolean> {
		if (this.refreshPromise) {
			return this.refreshPromise;
		}

		this.refreshPromise = this.doRefreshToken();

		try {
			return await this.refreshPromise;
		} finally {
			this.refreshPromise = null;
		}
	}

	private async doRefreshToken(): Promise<boolean> {
		const tokens = this.tokenStorage.getTokens();
		if (!tokens?.refreshToken) {
			return false;
		}

		try {
			// Use raw fetch to avoid infinite loop through authenticatedFetch
			const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ refreshToken: tokens.refreshToken }),
			});

			if (!res.ok) {
				// Clear tokens if refresh fails
				this.tokenStorage.clearTokens();
				return false;
			}

			const data = (await res.json()) as {
				accessToken: string;
				refreshToken: string;
			};
			this.tokenStorage.setTokens({
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
			});
			return true;
		} catch {
			return false;
		}
	}

	async login(username: string, password: string): Promise<LoginResponse> {
		const res = await this.rpc.api.auth.login.$post({
			json: { username, password },
		});

		const data = await this.handleResponse<LoginResponse>(res);

		this.tokenStorage.setTokens({
			accessToken: data.accessToken,
			refreshToken: data.refreshToken,
		});

		return data;
	}

	logout(): void {
		this.tokenStorage.clearTokens();
	}

	isAuthenticated(): boolean {
		return this.tokenStorage.getTokens() !== null;
	}

	getTokens(): Tokens | null {
		return this.tokenStorage.getTokens();
	}

	getAuthHeader(): { Authorization: string } | undefined {
		const tokens = this.tokenStorage.getTokens();
		if (tokens?.accessToken) {
			return { Authorization: `Bearer ${tokens.accessToken}` };
		}
		return undefined;
	}
}

export const apiClient = new ApiClient();
