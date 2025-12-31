import { hc } from "hono/client";
import type { AppType } from "../../server/index.js";
import type { ApiError, AuthResponse, Tokens } from "./types";

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
	public readonly rpc: Client;

	constructor(options: ApiClientOptions = {}) {
		const baseUrl = options.baseUrl ?? window.location.origin;
		this.tokenStorage = options.tokenStorage ?? localStorageTokenStorage;
		this.rpc = createClient(baseUrl);
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
			const res = await this.rpc.api.auth.refresh.$post({
				json: { refreshToken: tokens.refreshToken },
			});

			if (!res.ok) {
				return false;
			}

			const data = await res.json();
			this.tokenStorage.setTokens({
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
			});
			return true;
		} catch {
			return false;
		}
	}

	async login(username: string, password: string): Promise<AuthResponse> {
		const res = await this.rpc.api.auth.login.$post({
			json: { username, password },
		});

		const data = await this.handleResponse<AuthResponse>(res);

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
