/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "./App";
import { apiClient } from "./api/client";
import { AuthProvider } from "./stores";

vi.mock("./api/client", () => ({
	apiClient: {
		login: vi.fn(),
		register: vi.fn(),
		logout: vi.fn(),
		isAuthenticated: vi.fn(),
		getTokens: vi.fn(),
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

function renderWithRouter(path: string) {
	const { hook } = memoryLocation({ path, static: true });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<App />
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
		});

		it("renders home page at /", () => {
			renderWithRouter("/");
			expect(screen.getByRole("heading", { name: "Kioku" })).toBeDefined();
			expect(screen.getByText("Spaced repetition learning app")).toBeDefined();
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
		expect(screen.getByRole("heading", { name: "Login" })).toBeDefined();
	});

	it("renders register page at /register", () => {
		renderWithRouter("/register");
		expect(screen.getByRole("heading", { name: "Register" })).toBeDefined();
	});

	it("renders 404 page for unknown routes", () => {
		renderWithRouter("/unknown-route");
		expect(
			screen.getByRole("heading", { name: "404 - Not Found" }),
		).toBeDefined();
		expect(screen.getByRole("link", { name: "Go to Home" })).toBeDefined();
	});
});
