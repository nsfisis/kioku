/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { apiClient } from "../api/client";
import { AuthProvider } from "../stores";
import { DeckDetailPage } from "./DeckDetailPage";

vi.mock("../api/client", () => ({
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
					$post: vi.fn(),
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

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockDeck = {
	id: "deck-1",
	name: "Japanese Vocabulary",
	description: "Common Japanese words",
	newCardsPerDay: 20,
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
};

const mockCards = [
	{
		id: "card-1",
		deckId: "deck-1",
		front: "Hello",
		back: "こんにちは",
		state: 0,
		due: "2024-01-01T00:00:00Z",
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
		deletedAt: null,
		syncVersion: 0,
	},
	{
		id: "card-2",
		deckId: "deck-1",
		front: "Goodbye",
		back: "さようなら",
		state: 2,
		due: "2024-01-02T00:00:00Z",
		stability: 5.5,
		difficulty: 5.0,
		elapsedDays: 1,
		scheduledDays: 7,
		reps: 5,
		lapses: 1,
		lastReview: "2024-01-01T00:00:00Z",
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
		deletedAt: null,
		syncVersion: 0,
	},
];

function renderWithProviders(path = "/decks/deck-1") {
	const { hook } = memoryLocation({ path, static: true });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<Route path="/decks/:deckId">
					<DeckDetailPage />
				</Route>
			</AuthProvider>
		</Router>,
	);
}

describe("DeckDetailPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiClient.getTokens).mockReturnValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders back link and deck name", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: mockCards }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Japanese Vocabulary" }),
			).toBeDefined();
		});

		expect(screen.getByText(/Back to Decks/)).toBeDefined();
		expect(screen.getByText("Common Japanese words")).toBeDefined();
	});

	it("shows loading state while fetching data", async () => {
		mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

		renderWithProviders();

		expect(screen.getByText("Loading...")).toBeDefined();
	});

	it("displays empty state when no cards exist", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: [] }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("This deck has no cards yet.")).toBeDefined();
		});
		expect(screen.getByText("Add cards to start studying!")).toBeDefined();
	});

	it("displays list of cards", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: mockCards }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("Hello")).toBeDefined();
		});
		expect(screen.getByText("こんにちは")).toBeDefined();
		expect(screen.getByText("Goodbye")).toBeDefined();
		expect(screen.getByText("さようなら")).toBeDefined();
	});

	it("displays card count", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: mockCards }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Cards (2)" })).toBeDefined();
		});
	});

	it("displays card state labels", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: mockCards }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("State: New")).toBeDefined();
		});
		expect(screen.getByText("State: Review")).toBeDefined();
	});

	it("displays card stats (reps and lapses)", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: mockCards }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("Reviews: 0")).toBeDefined();
		});
		expect(screen.getByText("Reviews: 5")).toBeDefined();
		expect(screen.getByText("Lapses: 0")).toBeDefined();
		expect(screen.getByText("Lapses: 1")).toBeDefined();
	});

	it("displays error on API failure for deck", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: async () => ({ error: "Deck not found" }),
		});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Deck not found");
		});
	});

	it("displays error on API failure for cards", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ error: "Failed to load cards" }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load cards",
			);
		});
	});

	it("allows retry after error", async () => {
		const user = userEvent.setup();
		// First call fails for both deck and cards (they run in parallel)
		mockFetch
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ error: "Server error" }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ error: "Server error" }),
			})
			// Second call (retry) succeeds
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: mockCards }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Retry" }));

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Japanese Vocabulary" }),
			).toBeDefined();
		});
	});

	it("passes auth header when fetching data", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: mockDeck }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: [] }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-1", {
				headers: { Authorization: "Bearer access-token" },
			});
		});
		expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-1/cards", {
			headers: { Authorization: "Bearer access-token" },
		});
	});

	it("does not show description if deck has none", async () => {
		const deckWithoutDescription = { ...mockDeck, description: null };
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ deck: deckWithoutDescription }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ cards: [] }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Japanese Vocabulary" }),
			).toBeDefined();
		});

		// No description should be shown
		expect(screen.queryByText("Common Japanese words")).toBeNull();
	});
});
