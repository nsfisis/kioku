/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "./App";
import { apiClient } from "./api/client";
import { AuthProvider, SyncProvider } from "./stores";

vi.mock("./api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		isAuthenticated: vi.fn(),
		getTokens: vi.fn(),
		getAuthHeader: vi.fn(),
		rpc: {
			api: {
				decks: {
					$get: vi.fn(),
				},
			},
		},
	},
	ApiClientError: class ApiClientError extends Error {
		constructor(
			message: string,
			public status: number,
			public code?: string,
		) {
			super(message);
			this.name = "ApiClientError";
		}
	},
}));

// Helper to create mock responses compatible with Hono's ClientResponse
function mockResponse(data: {
	ok: boolean;
	status?: number;
	// biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexible typing
	json: () => Promise<any>;
}) {
	return data as unknown as Awaited<
		ReturnType<typeof apiClient.rpc.api.decks.$get>
	>;
}

function renderWithRouter(path: string) {
	const { hook } = memoryLocation({ path, static: true });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<SyncProvider>
					<App />
				</SyncProvider>
			</AuthProvider>
		</Router>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(apiClient.getTokens).mockReturnValue(null);
	vi.mocked(apiClient.isAuthenticated).mockReturnValue(false);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("App routing", () => {
	describe("when authenticated", () => {
		beforeEach(() => {
			vi.mocked(apiClient.getTokens).mockReturnValue({
				accessToken: "access-token",
				refreshToken: "refresh-token",
			});
			vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);
			vi.mocked(apiClient.getAuthHeader).mockReturnValue({
				Authorization: "Bearer access-token",
			});
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: [] }),
				}),
			);
		});

		it("renders home page at /", () => {
			renderWithRouter("/");
			expect(screen.getByRole("heading", { name: "Kioku" })).toBeDefined();
			expect(screen.getByRole("heading", { name: "Your Decks" })).toBeDefined();
		});
	});

	describe("when not authenticated", () => {
		beforeEach(() => {
			vi.mocked(apiClient.getTokens).mockReturnValue(null);
			vi.mocked(apiClient.isAuthenticated).mockReturnValue(false);
		});

		it("redirects to login when accessing / without authentication", () => {
			renderWithRouter("/");
			// Should not render home page content
			expect(screen.queryByRole("heading", { name: "Kioku" })).toBeNull();
		});
	});

	it("renders login page at /login", () => {
		renderWithRouter("/login");
		expect(screen.getByRole("heading", { name: "Kioku" })).toBeDefined();
		expect(screen.getByRole("heading", { name: "Welcome back" })).toBeDefined();
	});

	it("renders 404 page for unknown routes", () => {
		renderWithRouter("/unknown-route");
		expect(screen.getByRole("heading", { name: "404" })).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Page Not Found" }),
		).toBeDefined();
		expect(screen.getByRole("link", { name: /Go Home/i })).toBeDefined();
	});
});
