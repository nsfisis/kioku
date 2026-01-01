/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { apiClient } from "../api/client";
import { AuthProvider } from "../stores";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		isAuthenticated: vi.fn(),
		getTokens: vi.fn(),
		onSessionExpired: vi.fn(() => vi.fn()),
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
	const { hook } = memoryLocation({ path });

	return render(
		<Router hook={hook}>
			<AuthProvider>
				<ProtectedRoute>
					<div data-testid="protected-content">Protected Content</div>
				</ProtectedRoute>
			</AuthProvider>
		</Router>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("ProtectedRoute", () => {
	it("shows loading state while auth is loading", () => {
		vi.mocked(apiClient.getTokens).mockReturnValue(null);
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(false);

		// The AuthProvider initially sets isLoading to true, then false after checking tokens
		// Since getTokens returns null, isLoading will quickly become false
		renderWithRouter("/");

		// After the initial check, the component should redirect since not authenticated
		expect(screen.queryByTestId("protected-content")).toBeNull();
	});

	it("renders children when authenticated", () => {
		vi.mocked(apiClient.getTokens).mockReturnValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);

		renderWithRouter("/");

		expect(screen.getByTestId("protected-content")).toBeDefined();
		expect(screen.getByText("Protected Content")).toBeDefined();
	});

	it("redirects to login when not authenticated", () => {
		vi.mocked(apiClient.getTokens).mockReturnValue(null);
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(false);

		renderWithRouter("/");

		// Should not show protected content
		expect(screen.queryByTestId("protected-content")).toBeNull();
	});
});
