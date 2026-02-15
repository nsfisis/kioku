/**
 * @vitest-environment jsdom
 */
import { QueryClient } from "@tanstack/query-core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { authLoadingAtom, type Card, type Deck } from "../atoms";
import { CardState } from "../db";
import { DeckCardsPage } from "./DeckCardsPage";

const mockDeckGet = vi.fn();
const mockCardsGet = vi.fn();
const mockNoteDelete = vi.fn();
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
						notes: {
							":noteId": {
								$delete: (args: unknown) => mockNoteDelete(args),
							},
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

// Mock queryClient module so pages use our test queryClient
let testQueryClient: QueryClient;
vi.mock("../queryClient", () => ({
	get queryClient() {
		return testQueryClient;
	},
}));

import { ApiClientError, apiClient } from "../api/client";

const mockDeck = {
	id: "deck-1",
	name: "Japanese Vocabulary",
	description: "Common Japanese words",
	dueCardCount: 0,
	newCardCount: 0,
	totalCardCount: 0,
	reviewCardCount: 0,
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
};

// Basic note-based cards (each with its own note)
const mockBasicCards = [
	{
		id: "card-1",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: false,
		front: "Hello",
		back: "こんにちは",
		state: CardState.New,
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
		noteId: "note-2",
		isReversed: false,
		front: "Goodbye",
		back: "さようなら",
		state: CardState.Review,
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

// Note-based cards (with noteId)
const mockNoteBasedCards = [
	{
		id: "card-3",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: false,
		front: "Apple",
		back: "りんご",
		state: CardState.New,
		due: "2024-01-01T00:00:00Z",
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: "2024-01-02T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
		deletedAt: null,
		syncVersion: 0,
	},
	{
		id: "card-4",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: true,
		front: "りんご",
		back: "Apple",
		state: CardState.New,
		due: "2024-01-01T00:00:00Z",
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 2,
		lapses: 0,
		lastReview: null,
		createdAt: "2024-01-02T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
		deletedAt: null,
		syncVersion: 0,
	},
];

// Alias for existing tests
const mockCards = mockBasicCards;

interface RenderOptions {
	path?: string;
	initialDeck?: Deck;
	initialCards?: Card[];
}

function renderWithProviders({
	path = "/decks/deck-1/cards",
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
				<Route path="/decks/:deckId/cards">
					<DeckCardsPage />
				</Route>
			</Router>
		</Provider>,
	);
}

describe("DeckCardsPage", () => {
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

		// handleResponse simulates actual behavior
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
		expect(screen.getByText(/Back to Deck/)).toBeDefined();
		expect(screen.getByText("Common Japanese words")).toBeDefined();
	});

	it("shows loading state while fetching data", async () => {
		mockDeckGet.mockImplementation(() => new Promise(() => {}));
		mockCardsGet.mockImplementation(() => new Promise(() => {}));

		renderWithProviders();

		expect(document.querySelector(".animate-spin")).toBeDefined();
	});

	it("displays empty state when no cards exist", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: [],
		});

		expect(screen.getByText("No cards yet")).toBeDefined();
		expect(screen.getByText("Add notes to start studying")).toBeDefined();
	});

	it("displays list of cards", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		expect(screen.getByText("Hello")).toBeDefined();
		expect(screen.getByText("こんにちは")).toBeDefined();
		expect(screen.getByText("Goodbye")).toBeDefined();
		expect(screen.getByText("さようなら")).toBeDefined();
	});

	it("displays card count", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		expect(screen.getByText("(2)")).toBeDefined();
	});

	it("displays card state labels", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		expect(screen.getByText("New")).toBeDefined();
		expect(screen.getByText("Review")).toBeDefined();
	});

	it("displays card stats (reps and lapses)", () => {
		renderWithProviders({
			initialDeck: mockDeck,
			initialCards: mockCards,
		});

		expect(screen.getByText("0 reviews")).toBeDefined();
		expect(screen.getByText("5 reviews")).toBeDefined();
		expect(screen.getByText("1 lapses")).toBeDefined();
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

	describe("Delete Note", () => {
		it("shows Delete button for each note", () => {
			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockCards,
			});

			expect(screen.getByText("Hello")).toBeDefined();

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			expect(deleteButtons.length).toBe(2);
		});

		it("opens delete confirmation modal when Delete button is clicked", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockCards,
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			const firstDeleteButton = deleteButtons[0];
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Delete Note" }),
			).toBeDefined();
		});

		it("closes delete modal when Cancel is clicked", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockCards,
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			const firstDeleteButton = deleteButtons[0];
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			expect(screen.getByRole("dialog")).toBeDefined();

			await user.click(screen.getByRole("button", { name: "Cancel" }));

			expect(screen.queryByRole("dialog")).toBeNull();
		});

		it("deletes note and refreshes list on confirmation", async () => {
			const user = userEvent.setup();

			mockCardsGet.mockResolvedValue({
				cards: [mockCards[1]],
			});
			mockNoteDelete.mockResolvedValue({
				ok: true,
				json: async () => ({ success: true }),
			});

			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockCards,
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			const firstDeleteButton = deleteButtons[0];
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			const dialog = screen.getByRole("dialog");
			const modalButtons = dialog.querySelectorAll("button");
			const confirmDeleteButton = Array.from(modalButtons).find((btn) =>
				btn.textContent?.includes("Delete"),
			);
			if (confirmDeleteButton) {
				await user.click(confirmDeleteButton);
			}

			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			expect(mockNoteDelete).toHaveBeenCalledWith({
				param: { deckId: "deck-1", noteId: "note-1" },
			});

			await waitFor(() => {
				expect(screen.getByText("(1)")).toBeDefined();
			});
		});

		it("displays error when delete fails", async () => {
			const user = userEvent.setup();

			mockNoteDelete.mockRejectedValue(
				new ApiClientError("Failed to delete note", 500),
			);

			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockCards,
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			const firstDeleteButton = deleteButtons[0];
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			const dialog = screen.getByRole("dialog");
			const modalButtons = dialog.querySelectorAll("button");
			const confirmDeleteButton = Array.from(modalButtons).find((btn) =>
				btn.textContent?.includes("Delete"),
			);
			if (confirmDeleteButton) {
				await user.click(confirmDeleteButton);
			}

			await waitFor(() => {
				expect(screen.getByRole("alert").textContent).toContain(
					"Failed to delete note",
				);
			});
		});
	});

	describe("Card Grouping by Note", () => {
		it("groups cards by noteId and displays as note groups", () => {
			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockNoteBasedCards,
			});

			expect(screen.getByTestId("note-group")).toBeDefined();

			const noteCards = screen.getAllByTestId("note-card");
			expect(noteCards.length).toBe(2);
		});

		it("shows Normal and Reversed badges for note-based cards", () => {
			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockNoteBasedCards,
			});

			expect(screen.getByText("Normal")).toBeDefined();
			expect(screen.getByText("Reversed")).toBeDefined();
		});

		it("shows edit note button for note groups", () => {
			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockNoteBasedCards,
			});

			expect(screen.getByTestId("note-group")).toBeDefined();

			const editNoteButton = screen.getByRole("button", { name: "Edit note" });
			expect(editNoteButton).toBeDefined();
		});

		it("shows delete note button for note groups", () => {
			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockNoteBasedCards,
			});

			expect(screen.getByTestId("note-group")).toBeDefined();

			const deleteNoteButton = screen.getByRole("button", {
				name: "Delete note",
			});
			expect(deleteNoteButton).toBeDefined();
		});

		it("opens delete note modal when delete button is clicked", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockNoteBasedCards,
			});

			const deleteNoteButton = screen.getByRole("button", {
				name: "Delete note",
			});
			await user.click(deleteNoteButton);

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Delete Note" }),
			).toBeDefined();
		});

		it("deletes note and refreshes list when confirmed", async () => {
			const user = userEvent.setup();

			mockCardsGet.mockResolvedValue({ cards: [] });
			mockNoteDelete.mockResolvedValue({
				ok: true,
				json: async () => ({ success: true }),
			});

			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockNoteBasedCards,
			});

			const deleteNoteButton = screen.getByRole("button", {
				name: "Delete note",
			});
			await user.click(deleteNoteButton);

			const dialog = screen.getByRole("dialog");
			const modalButtons = dialog.querySelectorAll("button");
			const confirmDeleteButton = Array.from(modalButtons).find((btn) =>
				btn.textContent?.includes("Delete"),
			);
			if (confirmDeleteButton) {
				await user.click(confirmDeleteButton);
			}

			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			expect(mockNoteDelete).toHaveBeenCalledWith({
				param: { deckId: "deck-1", noteId: "note-1" },
			});

			await waitFor(() => {
				expect(screen.getByText("No cards yet")).toBeDefined();
			});
		});

		it("displays note preview from normal card content", () => {
			renderWithProviders({
				initialDeck: mockDeck,
				initialCards: mockNoteBasedCards,
			});

			expect(screen.getByTestId("note-group")).toBeDefined();

			expect(screen.getByText("Apple")).toBeDefined();
			expect(screen.getByText("りんご")).toBeDefined();
		});
	});
});
