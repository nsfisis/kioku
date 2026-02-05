/**
 * @vitest-environment jsdom
 */
import { QueryClient } from "@tanstack/query-core";
import { cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { authLoadingAtom, type Card, type Deck } from "../atoms";
import { DeckDetailPage } from "./DeckDetailPage";

const mockDeckGet = vi.fn();
const mockCardsGet = vi.fn();
const mockHandleResponse = vi.fn();

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		isAuthenticated: vi.fn(),
		getTokens: vi.fn(),
		getAuthHeader: vi.fn(),
		onSessionExpired: vi.fn(() => vi.fn()),
		rpc: {
			api: {
				decks: {
					":id": {
						$get: (args: unknown) => mockDeckGet(args),
					},
					":deckId": {
						cards: {
							$get: (args: unknown) => mockCardsGet(args),
						},
					},
				},
			},
		},
		handleResponse: (res: unknown) => mockHandleResponse(res),
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

import { apiClient } from "../api/client";

let testQueryClient: QueryClient;

const mockDeck = {
	id: "deck-1",
	name: "Japanese Vocabulary",
	description: "Common Japanese words",
	newCardsPerDay: 20,
	dueCardCount: 0,
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
};

const mockCards = [
	{
		id: "card-1",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: false,
		front: "Hello",
		back: "こんにちは",
		state: 0,
		due: "2099-01-01T00:00:00Z", // Not due yet (future date)
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
		noteId: "note-2",
		isReversed: false,
		front: "Goodbye",
		back: "さようなら",
		state: 2,
		due: new Date().toISOString(), // Due now
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

interface RenderOptions {
	path?: string;
	initialDeck?: Deck;
	initialCards?: Card[];
}

function renderWithProviders({
	path = "/decks/deck-1",
	initialDeck,
	initialCards,
}: RenderOptions = {}) {
	const { hook } = memoryLocation({ path, static: true });
	const store = createStore();
	store.set(authLoadingAtom, false);
	store.set(queryClientAtom, testQueryClient);

	// Extract deckId from path
	const deckIdMatch = path.match(/\/decks\/([^/]+)/);
	const deckId = deckIdMatch?.[1] ?? "deck-1";

	// Seed query cache if initial data provided
	if (initialDeck !== undefined) {
		testQueryClient.setQueryData(["decks", deckId], initialDeck);
	}
	if (initialCards !== undefined) {
		testQueryClient.setQueryData(["decks", deckId, "cards"], initialCards);
	}

	return render(
		<Provider store={store}>
			<Router hook={hook}>
				<Route path="/decks/:deckId">
					<DeckDetailPage />
				</Route>
			</Router>
		</Provider>,
	);
}

describe("DeckDetailPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testQueryClient = new QueryClient({
			defaultOptions: {
				queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
			},
		});
		vi.mocked(apiClient.getTokens).mockReturnValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
		});

		mockHandleResponse.mockImplementation(async (res) => {
			if (res.ok === undefined && res.status === undefined) {
				return res;
			}
			if (!res.ok) {
				const body = await res.json?.().catch(() => ({}));
				throw new Error(
					body?.error || `Request failed with status ${res.status}`,
				);
			}
			return typeof res.json === "function" ? res.json() : res;
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		testQueryClient.clear();
	});

	it("renders back link and deck name", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		expect(
			screen.getByRole("heading", { name: "Japanese Vocabulary" }),
		).toBeDefined();
		expect(screen.getByText(/Back to Decks/)).toBeDefined();
		expect(screen.getByText("Common Japanese words")).toBeDefined();
	});

	it("shows loading state while fetching data", async () => {
		mockDeckGet.mockImplementation(() => new Promise(() => {}));
		mockCardsGet.mockImplementation(() => new Promise(() => {}));

		renderWithProviders();

		expect(document.querySelector(".animate-spin")).toBeDefined();
	});

	it("does not show description if deck has none", () => {
		const deckWithoutDescription = { ...mockDeck, description: null };
		renderWithProviders({
			initialDeck: deckWithoutDescription,
			initialCards: [],
		});

		expect(
			screen.getByRole("heading", { name: "Japanese Vocabulary" }),
		).toBeDefined();
		expect(screen.queryByText("Common Japanese words")).toBeNull();
	});

	it("displays Study Now button", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		const studyButton = screen.getByRole("link", { name: /Study Now/ });
		expect(studyButton).toBeDefined();
		expect(studyButton.getAttribute("href")).toBe("/decks/deck-1/study");
	});

	it("displays View Cards link", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		const viewCardsLink = screen.getByRole("link", { name: /View Cards/ });
		expect(viewCardsLink).toBeDefined();
		expect(viewCardsLink.getAttribute("href")).toBe("/decks/deck-1/cards");
	});

	it("displays total card count", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		const totalCardsLabel = screen.getByText("Total");
		expect(totalCardsLabel).toBeDefined();
		// Find the count within the same container
		const totalCardsContainer = totalCardsLabel.parentElement;
		expect(totalCardsContainer?.querySelector(".text-ink")?.textContent).toBe(
			"2",
		);
	});

	it("displays card counts by state", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		// New cards (state=0, but card-1 is not due yet, so 0)
		const newLabel = screen.getByText("New");
		expect(newLabel).toBeDefined();
		const newContainer = newLabel.parentElement;
		expect(newContainer?.querySelector(".text-info")?.textContent).toBe("0");

		// Learning cards (state=1 or 3, none in mockCards)
		const learningLabel = screen.getByText("Learning");
		expect(learningLabel).toBeDefined();
		const learningContainer = learningLabel.parentElement;
		expect(learningContainer?.querySelector(".text-warning")?.textContent).toBe(
			"0",
		);

		// Review cards (state=2, card-2 is due now)
		const reviewLabel = screen.getByText("Review");
		expect(reviewLabel).toBeDefined();
		const reviewContainer = reviewLabel.parentElement;
		expect(reviewContainer?.querySelector(".text-success")?.textContent).toBe(
			"1",
		);
	});

	it("does not display card list (cards are hidden)", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		// Card content should NOT be visible on deck detail page
		expect(screen.queryByText("Hello")).toBeNull();
		expect(screen.queryByText("こんにちは")).toBeNull();
		expect(screen.queryByText("Goodbye")).toBeNull();
	});
});
