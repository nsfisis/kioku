/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { authLoadingAtom, userAtom } from "../atoms";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
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

function renderWithProvider(
	path: string,
	atomValues: { isAuthenticated: boolean; isLoading: boolean },
) {
	const { hook } = memoryLocation({ path });
	const store = createStore();
	store.set(authLoadingAtom, atomValues.isLoading);
	store.set(
		userAtom,
		atomValues.isAuthenticated ? { id: "u1", username: "tester" } : null,
	);

	return render(
		<Provider store={store}>
			<Router hook={hook}>
				<ProtectedRoute>
					<div data-testid="protected-content">Protected Content</div>
				</ProtectedRoute>
			</Router>
		</Provider>,
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
		renderWithProvider("/", { isAuthenticated: false, isLoading: true });

		expect(screen.queryByTestId("protected-content")).toBeNull();
		// Loading spinner should be visible
		expect(screen.getByRole("status")).toBeDefined();
	});

	it("renders children when authenticated", () => {
		renderWithProvider("/", { isAuthenticated: true, isLoading: false });

		expect(screen.getByTestId("protected-content")).toBeDefined();
		expect(screen.getByText("Protected Content")).toBeDefined();
	});

	it("redirects to login when not authenticated", () => {
		renderWithProvider("/", { isAuthenticated: false, isLoading: false });

		// Should not show protected content
		expect(screen.queryByTestId("protected-content")).toBeNull();
	});
});
